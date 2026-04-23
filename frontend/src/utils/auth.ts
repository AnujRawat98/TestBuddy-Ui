const TOKEN_KEY = 'token';
const SUPERADMIN_KEY = 'isSuperAdmin';

export function saveAuthSession(token: string, isSuperAdmin: boolean) {
  localStorage.setItem(TOKEN_KEY, token);
  localStorage.setItem(SUPERADMIN_KEY, String(isSuperAdmin));
}

export function clearAuthSession() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(SUPERADMIN_KEY);
}

export function isSuperAdminSession() {
  return localStorage.getItem(SUPERADMIN_KEY) === 'true';
}
