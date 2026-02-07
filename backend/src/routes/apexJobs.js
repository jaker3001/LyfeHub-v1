const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');
const { authMiddleware } = require('../middleware/auth');
const apexJobsDb = require('../db/apexJobs');

// Helper: read Zoho JSON file
function readZohoJobs() {
  try {
    const dataPath = '/data/apex-jobs.json';
    if (!fs.existsSync(dataPath)) return { projects: [], stats: {}, syncedAt: null };
    const data = JSON.parse(fs.readFileSync(dataPath, 'utf8'));
    // Add source marker to Zoho jobs
    if (data.projects) {
      data.projects = data.projects.map(p => ({ ...p, source: 'zoho' }));
    }
    return data;
  } catch (err) {
    console.error('Error reading Zoho jobs:', err);
    return { projects: [], stats: {}, syncedAt: null };
  }
}

// Helper: format DB job to match frontend shape
function formatDbJob(job) {
  const address = [job.client_street, job.client_city, job.client_state, job.client_zip].filter(Boolean).join(', ');

  // Parse PM field for owner display
  let ownerName = '';
  try {
    const pmArr = JSON.parse(job.mitigation_pm || '[]');
    ownerName = Array.isArray(pmArr) ? pmArr[0] || '' : '';
  } catch { ownerName = job.mitigation_pm || ''; }

  return {
    id: job.id,
    name: job.name,
    client: {
      name: job.client_name,
      phone: job.client_phone,
      email: job.client_email,
      address: address
    },
    clientName: job.client_name,
    lossType: job.loss_type,
    status: job.status,
    owner: { name: ownerName },
    jobNumbers: {
      mitigation: (job.phases || []).find(p => p.job_type_code === 'MIT')?.job_number || '',
      repair: (job.phases || []).find(p => p.job_type_code === 'RPR')?.job_number || ''
    },
    insurance: {
      carrier: job.ins_carrier,
      claimNumber: job.ins_claim,
      adjusterName: job.adj_name,
      adjusterEmail: job.adj_email
    },
    taskSummary: { total: 0, completed: 0 },
    tasks: [],
    phases: job.phases || [],
    source: 'local',
    createdAt: job.created_at
  };
}

// GET / - List all jobs (merge DB + Zoho)
router.get('/', authMiddleware, (req, res) => {
  try {
    const zohoData = readZohoJobs();
    const dbJobs = req.user ? apexJobsDb.getAllJobs(req.user.id) : [];
    const formattedDbJobs = dbJobs.map(formatDbJob);

    const merged = [...formattedDbJobs, ...(zohoData.projects || [])];
    const stats = req.user ? apexJobsDb.getJobStats(req.user.id) : {};

    res.json({
      projects: merged,
      stats: stats,
      syncedAt: zohoData.syncedAt || new Date().toISOString()
    });
  } catch (err) {
    console.error('Error loading apex jobs:', err);
    res.status(500).json({ error: 'Failed to load jobs' });
  }
});

// POST / - Create job
router.post('/', authMiddleware, (req, res) => {
  try {
    if (!req.user) return res.status(401).json({ error: 'User authentication required' });
    const job = apexJobsDb.createJob(req.body, req.user.id);
    res.status(201).json(job);
  } catch (err) {
    console.error('Error creating job:', err);
    res.status(500).json({ error: 'Failed to create job: ' + err.message });
  }
});

// GET /:id - Get single job
router.get('/:id', authMiddleware, (req, res) => {
  try {
    if (!req.user) return res.status(401).json({ error: 'User authentication required' });
    const job = apexJobsDb.getJobById(req.params.id, req.user.id);
    if (!job) return res.status(404).json({ error: 'Job not found' });
    res.json(job);
  } catch (err) {
    console.error('Error getting job:', err);
    res.status(500).json({ error: 'Failed to get job' });
  }
});

// PATCH /:id - Update job
router.patch('/:id', authMiddleware, (req, res) => {
  try {
    if (!req.user) return res.status(401).json({ error: 'User authentication required' });
    const job = apexJobsDb.updateJob(req.params.id, req.body, req.user.id);
    if (!job) return res.status(404).json({ error: 'Job not found' });
    res.json(job);
  } catch (err) {
    console.error('Error updating job:', err);
    res.status(500).json({ error: 'Failed to update job' });
  }
});

// PATCH /:id/status - Update job status
router.patch('/:id/status', authMiddleware, (req, res) => {
  try {
    if (!req.user) return res.status(401).json({ error: 'User authentication required' });
    const job = apexJobsDb.updateJob(req.params.id, { status: req.body.status }, req.user.id);
    if (!job) return res.status(404).json({ error: 'Job not found' });
    res.json(job);
  } catch (err) {
    console.error('Error updating job status:', err);
    res.status(500).json({ error: 'Failed to update status' });
  }
});

// DELETE /:id - Archive job (soft delete)
router.delete('/:id', authMiddleware, (req, res) => {
  try {
    if (!req.user) return res.status(401).json({ error: 'User authentication required' });
    const success = apexJobsDb.archiveJob(req.params.id, req.user.id);
    if (!success) return res.status(404).json({ error: 'Job not found' });
    res.json({ success: true });
  } catch (err) {
    console.error('Error archiving job:', err);
    res.status(500).json({ error: 'Failed to archive job' });
  }
});

// PATCH /:id/phases/:phaseId - Update phase
router.patch('/:id/phases/:phaseId', authMiddleware, (req, res) => {
  try {
    if (!req.user) return res.status(401).json({ error: 'User authentication required' });
    const phase = apexJobsDb.updatePhase(req.params.phaseId, req.body, req.user.id);
    if (!phase) return res.status(404).json({ error: 'Phase not found' });
    res.json(phase);
  } catch (err) {
    console.error('Error updating phase:', err);
    res.status(500).json({ error: 'Failed to update phase' });
  }
});

// POST /:id/phases - Add phase to existing job
router.post('/:id/phases', authMiddleware, (req, res) => {
  try {
    if (!req.user) return res.status(401).json({ error: 'User authentication required' });
    // Future: add phase to existing job
    res.status(501).json({ error: 'Not yet implemented' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to add phase' });
  }
});

module.exports = router;
