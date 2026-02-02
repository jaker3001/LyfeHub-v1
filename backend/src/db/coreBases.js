// ============================================
// Core Bases - System-level bases that map to existing tables
// ============================================

const db = require('./schema');
const taskItemsDb = require('./taskItems');

// Core base definitions - these are defined in code, not in the database
const CORE_BASES = {
  'core-tasks': {
    id: 'core-tasks',
    name: 'Tasks',
    description: 'Personal tasks synced with the Tasks dashboard',
    icon: '✅',
    is_core: true,
    table_name: 'task_items',
    // Schema for the Tasks core base - maps to task_items columns
    properties: [
      { id: 'title', name: 'Title', type: 'text', position: 0, width: 250 },
      { id: 'description', name: 'Description', type: 'text', position: 1, width: 300 },
      { id: 'due_date', name: 'Due Date', type: 'date', position: 2, width: 120 },
      { id: 'due_time', name: 'Due Time', type: 'time', position: 3, width: 100 },
      { id: 'important', name: 'Important', type: 'checkbox', position: 4, width: 100 },
      { id: 'completed', name: 'Completed', type: 'checkbox', position: 5, width: 100 },
      { id: 'recurring', name: 'Recurring', type: 'select', position: 6, width: 120, options: [
        { value: 'daily', label: 'Daily' },
        { value: 'weekdays', label: 'Weekdays' },
        { value: 'weekly', label: 'Weekly' },
        { value: 'biweekly', label: 'Biweekly' },
        { value: 'monthly', label: 'Monthly' },
        { value: 'yearly', label: 'Yearly' }
      ]}
    ]
  }
};

/**
 * Get all core bases available to a user
 */
function getAllCoreBases(userId) {
  return Object.values(CORE_BASES).map(base => ({
    ...base,
    user_id: userId,
    record_count: getRecordCount(base.id, userId),
    column_count: base.properties.length
  }));
}

/**
 * Get a single core base by ID
 */
function getCoreBase(baseId) {
  return CORE_BASES[baseId] || null;
}

/**
 * Get record count for a core base
 */
function getRecordCount(baseId, userId) {
  if (baseId === 'core-tasks') {
    const stmt = db.prepare('SELECT COUNT(*) as count FROM task_items WHERE user_id = ?');
    const result = stmt.get(userId);
    return result ? result.count : 0;
  }
  return 0;
}

/**
 * Get records for a core base
 */
function getCoreBaseRecords(baseId, userId) {
  if (baseId === 'core-tasks') {
    const stmt = db.prepare(`
      SELECT id, title, description, due_date, due_time, recurring, recurring_days,
             important, completed, completed_at, subtasks, user_id, created_at, updated_at
      FROM task_items 
      WHERE user_id = ? 
      ORDER BY created_at DESC
    `);
    const rows = stmt.all(userId);
    
    // Convert to base record format
    return rows.map((row, index) => ({
      id: row.id,
      base_id: baseId,
      global_id: index + 1,  // Simple sequential ID for display
      position: index,
      created_at: row.created_at,
      updated_at: row.updated_at,
      values: {
        title: row.title || '',
        description: row.description || '',
        due_date: row.due_date || '',
        due_time: row.due_time || '',
        important: !!row.important,
        completed: !!row.completed,
        recurring: row.recurring || ''
      }
    }));
  }
  return [];
}

/**
 * Create a record in a core base
 */
function createCoreBaseRecord(baseId, values, userId) {
  if (baseId === 'core-tasks') {
    const task = taskItemsDb.createTaskItem({
      title: values.title || 'Untitled Task',
      description: values.description || '',
      due_date: values.due_date || null,
      due_time: values.due_time || null,
      recurring: values.recurring || null,
      important: values.important || false
    }, userId);
    
    return {
      id: task.id,
      base_id: baseId,
      global_id: 0,
      position: 0,
      created_at: task.created_at,
      updated_at: task.updated_at,
      values: {
        title: task.title,
        description: task.description,
        due_date: task.due_date || '',
        due_time: task.due_time || '',
        important: task.important,
        completed: task.completed,
        recurring: task.recurring || ''
      }
    };
  }
  return null;
}

/**
 * Update a record in a core base
 */
function updateCoreBaseRecord(baseId, recordId, values, userId) {
  if (baseId === 'core-tasks') {
    const task = taskItemsDb.updateTaskItem(recordId, {
      title: values.title,
      description: values.description,
      due_date: values.due_date || null,
      due_time: values.due_time || null,
      recurring: values.recurring || null,
      important: values.important,
      completed: values.completed
    }, userId);
    
    if (!task) return null;
    
    return {
      id: task.id,
      base_id: baseId,
      global_id: 0,
      position: 0,
      created_at: task.created_at,
      updated_at: task.updated_at,
      values: {
        title: task.title,
        description: task.description,
        due_date: task.due_date || '',
        due_time: task.due_time || '',
        important: task.important,
        completed: task.completed,
        recurring: task.recurring || ''
      }
    };
  }
  return null;
}

/**
 * Delete a record from a core base
 */
function deleteCoreBaseRecord(baseId, recordId, userId) {
  if (baseId === 'core-tasks') {
    return taskItemsDb.deleteTaskItem(recordId, userId);
  }
  return false;
}

/**
 * Check if a base ID is a core base
 */
function isCoreBase(baseId) {
  return baseId && baseId.startsWith('core-');
}

module.exports = {
  CORE_BASES,
  getAllCoreBases,
  getCoreBase,
  getCoreBaseRecords,
  createCoreBaseRecord,
  updateCoreBaseRecord,
  deleteCoreBaseRecord,
  isCoreBase
};
