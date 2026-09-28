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
