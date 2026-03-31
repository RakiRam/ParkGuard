// ===================================
// EMAIL SERVICE
// ===================================

const nodemailer = require('nodemailer');

// Create email transporter
const transporter = nodemailer.createTransporter({
  host: process.env.SMTP_HOST || 'smtp.gmail.com',
  port: parseInt(process.env.SMTP_PORT) || 587,
  secure: process.env.SMTP_SECURE === 'true', // true for 465, false for other ports
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS
  },
  tls: {
    rejectUnauthorized: process.env.NODE_ENV === 'production'
  }
});

// Verify transporter configuration
transporter.verify((error, success) => {
  if (error) {
    console.error('❌ Email service configuration error:', error);
  } else {
    console.log('✅ Email service is ready');
  }
});

/**
 * Send email
 * @param {Object} params - Email parameters
 * @param {string} params.to - Recipient email
 * @param {string} params.subject - Email subject
 * @param {string} params.html - HTML content
 * @param {string} params.text - Plain text content (optional)
 * @param {Array} params.attachments - Email attachments (optional)
 * @returns {Promise<Object>} Email result
 */
const sendEmail = async ({ to, subject, html, text = null, attachments = [] }) => {
  try {
    const mailOptions = {
      from: {
        name: 'ParkGuard',
        address: process.env.FROM_EMAIL || process.env.SMTP_USER
      },
      to,
      subject,
      html,
      text: text || html.replace(/<[^>]*>/g, ''), // Strip HTML for text version
      attachments
    };

    const info = await transporter.sendMail(mailOptions);

    console.log('📧 Email sent successfully:', {
      messageId: info.messageId,
      to,
      subject
    });

    return {
      success: true,
      messageId: info.messageId,
      response: info.response
    };
  } catch (error) {
    console.error('❌ Email send error:', error);
    throw new Error(`Failed to send email: ${error.message}`);
  }
};

/**
 * Send welcome email to new user
 * @param {Object} params - User parameters
 */
const sendWelcomeEmail = async ({ email, name }) => {
  const subject = 'Welcome to ParkGuard! 🚗';
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <title>Welcome to ParkGuard</title>
    </head>
    <body style="margin: 0; padding: 0; font-family: Arial, sans-serif; background-color: #f3f4f6;">
      <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f3f4f6; padding: 40px 20px;">
        <tr>
          <td align="center">
            <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 8px; overflow: hidden;">
              <tr>
                <td style="background-color: #2563eb; padding: 40px; text-align: center;">
                  <h1 style="margin: 0; color: #ffffff; font-size: 32px;">🚗 Welcome to ParkGuard!</h1>
                </td>
              </tr>
              <tr>
                <td style="padding: 40px;">
                  <h2 style="margin: 0 0 20px; color: #1f2937;">Hi ${name},</h2>
                  <p style="margin: 0 0 20px; color: #4b5563; line-height: 1.6;">
                    Thank you for joining ParkGuard! We're excited to help you manage your vehicle parking with ease.
                  </p>
                  <p style="margin: 0 0 20px; color: #4b5563; line-height: 1.6;">
                    With ParkGuard, you can:
                  </p>
                  <ul style="color: #4b5563; line-height: 1.8;">
                    <li>Register your vehicles and get unique QR codes</li>
                    <li>Receive instant notifications about parking incidents</li>
                    <li>Communicate privately with others about parking issues</li>
                    <li>Order custom QR stickers for your vehicles</li>
                  </ul>
                  <p style="margin: 30px 0 20px; color: #4b5563; line-height: 1.6;">
                    Get started by adding your first vehicle to your dashboard!
                  </p>
                  <table width="100%" cellpadding="0" cellspacing="0">
                    <tr>
                      <td align="center">
                        <a href="${process.env.FRONTEND_URL}/dashboard" style="display: inline-block; background-color: #2563eb; color: #ffffff; text-decoration: none; padding: 14px 32px; border-radius: 6px; font-size: 16px; font-weight: 600;">
                          Go to Dashboard
                        </a>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>
              <tr>
                <td style="background-color: #f9fafb; padding: 30px; border-top: 1px solid #e5e7eb; text-align: center;">
                  <p style="margin: 0; color: #6b7280; font-size: 14px;">
                    Need help? Contact us at <a href="mailto:support@parkguard.com" style="color: #2563eb;">support@parkguard.com</a>
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

  await sendEmail({ to: email, subject, html });
};

/**
 * Send password reset email
 * @param {Object} params - Reset parameters
 */
const sendPasswordResetEmail = async ({ email, name, resetToken }) => {
  const resetUrl = `${process.env.FRONTEND_URL}/reset-password?token=${resetToken}`;
  const subject = 'Reset Your ParkGuard Password';
  
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <title>Reset Password</title>
    </head>
    <body style="margin: 0; padding: 0; font-family: Arial, sans-serif; background-color: #f3f4f6;">
      <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f3f4f6; padding: 40px 20px;">
        <tr>
          <td align="center">
            <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 8px; overflow: hidden;">
              <tr>
                <td style="background-color: #2563eb; padding: 40px; text-align: center;">
                  <h1 style="margin: 0; color: #ffffff; font-size: 28px;">🔒 Password Reset</h1>
                </td>
              </tr>
              <tr>
                <td style="padding: 40px;">
                  <h2 style="margin: 0 0 20px; color: #1f2937;">Hi ${name},</h2>
                  <p style="margin: 0 0 20px; color: #4b5563; line-height: 1.6;">
                    We received a request to reset your password. Click the button below to create a new password:
                  </p>
                  <table width="100%" cellpadding="0" cellspacing="0" style="margin: 30px 0;">
                    <tr>
                      <td align="center">
                        <a href="${resetUrl}" style="display: inline-block; background-color: #2563eb; color: #ffffff; text-decoration: none; padding: 14px 32px; border-radius: 6px; font-size: 16px; font-weight: 600;">
                          Reset Password
                        </a>
                      </td>
                    </tr>
                  </table>
                  <p style="margin: 20px 0; color: #4b5563; line-height: 1.6;">
                    This link will expire in 1 hour for security reasons.
                  </p>
                  <p style="margin: 20px 0; color: #4b5563; line-height: 1.6;">
                    If you didn't request a password reset, please ignore this email or contact support if you have concerns.
                  </p>
                  <div style="background-color: #fef3c7; border-left: 4px solid #f59e0b; padding: 15px; margin-top: 30px;">
                    <p style="margin: 0; color: #92400e; font-size: 14px;">
                      <strong>Security tip:</strong> Never share your password with anyone.
                    </p>
                  </div>
                </td>
              </tr>
              <tr>
                <td style="background-color: #f9fafb; padding: 30px; border-top: 1px solid #e5e7eb; text-align: center;">
                  <p style="margin: 0; color: #6b7280; font-size: 14px;">
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

  await sendEmail({ to: email, subject, html });
};

/**
 * Send order confirmation email
 * @param {Object} params - Order parameters
 */
const sendOrderConfirmationEmail = async ({ email, name, orderNumber, items, total, shippingAddress }) => {
  const subject = `Order Confirmation - ${orderNumber}`;
  
  const itemsHtml = items.map(item => `
    <tr>
      <td style="padding: 10px; border-bottom: 1px solid #e5e7eb;">${item.name}</td>
      <td style="padding: 10px; border-bottom: 1px solid #e5e7eb; text-align: center;">${item.quantity}</td>
      <td style="padding: 10px; border-bottom: 1px solid #e5e7eb; text-align: right;">$${item.price.toFixed(2)}</td>
    </tr>
  `).join('');

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <title>Order Confirmation</title>
    </head>
    <body style="margin: 0; padding: 0; font-family: Arial, sans-serif; background-color: #f3f4f6;">
      <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f3f4f6; padding: 40px 20px;">
        <tr>
          <td align="center">
            <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 8px; overflow: hidden;">
              <tr>
                <td style="background-color: #10b981; padding: 40px; text-align: center;">
                  <h1 style="margin: 0; color: #ffffff; font-size: 28px;">✅ Order Confirmed!</h1>
                </td>
              </tr>
              <tr>
                <td style="padding: 40px;">
                  <h2 style="margin: 0 0 20px; color: #1f2937;">Hi ${name},</h2>
                  <p style="margin: 0 0 20px; color: #4b5563; line-height: 1.6;">
                    Thank you for your order! Your QR stickers are being prepared for shipment.
                  </p>
                  <div style="background-color: #f9fafb; padding: 20px; border-radius: 6px; margin: 30px 0;">
                    <p style="margin: 0 0 10px; color: #6b7280; font-size: 14px;">Order Number</p>
                    <p style="margin: 0; color: #1f2937; font-size: 20px; font-weight: 600;">${orderNumber}</p>
                  </div>
                  <h3 style="margin: 30px 0 15px; color: #1f2937;">Order Items</h3>
                  <table width="100%" cellpadding="0" cellspacing="0" style="border: 1px solid #e5e7eb;">
                    <thead>
                      <tr style="background-color: #f9fafb;">
                        <th style="padding: 10px; text-align: left; border-bottom: 2px solid #e5e7eb;">Item</th>
                        <th style="padding: 10px; text-align: center; border-bottom: 2px solid #e5e7eb;">Qty</th>
                        <th style="padding: 10px; text-align: right; border-bottom: 2px solid #e5e7eb;">Price</th>
                      </tr>
                    </thead>
                    <tbody>
                      ${itemsHtml}
                      <tr>
                        <td colspan="2" style="padding: 15px; text-align: right; font-weight: 600;">Total:</td>
                        <td style="padding: 15px; text-align: right; font-weight: 600; font-size: 18px; color: #2563eb;">$${total.toFixed(2)}</td>
                      </tr>
                    </tbody>
                  </table>
                  <h3 style="margin: 30px 0 15px; color: #1f2937;">Shipping Address</h3>
                  <p style="margin: 0; color: #4b5563; line-height: 1.6;">
                    ${shippingAddress.replace(/\n/g, '<br>')}
                  </p>
                  <table width="100%" cellpadding="0" cellspacing="0" style="margin-top: 30px;">
                    <tr>
                      <td align="center">
                        <a href="${process.env.FRONTEND_URL}/orders/${orderNumber}" style="display: inline-block; background-color: #2563eb; color: #ffffff; text-decoration: none; padding: 14px 32px; border-radius: 6px; font-size: 16px; font-weight: 600;">
                          Track Order
                        </a>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>
              <tr>
                <td style="background-color: #f9fafb; padding: 30px; border-top: 1px solid #e5e7eb; text-align: center;">
                  <p style="margin: 0; color: #6b7280; font-size: 14px;">
                    Questions? Contact us at <a href="mailto:support@parkguard.com" style="color: #2563eb;">support@parkguard.com</a>
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

  await sendEmail({ to: email, subject, html });
};

/**
 * Test email configuration
 * @returns {Promise<boolean>} True if successful
 */
const testEmailConfiguration = async () => {
  try {
    await transporter.verify();
    console.log('✅ Email configuration is valid');
    return true;
  } catch (error) {
    console.error('❌ Email configuration is invalid:', error);
    return false;
  }
};

module.exports = {
  sendEmail,
  sendWelcomeEmail,
  sendPasswordResetEmail,
  sendOrderConfirmationEmail,
  testEmailConfiguration
};