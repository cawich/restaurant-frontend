import type { AstroCookies } from 'astro';

const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'admin@salylimon.com';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin1234';
const SESSION_SECRET = process.env.SESSION_SECRET || 'sal_y_limon_super_secret_session_key_2026_belize';

const COOKIE_NAME = 'sal_admin_session';

/**
 * Validate credentials
 */
export function checkCredentials(email: string, pass: string): boolean {
  return email.trim().toLowerCase() === ADMIN_EMAIL.trim().toLowerCase() && pass === ADMIN_PASSWORD;
}

/**
 * Set an authenticated session cookie
 */
export function createSession(cookies: AstroCookies, email: string): void {
  // Simple token containing email and timestamp signed with session secret
  const payload = Buffer.from(`${email}:${Date.now()}:${SESSION_SECRET}`).toString('base64');
  cookies.set(COOKIE_NAME, payload, {
    path: '/',
    httpOnly: true,
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 7, // 7 days
    secure: process.env.NODE_ENV === 'production',
  });
}

/**
 * Destroy session cookie
 */
export function clearSession(cookies: AstroCookies): void {
  cookies.delete(COOKIE_NAME, { path: '/' });
}

/**
 * Check if the request is authenticated
 */
export function isAuthenticated(cookies: AstroCookies): boolean {
  const sessionCookie = cookies.get(COOKIE_NAME);
  if (!sessionCookie || !sessionCookie.value) return false;

  try {
    const decoded = Buffer.from(sessionCookie.value, 'base64').toString('utf-8');
    const [email, timeStr, secret] = decoded.split(':');
    if (secret !== SESSION_SECRET) return false;

    // Check expiration (7 days)
    const timestamp = parseInt(timeStr, 10);
    const maxAgeMs = 7 * 24 * 60 * 60 * 1000;
    if (Date.now() - timestamp > maxAgeMs) return false;

    return email.toLowerCase() === ADMIN_EMAIL.toLowerCase();
  } catch {
    return false;
  }
}
