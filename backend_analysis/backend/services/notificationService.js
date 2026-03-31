// ===================================
// NOTIFICATION SERVICE
// ===================================

const { query } = require('../config/database');
const { sendEmail } = require('./emailService');
const { sendSMS } = require('./voipService');

/**
 * Send notification to user through multiple channels
 * @param {Object} params - Notification parameters
 * @param {string} params.userId - User ID to notify
 * @param {string} params.incidentId - Optional incident ID
 * @param {string} params.type - Notification type
 * @param {string} params.title - Notification title
 * @param {string} params.message - Notification message
 * @param {Object} params.io - Socket.IO instance for real-time notifications
 * @param {Object} params.data - Additional data to include
 * @returns {Promise<Object>} Notification result
 */
const sendNotification = async ({ 
  userId, 
  incidentId = null, 
  type, 
  title, 
  message, 
  io = null,
  data = {}
}) => {
  try {
    // Save notification to database
    const notificationResult = await query(
      `INSERT INTO notifications (user_id, incident_id, type, title, message, sent_via) 
       VALUES ($1, $2, $3, $4, $5, 'app') 
       RETURNING *`,
      [userId, incidentId, type, title, message]
    );

    const notification = notificationResult.rows[0];

    // Get user details for email/SMS
    const userResult = await query(
      'SELECT name, email, phone, is_verified FROM users WHERE id = $1 AND is_active = true',
      [userId]
    );

    if (userResult.rows.length === 0) {
      console.error('User not found for notification:', userId);
      return { success: false, error: 'User not found' };
    }

    const user = userResult.rows[0];

    // Send real-time notification via Socket.IO
    if (io) {
      try {
        io.to(`user_${userId}`).emit('notification', {
          id: notification.id,
          type: notification.type,
          title: notification.title,
          message: notification.message,
          data: data,
          createdAt: notification.created_at,
          isRead: false
        });

        console.log(`✅ Real-time notification sent to user ${userId}`);
      } catch (socketError) {
        console.error('Socket.IO notification failed:', socketError);
      }
    }

    // Send email notification
    try {
      await sendEmailNotification({
        to: user.email,
        name: user.name,
        title,
        message,
        type,
        data
      });

      // Update notification record
      await query(
        `UPDATE notifications 
         SET sent_via = array_append(sent_via::text[], 'email')
         WHERE id = $1`,
        [notification.id]
      );

      console.log(`📧 Email notification sent to ${user.email}`);
    } catch (emailError) {
      console.error('Email notification failed:', emailError);
    }

    // Send SMS notification for critical incidents
    if (shouldSendSMS(type)) {
      try {
        await sendSMSNotification({
          to: user.phone,
          message: `ParkGuard Alert: ${message}`
        });

        // Update notification record
        await query(
          `UPDATE notifications 
           SET sent_via = array_append(sent_via::text[], 'sms')
           WHERE id = $1`,
          [notification.id]
        );

        console.log(`📱 SMS notification sent to ${user.phone}`);
      } catch (smsError) {
        console.error('SMS notification failed:', smsError);
      }
    }

    return {
      success: true,
      notification,
      channels: ['app', 'email', shouldSendSMS(type) ? 'sms' : null].filter(Boolean)
    };
  } catch (error) {
    console.error('Notification service error:', error);
    throw error;
  }
};

/**
 * Send email notification
 * @param {Object} params - Email parameters
 */
const sendEmailNotification = async ({ to, name, title, message, type, data }) => {
  const emailContent = generateEmailContent({ name, title, message, type, data });
  
  await sendEmail({
    to,
    subject: title,
    html: emailContent
  });
};

/**
 * Send SMS notification
 * @param {Object} params - SMS parameters
 */
const sendSMSNotification = async ({ to, message }) => {
  // Truncate message to 160 characters for SMS
  const truncatedMessage = message.length > 160 
    ? message.substring(0, 157) + '...' 
    : message;

  await sendSMS({
    to,
    message: truncatedMessage
  });
};

/**
 * Generate HTML email content
 * @param {Object} params - Email content parameters
 * @returns {string} HTML email content
 */
const generateEmailContent = ({ name, title, message, type, data }) => {
  const iconMap = {
    'incident_report': '⚠️',
    'order_update': '📦',
    'system': 'ℹ️',
    'vehicle_added': '🚗',
    'payment_success': '✅',
    'payment_failed': '❌'
  };

  const icon = iconMap[type] || '🔔';
  const primaryColor = '#2563eb';
  const dashboardUrl = `${process.env.FRONTEND_URL}/dashboard`;

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>${title}</title>
    </head>
    <body style="margin: 0; padding: 0; font-family: Arial, sans-serif; background-color: #f3f4f6;">
      <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f3f4f6; padding: 40px 20px;">
        <tr>
          <td align="center">
            <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
              <!-- Header -->
              <tr>
                <td style="background-color: ${primaryColor}; padding: 30px 40px; text-align: center;">
                  <h1 style="margin: 0; color: #ffffff; font-size: 28px; font-weight: bold;">
                    🚗 ParkGuard
                  </h1>
                </td>
              </tr>
              
              <!-- Icon -->
              <tr>
                <td style="padding: 40px 40px 20px; text-align: center;">
                  <div style="font-size: 48px; margin-bottom: 20px;">
                    ${icon}
                  </div>
                </td>
              </tr>
              
              <!-- Content -->
              <tr>
                <td style="padding: 0 40px 40px;">
                  <h2 style="margin: 0 0 20px; color: #1f2937; font-size: 24px; font-weight: 600;">
                    ${title}
                  </h2>
                  <p style="margin: 0 0 20px; color: #4b5563; font-size: 16px; line-height: 1.6;">
                    Hello ${name},
                  </p>
                  <p style="margin: 0 0 30px; color: #4b5563; font-size: 16px; line-height: 1.6;">
                    ${message}
                  </p>
                  
                  ${data && Object.keys(data).length > 0 ? `
                    <div style="background-color: #f9fafb; border-left: 4px solid ${primaryColor}; padding: 15px 20px; margin-bottom: 30px;">
                      ${Object.entries(data).map(([key, value]) => `
                        <p style="margin: 5px 0; color: #4b5563; font-size: 14px;">
                          <strong>${formatKey(key)}:</strong> ${value}
                        </p>
                      `).join('')}
                    </div>
                  ` : ''}
                  
                  <table width="100%" cellpadding="0" cellspacing="0">
                    <tr>
                      <td align="center">
                        <a href="${dashboardUrl}" style="display: inline-block; background-color: ${primaryColor}; color: #ffffff; text-decoration: none; padding: 14px 32px; border-radius: 6px; font-size: 16px; font-weight: 600;">
                          View in Dashboard
                        </a>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>
              
              <!-- Footer -->
              <tr>
                <td style="background-color: #f9fafb; padding: 30px 40px; border-top: 1px solid #e5e7eb;">
                  <p style="margin: 0 0 10px; color: #6b7280; font-size: 14px; line-height: 1.6;">
                    This is an automated notification from ParkGuard. Please do not reply to this email.
                  </p>
                  <p style="margin: 0; color: #6b7280; font-size: 14px; line-height: 1.6;">
                    If you have any questions, please contact us at 
                    <a href="mailto:support@parkguard.com" style="color: ${primaryColor}; text-decoration: none;">
                      support@parkguard.com
                    </a>
                  </p>
                  <p style="margin: 20px 0 0; color: #9ca3af; font-size: 12px;">
                    © ${new Date().getFullYear()} ParkGuard. All rights reserved.
                  </p>
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
    </body>
    </html>
  `;
};

/**
 * Determine if SMS should be sent based on notification type
 * @param {string} type - Notification type
 * @returns {boolean}
 */
const shouldSendSMS = (type) => {
  const smsTypes = ['incident_report', 'vehicle_damage', 'urgent'];
  return smsTypes.includes(type);
};

/**
 * Format object key for display
 * @param {string} key - Object key
 * @returns {string} Formatted key
 */
const formatKey = (key) => {
  return key
    .replace(/_/g, ' ')
    .replace(/([A-Z])/g, ' $1')
    .replace(/^./, str => str.toUpperCase())
    .trim();
};

/**
 * Mark notification as read
 * @param {string} notificationId - Notification ID
 * @param {string} userId - User ID
 */
const markAsRead = async (notificationId, userId) => {
  try {
    await query(
      'UPDATE notifications SET is_read = true, updated_at = CURRENT_TIMESTAMP WHERE id = $1 AND user_id = $2',
      [notificationId, userId]
    );
  } catch (error) {
    console.error('Failed to mark notification as read:', error);
    throw error;
  }
};

/**
 * Mark all notifications as read for user
 * @param {string} userId - User ID
 */
const markAllAsRead = async (userId) => {
  try {
    await query(
      'UPDATE notifications SET is_read = true, updated_at = CURRENT_TIMESTAMP WHERE user_id = $1 AND is_read = false',
      [userId]
    );
  } catch (error) {
    console.error('Failed to mark all notifications as read:', error);
    throw error;
  }
};

/**
 * Get unread notification count for user
 * @param {string} userId - User ID
 * @returns {Promise<number>} Unread count
 */
const getUnreadCount = async (userId) => {
  try {
    const result = await query(
      'SELECT COUNT(*) as count FROM notifications WHERE user_id = $1 AND is_read = false',
      [userId]
    );
    return parseInt(result.rows[0].count);
  } catch (error) {
    console.error('Failed to get unread count:', error);
    throw error;
  }
};

/**
 * Get user's notifications
 * @param {string} userId - User ID
 * @param {Object} options - Query options
 * @returns {Promise<Array>} Notifications
 */
const getUserNotifications = async (userId, options = {}) => {
  try {
    const {
      page = 1,
      limit = 20,
      type = null,
      isRead = null
    } = options;

    const offset = (page - 1) * limit;
    let whereConditions = ['user_id = $1'];
    let queryParams = [userId];
    let paramIndex = 2;

    if (type) {
      whereConditions.push(`type = ${paramIndex}`);
      queryParams.push(type);
      paramIndex++;
    }

    if (isRead !== null) {
      whereConditions.push(`is_read = ${paramIndex}`);
      queryParams.push(isRead);
      paramIndex++;
    }

    // Get total count
    const countResult = await query(
      `SELECT COUNT(*) FROM notifications WHERE ${whereConditions.join(' AND ')}`,
      queryParams
    );

    // Get notifications
    queryParams.push(limit, offset);
    const result = await query(
      `SELECT * FROM notifications 
       WHERE ${whereConditions.join(' AND ')}
       ORDER BY created_at DESC
       LIMIT ${paramIndex} OFFSET ${paramIndex + 1}`,
      queryParams
    );

    return {
      notifications: result.rows,
      total: parseInt(countResult.rows[0].count),
      page,
      limit,
      totalPages: Math.ceil(countResult.rows[0].count / limit)
    };
  } catch (error) {
    console.error('Failed to get user notifications:', error);
    throw error;
  }
};

/**
 * Delete old notifications
 * @param {number} daysOld - Delete notifications older than this many days
 */
const deleteOldNotifications = async (daysOld = 90) => {
  try {
    const result = await query(
      `DELETE FROM notifications 
       WHERE created_at < NOW() - INTERVAL '${daysOld} days'
       RETURNING id`,
      []
    );

    console.log(`🗑️ Deleted ${result.rowCount} old notifications`);
    return result.rowCount;
  } catch (error) {
    console.error('Failed to delete old notifications:', error);
    throw error;
  }
};

/**
 * Send bulk notifications to multiple users
 * @param {Array} userIds - Array of user IDs
 * @param {Object} notificationData - Notification data
 */
const sendBulkNotifications = async (userIds, notificationData) => {
  try {
    const { type, title, message, io } = notificationData;
    
    const promises = userIds.map(userId => 
      sendNotification({
        userId,
        type,
        title,
        message,
        io
      })
    );

    const results = await Promise.allSettled(promises);
    
    const successful = results.filter(r => r.status === 'fulfilled').length;
    const failed = results.filter(r => r.status === 'rejected').length;

    console.log(`📤 Bulk notifications: ${successful} sent, ${failed} failed`);
    
    return { successful, failed };
  } catch (error) {
    console.error('Failed to send bulk notifications:', error);
    throw error;
  }
};

module.exports = {
  sendNotification,
  sendEmailNotification,
  sendSMSNotification,
  markAsRead,
  markAllAsRead,
  getUnreadCount,
  getUserNotifications,
  deleteOldNotifications,
  sendBulkNotifications
};