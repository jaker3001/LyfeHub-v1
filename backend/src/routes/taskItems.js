const express = require('express');
const { authMiddleware } = require('../middleware/auth');
const {
  getAllTaskItems,
  getTaskItemById,
  createTaskItem,
  updateTaskItem,
  deleteTaskItem,
  toggleTaskItemComplete,
  getTaskItemCounts
} = require('../db/taskItems');

const router = express.Router();

// All routes require authentication
router.use(authMiddleware);

/**
 * GET /api/task-items
 * List all task items for current user
 * Query params: ?view=my-day|important|scheduled|recurring|all
 */
router.get('/', (req, res) => {
  try {
    const { view = 'all', today } = req.query;
    const userId = req.user.id;
    
    console.log(`[task-items] view=${view}, today=${today}, userId=${userId}`);
    
    const items = getAllTaskItems(userId, view, today);
    res.json({ items });
  } catch (err) {
    console.error('Error fetching task items:', err);
    res.status(500).json({ error: 'Failed to fetch task items' });
  }
});

/**
 * GET /api/task-items/counts
 * Get counts for sidebar badges
 */
router.get('/counts', (req, res) => {
  try {
    const { today } = req.query;
    const userId = req.user.id;
    const counts = getTaskItemCounts(userId, today);
    res.json({ counts });
  } catch (err) {
    console.error('Error fetching counts:', err);
    res.status(500).json({ error: 'Failed to fetch counts' });
  }
});

/**
 * GET /api/task-items/:id
 * Get a single task item
 */
router.get('/:id', (req, res) => {
  try {
    const userId = req.user.id;
    const item = getTaskItemById(req.params.id, userId);
    
    if (!item) {
      return res.status(404).json({ error: 'Task not found' });
    }
    
    res.json({ item });
  } catch (err) {
    console.error('Error fetching task item:', err);
    res.status(500).json({ error: 'Failed to fetch task item' });
  }
});

/**
 * POST /api/task-items
 * Create a new task item
 */
router.post('/', (req, res) => {
  try {
    const userId = req.user.id;
    const { title, description, due_date, due_time, recurring, recurring_days, important, subtasks } = req.body;
    
    if (!title || !title.trim()) {
      return res.status(400).json({ error: 'Title is required' });
    }
    
    const item = createTaskItem({
      title: title.trim(),
      description,
      due_date,
      due_time,
      recurring,
      recurring_days,
      important,
      subtasks
    }, userId);
    
    res.status(201).json({ item });
  } catch (err) {
    console.error('Error creating task item:', err);
    res.status(500).json({ error: 'Failed to create task item' });
  }
});

/**
 * PATCH /api/task-items/:id
 * Update a task item
 */
router.patch('/:id', (req, res) => {
  try {
    const userId = req.user.id;
    const item = updateTaskItem(req.params.id, req.body, userId);
    
    if (!item) {
      return res.status(404).json({ error: 'Task not found' });
    }
    
    res.json({ item });
  } catch (err) {
    console.error('Error updating task item:', err);
    res.status(500).json({ error: 'Failed to update task item' });
  }
});

/**
 * POST /api/task-items/:id/toggle
 * Toggle task completion
 */
router.post('/:id/toggle', (req, res) => {
  try {
    const userId = req.user.id;
    const item = toggleTaskItemComplete(req.params.id, userId);
    
    if (!item) {
      return res.status(404).json({ error: 'Task not found' });
    }
    
    res.json({ item });
  } catch (err) {
    console.error('Error toggling task:', err);
    res.status(500).json({ error: 'Failed to toggle task' });
  }
});

/**
 * DELETE /api/task-items/:id
 * Delete a task item
 */
router.delete('/:id', (req, res) => {
  try {
    const userId = req.user.id;
    const deleted = deleteTaskItem(req.params.id, userId);
    
    if (!deleted) {
      return res.status(404).json({ error: 'Task not found' });
    }
    
    res.json({ success: true });
  } catch (err) {
    console.error('Error deleting task item:', err);
    res.status(500).json({ error: 'Failed to delete task item' });
  }
});

module.exports = router;
