import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { normalizeOrder, sortOrdersByDate } from '../data/demoData';
import { createOrderRequest, listOrders, updateOrderStatusRequest } from '../lib/ordersApi';
import { useSession } from './SessionContext';

const OrdersContext = createContext(null);
const ORDERS_STORAGE_KEY = 'mercado_local_native_orders_cache';

function normalizeOrderList(orderList = []) {
  return sortOrdersByDate((orderList || []).map(normalizeOrder));
}

function buildOrderItems(items = []) {
  return items.map((item) => {
    if (item.product) {
      return {
        productId: item.product.id,
        quantity: item.quantity,
        productName: item.product.name,
        sellerId: item.product.sellerId,
        sellerName: item.product.sellerName,
        categoryLabel: item.product.categoryLabel,
        price: item.product.price,
        subtotal: item.product.price * item.quantity,
      };
    }

    return {
      productId: item.productId,
      quantity: item.quantity,
      productName: item.productName,
      sellerId: item.sellerId,
      sellerName: item.sellerName,
      categoryLabel: item.categoryLabel,
      price: item.price,
      subtotal: item.subtotal ?? Number(item.price || 0) * Number(item.quantity || 0),
    };
  });
}

export function OrdersProvider({ children }) {
  const { guestId, users } = useSession();
  const [orders, setOrders] = useState([]);
  const [ready, setReady] = useState(false);
  const [source, setSource] = useState('remote');

  const persistOrders = useCallback(async (nextOrders) => {
    const normalized = normalizeOrderList(nextOrders);
    setOrders(normalized);
    await AsyncStorage.setItem(ORDERS_STORAGE_KEY, JSON.stringify(normalized));
    return normalized;
  }, []);

  const refreshOrders = useCallback(async () => {
    const remoteOrders = normalizeOrderList(await listOrders());
    setOrders(remoteOrders);
    setSource('remote');
    await AsyncStorage.setItem(ORDERS_STORAGE_KEY, JSON.stringify(remoteOrders));
    return remoteOrders;
  }, []);

  useEffect(() => {
    let active = true;

    async function loadOrders() {
      try {
        const nextOrders = await refreshOrders();
        if (!active) return;
        setOrders(nextOrders);
      } catch {
        if (!active) return;
        setOrders([]);
        setSource('remote');
      } finally {
        if (active) setReady(true);
      }
    }

    loadOrders();
    return () => {
      active = false;
    };
  }, [refreshOrders]);

  const createOrder = useCallback(async (payload) => {
    const requestPayload = {
      ...payload,
      customerId: payload.customerId || guestId || 'guest',
      items: buildOrderItems(payload.items),
    };

    const created = normalizeOrder(await createOrderRequest(requestPayload));
    await persistOrders([created, ...orders]);
    setSource('remote');
    return created;
  }, [guestId, orders, persistOrders]);

  const updateOrderStatus = useCallback(async (orderId, status, overrides = {}) => {
    const currentOrder = orders.find((order) => order.id === orderId);
    const payload = {
      status,
      courierId: overrides.courierId ?? currentOrder?.courierId ?? '',
      courierName: overrides.courierName ?? currentOrder?.courierName ?? '',
      courierLat: overrides.courierLat ?? currentOrder?.courierLat ?? null,
      courierLng: overrides.courierLng ?? currentOrder?.courierLng ?? null,
      locationAt: overrides.locationAt ?? currentOrder?.lastLocationAt ?? '',
    };

    const updatedOrder = normalizeOrder(await updateOrderStatusRequest(orderId, payload));
    const nextOrders = orders.map((order) => (order.id === orderId ? updatedOrder : order));
    await persistOrders(nextOrders);
    setSource('remote');
    return updatedOrder;
  }, [orders, persistOrders]);

  const assignCourier = useCallback(async (orderId, courierId, overrides = {}) => {
    const courier = users.find((item) => item.id === courierId);
    return updateOrderStatus(orderId, 'asignado', {
      courierId: courier?.id || courierId || '',
      courierName: courier?.name || '',
      courierLat: overrides.courierLat,
      courierLng: overrides.courierLng,
      locationAt: overrides.locationAt,
    });
  }, [updateOrderStatus, users]);

  const unassignCourier = useCallback(async (orderId) => {
    return updateOrderStatus(orderId, 'pedido_realizado', { courierId: '', courierName: '' });
  }, [updateOrderStatus]);

  const getOrderById = useCallback((orderId) => orders.find((order) => order.id === orderId) || null, [orders]);
  const getOrdersByCustomer = useCallback((customerId) => (
    sortOrdersByDate(orders.filter((order) => order.customerId === customerId))
  ), [orders]);
  const getOrdersForSeller = useCallback((sellerId) => (
    sortOrdersByDate(orders.filter((order) => (order.items || []).some((item) => item.sellerId === sellerId)))
  ), [orders]);
  const getOrdersForCourier = useCallback((courierId) => (
    sortOrdersByDate(orders.filter((order) => order.deliveryMethod === 'delivery' && (!courierId || order.courierId === courierId)))
  ), [orders]);
  const getAvailableCourierOrders = useCallback(() => (
    sortOrdersByDate(orders.filter((order) => order.deliveryMethod === 'delivery' && !order.courierId && order.status !== 'entregado'))
  ), [orders]);

  const stats = useMemo(() => ({
    orders: orders.length,
    pending: orders.filter((order) => ['pedido_realizado', 'asignado'].includes(order.status)).length,
    transit: orders.filter((order) => order.status === 'en_transito').length,
    pickup: orders.filter((order) => order.deliveryMethod === 'pickup').length,
    delivered: orders.filter((order) => order.status === 'entregado').length,
  }), [orders]);

  const value = useMemo(() => ({
    ready,
    source,
    orders,
    stats,
    refreshOrders,
    createOrder,
    updateOrderStatus,
    assignCourier,
    unassignCourier,
    getOrderById,
    getOrdersByCustomer,
    getOrdersForSeller,
    getOrdersForCourier,
    getAvailableCourierOrders,
  }), [
    ready,
    source,
    orders,
    stats,
    refreshOrders,
    createOrder,
    updateOrderStatus,
    assignCourier,
    unassignCourier,
    getOrderById,
    getOrdersByCustomer,
    getOrdersForSeller,
    getOrdersForCourier,
    getAvailableCourierOrders,
  ]);

  return <OrdersContext.Provider value={value}>{children}</OrdersContext.Provider>;
}

export function useOrders() {
  const context = useContext(OrdersContext);
  if (!context) {
    throw new Error('useOrders debe usarse dentro de OrdersProvider');
  }
  return context;
}
