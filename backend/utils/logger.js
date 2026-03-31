const pino = require('pino');

const isDev = process.env.NODE_ENV !== 'production';

/**
 * Pino Logger Initialization
 * Emits pretty logs with colors in development, structured JSON in production
 */
const logger = pino({
  level: process.env.LOG_LEVEL || (isDev ? 'debug' : 'info'),
  ...(isDev && {
    transport: {
      target: 'pino-pretty',
      options: {
        colorize: true,
        translateTime: 'SYS:standard',
        ignore: 'pid,hostname', // Keep logs clean
      },
    },
  }),
  formatters: {
    level: (label) => ({ level: label }), // Adds word (info, error) instead of pinos default int
  },
});

module.exports = logger;
