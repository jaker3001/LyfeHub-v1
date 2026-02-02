const db = require('./schema');
const { v4: uuidv4 } = require('uuid');

/**
 * Get all task items for a user
 */
function getAllTaskItems(userId, view = 'all', userDate = null) {
  let sql = `SELECT * FROM task_items WHERE user_id = ?`;
  const params = [userId];
  
  // Use user-provided date if available, otherwise server date
  let today;
  if (userDate && /^\d{4}-\d{2}-\d{2}$/.test(userDate)) {
    today = userDate;
  } else {
    const now = new Date();
    today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  }
  
  console.log(`[getAllTaskItems] view=${view}, userDate=${userDate}, today=${today}, userId=${userId}`);
  
  // Handle list: prefix for custom lists
  if (view.startsWith('list:')) {
    const listId = view.substring(5);
    sql += ` AND list_id = ?`;
    params.push(listId);
  } else {
    switch (view) {
      case 'my-day':
        sql += ` AND due_date = ?`;
        params.push(today);
        break;
      case 'important':
        sql += ` AND important = 1`;
        break;
      case 'scheduled':
        sql += ` AND due_date IS NOT NULL`;
        break;
      case 'recurring':
        sql += ` AND recurring IS NOT NULL AND recurring != ''`;
        break;
      case 'completed':
        sql += ` AND completed = 1`;
        break;
      case 'all':
      default:
        // No additional filter
        break;
    }
  }
  
  sql += ` ORDER BY 
    completed ASC,
    important DESC, 
    CASE WHEN due_date IS NULL THEN 1 ELSE 0 END,
    due_date ASC,
    created_at DESC`;
  
  const stmt = db.prepare(sql);
  console.log(`[getAllTaskItems] SQL: ${sql}`);
  console.log(`[getAllTaskItems] Params: ${JSON.stringify(params)}`);
  const items = stmt.all(...params);
  console.log(`[getAllTaskItems] Found ${items.length} items`);
  
  // Parse JSON fields
  return items.map(item => ({
    ...item,
    subtasks: JSON.parse(item.subtasks || '[]'),
    recurring_days: JSON.parse(item.recurring_days || '[]'),
    important: !!item.important,
    completed: !!item.completed
  }));
}

/**
 * Get a single task item by ID
 */
function getTaskItemById(id, userId) {
  const stmt = db.prepare(`SELECT * FROM task_items WHERE id = ? AND user_id = ?`);
  const item = stmt.get(id, userId);
  
  if (!item) return null;
  
  return {
    ...item,
    subtasks: JSON.parse(item.subtasks || '[]'),
    recurring_days: JSON.parse(item.recurring_days || '[]'),
    important: !!item.important,
    completed: !!item.completed
  };
}

/**
 * Create a new task item
 */
function createTaskItem(data, userId) {
  const id = uuidv4();
  const now = new Date().toISOString();
  
  const stmt = db.prepare(`
    INSERT INTO task_items (id, title, description, due_date, due_time, recurring, recurring_days, important, subtasks, user_id, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  
  stmt.run(
    id,
    data.title,
    data.description || '',
    data.due_date || null,
    data.due_time || null,
    data.recurring || null,
    JSON.stringify(data.recurring_days || []),
    data.important ? 1 : 0,
    JSON.stringify(data.subtasks || []),
    userId,
    now,
    now
  );
  
  return getTaskItemById(id, userId);
}

/**
 * Update a task item
 */
function updateTaskItem(id, data, userId) {
  const existing = getTaskItemById(id, userId);
  if (!existing) return null;
  
  const now = new Date().toISOString();
  
  const stmt = db.prepare(`
    UPDATE task_items SET
      title = ?,
      description = ?,
      due_date = ?,
      due_time = ?,
      recurring = ?,
      recurring_days = ?,
      important = ?,
      completed = ?,
      completed_at = ?,
      subtasks = ?,
      updated_at = ?
    WHERE id = ? AND user_id = ?
  `);
  
  const completedAt = data.completed && !existing.completed ? now : (data.completed ? existing.completed_at : null);
  
  stmt.run(
    data.title ?? existing.title,
    data.description ?? existing.description,
    data.due_date ?? existing.due_date,
    data.due_time ?? existing.due_time,
    data.recurring ?? existing.recurring,
    JSON.stringify(data.recurring_days ?? existing.recurring_days),
    data.important !== undefined ? (data.important ? 1 : 0) : (existing.important ? 1 : 0),
    data.completed !== undefined ? (data.completed ? 1 : 0) : (existing.completed ? 1 : 0),
    completedAt,
    JSON.stringify(data.subtasks ?? existing.subtasks),
    now,
    id,
    userId
  );
  
  return getTaskItemById(id, userId);
}

/**
 * Delete a task item
 */
function deleteTaskItem(id, userId) {
  const stmt = db.prepare(`DELETE FROM task_items WHERE id = ? AND user_id = ?`);
  const result = stmt.run(id, userId);
  return result.changes > 0;
}

/**
 * Toggle task completion
 */
function toggleTaskItemComplete(id, userId) {
  const existing = getTaskItemById(id, userId);
  if (!existing) return null;
  
  const now = new Date().toISOString();
  const newCompleted = !existing.completed;
  
  const stmt = db.prepare(`
    UPDATE task_items SET
      completed = ?,
      completed_at = ?,
      updated_at = ?
    WHERE id = ? AND user_id = ?
  `);
  
  stmt.run(
    newCompleted ? 1 : 0,
    newCompleted ? now : null,
    now,
    id,
    userId
  );
  
  return getTaskItemById(id, userId);
}

/**
 * Get task counts for sidebar
 */
function getTaskItemCounts(userId, userDate = null) {
  let today;
  if (userDate && /^\d{4}-\d{2}-\d{2}$/.test(userDate)) {
    today = userDate;
  } else {
    const now = new Date();
    today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  }
  
  const counts = {
    'my-day': 0,
    'important': 0,
    'scheduled': 0,
    'recurring': 0,
    'all': 0
  };
  
  const stmt = db.prepare(`
    SELECT 
      COUNT(*) as total,
      SUM(CASE WHEN due_date = ? THEN 1 ELSE 0 END) as my_day,
      SUM(CASE WHEN important = 1 THEN 1 ELSE 0 END) as important,
      SUM(CASE WHEN due_date IS NOT NULL THEN 1 ELSE 0 END) as scheduled,
      SUM(CASE WHEN recurring IS NOT NULL AND recurring != '' THEN 1 ELSE 0 END) as recurring
    FROM task_items 
    WHERE user_id = ? AND completed = 0
  `);
  
  const result = stmt.get(today, userId);
  
  if (result) {
    counts['my-day'] = result.my_day || 0;
    counts['important'] = result.important || 0;
    counts['scheduled'] = result.scheduled || 0;
    counts['recurring'] = result.recurring || 0;
    counts['all'] = result.total || 0;
  }
  
  return counts;
}

module.exports = {
  getAllTaskItems,
  getTaskItemById,
  createTaskItem,
  updateTaskItem,
  deleteTaskItem,
  toggleTaskItemComplete,
  getTaskItemCounts
};
