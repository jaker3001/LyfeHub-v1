const express = require('express');
const { authMiddleware } = require('../middleware/auth');
const {
  getAllTasks,
  getTaskById,
  createTask,
  updateTask,
  deleteTask,
  pickTask,
  completeTask,
  addLogEntry,
  submitReview,
  submitPlanReview
} = require('../db/queries');

const router = express.Router();

// All routes require authentication
router.use(authMiddleware);

/**
 * Get userId from request (null for system users = access all)
 */
function getUserId(req) {
  return req.isSystemUser ? null : req.user?.id;
}

/**
 * GET /api/tasks
 * List all tasks for current user, optionally filtered by status
 * Query params: ?status=ready
 */
router.get('/', (req, res) => {
  try {
    const { status } = req.query;
    const userId = getUserId(req);
    
    // Validate status if provided
    const validStatuses = ['planned', 'ready', 'in_progress', 'blocked', 'review', 'done'];
    if (status && !validStatuses.includes(status)) {
      return res.status(400).json({
        error: `Invalid status. Must be one of: ${validStatuses.join(', ')}`,
        code: 'INVALID_STATUS'
      });
    }
    
    const tasks = getAllTasks(userId, status);
    res.json({ tasks });
  } catch (err) {
    console.error('Error fetching tasks:', err);
    res.status(500).json({ 
      error: 'Failed to fetch tasks',
      code: 'INTERNAL_ERROR'
    });
  }
});

/**
 * POST /api/tasks
 * Create a new task for current user
 */
router.post('/', (req, res) => {
  try {
    const { title, description, acceptance_criteria, status, priority, context_links, notes } = req.body;
    const userId = getUserId(req);
    
    if (!title || typeof title !== 'string' || title.trim() === '') {
      return res.status(400).json({
        error: 'Title is required',
        code: 'TITLE_REQUIRED'
      });
    }
    
    // Validate status if provided
    const validStatuses = ['planned', 'ready', 'in_progress', 'blocked', 'review', 'done'];
    if (status && !validStatuses.includes(status)) {
      return res.status(400).json({
        error: `Invalid status. Must be one of: ${validStatuses.join(', ')}`,
        code: 'INVALID_STATUS'
      });
    }
    
    // Validate priority if provided
    if (priority !== undefined && (typeof priority !== 'number' || priority < 1 || priority > 5)) {
      return res.status(400).json({
        error: 'Priority must be a number between 1 and 5',
        code: 'INVALID_PRIORITY'
      });
    }
    
    // Validate arrays
    if (acceptance_criteria && !Array.isArray(acceptance_criteria)) {
      return res.status(400).json({
        error: 'acceptance_criteria must be an array',
        code: 'INVALID_ACCEPTANCE_CRITERIA'
      });
    }
    
    if (context_links && !Array.isArray(context_links)) {
      return res.status(400).json({
        error: 'context_links must be an array',
        code: 'INVALID_CONTEXT_LINKS'
      });
    }
    
    const task = createTask({
      title: title.trim(),
      description,
      acceptance_criteria,
      status,
      priority,
      context_links,
      notes
    }, userId);
    
    res.status(201).json({ task });
  } catch (err) {
    console.error('Error creating task:', err);
    res.status(500).json({ 
      error: 'Failed to create task',
      code: 'INTERNAL_ERROR'
    });
  }
});

/**
 * GET /api/tasks/:id
 * Get a single task by ID (must belong to current user)
 */
router.get('/:id', (req, res) => {
  try {
    const userId = getUserId(req);
    const task = getTaskById(req.params.id, userId);
    
    if (!task) {
      return res.status(404).json({
        error: 'Task not found',
        code: 'TASK_NOT_FOUND'
      });
    }
    
    res.json({ task });
  } catch (err) {
    console.error('Error fetching task:', err);
    res.status(500).json({ 
      error: 'Failed to fetch task',
      code: 'INTERNAL_ERROR'
    });
  }
});

/**
 * PATCH /api/tasks/:id
 * Update a task (must belong to current user)
 * Body can include status_reason for logging status changes
 */
router.patch('/:id', (req, res) => {
  try {
    const { title, description, acceptance_criteria, status, priority, context_links, notes, session_id, status_reason, log_entry } = req.body;
    const userId = getUserId(req);
    
    // Validate title if provided
    if (title !== undefined && (typeof title !== 'string' || title.trim() === '')) {
      return res.status(400).json({
        error: 'Title cannot be empty',
        code: 'INVALID_TITLE'
      });
    }
    
    // Validate status if provided
    const validStatuses = ['planned', 'ready', 'in_progress', 'blocked', 'review', 'done'];
    if (status && !validStatuses.includes(status)) {
      return res.status(400).json({
        error: `Invalid status. Must be one of: ${validStatuses.join(', ')}`,
        code: 'INVALID_STATUS'
      });
    }
    
    // Validate priority if provided
    if (priority !== undefined && (typeof priority !== 'number' || priority < 1 || priority > 5)) {
      return res.status(400).json({
        error: 'Priority must be a number between 1 and 5',
        code: 'INVALID_PRIORITY'
      });
    }
    
    const task = updateTask(req.params.id, {
      title: title?.trim(),
      description,
      acceptance_criteria,
      status,
      priority,
      context_links,
      notes,
      session_id,
      status_reason,
      log_entry
    }, userId);
    
    if (!task) {
      return res.status(404).json({
        error: 'Task not found',
        code: 'TASK_NOT_FOUND'
      });
    }
    
    res.json({ task });
  } catch (err) {
    console.error('Error updating task:', err);
    res.status(500).json({ 
      error: 'Failed to update task',
      code: 'INTERNAL_ERROR'
    });
  }
});

/**
 * POST /api/tasks/:id/log
 * Add an entry to the task's activity log
 * Body: { type: "note", message: "Did something", details: {} }
 */
router.post('/:id/log', (req, res) => {
  try {
    const { type, message, details } = req.body;
    const userId = getUserId(req);
    
    if (!message || typeof message !== 'string') {
      return res.status(400).json({
        error: 'Message is required',
        code: 'MESSAGE_REQUIRED'
      });
    }
    
    const task = addLogEntry(req.params.id, type || 'note', message, details || {}, userId);
    
    if (!task) {
      return res.status(404).json({
        error: 'Task not found',
        code: 'TASK_NOT_FOUND'
      });
    }
    
    res.json({ task });
  } catch (err) {
    console.error('Error adding log entry:', err);
    res.status(500).json({ 
      error: 'Failed to add log entry',
      code: 'INTERNAL_ERROR'
    });
  }
});

/**
 * DELETE /api/tasks/:id
 * Delete a task (must belong to current user)
 */
router.delete('/:id', (req, res) => {
  try {
    const userId = getUserId(req);
    const deleted = deleteTask(req.params.id, userId);
    
    if (!deleted) {
      return res.status(404).json({
        error: 'Task not found',
        code: 'TASK_NOT_FOUND'
      });
    }
    
    res.json({ 
      success: true,
      message: 'Task deleted'
    });
  } catch (err) {
    console.error('Error deleting task:', err);
    res.status(500).json({ 
      error: 'Failed to delete task',
      code: 'INTERNAL_ERROR'
    });
  }
});

/**
 * POST /api/tasks/:id/pick
 * Claim a task for work (sets status to in_progress)
 * Body: { session_id: "optional session identifier" }
 */
router.post('/:id/pick', (req, res) => {
  try {
    const sessionId = req.body.session_id || req.sessionId;
    const userId = getUserId(req);
    const result = pickTask(req.params.id, sessionId, userId);
    
    if (result.error) {
      return res.status(result.status).json({
        error: result.error,
        code: result.status === 404 ? 'TASK_NOT_FOUND' : 'INVALID_STATE'
      });
    }
    
    res.json({ task: result.task });
  } catch (err) {
    console.error('Error picking task:', err);
    res.status(500).json({ 
      error: 'Failed to pick task',
      code: 'INTERNAL_ERROR'
    });
  }
});

/**
 * POST /api/tasks/:id/complete
 * Mark a task as complete (sets status to review)
 * Body: { notes: "optional completion notes" }
 */
router.post('/:id/complete', (req, res) => {
  try {
    const { notes } = req.body;
    const userId = getUserId(req);
    const result = completeTask(req.params.id, notes, userId);
    
    if (result.error) {
      return res.status(result.status).json({
        error: result.error,
        code: result.status === 404 ? 'TASK_NOT_FOUND' : 'INVALID_STATE'
      });
    }
    
    res.json({ task: result.task });
  } catch (err) {
    console.error('Error completing task:', err);
    res.status(500).json({ 
      error: 'Failed to complete task',
      code: 'INTERNAL_ERROR'
    });
  }
});

/**
 * POST /api/tasks/:id/review
 * Submit a review with criteria feedback
 * Body: { criteria: [{ index: 0, status: "approved"|"needs_work", comment: "..." }] }
 */
router.post('/:id/review', (req, res) => {
  try {
    const { criteria, generalComment } = req.body;
    const userId = getUserId(req);
    
    if (!criteria || !Array.isArray(criteria)) {
      return res.status(400).json({
        error: 'Criteria array is required',
        code: 'CRITERIA_REQUIRED'
      });
    }
    
    // Validate criteria entries
    for (const c of criteria) {
      if (typeof c.index !== 'number' || !['approved', 'needs_work'].includes(c.status)) {
        return res.status(400).json({
          error: 'Each criterion must have index (number) and status (approved|needs_work)',
          code: 'INVALID_CRITERIA'
        });
      }
    }
    
    const result = submitReview(req.params.id, { criteria, generalComment }, userId);
    
    if (result.error) {
      return res.status(result.status).json({
        error: result.error,
        code: result.status === 404 ? 'TASK_NOT_FOUND' : 'INVALID_STATE'
      });
    }
    
    res.json({
      task: result.task,
      allApproved: result.allApproved,
      approved: result.approved,
      needsWork: result.needsWork
    });
  } catch (err) {
    console.error('Error submitting review:', err);
    res.status(500).json({ 
      error: 'Failed to submit review',
      code: 'INTERNAL_ERROR'
    });
  }
});

/**
 * POST /api/tasks/:id/plan-review
 * Submit a plan review with criteria feedback (for tasks in 'planned' status)
 * Body: { criteria: [{ index: 0, status: "approved"|"needs_work", comment: "..." }] }
 */
router.post('/:id/plan-review', (req, res) => {
  try {
    const { criteria, generalComment } = req.body;
    const userId = getUserId(req);
    
    if (!criteria || !Array.isArray(criteria)) {
      return res.status(400).json({
        error: 'Criteria array is required',
        code: 'CRITERIA_REQUIRED'
      });
    }
    
    // Validate criteria entries
    for (const c of criteria) {
      if (typeof c.index !== 'number' || !['approved', 'needs_work'].includes(c.status)) {
        return res.status(400).json({
          error: 'Each criterion must have index (number) and status (approved|needs_work)',
          code: 'INVALID_CRITERIA'
        });
      }
    }
    
    const result = submitPlanReview(req.params.id, { criteria, generalComment }, userId);
    
    if (result.error) {
      return res.status(result.status).json({
        error: result.error,
        code: result.status === 404 ? 'TASK_NOT_FOUND' : 'INVALID_STATE'
      });
    }
    
    res.json({
      task: result.task,
      allApproved: result.allApproved,
      approved: result.approved,
      needsWork: result.needsWork
    });
  } catch (err) {
    console.error('Error submitting plan review:', err);
    res.status(500).json({ 
      error: 'Failed to submit plan review',
      code: 'INTERNAL_ERROR'
    });
  }
});

module.exports = router;
