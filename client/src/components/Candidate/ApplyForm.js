import React, { useState, useEffect } from 'react';
import axios from 'axios';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Box,
  Stepper,
  Step,
  StepLabel,
  Typography,
  TextField,
  CircularProgress,
  IconButton
} from '@mui/material';
import { Person, Description, UploadFile, CheckCircle, Close } from '@mui/icons-material';

const steps = ['Confirm Details', 'Upload Documents', 'Review & Submit'];

// Mock user data - used only as a final fallback
const MOCK_USER = {
  name: 'Nethmini Lankathilaka',
  email: 'nethmini.l@email.com',
  phone: '070 4324312'
};

// Accept an optional userProfile prop (real app should pass authenticated candidate data)
const ApplyForm = ({ open, onClose, job, userProfile }) => {
  const [activeStep, setActiveStep] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [resumeFile, setResumeFile] = useState(null);
  const [coverLetter, setCoverLetter] = useState('');
  const [parsedCv, setParsedCv] = useState(null);
  const [formValues, setFormValues] = useState({});
  const [parseLoading, setParseLoading] = useState(false);
  const [parseError, setParseError] = useState(null);

  const handleNext = () => {
    setActiveStep((prevActiveStep) => prevActiveStep + 1);
  };

  const handleBack = () => {
    setActiveStep((prevActiveStep) => prevActiveStep - 1);
  };

  const handleFileChange = (event) => {
    if (event.target.files && event.target.files[0]) {
      const f = event.target.files[0];
      setResumeFile(f);
      uploadAndParseCv(f);
    }
  };

  const uploadAndParseCv = async (file) => {
    setParseError(null);
    setParseLoading(true);
    try {
      const token = localStorage.getItem('token');
      const fd = new FormData();
      fd.append('cv', file);
      const res = await axios.post('http://localhost:5000/candidate/parse-cv', fd, { headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'multipart/form-data' } });
      if (res.data && res.data.success) {
        setParsedCv(res.data.data);
      } else if (res.data) {
        setParsedCv(res.data);
      }
    } catch (err) {
      console.error('Parse failed', err.response?.data || err.message);
      setParseError(err.response?.data?.msg || err.message || 'Parse failed');
      setParsedCv(null);
    } finally {
      setParseLoading(false);
    }
  };

  useEffect(() => {
    // When parsedCv changes, populate formValues for the review step
    if (!parsedCv) return;
    const meta = parsedCv.data || parsedCv;
    const profile = userProfile || {};
    setFormValues({
      fullName: profile.name || `${profile.firstName || ''} ${profile.lastName || ''}`.trim() || (meta.name || ''),
      email: profile.contact?.email || profile.email || (meta.email || ''),
      phone: profile.contact?.phone || profile.phone || (meta.phone || ''),
      linkedIn: (meta.linkedin || ''),
      summary: meta.summary || meta.profile || '',
      skills: Array.isArray(meta.skills) ? meta.skills.map(s => (typeof s === 'string' ? s : s.name || '')) : [],
      education: Array.isArray(meta.education) ? meta.education : [],
      experience: meta.experience || {},
      work_experience: Array.isArray(meta.work_experience) ? meta.work_experience : [],
    });
  }, [parsedCv, userProfile]);

  const handleSubmit = async () => {
    setIsSubmitting(true);
    try {
      const token = localStorage.getItem('token');
      const fd = new FormData();
      // job._id should be the Mongo ObjectId of the job post. Validate existence before submitting.
      const jobIdToSend = job._id || job.id;
      if (!jobIdToSend) {
        alert('Job identifier missing. Cannot submit application.');
        setIsSubmitting(false);
        return;
      }
      fd.append('job_id', jobIdToSend);
      fd.append('parsed', JSON.stringify({
        name: formValues.fullName,
        email: formValues.email,
        phone: formValues.phone,
        linkedIn: formValues.linkedIn,
        summary: formValues.summary,
        skills: formValues.skills,
        education: formValues.education,
        experience: formValues.experience,
        work_experience: formValues.work_experience,
      }));
      if (resumeFile) fd.append('cv', resumeFile);
      const res = await axios.post('http://localhost:5000/candidate/apply', fd, { headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'multipart/form-data' } });
      if (res.data && res.data.success) {
        // move to success
        handleNext();
      } else {
        console.error('Apply failed', res.data);
        alert('Apply failed: ' + (res.data.msg || 'Unknown error'));
      }
    } catch (err) {
      console.error('Submit error', err.response?.data || err.message);
      alert('Could not submit application: ' + (err.response?.data?.msg || err.message));
    } finally {
      setIsSubmitting(false);
    }
  };
  
  const handleCloseDialog = () => {
    // Reset state on close
    setTimeout(() => {
        setActiveStep(0);
        setResumeFile(null);
        setCoverLetter('');
    }, 300); // Delay to allow closing animation
    onClose();
  };


  const getStepContent = (step) => {
    switch (step) {
      case 0:
        // prefer provided userProfile, then fall back to mock
        const profile = userProfile || MOCK_USER;
        const fullName = profile.name || `${profile.firstName || ''} ${profile.lastName || ''}`.trim();
        const email = profile.contact?.email || profile.email || '';
        const phone = profile.contact?.phone || profile.phone || '';

        return (
          <Box>
            <Typography variant="h6" gutterBottom>Personal Information</Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              This information is from your profile. It will be shared with the recruiter.
            </Typography>
            <Box sx={{ bgcolor: 'grey.100', p: 2, borderRadius: 1 }}>
              <TextField label="Full Name" defaultValue={fullName} fullWidth margin="dense" InputProps={{ readOnly: true }} />
              <TextField label="Email Address" defaultValue={email} fullWidth margin="dense" InputProps={{ readOnly: true }} />
              <TextField label="Phone Number" defaultValue={phone} fullWidth margin="dense" InputProps={{ readOnly: true }} />
            </Box>
          </Box>
        );
      case 1:
        return (
          <Box>
            <Typography variant="h6" gutterBottom>Your Documents</Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              Please upload your resume. A cover letter is optional but recommended.
            </Typography>
            <Button
              variant="outlined"
              component="label"
              fullWidth
              startIcon={<UploadFile                    />}
              sx={{ mb: 2, textTransform: 'none', color: resumeFile ? 'success.main' : 'primary.main' }}
            >
              {resumeFile ? `${resumeFile.name} (Uploaded)` : 'Upload Resume/CV'}
              <input type="file" hidden onChange={handleFileChange} accept=".pdf,.doc,.docx" />
            </Button>
            <TextField
              label="Cover Letter (Optional)"
              multiline
              rows={6}
              fullWidth
              variant="outlined"
              value={coverLetter}
              onChange={(e) => setCoverLetter(e.target.value)}
            />
            {parseLoading && <Typography sx={{ mt: 1 }} color="text.secondary">Parsing CV... please wait.</Typography>}
            {parseError && <Typography sx={{ mt: 1 }} color="error">Parse error: {parseError}</Typography>}
            {parsedCv && (
              <Box sx={{ mt: 2, p: 2, border: '1px dashed', borderColor: 'divider', borderRadius: 1 }}>
                <Typography variant="subtitle2">Parsed preview (raw)</Typography>
                <pre style={{ maxHeight: 200, overflow: 'auto' }}>{JSON.stringify(parsedCv, null, 2)}</pre>
              </Box>
            )}
          </Box>
        );
      case 2:
        return (
          <Box>
            <Typography variant="h6" gutterBottom>Review & Submit</Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              One final check before you submit. Edit any fields below and then submit your application.
            </Typography>

            <Box sx={{ border: '1px solid', borderColor: 'divider', p: 2, borderRadius: 1, mb: 2 }}>
              <Typography gutterBottom><strong>Applying for:</strong> {job.title} at {job.company}</Typography>
              <Typography gutterBottom><strong>Resume:</strong> {resumeFile?.name || 'Not provided'}</Typography>
              <Typography><strong>Cover Letter:</strong> {coverLetter ? 'Included' : 'Not included'}</Typography>
            </Box>

            {/* Editable parsed fields */}
            <Box sx={{ display: 'grid', gap: 2 }}>
              <TextField label="Full Name" value={formValues.fullName || ''} onChange={(e) => setFormValues(v => ({ ...v, fullName: e.target.value }))} fullWidth />
              <TextField label="Email" value={formValues.email || ''} onChange={(e) => setFormValues(v => ({ ...v, email: e.target.value }))} fullWidth />
              <TextField label="Phone" value={formValues.phone || ''} onChange={(e) => setFormValues(v => ({ ...v, phone: e.target.value }))} fullWidth />
              <TextField label="LinkedIn" value={formValues.linkedIn || ''} onChange={(e) => setFormValues(v => ({ ...v, linkedIn: e.target.value }))} fullWidth />
              <TextField label="Summary" value={formValues.summary || ''} onChange={(e) => setFormValues(v => ({ ...v, summary: e.target.value }))} multiline rows={4} fullWidth />
              <TextField label="Skills (comma separated)" value={(formValues.skills || []).join(', ')} onChange={(e) => setFormValues(v => ({ ...v, skills: e.target.value.split(',').map(s => s.trim()).filter(Boolean) }))} fullWidth />
            </Box>
          </Box>
        );
      default:
        return 'Unknown step';
    }
  };

  return (
    <Dialog open={open} onClose={handleCloseDialog} fullWidth maxWidth="sm">
      <DialogTitle sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        Apply to {job?.title}
        <IconButton edge="end" color="inherit" onClick={handleCloseDialog}>
            <Close />
        </IconButton>
      </DialogTitle>
      <DialogContent>
        <Stepper activeStep={activeStep} sx={{ my: 3 }}>
          {steps.map((label) => (
            <Step key={label}>
              <StepLabel>{label}</StepLabel>
            </Step>
          ))}
        </Stepper>

        {activeStep === steps.length ? (
          <Box sx={{ textAlign: 'center', p: 4 }}>
            <CheckCircle color="success" sx={{ fontSize: 60, mb: 2 }} />
            <Typography variant="h5" gutterBottom>Application Sent!</Typography>
            <Typography color="text.secondary">
              You can track the status of this application in your Overview tab. The team at {job?.company} will be in touch.
            </Typography>
          </Box>
        ) : (
          <Box sx={{ mt: 2, mb: 1 }}>{getStepContent(activeStep)}</Box>
        )}
      </DialogContent>
      <DialogActions sx={{ p: 2 }}>
        {activeStep === steps.length ? (
          <Button onClick={handleCloseDialog} variant="contained">Close</Button>
        ) : (
          <Box sx={{ flex: '1 1 auto', display: 'flex', justifyContent: 'space-between' }}>
            <Button
              color="inherit"
              disabled={activeStep === 0}
              onClick={handleBack}
            >
              Back
            </Button>
            <Button
              variant="contained"
              onClick={activeStep === steps.length - 1 ? handleSubmit : handleNext}
              disabled={isSubmitting || (activeStep === 1 && !resumeFile)}
            >
              {isSubmitting ? <CircularProgress size={24} color="inherit" /> : (activeStep === steps.length - 1 ? 'Submit Application' : 'Next')}
            </Button>
          </Box>
        )}
      </DialogActions>
    </Dialog>
  );
};

export default ApplyForm;