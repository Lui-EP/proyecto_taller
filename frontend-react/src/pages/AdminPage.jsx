import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSession } from '../context/SessionContext';
import { getMercadoLocal } from '../lib/mercadoLocal';
import { resolveImageSrc } from '../lib/assets';
import SafeImage from '../components/SafeImage';
import PageLoader from '../components/PageLoader';

const TABS = [
    { key: 'products', label: 'Productos' },
    { key: 'categories', label: 'Categorias' },
    { key: 'sellers', label: 'Vendedores' },
    { key: 'couriers', label: 'Repartidores' },
    { key: 'orders', label: 'Pedidos' },
    { key: 'reports', label: 'Reportes' },
];

const PRODUCT_FILTERS = [
    { value: 'featured', label: 'Destacados' },
    { value: 'pending', label: 'Pendientes' },
    { value: 'approved', label: 'Aprobados' },
    { value: 'paused', label: 'Pausados' },
    { value: 'rejected', label: 'Rechazados' },
    { value: '', label: 'Todos' },
];

const USER_FILTERS = [
    { value: '', label: 'Todos' },
    { value: 'verified', label: 'Activos / verificados' },
    { value: 'blocked', label: 'Bloqueados' },
];

const REPORT_FILTERS = [
    { value: 'pending', label: 'Pendientes' },
    { value: 'in_review', label: 'En revision' },
    { value: 'resolved', label: 'Resueltos' },
    { value: 'rejected', label: 'Descartados' },
    { value: '', label: 'Todos' },
];
const CATEGORY_FILTERS = [
    { value: '', label: 'Todas' },
    { value: 'approved', label: 'Aprobadas' },
    { value: 'pending', label: 'Pendientes' },
    { value: 'rejected', label: 'Rechazadas' },
];

const ORDER_FILTERS = [
    { value: '', label: 'Todos' },
    { value: 'pedido_realizado', label: 'Pedido realizado' },
    { value: 'en_transito', label: 'En transito' },
    { value: 'entregado', label: 'Entregado' },
    { value: 'cancelado_no_show', label: 'Cancelado no show' },
];

function inferCategoryMetaphor(name = '') {
    const normalized = String(name || '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase();
    if (['alimento', 'comida', 'cafe', 'miel', 'bebida'].some((token) => normalized.includes(token))) return '🍯';
    if (['textil', 'ropa', 'rebozo', 'tejido'].some((token) => normalized.includes(token))) return '🧵';
    if (['joyeria', 'ambar', 'pulsera', 'anillo'].some((token) => normalized.includes(token))) return '💍';
    if (['arte', 'artesania', 'barro', 'canasta', 'madera'].some((token) => normalized.includes(token))) return '🎨';
    return '📦';
}

function isActiveStatus(status) {
    const safe = String(status || '').toLowerCase();
    return ['verified', 'active', 'approved'].includes(safe);
}

function statusLabel(status) {
    const safe = String(status || '').toLowerCase();
    if (safe === 'verified') return 'Verificado';
    if (safe === 'blocked') return 'Bloqueado';
    if (safe === 'new') return 'Nuevo';
    if (safe === 'observation') return 'En observacion';
    if (safe === 'suspended') return 'Suspendido';
    if (safe === 'approved') return 'Aprobado';
    if (safe === 'pending') return 'Pendiente';
    if (safe === 'in_review') return 'En revision';
    if (safe === 'resolved') return 'Resuelto';
    if (safe === 'rejected') return 'Rechazado';
    if (safe === 'paused') return 'Pausado';
    if (safe === 'pedido_realizado') return 'Pedido realizado';
    if (safe === 'en_transito') return 'En transito';
    if (safe === 'entregado') return 'Entregado';
    if (safe === 'cancelado_no_show') return 'Cancelado no show';
    return status || 'Sin estado';
}

function statusTone(status) {
    const safe = String(status || '').toLowerCase();
    if (['verified', 'active', 'approved', 'resolved'].includes(safe)) return 'ok';
    if (safe === 'entregado') return 'ok';
    if (['pending', 'new'].includes(safe)) return 'warn';
    if (safe === 'pedido_realizado') return 'warn';
    if (['in_review', 'observation'].includes(safe)) return 'info';
    if (safe === 'en_transito') return 'info';
    if (safe === 'cancelado_no_show') return 'bad';
    return 'bad';
}

function toReasonText(reason, targetType = '') {
    if (!reason) return 'Reporte';
    const safe = String(reason).toLowerCase();
    if (safe === 'spam') return 'Spam';
    if (safe === 'fake') return 'Informacion falsa';
    if (safe === 'offensive') return 'Contenido ofensivo';
    if (safe === 'inappropriate') {
        const safeTarget = String(targetType || '').toLowerCase();
        if (safeTarget === 'review') return 'Comentario inapropiado';
        if (safeTarget === 'product') return 'Producto inapropiado';
        return 'Contenido inapropiado';
    }
    if (safe === 'feature_request') return 'Solicitud para destacar';
    if (safe === 'other') return 'Otro';
    return reason;
}

function formatOrderItems(items = []) {
    if (!Array.isArray(items) || !items.length) return 'Sin productos';
    return items
        .map((item) => {
            const name = item?.name || 'Producto';
            const quantity = Math.max(1, Number(item?.quantity || 1));
            return `${name} x${quantity}`;
        })
        .join(', ');
}

function StatusPill({ value }) {
    return (
        <span className={`adminx-pill adminx-pill--${statusTone(value)}`}>
            {statusLabel(value)}
        </span>
    );
}

function AdminSelect({ value, options, onChange, ariaLabel = 'Seleccionar opcion' }) {
    const [open, setOpen] = useState(false);
    const rootRef = useRef(null);

    const selected = useMemo(() => {
        const found = options.find((item) => item.value === value);
        return found || options[0] || { value: '', label: 'Seleccionar' };
    }, [options, value]);

    useEffect(() => {
        if (!open) return undefined;

        const handleClickOutside = (event) => {
            if (!rootRef.current?.contains(event.target)) {
                setOpen(false);
            }
        };

        const handleEsc = (event) => {
            if (event.key === 'Escape') {
                setOpen(false);
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        document.addEventListener('keydown', handleEsc);

        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
            document.removeEventListener('keydown', handleEsc);
        };
    }, [open]);

    return (
        <div className={`adminx-selectbox ${open ? 'is-open' : ''}`} ref={rootRef}>
            <button
                type="button"
                className="adminx-selectbox-trigger"
                aria-haspopup="listbox"
                aria-expanded={open}
                aria-label={ariaLabel}
                onClick={() => setOpen((prev) => !prev)}
            >
                <span>{selected.label}</span>
                <span className="adminx-selectbox-arrow" aria-hidden="true" />
            </button>
            {open ? (
                <div className="adminx-selectbox-menu" role="listbox" aria-label={ariaLabel}>
                    {options.map((item) => (
                        <button
                            key={item.value || 'all'}
                            type="button"
                            role="option"
                            className={`adminx-selectbox-option ${item.value === value ? 'is-selected' : ''}`}
                            aria-selected={item.value === value}
                            onClick={() => {
                                onChange(item.value);
                                setOpen(false);
                            }}
                        >
                            {item.label}
                        </button>
                    ))}
                </div>
            ) : null}
        </div>
    );
}
function StatCard({ title, value, hint }) {
    return (
        <article className="adminx-stat-card">
            <p className="adminx-stat-title">{title}</p>
            <p className="adminx-stat-value">{value}</p>
            <p className="adminx-stat-hint">{hint}</p>
        </article>
    );
}

function ActiveList({ title, items, type }) {
    return (
        <section className="adminx-active-card card">
            <div className="adminx-active-head">
                <h3>{title}</h3>
                <span className="adminx-active-count">{items.length}</span>
            </div>
            <div className="adminx-active-list">
                {items.length ? items.slice(0, 8).map((item) => (
                    <div className="adminx-active-item" key={item.id}>
                        <div className="adminx-avatar" aria-hidden="true">{String(item.name || 'U').charAt(0).toUpperCase()}</div>
                        <div className="adminx-active-item-text">
                            <strong>{item.seller_profile?.business_name || item.name || 'Sin nombre'}</strong>
                            <span>
                                {type === 'courier'
                                    ? `${item.active_orders_assigned || 0} pedidos activos`
                                    : `${item.total_products || 0} productos`}
                            </span>
                        </div>
                    </div>
                )) : <p className="adminx-empty">No hay usuarios activos en este momento.</p>}
            </div>
        </section>
    );
}

function UserCard({ user, type, mercado, onStatusChange, onDelete }) {
    const isCourier = type === 'courier';
    const status = String(user.status || '').toLowerCase();
    const isBlocked = status === 'blocked';

    return (
        <article className={`adminx-user-card card ${isBlocked ? 'is-blocked' : ''}`} key={user.id}>
            <div className="adminx-user-head">
                <div className="adminx-user-main">
                    <div className="adminx-avatar adminx-avatar--large" aria-hidden="true">{String(user.name || 'U').charAt(0).toUpperCase()}</div>
                    <div>
                        <div className="adminx-title-row">
                            <h3>{isCourier ? (user.name || 'Repartidor') : (user.seller_profile?.business_name || user.name || 'Vendedor')}</h3>
                            <StatusPill value={status} />
                        </div>
                        <p className="adminx-subtext">{user.email || 'Sin correo'}</p>
                        <p className="adminx-subtext">{user.phone || 'Sin telefono'} Â· Alta: {mercado.formatDate(user.created_at)}</p>
                    </div>
                </div>
                <div className="adminx-actions">
                    <button className="btn btn-sage btn-sm" type="button" disabled={status === 'verified'} onClick={() => onStatusChange(user.id, 'verified')}>
                        Activar
                    </button>
                    <button className="btn btn-outline btn-sm adminx-btn-danger" type="button" disabled={status === 'blocked'} onClick={() => onStatusChange(user.id, 'blocked')}>
                        Bloquear
                    </button>
                    <button className="btn btn-secondary btn-sm" type="button" onClick={() => onDelete(user)}>
                        Eliminar
                    </button>
                </div>
            </div>
            <div className="adminx-meta-grid">
                {isCourier ? (
                    <>
                        <div className="adminx-meta-item"><span>Pedidos activos</span><strong>{user.active_orders_assigned || 0}</strong></div>
                        <div className="adminx-meta-item"><span>Pedidos asignados</span><strong>{user.total_orders_assigned || 0}</strong></div>
                    </>
                ) : (
                    <>
                        <div className="adminx-meta-item"><span>Ubicacion</span><strong>{user.seller_profile?.location || 'Sin ubicacion'}</strong></div>
                        <div className="adminx-meta-item"><span>Productos</span><strong>{user.total_products || 0}</strong></div>
                    </>
                )}
                <div className="adminx-meta-item"><span>Estado activo</span><strong>{isActiveStatus(status) ? 'Si' : 'No'}</strong></div>
            </div>
            {!isCourier && user.seller_profile?.description ? <p className="adminx-description">{user.seller_profile.description}</p> : null}
        </article>
    );
}

export default function AdminPage() {
    const session = useSession();
    const navigate = useNavigate();
    const mercado = getMercadoLocal();

    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [activeTab, setActiveTab] = useState('products');

    const [stats, setStats] = useState(null);
    const [products, setProducts] = useState([]);
    const [categories, setCategories] = useState([]);
    const [orders, setOrders] = useState([]);
    const [reports, setReports] = useState([]);
    const [sellers, setSellers] = useState([]);
    const [couriers, setCouriers] = useState([]);

    const [productFilter, setProductFilter] = useState('');
    const [categoryFilter, setCategoryFilter] = useState('');
    const [sellerFilter, setSellerFilter] = useState('');
    const [courierFilter, setCourierFilter] = useState('');
    const [orderFilter, setOrderFilter] = useState('');
    const [reportFilter, setReportFilter] = useState('pending');

    const [sellerSearch, setSellerSearch] = useState('');
    const [courierSearch, setCourierSearch] = useState('');
    const [categoryForm, setCategoryForm] = useState({ name: '', description: '', metafora: '' });

    const canAccess = session.user?.role === 'admin';

    const loadStats = useCallback(async () => {
        const response = await mercado.AdminAPI.getStats();
        setStats(response || null);
    }, [mercado]);

    const loadProducts = useCallback(async (status = productFilter) => {
        const safeStatus = String(status || '').toLowerCase();
        const statusForApi = ['pending', 'approved', 'paused', 'rejected'].includes(safeStatus)
            ? safeStatus
            : undefined;
        const response = await mercado.ProductsAPI.getAll({ status: statusForApi, include_all_status: true, limit: 120 });
        setProducts(response.products || []);
    }, [mercado, productFilter]);

    const loadCategories = useCallback(async () => {
        const response = await mercado.CategoriesAPI.getAll();
        setCategories(response || []);
    }, [mercado]);

    const loadReports = useCallback(async (status = reportFilter) => {
        const response = await mercado.ReportsAPI.getAll(status || undefined);
        setReports(response || []);
    }, [mercado, reportFilter]);

    const loadOrders = useCallback(async () => {
        const response = await mercado.OrdersAPI.getAssigned();
        setOrders(response || []);
    }, [mercado]);

    const loadSellers = useCallback(async () => {
        const response = await mercado.AdminAPI.getUsers('seller', '');
        setSellers(response || []);
    }, [mercado]);

    const loadCouriers = useCallback(async () => {
        const response = await mercado.AdminAPI.getUsers('courier', '');
        setCouriers(response || []);
    }, [mercado]);

    const refreshCore = useCallback(async () => {
        await Promise.all([loadStats(), loadSellers(), loadCouriers()]);
    }, [loadStats, loadSellers, loadCouriers]);
    const loadAll = useCallback(async () => {
        setLoading(true);
        try {
            await Promise.all([
                loadStats(),
                loadProducts(productFilter),
                loadCategories(),
                loadOrders(),
                loadReports(reportFilter),
                loadSellers(),
                loadCouriers(),
            ]);
        } catch {
            mercado.showToast('No se pudieron cargar datos del panel admin', 'error');
        } finally {
            setLoading(false);
        }
    }, [
        loadStats,
        loadProducts,
        loadCategories,
        loadOrders,
        loadReports,
        loadSellers,
        loadCouriers,
        productFilter,
        reportFilter,
        mercado,
    ]);

    useEffect(() => {
        if (!session.ready) return;
        if (!session.token) {
            navigate('/login', { replace: true });
            return;
        }
        if (!canAccess) {
            mercado.showToast('Acceso denegado. Solo para administradores.', 'error');
            navigate('/', { replace: true });
            return;
        }
        loadAll();
    }, [session.ready, session.token, canAccess, loadAll, mercado, navigate]);

    useEffect(() => {
        if (!session.ready || !canAccess || loading) return;
        loadProducts(productFilter).catch(() => {
            mercado.showToast('No se pudieron cargar productos', 'error');
        });
    }, [session.ready, canAccess, loading, productFilter, loadProducts, mercado]);

    useEffect(() => {
        if (!session.ready || !canAccess || loading) return;
        loadReports(reportFilter).catch(() => {
            mercado.showToast('No se pudieron cargar reportes', 'error');
        });
    }, [session.ready, canAccess, loading, reportFilter, loadReports, mercado]);

    const doRefresh = async () => {
        setRefreshing(true);
        try {
            await Promise.all([
                loadProducts(productFilter),
                loadCategories(),
                loadOrders(),
                loadReports(reportFilter),
                refreshCore(),
            ]);
            mercado.showToast('Panel actualizado');
        } catch {
            mercado.showToast('No se pudo actualizar el panel', 'error');
        } finally {
            setRefreshing(false);
        }
    };

    const updateUserStatus = async (id, status, label) => {
        try {
            await mercado.AdminAPI.updateUserStatus(id, status);
            mercado.showToast(`${label} actualizado`);
            await refreshCore();
        } catch {
            mercado.showToast(`No se pudo actualizar ${label}`, 'error');
        }
    };

    const deleteUser = async (user, label) => {
        const userName = user?.seller_profile?.business_name || user?.name || user?.email || 'usuario';
        const accepted = window.confirm(`¿Eliminar ${label} "${userName}" de forma definitiva?`);
        if (!accepted) return;
        try {
            await mercado.AdminAPI.deleteUser(user.id);
            mercado.showToast(`${label} eliminado`);
            await refreshCore();
        } catch (error) {
            mercado.showToast(error.message || `No se pudo eliminar ${label}`, 'error');
        }
    };

    const updateProductStatus = async (id, status) => {
        try {
            await mercado.AdminAPI.updateProductStatus(id, status);
            mercado.showToast('Producto actualizado');
            await Promise.all([loadProducts(productFilter), loadStats()]);
        } catch {
            mercado.showToast('No se pudo actualizar el producto', 'error');
        }
    };

    const deleteProduct = async (id, name = 'producto') => {
        const accepted = window.confirm(`¿Eliminar ${name} de forma definitiva?`);
        if (!accepted) return;
        try {
            await mercado.AdminAPI.deleteProduct(id);
            mercado.showToast('Producto eliminado');
            await Promise.all([loadProducts(productFilter), loadStats()]);
        } catch (error) {
            mercado.showToast(error.message || 'No se pudo eliminar el producto', 'error');
        }
    };

    const verifyLocal = async (id, verified) => {
        try {
            await mercado.AdminAPI.verifyLocalHandmade(id, verified);
            mercado.showToast('Etiqueta local actualizada');
            await loadProducts(productFilter);
        } catch {
            mercado.showToast('No se pudo actualizar etiqueta local', 'error');
        }
    };

    const featureProduct = async (id) => {
        const rawDays = window.prompt('Cuantos dias destacar este producto?', '7');
        if (!rawDays) return;
        const days = Math.max(1, Math.min(60, Number(rawDays) || 7));
        try {
            await mercado.AdminAPI.featureProduct(id, days);
            mercado.showToast('Producto destacado');
            await loadProducts(productFilter);
        } catch {
            mercado.showToast('No se pudo destacar producto', 'error');
        }
    };

    const unfeatureProduct = async (id) => {
        try {
            await mercado.AdminAPI.unfeatureProduct(id);
            mercado.showToast('Producto retirado de destacados');
            await loadProducts(productFilter);
        } catch {
            mercado.showToast('No se pudo bajar de destacados', 'error');
        }
    };

    const createCategory = async (event) => {
        event.preventDefault();
        const name = categoryForm.name.trim();
        if (!name) {
            mercado.showToast('Escribe el nombre de la categoria', 'error');
            return;
        }

        try {
            await mercado.CategoriesAPI.create({
                name,
                description: categoryForm.description.trim(),
                metafora: categoryForm.metafora.trim(),
            });
            setCategoryForm({ name: '', description: '', metafora: '' });
            mercado.showToast('Categoria creada');
            await loadCategories();
        } catch {
            mercado.showToast('No se pudo crear la categoria', 'error');
        }
    };

    const updateCategoryStatus = async (id, status) => {
        try {
            await mercado.apiRequest(`/categories/${id}/status?status=${status}`, { method: 'PUT' });
            mercado.showToast('Categoria actualizada');
            await loadCategories();
        } catch {
            mercado.showToast('No se pudo actualizar categoria', 'error');
        }
    };

    const deleteCategory = async (id) => {
        const accepted = window.confirm('Eliminar esta categoria?');
        if (!accepted) return;

        try {
            await mercado.apiRequest(`/categories/${id}`, { method: 'DELETE' });
            mercado.showToast('Categoria eliminada');
            await loadCategories();
        } catch {
            mercado.showToast('No se pudo eliminar categoria', 'error');
        }
    };

    const updateReport = async (id, status) => {
        try {
            await mercado.AdminAPI.updateReport(id, status, '');
            mercado.showToast('Reporte actualizado');
            await Promise.all([loadReports(reportFilter), loadStats()]);
        } catch {
            mercado.showToast('No se pudo actualizar reporte', 'error');
        }
    };

    const resolveReport = async (id) => {
        const notes = window.prompt('Notas de resolucion (opcional):', '') || '';
        try {
            await mercado.AdminAPI.updateReport(id, 'resolved', notes);
            mercado.showToast('Reporte resuelto');
            await Promise.all([loadReports(reportFilter), loadStats()]);
        } catch {
            mercado.showToast('No se pudo resolver reporte', 'error');
        }
    };

    const deleteReportedReview = async (report) => {
        const reviewId = report?.target_id;
        if (!reviewId) {
            mercado.showToast('Reporte sin reseÃ±a vinculada', 'error');
            return;
        }

        const accepted = window.confirm('Â¿Eliminar este comentario reportado?');
        if (!accepted) return;

        try {
            await mercado.AdminAPI.deleteReview(reviewId);
            if (String(report.status) !== 'resolved') {
                await mercado.AdminAPI.updateReport(report.id, 'resolved', 'Comentario eliminado por admin');
            }
            mercado.showToast('Comentario eliminado');
            await Promise.all([loadReports(reportFilter), loadStats()]);
        } catch (error) {
            mercado.showToast(error.message || 'No se pudo eliminar comentario', 'error');
        }
    };

    const goToReportedTarget = async (report) => {
        const targetType = String(report?.target_type || '').toLowerCase();
        const targetId = String(report?.target_id || '').trim();
        if (!targetId) {
            mercado.showToast('Este reporte no tiene destino valido', 'error');
            return;
        }

        try {
            if (targetType === 'product') {
                navigate(`/producto?id=${encodeURIComponent(targetId)}`);
                return;
            }

            if (targetType === 'review') {
                const context = await mercado.AdminAPI.getReviewContext(targetId);
                if (!context?.product_id) {
                    mercado.showToast('No se encontró el producto de esta reseña', 'error');
                    return;
                }
                navigate(`/producto?id=${encodeURIComponent(context.product_id)}&review=${encodeURIComponent(context.review_id || targetId)}`);
                return;
            }

            mercado.showToast('Redirección no disponible para este tipo de reporte', 'error');
        } catch (error) {
            mercado.showToast(error.message || 'No se pudo abrir el destino del reporte', 'error');
        }
    };
    const filteredSellers = useMemo(() => {
        const term = sellerSearch.trim().toLowerCase();

        return sellers.filter((item) => {
            const byStatus = !sellerFilter || String(item.status || '').toLowerCase() === sellerFilter;
            if (!byStatus) return false;
            if (!term) return true;

            const text = `${item.name || ''} ${item.email || ''} ${item.seller_profile?.business_name || ''} ${item.seller_profile?.location || ''}`.toLowerCase();
            return text.includes(term);
        });
    }, [sellers, sellerFilter, sellerSearch]);

    const filteredCouriers = useMemo(() => {
        const term = courierSearch.trim().toLowerCase();

        return couriers.filter((item) => {
            const byStatus = !courierFilter || String(item.status || '').toLowerCase() === courierFilter;
            if (!byStatus) return false;
            if (!term) return true;

            const text = `${item.name || ''} ${item.email || ''} ${item.phone || ''}`.toLowerCase();
            return text.includes(term);
        });
    }, [couriers, courierFilter, courierSearch]);

    const filteredProducts = useMemo(() => {
        const safeStatus = String(productFilter || '').toLowerCase();
        if (safeStatus === 'featured') {
            return products.filter((item) => Boolean(item.is_featured));
        }
        if (!safeStatus) return products;
        return products.filter((item) => String(item.status || '').toLowerCase() === safeStatus);
    }, [products, productFilter]);

    const filteredCategories = useMemo(() => {
        const safeStatus = String(categoryFilter || '').toLowerCase();
        if (!safeStatus) return categories;
        return categories.filter((item) => String(item.status || '').toLowerCase() === safeStatus);
    }, [categories, categoryFilter]);

    const filteredOrders = useMemo(() => {
        if (!orderFilter) return orders;
        return orders.filter((order) => String(order.status || '').toLowerCase() === orderFilter);
    }, [orders, orderFilter]);

    const activeSellers = useMemo(
        () => sellers.filter((item) => isActiveStatus(item.status)),
        [sellers]
    );

    const activeCouriers = useMemo(
        () => couriers.filter((item) => isActiveStatus(item.status)),
        [couriers]
    );

    if (loading) {
        return <PageLoader text="Cargando panel de administracion..." />;
    }

    return (
        <main className="admin-page">
            <div className="container">
                <section className="adminx-shell">
                    <header className="adminx-header card">
                        <div>
                            <p className="adminx-kicker">Panel administrativo</p>
                            <h1>Control general de MercadoLocal</h1>
                            <p className="adminx-subtitle">
                                Supervisa productos, categorias, vendedores, repartidores y reportes en un solo lugar.
                            </p>
                        </div>
                        <div className="adminx-head-actions">
                            <button type="button" className="btn btn-primary" onClick={doRefresh} disabled={refreshing}>
                                {refreshing ? 'Actualizando...' : 'Actualizar panel'}
                            </button>
                        </div>
                    </header>

                    <section className="adminx-stats-grid" aria-label="Resumen general">
                        <StatCard
                            title="Usuarios registrados"
                            value={stats?.total_users ?? (sellers.length + couriers.length + 1)}
                            hint="Compradores, vendedores y repartidores"
                        />
                        <StatCard
                            title="Vendedores activos"
                            value={`${stats?.active_sellers ?? activeSellers.length} / ${stats?.total_sellers ?? sellers.length}`}
                            hint="Con estado verificado"
                        />
                        <StatCard
                            title="Repartidores activos"
                            value={`${stats?.active_couriers ?? activeCouriers.length} / ${stats?.total_couriers ?? couriers.length}`}
                            hint="Disponibles para entregar"
                        />
                        <StatCard title="Productos" value={stats?.total_products ?? products.length} hint="Inventario total en catalogo" />
                        <StatCard
                            title="Reportes pendientes"
                            value={stats?.pending_reports ?? reports.filter((item) => item.status === 'pending').length}
                            hint="Casos por atender"
                        />
                    </section>

                    <section className="adminx-active-grid">
                        <ActiveList title="Vendedores activos" items={activeSellers} type="seller" />
                        <ActiveList title="Repartidores activos" items={activeCouriers} type="courier" />
                    </section>

                    <nav className="adminx-tabs" aria-label="Secciones del panel admin">
                        {TABS.map((tab) => (
                            <button
                                key={tab.key}
                                type="button"
                                className={`adminx-tab ${activeTab === tab.key ? 'is-active' : ''}`}
                                onClick={() => setActiveTab(tab.key)}
                            >
                                {tab.label}
                            </button>
                        ))}
                    </nav>
                    <section className={`adminx-panel ${activeTab === 'products' ? 'is-active' : ''}`}>
                        <div className="adminx-section-head">
                            <div>
                                <h2>Gestion de productos</h2>
                                <p>Valida publicaciones y controla la visibilidad del catalogo.</p>
                            </div>
                            <AdminSelect
                                value={productFilter}
                                options={PRODUCT_FILTERS}
                                onChange={setProductFilter}
                                ariaLabel="Filtro de productos"
                            />
                        </div>

                        <div className="adminx-list">
                            {filteredProducts.length ? filteredProducts.map((product) => {
                                const image = resolveImageSrc(
                                    product.images?.[0],
                                    mercado.createPlaceholderImage(product.name || 'Producto')
                                );
                                const isPaused = String(product.status || '').toLowerCase() === 'paused';

                                return (
                                    <article className={`adminx-product-card card ${isPaused ? 'is-paused' : ''}`} key={product.id}>
                                        <div className="adminx-product-top">
                                            <div className="adminx-product-image">
                                                <SafeImage
                                                    src={image}
                                                    alt={product.name}
                                                    fallback={mercado.createPlaceholderImage(product.name || 'Producto')}
                                                    loading="lazy"
                                                />
                                            </div>
                                            <div className="adminx-product-info">
                                                <div className="adminx-title-row">
                                                    <h3>{product.name || 'Producto sin nombre'}</h3>
                                                    <StatusPill value={product.status} />
                                                </div>
                                                <p className="adminx-subtext">Vendedor: {product.seller_name || 'Desconocido'}</p>
                                                <p className="adminx-subtext">Precio: {mercado.formatPrice(product.price || 0)}</p>
                                                <p className="adminx-description">{product.description || 'Sin descripcion'}</p>
                                                <div className="adminx-product-tags">
                                                    {product.is_featured ? <span className="badge badge-terracotta">Destacado</span> : null}
                                                    {product.is_local_handmade ? (
                                                        <span className={`badge ${product.local_handmade_verified ? 'badge-sage' : 'badge-warning'}`}>
                                                            {product.local_handmade_verified ? 'Local verificado' : 'Local pendiente'}
                                                        </span>
                                                    ) : null}
                                                    <span className="badge badge-info">Publicado: {mercado.formatDate(product.created_at)}</span>
                                                </div>
                                            </div>
                                        </div>
                                        <div className="adminx-actions adminx-actions--wrap">
                                            {String(product.status) === 'pending' ? (
                                                <button className="btn btn-sage btn-sm" type="button" onClick={() => updateProductStatus(product.id, 'approved')}>
                                                    Aprobar
                                                </button>
                                            ) : null}
                                            {String(product.status) === 'pending' ? (
                                                <button className="btn btn-secondary btn-sm" type="button" onClick={() => updateProductStatus(product.id, 'rejected')}>
                                                    Rechazar
                                                </button>
                                            ) : null}
                                            {String(product.status) === 'approved' ? (
                                                <button className="btn btn-secondary btn-sm" type="button" onClick={() => updateProductStatus(product.id, 'paused')}>
                                                    Pausar
                                                </button>
                                            ) : null}
                                            {String(product.status) === 'paused' ? (
                                                <button className="btn btn-sage btn-sm" type="button" onClick={() => updateProductStatus(product.id, 'approved')}>
                                                    Reactivar
                                                </button>
                                            ) : null}
                                            {product.is_local_handmade && !product.local_handmade_verified ? (
                                                <button className="btn btn-primary btn-sm" type="button" onClick={() => verifyLocal(product.id, true)}>
                                                    Verificar local
                                                </button>
                                            ) : null}
                                            {product.is_featured ? (
                                                <button className="btn btn-secondary btn-sm" type="button" onClick={() => unfeatureProduct(product.id)}>
                                                    Bajar de destacados
                                                </button>
                                            ) : (
                                                <button className="btn btn-primary btn-sm" type="button" onClick={() => featureProduct(product.id)}>
                                                    Destacar
                                                </button>
                                            )}
                                            <button className="btn btn-outline btn-sm adminx-btn-danger" type="button" onClick={() => deleteProduct(product.id, product.name || 'producto')}>
                                                Eliminar
                                            </button>
                                        </div>
                                    </article>
                                );
                            }) : <p className="adminx-empty">No hay productos para este filtro.</p>}
                        </div>
                    </section>

                    <section className={`adminx-panel ${activeTab === 'categories' ? 'is-active' : ''}`}>
                        <div className="adminx-section-head">
                            <div>
                                <h2>Gestion de categorias</h2>
                                <p>Administra categorias publicas y solicitudes de nuevos rubros.</p>
                            </div>
                            <AdminSelect
                                value={categoryFilter}
                                options={CATEGORY_FILTERS}
                                onChange={setCategoryFilter}
                                ariaLabel="Filtro de categorias"
                            />
                        </div>

                        <form className="adminx-form card" onSubmit={createCategory}>
                            <h3>Nueva categoria</h3>
                            <div className="adminx-form-grid">
                                <div className="form-group">
                                    <label className="form-label" htmlFor="category-name">Nombre</label>
                                    <input
                                        id="category-name"
                                        className="form-input"
                                        value={categoryForm.name}
                                        onChange={(event) => setCategoryForm((prev) => ({ ...prev, name: event.target.value }))}
                                        required
                                    />
                                </div>
                                <div className="form-group">
                                    <label className="form-label" htmlFor="category-description">Descripcion</label>
                                    <input
                                        id="category-description"
                                        className="form-input"
                                        value={categoryForm.description}
                                        onChange={(event) => setCategoryForm((prev) => ({ ...prev, description: event.target.value }))}
                                    />
                                </div>
                                <div className="form-group">
                                    <label className="form-label" htmlFor="category-metafora">Metafora (emoji)</label>
                                    <div style={{ display: 'flex', gap: '0.45rem' }}>
                                        <input
                                            id="category-metafora"
                                            className="form-input"
                                            placeholder="Ejemplo: 🎨"
                                            value={categoryForm.metafora}
                                            onChange={(event) => setCategoryForm((prev) => ({ ...prev, metafora: event.target.value }))}
                                        />
                                        <button
                                            type="button"
                                            className="btn btn-secondary btn-sm"
                                            onClick={() => setCategoryForm((prev) => ({ ...prev, metafora: inferCategoryMetaphor(prev.name) }))}
                                            title="Asignar automáticamente por nombre"
                                        >
                                            Auto
                                        </button>
                                    </div>
                                </div>
                            </div>
                            <div className="adminx-actions">
                                <button className="btn btn-primary" type="submit">Crear categoria</button>
                            </div>
                        </form>

                        <div className="adminx-list">
                            {filteredCategories.length ? filteredCategories.map((category) => (
                                <article className="adminx-simple-row card" key={category.id}>
                                    <div>
                                        <h3>{category.metafora ? `${category.metafora} ${category.name || 'Categoria'}` : (category.name || 'Categoria')}</h3>
                                        <p className="adminx-subtext">{category.description || 'Sin descripcion'}</p>
                                    </div>
                                    <div className="adminx-actions adminx-actions--inline">
                                        <StatusPill value={category.status} />
                                        {String(category.status) === 'pending' ? (
                                            <button
                                                type="button"
                                                className="btn btn-sage btn-sm"
                                                onClick={() => updateCategoryStatus(category.id, 'approved')}
                                            >
                                                Aprobar
                                            </button>
                                        ) : null}
                                        {String(category.status) === 'pending' ? (
                                            <button
                                                type="button"
                                                className="btn btn-secondary btn-sm"
                                                onClick={() => updateCategoryStatus(category.id, 'rejected')}
                                            >
                                                Rechazar
                                            </button>
                                        ) : null}
                                        <button
                                            type="button"
                                            className="btn btn-outline btn-sm adminx-btn-danger"
                                            onClick={() => deleteCategory(category.id)}
                                        >
                                            Eliminar
                                        </button>
                                    </div>
                                </article>
                            )) : <p className="adminx-empty">No hay categorias para este filtro.</p>}
                        </div>
                    </section>

                    <section className={`adminx-panel ${activeTab === 'sellers' ? 'is-active' : ''}`}>
                        <div className="adminx-section-head">
                            <div>
                                <h2>Gestion de vendedores</h2>
                                <p>Consulta y actualiza el estado de cada vendedor.</p>
                            </div>
                            <div className="adminx-controls">
                                <input
                                    className="form-input"
                                    type="search"
                                    placeholder="Buscar vendedor..."
                                    value={sellerSearch}
                                    onChange={(event) => setSellerSearch(event.target.value)}
                                />
                                <AdminSelect
                                    value={sellerFilter}
                                    options={USER_FILTERS}
                                    onChange={setSellerFilter}
                                    ariaLabel="Filtro de vendedores"
                                />
                            </div>
                        </div>

                        <div className="adminx-list">
                            {filteredSellers.length ? filteredSellers.map((seller) => (
                                <UserCard
                                    key={seller.id}
                                    user={seller}
                                    type="seller"
                                    mercado={mercado}
                                    onStatusChange={(id, status) => updateUserStatus(id, status, 'vendedor')}
                                    onDelete={(user) => deleteUser(user, 'vendedor')}
                                />
                            )) : <p className="adminx-empty">No hay vendedores que coincidan con el filtro.</p>}
                        </div>
                    </section>
                    <section className={`adminx-panel ${activeTab === 'couriers' ? 'is-active' : ''}`}>
                        <div className="adminx-section-head">
                            <div>
                                <h2>Gestion de repartidores</h2>
                                <p>Supervisa disponibilidad y carga de pedidos asignados.</p>
                            </div>
                            <div className="adminx-controls">
                                <input
                                    className="form-input"
                                    type="search"
                                    placeholder="Buscar repartidor..."
                                    value={courierSearch}
                                    onChange={(event) => setCourierSearch(event.target.value)}
                                />
                                <AdminSelect
                                    value={courierFilter}
                                    options={USER_FILTERS}
                                    onChange={setCourierFilter}
                                    ariaLabel="Filtro de repartidores"
                                />
                            </div>
                        </div>

                        <div className="adminx-list">
                            {filteredCouriers.length ? filteredCouriers.map((courier) => (
                                <UserCard
                                    key={courier.id}
                                    user={courier}
                                    type="courier"
                                    mercado={mercado}
                                    onStatusChange={(id, status) => updateUserStatus(id, status, 'repartidor')}
                                    onDelete={(user) => deleteUser(user, 'repartidor')}
                                />
                            )) : <p className="adminx-empty">No hay repartidores que coincidan con el filtro.</p>}
                        </div>
                    </section>

                    <section className={`adminx-panel ${activeTab === 'orders' ? 'is-active' : ''}`}>
                        <div className="adminx-section-head">
                            <div>
                                <h2>Pedidos realizados</h2>
                                <p>Consulta cliente, repartidor, productos y estado de cada pedido.</p>
                            </div>
                            <AdminSelect
                                value={orderFilter}
                                options={ORDER_FILTERS}
                                onChange={setOrderFilter}
                                ariaLabel="Filtro de pedidos"
                            />
                        </div>

                        <div className="adminx-list">
                            {filteredOrders.length ? filteredOrders.map((order) => (
                                <article className="adminx-order-card card" key={order.id}>
                                    <div className="adminx-order-head">
                                        <div className="adminx-title-row">
                                            <h3>{order.id}</h3>
                                            <StatusPill value={order.status} />
                                        </div>
                                        <p className="adminx-subtext">Creado: {mercado.formatDate(order.created_at)}</p>
                                    </div>
                                    <div className="adminx-order-grid">
                                        <div className="adminx-meta-item">
                                            <span>Cliente</span>
                                            <strong>{order.customer?.name || 'Sin nombre'}</strong>
                                            <span>{order.customer?.email || 'Sin correo'}</span>
                                            <span>{order.customer?.phone || 'Sin telefono'}</span>
                                        </div>
                                        <div className="adminx-meta-item">
                                            <span>Repartidor</span>
                                            <strong>{order.courier_name || 'Sin asignar'}</strong>
                                            <span>{order.customer?.address || 'Sin direccion'}</span>
                                        </div>
                                        <div className="adminx-meta-item">
                                            <span>Productos</span>
                                            <strong>{formatOrderItems(order.items)}</strong>
                                            <span>Total: {mercado.formatPrice(order.total || 0)}</span>
                                        </div>
                                    </div>
                                </article>
                            )) : <p className="adminx-empty">No hay pedidos para este filtro.</p>}
                        </div>
                    </section>

                    <section className={`adminx-panel ${activeTab === 'reports' ? 'is-active' : ''}`}>
                        <div className="adminx-section-head">
                            <div>
                                <h2>Gestion de reportes</h2>
                                <p>Atiende casos reportados por compradores y vendedores.</p>
                            </div>
                            <AdminSelect
                                value={reportFilter}
                                options={REPORT_FILTERS}
                                onChange={setReportFilter}
                                ariaLabel="Filtro de reportes"
                            />
                        </div>

                        <div className="adminx-list">
                            {reports.length ? reports.map((report) => (
                                <article className="adminx-report-card card" key={report.id}>
                                    <div className="adminx-report-head">
                                        <div>
                                            <div className="adminx-actions adminx-actions--inline">
                                                <StatusPill value={report.status} />
                                                <span className="badge badge-terracotta">{report.target_type === 'product' ? 'Producto' : (report.target_type || 'General')}</span>
                                            </div>
                                            <h3>{toReasonText(report.reason, report.target_type)}</h3>
                                            <p className="adminx-subtext">Reportado por: {report.reporter_name || 'Usuario'}</p>
                                        </div>
                                        <p className="adminx-subtext">{mercado.formatDate(report.created_at)}</p>
                                    </div>

                                    {report.description ? <p className="adminx-description">{report.description}</p> : null}
                                    {report.admin_notes ? <p className="adminx-subtext">Notas: {report.admin_notes}</p> : null}

                                    <div className="adminx-actions adminx-actions--wrap">
                                        {(String(report.target_type) === 'review' || String(report.target_type) === 'product') ? (
                                            <button className="btn btn-primary btn-sm" type="button" onClick={() => goToReportedTarget(report)}>
                                                Ir al problema
                                            </button>
                                        ) : null}
                                        {String(report.target_type) === 'review' ? (
                                            <button className="btn btn-outline btn-sm" type="button" onClick={() => deleteReportedReview(report)}>
                                                Eliminar comentario
                                            </button>
                                        ) : null}
                                        {String(report.status) === 'pending' ? (
                                            <button className="btn btn-secondary btn-sm" type="button" onClick={() => updateReport(report.id, 'in_review')}>
                                                Pasar a revision
                                            </button>
                                        ) : null}
                                        {String(report.status) !== 'resolved' ? (
                                            <button className="btn btn-sage btn-sm" type="button" onClick={() => resolveReport(report.id)}>
                                                Resolver
                                            </button>
                                        ) : null}
                                        {String(report.status) !== 'rejected' ? (
                                            <button className="btn btn-outline btn-sm" type="button" onClick={() => updateReport(report.id, 'rejected')}>
                                                Descartar
                                            </button>
                                        ) : null}
                                    </div>
                                </article>
                            )) : <p className="adminx-empty">No hay reportes para este filtro.</p>}
                        </div>
                    </section>
                </section>
            </div>
        </main>
    );
}


