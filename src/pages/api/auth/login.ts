import type { APIRoute } from 'astro';
import { checkCredentials, createSession } from '../../../lib/auth';

export const POST: APIRoute = async ({ request, cookies }) => {
  try {
    const data = await request.json();
    const { email, password } = data;

    if (!email || !password) {
      return new Response(JSON.stringify({ error: 'Email and password are required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    if (checkCredentials(email, password)) {
      createSession(cookies, email);
      return new Response(JSON.stringify({ success: true, redirect: '/admin' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    } else {
      return new Response(JSON.stringify({ error: 'Invalid email or password' }), {
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
