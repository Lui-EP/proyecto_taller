const rawClientesApi = `${process.env.EXPO_PUBLIC_CLIENTES_API_URL || ''}`.trim();

export function getClientesApiBaseUrl() {
  if (!rawClientesApi) {
    throw new Error('Falta EXPO_PUBLIC_CLIENTES_API_URL en frontend-native/.env.local');
  }
  return rawClientesApi.replace(/\/$/, '');
}

async function request(path, options = {}) {
  let response;
  try {
    response = await fetch(`${getClientesApiBaseUrl()}${path}`, {
      headers: {
        'Content-Type': 'application/json',
        ...(options.headers || {}),
      },
      ...options,
    });
  } catch (error) {
    const wrapped = new Error('No se pudo conectar con el servicio de productos');
    wrapped.code = 'NETWORK_ERROR';
    wrapped.cause = error;
    throw wrapped;
  }

  const json = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(json.detail || json.message || 'Error de conexión con productos');
  }
  return json;
}

export async function listProducts(params = {}) {
  const query = new URLSearchParams();
  if (params.sellerId) query.set('seller_id', params.sellerId);
  const suffix = query.toString() ? `?${query.toString()}` : '';
  const json = await request(`/productos${suffix}`);
  return json.products || [];
}

export async function createProduct(payload) {
  const json = await request('/productos', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
  return json.product;
}

export async function updateProduct(productId, payload) {
  const json = await request(`/productos/${productId}`, {
    method: 'PUT',
    body: JSON.stringify(payload),
  });
  return json.product;
}
