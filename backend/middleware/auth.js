// ===================================
// AUTHENTICATION MIDDLEWARE
// ===================================

const jwt = require('jsonwebtoken');
const { query } = require('../config/database');

/**
 * Middleware to authenticate JWT tokens
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next function
 */
const authenticateToken = async (req, res, next) => {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'Access token required',
        code: 'NO_TOKEN'
      });
    }

    // Verify JWT token
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'fallback_secret');
    
    // Check if token has required fields
    if (!decoded.userId || !decoded.email) {
      return res.status(401).json({
        success: false,
        message: 'Invalid token format',
        code: 'INVALID_TOKEN_FORMAT'
      });
    }

    // Verify user still exists and is active
    const result = await query(
      'SELECT id, name, email, role, is_active, is_verified FROM users WHERE id = $1',
      [decoded.userId]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({
        success: false,
        message: 'User not found',
        code: 'USER_NOT_FOUND'
      });
    }

    const user = result.rows[0];

    // Check if user is active
    if (!user.is_active) {
      return res.status(401).json({
        success: false,
        message: 'Account has been deactivated',
        code: 'ACCOUNT_DEACTIVATED'
      });
    }

    // Add user info to request object
    req.user = {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      isVerified: user.is_verified
    };

    // Add token info
    req.tokenInfo = {
      issuedAt: decoded.iat,
      expiresAt: decoded.exp
    };

    next();
  } catch (error) {
    console.error('Token verification error:', error);

    // Handle specific JWT errors
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({
        success: false,
        message: 'Invalid token',
        code: 'INVALID_TOKEN'
      });
    }

    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({
        success: false,
        message: 'Token expired',
        code: 'TOKEN_EXPIRED',
        expiredAt: error.expiredAt
      });
    }

    if (error.name === 'NotBeforeError') {
      return res.status(401).json({
        success: false,
        message: 'Token not active yet',
        code: 'TOKEN_NOT_ACTIVE'
      });
    }

    // Generic authentication error
    return res.status(401).json({
      success: false,
      message: 'Authentication failed',
      code: 'AUTH_FAILED'
    });
  }
};

/**
 * Middleware to require admin role
 * Must be used after authenticateToken middleware
 */
const requireAdmin = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({
      success: false,
      message: 'Authentication required',
      code: 'AUTH_REQUIRED'
    });
  }

  if (req.user.role !== 'admin') {
    return res.status(403).json({
      success: false,
      message: 'Admin access required',
      code: 'ADMIN_REQUIRED'
    });
  }

  next();
};

/**
 * Middleware to require verified user
 * Must be used after authenticateToken middleware
 */
const requireVerified = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({
      success: false,
      message: 'Authentication required',
      code: 'AUTH_REQUIRED'
    });
  }

  if (!req.user.isVerified) {
    return res.status(403).json({
      success: false,
      message: 'Email verification required',
      code: 'VERIFICATION_REQUIRED'
    });
  }

  next();
};

/**
 * Optional authentication middleware
 * Sets req.user if valid token is provided, but doesn't fail if no token
 */
const optionalAuth = async (req, res, next) => {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
      return next(); // No token provided, continue without authentication
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'fallback_secret');
    
    const result = await query(
      'SELECT id, name, email, role, is_active, is_verified FROM users WHERE id = $1 AND is_active = true',
      [decoded.userId]
    );

    if (result.rows.length > 0) {
      const user = result.rows[0];
      req.user = {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        isVerified: user.is_verified
      };
    }

    next();
  } catch (error) {
    // If token is invalid, continue without authentication
    next();
  }
};

/**
 * Middleware to check if user owns the resource
 * Expects resourceId in req.params and userId field in database
 */
const requireOwnership = (tableName, resourceIdParam = 'id', userIdField = 'user_id') => {
  return async (req, res, next) => {
    try {
      if (!req.user) {
        return res.status(401).json({
          success: false,
          message: 'Authentication required',
          code: 'AUTH_REQUIRED'
        });
      }

      const resourceId = req.params[resourceIdParam];
      
      if (!resourceId) {
        return res.status(400).json({
          success: false,
          message: 'Resource ID required',
          code: 'RESOURCE_ID_REQUIRED'
        });
      }

      // Admin users can access any resource
      if (req.user.role === 'admin') {
        return next();
      }

      const result = await query(
        `SELECT ${userIdField} FROM ${tableName} WHERE id = $1`,
        [resourceId]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({
          success: false,
          message: 'Resource not found',
          code: 'RESOURCE_NOT_FOUND'
        });
      }

      const resourceUserId = result.rows[0][userIdField];
      
      if (resourceUserId !== req.user.id) {
        return res.status(403).json({
          success: false,
          message: 'Access denied - not resource owner',
          code: 'NOT_RESOURCE_OWNER'
        });
      }

      next();
    } catch (error) {
      console.error('Ownership check error:', error);
      return res.status(500).json({
        success: false,
        message: 'Internal server error during ownership verification',
        code: 'OWNERSHIP_CHECK_ERROR'
      });
    }
  };
};

/**
 * Generate JWT token for user
 * @param {Object} user - User object with id and email
 * @param {Object} options - Additional token options
 * @returns {String} JWT token
 */
const generateToken = (user, options = {}) => {
  const payload = {
    userId: user.id,
    email: user.email,
    role: user.role || 'user'
  };

  const tokenOptions = {
    expiresIn: options.expiresIn || process.env.JWT_EXPIRES_IN || '7d',
    issuer: process.env.JWT_ISSUER || 'parkguard-api',
    audience: process.env.JWT_AUDIENCE || 'parkguard-users'
  };

  return jwt.sign(payload, process.env.JWT_SECRET || 'fallback_secret', tokenOptions);
};

/**
 * Verify and decode JWT token without middleware context
 * @param {String} token - JWT token
 * @returns {Object} Decoded token payload
 */
const verifyToken = (token) => {
  return jwt.verify(token, process.env.JWT_SECRET || 'fallback_secret');
};

module.exports = {
  authenticateToken,
  requireAdmin,
  requireVerified,
  optionalAuth,
  requireOwnership,
  generateToken,
  verifyToken
};