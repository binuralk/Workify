import React, { useState, useMemo, useEffect } from 'react';
import {
  Box,
  Typography,
  Paper,
  Chip,
  Button,
  Divider,
  IconButton,
  Avatar,
  Grid,
  Collapse,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  TextField,
  InputAdornment,
  Stack
} from "@mui/material";
import { 
  BookmarkBorder, 
  Bookmark,
  LocationOn,
  Apartment,
  Search,
  ArrowBack
} from '@mui/icons-material';
import CheckIcon from '@mui/icons-material/Check';
import ApplyForm from './ApplyForm';
import axios from 'axios';

// EXPANDED MOCK DATA to demonstrate functionality
const jobPostings = [
  {
    _id: '650d2f9b9c1e4d3f2c8a0001',
    id: 1,
    title: 'Senior React Developer',
    company: 'WealthOS',
    logo: 'https://via.placeholder.com/40?text=W',
    location: 'Colombo, Sri Lanka (Hybrid)',
    type: 'Full-time',
    model: 'Remote',
    salary: 'LKR 300,000 - 400,000 per month"',
    postedDate: 'Today',
    description: 'Lead frontend development for our international clients from our Colom…',
    responsibilities: ['Must be available for overlap with European timezone 3 hours daily'],
    qualifications: ['5+ years of React experience', 'Strong proficiency in JavaScript & CSS', 'Experience with RESTful APIs']
  },
  {
    _id: '650d2f9b9c1e4d3f2c8a0002',
    id: 2,
    title: 'Node.js Backend Engineer',
    company: 'IFS',
    logo: 'https://via.placeholder.com/40?text=I',
    location: 'Colombo',
    type: 'Contract',
    model: 'Hybrid',
    salary: 'LKR 90,000 - 110,000 per month',
    postedDate: '2d ago',
    description: 'We are looking for a talented UI/UX Designer to create amazing user experiences. The ideal candidate should have an eye for clean and artful design, possess superior UI skills and be able to translate high-level requirements into interaction flows and artifacts.',
    responsibilities: ['Gather and evaluate user requirements', 'Illustrate design ideas using storyboards', 'Design graphical user interface elements'],
    qualifications: ['Proven UX/UI experience', 'Portfolio of design projects', 'Proficiency in Figma, Sketch, or Adobe XD']
  },
  {
    _id: '650d2f9b9c1e4d3f2c8a0003',
    id: 3,
    title: 'Junior QA Engineer',
    company: 'Furtado',
    logo: 'https://via.placeholder.com/40?text=F',
    location: 'Colombo',
    type: 'Full-time',
    model: 'Onsite',
    salary: 'LKR 70,000 - 90,000 per month',
    postedDate: '1d ago',
    description: 'We are seeking a detail-oriented Junior QA Engineer to join our quality assurance team. You will be responsible for testing our software to ensure it meets our high-quality standards.',
    responsibilities: ['Executing test cases (manual or automated)', 'Reporting and documenting technical issues', 'Participating in design reviews'],
    qualifications: ['BSc in Computer Science or related field', 'Strong analytical skills', 'Familiarity with Agile frameworks']
  },
  {
    _id: '650d2f9b9c1e4d3f2c8a0004',
    id: 4,
    title: 'Node.js Backend Developer',
    company: 'Surge Global',
    logo: 'https://via.placeholder.com/40?text=S',
    location: 'Remote',
    type: 'Full-time',
    model: 'Remote',
    salary: 'LKR 120,000 - 160,000 per month',
    postedDate: '3d ago',
    description: 'We are looking for a Node.js Developer to join our backend team. You will be responsible for managing the interchange of data between the server and the users.',
    responsibilities: ['Developing server-side logic', 'Defining and maintaining the central database', 'Ensuring high performance and responsiveness'],
    qualifications: ['2+ years of Node.js and Express experience', 'Experience with MongoDB', 'Understanding of RESTful APIs']
  },
  {
    _id: '650d2f9b9c1e4d3f2c8a0005',
    id: 5,
    title: 'DevOps Engineer',
    company: 'Sysco Labs',
    logo: 'https://via.placeholder.com/40?text=SL',
    location: 'Colombo',
    type: 'Full-time',
    model: 'Hybrid',
    salary: 'LKR 150,000 - 200,000 per month',
    postedDate: '7d ago',
    description: 'Join our team to manage our infrastructure and tools. You will work with developers to facilitate a smooth and efficient development and deployment pipeline.',
    responsibilities: ['CI/CD pipeline management', 'Infrastructure as Code (IaC) with Terraform', 'Monitoring with Prometheus/Grafana'],
    qualifications: ['Experience with AWS or Azure', 'Proficiency in scripting languages like Bash or Python', 'Knowledge of Docker and Kubernetes']
  },
  {
    _id: '650d2f9b9c1e4d3f2c8a0006',
    id: 6,
    title: 'Project Manager',
    company: 'LSEG',
    logo: 'https://via.placeholder.com/40?text=L',
    location: 'Colombo',
    type: 'Full-time',
    model: 'Onsite',
    salary: 'LKR 180,000 - 220,000 per month',
    postedDate: '10d ago',
    description: 'We need an experienced Project Manager to coordinate people and processes to ensure that our projects are delivered on time and produce the desired results.',
    responsibilities: ['Developing project plans', 'Managing project budget', 'Communicating with stakeholders'],
    qualifications: ['Proven experience in project management', 'PMP certification is a plus', 'Strong leadership skills']
  }
];


// We'll fetch the real candidate profile and pass it to the Apply modal
const INITIAL_PROFILE = null;

const FindJobs = () => {
  const [selectedJobId, setSelectedJobId] = useState(null);
  const [savedJobs, setSavedJobs] = useState(new Set());
  
  // NEW state to manage the view: 'top', 'explore', or 'saved'
  const [viewMode, setViewMode] = useState('top');
  const [searchTerm, setSearchTerm] = useState('');

  const [isApplyFormOpen, setApplyFormOpen] = useState(false);
  const [applyingForJob, setApplyingForJob] = useState(null);
  const [userProfile, setUserProfile] = useState(INITIAL_PROFILE);

  useEffect(() => {
    const fetchUserProfile = async () => {
      try {
        const token = localStorage.getItem('token');
        if (token) {
          const response = await axios.get('http://localhost:5000/candidate/profile', {
            headers: { Authorization: `Bearer ${token}` }
          });
          setUserProfile(response.data);
        }
      } catch (error) {
        console.error('Error fetching user profile in FindJobs:', error);
      }
    };

    fetchUserProfile();
  }, []);

  const handleToggleDetails = (jobId) => {
    setSelectedJobId(prevId => (prevId === jobId ? null : jobId));
  };

  const handleToggleSave = (jobId) => {
    setSavedJobs(prevSaved => {
      const newSaved = new Set(prevSaved);
      if (newSaved.has(jobId)) newSaved.delete(jobId);
      else newSaved.add(jobId);
      return newSaved;
    });
  };

  const handleOpenApplyForm = (job) => {
    setApplyingForJob(job);
    setApplyFormOpen(true);
  };

  const handleCloseApplyForm = () => {
    setApplyFormOpen(false);
    setTimeout(() => setApplyingForJob(null), 300);
  };
  
  // UPDATED logic to determine which jobs to show based on the view mode and search term
  const displayedJobs = useMemo(() => {
    switch (viewMode) {
      case 'top':
        return jobPostings.slice(0, 5);
      case 'saved':
        return jobPostings.filter(job => savedJobs.has(job.id));
      case 'explore':
        if (!searchTerm) return jobPostings;
        return jobPostings.filter(job =>
          job.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
          job.company.toLowerCase().includes(searchTerm.toLowerCase()) ||
          job.description.toLowerCase().includes(searchTerm.toLowerCase())
        );
      default:
        return [];
    }
  }, [viewMode, searchTerm, savedJobs]);

  const titles = {
    top: 'Top job picks for you',
    explore: 'Explore All Opportunities',
    saved: 'Your Saved Jobs',
  };

  return (
    <Box>
      {/* Search and Filter Header */}
      <Box sx={{ mb: 4 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
          <Typography variant="h5" sx={{ fontWeight: 600 }}>
            {titles[viewMode]}
          </Typography>
          
          {/* UPDATED Button Group */}
          <Stack direction="row" spacing={1}>
            {viewMode === 'top' ? (
              <>
                <Button 
                  variant="contained" 
                  onClick={() => setViewMode('explore')}
                  sx={{ backgroundColor: '#0a2048', color: '#ffffff', '&:hover': { backgroundColor: '#1a3668' } }}
                >
                  Explore More Jobs
                </Button>
                <Button 
                  variant="outlined" 
                  onClick={() => setViewMode('saved')}
                  sx={{
                    backgroundColor: '#ffffff',
                    borderColor: '#0a2048',
                    color: '#0a2048',
                    '&:hover': {
                      backgroundColor: 'rgba(10, 32, 72, 0.04)',
                      borderColor: '#0a2048'
                    }
                  }}
                >
                  Saved Jobs
                </Button></>
            ) : (
              <Button variant="contained" startIcon={<ArrowBack />} onClick={() => setViewMode('top')} sx={{ backgroundColor: '#0a2048', color: '#ffffff', '&:hover': { backgroundColor: '#1a3668' } }}>
                Back to Top Jobs
              </Button>
            )}
          </Stack>
        </Box>

        {/* Search Bar now only shows in 'explore' mode */}
        {viewMode === 'explore' && (
            <TextField
                fullWidth
                variant="outlined"
                placeholder="Search by title, company, or keyword..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                InputProps={{
                    startAdornment: (
                    <InputAdornment position="start"><Search /></InputAdornment>
                    ),
                }}
            />
        )}
      </Box>

      {/* Job Postings List */}
      <Box>
        {displayedJobs.length > 0 ? (
          displayedJobs.map((job) => (
            <Paper key={job.id} elevation={2} sx={{ mb: 2, p: 2.5, borderRadius: 2, transition: 'box-shadow 0.3s', '&:hover': { boxShadow: 6 } }}>
              {/* Job Card content remains the same */}
              <Grid container spacing={2} alignItems="center">
                <Grid item><Avatar src={job.logo} sx={{ width: 50, height: 50 }} /></Grid>
                <Grid item xs>
                  <Typography variant="h6">{job.title}</Typography>
                  <Box display="flex" alignItems="center" gap={2} color="text.secondary" flexWrap="wrap">
                    <Box display="flex" alignItems="center"><Apartment fontSize="small" sx={{ mr: 0.5 }} /> {job.company}</Box>
                    <Box display="flex" alignItems="center"><LocationOn fontSize="small" sx={{ mr: 0.5 }} /> {job.location}</Box>
                  </Box>
                </Grid>
                <Grid item><IconButton onClick={() => handleToggleSave(job.id)}>{savedJobs.has(job.id) ? <Bookmark color="primary" /> : <BookmarkBorder />}</IconButton></Grid>
              </Grid>
              <Box sx={{ my: 2, display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                <Chip label={job.type} size="small" />
                <Chip label={job.model} size="small" variant="outlined" />
                <Chip label={job.salary} size="small" variant="outlined" color="success" />
              </Box>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Typography variant="caption" color="text.secondary">Posted {job.postedDate}</Typography>
                <Box>
                  <Button variant="text" size="small" onClick={() => handleToggleDetails(job.id)}>{selectedJobId === job.id ? 'Hide Details' : 'View Details'}</Button>
                  <Button variant="contained" size="small" sx={{ ml: 1 }} onClick={() => handleOpenApplyForm(job)}>Apply Now</Button>
                </Box>
              </Box>
              <Collapse in={selectedJobId === job.id} timeout="auto" unmountOnExit>
                <Divider sx={{ my: 2 }} />
                <Box sx={{ p: 1 }}>
                  <Typography variant="body1" paragraph>{job.description}</Typography>
                  <Typography variant="subtitle1" gutterBottom sx={{ fontWeight: 'bold' }}>Responsibilities</Typography>
                  <List dense>{job.responsibilities.map((item, index) => (<ListItem key={index} sx={{ py: 0 }}><ListItemIcon sx={{ minWidth: 32 }}><CheckIcon fontSize="small" color="primary" /></ListItemIcon><ListItemText primary={item} /></ListItem>))}</List>
                  <Typography variant="subtitle1" gutterBottom sx={{ fontWeight: 'bold', mt: 2 }}>Qualifications</Typography>
                  <List dense>{job.qualifications.map((item, index) => (<ListItem key={index} sx={{ py: 0 }}><ListItemIcon sx={{ minWidth: 32 }}><CheckIcon fontSize="small" color="primary" /></ListItemIcon><ListItemText primary={item} /></ListItem>))}</List>
                </Box>
              </Collapse>
            </Paper>
          ))
        ) : (
          <Paper elevation={1} sx={{ p: 4, textAlign: 'center', backgroundColor: 'grey.50' }}>
            <Typography variant="h6" color="text.secondary">
              {viewMode === 'saved' ? "You haven't saved any jobs yet." : "No jobs found."}
            </Typography>
            {viewMode === 'saved' && (
              <Typography color="text.secondary" variant="body2" sx={{ mt: 1 }}>
                Click the bookmark icon <BookmarkBorder fontSize="small" /> on a job to save it for later.
              </Typography>
            )}
          </Paper>
        )}
      </Box>
      {applyingForJob && (
          <ApplyForm 
            open={isApplyFormOpen}
            onClose={handleCloseApplyForm}
            job={applyingForJob}
            userProfile={userProfile}
          />
      )}
    </Box>
  );
};

export default FindJobs;