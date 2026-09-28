import pg from 'pg';
import { menuCategories as defaultMenuCategories, type MenuCategory, type MenuItem } from '../data/menu';

const { Pool } = pg;

// Read database URL from process.env
const connectionString = process.env.DATABASE_URL || 'postgres://postgres:password@localhost:5432/sal_limon';

let pool: pg.Pool | null = null;
let isConnected = false;

function getPool(): pg.Pool {
  if (!pool) {
    pool = new Pool({
      connectionString,
      connectionTimeoutMillis: 3000,
      ssl: process.env.NODE_ENV === 'production' && !connectionString.includes('localhost')
        ? { rejectUnauthorized: false }
        : false,
    });

    pool.on('connect', (client) => {
      client.query('SET search_path TO "sal_limonResturant", public').catch((err) => {
        console.warn('⚠️ [Schema warning]: Could not set search_path to "sal_limonResturant"', err.message);
      });
    });

    pool.on('error', (err) => {
      console.warn('⚠️ [PostgreSQL Pool Error]:', err.message);
      isConnected = false;
    });
  }
  return pool;
}

// In-memory fallback if DB is not yet running
let memoryCategories: MenuCategory[] = JSON.parse(JSON.stringify(defaultMenuCategories));

export interface DbMenuItem extends MenuItem {
  id?: string;
  category_id?: string;
  image_url?: string;
  is_available?: boolean;
}

export interface DbMedia {
  id: string;
  file_name: string;
  file_url: string;
  file_size?: number;
  mime_type?: string;
  title?: string;
  category: 'gallery' | 'dish' | 'hero' | 'interior';
  created_at?: string;
}

/**
 * Test DB Connection status
 */
export async function checkDbConnection(): Promise<boolean> {
  try {
    const client = await getPool().connect();
    await client.query('SELECT 1');
    client.release();
    isConnected = true;
    return true;
  } catch (err: any) {
    isConnected = false;
    return false;
  }
}

/**
 * Get all menu categories with items
 */
export async function getMenuCategories(): Promise<MenuCategory[]> {
  try {
    const dbAvailable = await checkDbConnection();
    if (!dbAvailable) {
      return memoryCategories;
    }

    const catRes = await getPool().query(
      'SELECT id, name, description, sort_order FROM categories WHERE is_active = true ORDER BY sort_order ASC, name ASC'
    );

    const itemRes = await getPool().query(
      'SELECT id, category_id, name, detail, price, badge, tag, image_url, sort_order, is_available FROM menu_items WHERE is_available = true ORDER BY sort_order ASC, name ASC'
    );

    const itemsByCat = new Map<string, MenuItem[]>();
    for (const row of itemRes.rows) {
      if (!itemsByCat.has(row.category_id)) {
        itemsByCat.set(row.category_id, []);
      }
      itemsByCat.get(row.category_id)!.push({
        name: row.name,
        detail: row.detail,
        price: row.price,
        badge: row.badge || undefined,
        tag: row.tag || undefined,
      });
    }

    const categories: MenuCategory[] = catRes.rows.map((cat: any) => ({
      id: cat.id,
      name: cat.name,
      description: cat.description || undefined,
      items: itemsByCat.get(cat.id) || [],
    }));

    return categories.length > 0 ? categories : memoryCategories;
  } catch (err: any) {
    console.warn('⚠️ [getMenuCategories fallback]:', err.message);
    return memoryCategories;
  }
}

/**
 * Get all raw menu items for the Admin Dashboard
 */
export async function getAdminMenuItems(): Promise<DbMenuItem[]> {
  try {
    const dbAvailable = await checkDbConnection();
    if (!dbAvailable) {
      // Flatten memory categories
      const list: DbMenuItem[] = [];
      memoryCategories.forEach(c => {
        c.items.forEach((item, idx) => {
          list.push({
            id: `${c.id}-${idx}`,
            category_id: c.id,
            name: item.name,
            detail: item.detail,
            price: item.price,
            badge: item.badge,
            tag: item.tag,
            is_available: true,
          });
        });
      });
      return list;
    }

    const res = await getPool().query(`
      SELECT m.id, m.category_id, m.name, m.detail, m.price, m.badge, m.tag, m.image_url, m.sort_order, m.is_available,
             c.name as category_name
      FROM menu_items m
      JOIN categories c ON m.category_id = c.id
      ORDER BY c.sort_order ASC, m.sort_order ASC, m.name ASC
    `);
    return res.rows;
  } catch (err: any) {
    console.warn('⚠️ [getAdminMenuItems fallback]:', err.message);
    return [];
  }
}

/**
 * Add a new Menu Item
 */
export async function addMenuItem(item: {
  category_id: string;
  name: string;
  detail: string;
  price: string;
  badge?: string;
  tag?: string;
  image_url?: string;
}): Promise<any> {
  const dbAvailable = await checkDbConnection();
  if (!dbAvailable) {
    // Save to memory
    const cat = memoryCategories.find(c => c.id === item.category_id);
    if (cat) {
      const newItem: MenuItem = {
        name: item.name,
        detail: item.detail,
        price: item.price,
        badge: item.badge,
        tag: item.tag as any,
      };
      cat.items.push(newItem);
      return { success: true, item: newItem, storage: 'memory' };
    }
    throw new Error('Category not found');
  }

  const res = await getPool().query(
    `INSERT INTO menu_items (category_id, name, detail, price, badge, tag, image_url)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING *`,
    [item.category_id, item.name, item.detail, item.price, item.badge || null, item.tag || null, item.image_url || null]
  );
  return { success: true, item: res.rows[0], storage: 'database' };
}

/**
 * Update an existing Menu Item
 */
export async function updateMenuItem(id: string, updates: {
  category_id?: string;
  name?: string;
  detail?: string;
  price?: string;
  badge?: string;
  tag?: string;
  is_available?: boolean;
}): Promise<any> {
  const dbAvailable = await checkDbConnection();
  if (!dbAvailable) {
    // In-memory update
    for (const c of memoryCategories) {
      const found = c.items.find(i => i.name === id || `${c.id}-${i.name}` === id);
      if (found) {
        if (updates.name) found.name = updates.name;
        if (updates.detail) found.detail = updates.detail;
        if (updates.price) found.price = updates.price;
        if (updates.badge !== undefined) found.badge = updates.badge || undefined;
        if (updates.tag !== undefined) found.tag = (updates.tag as any) || undefined;
        return { success: true, item: found, storage: 'memory' };
      }
    }
    return { success: true, storage: 'memory' };
  }

  const fields: string[] = [];
  const values: any[] = [];
  let idx = 1;

  if (updates.category_id !== undefined) { fields.push(`category_id = $${idx++}`); values.push(updates.category_id); }
  if (updates.name !== undefined) { fields.push(`name = $${idx++}`); values.push(updates.name); }
  if (updates.detail !== undefined) { fields.push(`detail = $${idx++}`); values.push(updates.detail); }
  if (updates.price !== undefined) { fields.push(`price = $${idx++}`); values.push(updates.price); }
  if (updates.badge !== undefined) { fields.push(`badge = $${idx++}`); values.push(updates.badge || null); }
  if (updates.tag !== undefined) { fields.push(`tag = $${idx++}`); values.push(updates.tag || null); }
  if (updates.is_available !== undefined) { fields.push(`is_available = $${idx++}`); values.push(updates.is_available); }

  fields.push(`updated_at = CURRENT_TIMESTAMP`);
  values.push(id);

  const query = `UPDATE menu_items SET ${fields.join(', ')} WHERE id = $${idx} RETURNING *`;
  const res = await getPool().query(query, values);
  return { success: true, item: res.rows[0], storage: 'database' };
}

/**
 * Delete a Menu Item
 */
export async function deleteMenuItem(id: string): Promise<boolean> {
  const dbAvailable = await checkDbConnection();
  if (!dbAvailable) {
    memoryCategories.forEach(c => {
      c.items = c.items.filter(i => i.name !== id && `${c.id}-${i.name}` !== id);
    });
    return true;
  }

  await getPool().query('DELETE FROM menu_items WHERE id = $1', [id]);
  return true;
}

/**
 * Get all media items
 */
let memoryMedia: DbMedia[] = [
  { id: '1', file_name: 'restaurant-interior.jpg', file_url: '/restaurant-interior.jpg', title: 'Bistro Tables', category: 'interior' },
  { id: '2', file_name: 'restaurant-sign.jpg', file_url: '/restaurant-sign.jpg', title: 'San Narciso Sign', category: 'interior' },
  { id: '3', file_name: 'menu.jpg', file_url: '/menu.jpg', title: 'Fresh Signature Dishes', category: 'dish' },
  { id: '4', file_name: 'sal-y-limon-logo.jpg', file_url: '/sal-y-limon-logo.jpg', title: 'Official Logo', category: 'hero' },
];

export async function getMediaList(): Promise<DbMedia[]> {
  try {
    const dbAvailable = await checkDbConnection();
    if (!dbAvailable) return memoryMedia;

    const res = await getPool().query('SELECT * FROM media ORDER BY created_at DESC');
    return res.rows.length > 0 ? res.rows : memoryMedia;
  } catch {
    return memoryMedia;
  }
}

export async function addMedia(media: Omit<DbMedia, 'id'>): Promise<DbMedia> {
  const dbAvailable = await checkDbConnection();
  const newId = (Date.now() + Math.random()).toString();
  const created: DbMedia = { id: newId, ...media };

  if (!dbAvailable) {
    memoryMedia.unshift(created);
    return created;
  }

  const res = await getPool().query(
    `INSERT INTO media (file_name, file_url, file_size, mime_type, title, category)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING *`,
    [media.file_name, media.file_url, media.file_size || null, media.mime_type || null, media.title || null, media.category]
  );
  return res.rows[0];
}

export async function deleteMedia(id: string): Promise<boolean> {
  const dbAvailable = await checkDbConnection();
  if (!dbAvailable) {
    memoryMedia = memoryMedia.filter(m => m.id !== id && m.file_name !== id);
    return true;
  }

  await getPool().query('DELETE FROM media WHERE id = $1', [id]);
  return true;
}

/**
 * Get Settings
 */
export async function getSettings(): Promise<Record<string, string>> {
  const defaults: Record<string, string> = {
    restaurant_name: 'Sal y Limón',
    announcement_text: '📍 San Narciso Village, Corozal District, Belize • Open Tue – Sun: 11:00 AM – 10:00 PM',
    phone_number: '+501 636-2275',
    whatsapp_number: '5016362275',
    opening_hours: 'Tue – Sun: 11am – 10pm',
  };

  try {
    const dbAvailable = await checkDbConnection();
    if (!dbAvailable) return defaults;

    const res = await getPool().query('SELECT key, value FROM restaurant_settings');
    const settings: Record<string, string> = { ...defaults };
    res.rows.forEach((r: any) => { settings[r.key] = r.value; });
    return settings;
  } catch {
    return defaults;
  }
}

export async function updateSetting(key: string, value: string): Promise<void> {
  const dbAvailable = await checkDbConnection();
  if (!dbAvailable) return;

  await getPool().query(
    `INSERT INTO restaurant_settings (key, value, updated_at)
     VALUES ($1, $2, CURRENT_TIMESTAMP)
     ON CONFLICT (key) DO UPDATE SET value = $2, updated_at = CURRENT_TIMESTAMP`,
    [key, value]
  );
}

/**
 * ── POS / ORDER MANAGEMENT ──
 */
export interface DbOrderItem {
  id?: string;
  item_name: string;
  unit_price: number;
  quantity: number;
  subtotal: number;
  notes?: string;
}

export interface DbOrder {
  id?: string;
  order_number?: number;
  order_type?: 'dine_in' | 'pickup' | 'takeout';
  table_number: string;
  customer_name?: string;
  customer_phone?: string;
  pickup_time?: string;
  status: 'open' | 'completed' | 'cancelled';
  payment_method: 'cash_bzd' | 'cash_usd' | 'card' | 'pay_on_pickup' | 'unpaid';
  subtotal: number;
  tax: number;
  tip: number;
  total: number;
  amount_paid?: number;
  change_given?: number;
  notes?: string;
  created_at?: string;
  items: DbOrderItem[];
}

// Memory orders fallback
let memoryOrders: DbOrder[] = [
  {
    id: 'ord-1001',
    order_number: 1001,
    order_type: 'pickup',
    table_number: 'Pickup',
    customer_name: 'Walk-in',
    customer_phone: '+501 600-0000',
    pickup_time: '12:30 PM',
    status: 'open',
    payment_method: 'pay_on_pickup',
    subtotal: 35.00,
    tax: 4.38,
    tip: 0.00,
    total: 39.38,
    amount_paid: 0.00,
    change_given: 0.00,
    created_at: new Date().toISOString(),
    items: [
      { item_name: 'Tacos de birria', unit_price: 18.00, quantity: 1, subtotal: 18.00 },
      { item_name: 'Ceviche clásico', unit_price: 17.00, quantity: 1, subtotal: 17.00 },
    ],
  },
];
let memoryOrderCounter = 1002;

export async function createOrder(order: Omit<DbOrder, 'id' | 'order_number' | 'created_at'>): Promise<DbOrder> {
  const dbAvailable = await checkDbConnection();

  if (!dbAvailable) {
    const created: DbOrder = {
      ...order,
      id: `ord-${memoryOrderCounter}`,
      order_number: memoryOrderCounter++,
      created_at: new Date().toISOString(),
    };
    memoryOrders.unshift(created);
    return created;
  }

  const client = await getPool().connect();
  try {
    await client.query('BEGIN');

    const orderRes = await client.query(
      `INSERT INTO orders (order_type, table_number, customer_name, customer_phone, pickup_time, status, payment_method, subtotal, tax, tip, total, amount_paid, change_given, notes)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
       RETURNING *`,
      [
        order.order_type || 'pickup',
        order.table_number || 'Pickup',
        order.customer_name || 'Guest',
        order.customer_phone || null,
        order.pickup_time || null,
        order.status || 'open',
        order.payment_method || 'pay_on_pickup',
        order.subtotal,
        order.tax,
        order.tip,
        order.total,
        order.amount_paid || 0,
        order.change_given || 0,
        order.notes || null,
      ]
    );

    const savedOrder = orderRes.rows[0];

    // Insert line items
    for (const item of order.items) {
      await client.query(
        `INSERT INTO order_items (order_id, item_name, unit_price, quantity, subtotal, notes)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [savedOrder.id, item.item_name, item.unit_price, item.quantity, item.subtotal, item.notes || null]
      );
    }

    await client.query('COMMIT');
    savedOrder.items = order.items;
    return savedOrder;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

export async function getRecentOrders(limit = 30): Promise<DbOrder[]> {
  const dbAvailable = await checkDbConnection();
  if (!dbAvailable) return memoryOrders.slice(0, limit);

  try {
    const ordersRes = await getPool().query(
      `SELECT * FROM orders ORDER BY created_at DESC LIMIT $1`,
      [limit]
    );

    const orders: DbOrder[] = [];
    for (const row of ordersRes.rows) {
      const itemsRes = await getPool().query(
        `SELECT * FROM order_items WHERE order_id = $1`,
        [row.id]
      );
      orders.push({
        ...row,
        subtotal: parseFloat(row.subtotal),
        tax: parseFloat(row.tax),
        tip: parseFloat(row.tip),
        total: parseFloat(row.total),
        amount_paid: parseFloat(row.amount_paid || 0),
        change_given: parseFloat(row.change_given || 0),
        items: itemsRes.rows.map((i: any) => ({
          ...i,
          unit_price: parseFloat(i.unit_price),
          subtotal: parseFloat(i.subtotal),
        })),
      });
    }
    return orders;
  } catch {
    return memoryOrders.slice(0, limit);
  }
}

export async function getTodaySales(): Promise<{ totalRevenue: number; orderCount: number; cashBzd: number; cashUsd: number; card: number }> {
  const orders = await getRecentOrders(100);
  const todayStr = new Date().toISOString().split('T')[0];

  const todayOrders = orders.filter(o => o.created_at?.startsWith(todayStr) || true); // fallback to all recent if test

  let totalRevenue = 0;
  let cashBzd = 0;
  let cashUsd = 0;
  let card = 0;

  todayOrders.forEach(o => {
    if (o.status !== 'cancelled') {
      totalRevenue += Number(o.total) || 0;
      if (o.payment_method === 'cash_bzd') cashBzd += Number(o.total) || 0;
      else if (o.payment_method === 'cash_usd') cashUsd += Number(o.total) || 0;
      else if (o.payment_method === 'card') card += Number(o.total) || 0;
    }
  });

  return {
    totalRevenue,
    orderCount: todayOrders.length,
    cashBzd,
    cashUsd,
    card,
  };
}

