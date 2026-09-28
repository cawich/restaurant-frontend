import type { APIRoute } from 'astro';
import { isAuthenticated } from '../../lib/auth';
import { getSettings, updateSetting } from '../../db/client';

export const GET: APIRoute = async () => {
  const settings = await getSettings();
  return new Response(JSON.stringify(settings), {
    headers: { 'Content-Type': 'application/json' },
  });
};

export const POST: APIRoute = async ({ request, cookies }) => {
  if (!isAuthenticated(cookies)) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
  }

  try {
    const { key, value } = await request.json();
    if (!key || value === undefined) {
      return new Response(JSON.stringify({ error: 'key and value required' }), { status: 400 });
    }

    await updateSetting(key, value);
    return new Response(JSON.stringify({ success: true }), { status: 200 });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500 });
  }
};
