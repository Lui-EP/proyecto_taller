/* ========================================
   MERCADOLOCAL - MAIN JAVASCRIPT
======================================== */

// API Configuration
const API_URL = 'http://localhost:3000/api';
const DEMO_MODE = true;
const PAGE_ROUTES = {
    index: '/',
    login: '/login',
    registro: '/registro',
    catalogo: '/catalogo',
    producto: '/producto',
    checkout: '/checkout',
    favoritos: '/favoritos',
    historial: '/historial',
    seguimientoCliente: '/seguimiento-cliente',
    repartidor: '/repartidor',
    vendedor: '/vendedor',
    seller: '/seller',
    admin: '/admin'
};
const currentPath = (window.location.pathname || '').toLowerCase();
const isAuthPage = currentPath === '/login' || currentPath === '/registro' || currentPath.endsWith('/login.html') || currentPath.endsWith('/registro.html') || currentPath.endsWith('login.html') || currentPath.endsWith('registro.html');
const isProtectedDemoPage =
    currentPath === '/admin' ||
    currentPath === '/vendedor' ||
    currentPath === '/repartidor' ||
    currentPath === '/favoritos' ||
    currentPath === '/historial' ||
    currentPath.endsWith('/admin.html') || currentPath.endsWith('admin.html') ||
    currentPath.endsWith('/vendedor.html') || currentPath.endsWith('vendedor.html') ||
    currentPath.endsWith('/repartidor.html') || currentPath.endsWith('repartidor.html') ||
    currentPath.endsWith('/favoritos.html') || currentPath.endsWith('favoritos.html') ||
    currentPath.endsWith('/historial.html') || currentPath.endsWith('historial.html');

// ========================================
// STATE MANAGEMENT
// ========================================
const AppState = {
    user: null,
    token: localStorage.getItem('token') || (DEMO_MODE && isProtectedDemoPage ? 'demo-token' : null),
    favorites: JSON.parse(localStorage.getItem('favorites') || '[]'),
    cart: JSON.parse(localStorage.getItem('cart') || '[]'),
    viewHistory: JSON.parse(localStorage.getItem('viewHistory') || '[]'),
    accessibilityMode: localStorage.getItem('accessibilityMode') === 'true',
    highContrast: localStorage.getItem('highContrast') === 'true'
};

if (DEMO_MODE && isAuthPage && localStorage.getItem('token') === 'demo-token') {
    localStorage.removeItem('token');
    AppState.token = null;
}

const DemoDB = (() => {
    const users = [
        {
            id: 'u-admin', name: 'Admin MercadoLocal', email: 'admin@mercadolocal.local',
            password: '123456', role: 'admin', status: 'verified', phone: '', curp: '',
            subscription: { plan: 'premium' }, seller_profile: null, created_at: new Date().toISOString()
        },
        {
            id: 'u-seller', name: 'Artesana Luna', email: 'vendedor@mercadolocal.local',
            password: '123456', role: 'seller', status: 'verified', phone: '9510000000', curp: 'LUNA900101MOCRRN01',
            subscription: { plan: 'free' },
            seller_profile: {
                business_name: 'Artesanias Luna',
                description: 'Productos artesanales hechos a mano',
                schedule: 'Lun-Vie 9:00-18:00',
                location: 'Oaxaca, Mexico',
                phone: '9510000000',
                curp: 'LUNA900101MOCRRN01'
            },
            created_at: new Date().toISOString()
        },
        {
            id: 'u-buyer', name: 'Cliente Demo', email: 'cliente@mercadolocal.local',
            password: '123456', role: 'buyer', status: 'new', phone: '', curp: '',
            subscription: { plan: 'free' }, seller_profile: null, created_at: new Date().toISOString()
        },
        {
            id: 'u-courier', name: 'Repartidor Demo', email: 'repartidor@mercadolocal.local',
            password: '123456', role: 'courier', status: 'verified', phone: '9610000000', curp: '',
            subscription: { plan: 'free' }, seller_profile: null,
            last_location: { lat: 16.7516, lng: -93.1166, updated_at: new Date().toISOString() },
            created_at: new Date().toISOString()
        },
        {
            id: 'u-courier-2', name: 'Repartidora Centro', email: 'repartidora2@mercadolocal.local',
            password: '123456', role: 'courier', status: 'verified', phone: '9610000001', curp: '',
            subscription: { plan: 'free' }, seller_profile: null,
            last_location: { lat: 16.7447, lng: -93.0929, updated_at: new Date().toISOString() },
            created_at: new Date().toISOString()
        },
        {
            id: 'u-courier-3', name: 'Repartidor Norte', email: 'repartidor3@mercadolocal.local',
            password: '123456', role: 'courier', status: 'verified', phone: '9610000002', curp: '',
            subscription: { plan: 'free' }, seller_profile: null,
            last_location: { lat: 16.7893, lng: -93.1239, updated_at: new Date().toISOString() },
            created_at: new Date().toISOString()
        }
    ];

    const categories = [
        { id: 'c1', name: 'Alimentos', description: 'Productos alimenticios locales', status: 'approved', created_at: new Date().toISOString() },
        { id: 'c2', name: 'Artesanías', description: 'Artesanías y manualidades', status: 'approved', created_at: new Date().toISOString() },
        { id: 'c3', name: 'Textiles', description: 'Ropa y textiles regionales', status: 'approved', created_at: new Date().toISOString() }
    ];

    const products = [
        {
            id: 'p1', seller_id: 'u-seller', category_id: 'c2', name: 'Canastas de palma',
            description: 'Par de canastas artesanales de palma',
            price: 450, images: ['/img/productos/canastas.jpg'], stock: 18,
            status: 'approved', is_featured: true, is_local_handmade: true, local_handmade_verified: true,
            views: 18, created_at: new Date().toISOString()
        },
        {
            id: 'p2', seller_id: 'u-seller', category_id: 'c1', name: 'Miel org\u00E1nica',
            description: 'Miel pura de floracion local',
            price: 220, images: ['/img/productos/miel.jpg'], stock: 8,
            status: 'approved', is_featured: false, is_local_handmade: true, local_handmade_verified: false,
            views: 11, created_at: new Date().toISOString()
        },
        {
            id: 'p3', seller_id: 'u-seller', category_id: 'c3', name: 'Bolsa textil',
            description: 'Bolsa artesanal tejida a mano',
            price: 380, images: ['/img/productos/bolsa-artesanal.jpg'], stock: 0,
            status: 'approved', is_featured: false, is_local_handmade: true, local_handmade_verified: false,
            views: 4, created_at: new Date().toISOString()
        },
        {
            id: 'p4', seller_id: 'u-seller', category_id: 'c2', name: 'Jarro de barro',
            description: 'Jarro de barro decorado a mano',
            price: 520, images: ['/img/productos/jarro-de-barro.jpg'], stock: 14,
            status: 'approved', is_featured: true, is_local_handmade: true, local_handmade_verified: true,
            views: 34, created_at: new Date().toISOString()
        },
        {
            id: 'p5', seller_id: 'u-seller', category_id: 'c1', name: 'Cafe molido artesanal',
            description: 'Cafe local tostado en lote pequeno',
            price: 190, images: ['/img/productos/cafe.jpg'], stock: 26,
            status: 'approved', is_featured: true, is_local_handmade: true, local_handmade_verified: true,
            views: 29, created_at: new Date().toISOString()
        },
        {
            id: 'p6', seller_id: 'u-seller', category_id: 'c3', name: 'Rebozo de telar',
            description: 'Rebozo tradicional con tejido fino',
            price: 760, images: ['/img/productos/rebozo.jpg'], stock: 6,
            status: 'approved', is_featured: true, is_local_handmade: true, local_handmade_verified: false,
            views: 41, created_at: new Date().toISOString()
        },
        {
            id: 'p7', seller_id: 'u-seller', category_id: 'c2', name: 'Tazas de arcilla',
            description: 'Set de tazas artesanales de arcilla',
            price: 340, images: ['/img/productos/tazas-de-arcilla.jpg'], stock: 19,
            status: 'approved', is_featured: true, is_local_handmade: true, local_handmade_verified: true,
            views: 23, created_at: new Date().toISOString()
        },
        {
            id: 'p8', seller_id: 'u-seller', category_id: 'c2', name: 'Sombrero charro',
            description: 'Sombrero charro artesanal para celebraciones',
            price: 480, images: ['/img/productos/sombrero-charro.jpg'], stock: 11,
            status: 'approved', is_featured: false, is_local_handmade: true, local_handmade_verified: false,
            views: 15, created_at: new Date().toISOString()
        },
        {
            id: 'p9', seller_id: 'u-seller', category_id: 'c2', name: 'Pulsera de ambar',
            description: 'Pulsera artesanal de ambar ajustable',
            price: 410, images: ['/img/productos/pulsera-de-ambar.jpg'], stock: 12,
            status: 'approved', is_featured: true, is_local_handmade: true, local_handmade_verified: true,
            views: 37, created_at: new Date().toISOString()
        },
        {
            id: 'p10', seller_id: 'u-seller', category_id: 'c2', name: 'Molcajete de piedra',
            description: 'Molcajete artesanal con tejolote',
            price: 280, images: ['/img/productos/molcajete.jpg'], stock: 20,
            status: 'approved', is_featured: true, is_local_handmade: true, local_handmade_verified: true,
            views: 32, created_at: new Date().toISOString()
        }
    ];

    const defaultOrders = [
        {
            id: 'o-demo-1',
            user_id: 'u-buyer',
            courier_id: null,
            tracking_token: '',
            status: 'pedido_realizado',
            delivery_method: 'delivery',
            pickup_point: null,
            pickup_status: null,
            stock_reserved: false,
            pickup_reserved_until: '',
            customer: {
                name: 'Cliente Demo',
                email: 'cliente@mercadolocal.local',
                phone: '9610000000',
                address: 'Centro, Tuxtla Gutiérrez, Chiapas'
            },
            items: [
                {
                    product_id: 'p1',
                    name: 'Canastas de palma',
                    quantity: 1,
                    price: 450,
                    image: '/img/productos/canastas.jpg'
                }
            ],
            total: 450,
            location: { lat: 16.749, lng: -93.116 },
            delivery_location: { lat: 16.749, lng: -93.116 },
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
        }
    ];

    let orders = [];
    try {
        const rawOrders = JSON.parse(localStorage.getItem('demoOrders') || '[]');
        orders = Array.isArray(rawOrders) && rawOrders.length ? rawOrders : defaultOrders;
    } catch {
        orders = defaultOrders;
    }

    let carts = [];
    try {
        const rawCarts = JSON.parse(localStorage.getItem('demoCarts') || '[]');
        carts = Array.isArray(rawCarts) ? rawCarts : [];
    } catch {
        carts = [];
    }
    if (!carts.length) {
        carts = loadDemoCarts();
    }

    const favorites = [];
    const reviews = [
        { id: 'r1', product_id: 'p1', user_id: 'u-buyer', user_name: 'Cliente Demo', rating: 5, comment: 'Muy buena calidad', created_at: new Date().toISOString() }
    ];
    const reports = [
        { id: 'rep1', reporter_id: 'u-buyer', reporter_name: 'Cliente Demo', target_type: 'product', target_id: 'p2', reason: 'other', description: 'Solo prueba visual', status: 'pending', admin_notes: '', created_at: new Date().toISOString() }
    ];
    const history = [];

    return { users, categories, products, orders, carts, favorites, reviews, reports, history };
})();

function persistDemoOrders() {
    try {
        localStorage.setItem('demoOrders', JSON.stringify(DemoDB.orders));
    } catch {
        // Ignore persistence errors in demo mode.
    }
}

function persistDemoCarts() {
    try {
        localStorage.setItem('demoCarts', JSON.stringify(DemoDB.carts));
    } catch {
        // Ignore persistence errors in demo mode.
    }
}

function createDemoLocalId(prefix = 'id') {
    const safePrefix = String(prefix || 'id').trim() || 'id';
    const randomPart = Math.random().toString(36).slice(2, 8);
    return `${safePrefix}-${Date.now()}-${randomPart}`;
}

function getDemoGuestCartId() {
    let guestId = localStorage.getItem('demoGuestCartId');
    if (!guestId) {
        guestId = createDemoLocalId('guest');
        localStorage.setItem('demoGuestCartId', guestId);
    }
    return guestId;
}

function normalizeCartItems(items = []) {
    return (Array.isArray(items) ? items : [])
        .map((item) => ({
            product_id: String(item?.product_id || '').trim(),
            quantity: Math.max(1, Number(item?.quantity || 1)),
        }))
        .filter((item) => item.product_id);
}

function loadDemoCarts() {
    try {
        const rawCarts = JSON.parse(localStorage.getItem('demoCarts') || '[]');
        if (Array.isArray(rawCarts) && rawCarts.length) {
            return rawCarts.map((cart) => ({
                ...cart,
                items: normalizeCartItems(cart?.items),
            }));
        }
    } catch {
        // Continue with fallback migration.
    }

    try {
        const legacyCart = JSON.parse(localStorage.getItem('cart') || '[]');
        const items = normalizeCartItems(legacyCart);
        if (!items.length) return [];

        const now = new Date().toISOString();
        return [{
            id: createDemoLocalId('cart'),
            owner_id: `guest:${getDemoGuestCartId()}`,
            user_id: '',
            user_name: 'Invitado',
            user_role: 'guest',
            status: 'active',
            created_at: now,
            updated_at: now,
            items,
        }];
    } catch {
        return [];
    }
}

function getDemoCartOwnerId(user = AppState.user) {
    if (user?.id) {
        return `user:${String(user.id)}`;
    }
    return `guest:${getDemoGuestCartId()}`;
}

function getDemoCartMeta(user = AppState.user) {
    if (user?.id) {
        return {
            user_id: String(user.id),
            user_name: String(user.name || 'Usuario'),
            user_role: String(user.role || 'buyer'),
        };
    }

    return {
        user_id: '',
        user_name: 'Invitado',
        user_role: 'guest',
    };
}

function findDemoCartByOwner(ownerId = '') {
    return DemoDB.carts.find((cart) => String(cart?.owner_id || '') === String(ownerId) && String(cart?.status || 'active') === 'active') || null;
}

function getOrCreateDemoCart(ownerId, meta = getDemoCartMeta()) {
    const existing = findDemoCartByOwner(ownerId);
    if (existing) {
        existing.user_id = meta.user_id || existing.user_id || '';
        existing.user_name = meta.user_name || existing.user_name || 'Invitado';
        existing.user_role = meta.user_role || existing.user_role || 'guest';
        existing.status = 'active';
        existing.items = normalizeCartItems(existing.items);
        return existing;
    }

    const now = new Date().toISOString();
    const cart = {
        id: createDemoLocalId('cart'),
        owner_id: String(ownerId || getDemoCartOwnerId()),
        user_id: meta.user_id || '',
        user_name: meta.user_name || 'Invitado',
        user_role: meta.user_role || 'guest',
        status: 'active',
        created_at: now,
        updated_at: now,
        items: [],
    };
    DemoDB.carts.unshift(cart);
    persistDemoCarts();
    return cart;
}

function syncAppCart(items = []) {
    AppState.cart = normalizeCartItems(items);
    localStorage.setItem('cart', JSON.stringify(AppState.cart));
    updateCartBadge();
    return AppState.cart;
}

function syncCartStateForUser(user = AppState.user) {
    const ownerId = getDemoCartOwnerId(user);
    const cart = findDemoCartByOwner(ownerId);
    return syncAppCart(cart?.items || []);
}

function mergeGuestCartIntoUserCart(user) {
    if (!user?.id) {
        return syncCartStateForUser(user);
    }

    const guestOwnerId = `guest:${getDemoGuestCartId()}`;
    const guestCart = findDemoCartByOwner(guestOwnerId);
    const userOwnerId = getDemoCartOwnerId(user);
    const userCart = getOrCreateDemoCart(userOwnerId, getDemoCartMeta(user));

    if (guestCart && guestCart.items.length) {
        guestCart.items.forEach((item) => {
            const product = getProductById(item.product_id);
            const stock = getProductStock(product);
            if (stock <= 0) return;
            const existing = userCart.items.find((entry) => entry.product_id === item.product_id);
            const currentQty = Number(existing?.quantity || 0);
            const nextQty = Math.min(stock, currentQty + Math.max(1, Number(item.quantity || 1)));
            if (existing) {
                existing.quantity = nextQty;
            } else {
                userCart.items.push({
                    product_id: item.product_id,
                    quantity: nextQty,
                });
            }
        });

        userCart.items = normalizeCartItems(userCart.items);
        userCart.updated_at = new Date().toISOString();
        guestCart.items = [];
        guestCart.updated_at = userCart.updated_at;
        persistDemoCarts();
    }

    return syncCartStateForUser(user);
}

function syncCartAfterAuth(user = AppState.user) {
    if (user?.role === 'buyer') {
        return mergeGuestCartIntoUserCart(user);
    }
    return syncCartStateForUser(user);
}

function hydrateCartForResponse(cart = null) {
    const items = normalizeCartItems(cart?.items);
    return {
        id: cart?.id || '',
        owner_id: cart?.owner_id || getDemoCartOwnerId(),
        user_id: cart?.user_id || '',
        user_name: cart?.user_name || 'Invitado',
        user_role: cart?.user_role || 'guest',
        status: cart?.status || 'active',
        created_at: cart?.created_at || '',
        updated_at: cart?.updated_at || '',
        items,
        items_count: items.reduce((sum, item) => sum + Math.max(0, Number(item.quantity || 0)), 0),
    };
}

function hydrateSellerCartPreview(cart, currentUser) {
    const items = normalizeCartItems(cart?.items)
        .map((item) => {
            const product = demoHydrateProduct(getProductById(item.product_id));
            if (!product) return null;
            return {
                product_id: item.product_id,
                quantity: Math.max(1, Number(item.quantity || 1)),
                name: product.name || 'Producto',
                price: Number(product.price || 0),
                image: product.images?.[0] || '',
                seller_id: String(product.seller_id || ''),
                stock: Number(product.stock || 0),
            };
        })
        .filter(Boolean);

    const sellerItems = currentUser?.role === 'admin'
        ? items
        : items.filter((item) => item.seller_id === String(currentUser?.id || ''));

    const sellerTotal = sellerItems.reduce((sum, item) => sum + (Number(item.price || 0) * Number(item.quantity || 0)), 0);
    const sellerUnits = sellerItems.reduce((sum, item) => sum + Number(item.quantity || 0), 0);

    return {
        id: cart?.id || '',
        user_id: cart?.user_id || '',
        user_name: cart?.user_name || 'Invitado',
        user_role: cart?.user_role || 'guest',
        created_at: cart?.created_at || '',
        updated_at: cart?.updated_at || '',
        items: sellerItems,
        seller_total: sellerTotal,
        seller_units: sellerUnits,
    };
}

function demoCurrentUser() {
    const path = (window.location.pathname || '').toLowerCase();
    const savedId = localStorage.getItem('demoUserId');
    const byId = DemoDB.users.find(u => u.id === savedId);
    if (byId) return JSON.parse(JSON.stringify(byId));
    if (path.includes('admin')) return JSON.parse(JSON.stringify(DemoDB.users.find(u => u.role === 'admin')));
    if (path.includes('vendedor')) return JSON.parse(JSON.stringify(DemoDB.users.find(u => u.role === 'seller')));
    if (path.includes('repartidor')) return JSON.parse(JSON.stringify(DemoDB.users.find(u => u.role === 'courier')));
    return JSON.parse(JSON.stringify(DemoDB.users.find(u => u.role === 'buyer')));
}

const ORDER_STATUS_LABELS = {
    pedido_realizado: 'Pedido realizado',
    en_transito: 'En tránsito',
    entregado: 'Entregado',
    cancelado_no_show: 'Cancelado (cliente no vino)'
};

function normalizeOrderStatus(value) {
    if (value === 'Pedido realizado' || value === 'pedido_realizado') return 'pedido_realizado';
    if (value === 'En tránsito' || value === 'en_transito') return 'en_transito';
    if (value === 'Entregado' || value === 'entregado') return 'entregado';
    if (value === 'cancelado_no_show' || value === 'Cancelado (cliente no vino)') return 'cancelado_no_show';
    return 'pedido_realizado';
}

function isUserActiveStatus(status) {
    const safe = String(status || '').toLowerCase();
    return ['verified', 'active', 'approved'].includes(safe);
}

function getOrderStatusLabel(value) {
    return ORDER_STATUS_LABELS[normalizeOrderStatus(value)] || ORDER_STATUS_LABELS.pedido_realizado;
}

function normalizeDeliveryMethod(value) {
    return String(value || '').toLowerCase() === 'pickup' ? 'pickup' : 'delivery';
}

function normalizePickupStatus(value) {
    const safe = String(value || '').toLowerCase();
    if (safe === 'recogido') return 'recogido';
    if (safe === 'cancelado_no_show') return 'cancelado_no_show';
    return 'pendiente_recoleccion';
}

function getProductById(productId) {
    return DemoDB.products.find(product => product.id === productId) || null;
}

function resolveItemSellerId(item) {
    if (item?.seller_id) return String(item.seller_id);
    const sourceProduct = getProductById(item?.product_id || '');
    return sourceProduct?.seller_id || '';
}

function getOrderItemsForSeller(order, sellerId = '') {
    const safeSellerId = String(sellerId || '').trim();
    const items = Array.isArray(order?.items) ? order.items : [];
    if (!safeSellerId) return items;
    return items.filter(item => resolveItemSellerId(item) === safeSellerId);
}

function reserveOrderStock(items = []) {
    items.forEach((item) => {
        const product = getProductById(item.product_id);
        if (!product) throw new Error(`Producto no encontrado: ${item.product_id}`);

        const availableStock = getProductStock(product);
        if (availableStock < item.quantity) {
            throw new Error(`Stock insuficiente para "${product.name}". Disponible: ${availableStock}`);
        }
    });

    items.forEach((item) => {
        const product = getProductById(item.product_id);
        product.stock = Math.max(0, Number(product.stock || 0) - Number(item.quantity || 0));
    });
}

function releaseOrderStockItems(items = []) {
    items.forEach((item) => {
        if (item.stock_released) return;
        const product = getProductById(item.product_id);
        if (!product) return;
        product.stock = Math.max(0, Number(product.stock || 0) + Number(item.quantity || 0));
        item.stock_released = true;
    });
}

function canSellerManagePickupOrder(order, currentUser) {
    if (!currentUser?.id) return false;
    if (currentUser.role === 'admin') return true;
    if (currentUser.role !== 'seller') return false;
    return getOrderItemsForSeller(order, currentUser.id).length > 0;
}

function markOrderPickupCollected(order, currentUser) {
    if (normalizeDeliveryMethod(order.delivery_method) !== 'pickup') {
        throw new Error('Este pedido no es para recoger en tienda');
    }

    const targetItems = currentUser.role === 'admin'
        ? getOrderItemsForSeller(order)
        : getOrderItemsForSeller(order, currentUser.id);

    const pendingItems = targetItems.filter(item => !item.stock_released && !item.picked_up);
    if (!pendingItems.length) {
        throw new Error('No hay productos pendientes por confirmar');
    }

    pendingItems.forEach((item) => {
        item.picked_up = true;
    });

    const hasRemainingPending = getOrderItemsForSeller(order).some(item => !item.stock_released && !item.picked_up);
    if (!hasRemainingPending) {
        order.pickup_status = 'recogido';
        order.status = 'entregado';
        order.stock_reserved = false;
    }

    order.updated_at = new Date().toISOString();
}

function markOrderPickupNoShow(order, currentUser) {
    if (normalizeDeliveryMethod(order.delivery_method) !== 'pickup') {
        throw new Error('Este pedido no es para recoger en tienda');
    }

    const targetItems = currentUser.role === 'admin'
        ? getOrderItemsForSeller(order)
        : getOrderItemsForSeller(order, currentUser.id);

    const pendingItems = targetItems.filter(item => !item.stock_released && !item.picked_up);
    if (!pendingItems.length) {
        throw new Error('No hay productos pendientes por liberar');
    }

    releaseOrderStockItems(pendingItems);

    const hasRemainingPending = getOrderItemsForSeller(order).some(item => !item.stock_released && !item.picked_up);
    if (!hasRemainingPending) {
        order.pickup_status = 'cancelado_no_show';
        order.status = 'cancelado_no_show';
        order.stock_reserved = false;
    }

    order.updated_at = new Date().toISOString();
}

function releaseExpiredPickupReservations() {
    const now = Date.now();
    let changed = false;

    DemoDB.orders.forEach((order) => {
        if (normalizeDeliveryMethod(order.delivery_method) !== 'pickup') return;
        if (normalizePickupStatus(order.pickup_status) !== 'pendiente_recoleccion') return;

        const expiresAt = Date.parse(order.pickup_reserved_until || '');
        if (!Number.isFinite(expiresAt) || expiresAt > now) return;

        const pendingItems = getOrderItemsForSeller(order).filter(item => !item.stock_released && !item.picked_up);
        if (pendingItems.length) {
            releaseOrderStockItems(pendingItems);
            changed = true;
        }

        order.pickup_status = 'cancelado_no_show';
        order.status = 'cancelado_no_show';
        order.stock_reserved = false;
        order.updated_at = new Date().toISOString();
        changed = true;
    });

    if (changed) {
        persistDemoOrders();
    }
}

function demoHydrateOrder(order) {
    const courier = DemoDB.users.find(u => u.id === order.courier_id) || null;
    const hasDeliveryLocation = Number.isFinite(Number(order.delivery_location?.lat)) && Number.isFinite(Number(order.delivery_location?.lng));
    const deliveryMethod = normalizeDeliveryMethod(order.delivery_method);
    const items = Array.isArray(order.items)
        ? order.items.map((item) => ({
            ...item,
            seller_id: resolveItemSellerId(item),
            stock_released: !!item.stock_released,
            picked_up: !!item.picked_up,
        }))
        : [];
    return {
        ...order,
        items,
        status: normalizeOrderStatus(order.status),
        status_label: getOrderStatusLabel(order.status),
        delivery_method: deliveryMethod,
        pickup_point: order.pickup_point || null,
        pickup_status: deliveryMethod === 'pickup' ? normalizePickupStatus(order.pickup_status) : null,
        pickup_reserved_until: order.pickup_reserved_until || '',
        stock_reserved: !!order.stock_reserved,
        courier_name: courier?.name || 'Sin repartidor',
        location: {
            lat: Number(order.location?.lat ?? 16.749),
            lng: Number(order.location?.lng ?? -93.116)
        },
        delivery_location: hasDeliveryLocation
            ? {
                lat: Number(order.delivery_location.lat),
                lng: Number(order.delivery_location.lng)
            }
            : {
                lat: Number(order.location?.lat ?? 16.749),
                lng: Number(order.location?.lng ?? -93.116)
            }
    };
}

function canEditDemoOrder(order, currentUser) {
    if (!currentUser?.id) return false;
    if (currentUser.role === 'admin') return true;
    if (currentUser.role !== 'courier') return false;
    return !order.courier_id || order.courier_id === currentUser.id;
}

function canAssignDemoOrder(order, currentUser) {
    if (!currentUser?.id) return false;
    if (currentUser.role === 'admin') return true;
    if (currentUser.role !== 'courier') return false;
    if (!order.courier_id) return true;
    return order.courier_id === currentUser.id;
}

function orderDistanceFrom(coordsA, coordsB) {
    const lat1 = Number(coordsA?.lat);
    const lng1 = Number(coordsA?.lng);
    const lat2 = Number(coordsB?.lat);
    const lng2 = Number(coordsB?.lng);
    if (!Number.isFinite(lat1) || !Number.isFinite(lng1) || !Number.isFinite(lat2) || !Number.isFinite(lng2)) {
        return null;
    }

    const toRad = (value) => (value * Math.PI) / 180;
    const dLat = toRad(lat2 - lat1);
    const dLng = toRad(lng2 - lng1);
    const a = Math.sin(dLat / 2) ** 2
        + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return 6371 * c;
}

function enrichOrderDistanceForCourier(order, currentUser) {
    if (!currentUser || currentUser.role !== 'courier') return order;
    const courierLat = Number(currentUser.last_location?.lat ?? currentUser.location?.lat ?? 16.749);
    const courierLng = Number(currentUser.last_location?.lng ?? currentUser.location?.lng ?? -93.116);
    const target = order.delivery_location || order.location || {};
    const distanceKm = orderDistanceFrom({ lat: courierLat, lng: courierLng }, target);
    return {
        ...order,
        distance_km: Number.isFinite(distanceKm) ? Number(distanceKm.toFixed(3)) : null
    };
}

function assignOrderToCourier(order, courierId) {
    order.courier_id = courierId || null;
    order.updated_at = new Date().toISOString();
}

function persistCourierLastLocation(currentUser, coords) {
    if (!currentUser?.id || currentUser.role !== 'courier') return;
    const user = DemoDB.users.find(item => item.id === currentUser.id);
    if (!user) return;
    user.last_location = {
        lat: Number(coords.lat),
        lng: Number(coords.lng),
        updated_at: new Date().toISOString()
    };
}

function normalizeCourierSelection(order, currentUser) {
    const hydrated = demoHydrateOrder(order);
    return enrichOrderDistanceForCourier(hydrated, currentUser);
}

function sortOrdersForCourier(list) {
    return [...list].sort((a, b) => {
        const statusA = normalizeOrderStatus(a.status);
        const statusB = normalizeOrderStatus(b.status);
        const priority = (status) => {
            if (status === 'en_transito') return 0;
            if (status === 'pedido_realizado') return 1;
            return 2;
        };
        const byStatus = priority(statusA) - priority(statusB);
        if (byStatus !== 0) return byStatus;

        const distanceA = Number(a.distance_km);
        const distanceB = Number(b.distance_km);
        const hasDistanceA = Number.isFinite(distanceA);
        const hasDistanceB = Number.isFinite(distanceB);
        if (hasDistanceA && hasDistanceB) return distanceA - distanceB;
        if (hasDistanceA) return -1;
        if (hasDistanceB) return 1;
        return new Date(b.created_at) - new Date(a.created_at);
    });
}

function orderCanBeListedForCourier(order, courierId) {
    if (normalizeDeliveryMethod(order.delivery_method) === 'pickup') return false;
    const status = normalizeOrderStatus(order.status);
    if (status === 'entregado' || status === 'cancelado_no_show') return false;
    if (!order.courier_id) return true;
    return order.courier_id === courierId;
}

function enrichOrdersListForUser(list, currentUser) {
    const hydrated = list.map(order => normalizeCourierSelection(order, currentUser));
    if (currentUser?.role === 'courier') {
        return sortOrdersForCourier(hydrated);
    }
    return hydrated.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
}

function parseCoordinatesFromRequest(url, body) {
    const latValue = url.searchParams.get('lat') ?? body.lat;
    const lngValue = url.searchParams.get('lng') ?? body.lng;
    const lat = Number(latValue);
    const lng = Number(lngValue);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) throw new Error('Coordenadas inválidas');
    return { lat, lng };
}

function resolveOrderById(path) {
    const id = path.split('/')[2];
    return DemoDB.orders.find(item => item.id === id);
}

function demoEnsureOrderForCourier(order, currentUser) {
    if (!canAssignDemoOrder(order, currentUser)) {
        throw new Error('Pedido tomado por otro repartidor');
    }
    if (!order.courier_id && currentUser.role === 'courier') {
        assignOrderToCourier(order, currentUser.id);
    }
}

function getOrdersByCourierVisibility(currentUser) {
    if (!currentUser?.id) return [];
    if (currentUser.role === 'admin') return [...DemoDB.orders];
    if (currentUser.role === 'courier') {
        return DemoDB.orders.filter(order => orderCanBeListedForCourier(order, currentUser.id));
    }
    if (DEMO_MODE) {
        // Demo local: permite visualizar pedidos para pruebas de UI.
        return [...DemoDB.orders];
    }
    return [];
}

function getCourierById(courierId) {
    return DemoDB.users.find(item => item.role === 'courier' && item.id === courierId) || null;
}

function hydrateOrdersForResponse(list, currentUser) {
    return enrichOrdersListForUser(list, currentUser);
}

function setOrderLocation(order, coords) {
    order.location = { lat: Number(coords.lat), lng: Number(coords.lng) };
    order.updated_at = new Date().toISOString();
}

function buildOrderDeliveryLocation(requestedLat, requestedLng, hasRequestedLocation) {
    if (hasRequestedLocation) {
        return {
            lat: Number(requestedLat),
            lng: Number(requestedLng)
        }
    };
    return { lat: 16.749, lng: -93.116 };
}

function canViewDemoOrder(order, currentUser, token = '') {
    const safeToken = String(token || '').trim();
    if (currentUser?.role === 'admin') return true;
    if (currentUser?.role === 'courier' && order.courier_id === currentUser.id) return true;
    if (currentUser?.id && order.user_id === currentUser.id) return true;
    if (safeToken && order.tracking_token && safeToken === order.tracking_token) return true;
    return false;
}

function demoHydrateProduct(product) {
    const category = DemoDB.categories.find(c => c.id === product.category_id) || null;
    const seller = DemoDB.users.find(u => u.id === product.seller_id) || null;
    const productReviews = DemoDB.reviews.filter(r => r.product_id === product.id);
    const sellerProducts = DemoDB.products.filter(p => p.seller_id === product.seller_id);
    const sellerProductIds = new Set(sellerProducts.map(p => p.id));
    const sellerReviews = DemoDB.reviews.filter(r => sellerProductIds.has(r.product_id));
    const sellerAverage = sellerReviews.length
        ? sellerReviews.reduce((sum, r) => sum + Number(r.rating || 0), 0) / sellerReviews.length
        : 0;
    const average = productReviews.length ? productReviews.reduce((a, b) => a + Number(b.rating || 0), 0) / productReviews.length : 0;
    const favoritesCount = DemoDB.favorites.filter(f => f.product_id === product.id).length;
    const stock = getProductStock(product);

    return {
        ...product,
        category: category ? { id: category.id, name: category.name } : null,
        seller_name: seller?.name || 'Vendedor Local',
        seller: seller ? {
            id: seller.id,
            name: seller.name,
            status: seller.status,
            seller_profile: seller.seller_profile || {},
            average_rating: Number(sellerAverage.toFixed(1)),
            total_products: sellerProducts.length,
            total_reviews: sellerReviews.length
        } : null,
        reviews: productReviews.map(r => ({ ...r })),
        average_rating: Number(average.toFixed(1)),
        favorites_count: favoritesCount,
        stock,
        availability: getProductAvailability(product)
    };
}

function demoParseBody(options) {
    if (!options?.body) return {};
    try { return JSON.parse(options.body); } catch { return {}; }
}

function demoResponse(data) {
    return Promise.resolve(JSON.parse(JSON.stringify(data)));
}

async function demoApiRequest(endpoint, options = {}) {
    const url = new URL(endpoint, 'http://demo.local');
    const path = url.pathname;
    const method = (options.method || 'GET').toUpperCase();
    const body = demoParseBody(options);
    const currentUser = AppState.user || demoCurrentUser();

    releaseExpiredPickupReservations();

    if (path === '/auth/me' && method === 'GET') {
        return demoResponse(currentUser);
    }

    if (path === '/auth/login' && method === 'POST') {
        const user = DemoDB.users.find(u => u.email === body.email && u.password === body.password);
        if (!user) throw new Error('Credenciales inválidas');
        localStorage.setItem('demoUserId', user.id);
        return demoResponse({ token: 'demo-token', user });
    }

    if (path === '/auth/register' && method === 'POST') {
        const newUser = {
            id: `u-${Date.now()}`,
            name: body.name || 'Usuario',
            email: body.email,
            password: body.password,
            role: body.role === 'seller' ? 'seller' : 'buyer',
            status: 'new',
            phone: body.phone || '',
            curp: body.curp || '',
            subscription: { plan: 'free' },
            seller_profile: body.role === 'seller' ? { business_name: '', description: '', schedule: '', location: body.location || '', phone: body.phone || '', curp: body.curp || '' } : null,
            created_at: new Date().toISOString()
        };
        DemoDB.users.push(newUser);
        localStorage.setItem('demoUserId', newUser.id);
        return demoResponse({ token: 'demo-token', user: newUser });
    }

    if (path === '/cart' && method === 'GET') {
        const cart = findDemoCartByOwner(getDemoCartOwnerId(AppState.user));
        syncAppCart(cart?.items || []);
        return demoResponse(hydrateCartForResponse(cart));
    }

    if (path === '/cart/items' && method === 'POST') {
        const productId = String(body.product_id || '').trim();
        const product = getProductById(productId);
        if (!product) throw new Error('Producto no encontrado');

        const stock = getProductStock(product);
        if (stock <= 0) throw new Error('Este producto no está disponible');

        const ownerId = getDemoCartOwnerId(AppState.user);
        const cart = getOrCreateDemoCart(ownerId, getDemoCartMeta(AppState.user));
        const incomingQty = Math.max(1, Number(body.quantity || 1));
        const existing = cart.items.find((item) => item.product_id === productId);
        const currentQty = Number(existing?.quantity || 0);
        const nextQty = Math.min(stock, currentQty + incomingQty);

        if (existing) {
            existing.quantity = nextQty;
        } else {
            cart.items.push({ product_id: productId, quantity: nextQty });
        }

        cart.items = normalizeCartItems(cart.items);
        cart.updated_at = new Date().toISOString();
        persistDemoCarts();
        syncAppCart(cart.items);
        return demoResponse(hydrateCartForResponse(cart));
    }

    if (path.startsWith('/cart/items/') && method === 'PUT') {
        const productId = decodeURIComponent(path.split('/')[3] || '').trim();
        const product = getProductById(productId);
        if (!product) throw new Error('Producto no encontrado');

        const ownerId = getDemoCartOwnerId(AppState.user);
        const cart = getOrCreateDemoCart(ownerId, getDemoCartMeta(AppState.user));
        const existing = cart.items.find((item) => item.product_id === productId);
        if (!existing) throw new Error('Producto no está en el carrito');

        const stock = getProductStock(product);
        const qty = Math.max(0, Number(body.quantity || 0));
        if (qty <= 0) {
            cart.items = cart.items.filter((item) => item.product_id !== productId);
        } else {
            existing.quantity = Math.min(stock, qty);
        }

        cart.items = normalizeCartItems(cart.items);
        cart.updated_at = new Date().toISOString();
        persistDemoCarts();
        syncAppCart(cart.items);
        return demoResponse(hydrateCartForResponse(cart));
    }

    if (path.startsWith('/cart/items/') && method === 'DELETE') {
        const productId = decodeURIComponent(path.split('/')[3] || '').trim();
        const ownerId = getDemoCartOwnerId(AppState.user);
        const cart = getOrCreateDemoCart(ownerId, getDemoCartMeta(AppState.user));
        cart.items = normalizeCartItems(cart.items).filter((item) => item.product_id !== productId);
        cart.updated_at = new Date().toISOString();
        persistDemoCarts();
        syncAppCart(cart.items);
        return demoResponse(hydrateCartForResponse(cart));
    }

    if (path === '/cart' && method === 'DELETE') {
        const ownerId = getDemoCartOwnerId(AppState.user);
        const cart = getOrCreateDemoCart(ownerId, getDemoCartMeta(AppState.user));
        cart.items = [];
        cart.updated_at = new Date().toISOString();
        persistDemoCarts();
        syncAppCart([]);
        return demoResponse(hydrateCartForResponse(cart));
    }

    if (path === '/categories' && method === 'GET') {
        return demoResponse(DemoDB.categories);
    }

    if (path === '/categories' && method === 'POST') {
        const category = { id: `c-${Date.now()}`, name: body.name, description: body.description || '', status: 'pending', created_at: new Date().toISOString() };
        DemoDB.categories.push(category);
        return demoResponse(category);
    }

    if (path.startsWith('/categories/') && path.endsWith('/status') && method === 'PUT') {
        const id = path.split('/')[2];
        const status = url.searchParams.get('status');
        const item = DemoDB.categories.find(c => c.id === id);
        if (item) item.status = status || item.status;
        return demoResponse(item || { ok: true });
    }

    if (path.startsWith('/categories/') && method === 'DELETE') {
        const id = path.split('/')[2];
        const idx = DemoDB.categories.findIndex(c => c.id === id);
        if (idx >= 0) DemoDB.categories.splice(idx, 1);
        return demoResponse({ ok: true });
    }

    if (path === '/products/featured' && method === 'GET') {
        return demoResponse(DemoDB.products.filter(p => p.is_featured && p.status === 'approved').map(demoHydrateProduct));
    }

    if (path === '/products/seller' && method === 'GET') {
        return demoResponse(DemoDB.products.filter(p => p.seller_id === currentUser.id).map(demoHydrateProduct));
    }

    if (path === '/products' && method === 'GET') {
        let list = DemoDB.products.map(demoHydrateProduct);
        const isAdmin = currentUser?.role === 'admin';
        const reqStatus = url.searchParams.get('status');

        if (url.searchParams.get('search')) {
            const q = url.searchParams.get('search').toLowerCase();
            list = list.filter(p => p.name.toLowerCase().includes(q) || (p.description || '').toLowerCase().includes(q));
        }
        if (url.searchParams.get('category_id')) list = list.filter(p => p.category_id === url.searchParams.get('category_id'));
        if (url.searchParams.get('seller_id')) list = list.filter(p => p.seller_id === url.searchParams.get('seller_id'));
        if (url.searchParams.get('max_price')) list = list.filter(p => Number(p.price) <= Number(url.searchParams.get('max_price')));
        if (url.searchParams.get('is_local_handmade') === 'true') list = list.filter(p => p.is_local_handmade);
        if (url.searchParams.get('is_featured') === 'true') list = list.filter(p => p.is_featured);

        if (reqStatus && isAdmin) list = list.filter(p => p.status === reqStatus);
        else list = list.filter(p => p.status === 'approved' || (currentUser?.role === 'seller' && p.seller_id === currentUser.id));

        const sortBy = url.searchParams.get('sort_by') || 'created_at';
        if (sortBy === 'price') list.sort((a, b) => Number(a.price) - Number(b.price));
        else if (sortBy === 'views') list.sort((a, b) => Number(b.views || 0) - Number(a.views || 0));
        else list.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

        const skip = Number(url.searchParams.get('skip') || 0);
        const limit = Number(url.searchParams.get('limit') || list.length || 50);
        return demoResponse({ products: list.slice(skip, skip + limit), total: list.length });
    }

    if (path === '/products' && method === 'POST') {
        const product = {
            id: `p-${Date.now()}`,
            seller_id: currentUser.id,
            category_id: body.category_id,
            name: body.name,
            description: body.description || '',
            price: Number(body.price || 0),
            images: Array.isArray(body.images) ? body.images : [],
            stock: Math.max(0, Number(body.stock || 0)),
            status: 'pending',
            is_featured: false,
            is_local_handmade: !!body.is_local_handmade,
            local_handmade_verified: false,
            views: 0,
            created_at: new Date().toISOString()
        };
        DemoDB.products.unshift(product);
        return demoResponse(demoHydrateProduct(product));
    }

    if (path.startsWith('/products/') && method === 'GET') {
        const id = path.split('/')[2];
        const product = DemoDB.products.find(p => p.id === id);
        if (!product) throw new Error('Producto no encontrado');
        product.views = (product.views || 0) + 1;
        if (currentUser) {
            const idx = DemoDB.history.findIndex(h => h.user_id === currentUser.id && h.product_id === id);
            if (idx >= 0) DemoDB.history.splice(idx, 1);
            DemoDB.history.unshift({ user_id: currentUser.id, product_id: id, viewed_at: new Date().toISOString() });
        }
        return demoResponse(demoHydrateProduct(product));
    }

    if (path.startsWith('/products/') && method === 'PUT') {
        const id = path.split('/')[2];
        const product = DemoDB.products.find(p => p.id === id);
        if (!product) throw new Error('Producto no encontrado');
        Object.assign(product, {
            name: body.name ?? product.name,
            description: body.description ?? product.description,
            price: body.price ?? product.price,
            category_id: body.category_id ?? product.category_id,
            images: Array.isArray(body.images) ? body.images : product.images,
            stock: body.stock !== undefined ? Math.max(0, Number(body.stock)) : product.stock,
            is_local_handmade: typeof body.is_local_handmade === 'boolean' ? body.is_local_handmade : product.is_local_handmade,
            actualizado_en: new Date().toISOString()
        });
        return demoResponse(demoHydrateProduct(product));
    }

    if (path.startsWith('/products/') && method === 'DELETE') {
        const id = path.split('/')[2];
        const idx = DemoDB.products.findIndex(p => p.id === id);
        if (idx >= 0) DemoDB.products.splice(idx, 1);
        return demoResponse({ ok: true });
    }

    if (path.startsWith('/products/') && path.endsWith('/feature') && method === 'POST') {
        const id = path.split('/')[2];
        const p = DemoDB.products.find(x => x.id === id);
        if (p) p.is_featured = true;
        return demoResponse(p ? demoHydrateProduct(p) : { ok: true });
    }

    if (path.startsWith('/favorites/') && method === 'POST') {
        const productId = path.split('/')[2];
        if (!DemoDB.favorites.find(f => f.user_id === currentUser.id && f.product_id === productId)) {
            DemoDB.favorites.push({ user_id: currentUser.id, product_id: productId, created_at: new Date().toISOString() });
        }
        return demoResponse({ ok: true });
    }

    if (path.startsWith('/favorites/') && method === 'DELETE') {
        const productId = path.split('/')[2];
        const idx = DemoDB.favorites.findIndex(f => f.user_id === currentUser.id && f.product_id === productId);
        if (idx >= 0) DemoDB.favorites.splice(idx, 1);
        return demoResponse({ ok: true });
    }

    if (path === '/favorites' && method === 'GET') {
        const list = DemoDB.favorites
            .filter(f => f.user_id === currentUser.id)
            .map(f => DemoDB.products.find(p => p.id === f.product_id))
            .filter(Boolean)
            .map(demoHydrateProduct);
        return demoResponse(list);
    }

    if (path === '/history' && method === 'GET') {
        const list = DemoDB.history
            .filter(h => h.user_id === currentUser.id)
            .sort((a, b) => new Date(b.viewed_at) - new Date(a.viewed_at))
            .map(h => DemoDB.products.find(p => p.id === h.product_id))
            .filter(Boolean)
            .map(demoHydrateProduct);
        return demoResponse(list);
    }

    if (path === '/orders' && method === 'POST') {
        const parsedItems = Array.isArray(body.items) ? body.items : [];
        const items = parsedItems.map((item) => {
            const productId = String(item.product_id || '').trim();
            const product = getProductById(productId);
            if (!product) throw new Error(`Producto no encontrado: ${productId || 'sin id'}`);

            const quantity = Math.max(1, Number(item.quantity || 1));
            const availableStock = getProductStock(product);
            if (quantity > availableStock) {
                throw new Error(`Stock insuficiente para "${product.name}". Disponible: ${availableStock}`);
            }

            return {
                product_id: productId,
                seller_id: product.seller_id || '',
                name: item.name || product.name || 'Producto',
                quantity,
                price: Number(item.price || product.price || 0),
                image: item.image || product.images?.[0] || '',
                stock_released: false,
                picked_up: false
            };
        });
        if (!items.length) throw new Error('El pedido no contiene productos');

        const calculatedTotal = items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
        const total = Number(body.total || calculatedTotal || 0);
        const isGuestCheckout = !AppState.user;
        const trackingToken = isGuestCheckout ? `tk-${Math.random().toString(36).slice(2, 10)}` : '';
        const now = new Date().toISOString();
        const deliveryMethod = normalizeDeliveryMethod(body.delivery_method);
        const pickupPoint = deliveryMethod === 'pickup' && body.pickup_point
            ? {
                id: body.pickup_point.id || '',
                name: body.pickup_point.name || 'Tienda',
                location: body.pickup_point.location || 'Ubicación de tienda por confirmar'
            }
            : null;
        const pickupReservedUntil = deliveryMethod === 'pickup'
            ? new Date(Date.now() + (2 * 60 * 60 * 1000)).toISOString()
            : '';

        const requestedLat = Number(body.location?.lat);
        const requestedLng = Number(body.location?.lng);
        const hasRequestedLocation = Number.isFinite(requestedLat) && Number.isFinite(requestedLng);
        const deliveryLocation = buildOrderDeliveryLocation(requestedLat, requestedLng, hasRequestedLocation);

        const order = {
            id: `o-${Date.now()}`,
            user_id: isGuestCheckout ? null : (currentUser?.id || null),
            courier_id: null,
            tracking_token: trackingToken,
            status: 'pedido_realizado',
            delivery_method: deliveryMethod,
            pickup_point: pickupPoint,
            pickup_status: deliveryMethod === 'pickup' ? 'pendiente_recoleccion' : null,
            pickup_reserved_until: pickupReservedUntil,
            stock_reserved: true,
            customer: {
                name: body.customer?.name || currentUser?.name || 'Cliente',
                email: body.customer?.email || currentUser?.email || '',
                phone: body.customer?.phone || currentUser?.phone || '',
                address: body.customer?.address || ''
            },
            items,
            total,
            location: { ...deliveryLocation },
            delivery_location: { ...deliveryLocation },
            created_at: now,
            updated_at: now
        };

        reserveOrderStock(items);
        DemoDB.orders.unshift(order);
        persistDemoOrders();
        const hydrated = normalizeCourierSelection(order, currentUser);
        return demoResponse({ ...hydrated, guest_token: trackingToken });
    }

    if (path === '/orders/my' && method === 'GET') {
        if (!currentUser?.id) return demoResponse([]);
        const list = DemoDB.orders
            .filter(order => order.user_id === currentUser.id)
            .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
            .map(demoHydrateOrder);
        return demoResponse(list);
    }

    if (path === '/orders/assigned' && method === 'GET') {
        const list = getOrdersByCourierVisibility(currentUser);
        return demoResponse(hydrateOrdersForResponse(list, currentUser));
    }

    if (path === '/seller/orders/pickup-pending' && method === 'GET') {
        if (!currentUser?.id || !['seller', 'admin'].includes(currentUser.role)) {
            throw new Error('No autorizado');
        }
        const list = DemoDB.orders
            .filter(order => normalizeDeliveryMethod(order.delivery_method) === 'pickup')
            .filter(order => normalizePickupStatus(order.pickup_status) === 'pendiente_recoleccion')
            .filter((order) => {
                if (currentUser.role === 'admin') return true;
                return getOrderItemsForSeller(order, currentUser.id).some(item => !item.stock_released && !item.picked_up);
            })
            .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
        return demoResponse(hydrateOrdersForResponse(list, currentUser));
    }

    if (path === '/seller/carts/active' && method === 'GET') {
        if (!currentUser?.id || !['seller', 'admin'].includes(currentUser.role)) {
            throw new Error('No autorizado');
        }

        const list = DemoDB.carts
            .filter((cart) => String(cart?.status || 'active') === 'active')
            .filter((cart) => normalizeCartItems(cart?.items).length > 0)
            .map((cart) => hydrateSellerCartPreview(cart, currentUser))
            .filter((cart) => Array.isArray(cart.items) && cart.items.length > 0)
            .sort((a, b) => new Date(b.updated_at || b.created_at || 0) - new Date(a.updated_at || a.created_at || 0));

        return demoResponse(list);
    }

    if (path === '/seller/orders' && method === 'GET') {
        if (!currentUser?.id || !['seller', 'admin'].includes(currentUser.role)) {
            throw new Error('No autorizado');
        }

        const list = DemoDB.orders
            .filter((order) => {
                if (currentUser.role === 'admin') return true;
                return getOrderItemsForSeller(order, currentUser.id).length > 0;
            })
            .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

        return demoResponse(hydrateOrdersForResponse(list, currentUser));
    }

    if (path.startsWith('/orders/') && path.endsWith('/assign') && method === 'PUT') {
        const order = resolveOrderById(path);
        if (!order) throw new Error('Pedido no encontrado');
        if (!canAssignDemoOrder(order, currentUser)) throw new Error('Pedido tomado por otro repartidor');

        let targetCourierId = null;
        if (currentUser.role === 'admin') {
            const requestedCourierId = String(body.courier_id || url.searchParams.get('courier_id') || '').trim();
            const requestedCourier = getCourierById(requestedCourierId);
            if (!requestedCourier && requestedCourierId) throw new Error('Repartidor inválido');
            targetCourierId = requestedCourier?.id || null;
        } else {
            targetCourierId = currentUser.id;
        }

        assignOrderToCourier(order, targetCourierId);
        persistDemoOrders();
        return demoResponse(normalizeCourierSelection(order, currentUser));
    }

    if (path.startsWith('/orders/') && path.endsWith('/status') && method === 'PUT') {
        const order = resolveOrderById(path);
        if (!order) throw new Error('Pedido no encontrado');
        if (!canEditDemoOrder(order, currentUser)) throw new Error('No autorizado para actualizar pedido');
        demoEnsureOrderForCourier(order, currentUser);

        const status = normalizeOrderStatus(url.searchParams.get('status') || body.status);
        order.status = status;
        if (normalizeDeliveryMethod(order.delivery_method) === 'pickup') {
            if (status === 'entregado') {
                order.pickup_status = 'recogido';
                order.stock_reserved = false;
                getOrderItemsForSeller(order).forEach((item) => {
                    item.picked_up = true;
                });
            }
            if (status === 'cancelado_no_show') {
                order.pickup_status = 'cancelado_no_show';
                releaseOrderStockItems(getOrderItemsForSeller(order).filter(item => !item.stock_released));
                order.stock_reserved = false;
            }
        }
        order.updated_at = new Date().toISOString();
        persistDemoOrders();
        return demoResponse(normalizeCourierSelection(order, currentUser));
    }

    if (path.startsWith('/orders/') && path.endsWith('/location') && method === 'PUT') {
        const order = resolveOrderById(path);
        if (!order) throw new Error('Pedido no encontrado');
        if (!canEditDemoOrder(order, currentUser)) throw new Error('No autorizado para actualizar ubicación');
        demoEnsureOrderForCourier(order, currentUser);

        const coords = parseCoordinatesFromRequest(url, body);
        setOrderLocation(order, coords);
        persistCourierLastLocation(currentUser, coords);
        persistDemoOrders();
        return demoResponse(normalizeCourierSelection(order, currentUser));
    }

    if (path.startsWith('/orders/') && path.endsWith('/pickup/confirm') && method === 'PUT') {
        const order = resolveOrderById(path);
        if (!order) throw new Error('Pedido no encontrado');
        if (!canSellerManagePickupOrder(order, currentUser)) throw new Error('No autorizado para confirmar recogida');
        markOrderPickupCollected(order, currentUser);
        persistDemoOrders();
        return demoResponse(normalizeCourierSelection(order, currentUser));
    }

    if (path.startsWith('/orders/') && path.endsWith('/pickup/no-show') && method === 'PUT') {
        const order = resolveOrderById(path);
        if (!order) throw new Error('Pedido no encontrado');
        if (!canSellerManagePickupOrder(order, currentUser)) throw new Error('No autorizado para liberar apartado');
        markOrderPickupNoShow(order, currentUser);
        persistDemoOrders();
        return demoResponse(normalizeCourierSelection(order, currentUser));
    }

    if (path.startsWith('/orders/') && method === 'GET') {
        const id = path.split('/')[2];
        const order = DemoDB.orders.find(item => item.id === id);
        if (!order) throw new Error('Pedido no encontrado');
        const token = url.searchParams.get('token') || '';
        if (!canViewDemoOrder(order, currentUser, token)) throw new Error('No autorizado para ver este pedido');
        return demoResponse(normalizeCourierSelection(order, currentUser));
    }

    if (path === '/reviews' && method === 'POST') {
        const existing = DemoDB.reviews.find(r => r.product_id === body.product_id && r.user_id === currentUser.id);
        if (existing) {
            existing.rating = Number(body.rating);
            existing.comment = body.comment || '';
            existing.created_at = new Date().toISOString();
            return demoResponse(existing);
        }
        const review = {
            id: `r-${Date.now()}`,
            product_id: body.product_id,
            user_id: currentUser.id,
            user_name: currentUser.name,
            rating: Number(body.rating),
            comment: body.comment || '',
            created_at: new Date().toISOString()
        };
        DemoDB.reviews.push(review);
        return demoResponse(review);
    }

    if (path === '/reports' && method === 'POST') {
        const report = {
            id: `rep-${Date.now()}`,
            reporter_id: currentUser.id,
            reporter_name: currentUser.name,
            target_type: body.target_type,
            target_id: body.target_id,
            reason: body.reason,
            description: body.description || '',
            status: 'pending',
            admin_notes: '',
            created_at: new Date().toISOString()
        };
        DemoDB.reports.unshift(report);
        return demoResponse(report);
    }

    if (path === '/reports' && method === 'GET') {
        let list = [...DemoDB.reports];
        const status = url.searchParams.get('status');
        if (status) list = list.filter(r => r.status === status);
        return demoResponse(list);
    }

    if (path === '/reports/my' && method === 'GET') {
        return demoResponse(DemoDB.reports.filter(r => r.reporter_id === currentUser.id));
    }

    if (path.startsWith('/reports/') && method === 'PUT') {
        const id = path.split('/')[2];
        const report = DemoDB.reports.find(r => r.id === id);
        if (report) {
            report.status = url.searchParams.get('status') || report.status;
            report.admin_notes = url.searchParams.get('admin_notes') || report.admin_notes;
            report.updated_at = new Date().toISOString();
        }
        return demoResponse(report || { ok: true });
    }

    if (path === '/sellers' && method === 'GET') {
        return demoResponse(DemoDB.users.filter(u => u.role === 'seller'));
    }

    if (path.startsWith('/sellers/') && method === 'GET') {
        const id = path.split('/')[2];
        return demoResponse(DemoDB.users.find(u => u.id === id) || null);
    }

    if (path === '/seller/profile' && method === 'PUT') {
        const seller = DemoDB.users.find(u => u.id === currentUser.id);
        seller.seller_profile = {
            business_name: body.business_name ?? seller.seller_profile?.business_name ?? '',
            description: body.description ?? seller.seller_profile?.description ?? '',
            schedule: body.schedule ?? seller.seller_profile?.schedule ?? '',
            location: body.location ?? seller.seller_profile?.location ?? ''
        };
        return demoResponse(seller);
    }

    if (path === '/seller/metrics' && method === 'GET') {
        const sellerId = currentUser.role === 'admin' ? (url.searchParams.get('seller_id') || 'u-seller') : currentUser.id;
        const myProducts = DemoDB.products.filter(p => p.seller_id === sellerId);
        const totalReviews = DemoDB.reviews.filter(r => myProducts.some(p => p.id === r.product_id));
        const totalFavorites = DemoDB.favorites.filter(f => myProducts.some(p => p.id === f.product_id));
        return demoResponse({
            total_products: myProducts.length,
            total_views: myProducts.reduce((n, p) => n + (p.views || 0), 0),
            total_favorites: totalFavorites.length,
            average_rating: totalReviews.length ? (totalReviews.reduce((n, r) => n + Number(r.rating), 0) / totalReviews.length).toFixed(1) : '0.0',
            total_reviews: totalReviews.length
        });
    }

    if (path === '/admin/stats' && method === 'GET') {
        const sellers = DemoDB.users.filter(u => u.role === 'seller');
        const couriers = DemoDB.users.filter(u => u.role === 'courier');
        return demoResponse({
            total_users: DemoDB.users.length,
            total_sellers: sellers.length,
            total_couriers: couriers.length,
            active_sellers: sellers.filter(u => isUserActiveStatus(u.status)).length,
            active_couriers: couriers.filter(u => isUserActiveStatus(u.status)).length,
            total_products: DemoDB.products.length,
            pending_reports: DemoDB.reports.filter(r => r.status === 'pending').length
        });
    }

    if (path.startsWith('/admin/products/') && path.endsWith('/status') && method === 'PUT') {
        const id = path.split('/')[3];
        const p = DemoDB.products.find(x => x.id === id);
        if (p) p.status = url.searchParams.get('status') || p.status;
        return demoResponse(p || { ok: true });
    }

    if (path.startsWith('/admin/products/') && path.endsWith('/verify-local') && method === 'PUT') {
        const id = path.split('/')[3];
        const p = DemoDB.products.find(x => x.id === id);
        if (p) p.local_handmade_verified = url.searchParams.get('verified') === 'true';
        return demoResponse(p || { ok: true });
    }

    if (path.startsWith('/admin/products/') && path.endsWith('/feature') && method === 'PUT') {
        const id = path.split('/')[3];
        const p = DemoDB.products.find(x => x.id === id);
        if (p) p.is_featured = true;
        return demoResponse(p || { ok: true });
    }

    if (path.startsWith('/admin/sellers/') && path.endsWith('/status') && method === 'PUT') {
        const id = path.split('/')[3];
        const u = DemoDB.users.find(x => x.id === id);
        if (u) u.status = url.searchParams.get('status') || u.status;
        return demoResponse(u || { ok: true });
    }

    if (path === '/admin/users' && method === 'GET') {
        const role = url.searchParams.get('role') || '';
        const status = url.searchParams.get('status') || '';
        let list = [...DemoDB.users];

        if (role) list = list.filter(user => user.role === role);
        if (status) list = list.filter(user => String(user.status || '') === status);

        const hydrated = list.map(user => {
            const products = user.role === 'seller'
                ? DemoDB.products.filter(product => product.seller_id === user.id)
                : [];
            const assignedOrders = user.role === 'courier'
                ? DemoDB.orders.filter(order => order.courier_id === user.id)
                : [];
            const activeOrders = assignedOrders.filter(order => normalizeOrderStatus(order.status) !== 'entregado');

            return {
                ...user,
                is_active: isUserActiveStatus(user.status),
                total_products: products.length,
                total_orders_assigned: assignedOrders.length,
                active_orders_assigned: activeOrders.length
            };
        });

        return demoResponse(hydrated);
    }

    if (path.startsWith('/admin/users/') && path.endsWith('/status') && method === 'PUT') {
        const id = path.split('/')[3];
        const nextStatus = url.searchParams.get('status') || body.status;
        const user = DemoDB.users.find(item => item.id === id);
        if (user && nextStatus) user.status = nextStatus;
        return demoResponse(user || { ok: true });
    }

    if (path === '/subscription' && method === 'POST') {
        const u = DemoDB.users.find(x => x.id === currentUser.id);
        if (u) u.subscription = { plan: body.plan || 'free' };
        return demoResponse(u || { ok: true });
    }

    if (path === '/uploads/images' && method === 'POST') {
        return demoResponse({ urls: [] });
    }

    return demoResponse({});
}

// ========================================
// UTILITY FUNCTIONS
// ========================================
function $(selector) {
    return document.querySelector(selector);
}

function $$(selector) {
    return document.querySelectorAll(selector);
}

function createElement(tag, className, innerHTML) {
    const el = document.createElement(tag);
    if (className) el.className = className;
    if (innerHTML) el.innerHTML = innerHTML;
    return el;
}

function escapeHtml(value) {
    return String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function createPlaceholderImage(label = 'MercadoLocal') {
    const safeLabel = escapeHtml(label).slice(0, 24);
    const svg = `
        <svg xmlns="http://www.w3.org/2000/svg" width="640" height="640" viewBox="0 0 640 640">
            <defs>
                <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stop-color="#F4F1DE" />
                    <stop offset="100%" stop-color="#EAE0D5" />
                </linearGradient>
            </defs>
            <rect width="640" height="640" fill="url(#bg)" />
            <circle cx="320" cy="240" r="92" fill="#D97757" opacity="0.18" />
            <rect x="140" y="350" width="360" height="24" rx="12" fill="#D97757" opacity="0.28" />
            <rect x="180" y="398" width="280" height="18" rx="9" fill="#81B29A" opacity="0.28" />
            <text x="320" y="250" text-anchor="middle" font-family="Arial, sans-serif" font-size="46" fill="#2D3142">${safeLabel}</text>
        </svg>
    `;
    return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
}

function getProductStock(product) {
    return Math.max(0, Number(product?.stock ?? 0));
}

function getProductAvailability(product) {
    const stock = getProductStock(product);
    if (stock <= 0) return 'unavailable';
    if (stock <= 10) return 'low';
    return 'available';
}

function formatPrice(price) {
    return new Intl.NumberFormat('es-MX', {
        style: 'currency',
        currency: 'MXN',
        minimumFractionDigits: 0
    }).format(price);
}

function formatDate(dateStr) {
    return new Date(dateStr).toLocaleDateString('es-MX', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    });
}

function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

// ========================================
// API FUNCTIONS
// ========================================
async function apiRequest(endpoint, options = {}) {
    if (DEMO_MODE) {
        return demoApiRequest(endpoint, options);
    }

    const headers = {
        'Content-Type': 'application/json',
        ...options.headers
    };
    
    if (AppState.token) {
        headers['Authorization'] = `Bearer ${AppState.token}`;
    }
    
    try {
        const response = await fetch(`${API_URL}${endpoint}`, {
            ...options,
            headers
        });
        const contentType = response.headers.get('content-type') || '';
        const isJson = contentType.includes('application/json');
        const payload = isJson ? await response.json() : null;
        
        if (!response.ok) {
            const detail = payload?.detail || payload?.message || `Error HTTP ${response.status}`;
            throw new Error(detail);
        }
        
        return payload;
    } catch (error) {
        console.error('API Error:', error);
        throw error;
    }
}

// Auth API
const AuthAPI = {
    async register(email, password, name, role, extra = {}) {
        return apiRequest('/auth/register', {
            method: 'POST',
            body: JSON.stringify({ email, password, name, role, ...extra })
        });
    },
    
    async login(email, password) {
        return apiRequest('/auth/login', {
            method: 'POST',
            body: JSON.stringify({ email, password })
        });
    },
    
    async getMe() {
        return apiRequest('/auth/me');
    }
};

// Products API
const ProductsAPI = {
    async getAll(params = {}) {
        // Filter out undefined, null, and empty string values
        const cleanParams = Object.fromEntries(
            Object.entries(params).filter(([_, v]) => v !== undefined && v !== null && v !== '')
        );
        const queryString = new URLSearchParams(cleanParams).toString();
        return apiRequest(`/products${queryString ? '?' + queryString : ''}`);
    },
    
    async getById(id) {
        return apiRequest(`/products/${id}`);
    },
    
    async create(data) {
        return apiRequest('/products', {
            method: 'POST',
            body: JSON.stringify(data)
        });
    },
    
    async update(id, data) {
        return apiRequest(`/products/${id}`, {
            method: 'PUT',
            body: JSON.stringify(data)
        });
    },
    
    async delete(id) {
        return apiRequest(`/products/${id}`, {
            method: 'DELETE'
        });
    },
    
    async getFeatured() {
        return apiRequest('/products/featured');
    },
    
    async getSellerProducts() {
        return apiRequest('/products/seller');
    }
};

const CartAPI = {
    async getCurrent() {
        return apiRequest('/cart');
    },

    async addItem(productId, quantity = 1) {
        return apiRequest('/cart/items', {
            method: 'POST',
            body: JSON.stringify({ product_id: productId, quantity })
        });
    },

    async updateItem(productId, quantity) {
        return apiRequest(`/cart/items/${encodeURIComponent(productId)}`, {
            method: 'PUT',
            body: JSON.stringify({ quantity })
        });
    },

    async removeItem(productId) {
        return apiRequest(`/cart/items/${encodeURIComponent(productId)}`, {
            method: 'DELETE'
        });
    },

    async clear() {
        return apiRequest('/cart', {
            method: 'DELETE'
        });
    },

    async getSellerActive() {
        return apiRequest('/seller/carts/active');
    }
};

// Categories API
const CategoriesAPI = {
    async getAll() {
        return apiRequest('/categories');
    },
    
    async create(data) {
        return apiRequest('/categories', {
            method: 'POST',
            body: JSON.stringify(data)
        });
    }
};

// Sellers API
const SellersAPI = {
    async getAll() {
        return apiRequest('/sellers');
    },
    
    async getById(id) {
        return apiRequest(`/sellers/${id}`);
    },
    
    async updateProfile(data) {
        return apiRequest('/seller/profile', {
            method: 'PUT',
            body: JSON.stringify(data)
        });
    },
    
    async getMetrics() {
        return apiRequest('/seller/metrics');
    }
};

// Reviews API
const ReviewsAPI = {
    async create(data) {
        return apiRequest('/reviews', {
            method: 'POST',
            body: JSON.stringify(data)
        });
    }
};

// Reports API
const ReportsAPI = {
    async create(data) {
        return apiRequest('/reports', {
            method: 'POST',
            body: JSON.stringify(data)
        });
    },
    
    async getAll(status) {
        const params = status ? `?status=${status}` : '';
        return apiRequest(`/reports${params}`);
    },
    
    async getMy() {
        return apiRequest('/reports/my');
    }
};

// Orders API
const OrdersAPI = {
    async create(data) {
        return apiRequest('/orders', {
            method: 'POST',
            body: JSON.stringify(data)
        });
    },

    async getById(id, token = '') {
        const params = token ? `?token=${encodeURIComponent(token)}` : '';
        return apiRequest(`/orders/${id}${params}`);
    },

    async getMy() {
        return apiRequest('/orders/my');
    },

    async getAssigned() {
        return apiRequest('/orders/assigned');
    },

    async getPickupPending() {
        return apiRequest('/seller/orders/pickup-pending');
    },

    async getSellerOrders() {
        return apiRequest('/seller/orders');
    },

    async updateStatus(id, status) {
        return apiRequest(`/orders/${id}/status?status=${encodeURIComponent(status)}`, {
            method: 'PUT'
        });
    },

    async assign(id, courierId = '') {
        const params = courierId ? `?courier_id=${encodeURIComponent(courierId)}` : '';
        return apiRequest(`/orders/${id}/assign${params}`, {
            method: 'PUT'
        });
    },

    async updateLocation(id, lat, lng) {
        return apiRequest(`/orders/${id}/location?lat=${encodeURIComponent(lat)}&lng=${encodeURIComponent(lng)}`, {
            method: 'PUT'
        });
    },

    async markPickupCollected(id) {
        return apiRequest(`/orders/${id}/pickup/confirm`, {
            method: 'PUT'
        });
    },

    async markPickupNoShow(id) {
        return apiRequest(`/orders/${id}/pickup/no-show`, {
            method: 'PUT'
        });
    }
};

// Favorites API
const FavoritesAPI = {
    async add(productId) {
        return apiRequest(`/favorites/${productId}`, { method: 'POST' });
    },
    
    async remove(productId) {
        return apiRequest(`/favorites/${productId}`, { method: 'DELETE' });
    },
    
    async getAll() {
        return apiRequest('/favorites');
    }
};

// Admin API
const AdminAPI = {
    async getStats() {
        return apiRequest('/admin/stats');
    },

    async getUsers(role = '', status = '') {
        const params = new URLSearchParams();
        if (role) params.set('role', role);
        if (status) params.set('status', status);
        const query = params.toString();
        return apiRequest(`/admin/users${query ? `?${query}` : ''}`);
    },
    
    async updateProductStatus(id, status) {
        return apiRequest(`/admin/products/${id}/status?status=${status}`, { method: 'PUT' });
    },
    
    async verifyLocalHandmade(id, verified) {
        return apiRequest(`/admin/products/${id}/verify-local?verified=${verified}`, { method: 'PUT' });
    },
    
    async featureProduct(id, days) {
        return apiRequest(`/admin/products/${id}/feature?days=${days}`, { method: 'PUT' });
    },
    
    async updateSellerStatus(id, status) {
        return apiRequest(`/admin/sellers/${id}/status?status=${status}`, { method: 'PUT' });
    },

    async updateUserStatus(id, status) {
        return apiRequest(`/admin/users/${id}/status?status=${status}`, { method: 'PUT' });
    },
    
    async updateReport(id, status, notes) {
        return apiRequest(`/reports/${id}?status=${status}&admin_notes=${encodeURIComponent(notes)}`, { method: 'PUT' });
    }
};

// ========================================
// TOAST NOTIFICATIONS
// ========================================
function showToast(message, type = 'success') {
    let container = $('#toast-container');
    if (!container) {
        container = createElement('div', 'toast-container');
        container.id = 'toast-container';
        container.setAttribute('role', 'status');
        container.setAttribute('aria-live', 'polite');
        document.body.appendChild(container);
    }
    
    const toast = createElement('div', `toast toast-${type}`, `
        <span>${type === 'success' ? '\u2713' : type === 'error' ? '\u2715' : '!'}</span>
        <span>${message}</span>
    `);
    
    container.appendChild(toast);
    
    setTimeout(() => {
        toast.style.opacity = '0';
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

// ========================================
// MODAL FUNCTIONS
// ========================================
function showModal(id) {
    const modal = $(`#${id}`);
    if (modal) {
        modal.classList.add('show');
        document.body.style.overflow = 'hidden';
    }
}

function hideModal(id) {
    const modal = $(`#${id}`);
    if (modal) {
        modal.classList.remove('show');
        document.body.style.overflow = '';
    }
}

function hideAllModals() {
    $$('.modal-overlay').forEach(modal => modal.classList.remove('show'));
    document.body.style.overflow = '';
}

// ========================================
// AUTH FUNCTIONS
// ========================================
async function initAuth() {
    if (DEMO_MODE && !AppState.token && isProtectedDemoPage) {
        AppState.token = 'demo-token';
        AppState.user = demoCurrentUser();
        localStorage.setItem('token', AppState.token);
        syncCartStateForUser(AppState.user);
        updateUserUI();
        return;
    }

    if (AppState.token) {
        try {
            AppState.user = await AuthAPI.getMe();
            if (AppState.user?.role === 'buyer') {
                mergeGuestCartIntoUserCart(AppState.user);
            } else {
                syncCartStateForUser(AppState.user);
            }
            updateUserUI();
        } catch (error) {
            logout();
        }
        return;
    }

    syncCartStateForUser(null);
}

function updateUserUI() {
    const userMenu = $('#user-menu');
    const authButtons = $('#auth-buttons');
    
    if (AppState.user) {
        if (userMenu) userMenu.classList.remove('hidden');
        if (authButtons) authButtons.classList.add('hidden');
        
        const userName = $('#user-name');
        const userAvatar = $('#user-avatar');
        
        if (userName) userName.textContent = AppState.user.name;
        if (userAvatar) userAvatar.textContent = AppState.user.name.charAt(0).toUpperCase();
        
        // Show/hide role-specific links
        const sellerLinks = $$('.seller-only');
        const adminLinks = $$('.admin-only');
        const courierLinks = $$('.courier-only');
        
        sellerLinks.forEach(link => {
            link.style.display = ['seller', 'admin'].includes(AppState.user.role) ? '' : 'none';
        });
        
        adminLinks.forEach(link => {
            link.style.display = AppState.user.role === 'admin' ? '' : 'none';
        });

        courierLinks.forEach(link => {
            link.style.display = ['courier', 'admin'].includes(AppState.user.role) ? '' : 'none';
        });
    } else {
        if (userMenu) userMenu.classList.add('hidden');
        if (authButtons) authButtons.classList.remove('hidden');
    }
}

async function handleLogin(event) {
    event.preventDefault();
    
    const email = $('#login-email').value;
    const password = $('#login-password').value;
    
    if (!email || !password) {
        showToast('Completa todos los campos', 'error');
        return;
    }
    
    try {
        const result = await AuthAPI.login(email, password);
        AppState.token = result.token;
        AppState.user = result.user;
        localStorage.setItem('token', result.token);
        if (result.user?.role === 'buyer') {
            mergeGuestCartIntoUserCart(result.user);
        } else {
            syncCartStateForUser(result.user);
        }
        
        showToast(`\u00A1Bienvenido, ${result.user.name}!`);
        
        // Redirect based on role
        if (result.user.role === 'admin') {
            window.location.href = PAGE_ROUTES.admin;
        } else if (result.user.role === 'courier') {
            window.location.href = PAGE_ROUTES.repartidor;
        } else if (result.user.role === 'seller') {
            window.location.href = PAGE_ROUTES.vendedor;
        } else {
            window.location.href = PAGE_ROUTES.catalogo;
        }
    } catch (error) {
        showToast(error.message, 'error');
    }
}

async function handleRegister(event) {
    event.preventDefault();
    
    const name = $('#register-name').value;
    const email = $('#register-email').value;
    const password = $('#register-password').value;
    const confirmPassword = $('#register-confirm-password').value;
    const role = $('input[name="role"]:checked')?.value || 'buyer';
    
    if (!name || !email || !password) {
        showToast('Completa todos los campos', 'error');
        return;
    }
    
    if (password !== confirmPassword) {
        showToast('Las contrase\u00F1as no coinciden', 'error');
        return;
    }
    
    if (password.length < 6) {
        showToast('La contrase\u00F1a debe tener al menos 6 caracteres', 'error');
        return;
    }
    
    try {
        const result = await AuthAPI.register(email, password, name, role);
        AppState.token = result.token;
        AppState.user = result.user;
        localStorage.setItem('token', result.token);
        if (result.user?.role === 'buyer') {
            mergeGuestCartIntoUserCart(result.user);
        } else {
            syncCartStateForUser(result.user);
        }
        
        showToast(`\u00A1Bienvenido, ${result.user.name}!`);
        
        if (role === 'seller') {
            window.location.href = PAGE_ROUTES.vendedor;
        } else {
            window.location.href = PAGE_ROUTES.catalogo;
        }
    } catch (error) {
        showToast(error.message, 'error');
    }
}

function logout() {
    AppState.token = null;
    AppState.user = null;
    localStorage.removeItem('token');
    localStorage.removeItem('demoUserId');
    syncCartStateForUser(null);
    window.location.href = PAGE_ROUTES.index;
}

// ========================================
// FAVORITES FUNCTIONS
// ========================================
function isFavorite(productId) {
    return AppState.favorites.includes(productId);
}

async function toggleFavorite(productId, button) {
    if (!AppState.user) {
        showToast('Inicia sesi\u00F3n para guardar favoritos', 'error');
        window.location.href = PAGE_ROUTES.login;
        return;
    }
    
    try {
        if (isFavorite(productId)) {
            await FavoritesAPI.remove(productId);
            AppState.favorites = AppState.favorites.filter(id => id !== productId);
            if (button) button.classList.remove('favorited');
            showToast('Eliminado de favoritos');
        } else {
            await FavoritesAPI.add(productId);
            AppState.favorites.push(productId);
            if (button) button.classList.add('favorited');
            showToast('A\u00F1adido a favoritos');
        }
        localStorage.setItem('favorites', JSON.stringify(AppState.favorites));
    } catch (error) {
        showToast('Error al actualizar favoritos', 'error');
    }
}

// ========================================
// HISTORY FUNCTIONS
// ========================================
function addToHistory(product) {
    AppState.viewHistory = AppState.viewHistory.filter(p => p.id !== product.id);
    AppState.viewHistory.unshift({
        id: product.id,
        name: product.name,
        price: product.price,
        image: product.images?.[0],
        viewedAt: new Date().toISOString()
    });
    AppState.viewHistory = AppState.viewHistory.slice(0, 50);
    localStorage.setItem('viewHistory', JSON.stringify(AppState.viewHistory));
}

// ========================================
// CART FUNCTIONS
// ========================================
function saveCart() {
    syncAppCart(AppState.cart);
}

function getCartItemCount() {
    return AppState.cart.reduce((sum, item) => sum + Math.max(0, Number(item.quantity || 0)), 0);
}

function updateCartBadge() {
    const badge = $('#cart-count');
    if (!badge) return;
    const totalItems = getCartItemCount();
    badge.textContent = String(totalItems);
    badge.classList.toggle('hidden', totalItems <= 0);
}

async function resolveProductById(productId) {
    if (DEMO_MODE) {
        const product = DemoDB.products.find(p => p.id === productId);
        return product ? demoHydrateProduct(product) : null;
    }

    try {
        return await ProductsAPI.getById(productId);
    } catch {
        return null;
    }
}

async function getCartDetailedItems() {
    const cartResponse = await CartAPI.getCurrent();
    const cartItems = normalizeCartItems(cartResponse?.items);
    syncAppCart(cartItems);

    const detailedItems = [];

    for (const item of cartItems) {
        const product = await resolveProductById(item.product_id);
        if (!product) continue;
        detailedItems.push({
            product,
            quantity: Math.max(1, Number(item.quantity || 1)),
            subtotal: Math.max(1, Number(item.quantity || 1)) * Number(product.price || 0)
        });
    }

    return detailedItems;
}

function getCartSubtotal(items = []) {
    return items.reduce((sum, item) => sum + Number(item.subtotal || 0), 0);
}

async function addProductToCart(productId, quantity = 1) {
    const product = await resolveProductById(productId);
    if (!product) {
        showToast('No se pudo añadir este producto al carrito', 'error');
        return false;
    }

    const stock = getProductStock(product);
    if (stock <= 0) {
        showToast('Este producto no está disponible', 'error');
        return false;
    }

    try {
        const cartResponse = await CartAPI.addItem(productId, quantity);
        syncAppCart(cartResponse?.items || []);
        showToast(`Añadido al carrito: ${product.name}`);
        return true;
    } catch (error) {
        showToast(error.message || 'No se pudo añadir este producto al carrito', 'error');
        return false;
    }
}

async function updateCartItemQuantity(productId, quantity) {
    const qty = Math.max(0, Number(quantity || 0));

    if (qty <= 0) {
        await removeFromCart(productId);
        return;
    }

    const cartResponse = await CartAPI.updateItem(productId, qty);
    syncAppCart(cartResponse?.items || []);
}

async function removeFromCart(productId) {
    const cartResponse = await CartAPI.removeItem(productId);
    syncAppCart(cartResponse?.items || []);
}

async function clearCart() {
    await CartAPI.clear();
    syncAppCart([]);
}

// ========================================
// HEADER SEARCH + CART UI
// ========================================
function injectHeaderSearch() {
    const headerContainer = $('.header .header-container');
    const navActions = $('.header .nav-actions');
    if (!headerContainer || !navActions || $('#global-search-form')) return;

    const form = document.createElement('form');
    form.id = 'global-search-form';
    form.className = 'header-search';
    form.setAttribute('role', 'search');
    form.setAttribute('aria-label', 'Buscar productos');
    form.innerHTML = `
        <input id="global-search-input" class="header-search-input" type="search" placeholder="Buscar productos, categorías..." aria-label="Buscar productos o categorías" autocomplete="off">
        <button type="submit" class="header-search-btn" aria-label="Buscar">&#x1F50D;</button>
        <div id="global-search-suggestions" class="header-search-suggestions hidden"></div>
    `;

    headerContainer.insertBefore(form, navActions);

    form.addEventListener('submit', (e) => {
        e.preventDefault();
        const query = $('#global-search-input')?.value?.trim() || '';
        if (!query) return;
        window.location.href = `${PAGE_ROUTES.catalogo}?search=${encodeURIComponent(query)}`;
    });
}

async function getHeaderSearchSuggestions(query) {
    const term = query.trim().toLowerCase();
    if (!term) return [];

    if (DEMO_MODE) {
        const productResults = DemoDB.products
            .filter(p => p.status === 'approved')
            .filter(p => p.name.toLowerCase().includes(term) || (p.description || '').toLowerCase().includes(term))
            .slice(0, 5)
            .map(p => ({ type: 'product', id: p.id, title: p.name, subtitle: `Producto · ${formatPrice(p.price)}` }));

        const categoryResults = DemoDB.categories
            .filter(c => c.name.toLowerCase().includes(term))
            .slice(0, 3)
            .map(c => ({ type: 'category', id: c.id, title: c.name, subtitle: 'Categoría' }));

        return [...productResults, ...categoryResults];
    }

    try {
        const [productsResp, categories] = await Promise.all([
            ProductsAPI.getAll({ search: query, limit: 5 }),
            CategoriesAPI.getAll()
        ]);
        const products = (productsResp.products || []).slice(0, 5).map(p => ({
            type: 'product',
            id: p.id,
            title: p.name,
            subtitle: `Producto · ${formatPrice(p.price)}`
        }));
        const matchedCategories = (categories || [])
            .filter(c => (c.name || '').toLowerCase().includes(term))
            .slice(0, 3)
            .map(c => ({ type: 'category', id: c.id, title: c.name, subtitle: 'Categoría' }));
        return [...products, ...matchedCategories];
    } catch {
        return [];
    }
}

function renderHeaderSearchSuggestions(items) {
    const container = $('#global-search-suggestions');
    if (!container) return;

    if (!items.length) {
        container.innerHTML = '';
        container.classList.add('hidden');
        return;
    }

    container.innerHTML = items.map(item => `
        <button type="button" class="header-search-item" data-type="${item.type}" data-id="${item.id}">
            <span class="header-search-item-title">${escapeHtml(item.title)}</span>
            <span class="header-search-item-subtitle">${escapeHtml(item.subtitle)}</span>
        </button>
    `).join('');

    container.classList.remove('hidden');

    container.querySelectorAll('.header-search-item').forEach(btn => {
        btn.addEventListener('click', () => {
            const type = btn.dataset.type;
            const id = btn.dataset.id;
            if (type === 'product') {
                window.location.href = `${PAGE_ROUTES.producto}?id=${encodeURIComponent(id)}`;
            } else {
                window.location.href = `${PAGE_ROUTES.catalogo}?category=${encodeURIComponent(id)}`;
            }
        });
    });
}

function initHeaderSearch() {
    injectHeaderSearch();
    const input = $('#global-search-input');
    const suggestions = $('#global-search-suggestions');
    if (!input || !suggestions) return;

    let timeoutId = null;
    input.addEventListener('input', () => {
        clearTimeout(timeoutId);
        const query = input.value.trim();
        if (!query) {
            renderHeaderSearchSuggestions([]);
            return;
        }
        timeoutId = setTimeout(async () => {
            const results = await getHeaderSearchSuggestions(query);
            renderHeaderSearchSuggestions(results);
        }, 180);
    });

    document.addEventListener('click', (e) => {
        if (!e.target.closest('#global-search-form')) {
            suggestions.classList.add('hidden');
        }
    });
}

function injectCartButton() {
    const navActions = $('.header .nav-actions');
    if (!navActions || $('#cart-header-btn')) return;

    const btn = document.createElement('a');
    btn.id = 'cart-header-btn';
    btn.className = 'cart-header-btn';
    btn.href = PAGE_ROUTES.checkout;
    btn.setAttribute('aria-label', 'Abrir carrito');
    btn.innerHTML = `
        <span class="cart-header-icon">&#x1F6D2;</span>
        <span class="cart-header-label">Carrito</span>
        <span id="cart-count" class="cart-count hidden">0</span>
    `;

    const mobileBtn = $('#mobile-menu-btn');
    if (mobileBtn) navActions.insertBefore(btn, mobileBtn);
    else navActions.appendChild(btn);

    updateCartBadge();
}

// ========================================
// SHARE FUNCTIONS
// ========================================
function shareOnWhatsApp(product) {
    const url = `${window.location.origin}${PAGE_ROUTES.producto}?id=${product.id}`;
    const text = `Mira este producto: ${product.name} - ${formatPrice(product.price)}`;
    window.open(`https://wa.me/?text=${encodeURIComponent(text + ' ' + url)}`, '_blank');
}

function shareOnFacebook(product) {
    const url = `${window.location.origin}${PAGE_ROUTES.producto}?id=${product.id}`;
    window.open(`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`, '_blank');
}

// ========================================
// PRODUCT CARD COMPONENT
// ========================================
function createProductCard(product) {
    const isFav = isFavorite(product.id);
    const imageUrl = product.images?.[0] || createPlaceholderImage(product.name || 'Producto');
    const fallbackImage = createPlaceholderImage(product.name || 'Producto');
    const safeName = escapeHtml(product.name);
    const safeCategory = escapeHtml(product.category?.name || 'Sin categor\u00EDa');
    const safeSeller = escapeHtml(product.seller_name || 'Vendedor Local');
    const availability = getProductAvailability(product);
    const stock = getProductStock(product);
    const sellerVerified = product.seller?.status === 'verified';
    const sellerRating = Number(product.seller?.average_rating || 0);
    
    return `
        <article class="product-card" data-product-id="${product.id}">
            <div class="product-image-container">
                <img src="${imageUrl}" alt="${safeName}" class="product-image" loading="lazy" onerror="this.onerror=null;this.src='${fallbackImage}'">
                <div class="product-badges">
                    ${availability === 'unavailable' ? '<span class="badge badge-error">No disponible</span>' : ''}
                    ${availability === 'low' ? `<span class="badge badge-warning">Quedan ${stock}</span>` : ''}
                    ${product.is_featured ? '<span class="badge badge-terracotta">Destacado</span>' : ''}
                    ${product.is_local_handmade ? `<span class="badge ${product.local_handmade_verified ? 'badge-sage' : 'badge-warning'}">${product.local_handmade_verified ? '\u2713 ' : ''}Local/Artesanal</span>` : ''}
                    ${sellerVerified ? '<span class="badge badge-sage">\u2713 Vendedor verificado</span>' : ''}
                </div>
                <div class="product-actions">
                    <button class="product-action-btn ${isFav ? 'favorited' : ''}" onclick="toggleFavorite('${product.id}', this)" title="Favorito">
                        \u2665
                    </button>
                    <button class="product-action-btn" onclick="addProductToCart('${product.id}', 1)" title="Agregar al carrito">
                        \uD83D\uDED2
                    </button>
                    <button class="product-action-btn" onclick="shareProduct('${product.id}')" title="Compartir">
                        \u2934
                    </button>
                </div>
            </div>
            <a href="${PAGE_ROUTES.producto}?id=${product.id}" class="product-content">
                <span class="product-category">${safeCategory}</span>
                <h3 class="product-name">${safeName}</h3>
                <p class="product-price">${formatPrice(product.price)}</p>
                <p class="product-seller">
                    <span>\uD83D\uDCCD</span>
                    ${safeSeller}
                </p>
                <div class="product-stats">
                    <span class="product-stat">${stock} unidades</span>
                    ${product.average_rating > 0 ? `<span class="product-stat"><span style="color: var(--warning)">\u2605</span> ${product.average_rating}</span>` : ''}
                    ${sellerRating > 0 ? `<span class="product-stat">\u2605 Vendedor ${sellerRating.toFixed(1)}</span>` : ''}
                    <span class="product-stat">\uD83D\uDC41 ${product.views || 0}</span>
                    <span class="product-stat">\u2665 ${product.favorites_count || 0}</span>
                </div>
            </a>
        </article>
    `;
}

function createSkeletonCards(count = 4) {
    return Array.from({ length: count }).map(() => `
        <article class="product-card skeleton-card" aria-hidden="true">
            <div class="skeleton skeleton-image"></div>
            <div class="product-content">
                <div class="skeleton skeleton-line short"></div>
                <div class="skeleton skeleton-line"></div>
                <div class="skeleton skeleton-line medium"></div>
                <div class="skeleton skeleton-line short"></div>
            </div>
        </article>
    `).join('');
}

function shareProduct(productId) {
    if (!productId) {
        showToast('No se pudo compartir este producto', 'error');
        return;
    }

    shareOnWhatsApp({
        id: productId,
        name: 'Producto',
        price: 0
    });
}

// ========================================
// STAR RATING COMPONENT
// ========================================
function createStarRating(rating, interactive = false, name = 'rating') {
    let html = '<div class="star-rating">';
    for (let i = 1; i <= 5; i++) {
        if (interactive) {
            html += `<label class="star ${i <= rating ? 'filled' : ''}" data-value="${i}">
                <input type="radio" name="${name}" value="${i}" ${i === rating ? 'checked' : ''} hidden>
                \u2605
            </label>`;
        } else {
            html += `<span class="star ${i <= rating ? 'filled' : ''}">\u2605</span>`;
        }
    }
    html += '</div>';
    return html;
}

function initStarRating() {
    document.addEventListener('click', (e) => {
        if (e.target.closest('.star-rating label')) {
            const label = e.target.closest('label');
            const container = label.closest('.star-rating');
            const value = parseInt(label.dataset.value);
            
            container.querySelectorAll('label').forEach((star, index) => {
                star.classList.toggle('filled', index < value);
            });
        }
    });
}

// ========================================
// ACCESSIBILITY FUNCTIONS
// ========================================
function toggleAccessibilityMode() {
    AppState.accessibilityMode = !AppState.accessibilityMode;
    localStorage.setItem('accessibilityMode', AppState.accessibilityMode);
    document.body.classList.toggle('accessibility-mode', AppState.accessibilityMode);
}

function toggleHighContrast() {
    AppState.highContrast = !AppState.highContrast;
    localStorage.setItem('highContrast', AppState.highContrast);
    document.body.classList.toggle('high-contrast', AppState.highContrast);
}

function initAccessibility() {
    if (AppState.accessibilityMode) {
        document.body.classList.add('accessibility-mode');
    }
    if (AppState.highContrast) {
        document.body.classList.add('high-contrast');
    }
}

// ========================================
// USER MENU DROPDOWN
// ========================================
function initUserMenu() {
    const userMenuBtn = $('#user-menu-btn');
    const userMenuDropdown = $('#user-menu-dropdown');
    
    if (userMenuBtn && userMenuDropdown) {
        userMenuBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            userMenuDropdown.classList.toggle('show');
        });
        
        document.addEventListener('click', () => {
            userMenuDropdown.classList.remove('show');
        });
    }
}

// ========================================
// MOBILE MENU
// ========================================
function initMobileMenu() {
    const mobileMenuBtn = $('#mobile-menu-btn');
    const header = $('.header');
    
    if (mobileMenuBtn && header) {
        if (!mobileMenuBtn.getAttribute('aria-label')) {
            mobileMenuBtn.setAttribute('aria-label', 'Abrir menú');
        }
        mobileMenuBtn.setAttribute('aria-expanded', header.classList.contains('mobile-open') ? 'true' : 'false');
        mobileMenuBtn.addEventListener('click', () => {
            header.classList.toggle('mobile-open');
            mobileMenuBtn.setAttribute('aria-expanded', header.classList.contains('mobile-open') ? 'true' : 'false');
        });
    }
}

// ========================================
// FILTER SIDEBAR (MOBILE)
// ========================================
function toggleFiltersSidebar() {
    const sidebar = $('#filters-sidebar');
    if (sidebar) {
        sidebar.classList.toggle('show');
    }
}

// ========================================
// INITIALIZATION
// ========================================
if (!window.__MERCADO_REACT_DISABLE_AUTO_INIT__) {
    document.addEventListener('DOMContentLoaded', async () => {
        initAccessibility();
        await initAuth();
        initHeaderSearch();
        injectCartButton();
        initUserMenu();
        initMobileMenu();
        initStarRating();
        updateCartBadge();
        
        // Close modals on overlay click
        $$('.modal-overlay').forEach(overlay => {
            overlay.addEventListener('click', (e) => {
                if (e.target === overlay) {
                    hideAllModals();
                }
            });
        });
        
        // Close modals on escape key
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                hideAllModals();
            }
        });
    });
}

// ========================================
// EXPORTS FOR USE IN OTHER FILES
// ========================================
window.MercadoLocal = {
    DEMO_MODE,
    API_URL,
    PAGE_ROUTES,
    createPlaceholderImage,
    AppState,
    AuthAPI,
    ProductsAPI,
    CartAPI,
    CategoriesAPI,
    SellersAPI,
    ReviewsAPI,
    ReportsAPI,
    OrdersAPI,
    FavoritesAPI,
    AdminAPI,
    initAuth,
    apiRequest,
    showToast,
    showModal,
    hideModal,
    formatPrice,
    formatDate,
    createProductCard,
    createSkeletonCards,
    createStarRating,
    toggleFavorite,
    addProductToCart,
    updateCartItemQuantity,
    removeFromCart,
    clearCart,
    getCartDetailedItems,
    getCartSubtotal,
    getCartItemCount,
    syncCartAfterAuth,
    syncCartStateForUser,
    addToHistory,
    shareOnWhatsApp,
    shareOnFacebook,
    logout,
    toggleAccessibilityMode,
    toggleHighContrast,
    toggleFiltersSidebar
};


