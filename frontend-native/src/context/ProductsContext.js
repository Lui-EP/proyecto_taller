import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import {
  createProduct as createProductApi,
  listCategories as listCategoriesApi,
  listProducts,
  updateProduct as updateProductApi,
} from '../lib/productsApi';

const ProductsContext = createContext(null);

function normalizeCategory(category = {}) {
  const labelLower = String(category.name || category.label || '').toLowerCase();
  let defaultIcon = 'cube-outline';
  if (labelLower.includes('artesan')) defaultIcon = 'color-palette-outline';
  else if (labelLower.includes('ropa') || labelLower.includes('textil')) defaultIcon = 'shirt-outline';
  else if (labelLower.includes('comida') || labelLower.includes('alimento') || labelLower.includes('dulce')) defaultIcon = 'restaurant-outline';
  else if (labelLower.includes('bebida') || labelLower.includes('cafe') || labelLower.includes('café')) defaultIcon = 'cafe-outline';
  else if (labelLower.includes('barro') || labelLower.includes('ceramic')) defaultIcon = 'color-fill-outline';

  return {
    id: String(category.id || '').trim(),
    label: String(category.name || category.label || 'General').trim() || 'General',
    icon: category.icon || defaultIcon,
    accent: category.accent || '#fff0da',
  };
}

function buildPlaceholder(name = 'Producto') {
  const label = encodeURIComponent(String(name || 'Producto').trim() || 'Producto');
  return `https://placehold.co/720x720/f2e5cf/6c4724?text=${label}`;
}

function inferImage(rawProduct = {}) {
  const direct = String(rawProduct.imageData || rawProduct.image || rawProduct.image_url || rawProduct.imageUrl || '').trim();
  if (direct) return { uri: direct };
  return { uri: buildPlaceholder(rawProduct.name || 'Producto') };
}

function resolveProduct(rawProduct = {}) {
  return {
    ...rawProduct,
    categoryLabel: rawProduct.categoryLabel || rawProduct.category || 'General',
    image: inferImage(rawProduct),
  };
}

function toApiPayload(product = {}) {
  return {
    seller_id: product.sellerId,
    seller_name: product.sellerName,
    name: product.name,
    category: product.category,
    category_label: product.categoryLabel,
    price: Number(product.price || 0),
    stock: Number(product.stock || 0),
    description: product.description || '',
    featured: Boolean(product.featured),
    local: product.local !== false,
    verified: product.verified !== false,
    rating: Number(product.rating || 5),
    views: Number(product.views || 0),
    image_key: product.imageKey || '',
    image_data: product.imageData || '',
  };
}

function buildCategories(remoteCategories = [], remoteProducts = []) {
  const byId = new Map();
  remoteCategories.forEach((category) => {
    if (category.id) byId.set(category.id, category);
  });
  remoteProducts.forEach((product) => {
    if (!product.category) return;
    if (!byId.has(product.category)) {
      byId.set(product.category, {
        id: product.category,
        label: product.categoryLabel || product.category,
      });
    }
  });

  return [
    { id: 'all', label: 'Todo' },
    ...Array.from(byId.values()).map(normalizeCategory),
  ];
}

export function ProductsProvider({ children }) {
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([{ id: 'all', label: 'Todo' }]);
  const [ready, setReady] = useState(false);
  const [source, setSource] = useState('remote');

  const refreshProducts = useCallback(async () => {
    const [remoteProducts, remoteCategories] = await Promise.all([
      listProducts(),
      listCategoriesApi().catch(() => []),
    ]);
    const resolvedProducts = remoteProducts.map(resolveProduct);
    const resolvedCategories = buildCategories(remoteCategories, resolvedProducts);
    setProducts(resolvedProducts);
    setCategories(resolvedCategories);
    setSource('remote');
    return resolvedProducts;
  }, []);

  useEffect(() => {
    let active = true;

    async function loadProducts() {
      try {
        const nextProducts = await refreshProducts();
        if (!active) return;
        setProducts(nextProducts);
      } catch {
        if (!active) return;
        setProducts([]);
        setCategories([{ id: 'all', label: 'Todo' }]);
        setSource('remote');
      } finally {
        if (active) setReady(true);
      }
    }

    loadProducts();
    return () => {
      active = false;
    };
  }, [refreshProducts]);

  const getProductById = useCallback((productId) => products.find((product) => product.id === productId) || null, [products]);
  const getFeaturedProducts = useCallback(() => products.filter((product) => product.featured), [products]);
  const getLowStockProducts = useCallback((threshold = 10) => products.filter((product) => product.stock <= threshold), [products]);
  const getSellerProducts = useCallback((sellerId) => products.filter((product) => product.sellerId === sellerId), [products]);

  const createProduct = useCallback(async (payload) => {
    const created = await createProductApi(toApiPayload(payload));
    const resolved = resolveProduct(created);
    const nextProducts = [resolved, ...products.filter((item) => item.id !== created.id)];
    setProducts(nextProducts);
    setCategories((prev) => buildCategories(prev.filter((c) => c.id !== 'all'), nextProducts));
    setSource('remote');
    return resolved;
  }, [products]);

  const updateProduct = useCallback(async (productId, patch) => {
    const updated = await updateProductApi(productId, toApiPayload(patch));
    const resolved = resolveProduct(updated);
    const nextProducts = products.map((product) => (product.id === productId ? resolved : product));
    setProducts(nextProducts);
    setCategories((prev) => buildCategories(prev.filter((c) => c.id !== 'all'), nextProducts));
    setSource('remote');
    return resolved;
  }, [products]);

  const value = useMemo(() => ({
    ready,
    source,
    products,
    categories,
    getProductById,
    getFeaturedProducts,
    getLowStockProducts,
    getSellerProducts,
    refreshProducts,
    createProduct,
    updateProduct,
  }), [categories, createProduct, getFeaturedProducts, getLowStockProducts, getProductById, getSellerProducts, products, ready, refreshProducts, source, updateProduct]);

  return <ProductsContext.Provider value={value}>{children}</ProductsContext.Provider>;
}

export function useProducts() {
  const context = useContext(ProductsContext);
  if (!context) {
    throw new Error('useProducts debe usarse dentro de ProductsProvider');
  }
  return context;
}
