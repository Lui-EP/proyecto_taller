import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSession } from '../context/SessionContext';
import { getMercadoLocal } from '../lib/mercadoLocal';
import PageLoader from '../components/PageLoader';
import { resolveImageSrc } from '../lib/assets';
import SafeImage from '../components/SafeImage';

const EMPTY_PRODUCT_FORM = {
    id: '',
    name: '',
    description: '',
    category_id: '',
    price: '',
    stock: '',
    is_local_handmade: false,
};

function statusBadge(status) {
    const safe = String(status || '').toLowerCase();
    if (safe === 'approved') return <span className="badge badge-sage">Aprobado</span>;
    if (safe === 'pending') return <span className="badge badge-warning">Pendiente</span>;
    if (safe === 'paused') return <span className="badge badge-info">Pausado</span>;
    if (safe === 'rejected') return <span className="badge badge-error">Rechazado</span>;
    return <span className="badge">Desconocido</span>;
}

function stockBadge(stock) {
    const qty = Math.max(0, Number(stock || 0));
    if (qty <= 0) return <span className="badge badge-error">No disponible</span>;
    if (qty <= 10) return <span className="badge badge-warning">Stock bajo: {qty}</span>;
    return <span className="badge badge-info">Stock: {qty}</span>;
}

function orderStatusBadge(status) {
    const safe = String(status || '').toLowerCase();
    if (safe === 'pedido_realizado') return <span className="badge badge-warning">Pedido realizado</span>;
    if (safe === 'en_transito') return <span className="badge badge-info">En transito</span>;
    if (safe === 'entregado') return <span className="badge badge-sage">Entregado</span>;
    if (safe === 'cancelado_no_show') return <span className="badge badge-error">No recogido</span>;
    return <span className="badge">Sin estado</span>;
}

function orderMethodBadge(method) {
    return String(method || '').toLowerCase() === 'pickup'
        ? <span className="badge badge-terracotta">Recoger en tienda</span>
        : <span className="badge badge-info">Entrega a domicilio</span>;
}

export default function SellerDashboardPage() {
    const session = useSession();
    const navigate = useNavigate();
    const mercado = getMercadoLocal();

    const fileInputRef = useRef(null);
    const pendingPickupToastRef = useRef('');

    const [loading, setLoading] = useState(true);
    const [metrics, setMetrics] = useState(null);
    const [products, setProducts] = useState([]);
    const [categories, setCategories] = useState([]);
    const [activeCarts, setActiveCarts] = useState([]);
    const [sellerOrders, setSellerOrders] = useState([]);
    const [pickupPendingOrders, setPickupPendingOrders] = useState([]);

    const [productModalOpen, setProductModalOpen] = useState(false);
    const [profileModalOpen, setProfileModalOpen] = useState(false);

    const [productForm, setProductForm] = useState(EMPTY_PRODUCT_FORM);
    const [profileForm, setProfileForm] = useState({
        business_name: '',
        description: '',
        schedule: '',
        location: '',
    });

    const [currentProductImages, setCurrentProductImages] = useState([]);
    const [selectedImageFiles, setSelectedImageFiles] = useState([]);

    const canAccess = useMemo(
        () => ['seller', 'admin'].includes(session.user?.role || ''),
        [session.user?.role]
    );

    const plan = session.user?.subscription?.plan || 'free';
    const isPremium = plan === 'premium';

    const welcomeName =
        session.user?.seller_profile?.business_name ||
        session.user?.name ||
        'Vendedor';

    const loadData = useCallback(async () => {
        try {
            const [metricsResp, productsResp, categoriesResp, activeCartsResp, sellerOrdersResp, pickupPendingResp] = await Promise.all([
                mercado.SellersAPI.getMetrics(),
                mercado.ProductsAPI.getSellerProducts(),
                mercado.CategoriesAPI.getAll(),
                mercado.CartAPI.getSellerActive(),
                mercado.OrdersAPI.getSellerOrders(),
                mercado.OrdersAPI.getPickupPending(),
            ]);

            setMetrics(metricsResp || null);
            setProducts(productsResp || []);
            setCategories(categoriesResp || []);
            setActiveCarts(Array.isArray(activeCartsResp) ? activeCartsResp : []);
            setSellerOrders(Array.isArray(sellerOrdersResp) ? sellerOrdersResp : []);
            setPickupPendingOrders(Array.isArray(pickupPendingResp) ? pickupPendingResp : []);

            const profile = session.user?.seller_profile || {};
            setProfileForm({
                business_name: profile.business_name || '',
                description: profile.description || '',
                schedule: profile.schedule || '',
                location: profile.location || '',
            });

            const lowStockCount = (productsResp || []).filter((item) => {
                const qty = Number(item.stock || 0);
                return qty > 0 && qty <= 10;
            }).length;

            if (lowStockCount > 0) {
                mercado.showToast(`Aviso: ${lowStockCount} producto(s) ya se estan agotando`, 'warning');
            }

            const pendingCount = Array.isArray(pickupPendingResp) ? pickupPendingResp.length : 0;
            const pendingToastKey = `${session.user?.id || 'seller'}-${pendingCount}`;
            if (pendingCount > 0 && pendingPickupToastRef.current !== pendingToastKey) {
                mercado.showToast(`Tienes ${pendingCount} compra(s) pendientes para recoger en tienda`, 'warning');
                pendingPickupToastRef.current = pendingToastKey;
            }
            if (pendingCount === 0) {
                pendingPickupToastRef.current = '';
            }
        } catch {
            mercado.showToast('No se pudo cargar panel de vendedor', 'error');
        } finally {
            setLoading(false);
        }
    }, [mercado, session.user?.id, session.user?.seller_profile]);

    useEffect(() => {
        if (!session.ready) return;
        if (!session.token) {
            navigate('/login', { replace: true });
            return;
        }

        if (!canAccess) {
            mercado.showToast('Acceso denegado. Solo para vendedores.', 'error');
            navigate('/', { replace: true });
            return;
        }

        setLoading(true);
        loadData();
    }, [session.ready, session.token, canAccess, mercado, navigate, loadData]);

    const closeProductModal = () => {
        setProductModalOpen(false);
    };

    const closeProfileModal = () => {
        setProfileModalOpen(false);
    };

    const openProductModal = (product = null) => {
        if (product) {
            setProductForm({
                id: product.id,
                name: product.name || '',
                description: product.description || '',
                category_id: product.category_id || '',
                price: String(product.price || ''),
                stock: product.stock !== undefined ? String(product.stock) : '',
                is_local_handmade: !!product.is_local_handmade,
            });
            setCurrentProductImages([...(product.images || [])]);
        } else {
            setProductForm(EMPTY_PRODUCT_FORM);
            setCurrentProductImages([]);
        }

        setSelectedImageFiles([]);
        if (fileInputRef.current) {
            fileInputRef.current.value = '';
        }

        setProductModalOpen(true);
    };

    const openProfileModal = () => {
        const profile = session.user?.seller_profile || {};
        setProfileForm({
            business_name: profile.business_name || '',
            description: profile.description || '',
            schedule: profile.schedule || '',
            location: profile.location || '',
        });
        setProfileModalOpen(true);
    };

    const onFilesChange = (event) => {
        const files = Array.from(event.target.files || []);
        setSelectedImageFiles(files);
    };

    const fileToDataUrl = (file) =>
        new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(String(reader.result || ''));
            reader.onerror = () => reject(new Error('No se pudo leer la imagen seleccionada'));
            reader.readAsDataURL(file);
        });

    const uploadSelectedImages = async () => {
        if (!selectedImageFiles.length) return [];
        return Promise.all(selectedImageFiles.map((file) => fileToDataUrl(file)));
    };

    const saveProduct = async (event) => {
        event.preventDefault();

        if (!productForm.name.trim() || !productForm.description.trim() || !productForm.category_id || !productForm.price) {
            mercado.showToast('Completa nombre, descripcion, categoria y precio', 'error');
            return;
        }

        try {
            const uploadedImages = await uploadSelectedImages();
            const images = productForm.id
                ? [...currentProductImages, ...uploadedImages]
                : uploadedImages;

            const payload = {
                name: productForm.name.trim(),
                description: productForm.description.trim(),
                price: Number(productForm.price || 0),
                stock: Number(productForm.stock || 0),
                category_id: productForm.category_id,
                images,
                is_local_handmade: !!productForm.is_local_handmade,
            };

            if (productForm.id) {
                await mercado.ProductsAPI.update(productForm.id, payload);
                mercado.showToast('Producto actualizado');
            } else {
                await mercado.ProductsAPI.create(payload);
                mercado.showToast('Producto creado. Pendiente de aprobacion.');
            }

            closeProductModal();
            setProductForm(EMPTY_PRODUCT_FORM);
            setCurrentProductImages([]);
            setSelectedImageFiles([]);
            await loadData();
        } catch (error) {
            mercado.showToast(error.message || 'Error al guardar producto', 'error');
        }
    };

    const deleteProduct = async (productId) => {
        const accepted = window.confirm('Eliminar este producto?');
        if (!accepted) return;

        try {
            await mercado.ProductsAPI.delete(productId);
            mercado.showToast('Producto eliminado');
            await loadData();
        } catch {
            mercado.showToast('Error al eliminar producto', 'error');
        }
    };

    const featureProduct = async (productId) => {
        const days = window.prompt('Por cuantos dias quieres destacar el producto?', '7');
        if (!days) return;

        try {
            await mercado.ReportsAPI.create({
                target_type: 'product',
                target_id: productId,
                reason: 'feature_request',
                description: `Solicitud para destacar producto por ${days} dias`
            });
            mercado.showToast('Solicitud enviada al administrador');
        } catch (error) {
            mercado.showToast(error.message || 'Error al enviar solicitud', 'error');
        }
    };

    const saveProfile = async (event) => {
        event.preventDefault();
        try {
            await mercado.SellersAPI.updateProfile(profileForm);
            mercado.AppState.user = {
                ...(mercado.AppState.user || {}),
                seller_profile: { ...(profileForm || {}) },
            };
            session.syncState?.();
            mercado.showToast('Perfil actualizado');
            closeProfileModal();
            await loadData();
        } catch {
            mercado.showToast('Error al actualizar perfil', 'error');
        }
    };

    const suggestCategory = async () => {
        const name = window.prompt('Escribe el nombre de la categoria que quieres sugerir:');
        if (!name) return;

        try {
            await mercado.CategoriesAPI.create({
                name: name.trim(),
                description: 'Sugerida por vendedor',
            });
            await loadData();
            window.alert('Solicitud de categoria enviada');
        } catch {
            mercado.showToast('No se pudo sugerir la categoria', 'error');
        }
    };

    const upgradePlan = async () => {
        const accepted = window.confirm('Deseas actualizar a Plan Premium? (Pago simulado - $99/mes)');
        if (!accepted) return;

        try {
            await mercado.apiRequest('/subscription', {
                method: 'POST',
                body: JSON.stringify({ plan: 'premium' }),
            });

            mercado.AppState.user = {
                ...(mercado.AppState.user || {}),
                subscription: { plan: 'premium' },
            };
            session.syncState?.();
            window.alert('Tu solicitud ha sido enviada por favor');
            await loadData();
        } catch {
            mercado.showToast('Error al actualizar plan', 'error');
        }
    };

    const openSubscriptionInfo = () => {
        if (isPremium) {
            mercado.showToast('Ya tienes el plan Premium activo');
            return;
        }
        upgradePlan();
    };

    const formatDateTime = (value) => {
        if (!value) return '--';
        try {
            return new Intl.DateTimeFormat('es-MX', {
                dateStyle: 'short',
                timeStyle: 'short',
            }).format(new Date(value));
        } catch {
            return value;
        }
    };

    const getOrderItemsForSeller = (order) => {
        const items = Array.isArray(order?.items) ? order.items : [];
        if (session.user?.role === 'admin') return items;
        const myId = String(session.user?.id || '');
        return items.filter((item) => String(item.seller_id || '') === myId);
    };

    const getSellerOrderTotal = (order) => getOrderItemsForSeller(order)
        .reduce((sum, item) => sum + (Number(item.price || 0) * Number(item.quantity || 0)), 0);

    const getSellerOrderUnits = (order) => getOrderItemsForSeller(order)
        .reduce((sum, item) => sum + Number(item.quantity || 0), 0);

    const getOrderLocationLabel = (order) => {
        if (String(order?.delivery_method || '').toLowerCase() === 'pickup') {
            return order?.pickup_point?.location || 'Ubicacion de tienda por confirmar';
        }
        return order?.customer?.address || 'Direccion pendiente';
    };

    const markPickupCollected = async (orderId) => {
        try {
            await mercado.OrdersAPI.markPickupCollected(orderId);
            mercado.showToast('Pedido marcado como recogido');
            await loadData();
        } catch (error) {
            mercado.showToast(error.message || 'No se pudo actualizar el pedido', 'error');
        }
    };

    const markPickupNoShow = async (orderId) => {
        const accepted = window.confirm('Confirmar: el cliente no vino por este pedido y se liberará el stock apartado.');
        if (!accepted) return;
        try {
            await mercado.OrdersAPI.markPickupNoShow(orderId);
            mercado.showToast('Se liberó el apartado y el stock volvió al inventario');
            await loadData();
        } catch (error) {
            mercado.showToast(error.message || 'No se pudo liberar el apartado', 'error');
        }
    };

    const selectedImagesText = useMemo(() => {
        if (selectedImageFiles.length) {
            const names = selectedImageFiles.map((file) => file.name).join(', ');
            return `Archivos seleccionados (${selectedImageFiles.length}): ${names}`;
        }

        if (currentProductImages.length) {
            return `Imagenes actuales: ${currentProductImages.length}`;
        }

        return '';
    }, [selectedImageFiles, currentProductImages]);

    if (loading) {
        return <PageLoader text="Cargando panel vendedor..." />;
    }

    return (
        <>
            <main className="vendedor-page">
                <div className="container">
                    <div className="dashboard-header">
                        <div>
                            <h1 className="dashboard-title">Panel de Vendedor</h1>
                            <p className="dashboard-subtitle">Bienvenido, {welcomeName}</p>
                        </div>
                        <button className="btn btn-primary" type="button" onClick={() => openProductModal(null)}>
                            <span>+</span> Nuevo Producto
                        </button>
                    </div>

                    <div className="metrics-grid" id="metrics-grid">
                        <div className="metric-card">
                            <div className="metric-card-content">
                                <div className="metric-icon">📦</div>
                                <div>
                                    <div className="metric-value">{metrics?.total_products || 0}</div>
                                    <div className="metric-label">Productos</div>
                                </div>
                            </div>
                        </div>
                        <div className="metric-card">
                            <div className="metric-card-content">
                                <div className="metric-icon">👁</div>
                                <div>
                                    <div className="metric-value">{metrics?.total_views || 0}</div>
                                    <div className="metric-label">Vistas</div>
                                </div>
                            </div>
                        </div>
                        <div className="metric-card">
                            <div className="metric-card-content">
                                <div className="metric-icon">❤</div>
                                <div>
                                    <div className="metric-value">{metrics?.total_favorites || 0}</div>
                                    <div className="metric-label">Favoritos</div>
                                </div>
                            </div>
                        </div>
                        <div className="metric-card">
                            <div className="metric-card-content">
                                <div className="metric-icon">★</div>
                                <div>
                                    <div className="metric-value">{metrics?.average_rating || '-'}</div>
                                    <div className="metric-label">Calificacion</div>
                                </div>
                            </div>
                        </div>
                        <div className="metric-card">
                            <div className="metric-card-content">
                                <div className="metric-icon">💬</div>
                                <div>
                                    <div className="metric-value">{metrics?.total_reviews || 0}</div>
                                    <div className="metric-label">Resenas</div>
                                </div>
                            </div>
                        </div>
                        <div className="metric-card">
                            <div className="metric-card-content">
                                <div className="metric-icon">🛒</div>
                                <div>
                                    <div className="metric-value">{activeCarts.length}</div>
                                    <div className="metric-label">Carritos activos</div>
                                </div>
                            </div>
                        </div>
                        <div className="metric-card">
                            <div className="metric-card-content">
                                <div className="metric-icon">📋</div>
                                <div>
                                    <div className="metric-value">{sellerOrders.length}</div>
                                    <div className="metric-label">Pedidos</div>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="quick-actions">
                        <div className="action-card" onClick={() => openProductModal(null)}>
                            <div className="action-icon terracotta">📦</div>
                            <h3 className="action-title">Agregar Producto</h3>
                            <p className="action-description">Publica un nuevo producto en el marketplace</p>
                        </div>
                        <div className="action-card" onClick={openProfileModal}>
                            <div className="action-icon sage">🏪</div>
                            <h3 className="action-title">Editar Perfil</h3>
                            <p className="action-description">Actualiza la informacion de tu negocio</p>
                        </div>
                        <div className="action-card" onClick={openSubscriptionInfo}>
                            <div className="action-icon warning">★</div>
                            <h3 className="action-title">Mi Plan</h3>
                            <p className="action-description">Gestiona tu suscripcion y beneficios</p>
                        </div>
                    </div>

                    <section className="seller-carts-section">
                        <div className="section-header-row">
                            <div>
                                <h2>Carritos activos</h2>
                                <p className="seller-orders-caption">Productos agregados por clientes antes de confirmar el pago.</p>
                            </div>
                            <span className="products-count">{activeCarts.length} carrito(s)</span>
                        </div>

                        {!activeCarts.length ? (
                            <p className="seller-orders-empty">Aun no hay carritos activos con tus productos.</p>
                        ) : (
                            <div className="seller-orders-grid">
                                {activeCarts.map((cart) => (
                                    <article className="seller-order-card" key={cart.id}>
                                        <div className="seller-order-head">
                                            <div>
                                                <h3>Carrito {cart.id}</h3>
                                                <p className="seller-order-date">Actualizado: {formatDateTime(cart.updated_at)}</p>
                                            </div>
                                            <div className="seller-order-badges">
                                                <span className="badge badge-warning">Pendiente de pago</span>
                                                <span className={`badge ${cart.user_role === 'guest' ? 'badge-info' : 'badge-sage'}`}>
                                                    {cart.user_role === 'guest' ? 'Invitado' : 'Cliente registrado'}
                                                </span>
                                            </div>
                                        </div>

                                        <div className="seller-order-meta-grid">
                                            <div className="seller-order-meta-block">
                                                <span className="seller-order-label">Cliente</span>
                                                <strong>{cart.user_name || 'Invitado'}</strong>
                                                <p>{cart.user_role === 'guest' ? 'Aun no inicia sesion' : 'Carrito vinculado a su cuenta'}</p>
                                            </div>
                                            <div className="seller-order-meta-block">
                                                <span className="seller-order-label">Resumen</span>
                                                <strong>{cart.seller_units || 0} unidad(es) tuyas</strong>
                                                <p>Total potencial: {mercado.formatPrice(cart.seller_total || 0)}</p>
                                            </div>
                                        </div>

                                        <div className="seller-order-items">
                                            {(cart.items || []).map((item, index) => (
                                                <div className="seller-order-item-line" key={`${cart.id}-${item.product_id}-${index}`}>
                                                    <span>{item.quantity} x {item.name}</span>
                                                    <strong>{mercado.formatPrice(Number(item.price || 0) * Number(item.quantity || 0))}</strong>
                                                </div>
                                            ))}
                                        </div>

                                        <div className="seller-order-foot">
                                            <span>Este carrito aun no se convierte en pedido.</span>
                                            <strong>{mercado.formatPrice(cart.seller_total || 0)}</strong>
                                        </div>
                                    </article>
                                ))}
                            </div>
                        )}
                    </section>

                    <section className="seller-orders-section">
                        <div className="section-header-row">
                            <div>
                                <h2>Pedidos recibidos</h2>
                                <p className="seller-orders-caption">Aqui ves compras ya confirmadas del carrito de tus clientes.</p>
                            </div>
                            <span className="products-count">{sellerOrders.length} pedido(s)</span>
                        </div>

                        {!sellerOrders.length ? (
                            <p className="seller-orders-empty">Aun no tienes pedidos confirmados.</p>
                        ) : (
                            <div className="seller-orders-grid">
                                {sellerOrders.map((order) => {
                                    const myItems = getOrderItemsForSeller(order);
                                    const sellerTotal = getSellerOrderTotal(order);
                                    const sellerUnits = getSellerOrderUnits(order);

                                    return (
                                        <article className="seller-order-card" key={order.id}>
                                            <div className="seller-order-head">
                                                <div>
                                                    <h3>Pedido {order.id}</h3>
                                                    <p className="seller-order-date">{formatDateTime(order.created_at)}</p>
                                                </div>
                                                <div className="seller-order-badges">
                                                    {orderStatusBadge(order.status)}
                                                    {orderMethodBadge(order.delivery_method)}
                                                </div>
                                            </div>

                                            <div className="seller-order-meta-grid">
                                                <div className="seller-order-meta-block">
                                                    <span className="seller-order-label">Cliente</span>
                                                    <strong>{order.customer?.name || 'Cliente'}</strong>
                                                    <p>{order.customer?.phone || 'Sin telefono'}</p>
                                                </div>
                                                <div className="seller-order-meta-block">
                                                    <span className="seller-order-label">
                                                        {String(order.delivery_method || '').toLowerCase() === 'pickup' ? 'Recoger en' : 'Entrega en'}
                                                    </span>
                                                    <strong>{getOrderLocationLabel(order)}</strong>
                                                    <p>
                                                        {String(order.delivery_method || '').toLowerCase() === 'pickup'
                                                            ? `Apartado hasta: ${formatDateTime(order.pickup_reserved_until)}`
                                                            : `Repartidor: ${order.courier_name || 'Sin asignar'}`}
                                                    </p>
                                                </div>
                                            </div>

                                            <div className="seller-order-items">
                                                {myItems.map((item, index) => (
                                                    <div className="seller-order-item-line" key={`${order.id}-${item.product_id}-${index}`}>
                                                        <span>{item.quantity} x {item.name}</span>
                                                        <strong>{mercado.formatPrice(Number(item.price || 0) * Number(item.quantity || 0))}</strong>
                                                    </div>
                                                ))}
                                            </div>

                                            <div className="seller-order-foot">
                                                <span>{sellerUnits} unidad(es) tuyas en este pedido</span>
                                                <strong>{mercado.formatPrice(sellerTotal)}</strong>
                                            </div>
                                        </article>
                                    );
                                })}
                            </div>
                        )}
                    </section>

                    <section className="pickup-orders-section">
                        <div className="section-header-row">
                            <h2>Compras pendientes para recoger</h2>
                            <span className="products-count">{pickupPendingOrders.length} pendiente(s)</span>
                        </div>

                        {!pickupPendingOrders.length ? (
                            <p className="pickup-orders-empty">No hay apartados pendientes por atender.</p>
                        ) : (
                            <div className="pickup-orders-list">
                                {pickupPendingOrders.map((order) => {
                                    const myItems = getOrderItemsForSeller(order)
                                        .filter((item) => !item.stock_released && !item.picked_up);
                                    if (!myItems.length) return null;

                                    return (
                                        <article className="pickup-order-card" key={order.id}>
                                            <div className="pickup-order-head">
                                                <h3>Pedido {order.id}</h3>
                                                <span className="badge badge-warning">Compra pendiente</span>
                                            </div>

                                            <div className="pickup-order-meta">
                                                <p><strong>Cliente:</strong> {order.customer?.name || 'Cliente'}</p>
                                                <p><strong>Teléfono:</strong> {order.customer?.phone || 'Sin teléfono'}</p>
                                                <p><strong>Tienda:</strong> {order.pickup_point?.name || 'Tienda local'}</p>
                                                <p><strong>Dirección de tienda:</strong> {order.pickup_point?.location || 'Ubicación de tienda por confirmar'}</p>
                                                <p><strong>Apartado hasta:</strong> {formatDateTime(order.pickup_reserved_until)}</p>
                                            </div>

                                            <div className="pickup-order-items">
                                                {myItems.map((item, index) => (
                                                    <p key={`${order.id}-${item.product_id}-${index}`}>
                                                        {item.quantity} x {item.name}
                                                    </p>
                                                ))}
                                            </div>

                                            <div className="pickup-order-actions">
                                                <button
                                                    className="btn btn-primary btn-sm"
                                                    type="button"
                                                    onClick={() => { void markPickupCollected(order.id); }}
                                                >
                                                    Cliente recogió
                                                </button>
                                                <button
                                                    className="btn btn-secondary btn-sm"
                                                    type="button"
                                                    onClick={() => { void markPickupNoShow(order.id); }}
                                                >
                                                    Cliente no vino
                                                </button>
                                            </div>
                                        </article>
                                    );
                                })}
                            </div>
                        )}
                    </section>

                    <section className="products-list-section">
                        <div className="section-header-row">
                            <h2>Mis Productos</h2>
                            <span className="products-count">{products.length} producto(s)</span>
                        </div>

                        <div className="products-table">
                            {!products.length ? (
                                <div className="empty-state">
                                    <div className="empty-state-icon">📦</div>
                                    <h3 className="empty-state-title">Sin productos aun</h3>
                                    <p className="empty-state-description">Agrega tu primer producto para comenzar a vender.</p>
                                    <button className="btn btn-primary" type="button" onClick={() => openProductModal(null)}>
                                        Agregar Producto
                                    </button>
                                </div>
                            ) : products.map((product) => (
                                <article className="product-row" key={product.id}>
                                    <div className="product-row-image">
                                        <SafeImage
                                            src={resolveImageSrc(product.images?.[0], mercado.createPlaceholderImage(product.name || 'Producto'))}
                                            alt={product.name || 'Producto'}
                                            fallback={mercado.createPlaceholderImage(product.name || 'Producto')}
                                            loading="lazy"
                                        />
                                    </div>
                                    <div className="product-row-info">
                                        <div className="product-row-badges">
                                            {statusBadge(product.status)}
                                            {stockBadge(product.stock)}
                                            {product.is_local_handmade ? (
                                                <span className={`badge ${product.local_handmade_verified ? 'badge-sage' : 'badge-warning'}`}>
                                                    {product.local_handmade_verified ? '✓ ' : ''}Local
                                                </span>
                                            ) : null}
                                            {product.is_featured ? <span className="badge badge-terracotta">★ Destacado</span> : null}
                                        </div>
                                        <h4 className="product-row-name">{product.name}</h4>
                                        <p className="product-row-description">{product.description}</p>
                                    </div>
                                    <div className="product-row-price">{mercado.formatPrice(product.price || 0)}</div>
                                    <div className="product-row-stats">
                                        <span>👁 {product.views || 0}</span>
                                        <span>❤ {product.favorites_count || 0}</span>
                                    </div>
                                    <div className="product-row-actions">
                                        <button type="button" title="Editar" onClick={() => openProductModal(product)}>✏️</button>
                                        <button type="button" title="Destacar" onClick={() => featureProduct(product.id)}>★</button>
                                        <button type="button" title="Eliminar" className="delete" onClick={() => deleteProduct(product.id)}>🗑️</button>
                                    </div>
                                </article>
                            ))}
                        </div>
                    </section>

                    <div className="subscription-card">
                        <div className="subscription-info">
                            <h3>
                                <span>📋</span>
                                <span>{isPremium ? 'Plan Premium' : 'Plan Gratuito'}</span>
                            </h3>
                            <p>{isPremium ? 'Productos ilimitados' : '5 productos maximo'}</p>
                        </div>
                        <button className="btn btn-primary" type="button" onClick={upgradePlan} disabled={isPremium}>
                            {isPremium ? 'Plan Activo' : 'Mejorar Plan'}
                        </button>
                    </div>
                </div>
            </main>

            <div className={`modal-overlay ${productModalOpen ? 'show' : ''}`} onClick={(event) => {
                if (event.target === event.currentTarget) closeProductModal();
            }}>
                <div className="modal modal-lg">
                    <div className="modal-header">
                        <h3 className="modal-title">{productForm.id ? 'Editar Producto' : 'Nuevo Producto'}</h3>
                        <button className="modal-close" type="button" onClick={closeProductModal}>✕</button>
                    </div>
                    <div className="modal-body">
                        <form className="product-form" onSubmit={saveProduct}>
                            <div className="form-group">
                                <label className="form-label">Nombre del producto *</label>
                                <input
                                    className="form-input"
                                    value={productForm.name}
                                    onChange={(event) => setProductForm((prev) => ({ ...prev, name: event.target.value }))}
                                    required
                                />
                            </div>

                            <div className="form-group">
                                <label className="form-label">Descripcion *</label>
                                <textarea
                                    className="form-input form-textarea"
                                    value={productForm.description}
                                    onChange={(event) => setProductForm((prev) => ({ ...prev, description: event.target.value }))}
                                    required
                                ></textarea>
                            </div>

                            <div className="product-form-grid-2">
                                <div className="form-group">
                                    <label className="form-label">Precio (MXN) *</label>
                                    <input
                                        className="form-input"
                                        type="number"
                                        min="1"
                                        step="0.01"
                                        value={productForm.price}
                                        onChange={(event) => setProductForm((prev) => ({ ...prev, price: event.target.value }))}
                                        required
                                    />
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Categoria *</label>
                                    <select
                                        className="form-input form-select"
                                        value={productForm.category_id}
                                        onChange={(event) => setProductForm((prev) => ({ ...prev, category_id: event.target.value }))}
                                        required
                                    >
                                        <option value="">Selecciona...</option>
                                        <option value="sin-categoria">Sin categoria</option>
                                        {categories.map((category) => (
                                            <option key={category.id} value={category.id}>{category.name}</option>
                                        ))}
                                    </select>
                                </div>
                            </div>

                            <div className="product-form-grid-stock">
                                <div className="form-group">
                                    <label className="form-label">Stock disponible *</label>
                                    <input
                                        className="form-input"
                                        type="number"
                                        min="0"
                                        value={productForm.stock}
                                        onChange={(event) => setProductForm((prev) => ({ ...prev, stock: event.target.value }))}
                                        required
                                    />
                                </div>
                                <button className="btn btn-secondary btn-sm" type="button" onClick={suggestCategory}>
                                    Sugerir categoria
                                </button>
                            </div>

                            <div className="form-group">
                                <label className="form-label">Imagenes del producto</label>
                                <input
                                    ref={fileInputRef}
                                    className="form-input"
                                    type="file"
                                    accept="image/*"
                                    multiple
                                    onChange={onFilesChange}
                                />
                                <small className="product-images-help">Puedes seleccionar varias imagenes desde tu equipo.</small>
                                <div className="selected-images-preview">{selectedImagesText}</div>
                            </div>

                            <div className="local-handmade-option">
                                <label>
                                    <input
                                        type="checkbox"
                                        checked={productForm.is_local_handmade}
                                        onChange={(event) => setProductForm((prev) => ({ ...prev, is_local_handmade: event.target.checked }))}
                                    />
                                    <div className="local-handmade-text">
                                        <h4>Producto Local / Hecho a Mano</h4>
                                        <p>Marca esta opcion si tu producto es local o artesanal.</p>
                                    </div>
                                </label>
                            </div>

                            <div className="modal-footer modal-footer-clean">
                                <button className="btn btn-secondary" type="button" onClick={closeProductModal}>Cancelar</button>
                                <button className="btn btn-primary" type="submit">Guardar Producto</button>
                            </div>
                        </form>
                    </div>
                </div>
            </div>

            <div className={`modal-overlay ${profileModalOpen ? 'show' : ''}`} onClick={(event) => {
                if (event.target === event.currentTarget) closeProfileModal();
            }}>
                <div className="modal modal-md">
                    <div className="modal-header">
                        <h3 className="modal-title">Editar Perfil de Negocio</h3>
                        <button className="modal-close" type="button" onClick={closeProfileModal}>✕</button>
                    </div>
                    <div className="modal-body">
                        <form onSubmit={saveProfile}>
                            <div className="form-group">
                                <label className="form-label">Nombre del Negocio</label>
                                <input
                                    className="form-input"
                                    value={profileForm.business_name}
                                    onChange={(event) => setProfileForm((prev) => ({ ...prev, business_name: event.target.value }))}
                                />
                            </div>
                            <div className="form-group">
                                <label className="form-label">Descripcion</label>
                                <textarea
                                    className="form-input form-textarea"
                                    value={profileForm.description}
                                    onChange={(event) => setProfileForm((prev) => ({ ...prev, description: event.target.value }))}
                                ></textarea>
                            </div>
                            <div className="form-group">
                                <label className="form-label">Horario de Atencion</label>
                                <input
                                    className="form-input"
                                    value={profileForm.schedule}
                                    onChange={(event) => setProfileForm((prev) => ({ ...prev, schedule: event.target.value }))}
                                />
                            </div>
                            <div className="form-group">
                                <label className="form-label">Ubicacion</label>
                                <input
                                    className="form-input"
                                    value={profileForm.location}
                                    onChange={(event) => setProfileForm((prev) => ({ ...prev, location: event.target.value }))}
                                />
                            </div>
                            <div className="modal-footer modal-footer-clean">
                                <button className="btn btn-secondary" type="button" onClick={closeProfileModal}>Cancelar</button>
                                <button className="btn btn-primary" type="submit">Guardar Cambios</button>
                            </div>
                        </form>
                    </div>
                </div>
            </div>
        </>
    );
}
