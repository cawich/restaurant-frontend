import type { APIRoute } from 'astro';
import { isAuthenticated, getSessionUser } from '../../../../lib/auth';
import { getAllUsers, createUser } from '../../../../db/client';

export const GET: APIRoute = async ({ cookies }) => {
  if (!isAuthenticated(cookies)) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    const users = await getAllUsers();
    return new Response(JSON.stringify({ success: true, users }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message || 'Server error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};

export const POST: APIRoute = async ({ request, cookies }) => {
  if (!isAuthenticated(cookies)) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const sessionUser = getSessionUser(cookies);
  if (sessionUser && sessionUser.role !== 'admin') {
    return new Response(JSON.stringify({ error: 'Only administrators can create new users' }), {
      status: 403,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    const body = await request.json();
    const { username, email, password, role } = body;

    if (!username || !email || !password) {
      return new Response(JSON.stringify({ error: 'Username, email, and password are required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const result = await createUser({ username, email, password, role: role || 'staff' });
    if (!result.success) {
      return new Response(JSON.stringify({ error: result.error || 'Failed to create user' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ success: true, user: result.user }), {
      status: 201,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message || 'Failed to process request' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};
