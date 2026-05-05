import { useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import ProductCard from '../components/ProductCard';
import { getMercadoLocal } from '../lib/mercadoLocal';

const DEFAULT_FILTERS = {
    search: '',
    category_id: '',
    seller_id: '',
    min_price: '',
    max_price: '',
    is_local_handmade: false,
    is_featured: false,
    availability: 'all',
    seller_verified: false,
    sort_by: 'created_at',
    skip: 0,
    limit: 12,
};

const SORT_OPTIONS = [
    { value: 'created_at', label: 'Más recientes' },
    { value: 'price', label: 'Menor precio' },
    { value: 'views', label: 'Más vistos' },
];

function buildFiltersFromSearchParams(searchParams) {
    return {
        ...DEFAULT_FILTERS,
        search: searchParams.get('search') || '',
        category_id: searchParams.get('category') || '',
        seller_id: searchParams.get('seller') || '',
        min_price: toOptionalPrice(searchParams.get('min_price')),
        max_price: toOptionalPrice(searchParams.get('max_price')),
        is_local_handmade: searchParams.get('local') === 'true',
        is_featured: searchParams.get('featured') === 'true',
        availability: searchParams.get('availability') || DEFAULT_FILTERS.availability,
        seller_verified: searchParams.get('verified') === 'true',
        sort_by: searchParams.get('sort_by') || DEFAULT_FILTERS.sort_by,
        skip: toNumber(searchParams.get('skip'), DEFAULT_FILTERS.skip),
    };
}

function areFiltersEqual(current, next) {
    return current.search === next.search
        && current.category_id === next.category_id
        && current.seller_id === next.seller_id
        && current.min_price === next.min_price
        && current.max_price === next.max_price
        && current.is_local_handmade === next.is_local_handmade
        && current.is_featured === next.is_featured
        && current.availability === next.availability
        && current.seller_verified === next.seller_verified
        && current.sort_by === next.sort_by
        && current.skip === next.skip
        && current.limit === next.limit;
}

function toNumber(value, fallback) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
}

function toOptionalPrice(value) {
    if (value === null || value === undefined || value === '') return '';
    const parsed = Number(value);
    if (!Number.isFinite(parsed) || parsed <= 0) return '';
    return String(parsed);
}

function parseOptionalPrice(value) {
    const parsed = Number(value);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

export default function CatalogPage() {
    const mercado = useMemo(() => getMercadoLocal(), []);
    const [searchParams, setSearchParams] = useSearchParams();

    const [categories, setCategories] = useState([]);
    const [products, setProducts] = useState([]);
    const [total, setTotal] = useState(0);
    const [loading, setLoading] = useState(true);
    const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);
    const [sortOpen, setSortOpen] = useState(false);

    const [filters, setFilters] = useState(() => buildFiltersFromSearchParams(searchParams));

    const sortRef = useRef(null);
    const resultsRef = useRef(null);

    useEffect(() => {
        mercado.CategoriesAPI.getAll().then((list) => setCategories(list || [])).catch(() => {
            mercado.showToast('No se pudieron cargar categorías', 'error');
        });
    }, [mercado]);

    useEffect(() => {
        const nextFilters = buildFiltersFromSearchParams(searchParams);
        setFilters((current) => (areFiltersEqual(current, nextFilters) ? current : nextFilters));
    }, [searchParams]);

    useEffect(() => {
        let cancelled = false;

        async function loadProducts() {
            setLoading(true);
            try {
                const minPrice = parseOptionalPrice(filters.min_price);
                const maxPrice = parseOptionalPrice(filters.max_price);
                const params = {
                    sort_by: filters.sort_by,
                    limit: 200,
                    search: filters.search || undefined,
                    category_id: filters.category_id || undefined,
                    seller_id: filters.seller_id || undefined,
                    max_price: maxPrice ?? undefined,
                    is_local_handmade: filters.is_local_handmade ? true : undefined,
                    is_featured: filters.is_featured ? true : undefined,
                };

                const response = await mercado.ProductsAPI.getAll(params);
                const stock = (product) => Math.max(0, Number(product?.stock || 0));

                let list = response.products || [];

                if (filters.seller_verified) {
                    list = list.filter((product) => product.seller?.status === 'verified');
                }

                if (minPrice !== null) {
                    list = list.filter((product) => Number(product.price || 0) >= minPrice);
                }
                if (maxPrice !== null) {
                    list = list.filter((product) => Number(product.price || 0) <= maxPrice);
                }

                if (filters.availability === 'available') {
                    list = list.filter((product) => stock(product) > 0);
                }
                if (filters.availability === 'low') {
                    list = list.filter((product) => stock(product) > 0 && stock(product) <= 10);
                }
                if (filters.availability === 'unavailable') {
                    list = list.filter((product) => stock(product) <= 0);
                }

                const totalFiltered = list.length;
                const pageProducts = list.slice(filters.skip, filters.skip + filters.limit);

                if (!cancelled) {
                    setProducts(pageProducts);
                    setTotal(totalFiltered);
                }
            } catch {
                if (!cancelled) {
                    setProducts([]);
                    setTotal(0);
                }
                mercado.showToast('No se pudieron cargar productos', 'error');
            } finally {
                if (!cancelled) setLoading(false);
            }
        }

        loadProducts();

        const next = new URLSearchParams();
        if (filters.search) next.set('search', filters.search);
        if (filters.category_id) next.set('category', filters.category_id);
        if (filters.seller_id) next.set('seller', filters.seller_id);
        if (parseOptionalPrice(filters.min_price) !== null) next.set('min_price', String(parseOptionalPrice(filters.min_price)));
        if (parseOptionalPrice(filters.max_price) !== null) next.set('max_price', String(parseOptionalPrice(filters.max_price)));
        if (filters.is_local_handmade) next.set('local', 'true');
        if (filters.is_featured) next.set('featured', 'true');
        if (filters.availability !== 'all') next.set('availability', filters.availability);
        if (filters.seller_verified) next.set('verified', 'true');
        if (filters.sort_by !== 'created_at') next.set('sort_by', filters.sort_by);
        if (filters.skip > 0) next.set('skip', String(filters.skip));
        setSearchParams(next, { replace: true });

        return () => {
            cancelled = true;
        };
    }, [filters, mercado, setSearchParams]);

    useEffect(() => {
        const handleClickOutside = (event) => {
            if (!sortRef.current) return;
            if (!sortRef.current.contains(event.target)) {
                setSortOpen(false);
            }
        };

        const handleEscape = (event) => {
            if (event.key === 'Escape') setSortOpen(false);
        };

        document.addEventListener('click', handleClickOutside);
        document.addEventListener('keydown', handleEscape);

        return () => {
            document.removeEventListener('click', handleClickOutside);
            document.removeEventListener('keydown', handleEscape);
        };
    }, []);

    const selectedSort = useMemo(() => (
        SORT_OPTIONS.find((option) => option.value === filters.sort_by) || SORT_OPTIONS[0]
    ), [filters.sort_by]);

    const categoriesWithUncategorized = useMemo(() => {
        const exists = categories.some((category) => String(category?.id || '').trim() === 'sin-categoria');
        if (exists) return categories;
        return [...categories, { id: 'sin-categoria', name: 'Sin categoría' }];
    }, [categories]);

    const mobileCategoryChips = useMemo(() => {
        const list = [{ id: '', name: 'Todos' }];
        for (const category of categoriesWithUncategorized.slice(0, 10)) {
            list.push({ id: category.id, name: category.name });
        }
        return list;
    }, [categoriesWithUncategorized]);

    const activeFilters = useMemo(() => {
        const list = [];
        const categoryName = categoriesWithUncategorized.find((category) => category.id === filters.category_id)?.name;

        if (filters.search) list.push({ key: 'search', label: `Búsqueda: ${filters.search}` });
        if (filters.category_id) list.push({ key: 'category_id', label: `Categoría: ${categoryName || filters.category_id}` });
        const minPrice = parseOptionalPrice(filters.min_price);
        const maxPrice = parseOptionalPrice(filters.max_price);
        if (minPrice !== null) list.push({ key: 'min_price', label: `Precio mín: ${mercado.formatPrice(minPrice)}` });
        if (maxPrice !== null) list.push({ key: 'max_price', label: `Precio máx: ${mercado.formatPrice(maxPrice)}` });
        if (filters.is_local_handmade) list.push({ key: 'is_local_handmade', label: 'Local/Artesanal' });
        if (filters.is_featured) list.push({ key: 'is_featured', label: 'Destacados' });
        if (filters.availability !== 'all') {
            const map = { available: 'Disponibles', low: 'Pocas unidades', unavailable: 'No disponibles' };
            list.push({ key: 'availability', label: `Stock: ${map[filters.availability] || filters.availability}` });
        }
        if (filters.seller_verified) list.push({ key: 'seller_verified', label: 'Vendedor verificado' });

        return list;
    }, [filters, categoriesWithUncategorized, mercado]);

    const totalPages = Math.max(1, Math.ceil(total / filters.limit));
    const currentPage = Math.floor(filters.skip / filters.limit) + 1;

    const removeFilter = (key) => {
        setFilters((prev) => {
            if (key === 'search') return { ...prev, search: '', skip: 0 };
            if (key === 'category_id') return { ...prev, category_id: '', skip: 0 };
            if (key === 'min_price') return { ...prev, min_price: '', skip: 0 };
            if (key === 'max_price') return { ...prev, max_price: '', skip: 0 };
            if (key === 'is_local_handmade') return { ...prev, is_local_handmade: false, skip: 0 };
            if (key === 'is_featured') return { ...prev, is_featured: false, skip: 0 };
            if (key === 'availability') return { ...prev, availability: 'all', skip: 0 };
            if (key === 'seller_verified') return { ...prev, seller_verified: false, skip: 0 };
            return prev;
        });
    };

    const clearFilters = () => {
        setFilters({ ...DEFAULT_FILTERS });
    };

    const goToPage = (page) => {
        const nextPage = Math.min(totalPages, Math.max(1, page));
        setFilters((prev) => ({ ...prev, skip: (nextPage - 1) * prev.limit }));
        if (resultsRef.current) {
            resultsRef.current.scrollTo({ top: 0, behavior: 'smooth' });
        }
    };

    return (
        <main className="catalog-page">
            <div className="container">
                <section className="catalog-mobile-shell" aria-label="Catálogo móvil">
                    <div className="catalog-mobile-topbar">
                        <button
                            type="button"
                            className="catalog-mobile-filterbtn"
                            onClick={() => setMobileFiltersOpen(true)}
                            aria-label="Abrir filtros"
                        >
                            {'\u2699'}
                        </button>
                    </div>

                    <div className="catalog-mobile-chip-row" role="navigation" aria-label="Categorías rápidas">
                        {mobileCategoryChips.map((category) => (
                            <button
                                key={category.id || 'all'}
                                type="button"
                                className={`catalog-mobile-chip ${filters.category_id === category.id ? 'active' : ''}`}
                                onClick={() => setFilters((prev) => ({ ...prev, category_id: category.id, skip: 0 }))}
                            >
                                {category.name}
                            </button>
                        ))}
                    </div>

                    <div className="catalog-mobile-chip-row" role="navigation" aria-label="Filtros rápidos">
                        <button
                            type="button"
                            className={`catalog-mobile-chip ${filters.is_local_handmade ? 'active' : ''}`}
                            onClick={() => setFilters((prev) => ({ ...prev, is_local_handmade: !prev.is_local_handmade, skip: 0 }))}
                        >
                            Local
                        </button>
                        <button
                            type="button"
                            className={`catalog-mobile-chip ${filters.is_featured ? 'active' : ''}`}
                            onClick={() => setFilters((prev) => ({ ...prev, is_featured: !prev.is_featured, skip: 0 }))}
                        >
                            Destacados
                        </button>
                        <button
                            type="button"
                            className={`catalog-mobile-chip ${filters.availability === 'available' ? 'active' : ''}`}
                            onClick={() => setFilters((prev) => ({ ...prev, availability: prev.availability === 'available' ? 'all' : 'available', skip: 0 }))}
                        >
                            Disponibles
                        </button>
                        <button
                            type="button"
                            className={`catalog-mobile-chip ${filters.seller_verified ? 'active' : ''}`}
                            onClick={() => setFilters((prev) => ({ ...prev, seller_verified: !prev.seller_verified, skip: 0 }))}
                        >
                            Verificados
                        </button>
                    </div>
                </section>

                <div className="catalog-header">
                    <h1 className="catalog-title">Catálogo de productos</h1>
                    <p className="catalog-description">Compra local con información clara de stock y vendedor.</p>
                </div>

                <div className="search-bar">
                    <div className="search-input-container">
                        <span className="icon">{'\u{1F50D}'}</span>
                        <input
                            type="text"
                            className="search-input"
                            placeholder="Buscar productos..."
                            value={filters.search}
                            onChange={(event) => setFilters((prev) => ({ ...prev, search: event.target.value, skip: 0 }))}
                        />
                    </div>
                    <button className="btn btn-secondary filter-toggle-btn" onClick={() => setMobileFiltersOpen((value) => !value)}>
                        <span>{'\u2699'}</span> Filtros
                    </button>
                </div>

                <div className="active-filters">
                    {activeFilters.map((item) => (
                        <span className="active-filter" key={item.key}>
                            {item.label}
                            <button onClick={() => removeFilter(item.key)}>{'\u2715'}</button>
                        </span>
                    ))}
                </div>

                <div className="catalog-layout">
                    <aside
                        id="filters-sidebar"
                        className={`filters-sidebar ${mobileFiltersOpen ? 'show' : ''}`}
                        onClick={() => setMobileFiltersOpen(false)}
                    >
                        <div className="filters-card" onClick={(event) => event.stopPropagation()}>
                            <div className="filters-header">
                                <span>{'\u2699'}</span>
                                <span>Filtros</span>
                                <button
                                    type="button"
                                    className="filters-close-mobile"
                                    onClick={() => setMobileFiltersOpen(false)}
                                    aria-label="Cerrar filtros"
                                >
                                    {'\u2715'}
                                </button>
                            </div>

                            <div className="filter-section">
                                <label className="filter-label">Categoría</label>
                                <select
                                    className="filter-select"
                                    value={filters.category_id}
                                    onChange={(event) => setFilters((prev) => ({ ...prev, category_id: event.target.value, skip: 0 }))}
                                >
                                    <option value="">Todas las categorías</option>
                                    {categoriesWithUncategorized.map((category) => (
                                        <option key={category.id} value={category.id}>{category.name}</option>
                                    ))}
                                </select>
                            </div>

                            <div className="filter-section">
                                <label className="filter-label">Rango de precio</label>
                                <div className="price-input-grid">
                                    <div className="price-input-item">
                                        <span>Mínimo</span>
                                        <input
                                            type="number"
                                            min="0"
                                            step="1"
                                            className="filter-select"
                                            placeholder="Sin mínimo"
                                            value={filters.min_price}
                                            onChange={(event) => setFilters((prev) => ({ ...prev, min_price: toOptionalPrice(event.target.value), skip: 0 }))}
                                        />
                                    </div>
                                    <div className="price-input-item">
                                        <span>Máximo</span>
                                        <input
                                            type="number"
                                            min="0"
                                            step="1"
                                            className="filter-select"
                                            placeholder="Sin máximo"
                                            value={filters.max_price}
                                            onChange={(event) => setFilters((prev) => ({ ...prev, max_price: toOptionalPrice(event.target.value), skip: 0 }))}
                                        />
                                    </div>
                                </div>
                                <div className="price-range-display">Déjalos vacíos para no limitar por precio.</div>
                            </div>

                            <div className="filter-section">
                                <label className="filter-checkbox">
                                    <input
                                        type="checkbox"
                                        checked={filters.is_local_handmade}
                                        onChange={(event) => setFilters((prev) => ({ ...prev, is_local_handmade: event.target.checked, skip: 0 }))}
                                    />
                                    <span>Solo productos locales/artesanales</span>
                                </label>
                            </div>

                            <div className="filter-section">
                                <label className="filter-checkbox">
                                    <input
                                        type="checkbox"
                                        checked={filters.is_featured}
                                        onChange={(event) => setFilters((prev) => ({ ...prev, is_featured: event.target.checked, skip: 0 }))}
                                    />
                                    <span>Solo productos destacados</span>
                                </label>
                            </div>

                            <div className="filter-section">
                                <label className="filter-label">Disponibilidad</label>
                                <select
                                    className="filter-select"
                                    value={filters.availability}
                                    onChange={(event) => setFilters((prev) => ({ ...prev, availability: event.target.value, skip: 0 }))}
                                >
                                    <option value="all">Todas</option>
                                    <option value="available">Disponibles</option>
                                    <option value="low">Pocas unidades</option>
                                    <option value="unavailable">No disponibles</option>
                                </select>
                            </div>

                            <div className="filter-section">
                                <label className="filter-checkbox">
                                    <input
                                        type="checkbox"
                                        checked={filters.seller_verified}
                                        onChange={(event) => setFilters((prev) => ({ ...prev, seller_verified: event.target.checked, skip: 0 }))}
                                    />
                                    <span>Solo vendedor verificado</span>
                                </label>
                            </div>

                            <button className="btn btn-secondary btn-sm clear-filters-btn" onClick={clearFilters}>Limpiar filtros</button>
                        </div>
                    </aside>

                    <section className="catalog-results" ref={resultsRef}>
                        <div className="results-header">
                            <span className="results-count">{loading ? 'Cargando productos...' : `${total} producto${total !== 1 ? 's' : ''} encontrado${total !== 1 ? 's' : ''}`}</span>

                            <div id="catalog-sort" className={`catalog-sort ${sortOpen ? 'open' : ''}`} ref={sortRef}>
                                <button
                                    id="sort-dropdown-btn"
                                    type="button"
                                    className="catalog-sort-btn"
                                    aria-haspopup="listbox"
                                    aria-expanded={sortOpen ? 'true' : 'false'}
                                    onClick={() => setSortOpen((value) => !value)}
                                >
                                    <span>{selectedSort.label}</span>
                                    <span className="catalog-sort-arrow">{'\u25BE'}</span>
                                </button>

                                <div id="sort-dropdown-menu" className={`catalog-sort-menu ${sortOpen ? '' : 'hidden'}`} role="listbox" aria-label="Ordenar resultados">
                                    {SORT_OPTIONS.map((option) => {
                                        const isActive = option.value === filters.sort_by;
                                        return (
                                            <button
                                                key={option.value}
                                                type="button"
                                                className={`catalog-sort-option ${isActive ? 'is-active' : ''}`}
                                                role="option"
                                                aria-selected={isActive ? 'true' : 'false'}
                                                onClick={() => {
                                                    setFilters((prev) => ({ ...prev, sort_by: option.value, skip: 0 }));
                                                    setSortOpen(false);
                                                }}
                                            >
                                                {option.label}
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>
                        </div>

                        <div className="catalog-products-grid">
                            {loading ? (
                                <div className="loading grid-full"><div className="spinner"></div></div>
                            ) : products.length ? (
                                products.map((product) => <ProductCard key={product.id} product={product} />)
                            ) : (
                                <div className="empty-state grid-full">
                                    <div className="empty-state-icon">{'\u{1F50D}'}</div>
                                    <h3 className="empty-state-title">No se encontraron productos</h3>
                                    <p className="empty-state-description">Intenta ajustar los filtros o realizar otra búsqueda.</p>
                                    <button className="btn btn-primary" onClick={clearFilters}>Limpiar filtros</button>
                                </div>
                            )}
                        </div>

                        <div className="pagination" id="pagination">
                            {totalPages > 1 ? (
                                <>
                                    {currentPage > 1 ? <button className="btn btn-secondary btn-sm" onClick={() => goToPage(currentPage - 1)}>{'\u2190'} Anterior</button> : null}
                                    <span className="pagination-info">Página {currentPage} de {totalPages}</span>
                                    {currentPage < totalPages ? <button className="btn btn-secondary btn-sm" onClick={() => goToPage(currentPage + 1)}>Siguiente {'\u2192'}</button> : null}
                                </>
                            ) : null}
                        </div>
                    </section>
                </div>
            </div>
        </main>
    );
}
