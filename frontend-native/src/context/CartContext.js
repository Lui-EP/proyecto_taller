import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useSession } from './SessionContext';
import { useProducts } from './ProductsContext';
import {
  addCartItem,
  clearCartItems,
  getCart,
  removeCartItem,
  updateCartItem,
} from '../lib/productsApi';

const CartContext = createContext(null);

function normalizeCartItems(rawItems = []) {
  return (rawItems || []).map((item) => ({
    productId: item.product_id || item.productId,
    quantity: Math.max(1, Number(item.quantity || 1)),
  })).filter((item) => item.productId);
}

export function CartProvider({ children }) {
  const { user, ready: sessionReady } = useSession();
  const { getProductById } = useProducts();
  const [items, setItems] = useState([]);
  const [ready, setReady] = useState(false);

  const ownerId = useMemo(() => user?.id || '', [user?.id]);

  const loadCart = useCallback(async () => {
    if (!ownerId) {
      setItems([]);
      return [];
    }
    const payload = await getCart(ownerId);
    const normalized = normalizeCartItems(payload?.items || []);
    setItems(normalized);
    return normalized;
  }, [ownerId]);

  useEffect(() => {
    if (!sessionReady) return;
    let active = true;
    setReady(false);

    loadCart()
      .catch(() => {
        if (active) setItems([]);
      })
      .finally(() => {
        if (active) setReady(true);
      });

    return () => {
      active = false;
    };
  }, [loadCart, sessionReady]);

  const addItem = useCallback(async (productId, quantity = 1) => {
    if (!ownerId) throw new Error('Inicia sesión para agregar al carrito');
    const product = getProductById(productId);
    if (!product) throw new Error('Producto no encontrado');
    await addCartItem(ownerId, productId, quantity);
    await loadCart();
  }, [getProductById, loadCart, ownerId]);

  const updateItem = useCallback(async (productId, quantity) => {
    if (!ownerId) throw new Error('Inicia sesión para editar el carrito');
    const product = getProductById(productId);
    if (!product) return;
    const safeQty = Math.max(1, Math.min(product.stock, Number(quantity || 1)));
    await updateCartItem(ownerId, productId, safeQty);
    await loadCart();
  }, [getProductById, loadCart, ownerId]);

  const removeItem = useCallback(async (productId) => {
    if (!ownerId) throw new Error('Inicia sesión para editar el carrito');
    await removeCartItem(ownerId, productId);
    await loadCart();
  }, [loadCart, ownerId]);

  const clearCart = useCallback(async () => {
    if (!ownerId) throw new Error('Inicia sesión para vaciar el carrito');
    await clearCartItems(ownerId);
    setItems([]);
  }, [ownerId]);

  const detailedItems = useMemo(() => items.map((item) => {
    const product = getProductById(item.productId);
    if (!product) return null;
    const safeQuantity = Math.max(1, Math.min(item.quantity, product.stock || item.quantity));
    return {
      product,
      quantity: safeQuantity,
      subtotal: product.price * safeQuantity,
    };
  }).filter(Boolean), [getProductById, items]);

  const count = detailedItems.reduce((sum, item) => sum + item.quantity, 0);
  const subtotal = detailedItems.reduce((sum, item) => sum + item.subtotal, 0);

  const value = useMemo(() => ({
    ready,
    items: detailedItems,
    rawItems: items,
    count,
    subtotal,
    addItem,
    updateItem,
    removeItem,
    clearCart,
    refreshCart: loadCart,
  }), [addItem, clearCart, count, detailedItems, items, loadCart, ready, removeItem, subtotal, updateItem]);

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
  const context = useContext(CartContext);
  if (!context) {
    throw new Error('useCart debe usarse dentro de CartProvider');
  }
  return context;
}
