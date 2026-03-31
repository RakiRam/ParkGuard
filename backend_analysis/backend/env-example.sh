# ===================================
# PARKGUARD BACKEND - ENVIRONMENT VARIABLES
# ===================================
# Copy this file to .env and fill in your actual values

# ===================================
# APPLICATION CONFIGURATION
# ===================================
NODE_ENV=development
PORT=5000
API_BASE_URL=http://localhost:5000
FRONTEND_URL=http://localhost:3000

# ===================================
# DATABASE CONFIGURATION (PostgreSQL)
# ===================================
DB_HOST=localhost
DB_PORT=5432
DB_NAME=parkguard_db
DB_USER=parkguard_user
DB_PASSWORD=your_secure_database_password_here
DB_MAX_CONNECTIONS=20
DB_IDLE_TIMEOUT=30000
DB_CONNECTION_TIMEOUT=2000

# Enable SSL for production database
# DB_SSL=true

# ===================================
# JWT AUTHENTICATION
# ===================================
# Generate a strong secret: openssl rand -base64 32
JWT_SECRET=your_super_secure_jwt_secret_key_minimum_32_characters_long
JWT_EXPIRES_IN=7d
JWT_ISSUER=parkguard-api
JWT_AUDIENCE=parkguard-users

# ===================================
# STRIPE PAYMENT CONFIGURATION
# ===================================
# Get your keys from: https://dashboard.stripe.com/apikeys
STRIPE_SECRET_KEY=sk_test_your_stripe_secret_key_here
STRIPE_PUBLISHABLE_KEY=pk_test_your_stripe_publishable_key_here

# Webhook secret from Stripe Dashboard
# https://dashboard.stripe.com/webhooks
STRIPE_WEBHOOK_SECRET=whsec_your_webhook_secret_here

# ===================================
# TWILIO CONFIGURATION (VoIP & SMS)
# ===================================
# Get your credentials from: https://console.twilio.com/
TWILIO_ACCOUNT_SID=your_twilio_account_sid_here
TWILIO_AUTH_TOKEN=your_twilio_auth_token_here
TWILIO_PHONE_NUMBER=+1234567890

# Optional: Twilio Proxy Service SID
# TWILIO_PROXY_SERVICE_SID=your_proxy_service_sid

# ===================================
# EMAIL CONFIGURATION (SMTP)
# ===================================
# For Gmail: Use App Password (not regular password)
# Generate App Password: https://myaccount.google.com/apppasswords
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your_email@gmail.com
SMTP_PASS=your_app_specific_password_here

# Email sender details
FROM_EMAIL=notifications@parkguard.com
FROM_NAME=ParkGuard

# Alternative SMTP providers:
# SendGrid: smtp.sendgrid.net (Port 587)
# Mailgun: smtp.mailgun.org (Port 587)
# AWS SES: email-smtp.us-east-1.amazonaws.com (Port 587)

# ===================================
# AWS CONFIGURATION (Optional - for S3 uploads)
# ===================================
AWS_ACCESS_KEY_ID=your_aws_access_key_id
AWS_SECRET_ACCESS_KEY=your_aws_secret_access_key
AWS_REGION=us-east-1
AWS_S3_BUCKET=parkguard-uploads

# S3 bucket configuration
# S3_BASE_URL=https://your-bucket.s3.amazonaws.com

# ===================================
# REDIS CONFIGURATION (Optional - for caching)
# ===================================
REDIS_URL=redis://localhost:6379
REDIS_PASSWORD=
REDIS_DB=0

# Redis cluster mode (if using)
# REDIS_CLUSTER_MODE=false
# REDIS_NODES=localhost:6379,localhost:6380

# ===================================
# RATE LIMITING
# ===================================
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100

# Auth-specific rate limits
AUTH_RATE_LIMIT_WINDOW_MS=900000
AUTH_RATE_LIMIT_MAX=5

# ===================================
# FILE UPLOAD CONFIGURATION
# ===================================
MAX_FILE_SIZE=10485760
ALLOWED_FILE_TYPES=image/jpeg,image/png,image/jpg,image/webp

# ===================================
# LOGGING CONFIGURATION
# ===================================
LOG_LEVEL=info
LOG_FILE_PATH=./logs
LOG_MAX_SIZE=20m
LOG_MAX_FILES=14d

# ===================================
# SECURITY
# ===================================
# Session secret for cookies (if using sessions)
SESSION_SECRET=your_session_secret_key_here

# CORS allowed origins (comma-separated)
CORS_ORIGINS=http://localhost:3000,https://yourdomain.com

# Enable/disable security features
ENABLE_HELMET=true
ENABLE_CSRF=false

# ===================================
# NOTIFICATION SETTINGS
# ===================================
# Enable/disable notification channels
ENABLE_EMAIL_NOTIFICATIONS=true
ENABLE_SMS_NOTIFICATIONS=true
ENABLE_PUSH_NOTIFICATIONS=true

# SMS notification for incident types (comma-separated)
SMS_INCIDENT_TYPES=incident_report,damage

# ===================================
# QR CODE SETTINGS
# ===================================
QR_CODE_SIZE=300
QR_CODE_MARGIN=2
QR_CODE_ERROR_CORRECTION=M

# ===================================
# BUSINESS LOGIC SETTINGS
# ===================================
# Maximum vehicles per user
MAX_VEHICLES_PER_USER=5

# Maximum incident reports per vehicle per hour
MAX_INCIDENTS_PER_VEHICLE_HOUR=5

# Maximum VoIP calls per vehicle per hour
MAX_CALLS_PER_VEHICLE_HOUR=3

# Auto-resolve incidents after (days)
AUTO_RESOLVE_INCIDENTS_AFTER_DAYS=7

# Delete old notifications after (days)
DELETE_NOTIFICATIONS_AFTER_DAYS=90

# ===================================
# MONITORING & ANALYTICS (Optional)
# ===================================
# Sentry for error tracking
# SENTRY_DSN=your_sentry_dsn_here

# Google Analytics
# GA_TRACKING_ID=UA-XXXXXXXXX-X

# DataDog APM
# DD_API_KEY=your_datadog_api_key
# DD_SITE=datadoghq.com

# ===================================
# DEVELOPMENT SETTINGS
# ===================================
# Enable detailed error messages in development
ENABLE_DEBUG_MODE=true

# Enable SQL query logging
LOG_SQL_QUERIES=false

# Seed database with test data
SEED_TEST_DATA=false

# ===================================
# PRODUCTION SETTINGS
# ===================================
# For production, set:
# NODE_ENV=production
# ENABLE_DEBUG_MODE=false
# LOG_LEVEL=warn
# DB_SSL=true

# ===================================
# OPTIONAL INTEGRATIONS
# ===================================
# Google Maps API (for geocoding)
# GOOGLE_MAPS_API_KEY=your_google_maps_api_key

# Firebase Cloud Messaging (for push notifications)
# FCM_SERVER_KEY=your_fcm_server_key

# Cloudinary (for image optimization)
# CLOUDINARY_CLOUD_NAME=your_cloud_name
# CLOUDINARY_API_KEY=your_api_key
# CLOUDINARY_API_SECRET=your_api_secret

# ===================================
# NOTES
# ===================================
# 1. NEVER commit the .env file to version control
# 2. Use strong, unique passwords and secrets
# 3. Rotate secrets regularly in production
# 4. Use environment-specific .env files (.env.development, .env.production)
# 5. For production, consider using a secrets management service (AWS Secrets Manager, HashiCorp Vault, etc.)