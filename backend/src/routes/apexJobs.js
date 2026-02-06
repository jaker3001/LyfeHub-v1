const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');

router.get('/', (req, res) => {
  try {
    const dataPath = '/data/apex-jobs.json';
    if (!fs.existsSync(dataPath)) {
      return res.json([]);
    }
    const data = JSON.parse(fs.readFileSync(dataPath, 'utf8'));
    res.json(data);
  } catch (err) {
    console.error('Error reading apex jobs:', err);
    res.status(500).json({ error: 'Failed to load jobs' });
  }
});

module.exports = router;
