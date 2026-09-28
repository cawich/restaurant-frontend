-- =======================================================
-- SAL Y LIMÓN - PostgreSQL Database Schema & Initial Seed
-- =======================================================

-- 1. SCHEMA & EXTENSIONS
CREATE SCHEMA IF NOT EXISTS "sal_limonResturant";
SET search_path TO "sal_limonResturant", public;

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 2. USERS (Admin / Manager)
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    username VARCHAR(50) UNIQUE NOT NULL,
    email VARCHAR(120) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role VARCHAR(20) DEFAULT 'admin' CHECK (role IN ('admin', 'manager', 'staff')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 3. MENU CATEGORIES
CREATE TABLE IF NOT EXISTS categories (
    id VARCHAR(50) PRIMARY KEY, -- e.g. 'desayunos', 'tacos', 'ceviches'
    name VARCHAR(100) NOT NULL,
    description TEXT,
    sort_order INT DEFAULT 0,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 4. MENU ITEMS
CREATE TABLE IF NOT EXISTS menu_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    category_id VARCHAR(50) NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
    name VARCHAR(150) NOT NULL,
    detail TEXT NOT NULL,
    price VARCHAR(30) NOT NULL, -- formatted string like '$18' or '18'
    badge VARCHAR(50),          -- e.g. 'House Specialty', 'Popular', 'Fresh Catch'
    tag VARCHAR(30),            -- e.g. 'GF', 'V', 'Spicy', 'Signature'
    image_url TEXT,
    sort_order INT DEFAULT 0,
    is_available BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 5. MEDIA & PHOTO GALLERY
CREATE TABLE IF NOT EXISTS media (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    file_name VARCHAR(255) NOT NULL,
    file_url TEXT NOT NULL,
    file_size INT,
    mime_type VARCHAR(100),
    title VARCHAR(150),
    category VARCHAR(50) DEFAULT 'gallery' CHECK (category IN ('gallery', 'dish', 'hero', 'interior')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 6. RESTAURANT SETTINGS (Key/Value store for hours, announcement, WhatsApp)
CREATE TABLE IF NOT EXISTS restaurant_settings (
    key VARCHAR(80) PRIMARY KEY,
    value TEXT NOT NULL,
    description VARCHAR(255),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 7. POS ORDERS & SALES
CREATE TABLE IF NOT EXISTS orders (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    order_number SERIAL,
    order_type VARCHAR(30) DEFAULT 'pickup' CHECK (order_type IN ('dine_in', 'pickup', 'takeout')),
    table_number VARCHAR(50) DEFAULT 'Pickup', -- e.g. 'Table 1', 'Table 5', 'Bar', 'Pickup'
    customer_name VARCHAR(100) NOT NULL,
    customer_phone VARCHAR(50),
    pickup_time VARCHAR(50),                   -- e.g. '12:30 PM' or 'In 30 mins'
    status VARCHAR(20) DEFAULT 'open' CHECK (status IN ('open', 'completed', 'cancelled')),
    payment_method VARCHAR(30) DEFAULT 'unpaid' CHECK (payment_method IN ('cash', 'card', 'cardpayment', 'transfer', 'digiwallet', 'cash_bzd', 'cash_usd', 'pay_on_pickup', 'unpaid')),
    subtotal DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    tax DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    tip DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    total DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    amount_paid DECIMAL(10,2) DEFAULT 0.00,
    change_given DECIMAL(10,2) DEFAULT 0.00,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 8. ORDER ITEMS (Line items per sale)
CREATE TABLE IF NOT EXISTS order_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    item_name VARCHAR(150) NOT NULL,
    unit_price DECIMAL(10,2) NOT NULL,
    quantity INT NOT NULL DEFAULT 1,
    subtotal DECIMAL(10,2) NOT NULL,
    notes VARCHAR(255),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- INDEXES
CREATE INDEX IF NOT EXISTS idx_menu_items_cat ON menu_items(category_id);
CREATE INDEX IF NOT EXISTS idx_menu_items_available ON menu_items(is_available);
CREATE INDEX IF NOT EXISTS idx_media_category ON media(category);
CREATE INDEX IF NOT EXISTS idx_orders_created ON orders(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
CREATE INDEX IF NOT EXISTS idx_order_items_order ON order_items(order_id);

-- =======================================================
-- INITIAL SEED DATA
-- =======================================================

-- Default Settings
INSERT INTO restaurant_settings (key, value, description) VALUES
('restaurant_name', 'Sal y Limón', 'Official restaurant title'),
('announcement_text', '📍 San Narciso Village, Corozal District, Belize • Open Tue – Sun: 11:00 AM – 10:00 PM', 'Top announcement ticker text'),
('phone_number', '+501 636-2275', 'Primary contact phone number'),
('whatsapp_number', '5016362275', 'WhatsApp digits for direct messaging link'),
('opening_hours', 'Tue – Sun: 11:00 AM – 10:00 PM | Monday: Closed', 'Hours display'),
('address', 'Philip Goldson Highway, 7th Block, San Narciso Village, Corozal District, Belize', 'Full address')
ON CONFLICT (key) DO NOTHING;

-- Initial Categories
INSERT INTO categories (id, name, description, sort_order) VALUES
('desayunos', 'Desayunos', 'Served daily from 11:00 AM — fresh, hearty Mexican breakfast classics.', 1),
('tacos', 'Tacos', 'Hand-pressed corn tortillas, made to order and served with house lime and salsas.', 2),
('ceviches', 'Ceviches', 'Caught fresh along the coast, cured in fresh lime juice with crisp herbs.', 3),
('para-compartir', 'Para compartir', 'Generous sharing platters made for passing around the table with friends and family.', 4),
('postres-bebidas', 'Postres & bebidas', 'Handcrafted agave cocktails, chilled fruit aguas, and decadent homemade sweets.', 5)
ON CONFLICT (id) DO NOTHING;

-- Initial Menu Items
INSERT INTO menu_items (category_id, name, detail, price, badge, tag, sort_order) VALUES
('desayunos', 'Huevos con chaya', 'farm eggs, sautéed wild chaya greens, refried black beans, handmade corn tortillas', '$12', 'Local Favorite', 'GF', 1),
('desayunos', 'Huevos rancheros', 'crisp corn tostadas, sunny eggs, charred ranchera salsa, queso fresco, avocado', '$13', 'Popular', 'GF', 2),
('desayunos', 'Omelette del campo', 'wild mushrooms, baby spinach, melted Oaxaca cheese, served with house citrus salad', '$14', NULL, 'V', 3),
('desayunos', 'Waffle sandwich', 'golden Belgian waffle, smoked thick-cut bacon, fried egg, pure Belizean maple syrup', '$13', NULL, NULL, 4),

('tacos', 'Tacos de birria', '12-hour braised beef shank, melted cheese, cilantro, white onion, rich dipping consommé', '$18', 'House Specialty', NULL, 1),
('tacos', 'Tacos al pastor', 'achiote-marinated pork, roasted pineapple relish, fresh cilantro, salsa verde', '$16', 'Popular', 'GF', 2),
('tacos', 'Tacos de camarón', 'crispy spiced Caribbean shrimp, shaved purple cabbage, chipotle crema, pico de gallo', '$17', 'Fresh Catch', NULL, 3),
('tacos', 'Quesabirria dorada', 'crispy grilled tortilla, melted quesillo, shredded beef, cilantro, scallion broth', '$16', NULL, 'Signature', 4),

('ceviches', 'Ceviche clásico', 'fresh local white fish, key lime, red onion, habanero essence, fresh cilantro, totopos', '$17', 'Chef''s Catch', 'GF', 1),
('ceviches', 'Ceviche de camarón', 'poached Caribbean shrimp, Roma tomato, English cucumber, Hass avocado, heirloom tortilla chips', '$18', NULL, 'GF', 2),
('ceviches', 'Aguachile verde', 'butterflied shrimp, blended serrano & lime juice, shaved red onion, chilled cucumber', '$19', 'Spicy 🌶️', 'Spicy', 3),

('para-compartir', 'Guacamole de la casa', 'hand-mashed Hass avocado, charred jalapeño, lime, pico de gallo, warm sea-salt chips', '$11', 'Must Try', 'V', 1),
('para-compartir', 'Nachos supremos', 'black beans, melted artisanal cheese blend, pickled jalapeño, crema, fire-roasted salsa', '$15', NULL, 'V', 2),
('para-compartir', 'Mariscada fría', 'chilled citrus seafood cocktail, calamari, shrimp, fresh lime, avocado, artisanal tostadas', '$20', 'Signature', 'GF', 3),

('postres-bebidas', 'Tres leches artesanal', 'sponge cake soaked in three-milk infusion, fresh whipped Chantilly, seasonal tropical fruit', '$9', 'House Dessert', NULL, 1),
('postres-bebidas', 'Churros dorados', 'piping hot cinnamon-sugar pastries with warm spiced Mexican dark chocolate dipping sauce', '$8', 'Popular', NULL, 2),
('postres-bebidas', 'Margarita clásica', '100% blue agave tequila, freshly pressed Persian lime, organic agave nectar, sea salt rim', '$12', 'Top Cocktail', NULL, 3),
('postres-bebidas', 'Agua fresca del día', 'daily fresh seasonal fruit (watermelon, hibiscus, or pineapple), lime, touch of cane sugar', '$6', NULL, 'V', 4)
ON CONFLICT DO NOTHING;

-- Initial Media
INSERT INTO media (file_name, file_url, title, category) VALUES
('restaurant-interior.jpg', '/restaurant-interior.jpg', 'Bistro Tables', 'interior'),
('restaurant-sign.jpg', '/restaurant-sign.jpg', 'San Narciso Village Entrance', 'interior'),
('menu.jpg', '/menu.jpg', 'Handmade Dishes & Drinks', 'dish')
ON CONFLICT DO NOTHING;
