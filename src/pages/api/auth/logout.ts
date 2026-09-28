import type { APIRoute } from 'astro';
import { clearSession } from '../../../lib/auth';

export const ALL: APIRoute = async ({ cookies, redirect }) => {
  clearSession(cookies);
  return redirect('/admin/login');
};
