-- ===================================
-- PARKGUARD DATABASE SCHEMA
-- PostgreSQL 14+
-- ===================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Enable PostGIS for location data (optional)
-- CREATE EXTENSION IF NOT EXISTS postgis;

-- ===================================
-- USERS TABLE
-- ===================================
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(100) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    phone VARCHAR(20) NOT NULL,
    address TEXT,
    role VARCHAR(20) DEFAULT 'user' CHECK (role IN ('user', 'admin', 'moderator')),
    is_verified BOOLEAN DEFAULT false,
    is_active BOOLEAN DEFAULT true,
    email_verified_at TIMESTAMP,
    last_login_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for users
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_phone ON users(phone);
CREATE INDEX idx_users_role ON users(role);
CREATE INDEX idx_users_is_active ON users(is_active);

-- ===================================
-- VEHICLES TABLE
-- ===================================
CREATE TABLE IF NOT EXISTS vehicles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    type VARCHAR(50) NOT NULL CHECK (type IN ('car', 'motorcycle', 'truck', 'van', 'bus', 'other')),
    brand VARCHAR(100),
    model VARCHAR(100),
    year INTEGER CHECK (year >= 1900 AND year <= 2100),
    color VARCHAR(50),
    license_plate VARCHAR(20) UNIQUE NOT NULL,
    qr_code VARCHAR(255) UNIQUE NOT NULL,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for vehicles
CREATE INDEX idx_vehicles_user_id ON vehicles(user_id);
CREATE INDEX idx_vehicles_license_plate ON vehicles(license_plate);
CREATE INDEX idx_vehicles_qr_code ON vehicles(qr_code);
CREATE INDEX idx_vehicles_is_active ON vehicles(is_active);
CREATE INDEX idx_vehicles_type ON vehicles(type);

-- ===================================
-- QR CODE PRODUCTS TABLE
-- ===================================
CREATE TABLE IF NOT EXISTS qr_products (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(100) NOT NULL,
    description TEXT,
    price DECIMAL(10,2) NOT NULL CHECK (price >= 0),
    image_url VARCHAR(255),
    design_category VARCHAR(50),
    inventory_count INTEGER DEFAULT 0 CHECK (inventory_count >= 0),
    is_active BOOLEAN DEFAULT true,
    featured BOOLEAN DEFAULT false,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for qr_products
CREATE INDEX idx_qr_products_is_active ON qr_products(is_active);
CREATE INDEX idx_qr_products_price ON qr_products(price);
CREATE INDEX idx_qr_products_category ON qr_products(design_category);

-- ===================================
-- ORDERS TABLE
-- ===================================
CREATE TABLE IF NOT EXISTS orders (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    order_number VARCHAR(50) UNIQUE NOT NULL,
    status VARCHAR(50) DEFAULT 'pending' CHECK (status IN ('pending', 'paid', 'processing', 'shipped', 'delivered', 'cancelled', 'refunded')),
    total_amount DECIMAL(10,2) NOT NULL CHECK (total_amount >= 0),
    payment_intent_id VARCHAR(255),
    shipping_address TEXT NOT NULL,
    tracking_number VARCHAR(100),
    notes TEXT,
    shipped_at TIMESTAMP,
    delivered_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for orders
CREATE INDEX idx_orders_user_id ON orders(user_id);
CREATE INDEX idx_orders_order_number ON orders(order_number);
CREATE INDEX idx_orders_status ON orders(status);
CREATE INDEX idx_orders_created_at ON orders(created_at DESC);
CREATE INDEX idx_orders_payment_intent ON orders(payment_intent_id);

-- ===================================
-- ORDER ITEMS TABLE
-- ===================================
CREATE TABLE IF NOT EXISTS order_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    product_id UUID REFERENCES qr_products(id) ON DELETE SET NULL,
    vehicle_id UUID REFERENCES vehicles(id) ON DELETE SET NULL,
    quantity INTEGER NOT NULL DEFAULT 1 CHECK (quantity > 0),
    unit_price DECIMAL(10,2) NOT NULL CHECK (unit_price >= 0),
    product_name VARCHAR(100) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for order_items
CREATE INDEX idx_order_items_order_id ON order_items(order_id);
CREATE INDEX idx_order_items_product_id ON order_items(product_id);
CREATE INDEX idx_order_items_vehicle_id ON order_items(vehicle_id);

-- ===================================
-- INCIDENTS TABLE
-- ===================================
CREATE TABLE IF NOT EXISTS incidents (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    vehicle_id UUID NOT NULL REFERENCES vehicles(id) ON DELETE CASCADE,
    reporter_ip VARCHAR(45),
    incident_type VARCHAR(50) NOT NULL CHECK (incident_type IN ('wrong_parking', 'obstruction', 'damage', 'contact')),
    description TEXT,
    location_coords POINT,
    location_address TEXT,
    photo_url VARCHAR(255),
    status VARCHAR(50) DEFAULT 'reported' CHECK (status IN ('reported', 'acknowledged', 'resolved', 'dismissed')),
    resolved_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for incidents
CREATE INDEX idx_incidents_vehicle_id ON incidents(vehicle_id);
CREATE INDEX idx_incidents_status ON incidents(status);
CREATE INDEX idx_incidents_type ON incidents(incident_type);
CREATE INDEX idx_incidents_created_at ON incidents(created_at DESC);
CREATE INDEX idx_incidents_reporter_ip ON incidents(reporter_ip);

-- ===================================
-- NOTIFICATIONS TABLE
-- ===================================
CREATE TABLE IF NOT EXISTS notifications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    incident_id UUID REFERENCES incidents(id) ON DELETE CASCADE,
    type VARCHAR(50) NOT NULL CHECK (type IN ('incident_report', 'order_update', 'system', 'vehicle_added', 'payment_success', 'payment_failed')),
    title VARCHAR(200) NOT NULL,
    message TEXT NOT NULL,
    is_read BOOLEAN DEFAULT false,
    sent_via TEXT[] DEFAULT ARRAY['app'],
    metadata JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for notifications
CREATE INDEX idx_notifications_user_id ON notifications(user_id);
CREATE INDEX idx_notifications_incident_id ON notifications(incident_id);
CREATE INDEX idx_notifications_is_read ON notifications(is_read);
CREATE INDEX idx_notifications_type ON notifications(type);
CREATE INDEX idx_notifications_created_at ON notifications(created_at DESC);

-- ===================================
-- CONTACT LOGS TABLE
-- ===================================
CREATE TABLE IF NOT EXISTS contact_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    vehicle_id UUID NOT NULL REFERENCES vehicles(id) ON DELETE CASCADE,
    caller_ip VARCHAR(45),
    contact_type VARCHAR(50) NOT NULL CHECK (contact_type IN ('voip_call', 'sms', 'proxy_call')),
    call_sid VARCHAR(100),
    duration INTEGER DEFAULT 0,
    status VARCHAR(50),
    metadata JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for contact_logs
CREATE INDEX idx_contact_logs_vehicle_id ON contact_logs(vehicle_id);
CREATE INDEX idx_contact_logs_call_sid ON contact_logs(call_sid);
CREATE INDEX idx_contact_logs_type ON contact_logs(contact_type);
CREATE INDEX idx_contact_logs_created_at ON contact_logs(created_at DESC);

-- ===================================
-- QR SCANS TABLE (Analytics)
-- ===================================
CREATE TABLE IF NOT EXISTS qr_scans (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    vehicle_id UUID NOT NULL REFERENCES vehicles(id) ON DELETE CASCADE,
    scanner_ip VARCHAR(45),
    user_agent TEXT,
    scanned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for qr_scans
CREATE INDEX idx_qr_scans_vehicle_id ON qr_scans(vehicle_id);
CREATE INDEX idx_qr_scans_scanned_at ON qr_scans(scanned_at DESC);
CREATE INDEX idx_qr_scans_scanner_ip ON qr_scans(scanner_ip);

-- ===================================
-- CONFERENCE LOGS TABLE (VoIP Analytics)
-- ===================================
CREATE TABLE IF NOT EXISTS conference_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    conference_sid VARCHAR(100) UNIQUE NOT NULL,
    event_type VARCHAR(50),
    friendly_name VARCHAR(255),
    participants_count INTEGER DEFAULT 0,
    duration INTEGER,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for conference_logs
CREATE INDEX idx_conference_logs_sid ON conference_logs(conference_sid);
CREATE INDEX idx_conference_logs_created_at ON conference_logs(created_at DESC);

-- ===================================
-- CALL METRICS TABLE (Analytics)
-- ===================================
CREATE TABLE IF NOT EXISTS call_metrics (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    call_sid VARCHAR(100) UNIQUE NOT NULL,
    vehicle_id UUID REFERENCES vehicles(id) ON DELETE SET NULL,
    duration INTEGER DEFAULT 0,
    status VARCHAR(50),
    call_type VARCHAR(50),
    cost DECIMAL(10,4),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for call_metrics
CREATE INDEX idx_call_metrics_vehicle_id ON call_metrics(vehicle_id);
CREATE INDEX idx_call_metrics_call_sid ON call_metrics(call_sid);
CREATE INDEX idx_call_metrics_created_at ON call_metrics(created_at DESC);

-- ===================================
-- AUDIT LOGS TABLE (Security)
-- ===================================
CREATE TABLE IF NOT EXISTS audit_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    action VARCHAR(100) NOT NULL,
    resource_type VARCHAR(50),
    resource_id UUID,
    ip_address VARCHAR(45),
    user_agent TEXT,
    details JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for audit_logs
CREATE INDEX idx_audit_logs_user_id ON audit_logs(user_id);
CREATE INDEX idx_audit_logs_action ON audit_logs(action);
CREATE INDEX idx_audit_logs_resource ON audit_logs(resource_type, resource_id);
CREATE INDEX idx_audit_logs_created_at ON audit_logs(created_at DESC);

-- ===================================
-- TRIGGERS FOR UPDATED_AT
-- ===================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply trigger to all tables with updated_at column
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_vehicles_updated_at BEFORE UPDATE ON vehicles
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_qr_products_updated_at BEFORE UPDATE ON qr_products
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_orders_updated_at BEFORE UPDATE ON orders
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_incidents_updated_at BEFORE UPDATE ON incidents
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_notifications_updated_at BEFORE UPDATE ON notifications
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_contact_logs_updated_at BEFORE UPDATE ON contact_logs
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_call_metrics_updated_at BEFORE UPDATE ON call_metrics
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ===================================
-- VIEWS FOR COMMON QUERIES
-- ===================================

-- Active vehicles with owner info
CREATE OR REPLACE VIEW active_vehicles_view AS
SELECT 
    v.id,
    v.type,
    v.brand,
    v.model,
    v.year,
    v.color,
    v.license_plate,
    v.qr_code,
    v.created_at,
    u.id as user_id,
    u.name as owner_name,
    u.email as owner_email,
    u.phone as owner_phone,
    COUNT(i.id) as incident_count
FROM vehicles v
JOIN users u ON v.user_id = u.id
LEFT JOIN incidents i ON v.id = i.vehicle_id
WHERE v.is_active = true AND u.is_active = true
GROUP BY v.id, u.id;

-- Recent incidents summary
CREATE OR REPLACE VIEW recent_incidents_view AS
SELECT 
    i.id,
    i.incident_type,
    i.status,
    i.created_at,
    v.license_plate,
    v.type as vehicle_type,
    u.name as owner_name,
    u.email as owner_email
FROM incidents i
JOIN vehicles v ON i.vehicle_id = v.id
JOIN users u ON v.user_id = u.id
WHERE i.created_at > CURRENT_TIMESTAMP - INTERVAL '30 days'
ORDER BY i.created_at DESC;

-- ===================================
-- INITIAL DATA (Sample Products)
-- ===================================
INSERT INTO qr_products (name, description, price, design_category, inventory_count, featured) VALUES
('Classic Blue', 'Premium quality blue QR sticker with waterproof coating', 12.99, 'standard', 100, true),
('Metallic Silver', 'Sleek metallic silver finish with UV protection', 15.99, 'premium', 50, true),
('Neon Green', 'High visibility neon green for enhanced safety', 18.99, 'premium', 30, false),
('Premium Gold', 'Luxury gold-plated QR sticker', 24.99, 'luxury', 20, true),
('Reflective White', 'Reflective material for night visibility', 19.99, 'premium', 40, false)
ON CONFLICT DO NOTHING;

-- ===================================
-- COMMENTS FOR DOCUMENTATION
-- ===================================
COMMENT ON TABLE users IS 'User accounts and authentication';
COMMENT ON TABLE vehicles IS 'Registered vehicles with QR codes';
COMMENT ON TABLE incidents IS 'Reported parking incidents';
COMMENT ON TABLE orders IS 'QR sticker purchase orders';
COMMENT ON TABLE notifications IS 'User notifications across all channels';
COMMENT ON TABLE contact_logs IS 'VoIP call and contact attempts';
COMMENT ON TABLE qr_scans IS 'QR code scan analytics';

-- ===================================
-- CLEANUP FUNCTION
-- ===================================
CREATE OR REPLACE FUNCTION cleanup_old_data()
RETURNS void AS $
BEGIN
    -- Delete old notifications (90+ days)
    DELETE FROM notifications WHERE created_at < NOW() - INTERVAL '90 days';
    
    -- Delete old QR scans (180+ days)
    DELETE FROM qr_scans WHERE scanned_at < NOW() - INTERVAL '180 days';
    
    -- Delete old audit logs (365+ days)
    DELETE FROM audit_logs WHERE created_at < NOW() - INTERVAL '365 days';
    
    -- Delete old conference logs (90+ days)
    DELETE FROM conference_logs WHERE created_at < NOW() - INTERVAL '90 days';
    
    RAISE NOTICE 'Old data cleanup completed';
END;
$ LANGUAGE plpgsql;

-- Schedule cleanup (requires pg_cron extension)
-- SELECT cron.schedule('cleanup-old-data', '0 2 * * *', 'SELECT cleanup_old_data()');

-- ===================================
-- PERFORMANCE OPTIMIZATION
-- ===================================

-- Analyze tables for query optimization
ANALYZE users;
ANALYZE vehicles;
ANALYZE incidents;
ANALYZE orders;
ANALYZE notifications;

-- ===================================
-- END OF SCHEMA
-- ===================================