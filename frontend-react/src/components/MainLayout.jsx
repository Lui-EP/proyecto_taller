import { useEffect, useMemo, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useSession } from '../context/SessionContext';
import { getMercadoLocal } from '../lib/mercadoLocal';

function normalizeOrderStatus(status) {
    if (status === 'en_transito' || status === 'En tránsito' || status === 'En transito') return 'en_transito';
    if (status === 'entregado' || status === 'Entregado') return 'entregado';
    if (status === 'cancelado_no_show' || status === 'Cancelado (cliente no vino)') return 'cancelado_no_show';
    return 'pedido_realizado';
}

export default function MainLayout({ children }) {
    const [menuOpen, setMenuOpen] = useState(false);
    const [mobileOpen, setMobileOpen] = useState(false);
    const [trackingHref, setTrackingHref] = useState('');
    const session = useSession();
    const navigate = useNavigate();
    const location = useLocation();
    const trackingStorageKey = useMemo(
        () => `ml_tracking_href_${String(session.user?.id || 'anon')}`,
        [session.user?.id]
    );

    useEffect(() => {
        let cancelled = false;

        async function loadTrackingOrder() {
            const user = session.user;
            if (!user || user.role !== 'buyer') {
                setTrackingHref('');
                return;
            }

            if (typeof window !== 'undefined') {
                const savedHref = String(window.localStorage.getItem(trackingStorageKey) || '').trim();
                if (savedHref) {
                    setTrackingHref(savedHref);
                }
            }

            try {
                const mercado = getMercadoLocal();
                const response = await mercado.OrdersAPI.getMy();
                if (cancelled) return;

                const list = Array.isArray(response) ? response : [];
                const activeOrder = list
                    .filter((order) => {
                        const status = normalizeOrderStatus(order?.status);
                        const isActiveStatus = status !== 'entregado' && status !== 'cancelado_no_show';
                        const isPickupPending = String(order?.delivery_method || '').toLowerCase() === 'pickup'
                            && String(order?.pickup_status || '').toLowerCase() === 'pendiente_recoleccion';
                        return isActiveStatus || isPickupPending;
                    })
                    .sort((a, b) => new Date(b.updated_at || b.created_at || 0) - new Date(a.updated_at || a.created_at || 0))[0];

                if (!activeOrder?.id) {
                    setTrackingHref('');
                    return;
                }

                const params = new URLSearchParams({ id: activeOrder.id });
                if (activeOrder.tracking_token) {
                    params.set('token', activeOrder.tracking_token);
                }
                const href = `/seguimiento-cliente?${params.toString()}`;
                setTrackingHref(href);
                if (typeof window !== 'undefined') {
                    window.localStorage.setItem(trackingStorageKey, href);
                }
            } catch {
                // Conserva el enlace actual si hay un fallo temporal de red/API
                // para no desaparecer la opción de seguimiento del menú.
            }
        }

        void loadTrackingOrder();

        return () => {
            cancelled = true;
        };
    }, [session.user, session.user?.id, session.user?.role, location.pathname, trackingStorageKey]);

    const links = useMemo(() => {
        const items = [{ to: '/catalogo', matchPath: '/catalogo', label: '🏪 Catálogo' }];

        if (session.user?.role === 'seller') {
            items.push({ to: '/vendedor', matchPath: '/vendedor', label: '📦 Panel Vendedor' });
            items.push({ to: '/vendedor#seguimiento-pedidos', matchPath: '/vendedor', label: '📍 Seguimiento' });
        }

        if (session.user?.role === 'admin') {
            items.push({ to: '/admin', matchPath: '/admin', label: '⚙ Panel Admin' });
        }

        if (['buyer', 'seller', 'admin', 'courier'].includes(session.user?.role || '')) {
            items.push({
                to: '/carrito',
                matchPath: '/carrito',
                label: session.cartCount > 0 ? `🛒 Carrito (${session.cartCount})` : '🛒 Carrito',
            });
        }

        if (session.user?.role === 'buyer') {
            items.push({ to: trackingHref || '/seguimiento-cliente', matchPath: '/seguimiento-cliente', label: '📍 Seguimiento' });
        }

        if (session.user?.role === 'courier') {
            items.push({ to: '/repartidor', matchPath: '/repartidor', label: '🛵 Repartir' });
        }

        if (location.pathname.startsWith('/checkout')) {
            items.push({ to: '/checkout', matchPath: '/checkout', label: '🛒 Pago' });
        }
        return items;
    }, [location.pathname, session.user?.role, session.cartCount, trackingHref]);

    const mobileMenuItems = useMemo(() => {
        const role = session.user?.role;
        const baseItems = [...links];

        if (session.user) {
            baseItems.push({ to: '/favoritos', matchPath: '/favoritos', label: '♥ Favoritos' });
            baseItems.push({ to: '/historial', matchPath: '/historial', label: '🕘 Historial' });
        }

        if (role === 'seller') {
            baseItems.push({ to: '/vendedor', matchPath: '/vendedor', label: '📦 Panel vendedor' });
        }

        if (role === 'admin') {
            baseItems.push({ to: '/admin', matchPath: '/admin', label: '⚙ Panel admin' });
        }

        if (role === 'courier' && !baseItems.some((item) => item.matchPath === '/repartidor')) {
            baseItems.push({ to: '/repartidor', matchPath: '/repartidor', label: '🛵 Repartir' });
        }

        const unique = [];
        const seen = new Set();
        for (const item of baseItems) {
            const key = `${item.matchPath || item.to}|${item.label}`;
            if (seen.has(key)) continue;
            seen.add(key);
            unique.push(item);
        }

        return unique;
    }, [links, session.user]);

    const mobilePrimaryAction = useMemo(() => {
        if (['buyer', 'seller', 'admin', 'courier'].includes(session.user?.role || '')) {
            return {
                to: '/carrito',
                matchPath: '/carrito',
                icon: '🛒',
                label: session.cartCount > 0 ? `Carrito ${session.cartCount}` : 'Carrito',
            };
        }
        if (session.user?.role === 'courier') {
            return { to: '/repartidor', matchPath: '/repartidor', icon: '🛵', label: 'Repartir' };
        }
        if (session.user?.role === 'seller') {
            return { to: '/vendedor', matchPath: '/vendedor', icon: '📦', label: 'Vender' };
        }
        if (session.user?.role === 'admin') {
            return { to: '/admin', matchPath: '/admin', icon: '⚙', label: 'Admin' };
        }
        return { to: '/login', matchPath: '/login', icon: '🔐', label: 'Ingresar' };
    }, [session.user?.role, session.cartCount]);

    const mobileAccountAction = useMemo(() => {
        if (!session.user) return { to: '/registro', matchPath: '/registro', icon: '👤', label: 'Cuenta' };
        if (session.user?.role === 'buyer') {
            return { to: trackingHref || '/seguimiento-cliente', matchPath: '/seguimiento-cliente', icon: '📍', label: 'Seguir' };
        }
        if (session.user?.role === 'courier') {
            return { to: '/historial', matchPath: '/historial', icon: '🕘', label: 'Historial' };
        }
        if (session.user?.role === 'seller') {
            return { to: '/seller', matchPath: '/seller', icon: '🏪', label: 'Perfil' };
        }
        if (session.user?.role === 'admin') {
            return { to: '/historial', matchPath: '/historial', icon: '📊', label: 'Registros' };
        }
        return { to: '/historial', matchPath: '/historial', icon: '🕘', label: 'Historial' };
    }, [session.user, trackingHref]);

    const mobileTabs = useMemo(() => ([
        { to: '/', matchPath: '/', exact: true, icon: '🏠', label: 'Inicio' },
        { to: '/catalogo', matchPath: '/catalogo', icon: '🗂', label: 'Catálogo' },
        { to: '/catalogo', icon: '🔍', label: 'Buscar', isSearch: true, alwaysInactive: true },
        mobilePrimaryAction,
        mobileAccountAction,
    ]), [mobilePrimaryAction, mobileAccountAction]);

    const mobileClientName = useMemo(() => {
        const raw = String(session.user?.name || '').trim();
        if (!raw) return 'Invitado';
        return raw.length > 24 ? `${raw.slice(0, 24)}…` : raw;
    }, [session.user?.name]);

    const closeMobileMenu = () => {
        setMobileOpen(false);
        setMenuOpen(false);
    };

    const isMobileTabActive = (tab) => {
        if (tab.alwaysInactive) return false;
        if (tab.exact) return location.pathname === tab.matchPath;
        return tab.matchPath ? location.pathname.startsWith(tab.matchPath) : false;
    };

    useEffect(() => {
        if (!mobileOpen) return undefined;

        const onKeyDown = (event) => {
            if (event.key === 'Escape') {
                closeMobileMenu();
            }
        };

        const previousOverflow = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
        document.addEventListener('keydown', onKeyDown);

        return () => {
            document.body.style.overflow = previousOverflow;
            document.removeEventListener('keydown', onKeyDown);
        };
    }, [mobileOpen]);

    const onLogout = () => {
        session.logout();
        closeMobileMenu();
        navigate('/inicio');
    };

    return (
        <>
            <header className="header react-header">
                <div className="container header-container">
                    <Link to="/inicio" className="logo" onClick={closeMobileMenu}>
                        <div className="logo-icon">🌾</div>
                        <span className="logo-text">MercadoLocal</span>
                        <span className="logo-mobile-client">{mobileClientName}</span>
                    </Link>

                    <nav className="nav">
                        {links.map((item) => (
                            <Link
                                key={`${item.matchPath}-${item.to}`}
                                to={item.to}
                                className={`nav-link ${location.pathname.startsWith(item.matchPath || item.to) ? 'active' : ''}`}
                            >
                                {item.label}
                            </Link>
                        ))}
                    </nav>

                    <div className="nav-actions">
                        {!session.user ? (
                            <div id="auth-buttons">
                                <Link to="/login" className="btn btn-secondary btn-sm">Iniciar sesión</Link>
                                <Link to="/registro" className="btn btn-primary btn-sm">Registrarse</Link>
                            </div>
                        ) : (
                            <div className="user-menu" id="user-menu">
                                <button className="user-menu-btn" onClick={() => setMenuOpen((prev) => !prev)}>
                                    <div className="user-avatar">{String(session.user.name || 'U').charAt(0).toUpperCase()}</div>
                                    <span id="user-name">{session.user.name}</span>
                                    <span>▾</span>
                                </button>
                                <div className={`user-menu-dropdown ${menuOpen ? 'show' : ''}`} id="user-menu-dropdown">
                                    <Link to="/catalogo" className="dropdown-item" onClick={() => setMenuOpen(false)}>
                                        <span>🏪</span> Catálogo
                                    </Link>
                                    {['buyer', 'seller', 'admin', 'courier'].includes(session.user?.role || '') ? (
                                        <Link to="/carrito" className="dropdown-item" onClick={() => setMenuOpen(false)}>
                                            <span>🛒</span> Carrito {session.cartCount > 0 ? `(${session.cartCount})` : ''}
                                        </Link>
                                    ) : null}
                                    {session.user?.role === 'buyer' ? (
                                        <Link to={trackingHref || '/seguimiento-cliente'} className="dropdown-item" onClick={() => setMenuOpen(false)}>
                                            <span>📍</span> Seguimiento
                                        </Link>
                                    ) : null}
                                    <Link to="/favoritos" className="dropdown-item" onClick={() => setMenuOpen(false)}>
                                        <span>♥</span> Favoritos
                                    </Link>
                                    <Link to="/historial" className="dropdown-item" onClick={() => setMenuOpen(false)}>
                                        <span>🕘</span> Historial
                                    </Link>
                                    {session.user?.role === 'courier' ? (
                                        <Link to="/repartidor" className="dropdown-item" onClick={() => setMenuOpen(false)}>
                                            <span>🛵</span> Repartir
                                        </Link>
                                    ) : null}
                                    {session.user?.role === 'seller' || session.user?.role === 'admin' || session.user?.role === 'courier' ? <div className="dropdown-divider"></div> : null}
                                    {session.user?.role === 'seller' ? (
                                        <Link to="/vendedor" className="dropdown-item" onClick={() => setMenuOpen(false)}>
                                            <span>📦</span> Panel vendedor
                                        </Link>
                                    ) : null}
                                    {session.user?.role === 'seller' ? (
                                        <Link to="/vendedor#seguimiento-pedidos" className="dropdown-item" onClick={() => setMenuOpen(false)}>
                                            <span>📍</span> Seguimiento
                                        </Link>
                                    ) : null}
                                    {session.user?.role === 'admin' ? (
                                        <Link to="/admin" className="dropdown-item" onClick={() => setMenuOpen(false)}>
                                            <span>⚙</span> Panel admin
                                        </Link>
                                    ) : null}
                                    <div className="dropdown-divider"></div>
                                    <button type="button" className="dropdown-item" onClick={onLogout}>
                                        <span>🚪</span> Cerrar sesión
                                    </button>
                                </div>
                            </div>
                        )}

                        <button
                            id="mobile-menu-btn"
                            className={`mobile-menu-btn ${mobileOpen ? 'open' : ''}`}
                            onClick={() => setMobileOpen((prev) => !prev)}
                            aria-label={mobileOpen ? 'Cerrar menú' : 'Abrir menú'}
                            aria-expanded={mobileOpen ? 'true' : 'false'}
                            aria-controls="mobile-drawer"
                        >
                            <span className="mobile-menu-icon" aria-hidden="true">
                                <span></span>
                                <span></span>
                                <span></span>
                            </span>
                        </button>
                    </div>
                </div>
            </header>

            <div className={`mobile-drawer-backdrop ${mobileOpen ? 'show' : ''}`} onClick={closeMobileMenu} />
            <aside id="mobile-drawer" className={`mobile-drawer ${mobileOpen ? 'show' : ''}`} aria-hidden={mobileOpen ? 'false' : 'true'}>
                <div className="mobile-drawer-head">
                    <div className="mobile-drawer-user">
                        <div className="user-avatar">{String(session.user?.name || 'U').charAt(0).toUpperCase()}</div>
                        <div className="mobile-drawer-user-text">
                            <strong>{session.user?.name || 'Invitado'}</strong>
                            <span>{session.user ? 'Cuenta activa' : 'Explora el catálogo'}</span>
                        </div>
                    </div>
                    <button type="button" className="mobile-drawer-close" onClick={closeMobileMenu} aria-label="Cerrar menú">✕</button>
                </div>

                <div className="mobile-drawer-links">
                    {mobileMenuItems.map((item) => (
                        <Link
                            key={`${item.matchPath || item.to}-${item.label}`}
                            to={item.to}
                            className={`mobile-drawer-link ${location.pathname.startsWith(item.matchPath || item.to) ? 'active' : ''}`}
                            onClick={closeMobileMenu}
                        >
                            {item.label}
                        </Link>
                    ))}
                </div>

                {!session.user ? (
                    <div className="mobile-drawer-auth">
                        <Link to="/login" className="btn btn-secondary" onClick={closeMobileMenu}>Iniciar sesión</Link>
                        <Link to="/registro" className="btn btn-primary" onClick={closeMobileMenu}>Registrarse</Link>
                    </div>
                ) : (
                    <button type="button" className="btn btn-outline mobile-drawer-logout" onClick={onLogout}>Cerrar sesión</button>
                )}
            </aside>

            <main className="react-page-content" data-path={location.pathname}>{children}</main>

            <nav className="mobile-bottom-nav" aria-label="Navegación móvil">
                {mobileTabs.map((tab) => (
                    <Link
                        key={`${tab.label}-${tab.to}`}
                        to={tab.to}
                        className={`mobile-bottom-nav-item ${tab.isSearch ? 'mobile-bottom-nav-search' : ''} ${isMobileTabActive(tab) ? 'active' : ''}`}
                        onClick={() => {
                            closeMobileMenu();
                        }}
                    >
                        <span className="mobile-bottom-nav-icon">{tab.icon}</span>
                        <span className="mobile-bottom-nav-label">{tab.label}</span>
                    </Link>
                ))}
            </nav>
        </>
    );
}
