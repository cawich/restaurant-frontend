import type { APIRoute } from 'astro';
import { isAuthenticated } from '../../../lib/auth';
import { getAdminMenuItems, addMenuItem, updateMenuItem, deleteMenuItem } from '../../../db/client';

export const GET: APIRoute = async () => {
  const items = await getAdminMenuItems();
  return new Response(JSON.stringify(items), {
    headers: { 'Content-Type': 'application/json' },
  });
};

export const POST: APIRoute = async ({ request, cookies }) => {
  if (!isAuthenticated(cookies)) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
  }

  try {
    const body = await request.json();
    const { category_id, name, detail, price, badge, tag, image_url } = body;

    if (!category_id || !name || !price) {
      return new Response(JSON.stringify({ error: 'category_id, name, and price are required' }), { status: 400 });
    }

    const result = await addMenuItem({
      category_id,
      name,
      detail: detail || '',
      price,
      badge,
      tag,
      image_url,
    });

    return new Response(JSON.stringify(result), { status: 201 });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500 });
  }
};

export const PUT: APIRoute = async ({ request, cookies }) => {
  if (!isAuthenticated(cookies)) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
  }

  try {
    const body = await request.json();
    const { id, updates } = body;

    if (!id || !updates) {
      return new Response(JSON.stringify({ error: 'id and updates object are required' }), { status: 400 });
    }

    const result = await updateMenuItem(id, updates);
    return new Response(JSON.stringify(result), { status: 200 });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500 });
  }
};

export const DELETE: APIRoute = async ({ request, cookies }) => {
  if (!isAuthenticated(cookies)) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
  }

  try {
    const body = await request.json();
    const { id } = body;

    if (!id) {
      return new Response(JSON.stringify({ error: 'id is required' }), { status: 400 });
    }

    await deleteMenuItem(id);
    return new Response(JSON.stringify({ success: true }), { status: 200 });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500 });
  }
};
