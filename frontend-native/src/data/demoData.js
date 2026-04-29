export const productImages = {
  canastas: require('../../assets/products/canastas.jpg'),
  miel: require('../../assets/products/miel.jpg'),
  bolsa: require('../../assets/products/bolsa-artesanal.jpg'),
  cafe: require('../../assets/products/cafe.jpg'),
  jarro: require('../../assets/products/jarro-de-barro.jpg'),
  molcajete: require('../../assets/products/molcajete.jpg'),
  pulsera: require('../../assets/products/pulsera-de-ambar.jpg'),
  rebozo: require('../../assets/products/rebozo.jpg'),
  sombrero: require('../../assets/products/sombrero-charro.jpg'),
  tazas: require('../../assets/products/tazas-de-arcilla.jpg'),
};

export const categories = [
  { id: 'all', label: 'Todo', icon: 'apps-outline', accent: '#f7e0bf' },
  { id: 'artesanias', label: 'Artesanías', icon: 'color-palette-outline', accent: '#f2d5ba' },
  { id: 'alimentos', label: 'Alimentos', icon: 'nutrition-outline', accent: '#dceadf' },
  { id: 'textiles', label: 'Textiles', icon: 'shirt-outline', accent: '#ead8f5' },
  { id: 'joyeria', label: 'Joyería', icon: 'diamond-outline', accent: '#f8e5c8' },
];

export const pickupStores = [
  {
    id: 'store-tuxtla-centro',
    name: 'MercadoLocal Centro',
    address: 'Avenida Central Oriente 540, Centro, Tuxtla Gutiérrez, Chiapas',
    hours: 'Lun a sáb · 9:00 a 18:00',
    lat: 16.75412,
    lng: -93.11592,
  },
  {
    id: 'store-chiapa-corzo',
    name: 'MercadoLocal Chiapa de Corzo',
    address: 'Calle Capitán Vicente López, Centro, Chiapa de Corzo, Chiapas',
    hours: 'Lun a dom · 10:00 a 19:00',
    lat: 16.7076,
    lng: -93.011,
  },
];

export const demoUsers = [
  { id: 'buyer-1', name: 'Cliente Demo', email: 'cliente@mercadolocal.mx', password: '123456', role: 'buyer', phone: '9610000000' },
  { id: 'seller-1', name: 'Artesana Luna', email: 'vendedor@mercadolocal.mx', password: '123456', role: 'seller', phone: '9611111111' },
  { id: 'courier-1', name: 'Repartidor Demo', email: 'repartidor@mercadolocal.mx', password: '123456', role: 'courier', phone: '9612222222' },
  { id: 'admin-1', name: 'Admin MercadoLocal', email: 'admin@mercadolocal.mx', password: '123456', role: 'admin', phone: '9613333333' },
];

export const products = [
  {
    id: 'p-1',
    name: 'Canastas de palma',
    category: 'artesanias',
    categoryLabel: 'Artesanías',
    price: 450,
    stock: 18,
    sellerId: 'seller-1',
    sellerName: 'Artesana Luna',
    imageKey: 'canastas',
    image: productImages.canastas,
    description: 'Canastas tejidas a mano para cocina, regalo o decoración.',
    featured: true,
    local: true,
    verified: true,
    rating: 5,
    views: 18,
  },
  {
    id: 'p-2',
    name: 'Miel orgánica',
    category: 'alimentos',
    categoryLabel: 'Alimentos',
    price: 220,
    stock: 8,
    sellerId: 'seller-1',
    sellerName: 'Artesana Luna',
    imageKey: 'miel',
    image: productImages.miel,
    description: 'Miel local en frasco artesanal, ideal para desayuno y postres.',
    featured: false,
    local: true,
    verified: true,
    rating: 5,
    views: 11,
  },
  {
    id: 'p-3',
    name: 'Bolsa textil',
    category: 'textiles',
    categoryLabel: 'Textiles',
    price: 380,
    stock: 4,
    sellerId: 'seller-1',
    sellerName: 'Artesana Luna',
    imageKey: 'bolsa',
    image: productImages.bolsa,
    description: 'Bolsa artesanal colorida, ligera y resistente para uso diario.',
    featured: false,
    local: true,
    verified: true,
    rating: 5,
    views: 32,
  },
  {
    id: 'p-4',
    name: 'Café molido artesanal',
    category: 'alimentos',
    categoryLabel: 'Alimentos',
    price: 190,
    stock: 26,
    sellerId: 'seller-1',
    sellerName: 'Artesana Luna',
    imageKey: 'cafe',
    image: productImages.cafe,
    description: 'Café de tueste medio con aroma intenso y notas dulces.',
    featured: true,
    local: true,
    verified: true,
    rating: 5,
    views: 29,
  },
  {
    id: 'p-5',
    name: 'Jarro de barro',
    category: 'artesanias',
    categoryLabel: 'Artesanías',
    price: 520,
    stock: 14,
    sellerId: 'seller-1',
    sellerName: 'Artesana Luna',
    imageKey: 'jarro',
    image: productImages.jarro,
    description: 'Pieza de barro decorada a mano para servir bebidas o adornar.',
    featured: true,
    local: true,
    verified: true,
    rating: 5,
    views: 34,
  },
  {
    id: 'p-6',
    name: 'Molcajete volcánico',
    category: 'artesanias',
    categoryLabel: 'Artesanías',
    price: 640,
    stock: 6,
    sellerId: 'seller-1',
    sellerName: 'Artesana Luna',
    imageKey: 'molcajete',
    image: productImages.molcajete,
    description: 'Molcajete de piedra listo para salsas y cocina tradicional.',
    featured: false,
    local: true,
    verified: true,
    rating: 5,
    views: 16,
  },
  {
    id: 'p-7',
    name: 'Pulsera de ámbar',
    category: 'joyeria',
    categoryLabel: 'Joyería',
    price: 310,
    stock: 12,
    sellerId: 'seller-1',
    sellerName: 'Artesana Luna',
    imageKey: 'pulsera',
    image: productImages.pulsera,
    description: 'Pulsera ajustable con cuentas de ámbar natural.',
    featured: true,
    local: true,
    verified: true,
    rating: 5,
    views: 22,
  },
  {
    id: 'p-8',
    name: 'Rebozo de telar',
    category: 'textiles',
    categoryLabel: 'Textiles',
    price: 760,
    stock: 6,
    sellerId: 'seller-1',
    sellerName: 'Artesana Luna',
    imageKey: 'rebozo',
    image: productImages.rebozo,
    description: 'Rebozo tejido con detalle tradicional y caída suave.',
    featured: true,
    local: true,
    verified: true,
    rating: 5,
    views: 41,
  },
  {
    id: 'p-9',
    name: 'Sombrero charro',
    category: 'artesanias',
    categoryLabel: 'Artesanías',
    price: 480,
    stock: 11,
    sellerId: 'seller-1',
    sellerName: 'Artesana Luna',
    imageKey: 'sombrero',
    image: productImages.sombrero,
    description: 'Sombrero decorativo y festivo con bordado charro.',
    featured: true,
    local: true,
    verified: true,
    rating: 5,
    views: 15,
  },
  {
    id: 'p-10',
    name: 'Tazas de arcilla',
    category: 'artesanias',
    categoryLabel: 'Artesanías',
    price: 340,
    stock: 19,
    sellerId: 'seller-1',
    sellerName: 'Artesana Luna',
    imageKey: 'tazas',
    image: productImages.tazas,
    description: 'Juego de tazas pintadas a mano con inspiración tradicional.',
    featured: true,
    local: true,
    verified: true,
    rating: 5,
    views: 23,
  },
];

export const activeCarts = [
  {
    id: 'cart-101',
    userId: 'buyer-1',
    userName: 'Cliente Demo',
    userRole: 'buyer',
    updatedAt: '2026-04-27T10:20:00.000Z',
    items: [
      { productId: 'p-1', quantity: 1 },
      { productId: 'p-2', quantity: 2 },
    ],
  },
  {
    id: 'cart-102',
    userId: '',
    userName: 'Invitado',
    userRole: 'guest',
    updatedAt: '2026-04-27T11:45:00.000Z',
    items: [
      { productId: 'p-8', quantity: 1 },
      { productId: 'p-10', quantity: 1 },
    ],
  },
];

export function formatPrice(value) {
  return new Intl.NumberFormat('es-MX', {
    style: 'currency',
    currency: 'MXN',
    maximumFractionDigits: 0,
  }).format(Number(value || 0));
}

export function getProductById(id) {
  return products.find((product) => product.id === id) || null;
}

export function getFeaturedProducts() {
  return products.filter((product) => product.featured);
}

export function getLowStockProducts(threshold = 10) {
  return products.filter((product) => product.stock <= threshold);
}

export function getSellerProducts(sellerId) {
  return products.filter((product) => product.sellerId === sellerId);
}

export function buildOrderItemsSnapshot(rawItems) {
  return rawItems
    .map((item) => {
      const product = item.product || getProductById(item.productId);
      if (!product) return null;
      return {
        productId: product.id,
        productName: product.name,
        sellerId: product.sellerId,
        sellerName: product.sellerName,
        categoryLabel: product.categoryLabel,
        image: product.image,
        price: product.price,
        quantity: item.quantity,
        subtotal: product.price * item.quantity,
      };
    })
    .filter(Boolean);
}

export function getOrderTotal(order) {
  return (order.items || []).reduce((sum, item) => sum + Number(item.subtotal || item.price * item.quantity || 0), 0);
}

export function normalizeOrder(order) {
  const items = buildOrderItemsSnapshot(order.items || []);
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

export const seedOrders = [
  normalizeOrder({
    id: 'o-1774804180283',
    customerId: 'buyer-1',
    customerName: 'Cliente Demo',
    customerPhone: '9610000000',
    deliveryMethod: 'delivery',
    address: 'Avenida Miguel Hidalgo, Tuxtla Gutiérrez, Chiapas',
    addressLabel: 'Avenida Miguel Hidalgo, Bienestar Social, Tuxtla Gutiérrez, Chiapas, México',
    addressLat: 16.74481,
    addressLng: -93.09304,
    addressColony: 'Bienestar Social',
    status: 'pedido_realizado',
    courierId: '',
    courierName: '',
    note: 'Tocar antes de llegar.',
    createdAt: '2026-04-27T09:10:00.000Z',
    items: [
      { productId: 'p-4', quantity: 1 },
      { productId: 'p-7', quantity: 1 },
    ],
  }),
  normalizeOrder({
    id: 'o-demo-1',
    customerId: 'buyer-1',
    customerName: 'QWE',
    customerPhone: '9611111111',
    deliveryMethod: 'delivery',
    address: 'Centro, Tuxtla Gutiérrez, Chiapas',
    addressLabel: 'Centro, Tuxtla Gutiérrez, Chiapas, México',
    addressLat: 16.7516,
    addressLng: -93.1166,
    addressColony: 'Centro',
    status: 'en_transito',
    courierId: 'courier-1',
    courierName: 'Repartidor Demo',
    courierLat: 16.7493,
    courierLng: -93.1108,
    lastLocationAt: '2026-04-27T08:55:00.000Z',
    note: 'Entregar en recepción.',
    createdAt: '2026-04-27T08:30:00.000Z',
    items: [
      { productId: 'p-1', quantity: 1 },
      { productId: 'p-10', quantity: 2 },
    ],
  }),
  normalizeOrder({
    id: 'o-demo-2',
    customerId: 'buyer-1',
    customerName: 'Cliente Feria',
    customerPhone: '9612222222',
    deliveryMethod: 'pickup',
    pickupStoreId: 'store-chiapa-corzo',
    pickupStoreName: 'MercadoLocal Chiapa de Corzo',
    address: 'Tienda MercadoLocal, Chiapa de Corzo, Chiapas',
    addressLabel: 'MercadoLocal Chiapa de Corzo, Centro, Chiapa de Corzo, Chiapas',
    pickupStoreLat: 16.7076,
    pickupStoreLng: -93.011,
    status: 'listo_recoger',
    courierId: '',
    courierName: '',
    note: 'Mostrar código al llegar.',
    createdAt: '2026-04-26T19:15:00.000Z',
    items: [
      { productId: 'p-6', quantity: 1 },
    ],
  }),
];

export function sortOrdersByDate(orderList) {
  return [...orderList].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
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

export function getSellerActiveCarts(sellerId) {
  return activeCarts
    .map((cart) => {
      const items = cart.items
        .map((item) => {
          const product = getProductById(item.productId);
          if (!product || product.sellerId !== sellerId) return null;
          return {
            ...item,
            product,
            subtotal: product.price * item.quantity,
          };
        })
        .filter(Boolean);

      const total = items.reduce((sum, item) => sum + item.subtotal, 0);
      const units = items.reduce((sum, item) => sum + item.quantity, 0);
      return items.length ? { ...cart, items, total, units } : null;
    })
    .filter(Boolean);
}

export function getAdminStatsFromOrders(orderList) {
  const normalized = sortOrdersByDate(orderList.map(normalizeOrder));
  return {
    sellers: demoUsers.filter((user) => user.role === 'seller').length,
    couriers: demoUsers.filter((user) => user.role === 'courier').length,
    buyers: demoUsers.filter((user) => user.role === 'buyer').length,
    products: products.length,
    activeCarts: activeCarts.length,
    orders: normalized.length,
    pending: normalized.filter((order) => order.status === 'pedido_realizado' || order.status === 'asignado').length,
    transit: normalized.filter((order) => order.status === 'en_transito').length,
  };
}

