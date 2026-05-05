const API_BASE_URL = stripTrailingSlash(String(import.meta.env.VITE_API_URL || '').trim());
const CLIENTES_API_URL = stripTrailingSlash(requireApiUrl(
    import.meta.env.VITE_CLIENTES_API_URL || (API_BASE_URL ? `${API_BASE_URL}/api/clientes` : ''),
    'VITE_CLIENTES_API_URL (o VITE_API_URL)',
));
const PEDIDOS_API_URL = stripTrailingSlash(requireApiUrl(
    import.meta.env.VITE_PEDIDOS_API_URL || (API_BASE_URL ? `${API_BASE_URL}/api/pedidos` : ''),
    'VITE_PEDIDOS_API_URL (o VITE_API_URL)',
));

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

let singleton = null;

function stripTrailingSlash(value = '') {
    return String(value || '').replace(/\/+$/, '');
}

function requireApiUrl(value = '', envName = '') {
    const normalized = String(value || '').trim();
    if (!normalized) {
        throw new Error(`Falta ${envName}. Define tus URLs remotas en frontend-react/.env.local`);
    }
    if (normalized.includes('tu-dominio.com')) {
        throw new Error(`Configura ${envName} con tu URL real de backend (no uses tu-dominio.com)`);
    }
    return normalized;
}

function toSafeNumber(value, fallback = 0) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
}

function normalizeText(value, fallback = '') {
    return String(value ?? fallback).trim();
}

function normalizeAuthEmail(value = '') {
    const normalized = normalizeText(value, '').toLowerCase();
    return normalized.endsWith('@mercadolocal.local')
        ? normalized.replace('@mercadolocal.local', '@mercadolocal.mx')
        : normalized;
}

function extractApiErrorMessage(payload, fallback = 'Error de validación') {
    if (!payload) return fallback;
    if (typeof payload === 'string') return payload;
    if (typeof payload.detail === 'string') return payload.detail;
    if (Array.isArray(payload.detail) && payload.detail.length > 0) {
        const first = payload.detail[0];
        if (typeof first === 'string') return first;
        if (first?.msg) return String(first.msg);
    }
    if (typeof payload.message === 'string' && payload.message.trim()) return payload.message;
    return fallback;
}

function normalizeRemoteRole(role = '') {
    const safe = String(role || '').toLowerCase();
    if (['admin', 'seller', 'courier', 'buyer'].includes(safe)) return safe;
    return 'buyer';
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

function normalizeRemoteUser(remoteUser = {}) {
    const role = normalizeRemoteRole(remoteUser.role);
    const id = normalizeText(remoteUser.id, `user-${Date.now()}`);
    const name = normalizeText(remoteUser.name, 'Usuario');
    const phone = normalizeText(remoteUser.phone, '');
    const address = normalizeText(remoteUser.address, '');
    const remoteStatus = normalizeText(remoteUser.status, '').toLowerCase();
    const status = remoteStatus
        || (remoteUser.active === false ? 'blocked' : 'verified');
    return {
        id,
        name,
        email: normalizeText(remoteUser.email, ''),
        role,
        status,
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

function buildFallbackSeller(remoteProduct = {}) {
    return {
        id: normalizeText(remoteProduct.sellerId, 'vendedor-1'),
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

function normalizeRemoteReview(remoteReview = {}, index = 0) {
    return {
        id: normalizeText(remoteReview.id, `r-${Date.now()}-${index}`),
        product_id: normalizeText(remoteReview.product_id, ''),
        user_id: normalizeText(remoteReview.user_id, ''),
        user_name: normalizeText(remoteReview.user_name, 'Usuario'),
        rating: Math.max(1, Math.min(5, Math.round(toSafeNumber(remoteReview.rating, 5)))),
        comment: normalizeText(remoteReview.comment, ''),
        created_at: normalizeText(remoteReview.created_at, new Date().toISOString()),
    };
}

function normalizeRemoteSellerFromProduct(remoteProduct = {}) {
    const seller = remoteProduct?.seller || {};
    if (!seller || typeof seller !== 'object') {
        return buildFallbackSeller(remoteProduct);
    }
    const fallback = buildFallbackSeller(remoteProduct);
    return {
        id: normalizeText(seller.id, fallback.id),
        name: normalizeText(seller.name, fallback.name),
        status: normalizeText(seller.status, fallback.status),
        seller_profile: {
            business_name: normalizeText(seller?.seller_profile?.business_name, fallback.seller_profile.business_name),
            description: normalizeText(seller?.seller_profile?.description, ''),
            schedule: normalizeText(seller?.seller_profile?.schedule, ''),
            location: normalizeText(seller?.seller_profile?.location, fallback.seller_profile.location),
            phone: normalizeText(seller?.seller_profile?.phone, ''),
            curp: normalizeText(seller?.seller_profile?.curp, ''),
        },
        average_rating: toSafeNumber(seller.average_rating, fallback.average_rating),
        total_products: toSafeNumber(seller.total_products, fallback.total_products),
        total_reviews: toSafeNumber(seller.total_reviews, fallback.total_reviews),
    };
}

function normalizeRemoteProduct(mercado, remoteProduct = {}) {
    const categoryId = toCategoryId(remoteProduct.category, remoteProduct.categoryLabel);
    const categoryName = normalizeText(remoteProduct.categoryLabel, remoteProduct.category || 'Catalogo');
    const image = resolveProductImage(remoteProduct.imageKey, remoteProduct.imageData);
    const reviews = Array.isArray(remoteProduct.reviews)
        ? remoteProduct.reviews.map((item, index) => normalizeRemoteReview(item, index))
        : [];

    return {
        id: normalizeText(remoteProduct.id),
        seller_id: normalizeText(remoteProduct.sellerId, 'vendedor-1'),
        category_id: categoryId,
        name: normalizeText(remoteProduct.name, 'Producto local'),
        description: normalizeText(remoteProduct.description, ''),
        price: toSafeNumber(remoteProduct.price, 0),
        images: image ? [image] : [mercado.createPlaceholderImage(remoteProduct.name || 'Producto')],
        stock: toSafeNumber(remoteProduct.stock, 0),
        status: normalizeText(remoteProduct.status, 'approved').toLowerCase(),
        is_featured: Boolean(remoteProduct.featured),
        is_local_handmade: Boolean(remoteProduct.local),
        local_handmade_verified: Boolean(remoteProduct.verified),
        views: toSafeNumber(remoteProduct.views, 0),
        created_at: remoteProduct.createdAt || new Date().toISOString(),
        updated_at: remoteProduct.updatedAt || new Date().toISOString(),
        category: { id: categoryId, name: categoryName },
        seller_name: normalizeText(remoteProduct.sellerName, 'Vendedor local'),
        seller: normalizeRemoteSellerFromProduct(remoteProduct),
        reviews,
        average_rating: Number(toSafeNumber(remoteProduct.rating, 0).toFixed(1)),
        favorites_count: toSafeNumber(remoteProduct.favoritesCount, 0),
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
            seller_id: normalizeText(item.sellerId, known?.seller_id || 'vendedor-1'),
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

function createMercadoLocal() {
    const cache = { productsById: new Map() };
    const mercado = {
        API_URL: CLIENTES_API_URL,
        AppState: {
            user: null,
            token: typeof window !== 'undefined' ? (window.localStorage.getItem('ml_token') || null) : null,
            favorites: [],
            cart: [],
            viewHistory: [],
            accessibilityMode: false,
            highContrast: false,
        },
        AuthAPI: {},
        ProductsAPI: {},
        CategoriesAPI: {},
        SellersAPI: {},
        CartAPI: {},
        FavoritesAPI: {},
        ReviewsAPI: {},
        ReportsAPI: {},
        OrdersAPI: {},
        AdminAPI: {},
    };

    mercado.formatPrice = (value) => new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', maximumFractionDigits: 0 }).format(Number(value || 0));
    mercado.formatDate = (value) => {
        if (!value) return '--';
        const date = new Date(value);
        if (Number.isNaN(date.getTime())) return '--';
        return date.toLocaleString('es-MX');
    };
    mercado.createPlaceholderImage = (label = 'Producto') => {
        const safe = encodeURIComponent(String(label || 'Producto'));
        return `https://dummyimage.com/900x900/efe6d7/4a331f?text=${safe}`;
    };
    mercado.showToast = (message, type = 'info') => {
        console[type === 'error' ? 'error' : 'log'](`[${type}] ${message}`);
    };
    mercado.addToHistory = () => {};
    mercado.syncCartAfterAuth = () => {};
    mercado.syncCartStateForUser = () => {};

    async function fetchJson(baseUrl, endpoint, options = {}) {
        const authHeaders = {};
        const token = normalizeText(mercado.AppState?.token, '');
        if (token && !options?.headers?.Authorization) {
            authHeaders.Authorization = `Bearer ${token}`;
        }
        const response = await fetch(`${baseUrl}${endpoint}`, {
            headers: {
                'Content-Type': 'application/json',
                ...authHeaders,
                ...(options.headers || {}),
            },
            ...options,
        });
        const payload = await response.json().catch(() => ({}));
        if (!response.ok) {
            throw new Error(extractApiErrorMessage(payload, `Error HTTP ${response.status}`));
        }
        return payload;
    }

    async function fetchRemoteProducts(params = {}) {
        const query = new URLSearchParams();
        if (params.seller_id) query.set('seller_id', String(params.seller_id));
        if (params.status) query.set('status', String(params.status));
        if (params.include_all_status) query.set('include_all_status', 'true');
        const suffix = query.toString() ? `?${query.toString()}` : '';
        const payload = await fetchJson(CLIENTES_API_URL, `/productos${suffix}`);
        const list = Array.isArray(payload?.products) ? payload.products : [];
        const normalized = list.map((product) => normalizeRemoteProduct(mercado, product));
        cache.productsById = new Map(normalized.map((item) => [String(item.id), item]));
        return normalized;
    }

    function requireAuthenticatedUser() {
        const user = mercado.AppState?.user || null;
        const token = normalizeText(mercado.AppState?.token, '');
        if (!user || !user.id || !token) {
            throw new Error('Inicia sesión para continuar');
        }
        return user;
    }

    function currentOwnerId() {
        const user = requireAuthenticatedUser();
        return normalizeText(user.id, '');
    }

    async function buildRemoteProductPayload(raw = {}, existingProduct = null) {
        const sellerId = normalizeText(raw.seller_id, mercado.AppState?.user?.id || existingProduct?.seller_id || 'vendedor-1');
        const sellerName = normalizeText(raw.seller_name, mercado.AppState?.user?.name || existingProduct?.seller_name || 'Vendedor local');
        const categoryId = normalizeText(raw.category_id, existingProduct?.category_id || 'catalogo');
        const categoryLabel = normalizeText(raw.category_label, existingProduct?.category?.name || categoryId.replace(/-/g, ' ').replace(/\b\w/g, (m) => m.toUpperCase()));
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

    mercado.initAuth = async () => {
        const token = normalizeText(mercado.AppState?.token, '');
        if (!token) {
            mercado.AppState.user = null;
            mercado.AppState.token = null;
            return;
        }
        try {
            const payload = await fetchJson(CLIENTES_API_URL, '/auth/me');
            const user = normalizeRemoteUser(payload?.user || {});
            mercado.AppState.user = user;
            mercado.AppState.token = token;
        } catch {
            mercado.AppState.user = null;
            mercado.AppState.token = null;
        }
    };

    mercado.AuthAPI.login = async (email, password) => {
        const payload = await fetchJson(CLIENTES_API_URL, '/auth/login', {
            method: 'POST',
            body: JSON.stringify({ email: normalizeAuthEmail(email), password: String(password || '') }),
        });
        const user = normalizeRemoteUser(payload?.user || {});
        const token = normalizeText(payload?.access_token, '');
        if (!token) throw new Error('Login sin token JWT');
        return { user, token };
    };

    mercado.AuthAPI.getMe = async () => {
        const token = normalizeText(mercado.AppState?.token, '');
        if (!token) throw new Error('Sesion remota no encontrada');
        const payload = await fetchJson(CLIENTES_API_URL, '/auth/me');
        return { user: normalizeRemoteUser(payload?.user || {}) };
    };

    mercado.AuthAPI.register = async (email, password, name, role, extra = {}) => {
        const payload = await fetchJson(CLIENTES_API_URL, '/auth/register', {
            method: 'POST',
            body: JSON.stringify({
                email: normalizeAuthEmail(email),
                password: String(password || ''),
                name: normalizeText(name, ''),
                role: normalizeRemoteRole(role),
                phone: normalizeText(extra.phone, ''),
                location: normalizeText(extra.location, ''),
                curp: normalizeText(extra.curp, ''),
            }),
        });
        const user = normalizeRemoteUser(payload?.user || {});
        const token = normalizeText(payload?.access_token, '');
        if (!token) throw new Error('Registro sin token JWT');
        return { user, token };
    };

    mercado.ProductsAPI.getAll = async (params = {}) => {
        let list = await fetchRemoteProducts(params);
        const statusFilter = normalizeText(params.status, '').toLowerCase();
        if (statusFilter) {
            list = list.filter((item) => String(item.status || '').toLowerCase() === statusFilter);
        } else if (!params.include_all_status) {
            list = list.filter((item) => String(item.status || '').toLowerCase() === 'approved');
        }
        const search = normalizeText(params.search, '').toLowerCase();
        if (search) {
            list = list.filter((item) =>
                normalizeText(item.name, '').toLowerCase().includes(search)
                || normalizeText(item.description, '').toLowerCase().includes(search)
                || normalizeText(item.category?.name, '').toLowerCase().includes(search)
            );
        }
        if (params.seller_id) list = list.filter((item) => item.seller_id === params.seller_id);
        if (params.category_id) list = list.filter((item) => item.category_id === params.category_id);
        if (params.is_featured) list = list.filter((item) => item.is_featured);
        if (params.is_local_handmade) list = list.filter((item) => item.is_local_handmade);
        
        if (params.sort_by === 'price') {
            list.sort((a, b) => Number(a.price || 0) - Number(b.price || 0));
        } else if (params.sort_by === 'views') {
            list.sort((a, b) => Number(b.views || 0) - Number(a.views || 0));
        } else {
            list.sort((a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime());
        }

        return { products: list, total: list.length };
    };

    mercado.ProductsAPI.getById = async (id) => {
        const payload = await fetchJson(CLIENTES_API_URL, `/productos/${encodeURIComponent(id)}`);
        const normalized = normalizeRemoteProduct(mercado, payload?.product || {});
        cache.productsById.set(String(normalized.id), normalized);
        return normalized;
    };

    mercado.ProductsAPI.create = async (data) => {
        const payload = await buildRemoteProductPayload(data || {});
        const response = await fetchJson(CLIENTES_API_URL, '/productos', { method: 'POST', body: JSON.stringify(payload) });
        return normalizeRemoteProduct(mercado, response?.product || {});
    };

    mercado.ProductsAPI.update = async (id, data) => {
        const existing = cache.productsById.get(String(id)) || await mercado.ProductsAPI.getById(id);
        const payload = await buildRemoteProductPayload(data || {}, existing);
        const response = await fetchJson(CLIENTES_API_URL, `/productos/${encodeURIComponent(id)}`, { method: 'PUT', body: JSON.stringify(payload) });
        return normalizeRemoteProduct(mercado, response?.product || {});
    };

    mercado.ProductsAPI.delete = async (id) => {
        await fetchJson(CLIENTES_API_URL, `/productos/${encodeURIComponent(id)}`, { method: 'DELETE' });
        cache.productsById.delete(String(id));
        return { ok: true };
    };

    mercado.ProductsAPI.getFeatured = async () => {
        const result = await mercado.ProductsAPI.getAll({ is_featured: true });
        return result?.products || [];
    };

    mercado.ProductsAPI.getSellerProducts = async () => {
        const sellerId = normalizeText(mercado.AppState?.user?.id, '');
        const result = await mercado.ProductsAPI.getAll({ seller_id: sellerId || undefined, include_all_status: true });
        return result?.products || [];
    };

    mercado.CategoriesAPI.getAll = async () => {
        const payload = await fetchJson(CLIENTES_API_URL, '/categorias');
        const categories = Array.isArray(payload?.categories) ? payload.categories : [];
        const isAdmin = mercado.AppState?.user?.role === 'admin';
        return categories
            .filter((item) => isAdmin || item.status === 'approved')
            .map((item) => ({
                id: item.id,
                name: item.name,
                description: item.description || '',
                metafora: item.metafora || '',
                status: item.status || 'approved',
            }));
    };

    mercado.CategoriesAPI.create = async (data) => {
        const payload = await fetchJson(CLIENTES_API_URL, '/categorias', {
            method: 'POST',
            body: JSON.stringify({
                name: normalizeText(data?.name, 'Categoria'),
                description: normalizeText(data?.description, ''),
                metafora: normalizeText(data?.metafora, ''),
            }),
        });
        return payload?.category || null;
    };

    mercado.SellersAPI.getAll = async () => {
        const payload = await fetchJson(CLIENTES_API_URL, '/usuarios-app?role=seller');
        const list = Array.isArray(payload?.users) ? payload.users : [];
        return list.map((item) => normalizeRemoteUser(item));
    };

    mercado.SellersAPI.getById = async (id) => {
        const payload = await fetchJson(CLIENTES_API_URL, `/usuarios-app/${encodeURIComponent(id)}`);
        const user = normalizeRemoteUser(payload?.user || {});
        try {
            const profilePayload = await fetchJson(CLIENTES_API_URL, `/seller/profile?seller_id=${encodeURIComponent(id)}`);
            const profile = profilePayload?.profile || {};
            user.seller_profile = {
                business_name: normalizeText(profile.business_name, user.name),
                description: normalizeText(profile.description, ''),
                schedule: normalizeText(profile.schedule, ''),
                location: normalizeText(profile.location, user.address || 'Chiapas, Mexico'),
                phone: normalizeText(profile.phone, user.phone || ''),
                curp: normalizeText(profile.curp, ''),
            };
            user.status = normalizeText(profile.status, user.status || 'verified');
            user.average_rating = toSafeNumber(profile.average_rating, 0);
            user.total_products = toSafeNumber(profile.total_products, 0);
            user.total_reviews = toSafeNumber(profile.total_reviews, 0);
        } catch {
            // profile endpoint opcional
        }
        return user;
    };

    mercado.SellersAPI.updateProfile = async (data) => {
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
    };

    mercado.SellersAPI.getMetrics = async () => {
        const sellerId = normalizeText(mercado.AppState?.user?.id, '');
        const [metricsPayload, productResult, sellerOrders] = await Promise.all([
            fetchJson(CLIENTES_API_URL, `/seller/metrics?seller_id=${encodeURIComponent(sellerId)}`),
            mercado.ProductsAPI.getAll({ seller_id: sellerId }),
            mercado.OrdersAPI.getSellerOrders(),
        ]);
        const baseMetrics = metricsPayload?.metrics || {};
        const products = productResult?.products || [];
        const orders = Array.isArray(sellerOrders) ? sellerOrders : [];
        return {
            total_products: toSafeNumber(baseMetrics.total_products, products.length),
            total_orders: toSafeNumber(baseMetrics.total_orders, orders.length),
            total_sales: toSafeNumber(baseMetrics.total_sales, orders.reduce((sum, order) => sum + toSafeNumber(order.total, 0), 0)),
            average_rating: toSafeNumber(baseMetrics.average_rating, 0),
            total_reviews: toSafeNumber(baseMetrics.total_reviews, 0),
            low_stock_products: products.filter((product) => toSafeNumber(product.stock, 0) <= 10).length,
            active_cart_count: 0,
            total_views: products.reduce((sum, product) => sum + toSafeNumber(product.views, 0), 0),
            total_favorites: products.reduce((sum, product) => sum + toSafeNumber(product.favorites_count, 0), 0),
        };
    };

    mercado.CartAPI.getCurrent = async () => {
        const ownerId = currentOwnerId();
        const payload = await fetchJson(CLIENTES_API_URL, `/cart?owner_id=${encodeURIComponent(ownerId)}`);
        return payload || { items: [] };
    };
    mercado.CartAPI.addItem = async (productId, quantity = 1) => {
        const ownerId = currentOwnerId();
        await fetchJson(CLIENTES_API_URL, `/cart/items?owner_id=${encodeURIComponent(ownerId)}&product_id=${encodeURIComponent(productId)}&quantity=${encodeURIComponent(Number(quantity || 1))}`, { method: 'POST' });
        return mercado.CartAPI.getCurrent();
    };
    mercado.CartAPI.updateItem = async (productId, quantity) => {
        const ownerId = currentOwnerId();
        await fetchJson(CLIENTES_API_URL, `/cart/items/${encodeURIComponent(productId)}?owner_id=${encodeURIComponent(ownerId)}&quantity=${encodeURIComponent(Number(quantity || 0))}`, { method: 'PUT' });
        return mercado.CartAPI.getCurrent();
    };
    mercado.CartAPI.removeItem = async (productId) => {
        const ownerId = currentOwnerId();
        await fetchJson(CLIENTES_API_URL, `/cart/items/${encodeURIComponent(productId)}?owner_id=${encodeURIComponent(ownerId)}`, { method: 'DELETE' });
        return mercado.CartAPI.getCurrent();
    };
    mercado.CartAPI.clear = async () => {
        const ownerId = currentOwnerId();
        await fetchJson(CLIENTES_API_URL, `/cart?owner_id=${encodeURIComponent(ownerId)}`, { method: 'DELETE' });
        return { items: [] };
    };
    mercado.CartAPI.getSellerActive = async () => {
        const user = requireAuthenticatedUser();
        const sellerId = normalizeText(user.id, '');
        const payload = await fetchJson(CLIENTES_API_URL, `/seller/carts/active?seller_id=${encodeURIComponent(sellerId)}`);
        return payload?.carts || [];
    };

    async function hydrateCartItems(cartItems = []) {
        const detailedItems = [];
        for (const item of cartItems) {
            const product = await mercado.ProductsAPI.getById(item.product_id);
            if (!product) continue;
            const quantity = Math.max(1, Number(item.quantity || 1));
            detailedItems.push({ ...item, product, quantity, subtotal: Number(product.price || 0) * quantity });
        }
        return detailedItems;
    }

    mercado.getCartDetailedItems = async () => {
        const cartResponse = await mercado.CartAPI.getCurrent();
        const cartItems = Array.isArray(cartResponse?.items) ? cartResponse.items : [];
        mercado.AppState.cart = cartItems.map((item) => ({ product_id: item.product_id, quantity: item.quantity }));
        return hydrateCartItems(cartItems);
    };
    mercado.addProductToCart = async (productId, quantity = 1) => {
        const product = await mercado.ProductsAPI.getById(productId);
        if (!product) throw new Error('Producto no encontrado');
        await mercado.CartAPI.addItem(productId, quantity);
        const current = await mercado.CartAPI.getCurrent();
        mercado.AppState.cart = Array.isArray(current?.items) ? current.items : [];
        return true;
    };
    mercado.updateCartItemQuantity = async (productId, quantity) => {
        await mercado.CartAPI.updateItem(productId, quantity);
        const current = await mercado.CartAPI.getCurrent();
        mercado.AppState.cart = Array.isArray(current?.items) ? current.items : [];
    };
    mercado.removeFromCart = async (productId) => {
        await mercado.CartAPI.removeItem(productId);
        const current = await mercado.CartAPI.getCurrent();
        mercado.AppState.cart = Array.isArray(current?.items) ? current.items : [];
    };
    mercado.clearCart = async () => {
        await mercado.CartAPI.clear();
        mercado.AppState.cart = [];
    };

    mercado.FavoritesAPI.getAll = async () => {
        const user = requireAuthenticatedUser();
        const userId = normalizeText(user.id, '');
        const payload = await fetchJson(CLIENTES_API_URL, `/favorites?user_id=${encodeURIComponent(userId)}`);
        const favoriteIds = Array.isArray(payload?.favorites) ? payload.favorites : [];
        mercado.AppState.favorites = [...favoriteIds];
        const products = await mercado.ProductsAPI.getAll();
        return products.products.filter((product) => favoriteIds.includes(product.id));
    };
    mercado.FavoritesAPI.add = async (productId) => {
        const user = requireAuthenticatedUser();
        const userId = normalizeText(user.id, '');
        await fetchJson(CLIENTES_API_URL, `/favorites/${encodeURIComponent(productId)}?user_id=${encodeURIComponent(userId)}`, { method: 'POST' });
        return { ok: true };
    };
    mercado.FavoritesAPI.remove = async (productId) => {
        const user = requireAuthenticatedUser();
        const userId = normalizeText(user.id, '');
        await fetchJson(CLIENTES_API_URL, `/favorites/${encodeURIComponent(productId)}?user_id=${encodeURIComponent(userId)}`, { method: 'DELETE' });
        return { ok: true };
    };

    mercado.ReviewsAPI.create = async (data) => {
        const user = requireAuthenticatedUser();
        const userId = normalizeText(user.id, '');
        return fetchJson(CLIENTES_API_URL, '/reviews', {
            method: 'POST',
            body: JSON.stringify({
                user_id: userId,
                product_id: data?.product_id,
                rating: Number(data?.rating || 0),
                comment: normalizeText(data?.comment, ''),
            }),
        });
    };

    mercado.ReportsAPI.create = async (data) => {
        const user = requireAuthenticatedUser();
        const userId = normalizeText(user.id, '');
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
    };
    mercado.ReportsAPI.getAll = async (statusFilter = '') => {
        const endpoint = statusFilter ? `/reports?status=${encodeURIComponent(statusFilter)}` : '/reports';
        const payload = await fetchJson(CLIENTES_API_URL, endpoint);
        return payload?.reports || [];
    };
    mercado.ReportsAPI.getMy = async () => {
        const user = requireAuthenticatedUser();
        const userId = normalizeText(user.id, '');
        const payload = await fetchJson(CLIENTES_API_URL, `/reports/my?user_id=${encodeURIComponent(userId)}`);
        return payload?.reports || [];
    };

    async function fetchRemoteOrders(params = {}) {
        const query = new URLSearchParams();
        if (params.customer_id) query.set('customer_id', params.customer_id);
        if (params.courier_id) query.set('courier_id', params.courier_id);
        if (params.seller_id) query.set('seller_id', params.seller_id);
        const suffix = query.toString() ? `?${query.toString()}` : '';
        const payload = await fetchJson(PEDIDOS_API_URL, `/pedidos${suffix}`);
        const orders = Array.isArray(payload?.pedidos) ? payload.pedidos : [];
        return orders.map((item) => toLegacyOrder(mercado, item, cache.productsById));
    }

    mercado.OrdersAPI.create = async (data) => {
        const currentUser = requireAuthenticatedUser();
        const sourceItems = Array.isArray(data?.items) ? data.items : [];
        const items = await Promise.all(sourceItems.map(async (item) => {
            let known = cache.productsById.get(String(item.product_id)) || null;
            if (!known && item.product_id) {
                try { known = await mercado.ProductsAPI.getById(item.product_id); } catch { known = null; }
            }
            return {
                productId: normalizeText(item.product_id, known?.id || ''),
                quantity: Math.max(1, toSafeNumber(item.quantity, 1)),
                productName: normalizeText(item.name, known?.name || 'Producto'),
                sellerId: normalizeText(item.seller_id, known?.seller_id || 'vendedor-1'),
                sellerName: normalizeText(item.seller_name, known?.seller_name || 'Vendedor local'),
                categoryLabel: normalizeText(item.category_label, known?.category?.name || 'Catalogo'),
                price: toSafeNumber(item.price, known?.price || 0),
                subtotal: Math.max(0, toSafeNumber(item.price, known?.price || 0) * Math.max(1, toSafeNumber(item.quantity, 1))),
            };
        }));
        const payload = await fetchJson(PEDIDOS_API_URL, '/pedidos', {
            method: 'POST',
            body: JSON.stringify({
                customerId: normalizeText(data?.customer_id, currentUser.id || ''),
                customerName: normalizeText(data?.customer?.name, currentUser.name || 'Cliente'),
                customerPhone: normalizeText(data?.customer?.phone, ''),
                deliveryMethod: normalizeText(data?.delivery_method, 'delivery'),
                pickupStoreId: normalizeText(data?.pickup_point?.id, ''),
                pickupStoreName: normalizeText(data?.pickup_point?.name, ''),
                pickupStoreLat: data?.pickup_point?.lat ?? null,
                pickupStoreLng: data?.pickup_point?.lng ?? null,
                address: normalizeText(data?.customer?.address || data?.pickup_point?.location, ''),
                addressLabel: normalizeText(data?.address_label || data?.customer?.address || data?.pickup_point?.location, ''),
                addressLat: data?.delivery_location?.lat ?? null,
                addressLng: data?.delivery_location?.lng ?? null,
                addressColony: normalizeText(data?.address_colony, ''),
                addressSubdivision: normalizeText(data?.address_subdivision, ''),
                note: normalizeText(data?.note, ''),
                items,
                total: Math.max(1, toSafeNumber(data?.total, items.reduce((sum, item) => sum + item.subtotal, 0))),
            }),
        });
        return toLegacyOrder(mercado, payload?.pedido || {}, cache.productsById);
    };
    mercado.OrdersAPI.getById = async (id) => {
        const payload = await fetchJson(PEDIDOS_API_URL, `/pedidos/${encodeURIComponent(id)}`);
        return toLegacyOrder(mercado, payload?.pedido || {}, cache.productsById);
    };
    mercado.OrdersAPI.getMy = async () => {
        const user = requireAuthenticatedUser();
        const role = normalizeText(user?.role, '');
        const userId = normalizeText(user?.id, '');
        if (role === 'courier') return fetchRemoteOrders({ courier_id: userId });
        if (role === 'seller') return fetchRemoteOrders({ seller_id: userId });
        return fetchRemoteOrders({ customer_id: userId });
    };
    mercado.OrdersAPI.getAssigned = async () => fetchRemoteOrders();
    mercado.OrdersAPI.getPickupPending = async () => {
        const sellerId = normalizeText(mercado.AppState?.user?.id, '');
        const orders = await fetchRemoteOrders({ seller_id: sellerId });
        return orders.filter((order) => order.delivery_method === 'pickup' && order.pickup_status === 'pendiente_recoleccion');
    };
    mercado.OrdersAPI.getSellerOrders = async () => {
        const sellerId = normalizeText(mercado.AppState?.user?.id, '');
        return fetchRemoteOrders({ seller_id: sellerId });
    };
    mercado.OrdersAPI.updateStatus = async (id, status) => {
        const existing = await mercado.OrdersAPI.getById(id);
        const currentUser = mercado.AppState?.user || {};
        const payload = await fetchJson(PEDIDOS_API_URL, `/pedidos/${encodeURIComponent(id)}/estado`, {
            method: 'PUT',
            body: JSON.stringify({
                status: mapLegacyStatusToRemote(status),
                courierId: normalizeText(existing?.courier_id, currentUser.role === 'courier' ? currentUser.id : ''),
                courierName: normalizeText(existing?.courier_name, currentUser.role === 'courier' ? currentUser.name : ''),
                courierLat: existing?.location?.lat ?? null,
                courierLng: existing?.location?.lng ?? null,
            }),
        });
        return toLegacyOrder(mercado, payload?.pedido || {}, cache.productsById);
    };
    mercado.OrdersAPI.assign = async (id, courierId = '') => {
        const existing = await mercado.OrdersAPI.getById(id);
        const currentUser = mercado.AppState?.user || {};
        const normalizedCourierId = normalizeText(courierId, currentUser.id || '');
        const normalizedCourierName = normalizeText(currentUser.name, existing?.courier_name || '');
        const payload = await fetchJson(PEDIDOS_API_URL, `/pedidos/${encodeURIComponent(id)}/estado`, {
            method: 'PUT',
            body: JSON.stringify({
                status: 'asignado',
                courierId: normalizedCourierId,
                courierName: normalizedCourierName,
                courierLat: existing?.location?.lat ?? null,
                courierLng: existing?.location?.lng ?? null,
            }),
        });
        return toLegacyOrder(mercado, payload?.pedido || {}, cache.productsById);
    };
    mercado.OrdersAPI.updateLocation = async (id, lat, lng) => {
        const existing = await mercado.OrdersAPI.getById(id);
        const currentUser = mercado.AppState?.user || {};
        const payload = await fetchJson(PEDIDOS_API_URL, `/pedidos/${encodeURIComponent(id)}/estado`, {
            method: 'PUT',
            body: JSON.stringify({
                status: mapLegacyStatusToRemote(existing?.status || 'en_transito'),
                courierId: normalizeText(existing?.courier_id, currentUser.id || ''),
                courierName: normalizeText(existing?.courier_name, currentUser.name || ''),
                courierLat: Number(lat),
                courierLng: Number(lng),
                locationAt: new Date().toISOString(),
            }),
        });
        return toLegacyOrder(mercado, payload?.pedido || {}, cache.productsById);
    };
    mercado.OrdersAPI.markPickupCollected = async (id) => mercado.OrdersAPI.updateStatus(id, 'entregado');
    mercado.OrdersAPI.markPickupNoShow = async (id) => mercado.OrdersAPI.updateStatus(id, 'cancelado_no_show');

    mercado.AdminAPI.getUsers = async (role = '') => {
        requireAuthenticatedUser();
        const query = role ? `?role=${encodeURIComponent(role)}` : '';
        const payload = await fetchJson(CLIENTES_API_URL, `/admin/users${query}`);
        const list = Array.isArray(payload?.users) ? payload.users : [];
        return list.map((item) => normalizeRemoteUser(item));
    };
    mercado.AdminAPI.getStats = async () => {
        requireAuthenticatedUser();
        const [products, orders, users] = await Promise.all([
            mercado.ProductsAPI.getAll({ include_all_status: true }),
            fetchRemoteOrders(),
            fetchJson(CLIENTES_API_URL, '/admin/users'),
        ]);
        const userList = Array.isArray(users?.users) ? users.users : [];
        return {
            users_total: userList.length,
            products_total: (products?.products || []).length,
            orders_total: orders.length,
            reports_pending: 0,
            sellers_pending: 0,
        };
    };
    mercado.AdminAPI.updateProductStatus = async (id, statusValue) => fetchJson(CLIENTES_API_URL, `/admin/products/${encodeURIComponent(id)}/status?status=${encodeURIComponent(statusValue)}`, { method: 'PUT' });
    mercado.AdminAPI.deleteProduct = async (id) => fetchJson(CLIENTES_API_URL, `/admin/products/${encodeURIComponent(id)}`, { method: 'DELETE' });
    mercado.AdminAPI.verifyLocalHandmade = async (id, verified) => fetchJson(CLIENTES_API_URL, `/admin/products/${encodeURIComponent(id)}/verify-local?verified=${encodeURIComponent(Boolean(verified))}`, { method: 'PUT' });
    mercado.AdminAPI.featureProduct = async (id, days) => fetchJson(CLIENTES_API_URL, `/admin/products/${encodeURIComponent(id)}/feature?days=${encodeURIComponent(Number(days || 7))}`, { method: 'PUT' });
    mercado.AdminAPI.unfeatureProduct = async (id) => fetchJson(CLIENTES_API_URL, `/admin/products/${encodeURIComponent(id)}/feature?featured=false`, { method: 'PUT' });
    mercado.AdminAPI.updateSellerStatus = async (id, statusValue) => fetchJson(CLIENTES_API_URL, `/admin/sellers/${encodeURIComponent(id)}/status?status=${encodeURIComponent(statusValue)}`, { method: 'PUT' });
    mercado.AdminAPI.updateUserStatus = async (id, statusValue) => fetchJson(CLIENTES_API_URL, `/admin/users/${encodeURIComponent(id)}/status?status=${encodeURIComponent(statusValue)}`, { method: 'PUT' });
    mercado.AdminAPI.deleteUser = async (id) => fetchJson(CLIENTES_API_URL, `/admin/users/${encodeURIComponent(id)}`, { method: 'DELETE' });
    mercado.AdminAPI.updateReport = async (id, statusValue, notes) => fetchJson(CLIENTES_API_URL, `/reports/${encodeURIComponent(id)}?status=${encodeURIComponent(statusValue)}&admin_notes=${encodeURIComponent(notes || '')}`, { method: 'PUT' });
    mercado.AdminAPI.deleteReview = async (reviewId) => {
        const safeId = normalizeText(reviewId, '');
        if (!safeId) throw new Error('ID de reseña invalido');
        return fetchJson(CLIENTES_API_URL, `/reviews/${encodeURIComponent(safeId)}`, { method: 'DELETE' });
    };
    mercado.AdminAPI.getReviewContext = async (reviewId) => {
        const safeId = normalizeText(reviewId, '');
        if (!safeId) throw new Error('ID de reseña invalido');
        const payload = await fetchJson(CLIENTES_API_URL, `/reviews/${encodeURIComponent(safeId)}/context`);
        return payload?.context || null;
    };

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
            return fetchJson(CLIENTES_API_URL, `/subscription?user_id=${encodeURIComponent(userId)}&plan=${encodeURIComponent(body?.plan || 'free')}`, { method: 'POST' });
        }
        if (path.startsWith('/reports/')) {
            return fetchJson(CLIENTES_API_URL, path, options);
        }
        throw new Error(`Ruta no soportada en modo remoto estricto: ${path}`);
    };

    return mercado;
}

export function getMercadoLocal() {
    if (!singleton) {
        singleton = createMercadoLocal();
    }
    return singleton;
}

export async function ensureLegacySession() {
    const mercado = getMercadoLocal();
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



