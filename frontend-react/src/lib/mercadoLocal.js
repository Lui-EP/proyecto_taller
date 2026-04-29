const USE_BACKEND = String(import.meta.env.VITE_USE_BACKEND ?? 'true').toLowerCase() !== 'false';
const CLIENTES_API_URL = stripTrailingSlash(import.meta.env.VITE_CLIENTES_API_URL || 'http://localhost:8001');
const PEDIDOS_API_URL = stripTrailingSlash(import.meta.env.VITE_PEDIDOS_API_URL || 'http://localhost:8002');
const REMOTE_TOKEN_PREFIX = 'remote-user:';

const PRODUCT_IMAGE_BY_KEY = {
    canastas: '/img/productos/canastas.jpg',
    miel: '/img/productos/miel.jpg',
    bolsa: '/img/productos/bolsa-artesanal.jpg',
    jarro: '/img/productos/jarro-de-barro.jpg',
    cafe: '/img/productos/cafe.jpg',
    molcajete: '/img/productos/molcajete.jpg',
    pulsera: '/img/productos/pulsera-de-ambar.jpg',
    rebozo: '/img/productos/rebozo.jpg',
    sombrero: '/img/productos/sombrero-charro.jpg',
    tazas: '/img/productos/tazas-de-arcilla.jpg',
};

function stripTrailingSlash(value = '') {
    return String(value || '').replace(/\/+$/, '');
}

function isProtectedPath(pathname) {
    const path = (pathname || '').toLowerCase();
    return ['/admin', '/vendedor', '/repartidor', '/favoritos', '/historial'].includes(path);
}

function withTimeout(promise, ms = 12000) {
    const timeout = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Tiempo de espera agotado al conectar con backend')), ms);
    });
    return Promise.race([promise, timeout]);
}

function toSafeNumber(value, fallback = 0) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
}

function normalizeText(value, fallback = '') {
    return String(value ?? fallback).trim();
}

function readRemoteUserIdFromToken(token) {
    const safe = String(token || '').trim();
    if (safe.startsWith(REMOTE_TOKEN_PREFIX)) {
        return safe.slice(REMOTE_TOKEN_PREFIX.length);
    }
    return '';
}

function buildRemoteToken(userId) {
    return `${REMOTE_TOKEN_PREFIX}${userId}`;
}

function normalizeRemoteRole(role = '') {
    const safe = String(role || '').toLowerCase();
    if (['admin', 'seller', 'courier', 'buyer'].includes(safe)) return safe;
    return 'buyer';
}

function normalizeRemoteUser(remoteUser = {}) {
    const role = normalizeRemoteRole(remoteUser.role);
    const id = normalizeText(remoteUser.id, `user-${Date.now()}`);
    const name = normalizeText(remoteUser.name, 'Usuario');
    const phone = normalizeText(remoteUser.phone, '');
    const address = normalizeText(remoteUser.address, '');

    return {
        id,
        name,
        email: normalizeText(remoteUser.email, ''),
        role,
        status: 'verified',
        phone,
        curp: '',
        subscription: { plan: 'free' },
        seller_profile: role === 'seller' ? {
            business_name: name,
            description: '',
            schedule: '',
            location: address || 'Chiapas, Mexico',
            phone,
            curp: '',
        } : null,
        created_at: remoteUser.createdAt || new Date().toISOString(),
    };
}

function toCategoryId(categoryValue = '', categoryLabel = '') {
    const raw = normalizeText(categoryValue || categoryLabel, 'categoria');
    return raw
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)/g, '') || 'categoria';
}

function resolveProductImage(imageKey = '', imageData = '') {
    if (imageData) return imageData;
    const byKey = PRODUCT_IMAGE_BY_KEY[normalizeText(imageKey).toLowerCase()];
    if (byKey) return byKey;
    return '';
}

function buildFallbackSeller(remoteProduct = {}) {
    return {
        id: normalizeText(remoteProduct.sellerId, 'seller-1'),
        name: normalizeText(remoteProduct.sellerName, 'Vendedor local'),
        status: remoteProduct.verified ? 'verified' : 'new',
        seller_profile: {
            business_name: normalizeText(remoteProduct.sellerName, 'Vendedor local'),
            description: '',
            schedule: '',
            location: 'Chiapas, Mexico',
            phone: '',
            curp: '',
        },
        average_rating: Number(toSafeNumber(remoteProduct.rating, 0).toFixed(1)),
        total_products: 0,
        total_reviews: 0,
    };
}

function normalizeRemoteProduct(mercado, remoteProduct = {}) {
    const categoryId = toCategoryId(remoteProduct.category, remoteProduct.categoryLabel);
    const categoryName = normalizeText(remoteProduct.categoryLabel, remoteProduct.category || 'Catalogo');
    const image = resolveProductImage(remoteProduct.imageKey, remoteProduct.imageData, remoteProduct.name);
    const favoritesCount = (mercado.DemoDB?.favorites || []).filter((item) => item.product_id === remoteProduct.id).length;

    return {
        id: normalizeText(remoteProduct.id),
        seller_id: normalizeText(remoteProduct.sellerId, 'seller-1'),
        category_id: categoryId,
        name: normalizeText(remoteProduct.name, 'Producto local'),
        description: normalizeText(remoteProduct.description, ''),
        price: toSafeNumber(remoteProduct.price, 0),
        images: image ? [image] : [mercado.createPlaceholderImage(remoteProduct.name || 'Producto')],
        stock: toSafeNumber(remoteProduct.stock, 0),
        status: 'approved',
        is_featured: Boolean(remoteProduct.featured),
        is_local_handmade: Boolean(remoteProduct.local),
        local_handmade_verified: Boolean(remoteProduct.verified),
        views: toSafeNumber(remoteProduct.views, 0),
        created_at: remoteProduct.createdAt || new Date().toISOString(),
        updated_at: remoteProduct.updatedAt || new Date().toISOString(),
        category: { id: categoryId, name: categoryName },
        seller_name: normalizeText(remoteProduct.sellerName, 'Vendedor local'),
        seller: buildFallbackSeller(remoteProduct),
        reviews: [],
        average_rating: Number(toSafeNumber(remoteProduct.rating, 0).toFixed(1)),
        favorites_count: favoritesCount,
        availability: toSafeNumber(remoteProduct.stock, 0) > 10 ? 'available' : toSafeNumber(remoteProduct.stock, 0) > 0 ? 'low' : 'unavailable',
    };
}

function mapLegacyStatusToRemote(status = '') {
    const safe = String(status || '').toLowerCase();
    if (safe === 'cancelado_no_show') return 'cancelado';
    if (safe === 'en_transito') return 'en_transito';
    if (safe === 'entregado') return 'entregado';
    if (safe === 'asignado') return 'asignado';
    if (safe === 'listo_recoger') return 'listo_recoger';
    return 'pedido_realizado';
}

function mapRemoteStatusToLegacy(status = '') {
    const safe = String(status || '').toLowerCase();
    if (safe === 'cancelado') return 'cancelado_no_show';
    return safe || 'pedido_realizado';
}

function toLegacyOrder(mercado, remoteOrder = {}, productsById = new Map()) {
    const deliveryMethod = normalizeText(remoteOrder.deliveryMethod, 'delivery').toLowerCase();
    const pickupName = normalizeText(remoteOrder.pickupStoreName, 'Tienda local');
    const pickupAddress = normalizeText(remoteOrder.addressLabel || remoteOrder.address, 'Ubicacion de tienda por confirmar');
    const addressLabel = normalizeText(remoteOrder.addressLabel || remoteOrder.address, remoteOrder.address || '');

    const items = Array.isArray(remoteOrder.items) ? remoteOrder.items.map((item, index) => {
        const productId = normalizeText(item.productId, item.product_id || `p-${index}`);
        const known = productsById.get(productId) || null;
        const image = known?.images?.[0]
            || resolveProductImage(known?.image_key, known?.image_data, item.productName || 'Producto')
            || mercado.createPlaceholderImage(item.productName || 'Producto');
        return {
            product_id: productId,
            name: normalizeText(item.productName, item.name || 'Producto'),
            quantity: Math.max(1, toSafeNumber(item.quantity, 1)),
            price: toSafeNumber(item.price, 0),
            image,
            seller_id: normalizeText(item.sellerId, known?.seller_id || 'seller-1'),
            seller_name: normalizeText(item.sellerName, known?.seller_name || 'Vendedor local'),
            category_label: normalizeText(item.categoryLabel, known?.category?.name || 'Catalogo'),
        };
    }) : [];

    const destination = deliveryMethod === 'pickup'
        ? { lat: remoteOrder.pickupStoreLat, lng: remoteOrder.pickupStoreLng }
        : { lat: remoteOrder.addressLat, lng: remoteOrder.addressLng };

    return {
        id: normalizeText(remoteOrder.id),
        user_id: normalizeText(remoteOrder.customerId),
        courier_id: normalizeText(remoteOrder.courierId, ''),
        tracking_token: '',
        status: mapRemoteStatusToLegacy(remoteOrder.status),
        delivery_method: deliveryMethod,
        pickup_point: deliveryMethod === 'pickup' ? {
            id: normalizeText(remoteOrder.pickupStoreId, ''),
            name: pickupName,
            location: pickupAddress,
            lat: toSafeNumber(remoteOrder.pickupStoreLat, 0),
            lng: toSafeNumber(remoteOrder.pickupStoreLng, 0),
        } : null,
        pickup_status: deliveryMethod === 'pickup' && mapRemoteStatusToLegacy(remoteOrder.status) !== 'entregado' ? 'pendiente_recoleccion' : null,
        customer: {
            id: normalizeText(remoteOrder.customerId, ''),
            name: normalizeText(remoteOrder.customerName, 'Cliente'),
            email: '',
            phone: normalizeText(remoteOrder.customerPhone, ''),
            address: addressLabel,
        },
        items,
        total: toSafeNumber(remoteOrder.total, 0),
        location: Number.isFinite(Number(remoteOrder.courierLat)) && Number.isFinite(Number(remoteOrder.courierLng))
            ? { lat: Number(remoteOrder.courierLat), lng: Number(remoteOrder.courierLng) }
            : null,
        delivery_location: Number.isFinite(Number(destination.lat)) && Number.isFinite(Number(destination.lng))
            ? { lat: Number(destination.lat), lng: Number(destination.lng) }
            : null,
        created_at: remoteOrder.createdAt || new Date().toISOString(),
        updated_at: remoteOrder.updatedAt || new Date().toISOString(),
        address_colony: normalizeText(remoteOrder.addressColony, ''),
        address_subdivision: normalizeText(remoteOrder.addressSubdivision, ''),
    };
}

async function fetchJson(baseUrl, endpoint, options = {}, token = '') {
    const headers = {
        'Content-Type': 'application/json',
        ...(options.headers || {}),
    };
    if (token) headers.Authorization = `Bearer ${token}`;

    const response = await withTimeout(fetch(`${baseUrl}${endpoint}`, {
        ...options,
        headers,
    }));
    const contentType = response.headers.get('content-type') || '';
    const isJson = contentType.includes('application/json');
    const payload = isJson ? await response.json() : {};
    if (!response.ok) {
        const detail = payload?.detail || payload?.message || `Error HTTP ${response.status}`;
        throw new Error(detail);
    }
    return payload;
}

async function buildRemoteProductPayload(mercado, raw = {}, existingProduct = null) {
    const sellerId = normalizeText(raw.seller_id, mercado.AppState?.user?.id || existingProduct?.seller_id || 'seller-1');
    const sellerName = normalizeText(
        raw.seller_name,
        mercado.AppState?.user?.name || existingProduct?.seller_name || 'Vendedor local'
    );
    const categoryId = normalizeText(raw.category_id, existingProduct?.category_id || 'catalogo');
    const categoryLabel = normalizeText(
        raw.category_label,
        existingProduct?.category?.name || categoryId.replace(/-/g, ' ').replace(/\b\w/g, (m) => m.toUpperCase())
    );
    const firstImage = Array.isArray(raw.images) ? raw.images[0] : existingProduct?.images?.[0] || '';
    const imageData = String(firstImage || '').startsWith('data:') ? firstImage : '';
    const imageKey = imageData ? '' : Object.keys(PRODUCT_IMAGE_BY_KEY).find((key) => firstImage.includes(PRODUCT_IMAGE_BY_KEY[key])) || normalizeText(raw.image_key || existingProduct?.image_key || '', '');

    return {
        seller_id: sellerId,
        seller_name: sellerName,
        name: normalizeText(raw.name, existingProduct?.name || 'Producto local'),
        category: categoryId,
        category_label: categoryLabel,
        price: Math.max(1, toSafeNumber(raw.price, existingProduct?.price || 1)),
        stock: Math.max(0, toSafeNumber(raw.stock, existingProduct?.stock || 0)),
        description: normalizeText(raw.description, existingProduct?.description || 'Producto local'),
        featured: Boolean(raw.is_featured ?? existingProduct?.is_featured ?? false),
        local: Boolean(raw.is_local_handmade ?? existingProduct?.is_local_handmade ?? true),
        verified: Boolean(raw.local_handmade_verified ?? existingProduct?.local_handmade_verified ?? true),
        rating: toSafeNumber(raw.average_rating ?? existingProduct?.average_rating ?? 5, 5),
        views: Math.max(0, toSafeNumber(raw.views, existingProduct?.views || 0)),
        image_key: imageKey || null,
        image_data: imageData || null,
    };
}

function applyLegacyRemoteAdapters(mercado) {
    if (!USE_BACKEND) return;
    if (mercado.__remoteAdaptersApplied) return;
    mercado.__remoteAdaptersApplied = true;

    if (mercado.AppState?.token === 'demo-token') {
        mercado.AppState.token = null;
        mercado.AppState.user = null;
        localStorage.removeItem('token');
        localStorage.removeItem('demoUserId');
    }

    mercado.API_URL = CLIENTES_API_URL;

    const originals = {
        initAuth: mercado.initAuth?.bind(mercado),
        apiRequest: mercado.apiRequest?.bind(mercado),
        auth: {
            register: mercado.AuthAPI.register.bind(mercado.AuthAPI),
            login: mercado.AuthAPI.login.bind(mercado.AuthAPI),
            getMe: mercado.AuthAPI.getMe.bind(mercado.AuthAPI),
        },
        cart: {
            getCurrent: mercado.CartAPI.getCurrent.bind(mercado.CartAPI),
            addItem: mercado.CartAPI.addItem.bind(mercado.CartAPI),
            updateItem: mercado.CartAPI.updateItem.bind(mercado.CartAPI),
            removeItem: mercado.CartAPI.removeItem.bind(mercado.CartAPI),
            clear: mercado.CartAPI.clear.bind(mercado.CartAPI),
            getSellerActive: mercado.CartAPI.getSellerActive.bind(mercado.CartAPI),
        },
        products: {
            getAll: mercado.ProductsAPI.getAll.bind(mercado.ProductsAPI),
            getById: mercado.ProductsAPI.getById.bind(mercado.ProductsAPI),
            create: mercado.ProductsAPI.create.bind(mercado.ProductsAPI),
            update: mercado.ProductsAPI.update.bind(mercado.ProductsAPI),
            delete: mercado.ProductsAPI.delete.bind(mercado.ProductsAPI),
            getFeatured: mercado.ProductsAPI.getFeatured.bind(mercado.ProductsAPI),
            getSellerProducts: mercado.ProductsAPI.getSellerProducts.bind(mercado.ProductsAPI),
        },
        categories: {
            getAll: mercado.CategoriesAPI.getAll.bind(mercado.CategoriesAPI),
            create: mercado.CategoriesAPI.create.bind(mercado.CategoriesAPI),
        },
        sellers: {
            getAll: mercado.SellersAPI.getAll.bind(mercado.SellersAPI),
            getById: mercado.SellersAPI.getById.bind(mercado.SellersAPI),
            updateProfile: mercado.SellersAPI.updateProfile.bind(mercado.SellersAPI),
            getMetrics: mercado.SellersAPI.getMetrics.bind(mercado.SellersAPI),
        },
        favorites: {
            add: mercado.FavoritesAPI.add.bind(mercado.FavoritesAPI),
            remove: mercado.FavoritesAPI.remove.bind(mercado.FavoritesAPI),
            getAll: mercado.FavoritesAPI.getAll.bind(mercado.FavoritesAPI),
        },
        reviews: {
            create: mercado.ReviewsAPI.create.bind(mercado.ReviewsAPI),
        },
        reports: {
            create: mercado.ReportsAPI.create.bind(mercado.ReportsAPI),
            getAll: mercado.ReportsAPI.getAll.bind(mercado.ReportsAPI),
            getMy: mercado.ReportsAPI.getMy.bind(mercado.ReportsAPI),
        },
        orders: {
            create: mercado.OrdersAPI.create.bind(mercado.OrdersAPI),
            getById: mercado.OrdersAPI.getById.bind(mercado.OrdersAPI),
            getMy: mercado.OrdersAPI.getMy.bind(mercado.OrdersAPI),
            getAssigned: mercado.OrdersAPI.getAssigned.bind(mercado.OrdersAPI),
            getPickupPending: mercado.OrdersAPI.getPickupPending.bind(mercado.OrdersAPI),
            getSellerOrders: mercado.OrdersAPI.getSellerOrders.bind(mercado.OrdersAPI),
            updateStatus: mercado.OrdersAPI.updateStatus.bind(mercado.OrdersAPI),
            assign: mercado.OrdersAPI.assign.bind(mercado.OrdersAPI),
            updateLocation: mercado.OrdersAPI.updateLocation.bind(mercado.OrdersAPI),
            markPickupCollected: mercado.OrdersAPI.markPickupCollected.bind(mercado.OrdersAPI),
            markPickupNoShow: mercado.OrdersAPI.markPickupNoShow.bind(mercado.OrdersAPI),
        },
        admin: {
            getStats: mercado.AdminAPI.getStats.bind(mercado.AdminAPI),
            getUsers: mercado.AdminAPI.getUsers.bind(mercado.AdminAPI),
            updateProductStatus: mercado.AdminAPI.updateProductStatus.bind(mercado.AdminAPI),
            verifyLocalHandmade: mercado.AdminAPI.verifyLocalHandmade.bind(mercado.AdminAPI),
            featureProduct: mercado.AdminAPI.featureProduct.bind(mercado.AdminAPI),
            updateSellerStatus: mercado.AdminAPI.updateSellerStatus.bind(mercado.AdminAPI),
            updateUserStatus: mercado.AdminAPI.updateUserStatus.bind(mercado.AdminAPI),
            updateReport: mercado.AdminAPI.updateReport.bind(mercado.AdminAPI),
        },
    };

    const cache = {
        productsById: new Map(),
    };

    async function callRemoteOrFallback(remoteCall, _fallbackCall, errorContext = 'backend') {
        try {
            return await remoteCall();
        } catch (error) {
            console.error(`MercadoLocal remoto (${errorContext}) error:`, error?.message || error);
            throw error;
        }
    }

    function currentOwnerId() {
        const userId = normalizeText(mercado.AppState?.user?.id, '');
        if (userId) return userId;
        let guestId = normalizeText(localStorage.getItem('guestCartId'), '');
        if (!guestId) {
            guestId = `guest-${Date.now()}`;
            localStorage.setItem('guestCartId', guestId);
        }
        return guestId;
    }

    async function hydrateCartItems(cartItems = []) {
        const detailedItems = [];
        for (const item of cartItems) {
            const product = await mercado.ProductsAPI.getById(item.product_id);
            if (!product) continue;
            const quantity = Math.max(1, Number(item.quantity || 1));
            detailedItems.push({
                product,
                quantity,
                subtotal: quantity * Number(product.price || 0),
            });
        }
        return detailedItems;
    }

    async function fetchRemoteProducts() {
        const payload = await fetchJson(CLIENTES_API_URL, '/productos');
        const list = Array.isArray(payload?.products) ? payload.products : [];
        const normalized = list.map((item) => normalizeRemoteProduct(mercado, item));
        normalized.forEach((item) => cache.productsById.set(item.id, item));
        return normalized;
    }

    async function fetchRemoteOrders(params = {}) {
        const search = new URLSearchParams();
        Object.entries(params).forEach(([key, value]) => {
            if (value === undefined || value === null || value === '') return;
            search.set(key, String(value));
        });
        const endpoint = `/pedidos${search.toString() ? `?${search.toString()}` : ''}`;
        const payload = await fetchJson(PEDIDOS_API_URL, endpoint);
        const list = Array.isArray(payload?.pedidos) ? payload.pedidos : [];
        return list.map((item) => toLegacyOrder(mercado, item, cache.productsById));
    }

    mercado.initAuth = async () => {
        const token = mercado.AppState?.token || localStorage.getItem('token') || '';
        const remoteUserId = readRemoteUserIdFromToken(token);

        if (!remoteUserId) {
            if (typeof mercado.syncCartStateForUser === 'function') {
                mercado.syncCartStateForUser(null);
            }
            return;
        }

        try {
            const payload = await fetchJson(CLIENTES_API_URL, `/usuarios-app/${encodeURIComponent(remoteUserId)}`);
            const user = normalizeRemoteUser(payload?.user || {});
            mercado.AppState.user = user;
            mercado.AppState.token = buildRemoteToken(user.id);
            localStorage.setItem('token', mercado.AppState.token);
            if (typeof mercado.syncCartAfterAuth === 'function') {
                mercado.syncCartAfterAuth(user);
            }
        } catch {
            mercado.AppState.user = null;
            mercado.AppState.token = null;
            localStorage.removeItem('token');
            localStorage.removeItem('demoUserId');
            if (typeof mercado.syncCartStateForUser === 'function') {
                mercado.syncCartStateForUser(null);
            }
        }
    };

    mercado.AuthAPI.login = async (email, password) => callRemoteOrFallback(
        async () => {
            const payload = await fetchJson(CLIENTES_API_URL, '/auth/login', {
                method: 'POST',
                body: JSON.stringify({ email, password }),
            });
            const user = normalizeRemoteUser(payload?.user || {});
            return { token: buildRemoteToken(user.id), user, source: 'remote' };
        },
        () => originals.auth.login(email, password),
        'auth.login'
    );

    mercado.AuthAPI.getMe = async () => callRemoteOrFallback(
        async () => {
            const token = mercado.AppState?.token || localStorage.getItem('token') || '';
            const remoteUserId = readRemoteUserIdFromToken(token);
            if (!remoteUserId) throw new Error('Sesion remota no encontrada');
            const payload = await fetchJson(CLIENTES_API_URL, `/usuarios-app/${encodeURIComponent(remoteUserId)}`);
            return normalizeRemoteUser(payload?.user || {});
        },
        () => originals.auth.getMe(),
        'auth.me'
    );

    mercado.AuthAPI.register = async (email, password, name, role, extra = {}) => callRemoteOrFallback(
        async () => {
            const payload = await fetchJson(CLIENTES_API_URL, '/auth/register', {
                method: 'POST',
                body: JSON.stringify({
                    email,
                    password,
                    name,
                    role,
                    phone: extra.phone || '',
                    location: extra.location || '',
                    curp: extra.curp || '',
                }),
            });
            const user = normalizeRemoteUser(payload?.user || {});
            return { token: buildRemoteToken(user.id), user, source: 'remote' };
        },
        () => originals.auth.register(email, password, name, role, extra),
        'auth.register'
    );

    mercado.ProductsAPI.getAll = async (params = {}) => callRemoteOrFallback(
        async () => {
            let list = await fetchRemoteProducts();
            const search = normalizeText(params.search, '').toLowerCase();
            const categoryId = normalizeText(params.category_id, '');
            const sellerId = normalizeText(params.seller_id, '');
            const maxPrice = params.max_price !== undefined ? Number(params.max_price) : null;
            const localOnly = params.is_local_handmade === true || params.is_local_handmade === 'true';
            const featuredOnly = params.is_featured === true || params.is_featured === 'true';
            const status = normalizeText(params.status, '').toLowerCase();

            if (search) {
                list = list.filter((item) => (
                    String(item.name || '').toLowerCase().includes(search)
                    || String(item.description || '').toLowerCase().includes(search)
                ));
            }
            if (categoryId) list = list.filter((item) => String(item.category_id || '') === categoryId);
            if (sellerId) list = list.filter((item) => String(item.seller_id || '') === sellerId);
            if (Number.isFinite(maxPrice)) list = list.filter((item) => Number(item.price || 0) <= Number(maxPrice));
            if (localOnly) list = list.filter((item) => Boolean(item.is_local_handmade));
            if (featuredOnly) list = list.filter((item) => Boolean(item.is_featured));
            if (status) list = list.filter((item) => String(item.status || '').toLowerCase() === status);

            const sortBy = normalizeText(params.sort_by, 'created_at');
            if (sortBy === 'price') {
                list.sort((a, b) => Number(a.price || 0) - Number(b.price || 0));
            } else if (sortBy === 'views') {
                list.sort((a, b) => Number(b.views || 0) - Number(a.views || 0));
            } else {
                list.sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0));
            }

            const skip = Math.max(0, toSafeNumber(params.skip, 0));
            const limit = Math.max(1, toSafeNumber(params.limit, list.length || 100));
            const paged = list.slice(skip, skip + limit);
            return { products: paged, total: list.length, source: 'remote' };
        },
        () => originals.products.getAll(params),
        'products.getAll'
    );

    mercado.ProductsAPI.getById = async (id) => callRemoteOrFallback(
        async () => {
            const payload = await fetchJson(CLIENTES_API_URL, `/productos/${encodeURIComponent(id)}`);
            const normalized = normalizeRemoteProduct(mercado, payload?.product || {});
            cache.productsById.set(normalized.id, normalized);
            return normalized;
        },
        () => originals.products.getById(id),
        'products.getById'
    );

    mercado.ProductsAPI.create = async (data) => callRemoteOrFallback(
        async () => {
            const payload = await buildRemoteProductPayload(mercado, data || {});
            const response = await fetchJson(CLIENTES_API_URL, '/productos', {
                method: 'POST',
                body: JSON.stringify(payload),
            });
            const normalized = normalizeRemoteProduct(mercado, response?.product || {});
            cache.productsById.set(normalized.id, normalized);
            return normalized;
        },
        () => originals.products.create(data),
        'products.create'
    );

    mercado.ProductsAPI.update = async (id, data) => callRemoteOrFallback(
        async () => {
            const existing = cache.productsById.get(String(id)) || await mercado.ProductsAPI.getById(id);
            const payload = await buildRemoteProductPayload(mercado, data || {}, existing);
            const response = await fetchJson(CLIENTES_API_URL, `/productos/${encodeURIComponent(id)}`, {
                method: 'PUT',
                body: JSON.stringify(payload),
            });
            const normalized = normalizeRemoteProduct(mercado, response?.product || {});
            cache.productsById.set(normalized.id, normalized);
            return normalized;
        },
        () => originals.products.update(id, data),
        'products.update'
    );

    mercado.ProductsAPI.delete = async (id) => callRemoteOrFallback(
        async () => {
            await fetchJson(CLIENTES_API_URL, `/productos/${encodeURIComponent(id)}`, {
                method: 'DELETE',
            });
            cache.productsById.delete(String(id));
            return { ok: true };
        },
        () => originals.products.delete(id),
        'products.delete'
    );

    mercado.ProductsAPI.getFeatured = async () => {
        const result = await mercado.ProductsAPI.getAll({ is_featured: true, limit: 500 });
        return result?.products || [];
    };

    mercado.ProductsAPI.getSellerProducts = async () => {
        const sellerId = normalizeText(mercado.AppState?.user?.id, '');
        const result = await mercado.ProductsAPI.getAll({ seller_id: sellerId || undefined, limit: 500 });
        return result?.products || [];
    };

    mercado.CategoriesAPI.getAll = async () => callRemoteOrFallback(
        async () => {
            const payload = await fetchJson(CLIENTES_API_URL, '/categorias');
            const categories = Array.isArray(payload?.categories) ? payload.categories : [];
            return categories.map((item) => ({
                id: normalizeText(item.id, ''),
                name: normalizeText(item.name, 'Categoria'),
                description: normalizeText(item.description, ''),
                status: normalizeText(item.status, 'approved'),
                created_at: item.created_at || new Date().toISOString(),
            }));
        },
        () => originals.categories.getAll(),
        'categories.getAll'
    );

    mercado.CategoriesAPI.create = async (data) => callRemoteOrFallback(
        async () => {
            const payload = await fetchJson(CLIENTES_API_URL, '/categorias', {
                method: 'POST',
                body: JSON.stringify({
                    name: normalizeText(data?.name, 'Categoria'),
                    description: normalizeText(data?.description, ''),
                }),
            });
            return payload?.category || null;
        },
        () => originals.categories.create(data),
        'categories.create'
    );

    mercado.SellersAPI.getAll = async () => callRemoteOrFallback(
        async () => {
            const payload = await fetchJson(CLIENTES_API_URL, '/usuarios-app?role=seller');
            const list = Array.isArray(payload?.users) ? payload.users : [];
            return list.map((user) => normalizeRemoteUser(user));
        },
        () => originals.sellers.getAll(),
        'sellers.getAll'
    );

    mercado.SellersAPI.getById = async (id) => callRemoteOrFallback(
        async () => {
            const payload = await fetchJson(CLIENTES_API_URL, `/usuarios-app/${encodeURIComponent(id)}`);
            const user = normalizeRemoteUser(payload?.user || {});
            return {
                ...user,
                seller_profile: user.seller_profile || {
                    business_name: user.name,
                    description: '',
                    schedule: '',
                    location: user.address || 'Chiapas, Mexico',
                    phone: user.phone || '',
                    curp: '',
                },
            };
        },
        () => originals.sellers.getById(id),
        'sellers.getById'
    );

    mercado.SellersAPI.updateProfile = async (data) => callRemoteOrFallback(
        async () => {
            const sellerId = normalizeText(mercado.AppState?.user?.id, '');
            const payload = await fetchJson(CLIENTES_API_URL, `/seller/profile?seller_id=${encodeURIComponent(sellerId)}`, {
                method: 'PUT',
                body: JSON.stringify({
                    business_name: normalizeText(data?.business_name || data?.name, mercado.AppState?.user?.name || 'Vendedor'),
                    description: normalizeText(data?.description, ''),
                    schedule: normalizeText(data?.schedule, ''),
                    location: normalizeText(data?.location, ''),
                    phone: normalizeText(data?.phone, ''),
                    curp: normalizeText(data?.curp, ''),
                }),
            });
            return payload?.profile || {};
        },
        () => originals.sellers.updateProfile(data),
        'sellers.updateProfile'
    );

    mercado.CartAPI.getCurrent = async () => callRemoteOrFallback(
        async () => {
            const ownerId = currentOwnerId();
            const payload = await fetchJson(CLIENTES_API_URL, `/cart?owner_id=${encodeURIComponent(ownerId)}`);
            return payload || { items: [] };
        },
        () => originals.cart.getCurrent(),
        'cart.getCurrent'
    );

    mercado.CartAPI.addItem = async (productId, quantity = 1) => callRemoteOrFallback(
        async () => {
            const ownerId = currentOwnerId();
            await fetchJson(
                CLIENTES_API_URL,
                `/cart/items?owner_id=${encodeURIComponent(ownerId)}&product_id=${encodeURIComponent(productId)}&quantity=${encodeURIComponent(Number(quantity || 1))}`,
                { method: 'POST' }
            );
            return mercado.CartAPI.getCurrent();
        },
        () => originals.cart.addItem(productId, quantity),
        'cart.addItem'
    );

    mercado.CartAPI.updateItem = async (productId, quantity) => callRemoteOrFallback(
        async () => {
            const ownerId = currentOwnerId();
            await fetchJson(
                CLIENTES_API_URL,
                `/cart/items/${encodeURIComponent(productId)}?owner_id=${encodeURIComponent(ownerId)}&quantity=${encodeURIComponent(Number(quantity || 0))}`,
                { method: 'PUT' }
            );
            return mercado.CartAPI.getCurrent();
        },
        () => originals.cart.updateItem(productId, quantity),
        'cart.updateItem'
    );

    mercado.CartAPI.removeItem = async (productId) => callRemoteOrFallback(
        async () => {
            const ownerId = currentOwnerId();
            await fetchJson(
                CLIENTES_API_URL,
                `/cart/items/${encodeURIComponent(productId)}?owner_id=${encodeURIComponent(ownerId)}`,
                { method: 'DELETE' }
            );
            return mercado.CartAPI.getCurrent();
        },
        () => originals.cart.removeItem(productId),
        'cart.removeItem'
    );

    mercado.CartAPI.clear = async () => callRemoteOrFallback(
        async () => {
            const ownerId = currentOwnerId();
            await fetchJson(CLIENTES_API_URL, `/cart?owner_id=${encodeURIComponent(ownerId)}`, { method: 'DELETE' });
            return { items: [] };
        },
        () => originals.cart.clear(),
        'cart.clear'
    );

    mercado.CartAPI.getSellerActive = async () => callRemoteOrFallback(
        async () => {
            const sellerId = normalizeText(mercado.AppState?.user?.id, '');
            const payload = await fetchJson(CLIENTES_API_URL, `/seller/carts/active?seller_id=${encodeURIComponent(sellerId)}`);
            return payload?.carts || [];
        },
        () => originals.cart.getSellerActive(),
        'cart.getSellerActive'
    );

    mercado.getCartDetailedItems = async () => {
        const cartResponse = await mercado.CartAPI.getCurrent();
        const cartItems = Array.isArray(cartResponse?.items) ? cartResponse.items : [];
        mercado.AppState.cart = cartItems.map((item) => ({ product_id: item.product_id, quantity: item.quantity }));
        localStorage.setItem('cart', JSON.stringify(mercado.AppState.cart));
        return hydrateCartItems(cartItems);
    };

    mercado.addProductToCart = async (productId, quantity = 1) => {
        const product = await mercado.ProductsAPI.getById(productId);
        if (!product) throw new Error('Producto no encontrado');
        await mercado.CartAPI.addItem(productId, quantity);
        const current = await mercado.CartAPI.getCurrent();
        mercado.AppState.cart = Array.isArray(current?.items) ? current.items : [];
        localStorage.setItem('cart', JSON.stringify(mercado.AppState.cart));
        return true;
    };

    mercado.updateCartItemQuantity = async (productId, quantity) => {
        await mercado.CartAPI.updateItem(productId, quantity);
        const current = await mercado.CartAPI.getCurrent();
        mercado.AppState.cart = Array.isArray(current?.items) ? current.items : [];
        localStorage.setItem('cart', JSON.stringify(mercado.AppState.cart));
    };

    mercado.removeFromCart = async (productId) => {
        await mercado.CartAPI.removeItem(productId);
        const current = await mercado.CartAPI.getCurrent();
        mercado.AppState.cart = Array.isArray(current?.items) ? current.items : [];
        localStorage.setItem('cart', JSON.stringify(mercado.AppState.cart));
    };

    mercado.clearCart = async () => {
        await mercado.CartAPI.clear();
        mercado.AppState.cart = [];
        localStorage.setItem('cart', '[]');
    };

    mercado.FavoritesAPI.getAll = async () => callRemoteOrFallback(
        async () => {
            const userId = normalizeText(mercado.AppState?.user?.id, '');
            const payload = await fetchJson(CLIENTES_API_URL, `/favorites?user_id=${encodeURIComponent(userId)}`);
            const list = Array.isArray(payload?.favorites) ? payload.favorites : [];
            mercado.AppState.favorites = [...list];
            localStorage.setItem('favorites', JSON.stringify(mercado.AppState.favorites));
            return list;
        },
        () => originals.favorites.getAll(),
        'favorites.getAll'
    );

    mercado.FavoritesAPI.add = async (productId) => callRemoteOrFallback(
        async () => {
            const userId = normalizeText(mercado.AppState?.user?.id, '');
            await fetchJson(CLIENTES_API_URL, `/favorites/${encodeURIComponent(productId)}?user_id=${encodeURIComponent(userId)}`, {
                method: 'POST',
            });
            return { ok: true };
        },
        () => originals.favorites.add(productId),
        'favorites.add'
    );

    mercado.FavoritesAPI.remove = async (productId) => callRemoteOrFallback(
        async () => {
            const userId = normalizeText(mercado.AppState?.user?.id, '');
            await fetchJson(CLIENTES_API_URL, `/favorites/${encodeURIComponent(productId)}?user_id=${encodeURIComponent(userId)}`, {
                method: 'DELETE',
            });
            return { ok: true };
        },
        () => originals.favorites.remove(productId),
        'favorites.remove'
    );

    mercado.ReviewsAPI.create = async (data) => callRemoteOrFallback(
        async () => {
            const userId = normalizeText(mercado.AppState?.user?.id, '');
            return fetchJson(CLIENTES_API_URL, '/reviews', {
                method: 'POST',
                body: JSON.stringify({
                    user_id: userId,
                    product_id: data?.product_id,
                    rating: Number(data?.rating || 0),
                    comment: normalizeText(data?.comment, ''),
                }),
            });
        },
        () => originals.reviews.create(data),
        'reviews.create'
    );

    mercado.ReportsAPI.create = async (data) => callRemoteOrFallback(
        async () => {
            const userId = normalizeText(mercado.AppState?.user?.id, '');
            return fetchJson(CLIENTES_API_URL, '/reports', {
                method: 'POST',
                body: JSON.stringify({
                    reporter_id: userId,
                    target_type: normalizeText(data?.target_type, 'product'),
                    target_id: normalizeText(data?.target_id, ''),
                    reason: normalizeText(data?.reason, 'other'),
                    description: normalizeText(data?.description, ''),
                }),
            });
        },
        () => originals.reports.create(data),
        'reports.create'
    );

    mercado.ReportsAPI.getAll = async (statusFilter = '') => callRemoteOrFallback(
        async () => {
            const endpoint = statusFilter ? `/reports?status=${encodeURIComponent(statusFilter)}` : '/reports';
            const payload = await fetchJson(CLIENTES_API_URL, endpoint);
            return Array.isArray(payload?.reports) ? payload.reports : [];
        },
        () => originals.reports.getAll(statusFilter),
        'reports.getAll'
    );

    mercado.ReportsAPI.getMy = async () => callRemoteOrFallback(
        async () => {
            const userId = normalizeText(mercado.AppState?.user?.id, '');
            const payload = await fetchJson(CLIENTES_API_URL, `/reports/my?user_id=${encodeURIComponent(userId)}`);
            return Array.isArray(payload?.reports) ? payload.reports : [];
        },
        () => originals.reports.getMy(),
        'reports.getMy'
    );

    mercado.SellersAPI.getMetrics = async () => callRemoteOrFallback(
        async () => {
            const sellerId = normalizeText(mercado.AppState?.user?.id, '');
            const productResult = await mercado.ProductsAPI.getAll({ seller_id: sellerId, limit: 500 });
            const allOrders = await fetchRemoteOrders({ seller_id: sellerId });
            const delivered = allOrders.filter((item) => mapLegacyStatusToRemote(item.status) === 'entregado');
            return {
                total_products: (productResult?.products || []).length,
                total_sales: delivered.reduce((sum, item) => sum + Number(item.total || 0), 0),
                total_orders: allOrders.length,
                average_rating: (productResult?.products || []).length
                    ? Number(((productResult.products.reduce((sum, item) => sum + Number(item.average_rating || 0), 0)) / productResult.products.length).toFixed(1))
                    : 0,
            };
        },
        () => originals.sellers.getMetrics(),
        'sellers.metrics'
    );

    mercado.OrdersAPI.create = async (data) => callRemoteOrFallback(
        async () => {
            const currentUser = mercado.AppState?.user || {};
            const sourceItems = Array.isArray(data?.items) ? data.items : [];
            const enrichedItems = await Promise.all(sourceItems.map(async (item, index) => {
                let known = cache.productsById.get(String(item.product_id || item.productId || ''));
                if (!known && item.product_id) {
                    try { known = await mercado.ProductsAPI.getById(item.product_id); } catch { known = null; }
                }
                const quantity = Math.max(1, toSafeNumber(item.quantity, 1));
                const price = Math.max(0, toSafeNumber(item.price, known?.price || 0));
                return {
                    productId: normalizeText(item.product_id || item.productId, `product-${index}`),
                    productName: normalizeText(item.name || item.productName, known?.name || 'Producto'),
                    sellerId: normalizeText(item.seller_id || item.sellerId, known?.seller_id || 'seller-1'),
                    sellerName: normalizeText(item.seller_name || item.sellerName, known?.seller_name || 'Vendedor local'),
                    categoryLabel: normalizeText(item.category_label || item.categoryLabel, known?.category?.name || 'Catalogo'),
                    price,
                    quantity,
                    subtotal: Number((price * quantity).toFixed(2)),
                };
            }));

            const pickup = data?.pickup_point || null;
            const location = data?.location || null;
            const isPickup = String(data?.delivery_method || 'delivery').toLowerCase() === 'pickup';
            const addressValue = normalizeText(data?.customer?.address, isPickup ? 'Recoger en tienda local' : 'Direccion por confirmar');
            const payload = {
                customerId: normalizeText(currentUser.id, `guest-${Date.now()}`),
                customerName: normalizeText(data?.customer?.name, currentUser.name || 'Cliente'),
                customerPhone: normalizeText(data?.customer?.phone, currentUser.phone || '0000000000'),
                deliveryMethod: isPickup ? 'pickup' : 'delivery',
                pickupStoreId: normalizeText(pickup?.id, ''),
                pickupStoreName: normalizeText(pickup?.name, ''),
                pickupStoreLat: Number.isFinite(Number(pickup?.lat)) ? Number(pickup.lat) : null,
                pickupStoreLng: Number.isFinite(Number(pickup?.lng)) ? Number(pickup.lng) : null,
                address: addressValue,
                addressLabel: addressValue,
                addressLat: Number.isFinite(Number(location?.lat)) ? Number(location.lat) : null,
                addressLng: Number.isFinite(Number(location?.lng)) ? Number(location.lng) : null,
                addressColony: '',
                addressSubdivision: '',
                note: normalizeText(data?.note, ''),
                items: enrichedItems,
                total: Number(Math.max(1, toSafeNumber(data?.total, 1)).toFixed(2)),
            };

            const response = await fetchJson(PEDIDOS_API_URL, '/pedidos', {
                method: 'POST',
                body: JSON.stringify(payload),
            });
            return toLegacyOrder(mercado, response?.pedido || {}, cache.productsById);
        },
        () => originals.orders.create(data),
        'orders.create'
    );

    mercado.OrdersAPI.getById = async (id, token = '') => callRemoteOrFallback(
        async () => {
            const payload = await fetchJson(PEDIDOS_API_URL, `/pedidos/${encodeURIComponent(id)}`);
            return toLegacyOrder(mercado, payload?.pedido || {}, cache.productsById);
        },
        () => originals.orders.getById(id, token),
        'orders.getById'
    );

    mercado.OrdersAPI.getMy = async () => callRemoteOrFallback(
        async () => {
            const role = normalizeText(mercado.AppState?.user?.role, '');
            const userId = normalizeText(mercado.AppState?.user?.id, '');
            if (!userId) return [];
            if (role === 'seller') return fetchRemoteOrders({ seller_id: userId });
            if (role === 'courier') return fetchRemoteOrders({ courier_id: userId });
            if (role === 'admin') return fetchRemoteOrders();
            return fetchRemoteOrders({ customer_id: userId });
        },
        () => originals.orders.getMy(),
        'orders.getMy'
    );

    mercado.OrdersAPI.getAssigned = async () => callRemoteOrFallback(
        async () => fetchRemoteOrders(),
        () => originals.orders.getAssigned(),
        'orders.getAssigned'
    );

    mercado.OrdersAPI.getPickupPending = async () => callRemoteOrFallback(
        async () => {
            const sellerId = normalizeText(mercado.AppState?.user?.id, '');
            const orders = await fetchRemoteOrders({ seller_id: sellerId });
            return orders.filter((order) => (
                String(order.delivery_method || '').toLowerCase() === 'pickup'
                && mapLegacyStatusToRemote(order.status) !== 'entregado'
                && mapLegacyStatusToRemote(order.status) !== 'cancelado'
            ));
        },
        () => originals.orders.getPickupPending(),
        'orders.getPickupPending'
    );

    mercado.OrdersAPI.getSellerOrders = async () => callRemoteOrFallback(
        async () => {
            const sellerId = normalizeText(mercado.AppState?.user?.id, '');
            return fetchRemoteOrders({ seller_id: sellerId });
        },
        () => originals.orders.getSellerOrders(),
        'orders.getSellerOrders'
    );

    mercado.OrdersAPI.updateStatus = async (id, status) => callRemoteOrFallback(
        async () => {
            const existing = await mercado.OrdersAPI.getById(id);
            const currentUser = mercado.AppState?.user || {};
            const payload = {
                status: mapLegacyStatusToRemote(status || existing.status),
                courierId: normalizeText(existing.courier_id || currentUser.id, ''),
                courierName: normalizeText(currentUser.name, existing.courier_name || ''),
            };
            const response = await fetchJson(PEDIDOS_API_URL, `/pedidos/${encodeURIComponent(id)}/estado`, {
                method: 'PUT',
                body: JSON.stringify(payload),
            });
            return toLegacyOrder(mercado, response?.pedido || {}, cache.productsById);
        },
        () => originals.orders.updateStatus(id, status),
        'orders.updateStatus'
    );

    mercado.OrdersAPI.assign = async (id, courierId = '') => callRemoteOrFallback(
        async () => {
            const existing = await mercado.OrdersAPI.getById(id);
            const currentUser = mercado.AppState?.user || {};
            const assignedCourierId = normalizeText(courierId, currentUser.id || existing.courier_id || '');
            const assignedCourierName = normalizeText(currentUser.name, existing.courier_name || '');
            const payload = {
                status: mapLegacyStatusToRemote(existing.status || 'pedido_realizado'),
                courierId: assignedCourierId,
                courierName: assignedCourierName,
            };
            const response = await fetchJson(PEDIDOS_API_URL, `/pedidos/${encodeURIComponent(id)}/estado`, {
                method: 'PUT',
                body: JSON.stringify(payload),
            });
            return toLegacyOrder(mercado, response?.pedido || {}, cache.productsById);
        },
        () => originals.orders.assign(id, courierId),
        'orders.assign'
    );

    mercado.OrdersAPI.updateLocation = async (id, lat, lng) => callRemoteOrFallback(
        async () => {
            const existing = await mercado.OrdersAPI.getById(id);
            const currentUser = mercado.AppState?.user || {};
            const payload = {
                status: mapLegacyStatusToRemote(existing.status || 'pedido_realizado'),
                courierId: normalizeText(existing.courier_id || currentUser.id, ''),
                courierName: normalizeText(currentUser.name, existing.courier_name || ''),
                courierLat: Number(lat),
                courierLng: Number(lng),
                locationAt: new Date().toISOString(),
            };
            const response = await fetchJson(PEDIDOS_API_URL, `/pedidos/${encodeURIComponent(id)}/estado`, {
                method: 'PUT',
                body: JSON.stringify(payload),
            });
            return toLegacyOrder(mercado, response?.pedido || {}, cache.productsById);
        },
        () => originals.orders.updateLocation(id, lat, lng),
        'orders.updateLocation'
    );

    mercado.OrdersAPI.markPickupCollected = async (id) => mercado.OrdersAPI.updateStatus(id, 'entregado');
    mercado.OrdersAPI.markPickupNoShow = async (id) => mercado.OrdersAPI.updateStatus(id, 'cancelado_no_show');

    mercado.AdminAPI.getUsers = async (role = '') => callRemoteOrFallback(
        async () => {
            const query = role ? `?role=${encodeURIComponent(role)}` : '';
            const payload = await fetchJson(CLIENTES_API_URL, `/usuarios-app${query}`);
            const users = Array.isArray(payload?.users) ? payload.users : [];
            return users.map((user) => {
                const normalized = normalizeRemoteUser(user);
                return {
                    ...normalized,
                    created_at: normalized.created_at,
                };
            });
        },
        () => originals.admin.getUsers(role),
        'admin.getUsers'
    );

    mercado.AdminAPI.getStats = async () => callRemoteOrFallback(
        async () => {
            const [products, orders, users] = await Promise.all([
                mercado.ProductsAPI.getAll({ limit: 1000 }),
                fetchRemoteOrders(),
                fetchJson(CLIENTES_API_URL, '/usuarios-app'),
            ]);
            const userList = Array.isArray(users?.users) ? users.users : [];
            return {
                users_total: userList.length,
                products_total: (products?.products || []).length,
                orders_total: orders.length,
                reports_pending: 0,
                sellers_pending: 0,
            };
        },
        () => originals.admin.getStats(),
        'admin.stats'
    );

    mercado.AdminAPI.updateProductStatus = async (id, statusValue) => fetchJson(
        CLIENTES_API_URL,
        `/admin/products/${encodeURIComponent(id)}/status?status=${encodeURIComponent(statusValue)}`,
        { method: 'PUT' }
    );
    mercado.AdminAPI.verifyLocalHandmade = async (id, verified) => fetchJson(
        CLIENTES_API_URL,
        `/admin/products/${encodeURIComponent(id)}/verify-local?verified=${encodeURIComponent(Boolean(verified))}`,
        { method: 'PUT' }
    );
    mercado.AdminAPI.featureProduct = async (id, days) => fetchJson(
        CLIENTES_API_URL,
        `/admin/products/${encodeURIComponent(id)}/feature?days=${encodeURIComponent(Number(days || 7))}`,
        { method: 'PUT' }
    );
    mercado.AdminAPI.updateSellerStatus = async (id, statusValue) => fetchJson(
        CLIENTES_API_URL,
        `/admin/sellers/${encodeURIComponent(id)}/status?status=${encodeURIComponent(statusValue)}`,
        { method: 'PUT' }
    );
    mercado.AdminAPI.updateUserStatus = async (id, statusValue) => fetchJson(
        CLIENTES_API_URL,
        `/admin/users/${encodeURIComponent(id)}/status?status=${encodeURIComponent(statusValue)}`,
        { method: 'PUT' }
    );
    mercado.AdminAPI.updateReport = async (id, statusValue, notes) => fetchJson(
        CLIENTES_API_URL,
        `/reports/${encodeURIComponent(id)}?status=${encodeURIComponent(statusValue)}&admin_notes=${encodeURIComponent(notes || '')}`,
        { method: 'PUT' }
    );

    mercado.apiRequest = async (endpoint, options = {}) => {
        const path = String(endpoint || '');
        if (path === '/history' && (!options.method || String(options.method).toUpperCase() === 'GET')) {
            return mercado.OrdersAPI.getMy();
        }
        if (path.startsWith('/categories/')) {
            const subPath = path.replace('/categories', '/categorias');
            return fetchJson(CLIENTES_API_URL, subPath, options);
        }
        if (path.startsWith('/products/') && path.endsWith('/feature')) {
            return fetchJson(CLIENTES_API_URL, path, options);
        }
        if (path === '/subscription') {
            const body = options?.body ? JSON.parse(options.body) : {};
            const userId = normalizeText(mercado.AppState?.user?.id, '');
            return fetchJson(
                CLIENTES_API_URL,
                `/subscription?user_id=${encodeURIComponent(userId)}&plan=${encodeURIComponent(body?.plan || 'free')}`,
                { method: 'POST' }
            );
        }
        if (path.startsWith('/reports/')) {
            return fetchJson(CLIENTES_API_URL, path, options);
        }
        throw new Error(`Ruta no soportada en modo remoto estricto: ${path}`);
    };
}

export function getMercadoLocal() {
    if (!window.MercadoLocal) {
        throw new Error('MercadoLocal legacy no esta cargado.');
    }

    if (USE_BACKEND) {
        applyLegacyRemoteAdapters(window.MercadoLocal);
    }

    return window.MercadoLocal;
}

export async function ensureLegacySession(pathname = window.location.pathname) {
    const mercado = getMercadoLocal();

    if (!USE_BACKEND && mercado.DEMO_MODE && !mercado.AppState.token && isProtectedPath(pathname)) {
        mercado.AppState.token = 'demo-token';
        localStorage.setItem('token', 'demo-token');
    }

    if (typeof mercado.initAuth === 'function') {
        await mercado.initAuth();
    }

    return mercado;
}

export function snapshotState() {
    const mercado = getMercadoLocal();
    return {
        user: mercado.AppState.user,
        token: mercado.AppState.token,
        favorites: [...(mercado.AppState.favorites || [])],
        cart: [...(mercado.AppState.cart || [])],
        viewHistory: [...(mercado.AppState.viewHistory || [])],
        accessibilityMode: !!mercado.AppState.accessibilityMode,
        highContrast: !!mercado.AppState.highContrast,
    };
}

export function getCartCount(cart = []) {
    return cart.reduce((sum, item) => sum + Math.max(0, Number(item?.quantity || 0)), 0);
}
