const TOKEN_KEY = 'token';
const SUPERADMIN_KEY = 'isSuperAdmin';
const TENANT_TYPE_KEY = 'tenantType';
const ROLE_KEY = 'role';

export function saveAuthSession(
  token: string,
  isSuperAdmin: boolean,
  tenantType: string = 'ORG',
  role: string = 'OrgAdmin',
) {
  localStorage.setItem(TOKEN_KEY, token);
  localStorage.setItem(SUPERADMIN_KEY, String(isSuperAdmin));
  localStorage.setItem(TENANT_TYPE_KEY, tenantType);
  localStorage.setItem(ROLE_KEY, role);
}

export function clearAuthSession() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(SUPERADMIN_KEY);
  localStorage.removeItem(TENANT_TYPE_KEY);
  localStorage.removeItem(ROLE_KEY);
}

export function isSuperAdminSession() {
  return localStorage.getItem(SUPERADMIN_KEY) === 'true';
}

export function getTenantTypeSession() {
  return localStorage.getItem(TENANT_TYPE_KEY) ?? 'ORG';
}

export function getRoleSession() {
  return localStorage.getItem(ROLE_KEY) ?? 'OrgAdmin';
}

export function isIndividualSession() {
  return getTenantTypeSession() === 'INDIVIDUAL' || getRoleSession() === 'Individual';
}

export function getSessionHomeRoute() {
  if (isSuperAdminSession()) {
    return '/platform';
  }

  return isIndividualSession() ? '/practice' : '/dashboard';
}

export function getPostAuthRoute(data?: { isSuperAdmin?: boolean; tenantType?: string; role?: string }) {
  if (data?.isSuperAdmin) {
    return '/platform';
  }

  return data?.tenantType === 'INDIVIDUAL' || data?.role === 'Individual'
    ? '/practice'
    : '/dashboard';
}
