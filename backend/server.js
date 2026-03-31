// ===================================
// PARKGUARD BACKEND - MAIN SERVER
// ===================================

require('dotenv').config();
const env = require('./config/env'); // Triggers Joi validation on start
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const compression = require('compression');
const pinoHttp = require('pino-http');
const { createServer } = require('http');
const { Server } = require('socket.io');
const swaggerUi = require('swagger-ui-express');
const swaggerJsdoc = require('swagger-jsdoc');
const logger = require('./utils/logger');
const { pool } = require('./config/database');

// Import routes
const authRoutes = require('./routes/auth');
const vehicleRoutes = require('./routes/vehicles');
const qrCodeRoutes = require('./routes/qrCodes');
const incidentRoutes = require('./routes/incidents');
const orderRoutes = require('./routes/orders');
const adminRoutes = require('./routes/admin');
const contactRoutes = require('./routes/contact');

// Import middleware
const { authenticateToken } = require('./middleware/auth');
const { errorHandler } = require('./middleware/errorHandler');

// Initialize Express app
const app = express();
const server = createServer(app);
const io = new Server(server, {
  cors: {
    origin: env.FRONTEND_URL,
    methods: ["GET", "POST"]
  }
});

// ===================================
// MIDDLEWARE CONFIGURATION
// ===================================

// Security middleware
app.use(helmet({ contentSecurityPolicy: false })); // Disabled strict CSP to avoid breaking frontend per spec
app.use(cors({
  origin: env.FRONTEND_URL,
  credentials: true
}));

// Rate limiting configurations
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, 
  max: 300, 
  message: { success: false, message: 'Too many requests from this IP, please try again later.' }
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, 
  max: 15, // Stricter auth limit
  message: { success: false, message: 'Too many login attempts, please try again later.' }
});

const incidentLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, 
  max: 60, // 60 incidents per hour limit
  message: { success: false, message: 'Incident limit reached, please wait.' }
});

// Body parsing middleware (Hardened to 1mb limit per spec, except for stripe webhook which might need raw body handled separately in orders.js)
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));

// Compression and structured logging
app.use(compression());
app.use(pinoHttp({ logger, autoLogging: { ignore: (req) => req.url === '/api/health' } }));

// Make io accessible to routes
app.use((req, res, next) => {
  req.io = io;
  next();
});

// ===================================
// ROUTE REGISTRATION & LIMITERS
// ===================================

// Apply specific limiters to specific scopes
app.use('/api/auth', authLimiter, authRoutes);
app.use('/api/incidents', incidentLimiter, incidentRoutes);

// Apply global limits to remaining /api routes (but safely after specific limiters)
app.use('/api/', globalLimiter);
app.use('/api/vehicles', authenticateToken, vehicleRoutes);
app.use('/api/qr-codes', qrCodeRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/contact', contactRoutes);
app.use('/api/admin', authenticateToken, adminRoutes);

// ===================================
// SWAGGER API DOCUMENTATION
// ===================================

const swaggerOptions = {
  definition: {
    openapi: '3.0.0',
    info: { title: 'ParkGuard API', version: '1.0.0' },
    servers: [{ url: `http://localhost:${env.PORT}` }]
  },
  apis: ['./routes/*.js']
};
const specs = swaggerJsdoc(swaggerOptions);
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(specs));

// ===================================
// HEALTH & READINESS ENDPOINTS
// ===================================

// Basic server status
app.get('/api/health', (req, res) => {
  res.status(200).json({ status: 'OK', uptime: process.uptime(), version: '1.0.0' });
});

// Deep readiness check verifying DB connection
app.get('/api/ready', async (req, res) => {
  try {
    await pool.query('SELECT 1');
    res.status(200).json({ status: 'READY', message: 'Database online' });
  } catch (error) {
    logger.error({ err: error }, 'Readiness check failed');
    res.status(503).json({ status: 'UNAVAILABLE', message: 'Database disconnected' });
  }
});

// ===================================
// SOCKET.IO FOR REAL-TIME NOTIFICATIONS
// ===================================

io.on('connection', (socket) => {
  logger.info(`🔌 User connected: ${socket.id}`);
  socket.on('join-user-room', (userId) => {
    socket.join(`user_${userId}`);
    logger.info(`👤 User ${userId} joined their room`);
  });
  socket.on('disconnect', (reason) => {
    logger.info(`❌ User disconnected: ${socket.id} - ${reason}`);
  });
});
global.io = io;

// ===================================
// ERROR HANDLING
// ===================================

// Expose standard errorHandler centrally
app.use(errorHandler);

app.use('*', (req, res) => {
  res.status(404).json({ success: false, message: 'API endpoint not found', path: req.originalUrl });
});

// ===================================
// SERVER STARTUP
// ===================================

server.listen(env.PORT, () => {
  logger.info(`🚀 ParkGuard API Server running on port ${env.PORT}`);
});

process.on('SIGTERM', () => {
  logger.info('SIGTERM received, shutting down gracefully');
  server.close(() => process.exit(0));
});

process.on('SIGINT', () => {
  logger.info('SIGINT received, shutting down gracefully');
  server.close(() => process.exit(0));
});

process.on('unhandledRejection', (err) => {
  logger.fatal({ err }, 'Unhandled Promise Rejection');
  server.close(() => process.exit(1));
});

module.exports = { app, server, io };