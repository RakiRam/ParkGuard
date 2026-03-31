// ===================================
// ERROR HANDLER MIDDLEWARE
// ===================================

const logger = require('../utils/logger');

class APIError extends Error {
  constructor(message, statusCode = 500, errorCode = null, details = null) {
    super(message);
    this.statusCode = statusCode;
    this.errorCode = errorCode;
    this.details = details;
    this.isOperational = true;
    
    Error.captureStackTrace(this, this.constructor);
  }
}

const logError = (err, req = null) => {
  const errorLog = {
    message: err.message,
    statusCode: err.statusCode,
    errorCode: err.errorCode,
    url: req ? req.originalUrl : null,
    method: req ? req.method : null,
    userId: req && req.user ? req.user.id : null
  };

  if (err.statusCode >= 500) {
    logger.error({ err, ...errorLog }, '🚨 Unhandled Server Error Captured');
  } else {
    logger.warn({ ...errorLog }, '⚠️ Expected Platform Error Captured');
  }
};

const errorHandler = (err, req, res, next) => {
  logError(err, req);

  let statusCode = err.statusCode || 500;
  let message = err.message || 'Internal server error';
  let errorCode = err.errorCode || 'INTERNAL_ERROR';
  let details = err.details || null;

  // Handle DB Errors natively without crashing Express
  if (err.code === '23505') { 
    statusCode = 409;
    message = 'Resource already exists';
    errorCode = 'DUPLICATE_RESOURCE';
    if (err.detail && err.detail.includes('Key (')) {
      const field = err.detail.match(/Key \(([^)]+)\)/)?.[1];
      if (field) {
         details = { field, constraint: 'unique' };
         message = `${field.replace('_', ' ')} already exists`;
      }
    }
  } else if (err.code === '23503') { 
    statusCode = 400; message = 'Referenced resource not found'; errorCode = 'INVALID_REFERENCE';
  } else if (err.code === '23502') { 
    statusCode = 400; message = `${err.column || 'Required'} field missing`; errorCode = 'MISSING_REQUIRED_FIELD';
  }

  // Handle generic JWT
  if (err.name === 'JsonWebTokenError') { statusCode = 401; message = 'Invalid authentication token'; errorCode = 'INVALID_TOKEN'; }
  else if (err.name === 'TokenExpiredError') { statusCode = 401; message = 'Session Expired'; errorCode = 'TOKEN_EXPIRED'; }

  // Rate Limiting
  if (err.type === 'rate_limit_exceeded') { statusCode = 429; message = 'Rate limit exceeded.'; errorCode = 'RATE_LIMIT_EXCEEDED'; }

  // JSON Body Syntax Error from strictly typed 1mb payload limit
  if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
    statusCode = 400; message = 'Syntax Error in JSON body'; errorCode = 'INVALID_JSON';
  }

  res.status(statusCode).json({
    success: false,
    message,
    code: errorCode,
    details,
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  });
};

const notFoundHandler = (req, res) => {
  res.status(404).json({ success: false, message: 'API endpoint not found', path: req.originalUrl });
};

const asyncHandler = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

const createError = (message, statusCode = 500, errorCode = null, details = null) => new APIError(message, statusCode, errorCode, details);

module.exports = { APIError, errorHandler, notFoundHandler, asyncHandler, createError, logError };