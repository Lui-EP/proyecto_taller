// Utilidades puras compartidas en toda la app móvil.
// No contiene datos hardcodeados: solo funciones de transformación y helpers de dominio.

export function formatPrice(value) {
  return new Intl.NumberFormat('es-MX', {
    style: 'currency',
    currency: 'MXN',
    maximumFractionDigits: 0,
  }).format(Number(value || 0));
}

export function getOrderTotal(order) {
  return (order.items || []).reduce(
    (sum, item) => sum + Number(item.subtotal || item.price * item.quantity || 0),
    0
  );
}

function normalizeOrderItems(items = []) {
  return (items || []).map((item) => ({
    productId: item.productId || item.product_id || '',
    quantity: Number(item.quantity || 0),
    productName: item.productName || item.name || 'Producto',
    sellerId: item.sellerId || item.seller_id || '',
    sellerName: item.sellerName || '',
    categoryLabel: item.categoryLabel || item.category_label || 'General',
    price: Number(item.price || 0),
    subtotal: Number(item.subtotal || Number(item.price || 0) * Number(item.quantity || 0)),
  }));
}

export function normalizeOrder(order = {}) {
  const items = normalizeOrderItems(order.items || []);
  return {
    ...order,
    addressLabel: order.addressLabel || order.address || '',
    addressLat: Number.isFinite(Number(order.addressLat)) ? Number(order.addressLat) : null,
    addressLng: Number.isFinite(Number(order.addressLng)) ? Number(order.addressLng) : null,
    addressColony: order.addressColony || '',
    addressSubdivision: order.addressSubdivision || '',
    pickupStoreLat: Number.isFinite(Number(order.pickupStoreLat)) ? Number(order.pickupStoreLat) : null,
    pickupStoreLng: Number.isFinite(Number(order.pickupStoreLng)) ? Number(order.pickupStoreLng) : null,
    courierLat: Number.isFinite(Number(order.courierLat)) ? Number(order.courierLat) : null,
    courierLng: Number.isFinite(Number(order.courierLng)) ? Number(order.courierLng) : null,
    lastLocationAt: order.lastLocationAt || '',
    items,
    total: Number(order.total || getOrderTotal({ items })),
  };
}

export function sortOrdersByDate(orderList) {
  return [...(orderList || [])].sort(
    (a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0)
  );
}

export function getOrderStatusMeta(status, deliveryMethod = 'delivery') {
  const map = {
    pedido_realizado: {
      label: deliveryMethod === 'pickup' ? 'Preparando pedido' : 'Pedido realizado',
      icon: 'receipt-outline',
    },
    asignado: {
      label: 'Repartidor asignado',
      icon: 'person-add-outline',
    },
    en_transito: {
      label: 'En tránsito',
      icon: 'bicycle-outline',
    },
    listo_recoger: {
      label: 'Listo para recoger',
      icon: 'storefront-outline',
    },
    entregado: {
      label: 'Entregado',
      icon: 'checkmark-circle-outline',
    },
    cancelado: {
      label: 'Cancelado',
      icon: 'close-circle-outline',
    },
  };

  return map[status] || {
    label: 'En proceso',
    icon: 'time-outline',
  };
}

export function getTimelineSteps(order) {
  if (order.deliveryMethod === 'pickup') {
    return [
      { key: 'pedido_realizado', label: 'Pedido confirmado' },
      { key: 'listo_recoger', label: 'Listo para recoger' },
      { key: 'entregado', label: 'Recogido' },
    ];
  }

  return [
    { key: 'pedido_realizado', label: 'Pedido confirmado' },
    { key: 'asignado', label: 'Repartidor asignado' },
    { key: 'en_transito', label: 'En camino' },
    { key: 'entregado', label: 'Entregado' },
  ];
}
