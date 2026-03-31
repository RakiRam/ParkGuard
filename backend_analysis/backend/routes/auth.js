// ===================================
// AUTHENTICATION ROUTES
// ===================================

const express = require('express');
const bcrypt = require('bcryptjs');
const { body, validationResult } = require('express-validator');
const rateLimit = require('express-rate-limit');
const { query, transaction } = require('../config/database');
const { generateToken, authenticateToken } = require('../middleware/auth');
const { asyncHandler, createError } = require('../middleware/errorHandler');
const { sendEmail } = require('../services/emailService');

const router = express.Router();

// Rate limiting for auth endpoints
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // limit each IP to 5 requests per windowMs
  message: {
    success: false,
    message: 'Too many authentication attempts, please try again later.',
    code: 'AUTH_RATE_LIMIT_EXCEEDED'
  },
  standardHeaders: true,
  legacyHeaders: false,
});

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // limit each IP to 10 login attempts per windowMs
  message: {
    success: false,
    message: 'Too many login attempts, please try again later.',
    code: 'LOGIN_RATE_LIMIT_EXCEEDED'
  },
  standardHeaders: true,
  legacyHeaders: false,
});

/**
 * @swagger
 * components:
 *   schemas:
 *     User:
 *       type: object
 *       properties:
 *         id:
 *           type: string
 *           format: uuid
 *         name:
 *           type: string
 *         email:
 *           type: string
 *           format: email
 *         phone:
 *           type: string
 *         role:
 *           type: string
 *           enum: [user, admin]
 *         isVerified:
 *           type: boolean
 *         createdAt:
 *           type: string
 *           format: date-time
 *     AuthResponse:
 *       type: object
 *       properties:
 *         success:
 *           type: boolean
 *         message:
 *           type: string
 *         data:
 *           type: object
 *           properties:
 *             user:
 *               $ref: '#/components/schemas/User'
 *             token:
 *               type: string
 */

/**
 * @swagger
 * /api/auth/register:
 *   post:
 *     summary: Register a new user
 *     tags: [Authentication]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *               - email
 *               - password
 *               - phone
 *             properties:
 *               name:
 *                 type: string
 *                 minLength: 2
 *                 maxLength: 100
 *                 example: "John Doe"
 *               email:
 *                 type: string
 *                 format: email
 *                 example: "john@example.com"
 *               password:
 *                 type: string
 *                 minLength: 8
 *                 example: "securePassword123"
 *               phone:
 *                 type: string
 *                 example: "+1234567890"
 *               address:
 *                 type: string
 *                 example: "123 Main St, City, State 12345"
 *     responses:
 *       201:
 *         description: User registered successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/AuthResponse'
 *       400:
 *         description: Validation error or user already exists
 *       429:
 *         description: Rate limit exceeded
 */
router.post('/register', authLimiter, [
  body('name')
    .isLength({ min: 2, max: 100 })
    .withMessage('Name must be between 2 and 100 characters')
    .matches(/^[a-zA-Z\s]+$/)
    .withMessage('Name can only contain letters and spaces'),
  
  body('email')
    .isEmail()
    .normalizeEmail()
    .withMessage('Valid email is required'),
  
  body('password')
    .isLength({ min: 8 })
    .withMessage('Password must be at least 8 characters')
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
    .withMessage('Password must contain at least one uppercase letter, one lowercase letter, and one number'),
  
  body('phone')
    .isMobilePhone('any', { strictMode: false })
    .withMessage('Valid phone number is required'),
  
  body('address')
    .optional()
    .isLength({ max: 500 })
    .withMessage('Address must be less than 500 characters'),
], asyncHandler(async (req, res) => {
  // Check validation errors
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    throw createError('Validation failed', 400, 'VALIDATION_ERROR', errors.array());
  }

  const { name, email, password, phone, address } = req.body;

  await transaction(async (client) => {
    // Check if user already exists
    const existingUser = await client.query(
      'SELECT id FROM users WHERE email = $1',
      [email.toLowerCase()]
    );

    if (existingUser.rows.length > 0) {
      throw createError('User already exists with this email', 409, 'USER_EXISTS');
    }

    // Check if phone number is already used
    const existingPhone = await client.query(
      'SELECT id FROM users WHERE phone = $1',
      [phone]
    );

    if (existingPhone.rows.length > 0) {
      throw createError('Phone number already registered', 409, 'PHONE_EXISTS');
    }

    // Hash password
    const saltRounds = 12;
    const passwordHash = await bcrypt.hash(password, saltRounds);

    // Create user
    const result = await client.query(
      `INSERT INTO users (name, email, password_hash, phone, address, is_verified) 
       VALUES ($1, $2, $3, $4, $5, $6) 
       RETURNING id, name, email, phone, role, is_verified, created_at`,
      [name.trim(), email.toLowerCase(), passwordHash, phone, address?.trim() || null, false]
    );

    const user = result.rows[0];

    // Generate JWT token
    const token = generateToken(user, { expiresIn: '7d' });

    // Send welcome email (async, don't wait for it)
    sendEmail({
      to: user.email,
      subject: 'Welcome to ParkGuard!',
      template: 'welcome',
      data: { name: user.name }
    }).catch(err => {
      console.error('Failed to send welcome email:', err);
    });

    res.status(201).json({
      success: true,
      message: 'User registered successfully',
      data: {
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          phone: user.phone,
          role: user.role,
          isVerified: user.is_verified,
          createdAt: user.created_at
        },
        token
      }
    });
  });
}));

/**
 * @swagger
 * /api/auth/login:
 *   post:
 *     summary: User login
 *     tags: [Authentication]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - password
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *                 example: "john@example.com"
 *               password:
 *                 type: string
 *                 example: "securePassword123"
 *               rememberMe:
 *                 type: boolean
 *                 example: false
 *     responses:
 *       200:
 *         description: Login successful
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/AuthResponse'
 *       401:
 *         description: Invalid credentials
 *       429:
 *         description: Rate limit exceeded
 */
router.post('/login', loginLimiter, [
  body('email')
    .isEmail()
    .normalizeEmail()
    .withMessage('Valid email is required'),
  
  body('password')
    .notEmpty()
    .withMessage('Password is required'),
  
  body('rememberMe')
    .optional()
    .isBoolean()
    .withMessage('RememberMe must be a boolean'),
], asyncHandler(async (req, res) => {
  // Check validation errors
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    throw createError('Validation failed', 400, 'VALIDATION_ERROR', errors.array());
  }

  const { email, password, rememberMe = false } = req.body;

  // Find user
  const result = await query(
    `SELECT id, name, email, password_hash, phone, role, is_active, is_verified,
            created_at, updated_at
     FROM users WHERE email = $1`,
    [email.toLowerCase()]
  );

  if (result.rows.length === 0) {
    throw createError('Invalid email or password', 401, 'INVALID_CREDENTIALS');
  }

  const user = result.rows[0];

  // Check if account is active
  if (!user.is_active) {
    throw createError('Account has been deactivated. Please contact support.', 401, 'ACCOUNT_DEACTIVATED');
  }

  // Verify password
  const isValidPassword = await bcrypt.compare(password, user.password_hash);
  if (!isValidPassword) {
    throw createError('Invalid email or password', 401, 'INVALID_CREDENTIALS');
  }

  // Generate JWT token
  const tokenExpiry = rememberMe ? '30d' : '7d';
  const token = generateToken(user, { expiresIn: tokenExpiry });

  // Update last login (async, don't wait for it)
  query('UPDATE users SET updated_at = CURRENT_TIMESTAMP WHERE id = $1', [user.id])
    .catch(err => console.error('Failed to update last login:', err));

  res.json({
    success: true,
    message: 'Login successful',
    data: {
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        role: user.role,
        isVerified: user.is_verified,
        createdAt: user.created_at
      },
      token,
      expiresIn: tokenExpiry
    }
  });
}));

/**
 * @swagger
 * /api/auth/profile:
 *   get:
 *     summary: Get user profile
 *     tags: [Authentication]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Profile retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                   properties:
 *                     user:
 *                       $ref: '#/components/schemas/User'
 *                     stats:
 *                       type: object
 *                       properties:
 *                         vehicleCount:
 *                           type: integer
 *                         incidentCount:
 *                           type: integer
 *                         orderCount:
 *                           type: integer
 *       401:
 *         description: Unauthorized
 */
router.get('/profile', authenticateToken, asyncHandler(async (req, res) => {
  const result = await query(
    `SELECT u.id, u.name, u.email, u.phone, u.address, u.role, u.is_verified, u.created_at,
            COUNT(DISTINCT v.id) as vehicle_count,
            COUNT(DISTINCT i.id) as incident_count,
            COUNT(DISTINCT o.id) as order_count
     FROM users u
     LEFT JOIN vehicles v ON u.id = v.user_id AND v.is_active = true
     LEFT JOIN incidents i ON v.id = i.vehicle_id
     LEFT JOIN orders o ON u.id = o.user_id
     WHERE u.id = $1
     GROUP BY u.id`,
    [req.user.id]
  );

  if (result.rows.length === 0) {
    throw createError('User profile not found', 404, 'PROFILE_NOT_FOUND');
  }

  const user = result.rows[0];

  res.json({
    success: true,
    data: {
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        address: user.address,
        role: user.role,
        isVerified: user.is_verified,
        createdAt: user.created_at
      },
      stats: {
        vehicleCount: parseInt(user.vehicle_count),
        incidentCount: parseInt(user.incident_count),
        orderCount: parseInt(user.order_count)
      }
    }
  });
}));

/**
 * @swagger
 * /api/auth/update-profile:
 *   put:
 *     summary: Update user profile
 *     tags: [Authentication]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *                 minLength: 2
 *                 maxLength: 100
 *               phone:
 *                 type: string
 *               address:
 *                 type: string
 *                 maxLength: 500
 *     responses:
 *       200:
 *         description: Profile updated successfully
 *       400:
 *         description: Validation error
 *       401:
 *         description: Unauthorized
 */
router.put('/update-profile', authenticateToken, [
  body('name')
    .optional()
    .isLength({ min: 2, max: 100 })
    .withMessage('Name must be between 2 and 100 characters'),
  
  body('phone')
    .optional()
    .isMobilePhone('any', { strictMode: false })
    .withMessage('Valid phone number is required'),
  
  body('address')
    .optional()
    .isLength({ max: 500 })
    .withMessage('Address must be less than 500 characters'),
], asyncHandler(async (req, res) => {
  // Check validation errors
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    throw createError('Validation failed', 400, 'VALIDATION_ERROR', errors.array());
  }

  const { name, phone, address } = req.body;
  const updates = {};
  const updateFields = [];
  const updateValues = [];
  let valueIndex = 1;

  // Build dynamic update query
  if (name !== undefined) {
    updates.name = name.trim();
    updateFields.push(`name = $${valueIndex}`);
    updateValues.push(updates.name);
    valueIndex++;
  }

  if (phone !== undefined) {
    // Check if phone number is already used by another user
    const existingPhone = await query(
      'SELECT id FROM users WHERE phone = $1 AND id != $2',
      [phone, req.user.id]
    );

    if (existingPhone.rows.length > 0) {
      throw createError('Phone number already in use', 409, 'PHONE_IN_USE');
    }

    updates.phone = phone;
    updateFields.push(`phone = $${valueIndex}`);
    updateValues.push(updates.phone);
    valueIndex++;
  }

  if (address !== undefined) {
    updates.address = address?.trim() || null;
    updateFields.push(`address = $${valueIndex}`);
    updateValues.push(updates.address);
    valueIndex++;
  }

  if (updateFields.length === 0) {
    throw createError('No valid fields to update', 400, 'NO_FIELDS_TO_UPDATE');
  }

  // Add updated_at timestamp
  updateFields.push(`updated_at = CURRENT_TIMESTAMP`);
  
  // Add user ID for WHERE clause
  updateValues.push(req.user.id);

  const result = await query(
    `UPDATE users SET ${updateFields.join(', ')} 
     WHERE id = $${valueIndex}
     RETURNING id, name, email, phone, address, role, is_verified, updated_at`,
    updateValues
  );

  res.json({
    success: true,
    message: 'Profile updated successfully',
    data: {
      user: result.rows[0]
    }
  });
}));

/**
 * @swagger
 * /api/auth/change-password:
 *   put:
 *     summary: Change user password
 *     tags: [Authentication]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - currentPassword
 *               - newPassword
 *             properties:
 *               currentPassword:
 *                 type: string
 *               newPassword:
 *                 type: string
 *                 minLength: 8
 *     responses:
 *       200:
 *         description: Password changed successfully
 *       400:
 *         description: Validation error
 *       401:
 *         description: Current password incorrect
 */
router.put('/change-password', authenticateToken, [
  body('currentPassword')
    .notEmpty()
    .withMessage('Current password is required'),
  
  body('newPassword')
    .isLength({ min: 8 })
    .withMessage('New password must be at least 8 characters')
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
    .withMessage('New password must contain at least one uppercase letter, one lowercase letter, and one number'),
], asyncHandler(async (req, res) => {
  // Check validation errors
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    throw createError('Validation failed', 400, 'VALIDATION_ERROR', errors.array());
  }

  const { currentPassword, newPassword } = req.body;

  // Get current password hash
  const result = await query(
    'SELECT password_hash FROM users WHERE id = $1',
    [req.user.id]
  );

  if (result.rows.length === 0) {
    throw createError('User not found', 404, 'USER_NOT_FOUND');
  }

  const user = result.rows[0];

  // Verify current password
  const isValidPassword = await bcrypt.compare(currentPassword, user.password_hash);
  if (!isValidPassword) {
    throw createError('Current password is incorrect', 401, 'INVALID_CURRENT_PASSWORD');
  }

  // Check if new password is different from current
  const isSamePassword = await bcrypt.compare(newPassword, user.password_hash);
  if (isSamePassword) {
    throw createError('New password must be different from current password', 400, 'SAME_PASSWORD');
  }

  // Hash new password
  const saltRounds = 12;
  const newPasswordHash = await bcrypt.hash(newPassword, saltRounds);

  // Update password
  await query(
    'UPDATE users SET password_hash = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
    [newPasswordHash, req.user.id]
  );

  res.json({
    success: true,
    message: 'Password changed successfully'
  });
}));

/**
 * @swagger
 * /api/auth/verify-token:
 *   get:
 *     summary: Verify JWT token validity
 *     tags: [Authentication]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Token is valid
 *       401:
 *         description: Token is invalid or expired
 */
router.get('/verify-token', authenticateToken, (req, res) => {
  res.json({
    success: true,
    message: 'Token is valid',
    data: {
      user: req.user,
      tokenInfo: req.tokenInfo
    }
  });
});

/**
 * @swagger
 * /api/auth/logout:
 *   post:
 *     summary: User logout (client-side token invalidation)
 *     tags: [Authentication]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Logout successful
 */
router.post('/logout', authenticateToken, (req, res) => {
  // In a stateless JWT system, logout is handled client-side by removing the token
  // For enhanced security, you could implement a token blacklist here
  
  res.json({
    success: true,
    message: 'Logout successful. Please remove the token from client storage.'
  });
});

module.exports = router;