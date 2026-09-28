import type { APIRoute } from 'astro';
import { isAuthenticated, getSessionUser } from '../../../../lib/auth';
import { deleteUser, updateUser } from '../../../../db/client';

export const DELETE: APIRoute = async ({ params, cookies }) => {
  if (!isAuthenticated(cookies)) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const sessionUser = getSessionUser(cookies);
  if (sessionUser && sessionUser.role !== 'admin') {
    return new Response(JSON.stringify({ error: 'Only administrators can delete user accounts' }), {
      status: 403,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const { id } = params;
  if (!id) {
    return new Response(JSON.stringify({ error: 'User ID is required' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // Prevent user from deleting their own currently logged-in account
  if (sessionUser && sessionUser.id === id) {
    return new Response(JSON.stringify({ error: 'You cannot delete your own active administrator account' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    const result = await deleteUser(id);
    if (!result.success) {
      return new Response(JSON.stringify({ error: result.error || 'Failed to delete user' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ success: true, message: 'User deleted successfully' }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message || 'Database error deleting user' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};

export const PUT: APIRoute = async ({ params, request, cookies }) => {
  if (!isAuthenticated(cookies)) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const sessionUser = getSessionUser(cookies);
  if (sessionUser && sessionUser.role !== 'admin') {
    return new Response(JSON.stringify({ error: 'Only administrators can modify user accounts' }), {
      status: 403,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const { id } = params;
  if (!id) {
    return new Response(JSON.stringify({ error: 'User ID is required' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    const body = await request.json();
    const result = await updateUser(id, body);
    if (!result.success) {
      return new Response(JSON.stringify({ error: result.error || 'Failed to update user' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ success: true, message: 'User updated successfully' }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message || 'Database error updating user' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};
