import type { APIRequest, APIRequestContext } from '@playwright/test';
import { adminSession, readAccessToken } from './auth-state';
import { appConfig } from './config';

// Admin API calls the specs use to read what a page should show and to clean up the records the
// write specs create. The admin API takes the raw token in Authorization, without Bearer.

export type AdminColumn = { name: string; prop: string; sortable: boolean; visible: boolean };

export type AdminPage<T> = {
  items: T[];
  meta: { totalItems: number; itemCount: number; itemsPerPage: number; totalPages: number; currentPage: number };
};

// What every list endpoint returns: one page of records plus the table's column settings.
export type AdminListBody<T> = { data: AdminPage<T>; columns: AdminColumn[] };

export type AdminRole = { id: number; role: string; slug: string; count: number };

export type AdminPermission = { id: number; permission: string; slug: string; tag: string };

export type AdminFeature = { id: number; name: string; slug: string; value: number };

// An API context with the saved admin session's token, for fixtures and for hooks that clean up.
export async function createAdminApi(request: APIRequest): Promise<APIRequestContext> {
  const token = readAccessToken(adminSession);

  if (!token) {
    throw new Error('No saved admin access token. Run the admin-auth-setup project first.');
  }

  return request.newContext({ extraHTTPHeaders: { Authorization: token } });
}

function url(path: string, query: Record<string, string | number> = {}): string {
  const target = new URL(`${appConfig.adminApiUrl}/${path}`);

  for (const [key, value] of Object.entries(query)) {
    target.searchParams.set(key, String(value));
  }

  return target.toString();
}

async function getData<T>(api: APIRequestContext, path: string, query?: Record<string, string | number>): Promise<T> {
  const response = await api.get(url(path, query));

  if (!response.ok()) {
    throw new Error(`GET ${path} failed with ${response.status()}`);
  }

  return ((await response.json()) as { data: T }).data;
}

export async function getAdminList<T>(
  api: APIRequestContext,
  path: string,
  query: Record<string, string | number> = {},
): Promise<AdminListBody<T>> {
  const response = await api.get(url(path, { page: '', queryterm: '', sort: '', order: '', ...query }));

  if (!response.ok()) {
    throw new Error(`GET ${path} failed with ${response.status()}`);
  }

  return (await response.json()) as AdminListBody<T>;
}

// Every permission, grouped by module as the permission pages show them.
export function getPermissions(api: APIRequestContext): Promise<Record<string, AdminPermission[]>> {
  return getData(api, 'permissions');
}

export async function getRolePermissionIds(api: APIRequestContext, roleId: number): Promise<number[]> {
  const rows = await getData<{ permission_id: number }[]>(api, `role-permissions/role/${roleId}`);
  return rows.map((row) => row.permission_id);
}

export async function getUserPermissionIds(api: APIRequestContext, userId: number): Promise<number[]> {
  const rows = await getData<{ permission_id: number }[]>(api, `user-permissions/user/${userId}`);
  return rows.map((row) => row.permission_id);
}

// The notification features and their defaults, grouped as the feature pages show them.
export function getFeatures(api: APIRequestContext): Promise<Record<string, AdminFeature[]>> {
  return getData(api, 'admin-features');
}

// A role's or user's own feature values (1 on, 0 off) by feature id. The API groups them like the
// features, e.g. {"Notifications": [{feature_id, value}]}, and sends {} until any are saved.
export type FeatureValues = Record<number, number>;

function featureValues(raw: Record<string, { feature_id: number; value: number }[]>): FeatureValues {
  return Object.fromEntries(Object.values(raw).flat().map((feature) => [feature.feature_id, feature.value]));
}

export async function getRoleFeatureValues(api: APIRequestContext, roleId: number): Promise<FeatureValues> {
  return featureValues(await getData(api, `admin-role-features/role/${roleId}`));
}

export async function getUserFeatureValues(api: APIRequestContext, userId: number): Promise<FeatureValues> {
  return featureValues(await getData(api, `admin-user-features/user/${userId}`));
}

// The roles an admin user can be given, as the form's Role picker lists them.
export function getRoleOptions(api: APIRequestContext): Promise<{ key: number; label: string }[]> {
  return getData(api, 'roles/option');
}

export function getRole(api: APIRequestContext, roleId: number): Promise<{ id: number; role: string }> {
  return getData(api, `roles/${roleId}`);
}

// What an admin user's edit page loads; status is 1 for Active and 0 for Inactive.
export type AdminUserProfile = {
  id: number;
  username: string;
  full_name: string;
  email: string;
  mobile: string;
  countries: string[];
  state: string;
  city: string;
  zipcode: string;
  address: string;
  user_type: number;
  status: number;
  expired_on: string;
};

export function getAdminUserProfile(api: APIRequestContext, userId: number): Promise<AdminUserProfile> {
  return getData(api, `auth/user-profile/${userId}`);
}

// What a sales user's edit page loads; status is 1 for Active and 0 for Inactive.
export type SalesUserRecord = {
  id: number;
  full_name: string;
  email: string;
  mobile: string;
  country: string;
  team: string | null;
  is_sales_head: boolean;
  is_business_account_manager: boolean;
  is_technical_account_manager: boolean;
  is_admin_user: number;
  status: number;
  expired_on: string;
};

export function getSalesUser(api: APIRequestContext, salesUserId: number): Promise<SalesUserRecord> {
  return getData(api, `sales-users/${salesUserId}`);
}

// A user's stored SMPP settings, from GET users/<id>. is_smpp_enabled is 1 or 0, and the smpp_*
// values are left out of the response while it is 0.
export type UserSmppRecord = {
  is_smpp_enabled: number;
  smpp_username?: string;
  smpp_shortcode?: string;
  smpp_allowed_ip?: string;
  smpp_max_transmitter_session?: number;
  smpp_max_receiver_session?: number;
  smpp_max_transreceiver_session?: number;
};

export async function getUserSmpp(api: APIRequestContext, userId: number): Promise<UserSmppRecord> {
  const user = await getData<Record<string, unknown>>(api, `users/${userId}`);
  return Object.fromEntries(Object.entries(user).filter(([key]) => key.includes('smpp'))) as UserSmppRecord;
}

// Finds the roles whose name contains the text.
export async function findRoles(api: APIRequestContext, text: string): Promise<AdminRole[]> {
  return (await getAdminList<AdminRole>(api, 'roles', { queryterm: text })).data.items;
}

// Creates a role for a write spec to use; returns its id.
export async function createRole(api: APIRequestContext, name: string): Promise<number> {
  const response = await api.post(url('roles'), { data: { role: name } });
  const body = (await response.json()) as { success?: boolean; data?: { id?: number } };

  if (!response.ok() || body.success === false) {
    throw new Error(`POST roles failed with ${response.status()}: ${JSON.stringify(body).slice(0, 200)}`);
  }

  const [created] = (await findRoles(api, name)).filter((role) => role.role === name);
  return body.data?.id ?? created.id;
}

export async function deleteRole(api: APIRequestContext, roleId: number): Promise<void> {
  const response = await api.delete(url(`roles/${roleId}`));

  if (!response.ok()) {
    throw new Error(`DELETE roles/${roleId} failed with ${response.status()}`);
  }
}
