import { getClientesApiBaseUrl } from './productsApi';
import { buildAuthHeaders } from './httpAuth';

async function request(path, options = {}) {
  let response;
  try {
    response = await fetch(`${getClientesApiBaseUrl()}${path}`, {
      headers: {
        'Content-Type': 'application/json',
        ...buildAuthHeaders(options.headers || {}),
      },
      ...options,
    });
  } catch (error) {
    const wrapped = new Error('No se pudo conectar con el servicio de usuarios');
    wrapped.code = 'NETWORK_ERROR';
    wrapped.cause = error;
    throw wrapped;
  }

  const json = await response.json().catch(() => ({}));
  if (!response.ok) {
    const wrapped = new Error(json.detail || json.message || 'Error de autenticación');
    wrapped.status = response.status;
    wrapped.code = response.status === 401 ? 'INVALID_CREDENTIALS' : 'HTTP_ERROR';
    throw wrapped;
  }

  return json;
}

export async function listDemoUsers(params = {}) {
  const query = new URLSearchParams();
  if (params.role) query.set('role', params.role);
  const suffix = query.toString() ? `?${query.toString()}` : '';
  const json = await request(`/usuarios-app/demo${suffix}`);
  return json.users || [];
}

export async function listUsers(params = {}) {
  const query = new URLSearchParams();
  if (params.role) query.set('role', params.role);
  const suffix = query.toString() ? `?${query.toString()}` : '';
  const json = await request(`/usuarios-app${suffix}`);
  return json.users || [];
}

export async function loginRequest(email, password) {
  const json = await request('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });
  return {
    user: json.user || null,
    token: json.access_token || '',
    expiresIn: Number(json.expires_in || 0),
  };
}

export async function registerRequest(payload) {
  const json = await request('/auth/register', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
  return {
    user: json.user || null,
    token: json.access_token || '',
    expiresIn: Number(json.expires_in || 0),
  };
}

export async function getMeRequest() {
  const json = await request('/auth/me');
  return json.user || null;
}
