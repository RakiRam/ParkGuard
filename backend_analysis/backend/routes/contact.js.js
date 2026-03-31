// ===================================
// CONTACT & VOIP ROUTES
// ===================================

const express = require('express');
const { body, param, validationResult } = require('express-validator');
const { query, transaction } = require('../config/database');
const { asyncHandler, createError } = require('../middleware/errorHandler');
const { initiateVoipCall, getCallStatus, sendSMS } = require('../services/voipService');

const router = express.Router();

/**
 * @swagger
 * /api/contact/initiate-call:
 *   post:
 *     summary: Initiate privacy-protected VoIP call
 *     tags: [Contact]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - vehicleId
 *               - callerPhone
 *             properties:
 *               vehicleId:
 *                 type: string
 *                 format: uuid
 *               callerPhone:
 *                 type: string
 *                 example: "+1234567890"
 *     responses:
 *       200:
 *         description: Call initiated successfully
 *       400:
 *         description: Validation error
 *       404:
 *         description: Vehicle not found
 */
router.post('/initiate-call', [
  body('vehicleId')
    .isUUID()
    .withMessage('Valid vehicle ID is required'),
  
  body('callerPhone')
    .isMobilePhone('any', { strictMode: false })
    .withMessage('Valid phone number is required'),
], asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    throw createError('Validation failed', 400, 'VALIDATION_ERROR', errors.array());
  }

  const { vehicleId, callerPhone } = req.body;
  const callerIp = req.ip || req.connection.remoteAddress;

  await transaction(async (client) => {
    // Get vehicle owner's phone number
    const vehicleResult = await client.query(
      `SELECT v.id, v.license_plate, v.type, u.phone as owner_phone, u.name as owner_name, u.id as user_id
       FROM vehicles v
       JOIN users u ON v.user_id = u.id
       WHERE v.id = $1 AND v.is_active = true AND u.is_active = true`,
      [vehicleId]
    );

    if (vehicleResult.rows.length === 0) {
      throw createError('Vehicle not found or inactive', 404, 'VEHICLE_NOT_FOUND');
    }

    const vehicle = vehicleResult.rows[0];

    // Check for rate limiting - max 3 calls per hour per vehicle
    const recentCallsResult = await client.query(
      `SELECT COUNT(*) FROM contact_logs 
       WHERE vehicle_id = $1 AND created_at > NOW() - INTERVAL '1 hour'`,
      [vehicleId]
    );

    if (parseInt(recentCallsResult.rows[0].count) >= 3) {
      throw createError('Too many calls to this vehicle. Please try again later.', 429, 'RATE_LIMIT_EXCEEDED');
    }

    // Initiate VoIP call through Twilio
    const callResult = await initiateVoipCall({
      callerPhone,
      ownerPhone: vehicle.owner_phone,
      vehiclePlate: vehicle.license_plate,
      vehicleId: vehicle.id
    });

    // Log the contact attempt
    await client.query(
      `INSERT INTO contact_logs (vehicle_id, caller_ip, contact_type, call_sid, status) 
       VALUES ($1, $2, 'voip_call', $3, $4)`,
      [vehicleId, callerIp, callResult.callSid, callResult.status]
    );

    res.json({
      success: true,
      message: 'Call initiated successfully',
      data: {
        callSid: callResult.callSid,
        status: callResult.status,
        estimatedWaitTime: callResult.estimatedConnectTime
      }
    });
  });
}));

/**
 * @swagger
 * /api/contact/call-status/{callSid}:
 *   get:
 *     summary: Get call status
 *     tags: [Contact]
 *     parameters:
 *       - in: path
 *         name: callSid
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Call status retrieved
 *       404:
 *         description: Call not found
 */
router.get('/call-status/:callSid', [
  param('callSid').notEmpty().withMessage('Call SID is required')
], asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    throw createError('Validation failed', 400, 'VALIDATION_ERROR', errors.array());
  }

  const { callSid } = req.params;

  // Get status from database
  const result = await query(
    'SELECT status, duration, created_at FROM contact_logs WHERE call_sid = $1',
    [callSid]
  );

  if (result.rows.length === 0) {
    throw createError('Call not found', 404, 'CALL_NOT_FOUND');
  }

  // Also get real-time status from Twilio
  let twilioStatus = null;
  try {
    twilioStatus = await getCallStatus(callSid);
  } catch (error) {
    console.error('Failed to get Twilio status:', error);
  }

  res.json({
    success: true,
    data: {
      ...result.rows[0],
      twilioStatus
    }
  });
}));

/**
 * @swagger
 * /api/contact/send-message:
 *   post:
 *     summary: Send SMS message to vehicle owner (fallback option)
 *     tags: [Contact]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - vehicleId
 *               - message
 *             properties:
 *               vehicleId:
 *                 type: string
 *                 format: uuid
 *               message:
 *                 type: string
 *                 maxLength: 160
 *     responses:
 *       200:
 *         description: Message sent successfully
 *       400:
 *         description: Validation error
 */
router.post('/send-message', [
  body('vehicleId')
    .isUUID()
    .withMessage('Valid vehicle ID is required'),
  
  body('message')
    .isLength({ min: 1, max: 160 })
    .withMessage('Message must be between 1 and 160 characters')
    .trim(),
], asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    throw createError('Validation failed', 400, 'VALIDATION_ERROR', errors.array());
  }

  const { vehicleId, message } = req.body;
  const senderIp = req.ip || req.connection.remoteAddress;

  await transaction(async (client) => {
    // Get vehicle owner's phone
    const vehicleResult = await client.query(
      `SELECT v.id, v.license_plate, u.phone as owner_phone
       FROM vehicles v
       JOIN users u ON v.user_id = u.id
       WHERE v.id = $1 AND v.is_active = true`,
      [vehicleId]
    );

    if (vehicleResult.rows.length === 0) {
      throw createError('Vehicle not found', 404, 'VEHICLE_NOT_FOUND');
    }

    const vehicle = vehicleResult.rows[0];

    // Rate limiting - max 5 messages per hour
    const recentMessages = await client.query(
      `SELECT COUNT(*) FROM contact_logs 
       WHERE vehicle_id = $1 AND contact_type = 'sms' AND created_at > NOW() - INTERVAL '1 hour'`,
      [vehicleId]
    );

    if (parseInt(recentMessages.rows[0].count) >= 5) {
      throw createError('Message limit exceeded. Please try again later.', 429, 'RATE_LIMIT_EXCEEDED');
    }

    // Send SMS
    const smsMessage = `ParkGuard: ${message} (Vehicle: ${vehicle.license_plate})`;
    const smsResult = await sendSMS({
      to: vehicle.owner_phone,
      message: smsMessage
    });

    // Log the message
    await client.query(
      `INSERT INTO contact_logs (vehicle_id, caller_ip, contact_type, call_sid, status) 
       VALUES ($1, $2, 'sms', $3, $4)`,
      [vehicleId, senderIp, smsResult.sid, smsResult.status]
    );

    res.json({
      success: true,
      message: 'Message sent successfully',
      data: {
        messageSid: smsResult.sid,
        status: smsResult.status
      }
    });
  });
}));

/**
 * Twilio webhook: Call status callback
 * @swagger
 * /api/contact/call-status-webhook:
 *   post:
 *     summary: Twilio webhook for call status updates
 *     tags: [Contact]
 *     requestBody:
 *       required: true
 *       content:
 *         application/x-www-form-urlencoded:
 *           schema:
 *             type: object
 */
router.post('/call-status-webhook', express.urlencoded({ extended: false }), asyncHandler(async (req, res) => {
  const { CallSid, CallStatus, CallDuration } = req.body;

  if (!CallSid) {
    return res.status(400).send('Missing CallSid');
  }

  try {
    // Update call status in database
    await query(
      `UPDATE contact_logs 
       SET status = $1, duration = $2, updated_at = CURRENT_TIMESTAMP 
       WHERE call_sid = $3`,
      [CallStatus, CallDuration || 0, CallSid]
    );

    console.log(`📞 Call status updated: ${CallSid} - ${CallStatus}`);
    res.status(200).send('OK');
  } catch (error) {
    console.error('Error updating call status:', error);
    res.status(500).send('Internal Server Error');
  }
}));

/**
 * Twilio webhook: Conference status callback
 */
router.post('/conference-callback', express.urlencoded({ extended: false }), asyncHandler(async (req, res) => {
  const { ConferenceSid, StatusCallbackEvent, FriendlyName } = req.body;

  console.log(`🎤 Conference ${ConferenceSid}: ${StatusCallbackEvent}`);

  // Log conference events for analytics
  try {
    await query(
      `INSERT INTO conference_logs (conference_sid, event_type, friendly_name, created_at)
       VALUES ($1, $2, $3, CURRENT_TIMESTAMP)
       ON CONFLICT DO NOTHING`,
      [ConferenceSid, StatusCallbackEvent, FriendlyName]
    );
  } catch (error) {
    console.error('Error logging conference event:', error);
  }

  res.status(200).send('OK');
}));

module.exports = router;