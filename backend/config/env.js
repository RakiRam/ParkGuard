const Joi = require('joi');

const envSchema = Joi.object({
  // General
  NODE_ENV: Joi.string().valid('development', 'production', 'test').default('development'),
  PORT: Joi.number().default(5000),
  FRONTEND_URL: Joi.string().uri().required(),

  // Database
  DB_USER: Joi.string().required(),
  DB_HOST: Joi.string().required(),
  DB_NAME: Joi.string().required(),
  DB_PASSWORD: Joi.string().required(),
  DB_PORT: Joi.number().default(5432),

  // JWT
  JWT_SECRET: Joi.string().min(32).required()
    .messages({ 'string.min': 'JWT_SECRET must be at least 32 characters long for security' }),
  JWT_EXPIRES_IN: Joi.string().default('7d'),

  // Rate Limiting
  RATE_LIMIT_WINDOW_MS: Joi.number().default(900000), // 15 min
  RATE_LIMIT_MAX_REQUESTS: Joi.number().default(300),

  // External APIs (Optional)
  STRIPE_SECRET_KEY: Joi.string().optional(),
  STRIPE_WEBHOOK_SECRET: Joi.string().optional(),

  TWILIO_ACCOUNT_SID: Joi.string().optional(),
  TWILIO_AUTH_TOKEN: Joi.string().optional(),
  TWILIO_PHONE_NUMBER: Joi.string().optional(),

  SMTP_HOST: Joi.string().optional(),
  SMTP_PORT: Joi.number().optional(),
  SMTP_USER: Joi.string().optional(),
  SMTP_PASS: Joi.string().optional(),
}).unknown();

const { error, value: envVars } = envSchema.validate(process.env, {
  abortEarly: false // Show all validation errors at once
});

if (error) {
  console.error('\n🚨 FATAL ERROR: Invalid Environment Configuration!\n');
  error.details.forEach((err) => {
    console.error(`- ${err.message}`);
  });
  console.error('\nPlease fix the above environment variables and restart the server.\n');
  process.exit(1); 
}

module.exports = envVars;
