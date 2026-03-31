const express = require('express');
const { query } = require('../config/database');
const { asyncHandler } = require('../middleware/errorHandler');
const { requireAdmin } = require('../middleware/auth');

const router = express.Router();

// Get system stats
router.get('/stats', requireAdmin, asyncHandler(async (req, res) => {
  const usersCount = await query('SELECT COUNT(*) FROM users');
  const vehiclesCount = await query('SELECT COUNT(*) FROM vehicles');
  const incidentsCount = await query('SELECT COUNT(*) FROM incidents');
  const ordersCount = await query('SELECT COUNT(*) FROM orders');

  res.json({
    success: true,
    data: {
      users: parseInt(usersCount.rows[0].count),
      vehicles: parseInt(vehiclesCount.rows[0].count),
      incidents: parseInt(incidentsCount.rows[0].count),
      orders: parseInt(ordersCount.rows[0].count)
    }
  });
}));

// Get all users
router.get('/users', requireAdmin, asyncHandler(async (req, res) => {
  const result = await query(
    'SELECT id, name, email, phone, role, is_active, is_verified, created_at FROM users ORDER BY created_at DESC'
  );
  res.json({ success: true, data: result.rows });
}));

// Block user
router.put('/users/:id/block', requireAdmin, asyncHandler(async (req, res) => {
  const { id } = req.params;
  const result = await query(
    'UPDATE users SET is_active = false, updated_at = CURRENT_TIMESTAMP WHERE id = $1 RETURNING id, is_active',
    [id]
  );
  if (result.rowCount === 0) return res.status(404).json({ success: false, message: 'User not found' });
  res.json({ success: true, data: result.rows[0] });
}));

// Unblock user
router.put('/users/:id/unblock', requireAdmin, asyncHandler(async (req, res) => {
  const { id } = req.params;
  const result = await query(
    'UPDATE users SET is_active = true, updated_at = CURRENT_TIMESTAMP WHERE id = $1 RETURNING id, is_active',
    [id]
  );
  if (result.rowCount === 0) return res.status(404).json({ success: false, message: 'User not found' });
  res.json({ success: true, data: result.rows[0] });
}));

module.exports = router;
