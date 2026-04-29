import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { categories, productImages, products as baseProducts } from '../data/demoData';
import { createProduct as createProductApi, listProducts, updateProduct as updateProductApi } from '../lib/productsApi';

const ProductsContext = createContext(null);
const PRODUCTS_CACHE_KEY = 'mercado_local_native_products_cache';

function resolveProduct(rawProduct) {
  const baseMatch = baseProducts.find((item) => item.id === rawProduct.id) || null;
  const image = rawProduct.imageData
    ? { uri: rawProduct.imageData }
    : productImages[rawProduct.imageKey] || baseMatch?.image || productImages.canastas;

  const category = categories.find((item) => item.id === rawProduct.category);

  return {
    ...(baseMatch || {}),
    ...rawProduct,
    categoryLabel: rawProduct.categoryLabel || category?.label || baseMatch?.categoryLabel || 'General',
    image,
  };
}

function toCachePayload(product) {
  return {
    id: product.id,
    sellerId: product.sellerId,
    sellerName: product.sellerName,
    name: product.name,
    category: product.category,
    categoryLabel: product.categoryLabel,
    price: Number(product.price || 0),
    stock: Number(product.stock || 0),
    description: product.description || '',
    featured: Boolean(product.featured),
    local: product.local !== false,
    verified: product.verified !== false,
    rating: Number(product.rating || 5),
    views: Number(product.views || 0),
    imageKey: product.imageKey || '',
    imageData: product.imageData || '',
    createdAt: product.createdAt || '',
    updatedAt: product.updatedAt || '',
  };
}

function toApiPayload(product) {
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

export function ProductsProvider({ children }) {
  const [products, setProducts] = useState([]);
  const [ready, setReady] = useState(false);
  const [source, setSource] = useState('remote');

  const persistCache = useCallback(async (nextProducts) => {
    const serializable = nextProducts.map(toCachePayload);
    await AsyncStorage.setItem(PRODUCTS_CACHE_KEY, JSON.stringify(serializable));
  }, []);

  const refreshProducts = useCallback(async () => {
    const remoteProducts = await listProducts();
    const resolved = remoteProducts.map(resolveProduct);
    setProducts(resolved);
    setSource('remote');
    await persistCache(remoteProducts);
    return resolved;
  }, [persistCache]);

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
    const nextProducts = [resolveProduct(created), ...products.filter((item) => item.id !== created.id)];
    setProducts(nextProducts);
    setSource('remote');
    await persistCache(nextProducts);
    return nextProducts[0];
  }, [persistCache, products]);

  const updateProduct = useCallback(async (productId, patch) => {
    const updated = await updateProductApi(productId, toApiPayload(patch));
    const resolved = resolveProduct(updated);
    const nextProducts = products.map((product) => product.id === productId ? resolved : product);
    setProducts(nextProducts);
    setSource('remote');
    await persistCache(nextProducts);
    return resolved;
  }, [persistCache, products]);

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
  }), [createProduct, getFeaturedProducts, getLowStockProducts, getProductById, getSellerProducts, products, ready, refreshProducts, source, updateProduct]);

  return <ProductsContext.Provider value={value}>{children}</ProductsContext.Provider>;
}

export function useProducts() {
  const context = useContext(ProductsContext);
  if (!context) {
    throw new Error('useProducts debe usarse dentro de ProductsProvider');
  }
  return context;
}
