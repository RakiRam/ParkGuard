// ===================================
// INCIDENT REPORTING ROUTES
// ===================================

const express = require('express');
const { body, param, query: queryValidator, validationResult } = require('express-validator');
const { query, transaction } = require('../config/database');
const { asyncHandler, createError } = require('../middleware/errorHandler');
const { authenticateToken } = require('../middleware/auth');
const { sendNotification } = require('../services/notificationService');

const router = express.Router();

/**
 * @swagger
 * components:
 *   schemas:
 *     Incident:
 *       type: object
 *       properties:
 *         id:
 *           type: string
 *           format: uuid
 *         vehicleId:
 *           type: string
 *           format: uuid
 *         incidentType:
 *           type: string
 *           enum: [wrong_parking, obstruction, damage, contact]
 *         description:
 *           type: string
 *         locationAddress:
 *           type: string
 *         status:
 *           type: string
 *           enum: [reported, acknowledged, resolved]
 *         createdAt:
 *           type: string
 *           format: date-time
 */

/**
 * @swagger
 * /api/incidents/report:
 *   post:
 *     summary: Report an incident (public endpoint)
 *     tags: [Incidents]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - vehicleId
 *               - incidentType
 *             properties:
 *               vehicleId:
 *                 type: string
 *                 format: uuid
 *               incidentType:
 *                 type: string
 *                 enum: [wrong_parking, obstruction, damage, contact]
 *               description:
 *                 type: string
 *                 maxLength: 500
 *               locationAddress:
 *                 type: string
 *                 maxLength: 200
 *               latitude:
 *                 type: number
 *                 minimum: -90
 *                 maximum: 90
 *               longitude:
 *                 type: number
 *                 minimum: -180
 *                 maximum: 180
 *               photoUrl:
 *                 type: string
 *     responses:
 *       201:
 *         description: Incident reported successfully
 *       400:
 *         description: Validation error
 *       404:
 *         description: Vehicle not found
 *       429:
 *         description: Rate limit exceeded
 */
router.post('/report', [
  body('vehicleId')
    .isUUID()
    .withMessage('Valid vehicle ID is required'),
  
  body('incidentType')
    .isIn(['wrong_parking', 'obstruction', 'damage', 'contact'])
    .withMessage('Valid incident type is required'),
  
  body('description')
    .optional()
    .isLength({ max: 500 })
    .withMessage('Description must be less than 500 characters')
    .trim(),
  
  body('locationAddress')
    .optional()
    .isLength({ max: 200 })
    .withMessage('Location address must be less than 200 characters')
    .trim(),
  
  body('latitude')
    .optional()
    .isFloat({ min: -90, max: 90 })
    .withMessage('Valid latitude is required'),
  
  body('longitude')
    .optional()
    .isFloat({ min: -180, max: 180 })
    .withMessage('Valid longitude is required'),
  
  body('photoUrl')
    .optional()
    .isURL()
    .withMessage('Valid photo URL is required'),
], asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    throw createError('Validation failed', 400, 'VALIDATION_ERROR', errors.array());
  }

  const { vehicleId, incidentType, description, locationAddress, latitude, longitude, photoUrl } = req.body;
  const reporterIp = req.ip || req.connection.remoteAddress;

  await transaction(async (client) => {
    // Verify vehicle exists and is active
    const vehicleResult = await client.query(
      `SELECT v.id, v.user_id, v.license_plate, v.type, u.name as owner_name, u.email as owner_email
       FROM vehicles v
       JOIN users u ON v.user_id = u.id
       WHERE v.id = $1 AND v.is_active = true AND u.is_active = true`,
      [vehicleId]
    );

    if (vehicleResult.rows.length === 0) {
      throw createError('Vehicle not found or inactive', 404, 'VEHICLE_NOT_FOUND');
    }

    const vehicle = vehicleResult.rows[0];

    // Check for duplicate reports from same IP within last 5 minutes
    const duplicateCheck = await client.query(
      `SELECT id FROM incidents 
       WHERE vehicle_id = $1 AND reporter_ip = $2 AND incident_type = $3
       AND created_at > NOW() - INTERVAL '5 minutes'`,
      [vehicleId, reporterIp, incidentType]
    );

    if (duplicateCheck.rows.length > 0) {
      throw createError('Duplicate report detected. Please wait before reporting again.', 429, 'DUPLICATE_REPORT');
    }

    let locationCoords = null;
    if (latitude && longitude) {
      locationCoords = `(${longitude}, ${latitude})`;
    }

    // Create incident record
    const incidentResult = await client.query(
      `INSERT INTO incidents (
        vehicle_id, reporter_ip, incident_type, description, 
        location_coords, location_address, photo_url, status
      ) 
       VALUES ($1, $2, $3, $4, $5, $6, $7, 'reported') 
       RETURNING *`,
      [vehicleId, reporterIp, incidentType, description?.trim() || null, 
       locationCoords, locationAddress?.trim() || null, photoUrl || null]
    );

    const incident = incidentResult.rows[0];

    // Send notification to vehicle owner
    try {
      await sendNotification({
        userId: vehicle.user_id,
        incidentId: incident.id,
        type: 'incident_report',
        title: getIncidentTitle(incidentType),
        message: getIncidentMessage(incidentType, vehicle.license_plate, locationAddress),
        io: global.io
      });
    } catch (notificationError) {
      console.error('Failed to send notification:', notificationError);
      // Don't fail the request if notification fails
    }

    res.status(201).json({
      success: true,
      message: 'Incident reported successfully. Vehicle owner has been notified.',
      data: {
        incident: {
          id: incident.id,
          type: incident.incident_type,
          status: incident.status,
          reportedAt: incident.created_at
        }
      }
    });
  });
}));

/**
 * @swagger
 * /api/incidents/my-reports:
 *   get:
 *     summary: Get incidents for user's vehicles
 *     tags: [Incidents]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [reported, acknowledged, resolved, all]
 *       - in: query
 *         name: type
 *         schema:
 *           type: string
 *           enum: [wrong_parking, obstruction, damage, contact]
 *       - in: query
 *         name: vehicleId
 *         schema:
 *           type: string
 *           format: uuid
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           minimum: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 100
 *     responses:
 *       200:
 *         description: Incidents retrieved successfully
 */
router.get('/my-reports', authenticateToken, [
  queryValidator('status').optional().isIn(['reported', 'acknowledged', 'resolved', 'all']),
  queryValidator('type').optional().isIn(['wrong_parking', 'obstruction', 'damage', 'contact']),
  queryValidator('vehicleId').optional().isUUID(),
  queryValidator('page').optional().isInt({ min: 1 }),
  queryValidator('limit').optional().isInt({ min: 1, max: 100 }),
], asyncHandler(async (req, res) => {
  const {
    status = 'all',
    type,
    vehicleId,
    page = 1,
    limit = 20
  } = req.query;

  const offset = (parseInt(page) - 1) * parseInt(limit);
  let whereConditions = ['v.user_id = $1'];
  let queryParams = [req.user.id];
  let paramIndex = 2;

  // Add filters
  if (status !== 'all') {
    whereConditions.push(`i.status = $${paramIndex}`);
    queryParams.push(status);
    paramIndex++;
  }

  if (type) {
    whereConditions.push(`i.incident_type = $${paramIndex}`);
    queryParams.push(type);
    paramIndex++;
  }

  if (vehicleId) {
    whereConditions.push(`v.id = $${paramIndex}`);
    queryParams.push(vehicleId);
    paramIndex++;
  }

  // Get total count
  const countQuery = `
    SELECT COUNT(*) 
    FROM incidents i
    JOIN vehicles v ON i.vehicle_id = v.id
    WHERE ${whereConditions.join(' AND ')}
  `;
  const countResult = await query(countQuery, queryParams);
  const totalCount = parseInt(countResult.rows[0].count);

  // Get incidents
  const incidentsQuery = `
    SELECT i.*, 
           v.license_plate, v.type as vehicle_type, v.brand, v.model, v.color,
           EXTRACT(EPOCH FROM (NOW() - i.created_at)) / 3600 as hours_ago
    FROM incidents i
    JOIN vehicles v ON i.vehicle_id = v.id
    WHERE ${whereConditions.join(' AND ')}
    ORDER BY i.created_at DESC
    LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
  `;
  
  queryParams.push(parseInt(limit), offset);
  const result = await query(incidentsQuery, queryParams);

  const totalPages = Math.ceil(totalCount / parseInt(limit));

  res.json({
    success: true,
    data: {
      incidents: result.rows.map(incident => ({
        ...incident,
        hoursAgo: Math.floor(incident.hours_ago)
      })),
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
 * /api/incidents/{id}:
 *   get:
 *     summary: Get incident details
 *     tags: [Incidents]
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
 *         description: Incident details retrieved
 *       404:
 *         description: Incident not found
 */
router.get('/:id', authenticateToken, [
  param('id').isUUID().withMessage('Valid incident ID is required')
], asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    throw createError('Validation failed', 400, 'VALIDATION_ERROR', errors.array());
  }

  const { id } = req.params;

  const result = await query(
    `SELECT i.*, 
            v.license_plate, v.type as vehicle_type, v.brand, v.model, v.color, v.year, v.user_id
     FROM incidents i
     JOIN vehicles v ON i.vehicle_id = v.id
     WHERE i.id = $1`,
    [id]
  );

  if (result.rows.length === 0) {
    throw createError('Incident not found', 404, 'INCIDENT_NOT_FOUND');
  }

  const incident = result.rows[0];

  // Check if user owns the vehicle
  if (req.user.role !== 'admin' && incident.user_id !== req.user.id) {
    throw createError('Access denied', 403, 'ACCESS_DENIED');
  }

  // Remove user_id from response
  delete incident.user_id;

  res.json({
    success: true,
    data: { incident }
  });
}));

/**
 * @swagger
 * /api/incidents/{id}/acknowledge:
 *   put:
 *     summary: Acknowledge an incident
 *     tags: [Incidents]
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
 *         description: Incident acknowledged
 *       404:
 *         description: Incident not found
 */
router.put('/:id/acknowledge', authenticateToken, [
  param('id').isUUID().withMessage('Valid incident ID is required')
], asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    throw createError('Validation failed', 400, 'VALIDATION_ERROR', errors.array());
  }

  const { id } = req.params;

  const result = await query(
    `UPDATE incidents i
     SET status = 'acknowledged', updated_at = CURRENT_TIMESTAMP
     FROM vehicles v
     WHERE i.id = $1 AND i.vehicle_id = v.id AND v.user_id = $2 AND i.status = 'reported'
     RETURNING i.*, v.license_plate`,
    [id, req.user.id]
  );

  if (result.rows.length === 0) {
    throw createError('Incident not found or already acknowledged', 404, 'INCIDENT_NOT_FOUND');
  }

  res.json({
    success: true,
    message: 'Incident acknowledged',
    data: { incident: result.rows[0] }
  });
}));

/**
 * @swagger
 * /api/incidents/{id}/resolve:
 *   put:
 *     summary: Mark incident as resolved
 *     tags: [Incidents]
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
 *         description: Incident resolved
 *       404:
 *         description: Incident not found
 */
router.put('/:id/resolve', authenticateToken, [
  param('id').isUUID().withMessage('Valid incident ID is required')
], asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    throw createError('Validation failed', 400, 'VALIDATION_ERROR', errors.array());
  }

  const { id } = req.params;

  const result = await query(
    `UPDATE incidents i
     SET status = 'resolved', resolved_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
     FROM vehicles v
     WHERE i.id = $1 AND i.vehicle_id = v.id AND v.user_id = $2 AND i.status != 'resolved'
     RETURNING i.*, v.license_plate`,
    [id, req.user.id]
  );

  if (result.rows.length === 0) {
    throw createError('Incident not found or already resolved', 404, 'INCIDENT_NOT_FOUND');
  }

  res.json({
    success: true,
    message: 'Incident marked as resolved',
    data: { incident: result.rows[0] }
  });
}));

/**
 * @swagger
 * /api/incidents/stats/summary:
 *   get:
 *     summary: Get incident statistics for user's vehicles
 *     tags: [Incidents]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: period
 *         schema:
 *           type: string
 *           enum: [7d, 30d, 90d, 1y, all]
 *           default: 30d
 *     responses:
 *       200:
 *         description: Incident statistics
 */
router.get('/stats/summary', authenticateToken, [
  queryValidator('period').optional().isIn(['7d', '30d', '90d', '1y', 'all'])
], asyncHandler(async (req, res) => {
  const { period = '30d' } = req.query;

  // Calculate date condition
  let dateCondition = '';
  switch (period) {
    case '7d':
      dateCondition = "AND i.created_at >= NOW() - INTERVAL '7 days'";
      break;
    case '30d':
      dateCondition = "AND i.created_at >= NOW() - INTERVAL '30 days'";
      break;
    case '90d':
      dateCondition = "AND i.created_at >= NOW() - INTERVAL '90 days'";
      break;
    case '1y':
      dateCondition = "AND i.created_at >= NOW() - INTERVAL '1 year'";
      break;
    default:
      dateCondition = '';
  }

  // Get overall statistics
  const statsResult = await query(
    `SELECT 
       COUNT(*) as total_incidents,
       COUNT(*) FILTER (WHERE i.status = 'reported') as pending,
       COUNT(*) FILTER (WHERE i.status = 'acknowledged') as acknowledged,
       COUNT(*) FILTER (WHERE i.status = 'resolved') as resolved,
       COUNT(*) FILTER (WHERE i.incident_type = 'wrong_parking') as wrong_parking,
       COUNT(*) FILTER (WHERE i.incident_type = 'obstruction') as obstruction,
       COUNT(*) FILTER (WHERE i.incident_type = 'damage') as damage,
       COUNT(*) FILTER (WHERE i.incident_type = 'contact') as contact_requests
     FROM incidents i
     JOIN vehicles v ON i.vehicle_id = v.id
     WHERE v.user_id = $1 ${dateCondition}`,
    [req.user.id]
  );

  // Get incidents by day
  const dailyResult = await query(
    `SELECT 
       DATE(i.created_at) as incident_date,
       COUNT(*) as count,
       i.incident_type
     FROM incidents i
     JOIN vehicles v ON i.vehicle_id = v.id
     WHERE v.user_id = $1 ${dateCondition}
     GROUP BY DATE(i.created_at), i.incident_type
     ORDER BY incident_date DESC
     LIMIT 30`,
    [req.user.id]
  );

  // Get most reported vehicle
  const vehicleResult = await query(
    `SELECT 
       v.id, v.license_plate, v.type, v.brand, v.model,
       COUNT(i.id) as incident_count
     FROM vehicles v
     LEFT JOIN incidents i ON v.id = i.vehicle_id ${dateCondition.replace('AND', 'AND')}
     WHERE v.user_id = $1 AND v.is_active = true
     GROUP BY v.id
     ORDER BY incident_count DESC
     LIMIT 5`,
    [req.user.id]
  );

  const stats = statsResult.rows[0];

  res.json({
    success: true,
    data: {
      summary: {
        totalIncidents: parseInt(stats.total_incidents),
        pending: parseInt(stats.pending),
        acknowledged: parseInt(stats.acknowledged),
        resolved: parseInt(stats.resolved),
      },
      byType: {
        wrongParking: parseInt(stats.wrong_parking),
        obstruction: parseInt(stats.obstruction),
        damage: parseInt(stats.damage),
        contactRequests: parseInt(stats.contact_requests)
      },
      dailyIncidents: dailyResult.rows.map(row => ({
        date: row.incident_date,
        count: parseInt(row.count),
        type: row.incident_type
      })),
      topVehicles: vehicleResult.rows.map(row => ({
        vehicleId: row.id,
        licensePlate: row.license_plate,
        type: row.type,
        brand: row.brand,
        model: row.model,
        incidentCount: parseInt(row.incident_count)
      })),
      period
    }
  });
}));

// Helper functions
function getIncidentTitle(type) {
  const titles = {
    'wrong_parking': '🚗 Wrong Parking Reported',
    'obstruction': '⚠️ Vehicle Obstruction Reported',
    'damage': '💥 Vehicle Damage Reported',
    'contact': '📞 Contact Request'
  };
  return titles[type] || 'Incident Reported';
}

function getIncidentMessage(type, licensePlate, location) {
  const messages = {
    'wrong_parking': `Your vehicle ${licensePlate} has been reported for incorrect parking`,
    'obstruction': `Your vehicle ${licensePlate} is blocking other vehicles`,
    'damage': `Your vehicle ${licensePlate} has been reported as damaged or fallen`,
    'contact': `Someone wants to contact you about your vehicle ${licensePlate}`
  };
  
  let message = messages[type] || `Incident reported for your vehicle ${licensePlate}`;
  
  if (location) {
    message += ` at ${location}`;
  }
  
  return message;
}

module.exports = router;