// ===================================
// ERROR HANDLER MIDDLEWARE
// ===================================

const fs = require('fs');
const path = require('path');

/**
 * Custom error class for API errors
 */
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

/**
 * Log error to file and console
 */
const logError = (err, req = null) => {
  const timestamp = new Date().toISOString();
  const errorLog = {
    timestamp,
    message: err.message,
    stack: err.stack,
    statusCode: err.statusCode,
    errorCode: err.errorCode,
    url: req ? req.originalUrl : null,
    method: req ? req.method : null,
    ip: req ? req.ip : null,
    userAgent: req ? req.get('User-Agent') : null,
    userId: req && req.user ? req.user.id : null
  };

  // Console log
  console.error('🚨 Error occurred:', {
    timestamp,
    message: err.message,
    statusCode: err.statusCode,
    url: errorLog.url,
    method: errorLog.method
  });

  // File log in production
  if (process.env.NODE_ENV === 'production') {
    const logDir = path.join(__dirname, '..', 'logs');
    if (!fs.existsSync(logDir)) {
      fs.mkdirSync(logDir, { recursive: true });
    }

    const logFile = path.join(logDir, `error-${new Date().toISOString().split('T')[0]}.log`);
    const logEntry = JSON.stringify(errorLog) + '\n';
    
    fs.appendFileSync(logFile, logEntry);
  }
};

/**
 * Main error handling middleware
 */
const errorHandler = (err, req, res, next) => {
  // Log the error
  logError(err, req);

  // Default error values
  let statusCode = err.statusCode || 500;
  let message = err.message || 'Internal server error';
  let errorCode = err.errorCode || 'INTERNAL_ERROR';
  let details = err.details || null;

  // Handle specific error types

  // JWT errors
  if (err.name === 'JsonWebTokenError') {
    statusCode = 401;
    message = 'Invalid authentication token';
    errorCode = 'INVALID_TOKEN';
  } else if (err.name === 'TokenExpiredError') {
    statusCode = 401;
    message = 'Authentication token expired';
    errorCode = 'TOKEN_EXPIRED';
  } else if (err.name === 'NotBeforeError') {
    statusCode = 401;
    message = 'Authentication token not active';
    errorCode = 'TOKEN_NOT_ACTIVE';
  }

  // Database errors
  else if (err.code === '23505') { // Unique violation
    statusCode = 409;
    message = 'Resource already exists';
    errorCode = 'DUPLICATE_RESOURCE';
    
    // Extract field name from error detail if available
    if (err.detail && err.detail.includes('Key (')) {
      const field = err.detail.match(/Key \(([^)]+)\)/)?.[1];
      if (field) {
        details = { field, constraint: 'unique' };
        message = `${field.replace('_', ' ')} already exists`;
      }
    }
  } else if (err.code === '23503') { // Foreign key violation
    statusCode = 400;
    message = 'Referenced resource not found';
    errorCode = 'INVALID_REFERENCE';
  } else if (err.code === '23502') { // Not null violation
    statusCode = 400;
    message = 'Required field missing';
    errorCode = 'MISSING_REQUIRED_FIELD';
    
    if (err.column) {
      details = { field: err.column };
      message = `${err.column.replace('_', ' ')} is required`;
    }
  } else if (err.code === '23514') { // Check constraint violation
    statusCode = 400;
    message = 'Invalid field value';
    errorCode = 'INVALID_FIELD_VALUE';
  }

  // Validation errors (from express-validator or custom validation)
  else if (err.name === 'ValidationError' || err.type === 'validation') {
    statusCode = 400;
    errorCode = 'VALIDATION_ERROR';
    
    if (err.errors && Array.isArray(err.errors)) {
      details = err.errors;
      message = 'Validation failed';
    }
  }

  // Multer file upload errors
  else if (err.code === 'LIMIT_FILE_SIZE') {
    statusCode = 413;
    message = 'File too large';
    errorCode = 'FILE_TOO_LARGE';
  } else if (err.code === 'LIMIT_FILE_COUNT') {
    statusCode = 413;
    message = 'Too many files';
    errorCode = 'TOO_MANY_FILES';
  } else if (err.code === 'LIMIT_UNEXPECTED_FILE') {
    statusCode = 400;
    message = 'Unexpected file field';
    errorCode = 'UNEXPECTED_FILE';
  }

  // Stripe errors
  else if (err.type === 'StripeCardError') {
    statusCode = 400;
    message = 'Payment failed: ' + err.message;
    errorCode = 'PAYMENT_FAILED';
  } else if (err.type === 'StripeInvalidRequestError') {
    statusCode = 400;
    message = 'Invalid payment request';
    errorCode = 'INVALID_PAYMENT_REQUEST';
  }

  // Twilio errors
  else if (err.code && err.code >= 20000 && err.code < 30000) {
    statusCode = 400;
    message = 'Communication service error';
    errorCode = 'TWILIO_ERROR';
    details = { twilioCode: err.code, twilioMessage: err.message };
  }

  // Rate limiting errors
  else if (err.type === 'rate_limit_exceeded') {
    statusCode = 429;
    message = 'Rate limit exceeded. Please try again later.';
    errorCode = 'RATE_LIMIT_EXCEEDED';
  }

  // Syntax errors (malformed JSON, etc.)
  else if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
    statusCode = 400;
    message = 'Invalid JSON in request body';
    errorCode = 'INVALID_JSON';
  }

  // Network/timeout errors
  else if (err.code === 'ETIMEDOUT' || err.code === 'ECONNRESET') {
    statusCode = 503;
    message = 'Service temporarily unavailable';
    errorCode = 'SERVICE_UNAVAILABLE';
  }

  // File system errors
  else if (err.code === 'ENOENT') {
    statusCode = 404;
    message = 'File not found';
    errorCode = 'FILE_NOT_FOUND';
  } else if (err.code === 'EACCES') {
    statusCode = 403;
    message = 'File access denied';
    errorCode = 'FILE_ACCESS_DENIED';
  }

  // Build error response
  const errorResponse = {
    success: false,
    message,
    code: errorCode,
    timestamp: new Date().toISOString()
  };

  // Add details if available
  if (details) {
    errorResponse.details = details;
  }

  // Add stack trace in development
  if (process.env.NODE_ENV === 'development') {
    errorResponse.stack = err.stack;
    errorResponse.originalError = {
      name: err.name,
      code: err.code,
      statusCode: err.statusCode
    };
  }

  // Add request ID if available
  if (req.requestId) {
    errorResponse.requestId = req.requestId;
  }

  // Send error response
  res.status(statusCode).json(errorResponse);
};

/**
 * 404 Not Found handler
 */
const notFoundHandler = (req, res) => {
  res.status(404).json({
    success: false,
    message: 'API endpoint not found',
    code: 'ENDPOINT_NOT_FOUND',
    path: req.originalUrl,
    method: req.method,
    timestamp: new Date().toISOString()
  });
};

/**
 * Async error wrapper for route handlers
 * Catches async errors and passes them to error handler
 */
const asyncHandler = (fn) => {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

/**
 * Create custom API error
 */
const createError = (message, statusCode = 500, errorCode = null, details = null) => {
  return new APIError(message, statusCode, errorCode, details);
};

/**
 * Handle uncaught exceptions
 */
const handleUncaughtException = (err) => {
  console.error('💥 UNCAUGHT EXCEPTION! Shutting down...');
  console.error('Error:', err.name, err.message);
  console.error('Stack:', err.stack);
  
  logError(err);
  
  process.exit(1);
};

/**
 * Handle unhandled promise rejections
 */
const handleUnhandledRejection = (err, promise) => {
  console.error('💥 UNHANDLED PROMISE REJECTION! Shutting down...');
  console.error('Error:', err.name, err.message);
  console.error('Promise:', promise);
  
  logError(err);
  
  process.exit(1);
};

// Set up global error handlers
if (process.env.NODE_ENV === 'production') {
  process.on('uncaughtException', handleUncaughtException);
  process.on('unhandledRejection', handleUnhandledRejection);
}

module.exports = {
  APIError,
  errorHandler,
  notFoundHandler,
  asyncHandler,
  createError,
  logError
};