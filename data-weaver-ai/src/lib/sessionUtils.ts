/**
 * Simple user identification system
 * Uses authenticated identity when available, falls back to anonymous local ID.
 */

const ANON_USER_ID_KEY = 'data_analyst_anon_user_id';

export function getUserId(authUserId?: string | null, authEmail?: string | null): string {
  if (authUserId) {
    return `auth_${authUserId}`;
  }

  if (authEmail) {
    return `email_${authEmail.trim().toLowerCase()}`;
  }

  let userId = localStorage.getItem(ANON_USER_ID_KEY);
  if (!userId) {
    userId = `anon_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;
    localStorage.setItem(ANON_USER_ID_KEY, userId);
  }

  return userId;
}

export function clearUser(): void {
  localStorage.removeItem(ANON_USER_ID_KEY);
}
