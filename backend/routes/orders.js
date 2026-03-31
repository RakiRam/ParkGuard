const express = require('express');
const { query } = require('../config/database');
const { asyncHandler, createError } = require('../middleware/errorHandler');
const { authenticateToken } = require('../middleware/auth');
const env = require('../config/env');
const logger = require('../utils/logger');
const { v4: uuidv4 } = require('uuid');

let stripe = null;
if (env.STRIPE_SECRET_KEY && env.STRIPE_SECRET_KEY !== 'sk_test_...') {
  try {
    stripe = require('stripe')(env.STRIPE_SECRET_KEY);
  } catch (e) {
    logger.warn({ err: e }, "Stripe init failed, falling back to mock mode");
  }
}

const router = express.Router();

router.post('/create-checkout', authenticateToken, asyncHandler(async (req, res) => {
  const { items } = req.body;
  if (!items || !items.length) throw createError('Items are required for checkout', 400);

  const orderId = uuidv4();
  const amount = items.reduce((acc, item) => acc + (item.price * item.quantity), 0);

  await query(
    `INSERT INTO orders (id, user_id, total_amount, status) VALUES ($1, $2, $3, 'pending')`,
    [orderId, req.user.id, amount]
  );

  if (!stripe) {
    return res.json({
      success: true,
      message: 'Checkout session created (MOCKED)',
      data: {
        url: `${env.FRONTEND_URL}/shop?mock_checkout=${orderId}`,
        orderId
      }
    });
  }

  const session = await stripe.checkout.sessions.create({
    payment_method_types: ['card'],
    line_items: items.map(p => ({
      price_data: {
        currency: 'usd',
        product_data: { name: p.name },
        unit_amount: p.price * 100, 
      },
      quantity: p.quantity,
    })),
    mode: 'payment',
    success_url: `${env.FRONTEND_URL}/shop/success?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${env.FRONTEND_URL}/shop`,
    client_reference_id: req.user.id,
    metadata: { orderId }
  });

  res.json({ success: true, data: { url: session.url, sessionId: session.id } });
}));

router.get('/my-orders', authenticateToken, asyncHandler(async (req, res) => {
  const result = await query('SELECT * FROM orders WHERE user_id = $1 ORDER BY created_at DESC', [req.user.id]);
  res.json({ success: true, data: { orders: result.rows } });
}));

router.post('/mock-success/:id', authenticateToken, asyncHandler(async (req, res) => {
  const { id } = req.params;
  const result = await query(
    `UPDATE orders SET status = 'completed', updated_at = CURRENT_TIMESTAMP WHERE id = $1 AND user_id = $2 RETURNING *`,
    [id, req.user.id]
  );
  if (result.rowCount === 0) throw createError('Order not found', 404);
  res.json({ success: true, message: 'Order completed (MOCKED)', data: { order: result.rows[0] } });
}));

// Webhook for Stripe - Exclusively uses express.raw instead of default body parser
router.post('/webhook', express.raw({ type: 'application/json' }), asyncHandler(async (req, res) => {
  if (!stripe) return res.send("Stripe mock active");

  const sig = req.headers['stripe-signature'];
  let event;

  try {
    event = stripe.webhooks.constructEvent(req.body, sig, env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    logger.error({ err }, 'Webhook signature verification failed');
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object;
    const orderId = session.metadata.orderId;
    
    // Protection against duplicate processing via constraint verification
    const updateRes = await query(
      `UPDATE orders SET status = 'completed', updated_at = CURRENT_TIMESTAMP WHERE id = $1 AND status = 'pending' RETURNING id`,
      [orderId]
    );

    if (updateRes.rowCount > 0) {
      logger.info({ orderId }, 'Stripe Checkout processing completed successfully');
    } else {
      logger.warn({ orderId, eventId: event.id }, 'Stripe Webhook fired recursively for completed order. Ignored duplicate request.');
    }
  }

  res.status(200).send();
}));

module.exports = router;
