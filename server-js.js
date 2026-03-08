// ===================================
// PARKGUARD BACKEND - MAIN SERVER
// ===================================

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const compression = require('compression');
const morgan = require('morgan');
const { createServer } = require('http');
const { Server } = require('socket.io');
const swaggerUi = require('swagger-ui-express');
const swaggerJsdoc = require('swagger-jsdoc');

// Import routes
const authRoutes = require('./routes/auth');
const vehicleRoutes = require('./routes/vehicles');
const qrCodeRoutes = require('./routes/qrCodes');
const incidentRoutes = require('./routes/incidents');
const orderRoutes = require('./routes/orders');
const adminRoutes = require('./routes/admin');
const contactRoutes = require('./routes/contact');

// Import middleware
const authenticateToken = require('./middleware/auth');
const errorHandler = require('./middleware/errorHandler');

// Initialize Express app
const app = express();
const server = createServer(app);
const io = new Server(server, {
  cors: {
    origin: process.env.FRONTEND_URL || "http://localhost:3000",
    methods: ["GET", "POST"]
  }
});

// ===================================
// MIDDLEWARE CONFIGURATION
// ===================================

// Security middleware
app.use(helmet());
app.use(cors({
  origin: process.env.FRONTEND_URL || "http://localhost:3000",
  credentials: true
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000, // 15 minutes
  max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 100,
  message: {
    success: false,
    message: 'Too many requests from this IP, please try again later.'
  }
});
app.use(limiter);

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Compression and logging
app.use(compression());
app.use(morgan('combined'));

// Make io accessible to routes
app.use((req, res, next) => {
  req.io = io;
  next();
});

// ===================================
// SWAGGER API DOCUMENTATION
// ===================================

const swaggerOptions = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'ParkGuard API',
      version: '1.0.0',
      description: 'Smart Vehicle Parking Solutions API',
      contact: {
        name: 'ParkGuard Support',
        email: 'support@parkguard.com'
      },
      license: {
        name: 'MIT',
        url: 'https://opensource.org/licenses/MIT'
      }
    },
    servers: [
      {
        url: process.env.API_BASE_URL || 'http://localhost:5000',
        description: 'Development server'
      }
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT'
        }
      }
    }
  },
  apis: ['./routes/*.js', './models/*.js']
};

const specs = swaggerJsdoc(swaggerOptions);
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(specs, {
  explorer: true,
  customCss: '.swagger-ui .topbar { display: none }'
}));

// ===================================
// ROUTES
// ===================================

app.use('/api/auth', authRoutes);
app.use('/api/vehicles', authenticateToken, vehicleRoutes);
app.use('/api/qr-codes', qrCodeRoutes);
app.use('/api/incidents', incidentRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/contact', contactRoutes);
app.use('/api/admin', authenticateToken, adminRoutes);

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV,
    version: process.env.npm_package_version || '1.0.0'
  });
});

// Root endpoint
app.get('/', (req, res) => {
  res.json({
    message: 'ParkGuard API Server',
    documentation: `${req.protocol}://${req.get('host')}/api-docs`,
    health: `${req.protocol}://${req.get('host')}/api/health`
  });
});

// ===================================
// SOCKET.IO FOR REAL-TIME NOTIFICATIONS
// ===================================

io.on('connection', (socket) => {
  console.log(`🔌 User connected: ${socket.id}`);

  // Join user to their personal room
  socket.on('join-user-room', (userId) => {
    socket.join(`user_${userId}`);
    console.log(`👤 User ${userId} joined their room`);
    
    // Send confirmation
    socket.emit('room-joined', {
      message: 'Successfully joined notification room',
      userId
    });
  });

  // Handle disconnection
  socket.on('disconnect', (reason) => {
    console.log(`❌ User disconnected: ${socket.id} - ${reason}`);
  });

  // Handle ping for connection health
  socket.on('ping', (callback) => {
    callback('pong');
  });
});

// Export io for use in other modules
global.io = io;

// ===================================
// ERROR HANDLING
// ===================================

app.use(errorHandler);

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    message: 'API endpoint not found',
    path: req.originalUrl,
    method: req.method
  });
});

// ===================================
// SERVER STARTUP
// ===================================

const PORT = process.env.PORT || 5000;

server.listen(PORT, () => {
  console.log(`🚀 ParkGuard API Server running on port ${PORT}`);
  console.log(`📚 API Documentation: http://localhost:${PORT}/api-docs`);
  console.log(`🏥 Health Check: http://localhost:${PORT}/api/health`);
  console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully');
  server.close(() => {
    console.log('Process terminated');
  });
});

process.on('SIGINT', () => {
  console.log('SIGINT received, shutting down gracefully');
  server.close(() => {
    console.log('Process terminated');
  });
});

// Handle unhandled rejections
process.on('unhandledRejection', (err, promise) => {
  console.error('Unhandled Promise Rejection:', err.message);
  server.close(() => {
    process.exit(1);
  });
});

module.exports = { app, server, io };