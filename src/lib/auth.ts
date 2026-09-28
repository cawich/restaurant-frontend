import type { AstroCookies } from 'astro';
import bcrypt from 'bcryptjs';
import { getUserByEmail, type DbUser } from '../db/client';

const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'admin@salylimon.com';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin1234';
const SESSION_SECRET = process.env.SESSION_SECRET || 'sal_y_limon_super_secret_session_key_2026_belize';

const COOKIE_NAME = 'sal_admin_session';

export interface SessionUser {
  id: string;
  email: string;
  username: string;
  role: string;
}

/**
 * Validate credentials against PostgreSQL database (with bcrypt)
 * Supports logging in with either Email or Username!
 */
export async function checkCredentials(loginIdentifier: string, pass: string): Promise<{ valid: boolean; user?: SessionUser }> {
  const cleanId = loginIdentifier.trim();
  if (!cleanId || !pass) return { valid: false };

  try {
    const user = await getUserByEmail(cleanId);
    if (user && user.password_hash) {
      const match = await bcrypt.compare(pass, user.password_hash);
      if (match) {
        return {
          valid: true,
          user: {
            id: user.id,
            email: user.email,
            username: user.username,
            role: user.role,
          },
        };
      }
    }
  } catch (err: any) {
    console.warn('⚠️ [DB auth check error]:', err.message);
  }

  // Fallback to .env admin credentials if DB is unseeded or offline
  const isEnvMatch = cleanId.toLowerCase() === ADMIN_EMAIL.trim().toLowerCase() && pass === ADMIN_PASSWORD;
  if (isEnvMatch) {
    return {
      valid: true,
      user: {
        id: 'env-admin',
        email: ADMIN_EMAIL,
        username: 'Admin',
        role: 'admin',
      },
    };
  }

  return { valid: false };
}

/**
 * Set an authenticated session cookie
 */
export function createSession(cookies: AstroCookies, user: SessionUser | string): void {
  const userData: SessionUser = typeof user === 'string'
    ? { id: 'admin', email: user, username: user.split('@')[0], role: 'admin' }
    : user;

  const payloadData = {
    id: userData.id,
    email: userData.email,
    username: userData.username,
    role: userData.role,
    time: Date.now(),
    secret: SESSION_SECRET,
  };

  const payload = Buffer.from(JSON.stringify(payloadData)).toString('base64');
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
 * Extract authenticated user information from the session cookie
 */
export function getSessionUser(cookies: AstroCookies): SessionUser | null {
  const sessionCookie = cookies.get(COOKIE_NAME);
  if (!sessionCookie || !sessionCookie.value) return null;

  try {
    const decoded = Buffer.from(sessionCookie.value, 'base64').toString('utf-8');

    // Modern JSON session token
    if (decoded.startsWith('{')) {
      const data = JSON.parse(decoded);
      if (data.secret !== SESSION_SECRET) return null;

      // Check expiration (7 days)
      const maxAgeMs = 7 * 24 * 60 * 60 * 1000;
      if (Date.now() - (data.time || 0) > maxAgeMs) return null;

      return {
        id: data.id || 'usr',
        email: data.email,
        username: data.username || data.email.split('@')[0],
        role: data.role || 'admin',
      };
    }

    // Backwards-compatibility with legacy colon-separated tokens
    const [email, timeStr, secret] = decoded.split(':');
    if (secret !== SESSION_SECRET) return null;

    const timestamp = parseInt(timeStr, 10);
    const maxAgeMs = 7 * 24 * 60 * 60 * 1000;
    if (Date.now() - timestamp > maxAgeMs) return null;

    return {
      id: 'legacy',
      email,
      username: email.split('@')[0],
      role: 'admin',
    };
  } catch {
    return null;
  }
}

/**
 * Check if the request is authenticated
 */
export function isAuthenticated(cookies: AstroCookies): boolean {
  return getSessionUser(cookies) !== null;
}
