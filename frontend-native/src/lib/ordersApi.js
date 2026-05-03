import { buildAuthHeaders } from './httpAuth';

const rawPedidosApi = `${process.env.EXPO_PUBLIC_PEDIDOS_API_URL || ''}`.trim();

export function getPedidosApiBaseUrl() {
  if (!rawPedidosApi) {
    throw new Error('Falta EXPO_PUBLIC_PEDIDOS_API_URL en frontend-native/.env.local');
  }
  if (rawPedidosApi.includes('tu-dominio.com')) {
    throw new Error('Configura EXPO_PUBLIC_PEDIDOS_API_URL con tu URL real de backend');
  }
  return rawPedidosApi.replace(/\/$/, '');
}

async function request(path, options = {}) {
  let response;
  try {
    response = await fetch(`${getPedidosApiBaseUrl()}${path}`, {
      headers: {
        'Content-Type': 'application/json',
        ...buildAuthHeaders(options.headers || {}),
      },
      ...options,
    });
  } catch (error) {
    const wrapped = new Error('No se pudo conectar con el servicio de pedidos');
    wrapped.code = 'NETWORK_ERROR';
    wrapped.cause = error;
    throw wrapped;
  }

  const json = await response.json().catch(() => ({}));
  if (!response.ok) {
    const wrapped = new Error(json.detail || json.message || 'Error con pedidos');
    wrapped.status = response.status;
    wrapped.code = 'HTTP_ERROR';
    throw wrapped;
  }
  return json;
}

export async function listOrders(params = {}) {
  const query = new URLSearchParams();
  if (params.customerId) query.set('customer_id', params.customerId);
  if (params.courierId) query.set('courier_id', params.courierId);
  if (params.sellerId) query.set('seller_id', params.sellerId);
  const suffix = query.toString() ? `?${query.toString()}` : '';
  const json = await request(`/pedidos${suffix}`);
  return json.pedidos || [];
}

export async function getOrder(orderId) {
  const json = await request(`/pedidos/${orderId}`);
  return json.pedido;
}

export async function createOrderRequest(payload) {
  const json = await request('/pedidos', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
  return json.pedido;
}

export async function updateOrderStatusRequest(orderId, payload) {
  const json = await request(`/pedidos/${orderId}/estado`, {
    method: 'PUT',
    body: JSON.stringify(payload),
  });
  return json.pedido;
}

export async function listPickupStores() {
  const json = await request('/pickup-stores');
  return json.stores || [];
}

