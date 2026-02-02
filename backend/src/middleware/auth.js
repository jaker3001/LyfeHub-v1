const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-in-production';
const API_KEY = process.env.KANBAN_API_KEY || 'dev-api-key';
const COOKIE_NAME = 'kanban_session';

/**
 * Authentication middleware
 * Supports two auth methods:
 * 1. JWT cookie (for UI sessions) - requires userId
 * 2. Bearer token (for API/agent access) - system-level access
 */
function authMiddleware(req, res, next) {
  // Check for Bearer token first (API access)
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.slice(7);
    if (token === API_KEY) {
      req.authMethod = 'api_key';
      req.sessionId = `api:${Date.now()}`;
      req.isSystemUser = true; // Flag for system-level access
      req.user = null; // No specific user
      return next();
    }
    return res.status(401).json({ 
      error: 'Invalid API key',
      code: 'INVALID_API_KEY'
    });
  }
  
  // Check for JWT cookie (UI session)
  const token = req.cookies[COOKIE_NAME];
  if (!token) {
    return res.status(401).json({ 
      error: 'Authentication required',
      code: 'AUTH_REQUIRED'
    });
  }
  
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.authMethod = 'jwt';
    req.sessionId = decoded.sessionId;
    req.isSystemUser = false;
    req.user = {
      id: decoded.userId,
      email: decoded.email
    };
    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      res.clearCookie(COOKIE_NAME);
      return res.status(401).json({ 
        error: 'Session expired',
        code: 'SESSION_EXPIRED'
      });
    }
    return res.status(401).json({ 
      error: 'Invalid session',
      code: 'INVALID_SESSION'
    });
  }
}

/**
 * Generate JWT token for UI sessions
 * @param {string} sessionId - Unique session identifier
 * @param {string} userId - User's database ID
 * @param {string} email - User's email
 * @param {boolean} rememberMe - If true, token lasts 30 days; otherwise 1 day
 */
function generateToken(sessionId, userId, email, rememberMe = true) {
  return jwt.sign(
    { 
      sessionId, 
      userId,
      email,
      iat: Math.floor(Date.now() / 1000) 
    },
    JWT_SECRET,
    { expiresIn: rememberMe ? '30d' : '1d' }
  );
}

/**
 * Set session cookie
 * @param {boolean} rememberMe - If true, cookie persists 30 days; otherwise session-only
 */
function setSessionCookie(res, token, rememberMe = true) {
  const cookieOptions = {
    httpOnly: true,
    secure: process.env.COOKIE_SECURE === 'true', // Only secure with HTTPS
    sameSite: 'lax',
  };
  
  // Only set maxAge if rememberMe - otherwise it's a session cookie (expires on browser close)
  if (rememberMe) {
    cookieOptions.maxAge = 30 * 24 * 60 * 60 * 1000; // 30 days
  }
  
  res.cookie(COOKIE_NAME, token, cookieOptions);
}

/**
 * Clear session cookie
 */
function clearSessionCookie(res) {
  res.clearCookie(COOKIE_NAME);
}

module.exports = {
  authMiddleware,
  generateToken,
  setSessionCookie,
  clearSessionCookie,
  COOKIE_NAME
};
