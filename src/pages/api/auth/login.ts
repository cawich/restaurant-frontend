import type { APIRoute } from 'astro';
import { checkCredentials, createSession } from '../../../lib/auth';

export const POST: APIRoute = async ({ request, cookies }) => {
  try {
    const data = await request.json();
    const loginIdentifier = data.email || data.username || '';
    const password = data.password || '';

    if (!loginIdentifier || !password) {
      return new Response(JSON.stringify({ error: 'Email/Username and password are required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const authResult = await checkCredentials(loginIdentifier, password);
    if (authResult.valid && authResult.user) {
      createSession(cookies, authResult.user);
      return new Response(JSON.stringify({ 
        success: true, 
        redirect: '/admin',
        user: authResult.user 
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    } else {
      return new Response(JSON.stringify({ error: 'Invalid email/username or password' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
    }
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message || 'Server error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};
