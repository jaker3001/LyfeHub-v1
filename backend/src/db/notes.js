// ============================================
// Notes Database Operations
// ============================================

const db = require('./schema');
const { v4: uuidv4 } = require('uuid');

/**
 * Get all notes for a user
 */
function getAllNotes(userId) {
  const stmt = db.prepare(`
    SELECT * FROM notes
    WHERE user_id = ?
    ORDER BY created_at DESC
  `);
  return stmt.all(userId);
}

/**
 * Get a single note by ID
 */
function getNoteById(id, userId) {
  const stmt = db.prepare(`
    SELECT * FROM notes
    WHERE id = ? AND user_id = ?
  `);
  return stmt.get(id, userId);
}

/**
 * Create a new note
 */
function createNote(data, userId) {
  const id = uuidv4();
  const now = new Date().toISOString();

  const stmt = db.prepare(`
    INSERT INTO notes (
      id, user_id, name, type, archived, favorite,
      note_date, review_date, url, content, tags, attachments, project_id,
      created_at, updated_at
    ) VALUES (
      ?, ?, ?, ?, ?, ?,
      ?, ?, ?, ?, ?, ?, ?,
      ?, ?
    )
  `);

  stmt.run(
    id, userId,
    data.name || 'Untitled Note',
    data.type || '',
    data.archived ? 1 : 0,
    data.favorite ? 1 : 0,
    data.note_date || null,
    data.review_date || null,
    data.url || '',
    data.content || '',
    JSON.stringify(data.tags || []),
    JSON.stringify(data.attachments || []),
    data.project_id || null,
    now, now
  );

  return getNoteById(id, userId);
}

/**
 * Update a note
 */
function updateNote(id, data, userId) {
  const existing = getNoteById(id, userId);
  if (!existing) return null;

  const now = new Date().toISOString();

  const stmt = db.prepare(`
    UPDATE notes SET
      name = ?,
      type = ?,
      archived = ?,
      favorite = ?,
      note_date = ?,
      review_date = ?,
      url = ?,
      content = ?,
      tags = ?,
      attachments = ?,
      project_id = ?,
      updated_at = ?
    WHERE id = ? AND user_id = ?
  `);

  const val = (key, isJson = false) => {
    if (data[key] === undefined) {
      return isJson ? existing[key] : existing[key];
    }
    return isJson ? JSON.stringify(data[key]) : data[key];
  };

  stmt.run(
    data.name !== undefined ? data.name : existing.name,
    val('type'),
    data.archived !== undefined ? (data.archived ? 1 : 0) : existing.archived,
    data.favorite !== undefined ? (data.favorite ? 1 : 0) : existing.favorite,
    data.note_date !== undefined ? data.note_date : existing.note_date,
    data.review_date !== undefined ? data.review_date : existing.review_date,
    val('url'),
    val('content'),
    val('tags', true),
    val('attachments', true),
    data.project_id !== undefined ? data.project_id : existing.project_id,
    now,
    id, userId
  );

  return getNoteById(id, userId);
}

/**
 * Delete a note
 */
function deleteNote(id, userId) {
  const stmt = db.prepare(`
    DELETE FROM notes
    WHERE id = ? AND user_id = ?
  `);
  const result = stmt.run(id, userId);
  return result.changes > 0;
}

/**
 * Get note count for a user
 */
function getNoteCount(userId) {
  const stmt = db.prepare('SELECT COUNT(*) as count FROM notes WHERE user_id = ?');
  const result = stmt.get(userId);
  return result ? result.count : 0;
}

/**
 * Search notes by name or content
 */
function searchNotes(userId, query) {
  const searchTerm = `%${query}%`;
  const stmt = db.prepare(`
    SELECT * FROM notes
    WHERE user_id = ?
      AND (name LIKE ? OR content LIKE ? OR url LIKE ?)
    ORDER BY created_at DESC
  `);
  return stmt.all(userId, searchTerm, searchTerm, searchTerm);
}

module.exports = {
  getAllNotes,
  getNoteById,
  createNote,
  updateNote,
  deleteNote,
  getNoteCount,
  searchNotes
};
