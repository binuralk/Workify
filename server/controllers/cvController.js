const axios = require('axios');
const FormData = require('form-data');
const fs = require('fs');
const path = require('path');
const Candidate = require('../models/Candidate');
const Candidate_Job = require('../models/Candidate_Job');
const Skill = require('../models/Skill');
const mongoose = require('mongoose');

// Helper to send a file buffer to Affinda v3 and poll for result
async function sendToAffinda({ filePath, filename, workspace }) {
  const AFFINDA_API_KEY = process.env.AFFINDA_API_KEY;
  const rawAffindaUrl = process.env.AFFINDA_URL || 'https://api.affinda.com';
  if (!AFFINDA_API_KEY) throw new Error('AFFINDA_API_KEY not configured');

  // Normalize the configured URL so callers can set either the base URL
  // (e.g. https://api.affinda.com) or a URL that already contains /v3 or
  // /v3/documents. We ensure apiBase ends with exactly '/v3' so we don't
  // accidentally call '/v3/documents/v3/documents' which causes 404s.
  const normalized = rawAffindaUrl.replace(/\/+$|\s+/g, '');
  const base = normalized.includes('/v3') ? normalized.replace(/\/v3.*$/i, '') : normalized;
  const apiBase = `${base}/v3`;

  const form = new FormData();
  form.append('file', fs.createReadStream(filePath), filename);
  if (workspace) form.append('workspace', workspace);

  const headers = { Authorization: `Bearer ${AFFINDA_API_KEY}`, ...form.getHeaders() };

  const postUrl = `${apiBase}/documents`;
  let res;
  try {
    res = await axios.post(postUrl, form, { headers });
  } catch (err) {
    console.error('Affinda POST error', err.response?.status, err.response?.data || err.message);
    // surface a cleaner error message back to callers
    throw new Error(`Affinda request failed: ${err.response?.status || err.message}`);
  }

  if (!res.data || !res.data.id) return res.data;

  const docId = res.data.id;
  // Poll for completion
  const maxAttempts = 12;
  const delayMs = 2000;
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    await new Promise(r => setTimeout(r, delayMs));
    const statusUrl = `${apiBase}/documents/${docId}`;
    let statusRes;
    try {
      statusRes = await axios.get(statusUrl, { headers });
    } catch (err) {
      console.error('Affinda GET error', statusUrl, err.response?.status, err.response?.data || err.message);
      // If document isn't found (404) treat as a hard error; otherwise continue polling
      if (err.response && err.response.status === 404) {
        throw new Error('Affinda document not found (404)');
      }
      continue;
    }
    if (statusRes.data && statusRes.data.meta && statusRes.data.meta.ready) {
      return statusRes.data;
    }
    if (statusRes.data && statusRes.data.meta && statusRes.data.meta.failed) {
      return statusRes.data; // return failure payload
    }
  }
  throw new Error('Affinda timed out');
}

// POST /candidate/parse-cv
exports.parseCv = async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ msg: 'No file uploaded' });
    const workspace = process.env.AFFINDA_WORKSPACE || req.body.workspace;
    const filePath = path.join(__dirname, '..', req.file.path);
    const parsed = await sendToAffinda({ filePath, filename: req.file.originalname, workspace });
    return res.json({ success: true, data: parsed });
  } catch (err) {
    console.error('parseCv error', err.message || err);
    res.status(500).json({ success: false, msg: err.message });
  }
};

// POST /candidate/apply
// Accepts either parsed JSON in body.parsed or an uploaded file
exports.apply = async (req, res) => {
  try {
    const userId = req.user.id;
    const { job_id } = req.body;
    if (!job_id) return res.status(400).json({ success: false, msg: 'Missing job_id' });
    if (!mongoose.Types.ObjectId.isValid(job_id)) return res.status(400).json({ success: false, msg: 'Invalid job_id' });

    let parsedData = null;
    if (req.body.parsed) {
      parsedData = typeof req.body.parsed === 'string' ? JSON.parse(req.body.parsed) : req.body.parsed;
    } else if (req.file) {
      const workspace = process.env.AFFINDA_WORKSPACE || req.body.workspace;
      const filePath = path.join(__dirname, '..', req.file.path);
      parsedData = await sendToAffinda({ filePath, filename: req.file.originalname, workspace });
    }

    // Map parsed data to our Candidate_Job shape (best effort)
    const map = (p) => {
      const out = {};
      if (!p) return out;
      // Log the raw provider response for debugging
      try { console.log('Affinda raw response (map):', JSON.stringify(p).slice(0, 2000)); } catch(e) {}

      // helper to safely access nested paths
      const get = (obj, path) => {
        if (!obj) return undefined;
        let cur = obj;
        for (const k of path) {
          if (cur == null) return undefined;
          cur = cur[k];
        }
        return cur;
      };

      // normalized root candidates
      const meta = p.data || p;

      // Try multiple common locations for full name / first/last
      const fullNameCandidates = [
        get(meta, ['name']),
        get(meta, ['full_name']),
        get(meta, ['extractions','full_name','value']),
        get(meta, ['data','extractions','full_name','value']),
        get(meta, ['data','0','extractions','full_name','value']),
        get(meta, ['meta','createdBy','name']),
      ];
      const firstNameCandidates = [
        get(meta, ['first_name']),
        get(meta, ['extractions','first_name','value']),
        get(meta, ['data','extractions','first_name','value'])
      ];
      const lastNameCandidates = [
        get(meta, ['last_name']),
        get(meta, ['extractions','last_name','value']),
        get(meta, ['data','extractions','last_name','value'])
      ];

      const pick = (arr) => arr.find(x => x !== undefined && x !== null && x !== '');
      const rawFull = pick(fullNameCandidates);
      let fn = pick(firstNameCandidates);
      let ln = pick(lastNameCandidates);
      if (!fn && !ln && rawFull) {
        // split full name heuristically
        const parts = rawFull.trim().split(/\s+/);
        fn = parts.shift() || '';
        ln = parts.join(' ') || '';
      }

      out.firstName = fn || '';
      out.lastName = ln || '';

      // summary/about
      out.about = pick([get(meta, ['summary']), get(meta, ['profile']), get(meta, ['extractions','summary','value']), get(meta, ['data','extractions','summary','value'])]) || '';

      out.contact = {};
      out.contact.email = pick([get(meta, ['email']), get(meta, ['extractions','email','value']), get(meta, ['data','extractions','email','value'])]) || '';
      out.contact.phone = pick([get(meta, ['phone']), get(meta, ['extractions','phone','value']), get(meta, ['data','extractions','phone','value'])]) || '';
      out.contact.linkedIn = pick([get(meta, ['linkedin']), get(meta, ['extractions','linkedin','value']), get(meta, ['data','extractions','linkedin','value'])]) || '';

      out.parsed_cv = meta;

      // Skills - many formats: array of strings or extractions
      const skillsA = pick([get(meta, ['skills']), get(meta, ['extractions','skills','values']), get(meta, ['data','extractions','skills','values']), get(meta, ['data','skills'])]);
      if (Array.isArray(skillsA)) {
        out.parsed_skills = skillsA.map(s => (typeof s === 'string' ? s : (s.name || s.value || ''))).filter(Boolean);
      } else if (typeof skillsA === 'string') {
        out.parsed_skills = skillsA.split(/,|;/).map(s=>s.trim()).filter(Boolean);
      } else {
        out.parsed_skills = [];
      }

      // Education
      const edu = pick([get(meta, ['education']), get(meta, ['extractions','education','value']), get(meta, ['data','education'])]) || [];
      out.education = Array.isArray(edu) ? edu.map(e => ({ degree: e.degree || e.qualification || e.degreeName || '', school: e.school || e.institution || '', dates: e.dates || e.period || '' })) : [];

      // Experience
      out.experience = { years: pick([get(meta, ['experience_years']), get(meta, ['years'])]) || null, description: pick([get(meta, ['experience_summary']), get(meta, ['extractions','experience_summary','value'])]) || '' };
      const w = pick([get(meta, ['work_experience']), get(meta, ['extractions','work_experience','value']), get(meta, ['data','work_experience'])]) || [];
      out.work_experience = Array.isArray(w) ? w.map(item => ({ title: item.title || item.position || '', company: item.company || item.employer || '', dates: item.dates || item.period || '', description: item.description || item.summary || '' })) : [];

      return out;
    };

    const mapped = map(parsedData);

    // Create Candidate_Job
    // If the parsed names are missing, fetch candidate profile to fill from user data
    if (!mapped.firstName || !mapped.lastName) {
      try {
        const cand = await Candidate.findById(userId).populate({ path: '_id', model: 'User', select: 'firstName lastName' });
        const user = cand?._id;
        if (user) {
          mapped.firstName = mapped.firstName || user.firstName || '';
          mapped.lastName = mapped.lastName || user.lastName || '';
        }
      } catch (e) {
        // ignore
      }
    }

    const candidateJob = new Candidate_Job({
      candidate_id: userId,
      firstName: mapped.firstName || '',
      lastName: mapped.lastName || '',
      about: mapped.about || '',
      contact: mapped.contact || {},
      skills: [], // will fill below if skill matching available
      parsed_skills: mapped.parsed_skills || [],
      parsed_cv: mapped.parsed_cv || {},
      education: mapped.education || [],
      experience: mapped.experience || {},
      work_experience: mapped.work_experience || [],
    });

    // job_id is required and validated above; set it on the candidate job
    candidateJob.job_id = job_id;

    // Try to match parsed skill names to Skill documents
    if (mapped.parsed_skills && mapped.parsed_skills.length) {
      const foundSkills = await Skill.find({ name: { $in: mapped.parsed_skills } });
      if (foundSkills.length) {
        candidateJob.skills = foundSkills.map(s => s._id);
      }
    }

    await candidateJob.save();

    return res.json({ success: true, data: candidateJob });
  } catch (err) {
    console.error('apply error', err.message || err);
    res.status(500).json({ success: false, msg: err.message });
  }
};
