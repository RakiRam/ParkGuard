// ===================================
// VOIP SERVICE - TWILIO INTEGRATION
// ===================================

const twilio = require('twilio');
const { query } = require('../config/database');

// Initialize Twilio client
const client = twilio(
  process.env.TWILIO_ACCOUNT_SID,
  process.env.TWILIO_AUTH_TOKEN
);

/**
 * Initiate a privacy-protected VoIP call between caller and vehicle owner
 * @param {Object} params - Call parameters
 * @param {string} params.callerPhone - Caller's phone number
 * @param {string} params.ownerPhone - Vehicle owner's phone number
 * @param {string} params.vehiclePlate - Vehicle license plate
 * @param {string} params.vehicleId - Vehicle ID for logging
 * @returns {Promise<Object>} Call information
 */
const initiateVoipCall = async ({ callerPhone, ownerPhone, vehiclePlate, vehicleId }) => {
  try {
    // Validate phone numbers
    if (!callerPhone || !ownerPhone) {
      throw new Error('Caller and owner phone numbers are required');
    }

    // Generate unique conference name
    const conferenceName = `parkguard-${vehicleId}-${Date.now()}`;
    
    // Create TwiML for the vehicle owner
    const ownerTwiml = `<?xml version="1.0" encoding="UTF-8"?>
      <Response>
        <Say voice="alice" language="en-US">
          Hello, someone wants to contact you about your vehicle ${vehiclePlate.split('').join(' ')}. 
          Please stay on the line to be connected. Your phone number will remain private.
        </Say>
        <Dial>
          <Conference 
            startConferenceOnEnter="true" 
            endConferenceOnExit="true"
            maxParticipants="2"
            statusCallback="${process.env.API_BASE_URL}/api/contact/conference-callback"
            statusCallbackEvent="start end join leave"
            statusCallbackMethod="POST"
          >
            ${conferenceName}
          </Conference>
        </Dial>
      </Response>`;

    // Create TwiML for the caller
    const callerTwiml = `<?xml version="1.0" encoding="UTF-8"?>
      <Response>
        <Say voice="alice" language="en-US">
          Connecting you to the vehicle owner. Please wait. Your phone number will remain private.
        </Say>
        <Dial>
          <Conference 
            startConferenceOnEnter="false" 
            endConferenceOnExit="true"
            maxParticipants="2"
          >
            ${conferenceName}
          </Conference>
        </Dial>
      </Response>`;

    // Call the vehicle owner first
    const ownerCall = await client.calls.create({
      twiml: ownerTwiml,
      to: ownerPhone,
      from: process.env.TWILIO_PHONE_NUMBER,
      statusCallback: `${process.env.API_BASE_URL}/api/contact/call-status`,
      statusCallbackEvent: ['initiated', 'ringing', 'answered', 'completed'],
      statusCallbackMethod: 'POST',
      timeout: 30, // Ring for 30 seconds
      record: false // Don't record calls for privacy
    });

    console.log(`📞 Calling vehicle owner: ${ownerCall.sid}`);

    // Wait 3 seconds then call the reporter
    setTimeout(async () => {
      try {
        const callerCall = await client.calls.create({
          twiml: callerTwiml,
          to: callerPhone,
          from: process.env.TWILIO_PHONE_NUMBER,
          statusCallback: `${process.env.API_BASE_URL}/api/contact/call-status`,
          statusCallbackEvent: ['initiated', 'ringing', 'answered', 'completed'],
          statusCallbackMethod: 'POST',
          timeout: 30,
          record: false
        });

        console.log(`📞 Calling reporter: ${callerCall.sid}`);

        // Update contact log with caller SID
        await query(
          'UPDATE contact_logs SET metadata = jsonb_set(metadata, \'{callerSid}\', $1) WHERE call_sid = $2',
          [JSON.stringify(callerCall.sid), ownerCall.sid]
        );
      } catch (error) {
        console.error('Failed to call reporter:', error);
      }
    }, 3000);

    return {
      callSid: ownerCall.sid,
      status: 'initiated',
      conferenceName,
      estimatedConnectTime: '30 seconds'
    };
  } catch (error) {
    console.error('VoIP call initiation error:', error);
    throw new Error(`Failed to initiate call: ${error.message}`);
  }
};

/**
 * Get call status from Twilio
 * @param {string} callSid - Twilio call SID
 * @returns {Promise<Object>} Call status information
 */
const getCallStatus = async (callSid) => {
  try {
    const call = await client.calls(callSid).fetch();
    
    return {
      sid: call.sid,
      status: call.status,
      direction: call.direction,
      duration: call.duration,
      startTime: call.startTime,
      endTime: call.endTime,
      price: call.price,
      priceUnit: call.priceUnit
    };
  } catch (error) {
    console.error('Call status fetch error:', error);
    throw new Error(`Failed to get call status: ${error.message}`);
  }
};

/**
 * End an active call
 * @param {string} callSid - Twilio call SID
 * @returns {Promise<Object>} Updated call information
 */
const endCall = async (callSid) => {
  try {
    const call = await client.calls(callSid).update({
      status: 'completed'
    });

    return {
      sid: call.sid,
      status: call.status,
      endTime: new Date().toISOString()
    };
  } catch (error) {
    console.error('End call error:', error);
    throw new Error(`Failed to end call: ${error.message}`);
  }
};

/**
 * Get conference information
 * @param {string} conferenceSid - Twilio conference SID
 * @returns {Promise<Object>} Conference information
 */
const getConferenceInfo = async (conferenceSid) => {
  try {
    const conference = await client.conferences(conferenceSid).fetch();
    
    // Get participants
    const participants = await client.conferences(conferenceSid)
      .participants
      .list();

    return {
      sid: conference.sid,
      friendlyName: conference.friendlyName,
      status: conference.status,
      participantCount: participants.length,
      participants: participants.map(p => ({
        callSid: p.callSid,
        muted: p.muted,
        hold: p.hold,
        status: p.status
      }))
    };
  } catch (error) {
    console.error('Conference info fetch error:', error);
    throw new Error(`Failed to get conference info: ${error.message}`);
  }
};

/**
 * Send SMS notification (fallback communication method)
 * @param {Object} params - SMS parameters
 * @param {string} params.to - Recipient phone number
 * @param {string} params.message - SMS message
 * @returns {Promise<Object>} SMS information
 */
const sendSMS = async ({ to, message }) => {
  try {
    const sms = await client.messages.create({
      body: message,
      from: process.env.TWILIO_PHONE_NUMBER,
      to: to
    });

    return {
      sid: sms.sid,
      status: sms.status,
      to: sms.to,
      dateSent: sms.dateSent
    };
  } catch (error) {
    console.error('SMS send error:', error);
    throw new Error(`Failed to send SMS: ${error.message}`);
  }
};

/**
 * Verify phone number format and validity
 * @param {string} phoneNumber - Phone number to verify
 * @returns {Promise<Object>} Verification result
 */
const verifyPhoneNumber = async (phoneNumber) => {
  try {
    const lookup = await client.lookups.v1.phoneNumbers(phoneNumber).fetch();

    return {
      isValid: true,
      phoneNumber: lookup.phoneNumber,
      nationalFormat: lookup.nationalFormat,
      countryCode: lookup.countryCode,
      carrier: lookup.carrier
    };
  } catch (error) {
    return {
      isValid: false,
      error: error.message
    };
  }
};

/**
 * Create a proxy number for privacy-protected communication
 * Alternative to conference calls
 * @param {Object} params - Proxy parameters
 * @returns {Promise<Object>} Proxy information
 */
const createProxySession = async ({ callerPhone, ownerPhone, vehicleId }) => {
  try {
    // This requires Twilio Proxy service setup
    // Implementation depends on your Twilio Proxy configuration
    
    console.log('Proxy session creation not implemented. Using conference calls instead.');
    
    return {
      success: false,
      message: 'Proxy service not configured. Using conference calls.'
    };
  } catch (error) {
    console.error('Proxy session creation error:', error);
    throw new Error(`Failed to create proxy session: ${error.message}`);
  }
};

/**
 * Log call metrics for analytics
 * @param {Object} callData - Call data to log
 */
const logCallMetrics = async (callData) => {
  try {
    await query(
      `INSERT INTO call_metrics (
        call_sid, vehicle_id, duration, status, call_type, created_at
      ) VALUES ($1, $2, $3, $4, $5, CURRENT_TIMESTAMP)
      ON CONFLICT (call_sid) DO UPDATE SET
        duration = EXCLUDED.duration,
        status = EXCLUDED.status,
        updated_at = CURRENT_TIMESTAMP`,
      [
        callData.callSid,
        callData.vehicleId,
        callData.duration,
        callData.status,
        callData.callType || 'voip'
      ]
    );
  } catch (error) {
    console.error('Failed to log call metrics:', error);
  }
};

/**
 * Get call statistics
 * @param {Object} filters - Filter parameters
 * @returns {Promise<Object>} Call statistics
 */
const getCallStatistics = async (filters = {}) => {
  try {
    const { vehicleId, startDate, endDate } = filters;
    
    let whereConditions = ['1=1'];
    let queryParams = [];
    let paramIndex = 1;

    if (vehicleId) {
      whereConditions.push(`vehicle_id = $${paramIndex}`);
      queryParams.push(vehicleId);
      paramIndex++;
    }

    if (startDate) {
      whereConditions.push(`created_at >= $${paramIndex}`);
      queryParams.push(startDate);
      paramIndex++;
    }

    if (endDate) {
      whereConditions.push(`created_at <= $${paramIndex}`);
      queryParams.push(endDate);
      paramIndex++;
    }

    const result = await query(
      `SELECT 
        COUNT(*) as total_calls,
        COUNT(*) FILTER (WHERE status = 'completed') as completed_calls,
        COUNT(*) FILTER (WHERE status = 'no-answer') as missed_calls,
        COUNT(*) FILTER (WHERE status = 'busy') as busy_calls,
        AVG(duration) FILTER (WHERE duration > 0) as avg_duration,
        MAX(duration) as max_duration,
        MIN(duration) FILTER (WHERE duration > 0) as min_duration
       FROM contact_logs
       WHERE ${whereConditions.join(' AND ')}`,
      queryParams
    );

    return result.rows[0];
  } catch (error) {
    console.error('Failed to get call statistics:', error);
    throw error;
  }
};

module.exports = {
  initiateVoipCall,
  getCallStatus,
  endCall,
  getConferenceInfo,
  sendSMS,
  verifyPhoneNumber,
  createProxySession,
  logCallMetrics,
  getCallStatistics
};