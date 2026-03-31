// ===================================
// QR CODE ROUTES
// ===================================

const express = require('express');
const { param, query: queryValidator } = require('express-validator');
const QRCode = require('qrcode');
const { query } = require('../config/database');
const { asyncHandler, createError } = require('../middleware/errorHandler');
const { optionalAuth } = require('../middleware/auth');

const router = express.Router();

/**
 * @swagger
 * components:
 *   schemas:
 *     QRProduct:
 *       type: object
 *       properties:
 *         id:
 *           type: string
 *           format: uuid
 *         name:
 *           type: string
 *         description:
 *           type: string
 *         price:
 *           type: number
 *           format: decimal
 *         imageUrl:
 *           type: string
 *         designCategory:
 *           type: string
 *         inventoryCount:
 *           type: integer
 *         isActive:
 *           type: boolean
 *         createdAt:
 *           type: string
 *           format: date-time
 *     VehicleInfo:
 *       type: object
 *       properties:
 *         id:
 *           type: string
 *           format: uuid
 *         type:
 *           type: string
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
 *         ownerName:
 *           type: string
 *         isVerifiedOwner:
 *           type: boolean
 */

/**
 * @swagger
 * /api/qr-codes/scan/{qrCode}:
 *   get:
 *     summary: Get vehicle info by QR code (public endpoint)
 *     tags: [QR Codes]
 *     parameters:
 *       - in: path
 *         name: qrCode
 *         required: true
 *         schema:
 *           type: string
 *         description: QR code identifier
 *     responses:
 *       200:
 *         description: Vehicle information retrieved successfully
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
 *                     vehicle:
 *                       $ref: '#/components/schemas/VehicleInfo'
 *       404:
 *         description: QR code not found or vehicle inactive
 */
router.get('/scan/:qrCode', [
  param('qrCode').notEmpty().withMessage('QR code is required')
], optionalAuth, asyncHandler(async (req, res) => {
  const { qrCode } = req.params;

  const result = await query(
    `SELECT v.id, v.type, v.brand, v.model, v.year, v.color, v.license_plate,
            u.name as owner_name, u.is_verified as owner_verified,
            v.created_at, v.updated_at
     FROM vehicles v
     JOIN users u ON v.user_id = u.id
     WHERE v.qr_code = $1 AND v.is_active = true AND u.is_active = true`,
    [qrCode]
  );

  if (result.rows.length === 0) {
    throw createError('QR code not found or vehicle inactive', 404, 'QR_NOT_FOUND');
  }

  const vehicle = result.rows[0];

  // Log the scan (optional - for analytics)
  const scannerIp = req.ip || req.connection.remoteAddress;
  query(
    `INSERT INTO qr_scans (vehicle_id, scanner_ip, scanned_at) 
     VALUES ($1, $2, CURRENT_TIMESTAMP)
     ON CONFLICT DO NOTHING`,
    [vehicle.id, scannerIp]
  ).catch(err => console.error('Failed to log QR scan:', err));

  res.json({
    success: true,
    data: {
      vehicle: {
        id: vehicle.id,
        type: vehicle.type,
        brand: vehicle.brand,
        model: vehicle.model,
        year: vehicle.year,
        color: vehicle.color,
        licensePlate: vehicle.license_plate,
        ownerName: vehicle.owner_name,
        isVerifiedOwner: vehicle.owner_verified,
        registeredDate: vehicle.created_at
      }
    }
  });
}));

/**
 * @swagger
 * /api/qr-codes/download/{vehicleId}:
 *   get:
 *     summary: Download QR code image for vehicle
 *     tags: [QR Codes]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: vehicleId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *       - in: query
 *         name: format
 *         schema:
 *           type: string
 *           enum: [png, svg]
 *           default: png
 *       - in: query
 *         name: size
 *         schema:
 *           type: integer
 *           minimum: 100
 *           maximum: 1000
 *           default: 300
 *     responses:
 *       200:
 *         description: QR code image
 *         content:
 *           image/png:
 *             schema:
 *               type: string
 *               format: binary
 *           image/svg+xml:
 *             schema:
 *               type: string
 *       404:
 *         description: Vehicle not found
 */
router.get('/download/:vehicleId', [
  param('vehicleId').isUUID().withMessage('Valid vehicle ID is required'),
  queryValidator('format').optional().isIn(['png', 'svg']),
  queryValidator('size').optional().isInt({ min: 100, max: 1000 })
], asyncHandler(async (req, res) => {
  const { vehicleId } = req.params;
  const { format = 'png', size = 300 } = req.query;

  // Get vehicle QR code
  const result = await query(
    'SELECT qr_code, user_id, license_plate FROM vehicles WHERE id = $1 AND is_active = true',
    [vehicleId]
  );

  if (result.rows.length === 0) {
    throw createError('Vehicle not found', 404, 'VEHICLE_NOT_FOUND');
  }

  const vehicle = result.rows[0];
  
  // Check if authenticated user owns this vehicle (optional - could be public)
  // Uncomment if you want to restrict downloads to vehicle owners only
  // if (req.user && req.user.id !== vehicle.user_id) {
  //   throw createError('Access denied', 403, 'ACCESS_DENIED');
  // }

  const qrCodeUrl = `${process.env.FRONTEND_URL}/scan?vehicle=${vehicle.qr_code}`;

  try {
    if (format === 'svg') {
      // Generate SVG QR code
      const qrCodeSvg = await QRCode.toString(qrCodeUrl, {
        type: 'svg',
        width: parseInt(size),
        margin: 2,
        color: {
          dark: '#000000',
          light: '#FFFFFF'
        }
      });

      res.setHeader('Content-Type', 'image/svg+xml');
      res.setHeader('Content-Disposition', `attachment; filename="parkguard-qr-${vehicle.license_plate}.svg"`);
      res.send(qrCodeSvg);
    } else {
      // Generate PNG QR code
      const qrCodeBuffer = await QRCode.toBuffer(qrCodeUrl, {
        width: parseInt(size),
        margin: 2,
        color: {
          dark: '#000000',
          light: '#FFFFFF'
        }
      });

      res.setHeader('Content-Type', 'image/png');
      res.setHeader('Content-Disposition', `attachment; filename="parkguard-qr-${vehicle.license_plate}.png"`);
      res.send(qrCodeBuffer);
    }
  } catch (error) {
    console.error('QR code generation error:', error);
    throw createError('Failed to generate QR code', 500, 'QR_GENERATION_FAILED');
  }
}));

/**
 * @swagger
 * /api/qr-codes/validate/{qrCode}:
 *   get:
 *     summary: Validate QR code without revealing full vehicle info
 *     tags: [QR Codes]
 *     parameters:
 *       - in: path
 *         name: qrCode
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: QR code validation result
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
 *                     isValid:
 *                       type: boolean
 *                     vehicleType:
 *                       type: string
 *                     isActive:
 *                       type: boolean
 */
router.get('/validate/:qrCode', [
  param('qrCode').notEmpty().withMessage('QR code is required')
], asyncHandler(async (req, res) => {
  const { qrCode } = req.params;

  const result = await query(
    `SELECT v.type, v.is_active, u.is_active as owner_active
     FROM vehicles v
     JOIN users u ON v.user_id = u.id
     WHERE v.qr_code = $1`,
    [qrCode]
  );

  if (result.rows.length === 0) {
    return res.json({
      success: true,
      data: {
        isValid: false,
        message: 'QR code not found'
      }
    });
  }

  const vehicle = result.rows[0];
  const isActive = vehicle.is_active && vehicle.owner_active;

  res.json({
    success: true,
    data: {
      isValid: true,
      vehicleType: vehicle.type,
      isActive,
      canReport: isActive
    }
  });
}));

/**
 * @swagger
 * /api/qr-codes/stats/{vehicleId}:
 *   get:
 *     summary: Get QR code scan statistics for vehicle
 *     tags: [QR Codes]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: vehicleId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *       - in: query
 *         name: period
 *         schema:
 *           type: string
 *           enum: [7d, 30d, 90d, 1y, all]
 *           default: 30d
 *     responses:
 *       200:
 *         description: QR scan statistics
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
 *                     totalScans:
 *                       type: integer
 *                     uniqueScans:
 *                       type: integer
 *                     scansByDay:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           date:
 *                             type: string
 *                           count:
 *                             type: integer
 */
router.get('/stats/:vehicleId', [
  param('vehicleId').isUUID().withMessage('Valid vehicle ID is required'),
  queryValidator('period').optional().isIn(['7d', '30d', '90d', '1y', 'all'])
], asyncHandler(async (req, res) => {
  const { vehicleId } = req.params;
  const { period = '30d' } = req.query;

  // Verify ownership
  const ownershipCheck = await query(
    'SELECT user_id FROM vehicles WHERE id = $1',
    [vehicleId]
  );

  if (ownershipCheck.rows.length === 0) {
    throw createError('Vehicle not found', 404, 'VEHICLE_NOT_FOUND');
  }

  if (req.user.role !== 'admin' && ownershipCheck.rows[0].user_id !== req.user.id) {
    throw createError('Access denied', 403, 'ACCESS_DENIED');
  }

  // Calculate date range
  let dateCondition = '';
  switch (period) {
    case '7d':
      dateCondition = "AND scanned_at >= NOW() - INTERVAL '7 days'";
      break;
    case '30d':
      dateCondition = "AND scanned_at >= NOW() - INTERVAL '30 days'";
      break;
    case '90d':
      dateCondition = "AND scanned_at >= NOW() - INTERVAL '90 days'";
      break;
    case '1y':
      dateCondition = "AND scanned_at >= NOW() - INTERVAL '1 year'";
      break;
    default:
      dateCondition = '';
  }

  // Get total scans
  const totalResult = await query(
    `SELECT COUNT(*) as total_scans,
            COUNT(DISTINCT scanner_ip) as unique_scans
     FROM qr_scans
     WHERE vehicle_id = $1 ${dateCondition}`,
    [vehicleId]
  );

  // Get scans by day
  const dailyResult = await query(
    `SELECT DATE(scanned_at) as scan_date, COUNT(*) as scan_count
     FROM qr_scans
     WHERE vehicle_id = $1 ${dateCondition}
     GROUP BY DATE(scanned_at)
     ORDER BY scan_date DESC
     LIMIT 30`,
    [vehicleId]
  );

  res.json({
    success: true,
    data: {
      totalScans: parseInt(totalResult.rows[0].total_scans),
      uniqueScans: parseInt(totalResult.rows[0].unique_scans),
      scansByDay: dailyResult.rows.map(row => ({
        date: row.scan_date,
        count: parseInt(row.scan_count)
      })),
      period
    }
  });
}));

module.exports = router;