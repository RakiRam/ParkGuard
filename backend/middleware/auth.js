// ===================================
// AUTHENTICATION MIDDLEWARE
// ===================================

const jwt = require('jsonwebtoken');
const { query } = require('../config/database');
const env = require('../config/env');
const logger = require('../utils/logger');

const authenticateToken = async (req, res, next) => {
  try {
    const authHeader = req.headers['authorization'];
    
    // Strict schema requirement for Bearer token
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        message: 'Valid Bearer token required',
        code: 'NO_TOKEN'
      });
    }

    const token = authHeader.split(' ')[1];

    // Verify JWT token and STRICTLY enforce algorithm to prevent 'none' or asymmetric downgrade attacks
    const decoded = jwt.verify(token, env.JWT_SECRET, { algorithms: ['HS256'] });
    
    if (!decoded.userId || !decoded.email) {
      return res.status(401).json({
        success: false,
        message: 'Invalid token payload',
        code: 'INVALID_TOKEN_FORMAT'
      });
    }

    const result = await query(
      'SELECT id, name, email, role, is_active, is_verified FROM users WHERE id = $1',
      [decoded.userId]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({
        success: false,
        message: 'User no longer exists',
        code: 'USER_NOT_FOUND'
      });
    }

    const user = result.rows[0];

    if (!user.is_active) {
      return res.status(401).json({
        success: false,
        message: 'Account has been deactivated',
        code: 'ACCOUNT_DEACTIVATED'
      });
    }

    req.user = {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      isVerified: user.is_verified
    };

    req.tokenInfo = {
      issuedAt: decoded.iat,
      expiresAt: decoded.exp
    };

    next();
  } catch (error) {
    // We don't need a massive stack trace for standard expired tokens, warn at best.
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({ success: false, message: 'Invalid token signature', code: 'INVALID_TOKEN' });
    }
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ success: false, message: 'Token expired', code: 'TOKEN_EXPIRED', expiredAt: error.expiredAt });
    }
    if (error.name === 'NotBeforeError') {
      return res.status(401).json({ success: false, message: 'Token not active yet', code: 'TOKEN_NOT_ACTIVE' });
    }
    
    logger.error({ err: error }, 'Unexpected Token verification error');
    return res.status(401).json({ success: false, message: 'Authentication failed', code: 'AUTH_FAILED' });
  }
};

const requireAdmin = (req, res, next) => {
  if (!req.user || req.user.role !== 'admin') {
    return res.status(403).json({ success: false, message: 'Admin access required', code: 'ADMIN_REQUIRED' });
  }
  next();
};

const requireVerified = (req, res, next) => {
  if (!req.user || !req.user.isVerified) {
    return res.status(403).json({ success: false, message: 'Email verification required', code: 'VERIFICATION_REQUIRED' });
  }
  next();
};

const optionalAuth = async (req, res, next) => {
  try {
    const authHeader = req.headers['authorization'];
    if (!authHeader || !authHeader.startsWith('Bearer ')) return next();
    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, env.JWT_SECRET, { algorithms: ['HS256'] });
    const result = await query(
      'SELECT id, name, email, role, is_active, is_verified FROM users WHERE id = $1 AND is_active = true',
      [decoded.userId]
    );
    if (result.rows.length > 0) {
      req.user = { ...result.rows[0], isVerified: result.rows[0].is_verified };
    }
    next();
  } catch (error) {
    next();
  }
};

const requireOwnership = (tableName, resourceIdParam = 'id', userIdField = 'user_id') => {
  return async (req, res, next) => {
    try {
      if (!req.user) return res.status(401).json({ success: false, message: 'Auth required' });
      const resourceId = req.params[resourceIdParam];
      if (!resourceId) return res.status(400).json({ success: false, message: 'ID required' });
      if (req.user.role === 'admin') return next();

      const result = await query(`SELECT ${userIdField} FROM ${tableName} WHERE id = $1`, [resourceId]);
      if (result.rows.length === 0) return res.status(404).json({ success: false, message: 'Not found' });
      
      if (result.rows[0][userIdField] !== req.user.id) {
        return res.status(403).json({ success: false, message: 'Access denied' });
      }
      next();
    } catch (error) {
      logger.error({ err: error }, 'Ownership check error');
      res.status(500).json({ success: false, message: 'Internal error checking ownership' });
    }
  };
};

const generateToken = (user, options = {}) => {
  const payload = { userId: user.id, email: user.email, role: user.role || 'user' };
  return jwt.sign(payload, env.JWT_SECRET, {
    expiresIn: options.expiresIn || env.JWT_EXPIRES_IN,
    algorithm: 'HS256'
  });
};

const verifyToken = (token) => {
  return jwt.verify(token, env.JWT_SECRET, { algorithms: ['HS256'] });
};

module.exports = { authenticateToken, requireAdmin, requireVerified, optionalAuth, requireOwnership, generateToken, verifyToken };