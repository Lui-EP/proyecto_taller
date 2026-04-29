import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSession } from './SessionContext';
import { useProducts } from './ProductsContext';

const CartContext = createContext(null);

function buildStorageKey(userId) {
  return `mercado_local_native_cart_${userId || 'guest'}`;
}

export function CartProvider({ children }) {
  const { user, ready: sessionReady } = useSession();
  const { getProductById } = useProducts();
  const [items, setItems] = useState([]);
  const [ready, setReady] = useState(false);

  const storageKey = useMemo(() => buildStorageKey(user?.id), [user?.id]);

  useEffect(() => {
    if (!sessionReady) return;
    let active = true;

    async function loadCart() {
      setReady(false);
      try {
        const [currentRaw, guestRaw] = await Promise.all([
          AsyncStorage.getItem(storageKey),
          user?.id ? AsyncStorage.getItem(buildStorageKey('guest')) : Promise.resolve(null),
        ]);

        let currentItems = currentRaw ? JSON.parse(currentRaw) : [];
        const guestItems = guestRaw ? JSON.parse(guestRaw) : [];

        if (user?.id && guestItems.length) {
          const merged = [...currentItems];
          guestItems.forEach((guestItem) => {
            const existing = merged.find((item) => item.productId === guestItem.productId);
            const product = getProductById(guestItem.productId);
            const safeQty = Math.max(1, Number(guestItem.quantity || 1));
            if (!product) return;
            if (existing) {
              existing.quantity = Math.min(product.stock, existing.quantity + safeQty);
            } else {
              merged.push({ productId: guestItem.productId, quantity: Math.min(product.stock, safeQty) });
            }
          });
          currentItems = merged;
          await AsyncStorage.setItem(storageKey, JSON.stringify(currentItems));
          await AsyncStorage.removeItem(buildStorageKey('guest'));
        }

        if (active) setItems(Array.isArray(currentItems) ? currentItems : []);
      } catch {
        if (active) setItems([]);
      } finally {
        if (active) setReady(true);
      }
    }

    loadCart();
    return () => {
      active = false;
    };
  }, [getProductById, sessionReady, storageKey, user?.id]);

  const persist = async (nextItems) => {
    setItems(nextItems);
    await AsyncStorage.setItem(storageKey, JSON.stringify(nextItems));
  };

  const addItem = async (productId, quantity = 1) => {
    const product = getProductById(productId);
    if (!product) throw new Error('Producto no encontrado');
    const incoming = Math.max(1, Number(quantity || 1));
    const existing = items.find((item) => item.productId === productId);
    const nextItems = existing
      ? items.map((item) => item.productId === productId
        ? { ...item, quantity: Math.min(product.stock, item.quantity + incoming) }
        : item)
      : [...items, { productId, quantity: Math.min(product.stock, incoming) }];
    await persist(nextItems);
  };

  const updateItem = async (productId, quantity) => {
    const product = getProductById(productId);
    if (!product) return;
    const safeQty = Math.max(1, Math.min(product.stock, Number(quantity || 1)));
    const nextItems = items.map((item) => item.productId === productId ? { ...item, quantity: safeQty } : item);
    await persist(nextItems);
  };

  const removeItem = async (productId) => {
    await persist(items.filter((item) => item.productId !== productId));
  };

  const clearCart = async () => {
    await persist([]);
  };

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
  }), [ready, detailedItems, items, count, subtotal]);

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
  const context = useContext(CartContext);
  if (!context) {
    throw new Error('useCart debe usarse dentro de CartProvider');
  }
  return context;
}
