const db = require('./schema');

// ============================================
// APEX JOBS TABLE (parent — one per claim/property)
// ============================================
const apexJobsTable = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='apex_jobs'").get();
if (!apexJobsTable) {
  console.log('Creating apex_jobs table...');
  db.exec(`
    CREATE TABLE apex_jobs (
      id TEXT PRIMARY KEY,
      user_id TEXT REFERENCES users(id),
      name TEXT NOT NULL,
      status TEXT DEFAULT 'active' CHECK(status IN ('active', 'pending_insurance', 'complete', 'archived')),
      -- Client
      client_name TEXT NOT NULL,
      client_phone TEXT DEFAULT '',
      client_email TEXT DEFAULT '',
      client_street TEXT DEFAULT '',
      client_city TEXT DEFAULT '',
      client_state TEXT DEFAULT '',
      client_zip TEXT DEFAULT '',
      client_relation TEXT DEFAULT 'owner',
      -- Property
      same_as_client INTEGER DEFAULT 0,
      prop_street TEXT DEFAULT '',
      prop_city TEXT DEFAULT '',
      prop_state TEXT DEFAULT '',
      prop_zip TEXT DEFAULT '',
      prop_type TEXT DEFAULT 'residential',
      occ_name TEXT DEFAULT '',
      occ_phone TEXT DEFAULT '',
      occ_email TEXT DEFAULT '',
      access_info TEXT DEFAULT '',
      -- Insurance
      ins_carrier TEXT DEFAULT '',
      ins_claim TEXT DEFAULT '',
      ins_policy TEXT DEFAULT '',
      deductible REAL DEFAULT 0,
      adj_name TEXT DEFAULT '',
      adj_phone TEXT DEFAULT '',
      adj_email TEXT DEFAULT '',
      -- Loss
      loss_type TEXT DEFAULT '',
      loss_date TEXT DEFAULT '',
      water_category TEXT DEFAULT '',
      damage_class TEXT DEFAULT '',
      areas_affected TEXT DEFAULT '',
      hazards TEXT DEFAULT '',
      loss_description TEXT DEFAULT '',
      scope_notes TEXT DEFAULT '',
      urgent INTEGER DEFAULT 0,
      -- Assignment (JSON arrays stored as TEXT)
      mitigation_pm TEXT DEFAULT '[]',
      reconstruction_pm TEXT DEFAULT '[]',
      estimator TEXT DEFAULT '[]',
      project_coordinator TEXT DEFAULT '[]',
      mitigation_techs TEXT DEFAULT '[]',
      -- Tracking
      referral_source TEXT DEFAULT '',
      how_heard TEXT DEFAULT '',
      internal_notes TEXT DEFAULT '',
      -- Source
      source TEXT DEFAULT 'local',
      zoho_id TEXT DEFAULT '',
      -- Timestamps
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    )
  `);
  db.exec(`CREATE INDEX idx_apex_jobs_user_id ON apex_jobs(user_id)`);
  db.exec(`CREATE INDEX idx_apex_jobs_status ON apex_jobs(status)`);
  db.exec(`CREATE INDEX idx_apex_jobs_source ON apex_jobs(source)`);
  console.log('Apex jobs table created');
}

// ============================================
// APEX JOB PHASES TABLE (child — one per job type)
// ============================================
const apexJobPhasesTable = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='apex_job_phases'").get();
if (!apexJobPhasesTable) {
  console.log('Creating apex_job_phases table...');
  db.exec(`
    CREATE TABLE apex_job_phases (
      id TEXT PRIMARY KEY,
      job_id TEXT NOT NULL REFERENCES apex_jobs(id) ON DELETE CASCADE,
      job_type TEXT NOT NULL,
      job_type_code TEXT NOT NULL,
      job_number TEXT NOT NULL,
      phase_status TEXT DEFAULT 'not_started' CHECK(phase_status IN ('not_started', 'in_progress', 'pending_approval', 'approved', 'complete')),
      documents TEXT DEFAULT '[]',
      photos TEXT DEFAULT '[]',
      estimates TEXT DEFAULT '[]',
      payments TEXT DEFAULT '[]',
      labor_log TEXT DEFAULT '[]',
      materials TEXT DEFAULT '[]',
      notes TEXT DEFAULT '',
      drying_logs TEXT DEFAULT '[]',
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    )
  `);
  db.exec(`CREATE INDEX idx_apex_job_phases_job_id ON apex_job_phases(job_id)`);
  db.exec(`CREATE INDEX idx_apex_job_phases_job_type_code ON apex_job_phases(job_type_code)`);
  console.log('Apex job phases table created');
}

// ============================================
// APEX JOB NUMBER SEQUENCE TABLE
// ============================================
const apexJobNumberSeqTable = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='apex_job_number_seq'").get();
if (!apexJobNumberSeqTable) {
  console.log('Creating apex_job_number_seq table...');
  db.exec(`
    CREATE TABLE apex_job_number_seq (
      year_month TEXT PRIMARY KEY,
      next_seq INTEGER DEFAULT 1
    )
  `);
  console.log('Apex job number sequence table created');
}

console.log('Apex jobs schema initialized');

module.exports = db;
