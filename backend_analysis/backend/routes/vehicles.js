// ===================================
// VEHICLE MANAGEMENT ROUTES
// ===================================

const express = require('express');
const { body, validationResult, param } = require('express-validator');
const QRCode = require('qrcode');
const { v4: uuidv4 } = require('uuid');
const { query, transaction } = require('../config/database');
const { asyncHandler, createError } = require('../middleware/errorHandler');
const { requireOwnership } = require('../middleware/auth');

const router = express.Router();

/**
 * @swagger
 * components:
 *   schemas:
 *     Vehicle:
 *       type: object
 *       properties:
 *         id:
 *           type: string
 *           format: uuid
 *         type:
 *           type: string
 *           enum: [car, motorcycle, truck, van, bus, other]
 *         brand:
 *           type: string
 *         model:
 *           type: string
 *         year:
 *           type: integer
 *         color:
 *           type: string
 *         licensePlate:
 *           type: string
 *         qrCode:
 *           type: string
 *         qrCodeImage:
 *           type: string
 *         qrCodeUrl:
 *           type: string
 *         isActive:
 *           type: boolean
 *         createdAt:
 *           type: string
 *           format: date-time
 *         updatedAt:
 *           type: string
 *           format: date-time
 */

/**
 * @swagger
 * /api/vehicles:
 *   post:
 *     summary: Register a new vehicle
 *     tags: [Vehicles]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - type
 *               - licensePlate
 *             properties:
 *               type:
 *                 type: string
 *                 enum: [car, motorcycle, truck, van, bus, other]
 *                 example: "car"
 *               brand:
 *                 type: string
 *                 maxLength: 100
 *                 example: "Toyota"
 *               model:
 *                 type: string
 *                 maxLength: 100
 *                 example: "Camry"
 *               year:
 *                 type: integer
 *                 minimum: 1900
 *                 maximum: 2030
 *                 example: 2022
 *               color:
 *                 type: string
 *                 maxLength: 50
 *                 example: "Blue"
 *               licensePlate:
 *                 type: string
 *                 maxLength: 20
 *                 example: "ABC123"
 *     responses:
 *       201:
 *         description: Vehicle registered successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *                 data:
 *                   type: object
 *                   properties:
 *                     vehicle:
 *                       $ref: '#/components/schemas/Vehicle'
 *       400:
 *         description: Validation error
 *       409:
 *         description: License plate already exists
 */
router.post('/', [
  body('type')
    .isIn(['car', 'motorcycle', 'truck', 'van', 'bus', 'other'])
    .withMessage('Vehicle type must be one of: car, motorcycle, truck, van, bus, other'),
  
  body('brand')
    .optional()
    .isLength({ max: 100 })
    .withMessage('Brand must be less than 100 characters')
    .trim(),
  
  body('model')
    .optional()
    .isLength({ max: 100 })
    .withMessage('Model must be less than 100 characters')
    .trim(),
  
  body('year')
    .optional()
    .isInt({ min: 1900, max: new Date().getFullYear() + 1 })
    .withMessage('Year must be between 1900 and current year + 1'),
  
  body('color')
    .optional()
    .isLength({ max: 50 })
    .withMessage('Color must be less than 50 characters')
    .trim(),
  
  body('licensePlate')
    .notEmpty()
    .withMessage('License plate is required')
    .isLength({ min: 1, max: 20 })
    .withMessage('License plate must be between 1 and 20 characters')
    .matches(/^[A-Za-z0-9\-\s]+$/)
    .withMessage('License plate can only contain letters, numbers, hyphens, and spaces')
    .trim(),
], asyncHandler(async (req, res) => {
  // Check validation errors
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    throw createError('Validation failed', 400, 'VALIDATION_ERROR', errors.array());
  }

  const { type, licensePlate, brand, model, year, color } = req.body;
  const normalizedLicensePlate = licensePlate.toUpperCase().replace(/\s+/g, '');

  await transaction(async (client) => {
    // Check if license plate already exists
    const existingVehicle = await client.query(
      'SELECT id FROM vehicles WHERE license_plate = $1',
      [normalizedLicensePlate]
    );

    if (existingVehicle.rows.length > 0) {
      throw createError('Vehicle with this license plate already registered', 409, 'LICENSE_PLATE_EXISTS');
    }

    // Check user's vehicle limit (max 5 vehicles per user)
    const vehicleCount = await client.query(
      'SELECT COUNT(*) FROM vehicles WHERE user_id = $1 AND is_active = true',
      [req.user.id]
    );

    if (parseInt(vehicleCount.rows[0].count) >= 5) {
      throw createError('Maximum 5 vehicles allowed per user', 400, 'VEHICLE_LIMIT_EXCEEDED');
    }

    // Generate unique QR code
    const qrCodeData = uuidv4();
    const qrCodeUrl = `${process.env.FRONTEND_URL}/scan?vehicle=${qrCodeData}`;

    // Create vehicle record
    const result = await client.query(
      `INSERT INTO vehicles (user_id, type, brand, model, year, color, license_plate, qr_code) 
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8) 
       RETURNING *`,
      [
        req.user.id,
        type,
        brand?.trim() || null,
        model?.trim() || null,
        year || null,
        color?.trim() || null,
        normalizedLicensePlate,
        qrCodeData
      ]
    );

    const vehicle = result.rows[0];

    // Generate QR code image
    const qrCodeImage = await QRCode.toDataURL(qrCodeUrl, {
      width: 300,
      margin: 2,
      color: {
        dark: '#000000',
        light: '#FFFFFF'
      }
    });

    res.status(201).json({
      success: true,
      message: 'Vehicle registered successfully',
      data: {
        vehicle: {
          ...vehicle,
          qrCodeImage,
          qrCodeUrl
        }
      }
    });
  });
}));

/**
 * @swagger
 * /api/vehicles:
 *   get:
 *     summary: Get user's vehicles
 *     tags: [Vehicles]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: type
 *         schema:
 *           type: string
 *         description: Filter by vehicle type
 *       - in: query
 *         name: active
 *         schema:
 *           type: boolean
 *         description: Filter by active status
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           minimum: 1
 *         description: Page number
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 100
 *         description: Items per page
 *     responses:
 *       200:
 *         description: Vehicles retrieved successfully
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
 *                     vehicles:
 *                       type: array
 *                       items:
 *                         $ref: '#/components/schemas/Vehicle'
 *                     pagination:
 *                       type: object
 *                       properties:
 *                         page:
 *                           type: integer
 *                         limit:
 *                           type: integer
 *                         total:
 *                           type: integer
 *                         totalPages:
 *                           type: integer
 */
router.get('/', asyncHandler(async (req, res) => {
  const { 
    type, 
    active = 'true', 
    page = 1, 
    limit = 10 
  } = req.query;

  const offset = (parseInt(page) - 1) * parseInt(limit);
  let whereConditions = ['v.user_id = $1'];
  let queryParams = [req.user.id];
  let paramIndex = 2;

  // Add filters
  if (type) {
    whereConditions.push(`v.type = ${paramIndex}`);
    queryParams.push(type);
    paramIndex++;
  }

  if (active !== 'all') {
    whereConditions.push(`v.is_active = ${paramIndex}`);
    queryParams.push(active === 'true');
    paramIndex++;
  }

  // Get total count
  const countQuery = `
    SELECT COUNT(*) 
    FROM vehicles v 
    WHERE ${whereConditions.join(' AND ')}
  `;
  const countResult = await query(countQuery, queryParams);
  const totalCount = parseInt(countResult.rows[0].count);

  // Get vehicles with incident counts
  const vehiclesQuery = `
    SELECT v.*, COUNT(i.id) as incident_count,
           MAX(i.created_at) as last_incident_date
    FROM vehicles v
    LEFT JOIN incidents i ON v.id = i.vehicle_id
    WHERE ${whereConditions.join(' AND ')}
    GROUP BY v.id
    ORDER BY v.created_at DESC
    LIMIT ${paramIndex} OFFSET ${paramIndex + 1}
  `;
  
  queryParams.push(parseInt(limit), offset);
  const result = await query(vehiclesQuery, queryParams);

  // Generate QR codes for each vehicle
  const vehicles = await Promise.all(result.rows.map(async (vehicle) => {
    const qrCodeUrl = `${process.env.FRONTEND_URL}/scan?vehicle=${vehicle.qr_code}`;
    const qrCodeImage = await QRCode.toDataURL(qrCodeUrl, {
      width: 300,
      margin: 2,
      color: {
        dark: '#000000',
        light: '#FFFFFF'
      }
    });
    
    return {
      ...vehicle,
      incidentCount: parseInt(vehicle.incident_count),
      lastIncidentDate: vehicle.last_incident_date,
      qrCodeImage,
      qrCodeUrl
    };
  }));

  const totalPages = Math.ceil(totalCount / parseInt(limit));

  res.json({
    success: true,
    data: {
      vehicles,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: totalCount,
        totalPages,
        hasNext: parseInt(page) < totalPages,
        hasPrev: parseInt(page) > 1
      }
    }
  });
}));

/**
 * @swagger
 * /api/vehicles/{id}:
 *   get:
 *     summary: Get vehicle by ID
 *     tags: [Vehicles]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Vehicle retrieved successfully
 *       404:
 *         description: Vehicle not found
 */
router.get('/:id', [
  param('id').isUUID().withMessage('Valid vehicle ID is required')
], requireOwnership('vehicles'), asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    throw createError('Validation failed', 400, 'VALIDATION_ERROR', errors.array());
  }

  const { id } = req.params;

  const result = await query(
    `SELECT v.*, COUNT(i.id) as incident_count,
            MAX(i.created_at) as last_incident_date,
            ARRAY_AGG(
              CASE WHEN i.id IS NOT NULL THEN
                JSON_BUILD_OBJECT(
                  'id', i.id,
                  'type', i.incident_type,
                  'status', i.status,
                  'createdAt', i.created_at
                )
              END
            ) FILTER (WHERE i.id IS NOT NULL) as recent_incidents
     FROM vehicles v
     LEFT JOIN incidents i ON v.id = i.vehicle_id
     WHERE v.id = $1
     GROUP BY v.id`,
    [id]
  );

  if (result.rows.length === 0) {
    throw createError('Vehicle not found', 404, 'VEHICLE_NOT_FOUND');
  }

  const vehicle = result.rows[0];
  const qrCodeUrl = `${process.env.FRONTEND_URL}/scan?vehicle=${vehicle.qr_code}`;
  const qrCodeImage = await QRCode.toDataURL(qrCodeUrl, {
    width: 300,
    margin: 2,
    color: {
      dark: '#000000',
      light: '#FFFFFF'
    }
  });

  res.json({
    success: true,
    data: {
      vehicle: {
        ...vehicle,
        incidentCount: parseInt(vehicle.incident_count),
        lastIncidentDate: vehicle.last_incident_date,
        recentIncidents: vehicle.recent_incidents || [],
        qrCodeImage,
        qrCodeUrl
      }
    }
  });
}));

/**
 * @swagger
 * /api/vehicles/{id}:
 *   put:
 *     summary: Update vehicle information
 *     tags: [Vehicles]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               type:
 *                 type: string
 *                 enum: [car, motorcycle, truck, van, bus, other]
 *               brand:
 *                 type: string
 *                 maxLength: 100
 *               model:
 *                 type: string
 *                 maxLength: 100
 *               year:
 *                 type: integer
 *                 minimum: 1900
 *                 maximum: 2030
 *               color:
 *                 type: string
 *                 maxLength: 50
 *     responses:
 *       200:
 *         description: Vehicle updated successfully
 *       400:
 *         description: Validation error
 *       404:
 *         description: Vehicle not found
 */
router.put('/:id', [
  param('id').isUUID().withMessage('Valid vehicle ID is required'),
  
  body('type')
    .optional()
    .isIn(['car', 'motorcycle', 'truck', 'van', 'bus', 'other'])
    .withMessage('Vehicle type must be one of: car, motorcycle, truck, van, bus, other'),
  
  body('brand')
    .optional()
    .isLength({ max: 100 })
    .withMessage('Brand must be less than 100 characters')
    .trim(),
  
  body('model')
    .optional()
    .isLength({ max: 100 })
    .withMessage('Model must be less than 100 characters')
    .trim(),
  
  body('year')
    .optional()
    .isInt({ min: 1900, max: new Date().getFullYear() + 1 })
    .withMessage('Year must be between 1900 and current year + 1'),
  
  body('color')
    .optional()
    .isLength({ max: 50 })
    .withMessage('Color must be less than 50 characters')
    .trim(),
], requireOwnership('vehicles'), asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    throw createError('Validation failed', 400, 'VALIDATION_ERROR', errors.array());
  }

  const { id } = req.params;
  const updates = req.body;

  // Build update query
  const updateFields = [];
  const updateValues = [];
  let valueIndex = 1;

  const allowedFields = ['type', 'brand', 'model', 'year', 'color'];
  Object.entries(updates).forEach(([key, value]) => {
    if (allowedFields.includes(key) && value !== undefined) {
      updateFields.push(`${key} = ${valueIndex}`);
      updateValues.push(typeof value === 'string' ? value.trim() || null : value);
      valueIndex++;
    }
  });

  if (updateFields.length === 0) {
    throw createError('No valid fields to update', 400, 'NO_FIELDS_TO_UPDATE');
  }

  // Add updated_at timestamp
  updateFields.push('updated_at = CURRENT_TIMESTAMP');
  
  // Add vehicle ID for WHERE clause
  updateValues.push(id);

  const result = await query(
    `UPDATE vehicles SET ${updateFields.join(', ')} 
     WHERE id = ${valueIndex}
     RETURNING *`,
    updateValues
  );

  if (result.rows.length === 0) {
    throw createError('Vehicle not found', 404, 'VEHICLE_NOT_FOUND');
  }

  const vehicle = result.rows[0];
  const qrCodeUrl = `${process.env.FRONTEND_URL}/scan?vehicle=${vehicle.qr_code}`;
  const qrCodeImage = await QRCode.toDataURL(qrCodeUrl, {
    width: 300,
    margin: 2,
    color: {
      dark: '#000000',
      light: '#FFFFFF'
    }
  });

  res.json({
    success: true,
    message: 'Vehicle updated successfully',
    data: {
      vehicle: {
        ...vehicle,
        qrCodeImage,
        qrCodeUrl
      }
    }
  });
}));

/**
 * @swagger
 * /api/vehicles/{id}/deactivate:
 *   put:
 *     summary: Deactivate vehicle (soft delete)
 *     tags: [Vehicles]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Vehicle deactivated successfully
 *       404:
 *         description: Vehicle not found
 */
router.put('/:id/deactivate', [
  param('id').isUUID().withMessage('Valid vehicle ID is required')
], requireOwnership('vehicles'), asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    throw createError('Validation failed', 400, 'VALIDATION_ERROR', errors.array());
  }

  const { id } = req.params;

  const result = await query(
    `UPDATE vehicles SET is_active = false, updated_at = CURRENT_TIMESTAMP 
     WHERE id = $1
     RETURNING *`,
    [id]
  );

  if (result.rows.length === 0) {
    throw createError('Vehicle not found', 404, 'VEHICLE_NOT_FOUND');
  }

  res.json({
    success: true,
    message: 'Vehicle deactivated successfully',
    data: {
      vehicle: result.rows[0]
    }
  });
}));

/**
 * @swagger
 * /api/vehicles/{id}/reactivate:
 *   put:
 *     summary: Reactivate vehicle
 *     tags: [Vehicles]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Vehicle reactivated successfully
 *       404:
 *         description: Vehicle not found
 */
router.put('/:id/reactivate', [
  param('id').isUUID().withMessage('Valid vehicle ID is required')
], requireOwnership('vehicles'), asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    throw createError('Validation failed', 400, 'VALIDATION_ERROR', errors.array());
  }

  const { id } = req.params;

  // Check user's active vehicle limit
  const vehicleCount = await query(
    'SELECT COUNT(*) FROM vehicles WHERE user_id = $1 AND is_active = true',
    [req.user.id]
  );

  if (parseInt(vehicleCount.rows[0].count) >= 5) {
    throw createError('Maximum 5 active vehicles allowed per user', 400, 'VEHICLE_LIMIT_EXCEEDED');
  }

  const result = await query(
    `UPDATE vehicles SET is_active = true, updated_at = CURRENT_TIMESTAMP 
     WHERE id = $1
     RETURNING *`,
    [id]
  );

  if (result.rows.length === 0) {
    throw createError('Vehicle not found', 404, 'VEHICLE_NOT_FOUND');
  }

  res.json({
    success: true,
    message: 'Vehicle reactivated successfully',
    data: {
      vehicle: result.rows[0]
    }
  });
}));

/**
 * @swagger
 * /api/vehicles/{id}/regenerate-qr:
 *   put:
 *     summary: Regenerate QR code for vehicle
 *     tags: [Vehicles]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: QR code regenerated successfully
 *       404:
 *         description: Vehicle not found
 */
router.put('/:id/regenerate-qr', [
  param('id').isUUID().withMessage('Valid vehicle ID is required')
], requireOwnership('vehicles'), asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    throw createError('Validation failed', 400, 'VALIDATION_ERROR', errors.array());
  }

  const { id } = req.params;

  // Generate new QR code
  const newQrCodeData = uuidv4();
  const qrCodeUrl = `${process.env.FRONTEND_URL}/scan?vehicle=${newQrCodeData}`;

  const result = await query(
    `UPDATE vehicles SET qr_code = $1, updated_at = CURRENT_TIMESTAMP 
     WHERE id = $2
     RETURNING *`,
    [newQrCodeData, id]
  );

  if (result.rows.length === 0) {
    throw createError('Vehicle not found', 404, 'VEHICLE_NOT_FOUND');
  }

  const vehicle = result.rows[0];
  const qrCodeImage = await QRCode.toDataURL(qrCodeUrl, {
    width: 300,
    margin: 2,
    color: {
      dark: '#000000',
      light: '#FFFFFF'
    }
  });

  res.json({
    success: true,
    message: 'QR code regenerated successfully',
    data: {
      vehicle: {
        ...vehicle,
        qrCodeImage,
        qrCodeUrl
      }
    }
  });
}));

/**
 * @swagger
 * /api/vehicles/{id}:
 *   delete:
 *     summary: Permanently delete vehicle
 *     tags: [Vehicles]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Vehicle deleted successfully
 *       404:
 *         description: Vehicle not found
 *       400:
 *         description: Cannot delete vehicle with active incidents
 */
router.delete('/:id', [
  param('id').isUUID().withMessage('Valid vehicle ID is required')
], requireOwnership('vehicles'), asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    throw createError('Validation failed', 400, 'VALIDATION_ERROR', errors.array());
  }

  const { id } = req.params;

  await transaction(async (client) => {
    // Check if vehicle has unresolved incidents
    const incidentCheck = await client.query(
      'SELECT COUNT(*) FROM incidents WHERE vehicle_id = $1 AND status != $2',
      [id, 'resolved']
    );

    if (parseInt(incidentCheck.rows[0].count) > 0) {
      throw createError('Cannot delete vehicle with unresolved incidents', 400, 'HAS_UNRESOLVED_INCIDENTS');
    }

    // Delete vehicle (this will cascade delete related records due to foreign key constraints)
    const result = await client.query(
      'DELETE FROM vehicles WHERE id = $1 RETURNING *',
      [id]
    );

    if (result.rows.length === 0) {
      throw createError('Vehicle not found', 404, 'VEHICLE_NOT_FOUND');
    }

    res.json({
      success: true,
      message: 'Vehicle deleted successfully',
      data: {
        deletedVehicle: {
          id: result.rows[0].id,
          licensePlate: result.rows[0].license_plate
        }
      }
    });
  });
}));

module.exports = router;