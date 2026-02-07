const db = require('./schema');
const { v4: uuidv4 } = require('uuid');

// Job type code mapping
const TYPE_CODES = {
  mitigation: 'MIT',
  reconstruction: 'RPR',
  remodel: 'RMD',
  abatement: 'ABT',
  remediation: 'REM'
};

/**
 * Generate a unique job number: YYYYMM-SEQ-TYPE
 * e.g., 202602-001-MIT
 */
function generateJobNumber(typeCode) {
  const now = new Date();
  const yearMonth = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}`;

  // Insert if not exists, then get and increment
  db.prepare('INSERT OR IGNORE INTO apex_job_number_seq (year_month, next_seq) VALUES (?, 1)').run(yearMonth);
  const row = db.prepare('SELECT next_seq FROM apex_job_number_seq WHERE year_month = ?').get(yearMonth);
  const seq = row.next_seq;
  db.prepare('UPDATE apex_job_number_seq SET next_seq = next_seq + 1 WHERE year_month = ?').run(yearMonth);

  return `${yearMonth}-${String(seq).padStart(3, '0')}-${typeCode}`;
}

/**
 * Ensure a value is a JSON string (for assignment array fields)
 */
function ensureJsonString(val) {
  if (Array.isArray(val)) return JSON.stringify(val);
  if (typeof val === 'string') {
    // If it's already a JSON string, return as-is
    try { JSON.parse(val); return val; } catch { return JSON.stringify([val]); }
  }
  return '[]';
}

/**
 * Create a new apex job with phases (transactional)
 */
function createJob(data, userId) {
  const create = db.transaction(() => {
    const id = uuidv4();
    const name = `${data.client_name} - ${data.prop_street || data.client_street || 'New Job'}`;

    db.prepare(`
      INSERT INTO apex_jobs (
        id, user_id, name, status,
        client_name, client_phone, client_email,
        client_street, client_city, client_state, client_zip, client_relation,
        same_as_client,
        prop_street, prop_city, prop_state, prop_zip, prop_type,
        occ_name, occ_phone, occ_email, access_info,
        ins_carrier, ins_claim, ins_policy, deductible,
        adj_name, adj_phone, adj_email,
        loss_type, loss_date, water_category, damage_class,
        areas_affected, hazards, loss_description, scope_notes, urgent,
        mitigation_pm, reconstruction_pm, estimator, project_coordinator, mitigation_techs,
        referral_source, how_heard, internal_notes,
        source, zoho_id
      ) VALUES (
        ?, ?, ?, ?,
        ?, ?, ?,
        ?, ?, ?, ?, ?,
        ?,
        ?, ?, ?, ?, ?,
        ?, ?, ?, ?,
        ?, ?, ?, ?,
        ?, ?, ?,
        ?, ?, ?, ?,
        ?, ?, ?, ?, ?,
        ?, ?, ?, ?, ?,
        ?, ?, ?,
        ?, ?
      )
    `).run(
      id, userId, name, data.status || 'active',
      data.client_name, data.client_phone || '', data.client_email || '',
      data.client_street || '', data.client_city || '', data.client_state || '', data.client_zip || '', data.client_relation || 'owner',
      data.same_as_client ? 1 : 0,
      data.prop_street || '', data.prop_city || '', data.prop_state || '', data.prop_zip || '', data.prop_type || 'residential',
      data.occ_name || '', data.occ_phone || '', data.occ_email || '', data.access_info || '',
      data.ins_carrier || '', data.ins_claim || '', data.ins_policy || '', data.deductible || 0,
      data.adj_name || '', data.adj_phone || '', data.adj_email || '',
      data.loss_type || '', data.loss_date || '', data.water_category || '', data.damage_class || '',
      data.areas_affected || '', data.hazards || '', data.loss_description || '', data.scope_notes || '', data.urgent ? 1 : 0,
      ensureJsonString(data.mitigation_pm), ensureJsonString(data.reconstruction_pm),
      ensureJsonString(data.estimator), ensureJsonString(data.project_coordinator),
      ensureJsonString(data.mitigation_techs),
      data.referral_source || '', data.how_heard || '', data.internal_notes || '',
      data.source || 'local', data.zoho_id || ''
    );

    // Create phases for each selected job type
    const jobTypes = data.job_types || [];
    for (const jobType of jobTypes) {
      const typeCode = TYPE_CODES[jobType];
      if (!typeCode) continue;

      const phaseId = uuidv4();
      const jobNumber = generateJobNumber(typeCode);

      db.prepare(`
        INSERT INTO apex_job_phases (
          id, job_id, job_type, job_type_code, job_number
        ) VALUES (?, ?, ?, ?, ?)
      `).run(phaseId, id, jobType, typeCode, jobNumber);
    }

    return id;
  });

  const jobId = create();
  return getJobById(jobId, userId);
}

/**
 * Get all non-archived jobs for a user, with phases
 */
function getAllJobs(userId) {
  const jobs = db.prepare(
    'SELECT * FROM apex_jobs WHERE user_id = ? AND status != ? ORDER BY created_at DESC'
  ).all(userId, 'archived');

  const jobIds = jobs.map(j => j.id);
  if (jobIds.length === 0) return [];

  const placeholders = jobIds.map(() => '?').join(',');
  const phases = db.prepare(
    `SELECT * FROM apex_job_phases WHERE job_id IN (${placeholders}) ORDER BY created_at ASC`
  ).all(...jobIds);

  // Group phases by job_id
  const phaseMap = {};
  phases.forEach(p => {
    if (!phaseMap[p.job_id]) phaseMap[p.job_id] = [];
    phaseMap[p.job_id].push(p);
  });

  return jobs.map(j => ({ ...j, phases: phaseMap[j.id] || [] }));
}

/**
 * Get a single job by ID with phases
 */
function getJobById(id, userId) {
  const job = db.prepare(
    'SELECT * FROM apex_jobs WHERE id = ? AND user_id = ?'
  ).get(id, userId);
  if (!job) return null;

  const phases = db.prepare(
    'SELECT * FROM apex_job_phases WHERE job_id = ? ORDER BY created_at ASC'
  ).all(id);

  return { ...job, phases };
}

/**
 * Update job fields dynamically (only updates fields present in data)
 */
function updateJob(id, data, userId) {
  const existing = getJobById(id, userId);
  if (!existing) return null;

  // Fields that can be updated
  const allowedFields = [
    'name', 'status',
    'client_name', 'client_phone', 'client_email',
    'client_street', 'client_city', 'client_state', 'client_zip', 'client_relation',
    'same_as_client',
    'prop_street', 'prop_city', 'prop_state', 'prop_zip', 'prop_type',
    'occ_name', 'occ_phone', 'occ_email', 'access_info',
    'ins_carrier', 'ins_claim', 'ins_policy', 'deductible',
    'adj_name', 'adj_phone', 'adj_email',
    'loss_type', 'loss_date', 'water_category', 'damage_class',
    'areas_affected', 'hazards', 'loss_description', 'scope_notes', 'urgent',
    'mitigation_pm', 'reconstruction_pm', 'estimator', 'project_coordinator', 'mitigation_techs',
    'referral_source', 'how_heard', 'internal_notes',
    'source', 'zoho_id'
  ];

  // Assignment fields that need JSON handling
  const jsonArrayFields = ['mitigation_pm', 'reconstruction_pm', 'estimator', 'project_coordinator', 'mitigation_techs'];

  const updates = [];
  const values = [];

  for (const field of allowedFields) {
    if (data[field] !== undefined) {
      updates.push(`${field} = ?`);
      if (jsonArrayFields.includes(field)) {
        values.push(ensureJsonString(data[field]));
      } else if (field === 'same_as_client' || field === 'urgent') {
        values.push(data[field] ? 1 : 0);
      } else {
        values.push(data[field]);
      }
    }
  }

  if (updates.length === 0) return existing;

  // Always update updated_at
  updates.push("updated_at = datetime('now')");

  values.push(id, userId);

  db.prepare(
    `UPDATE apex_jobs SET ${updates.join(', ')} WHERE id = ? AND user_id = ?`
  ).run(...values);

  return getJobById(id, userId);
}

/**
 * Update a phase (verifies job ownership via JOIN)
 */
function updatePhase(phaseId, data, userId) {
  // Verify ownership
  const phase = db.prepare(`
    SELECT p.* FROM apex_job_phases p
    JOIN apex_jobs j ON p.job_id = j.id
    WHERE p.id = ? AND j.user_id = ?
  `).get(phaseId, userId);

  if (!phase) return null;

  const allowedFields = [
    'phase_status', 'documents', 'photos', 'estimates',
    'payments', 'labor_log', 'materials', 'notes', 'drying_logs'
  ];

  const jsonFields = ['documents', 'photos', 'estimates', 'payments', 'labor_log', 'materials', 'drying_logs'];

  const updates = [];
  const values = [];

  for (const field of allowedFields) {
    if (data[field] !== undefined) {
      updates.push(`${field} = ?`);
      if (jsonFields.includes(field)) {
        values.push(typeof data[field] === 'string' ? data[field] : JSON.stringify(data[field]));
      } else {
        values.push(data[field]);
      }
    }
  }

  if (updates.length === 0) return phase;

  updates.push("updated_at = datetime('now')");
  values.push(phaseId);

  db.prepare(
    `UPDATE apex_job_phases SET ${updates.join(', ')} WHERE id = ?`
  ).run(...values);

  // Return updated phase
  return db.prepare('SELECT * FROM apex_job_phases WHERE id = ?').get(phaseId);
}

/**
 * Archive a job (soft delete)
 */
function archiveJob(id, userId) {
  const result = db.prepare(
    "UPDATE apex_jobs SET status = 'archived', updated_at = datetime('now') WHERE id = ? AND user_id = ?"
  ).run(id, userId);
  return result.changes > 0;
}

/**
 * Get job count stats grouped by status
 */
function getJobStats(userId) {
  const rows = db.prepare(
    'SELECT status, COUNT(*) as count FROM apex_jobs WHERE user_id = ? GROUP BY status'
  ).all(userId);

  const stats = { active: 0, pending_insurance: 0, complete: 0, archived: 0, total: 0 };
  rows.forEach(r => {
    stats[r.status] = r.count;
    stats.total += r.count;
  });
  return stats;
}

module.exports = {
  TYPE_CODES,
  generateJobNumber,
  createJob,
  getAllJobs,
  getJobById,
  updateJob,
  updatePhase,
  archiveJob,
  getJobStats
};
