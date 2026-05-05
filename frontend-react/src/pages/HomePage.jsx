import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import ProductCard from '../components/ProductCard';
import PageLoader from '../components/PageLoader';
import SafeImage from '../components/SafeImage';
import { getMercadoLocal } from '../lib/mercadoLocal';
import { resolveImageSrc } from '../lib/assets';

const HERO_CAROUSEL_SPEED_PX_PER_SEC = 130;
const CATEGORY_ICONS = {
    Alimentos: '🍯',
    Artesanias: '🎨',
    Textiles: '🧵',
    'Miel y Derivados': '🍯',
    Lacteos: '🧀',
    Conservas: '🥫',
    Cafe: '☕',
    Plantas: '🌱',
    default: '📦',
};

function normalizeCategoryName(name = '') {
    return String(name)
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .trim();
}

function getCategoryIcon(name) {
    const normalized = normalizeCategoryName(name);
    return CATEGORY_ICONS[normalized] || CATEGORY_ICONS.default;
}

function resolveCategoryIcon(category = {}) {
    const custom = String(category?.metafora || '').trim();
    if (custom && custom !== '📦') return custom;
    return getCategoryIcon(category?.name || '');
}

function buildHeroShowcaseProducts(featured, all, maxItems = 12) {
    const list = [];
    const used = new Set();

    for (const item of featured || []) {
        if (!item?.id || used.has(item.id)) continue;
        list.push(item);
        used.add(item.id);
        if (list.length >= maxItems) return list;
    }

    for (const item of all || []) {
        if (!item?.id || used.has(item.id)) continue;
        list.push(item);
        used.add(item.id);
        if (list.length >= maxItems) return list;
    }

    return list;
}

export default function HomePage() {
    const mercado = useMemo(() => getMercadoLocal(), []);

    const [categories, setCategories] = useState([]);
    const [heroProducts, setHeroProducts] = useState([]);
    const [localProducts, setLocalProducts] = useState([]);
    const [totalProducts, setTotalProducts] = useState(0);
    const [loading, setLoading] = useState(true);

    const trackRef = useRef(null);
    const stripRef = useRef(null);
    const rafRef = useRef(null);
    const resumeTimeoutRef = useRef(null);
    const baseWidthRef = useRef(0);
    const stepRef = useRef(240);
    const offsetRef = useRef(0);
    const lastTsRef = useRef(0);

    useEffect(() => {
        let cancelled = false;

        async function loadData() {
            try {
                const [categoriesResp, featuredResp, allResp, localResp] = await Promise.all([
                    mercado.CategoriesAPI.getAll(),
                    mercado.ProductsAPI.getAll({ is_featured: true, limit: 12 }),
                    mercado.ProductsAPI.getAll({ sort_by: 'views', limit: 40 }),
                    mercado.ProductsAPI.getAll({ is_local_handmade: true, limit: 4 }),
                ]);

                if (!cancelled) {
                    const featuredProducts = featuredResp?.products || [];
                    const allProducts = allResp?.products || [];
                    setCategories((categoriesResp || []).slice(0, 8));
                    setHeroProducts(buildHeroShowcaseProducts(featuredProducts, allProducts, 12));
                    setLocalProducts(localResp?.products || []);
                    setTotalProducts(Number(allResp?.total || allProducts.length || 0));
                }
            } catch (error) {
                console.error(error);
                mercado.showToast('No se pudo cargar la pagina de inicio', 'error');
            } finally {
                if (!cancelled) setLoading(false);
            }
        }

        loadData();

        return () => {
            cancelled = true;
        };
    }, [mercado]);

    const applyHeroCarouselTransform = useCallback(() => {
        const strip = stripRef.current;
        if (!strip) return;
        strip.style.transform = `translate3d(${offsetRef.current.toFixed(3)}px, 0, 0)`;
    }, []);

    const normalizeHeroCarouselOffset = useCallback((value) => {
        const baseWidth = baseWidthRef.current;
        if (baseWidth <= 0) return 0;

        let offset = value;
        while (offset <= -baseWidth) offset += baseWidth;
        while (offset > 0) offset -= baseWidth;
        return offset;
    }, []);

    const measureHeroCarousel = useCallback(() => {
        const track = trackRef.current;
        const strip = stripRef.current;
        if (!track || !strip) return false;

        const items = strip.querySelectorAll('.hero-carousel-item');
        if (!items.length) return false;

        const style = window.getComputedStyle(strip);
        const gap = Number.parseFloat(style.columnGap || style.gap || '0') || 0;
        const firstWidth = items[0].getBoundingClientRect().width || 220;
        stepRef.current = firstWidth + gap;

        const baseItems = heroProducts.length;
        if (baseItems > 0 && items.length >= baseItems) {
            let totalWidth = 0;
            for (let index = 0; index < baseItems; index += 1) {
                totalWidth += items[index].getBoundingClientRect().width || firstWidth;
            }
            totalWidth += gap * Math.max(0, baseItems - 1);
            baseWidthRef.current = totalWidth;
        } else {
            baseWidthRef.current = strip.scrollWidth > 0 ? strip.scrollWidth / 2 : 0;
        }

        offsetRef.current = normalizeHeroCarouselOffset(offsetRef.current);
        applyHeroCarouselTransform();
        return baseWidthRef.current > 0;
    }, [heroProducts.length, applyHeroCarouselTransform, normalizeHeroCarouselOffset]);

    const moveHeroCarouselContinuous = useCallback((deltaPx) => {
        if (baseWidthRef.current <= 0) return;
        offsetRef.current = normalizeHeroCarouselOffset(offsetRef.current - deltaPx);
        applyHeroCarouselTransform();
    }, [applyHeroCarouselTransform, normalizeHeroCarouselOffset]);

    const moveHeroCarouselStep = useCallback((direction) => {
        if (baseWidthRef.current <= 0) return;
        offsetRef.current = normalizeHeroCarouselOffset(offsetRef.current - (direction * stepRef.current));
        applyHeroCarouselTransform();
    }, [applyHeroCarouselTransform, normalizeHeroCarouselOffset]);

    const stopHeroCarouselAuto = useCallback(() => {
        if (rafRef.current) {
            cancelAnimationFrame(rafRef.current);
            rafRef.current = null;
        }
    }, []);

    const startHeroCarouselAuto = useCallback(() => {
        stopHeroCarouselAuto();

        if (heroProducts.length <= 1) return;
        if (!measureHeroCarousel()) return;

        lastTsRef.current = performance.now();

        const tick = (ts) => {
            const elapsed = Math.min(64, ts - lastTsRef.current);
            lastTsRef.current = ts;

            if (document.visibilityState === 'visible') {
                const deltaPx = (HERO_CAROUSEL_SPEED_PX_PER_SEC * elapsed) / 1000;
                moveHeroCarouselContinuous(deltaPx);
            }

            rafRef.current = requestAnimationFrame(tick);
        };

        rafRef.current = requestAnimationFrame(tick);
    }, [heroProducts.length, measureHeroCarousel, moveHeroCarouselContinuous, stopHeroCarouselAuto]);

    const pauseHeroCarouselTemporarily = useCallback(() => {
        stopHeroCarouselAuto();
        if (resumeTimeoutRef.current) clearTimeout(resumeTimeoutRef.current);
        resumeTimeoutRef.current = window.setTimeout(() => {
            startHeroCarouselAuto();
        }, 2200);
    }, [startHeroCarouselAuto, stopHeroCarouselAuto]);

    const handleHeroCarouselStep = (direction) => {
        pauseHeroCarouselTemporarily();
        moveHeroCarouselStep(direction);
    };

    useEffect(() => {
        offsetRef.current = 0;

        if (heroProducts.length <= 1) {
            stopHeroCarouselAuto();
            return undefined;
        }

        startHeroCarouselAuto();

        const onResize = () => {
            measureHeroCarousel();
        };

        const onVisibility = () => {
            if (document.visibilityState === 'visible') startHeroCarouselAuto();
            else stopHeroCarouselAuto();
        };

        window.addEventListener('resize', onResize);
        document.addEventListener('visibilitychange', onVisibility);

        return () => {
            stopHeroCarouselAuto();
            if (resumeTimeoutRef.current) {
                clearTimeout(resumeTimeoutRef.current);
                resumeTimeoutRef.current = null;
            }
            window.removeEventListener('resize', onResize);
            document.removeEventListener('visibilitychange', onVisibility);
        };
    }, [heroProducts.length, measureHeroCarousel, startHeroCarouselAuto, stopHeroCarouselAuto]);

    const carouselItems = useMemo(() => {
        if (!heroProducts.length) return [];
        return heroProducts.length > 1 ? [...heroProducts, ...heroProducts] : [...heroProducts];
    }, [heroProducts]);

    const mobileQuickFilters = useMemo(() => ([
        { label: 'Costo', href: '/catalogo?sort_by=price' },
        { label: 'Destacados', href: '/catalogo?featured=true' },
        { label: 'Solo local', href: '/catalogo?local=true' },
        { label: 'Verificados', href: '/catalogo?verified=true' },
    ]), []);

    const mobileCategories = useMemo(() => (
        categories.slice(0, 10).map((category) => ({
            id: category.id,
            name: category.name,
            icon: resolveCategoryIcon(category),
            href: `/catalogo?category=${encodeURIComponent(category.id)}`,
        }))
    ), [categories]);

    const mobileFeatured = useMemo(() => heroProducts.slice(0, 10), [heroProducts]);
    const mobileLocal = useMemo(() => (
        localProducts.length ? localProducts : heroProducts.slice(2, 12)
    ), [localProducts, heroProducts]);

    if (loading) {
        return <PageLoader text="Cargando inicio..." />;
    }

    return (
        <div>
            <section className="home-mobile-shell" aria-label="Inicio movil MercadoLocal">
                <div className="container">
                    <div className="home-mobile-category-row" role="navigation" aria-label="Categorias rapidas">
                        {mobileCategories.length ? mobileCategories.map((category) => (
                            <Link key={category.id} to={category.href} className="home-mobile-category-chip">
                                <span className="home-mobile-category-icon">{category.icon}</span>
                                <span className="home-mobile-category-name">{category.name}</span>
                            </Link>
                        )) : (
                            <div className="home-mobile-empty-inline">No hay categorias disponibles.</div>
                        )}
                    </div>

                    <div className="home-mobile-filter-row" role="navigation" aria-label="Filtros rapidos">
                        {mobileQuickFilters.map((filter) => (
                            <Link key={filter.label} to={filter.href} className="home-mobile-filter-chip">
                                {filter.label}
                            </Link>
                        ))}
                    </div>
                </div>
            </section>

            <section className="home-mobile-block">
                <div className="container">
                    <div className="home-mobile-block-head">
                        <h2>Destacados en MercadoLocal</h2>
                        <Link to="/catalogo?featured=true" className="home-mobile-block-cta">→</Link>
                    </div>

                    <div className="home-mobile-cards-scroll">
                        {mobileFeatured.length ? mobileFeatured.map((product) => {
                            const stock = Math.max(0, Number(product?.stock || 0));
                            return (
                                <Link key={product.id} to={`/producto?id=${encodeURIComponent(product.id)}`} className="home-mobile-card">
                                    <SafeImage
                                        src={resolveImageSrc(product.images?.[0], mercado.createPlaceholderImage(product.name || 'Producto'))}
                                        alt={product.name}
                                        fallback={mercado.createPlaceholderImage(product.name || 'Producto')}
                                        className="home-mobile-card-image"
                                        loading="lazy"
                                    />
                                    <div className="home-mobile-card-content">
                                        <h3>{product.name}</h3>
                                        <p className="home-mobile-card-meta">{mercado.formatPrice(product.price)} · {stock} unidades</p>
                                        <div className="home-mobile-card-tags">
                                            <span>★ {Number(product.average_rating || 0).toFixed(1)}</span>
                                            <span>{product.is_local_handmade ? 'Local' : 'Regional'}</span>
                                        </div>
                                    </div>
                                </Link>
                            );
                        }) : <div className="home-mobile-empty-inline">Aun no hay productos destacados.</div>}
                    </div>
                </div>
            </section>

            <section className="home-mobile-block home-mobile-block-alt">
                <div className="container">
                    <div className="home-mobile-block-head">
                        <h2>Favoritos de la comunidad</h2>
                        <Link to="/catalogo?local=true" className="home-mobile-block-cta">→</Link>
                    </div>

                    <div className="home-mobile-cards-scroll">
                        {mobileLocal.length ? mobileLocal.map((product) => {
                            const stock = Math.max(0, Number(product?.stock || 0));
                            return (
                                <Link key={product.id} to={`/producto?id=${encodeURIComponent(product.id)}`} className="home-mobile-card">
                                    <SafeImage
                                        src={resolveImageSrc(product.images?.[0], mercado.createPlaceholderImage(product.name || 'Producto'))}
                                        alt={product.name}
                                        fallback={mercado.createPlaceholderImage(product.name || 'Producto')}
                                        className="home-mobile-card-image"
                                        loading="lazy"
                                    />
                                    <div className="home-mobile-card-content">
                                        <h3>{product.name}</h3>
                                        <p className="home-mobile-card-meta">{mercado.formatPrice(product.price)} · {stock} unidades</p>
                                        <div className="home-mobile-card-tags">
                                            <span>👁 {product.views || 0}</span>
                                            <span>{product.category?.name || 'Catalogo'}</span>
                                        </div>
                                    </div>
                                </Link>
                            );
                        }) : <div className="home-mobile-empty-inline">Sin productos para mostrar.</div>}
                    </div>
                </div>
            </section>

            <section className="hero">
                <div className="container hero-container">
                    <div className="hero-content">
                        <div className="hero-badge">
                            <span>📍</span>
                            <span>Compra como invitado o crea cuenta en segundos</span>
                        </div>
                        <p className="hero-slogan">Lo que buscas, mas cerca de ti.</p>
                        <h1 className="hero-title">
                            <span className="hero-title-line">Compra facil en</span>
                            <span className="hero-title-line hero-title-accent">tu mercado local</span>
                        </h1>
                        <p className="hero-description">
                            Encuentra productos confiables, compara opciones y apoya negocios de tu region.
                        </p>
                        <div className="hero-buttons">
                            <Link to="/catalogo" className="btn btn-primary btn-lg">Explorar catalogo</Link>
                            <Link to="/registro?role=seller" className="btn btn-secondary btn-sm hero-seller-btn">Comenzar a vender</Link>
                        </div>
                        <div className="hero-inline-stats">
                            <div className="hero-stats-icon">🛒</div>
                            <div>
                                <div className="hero-stats-number">{totalProducts || '50+'}</div>
                                <div className="hero-stats-label">Publicaciones activas</div>
                            </div>
                        </div>
                    </div>

                    <div className="hero-carousel">
                        <div className="hero-carousel-header">
                            <span className="hero-carousel-badge">⭐ Destacados</span>
                            <div className="hero-carousel-controls">
                                <button
                                    className="hero-carousel-btn"
                                    type="button"
                                    onClick={() => handleHeroCarouselStep(-1)}
                                    aria-label="Desplazar a la izquierda"
                                >
                                    ←
                                </button>
                                <button
                                    className="hero-carousel-btn"
                                    type="button"
                                    onClick={() => handleHeroCarouselStep(1)}
                                    aria-label="Desplazar a la derecha"
                                >
                                    →
                                </button>
                            </div>
                        </div>

                        <div
                            ref={trackRef}
                            className="hero-carousel-track"
                            role="region"
                            aria-label="Carrusel de productos destacados"
                            onTouchStart={pauseHeroCarouselTemporarily}
                            onWheel={pauseHeroCarouselTemporarily}
                        >
                            {carouselItems.length ? (
                                <div ref={stripRef} className="hero-carousel-strip">
                                    {carouselItems.map((product, index) => (
                                        <Link
                                            key={`${product.id}-${index}`}
                                            to={`/producto?id=${encodeURIComponent(product.id)}`}
                                            className="hero-carousel-item"
                                        >
                                            <SafeImage
                                                src={resolveImageSrc(product.images?.[0], mercado.createPlaceholderImage(product.name || 'Producto'))}
                                                alt={product.name}
                                                fallback={mercado.createPlaceholderImage(product.name || 'Producto')}
                                                className="hero-carousel-image"
                                                loading="lazy"
                                            />
                                            <div className="hero-carousel-content">
                                                <p className="hero-carousel-category">{product.category?.name || 'Producto local'}</p>
                                                <h3 className="hero-carousel-name">{product.name}</h3>
                                                <p className="hero-carousel-price">{mercado.formatPrice(product.price)}</p>
                                            </div>
                                        </Link>
                                    ))}
                                </div>
                            ) : (
                                <div className="hero-carousel-placeholder">Aun no hay destacados.</div>
                            )}
                        </div>
                    </div>
                </div>
            </section>

            <section className="categories categories-top">
                <div className="container">
                    <div className="section-header">
                        <h2 className="section-title">Categorias</h2>
                        <Link to="/catalogo" className="view-all">
                            Ver todas <span>→</span>
                        </Link>
                    </div>
                    <div className="categories-grid">
                        {categories.length ? categories.map((category) => (
                            <Link
                                key={category.id}
                                to={`/catalogo?category=${encodeURIComponent(category.id)}`}
                                className="category-card"
                            >
                                <div className="category-icon">{resolveCategoryIcon(category)}</div>
                                <span className="category-name">{category.name}</span>
                            </Link>
                        )) : <p className="text-center text-muted grid-full">No hay categorias disponibles</p>}
                    </div>
                </div>
            </section>

            <section className="features">
                <div className="container">
                    <div className="features-grid">
                        <div className="feature-card">
                            <div className="feature-icon">💳</div>
                            <h3 className="feature-title">Compra segura</h3>
                            <p className="feature-description">Informacion clara de cada producto y vendedores verificados.</p>
                        </div>
                        <div className="feature-card">
                            <div className="feature-icon">🚚</div>
                            <h3 className="feature-title">Entrega coordinada</h3>
                            <p className="feature-description">Contacto rapido con el vendedor para acordar entrega.</p>
                        </div>
                        <div className="feature-card">
                            <div className="feature-icon">📈</div>
                            <h3 className="feature-title">Impulso local</h3>
                            <p className="feature-description">Cada compra fortalece negocios y familias de la region.</p>
                        </div>
                    </div>
                </div>
            </section>

            <section className="products-section alt">
                <div className="container">
                    <div className="section-header">
                        <div>
                            <span className="section-badge">✦ Hecho local</span>
                            <h2 className="section-title">Productos locales y artesanales</h2>
                        </div>
                        <Link to="/catalogo?local=true" className="view-all">
                            Ver todos <span>→</span>
                        </Link>
                    </div>
                    <div className="products-grid">
                        {localProducts.length ? localProducts.map((product) => (
                            <ProductCard key={product.id} product={product} />
                        )) : (
                            <div className="empty-state grid-full">
                                <div className="empty-state-icon">✦</div>
                                <h3 className="empty-state-title">Sin productos locales</h3>
                                <p className="empty-state-description">Pronto habra productos artesanales disponibles.</p>
                            </div>
                        )}
                    </div>
                </div>
            </section>
        </div>
    );
}

