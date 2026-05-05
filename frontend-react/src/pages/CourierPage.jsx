import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { getMercadoLocal } from '../lib/mercadoLocal';
import { buildStraightLineRoute, fetchLocationIqRoute, isValidCoords } from '../lib/locationIqRouting';

const STATUS_LABELS = {
    pedido_realizado: 'Pedido realizado',
    en_transito: 'En transito',
    entregado: 'Entregado',
};
const ACTIVE_COURIER_STATUSES = new Set(['pedido_realizado', 'asignado', 'en_transito', 'listo_recoger']);

const BASE_LOCATION = { lat: 16.749, lng: -93.116 };

function normalizeStatus(status) {
    if (status === 'en_transito' || status === 'En transito') return 'en_transito';
    if (status === 'entregado' || status === 'Entregado') return 'entregado';
    return 'pedido_realizado';
}

function geoPermissionLabel(permission) {
    if (permission === 'granted') return 'Permiso de ubicacion: activo';
    if (permission === 'denied') return 'Permiso de ubicacion: denegado';
    if (permission === 'unsupported') return 'Ubicacion no soportada en este navegador';
    if (permission === 'error') return 'No se pudo leer la ubicacion';
    if (permission === 'requesting') return 'Solicitando ubicacion...';
    return 'Permiso de ubicacion: pendiente';
}

function distanceInKm(from, to) {
    if (!isValidCoords(from) || !isValidCoords(to)) return null;
    const lat1 = Number(from.lat);
    const lng1 = Number(from.lng);
    const lat2 = Number(to.lat);
    const lng2 = Number(to.lng);
    const toRad = (value) => (value * Math.PI) / 180;
    const dLat = toRad(lat2 - lat1);
    const dLng = toRad(lng2 - lng1);
    const a = Math.sin(dLat / 2) ** 2
        + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return 6371 * c;
}

function getOrderDestination(order) {
    if (isValidCoords(order?.delivery_location)) {
        return {
            lat: Number(order.delivery_location.lat),
            lng: Number(order.delivery_location.lng),
        };
    }
    if (isValidCoords(order?.location)) {
        return {
            lat: Number(order.location.lat),
            lng: Number(order.location.lng),
        };
    }
    return null;
}

function formatRouteDistance(distanceMeters, fallbackDistanceKm = null) {
    if (Number.isFinite(Number(distanceMeters))) {
        return `${(Number(distanceMeters) / 1000).toFixed(2)} km`;
    }
    if (Number.isFinite(Number(fallbackDistanceKm))) {
        return `${Number(fallbackDistanceKm).toFixed(2)} km`;
    }
    return '--';
}

function formatRouteDuration(durationSeconds) {
    if (!Number.isFinite(Number(durationSeconds))) return '--';
    const totalMinutes = Math.max(1, Math.round(Number(durationSeconds) / 60));
    if (totalMinutes < 60) return `${totalMinutes} min`;
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    return minutes ? `${hours} h ${minutes} min` : `${hours} h`;
}

function sortOrdersByPriority(orders, courierLocation, currentUserId) {
    return [...orders]
        .map((order) => {
            const destination = getOrderDestination(order);
            const distanceKm = courierLocation && destination ? distanceInKm(courierLocation, destination) : null;
            const status = normalizeStatus(order.status);
            const isMine = Boolean(order.courier_id && order.courier_id === currentUserId);
            const isAvailable = !order.courier_id && ACTIVE_COURIER_STATUSES.has(status);
            const isActive = ACTIVE_COURIER_STATUSES.has(status);
            return {
                ...order,
                _meta: {
                    distanceKm,
                    status,
                    isMine,
                    isAvailable,
                    isActive,
                },
            };
        })
        .sort((a, b) => {
            const statusPriority = (value) => {
                if (value === 'en_transito') return 0;
                if (value === 'pedido_realizado') return 1;
                return 2;
            };
            const ownerPriority = (item) => {
                if (item._meta.isMine) return 0;
                if (item._meta.isAvailable) return 1;
                return 2;
            };

            const byStatus = statusPriority(a._meta.status) - statusPriority(b._meta.status);
            if (byStatus !== 0) return byStatus;

            const byOwner = ownerPriority(a) - ownerPriority(b);
            if (byOwner !== 0) return byOwner;

            const distanceA = Number(a._meta.distanceKm);
            const distanceB = Number(b._meta.distanceKm);
            const hasDistanceA = Number.isFinite(distanceA);
            const hasDistanceB = Number.isFinite(distanceB);
            if (hasDistanceA && hasDistanceB) return distanceA - distanceB;
            if (hasDistanceA) return -1;
            if (hasDistanceB) return 1;
            return new Date(b.created_at) - new Date(a.created_at);
        });
}

export default function CourierPage() {
    const mercado = getMercadoLocal();
    const currentUserId = String(mercado.AppState?.user?.id || '');

    const [orders, setOrders] = useState([]);
    const [selectedOrderId, setSelectedOrderId] = useState('');
    const [selectedProductIndex, setSelectedProductIndex] = useState(0);
    const [ordersFilter, setOrdersFilter] = useState('all');
    const [isRefreshingOrders, setIsRefreshingOrders] = useState(false);
    const [geoPermission, setGeoPermission] = useState('idle');
    const [courierLocation, setCourierLocation] = useState(null);
    const [routeData, setRouteData] = useState(null);
    const watchIdRef = useRef(null);
    const selectedOrderRef = useRef(null);
    const syncInFlightRef = useRef(false);
    const lastSyncRef = useRef({ lat: null, lng: null, at: 0 });

    const sortedOrders = useMemo(
        () => sortOrdersByPriority(orders, courierLocation, currentUserId),
        [orders, courierLocation, currentUserId]
    );
    const filteredOrders = useMemo(() => {
        const activeOnly = sortedOrders.filter((order) => order._meta?.isActive);
        if (ordersFilter === 'available') {
            return activeOnly.filter((order) => order._meta?.isAvailable);
        }
        if (ordersFilter === 'mine') {
            return activeOnly.filter((order) => order._meta?.isMine);
        }
        return activeOnly;
    }, [ordersFilter, sortedOrders]);
    const selectedOrder = useMemo(
        () => filteredOrders.find((item) => item.id === selectedOrderId) || null,
        [filteredOrders, selectedOrderId]
    );
    const selectedStatus = normalizeStatus(selectedOrder?.status);
    const selectedDestination = useMemo(() => getOrderDestination(selectedOrder), [selectedOrder]);
    const selectedDistanceKm = useMemo(
        () => (courierLocation && selectedDestination ? distanceInKm(courierLocation, selectedDestination) : null),
        [courierLocation, selectedDestination]
    );
    const routeRequestKey = useMemo(() => {
        if (!selectedDestination) return '';
        const originPoint = isValidCoords(courierLocation) ? courierLocation : BASE_LOCATION;
        return [
            selectedOrder?.id || 'none',
            Number(originPoint.lat).toFixed(4),
            Number(originPoint.lng).toFixed(4),
            Number(selectedDestination.lat).toFixed(4),
            Number(selectedDestination.lng).toFixed(4),
        ].join(':');
    }, [courierLocation, selectedDestination, selectedOrder?.id]);
    const selectedProduct = useMemo(() => {
        const items = Array.isArray(selectedOrder?.items) ? selectedOrder.items : [];
        if (!items.length) return null;
        const index = Math.min(Math.max(0, selectedProductIndex), items.length - 1);
        return items[index] || null;
    }, [selectedOrder, selectedProductIndex]);
    const activeRouteData = useMemo(() => {
        if (!routeData || routeData.requestKey !== routeRequestKey) return null;
        return routeData;
    }, [routeData, routeRequestKey]);
    const routeStatus = useMemo(() => {
        if (!selectedDestination) return 'idle';
        if (!activeRouteData) return 'loading';
        return activeRouteData.source === 'locationiq' ? 'ready' : 'fallback';
    }, [activeRouteData, selectedDestination]);
    const routeStepsPreview = useMemo(
        () => (activeRouteData?.steps || []).slice(0, 4),
        [activeRouteData]
    );
    const routeDistanceLabel = useMemo(
        () => formatRouteDistance(activeRouteData?.distanceMeters, selectedDistanceKm),
        [activeRouteData, selectedDistanceKm]
    );
    const routeDurationLabel = useMemo(
        () => formatRouteDuration(activeRouteData?.durationSeconds),
        [activeRouteData]
    );
    const googleEmbedUrl = useMemo(() => {
        const originPoint = isValidCoords(courierLocation) ? courierLocation : BASE_LOCATION;
        const origin = `${Number(originPoint.lat)},${Number(originPoint.lng)}`;
        if (selectedDestination) {
            const destination = `${Number(selectedDestination.lat)},${Number(selectedDestination.lng)}`;
            return `https://www.google.com/maps?saddr=${encodeURIComponent(origin)}&daddr=${encodeURIComponent(destination)}&output=embed`;
        }
        return `https://www.google.com/maps?q=${encodeURIComponent(origin)}&z=13&output=embed`;
    }, [courierLocation, selectedDestination]);

    const isMine = Boolean(selectedOrder?.courier_id && selectedOrder.courier_id === currentUserId);
    const isAvailable = Boolean(selectedOrder && !selectedOrder.courier_id);
    const hasRequiredLocation = geoPermission === 'granted';
    const canTakeOrder = Boolean(selectedOrder && isAvailable && selectedStatus !== 'entregado' && hasRequiredLocation);
    const canOperateOrder = Boolean(selectedOrder && isMine && selectedStatus !== 'entregado' && hasRequiredLocation);

    useEffect(() => {
        selectedOrderRef.current = selectedOrder;
    }, [selectedOrder]);

    useEffect(() => {
        if (!filteredOrders.length) {
            if (selectedOrderId) setSelectedOrderId('');
            return;
        }
        const existsInFiltered = filteredOrders.some((item) => item.id === selectedOrderId);
        if (!existsInFiltered) {
            setSelectedOrderId(filteredOrders[0].id);
            setSelectedProductIndex(0);
        }
    }, [filteredOrders, selectedOrderId]);

    useEffect(() => {
        if (!selectedDestination) return;

        const originPoint = isValidCoords(courierLocation) ? courierLocation : BASE_LOCATION;
        const destinationPoint = {
            lat: Number(selectedDestination.lat),
            lng: Number(selectedDestination.lng),
        };
        const requestKey = routeRequestKey;

        let cancelled = false;

        fetchLocationIqRoute({
            from: originPoint,
            to: destinationPoint,
        })
            .then((route) => {
                if (cancelled) return;
                setRouteData({
                    ...route,
                    requestKey,
                });
            })
            .catch(() => {
                if (cancelled) return;
                setRouteData({
                    ...buildStraightLineRoute(originPoint, destinationPoint),
                    requestKey,
                });
            });

        return () => {
            cancelled = true;
        };
    }, [courierLocation, routeRequestKey, selectedDestination]);

    const loadOrders = useCallback(async (silent = true) => {
        try {
            const response = await mercado.OrdersAPI.getAssigned();
            const list = Array.isArray(response) ? response : [];
            setOrders(list);

            const hasSelected = list.some((item) => item.id === selectedOrderId);
            if (!hasSelected) {
                setSelectedOrderId(list[0]?.id || '');
                setSelectedProductIndex(0);
            }
            if (!silent) {
                mercado.showToast('Pedidos actualizados');
            }
        } catch (error) {
            mercado.showToast(error.message || 'No se pudieron cargar pedidos', 'error');
        }
    }, [mercado, selectedOrderId]);

    useEffect(() => {
        loadOrders(true);
        const timer = window.setInterval(() => {
            void loadOrders(true);
        }, 9000);

        return () => {
            window.clearInterval(timer);
        };
    }, [loadOrders]);

    useEffect(() => {
        setSelectedProductIndex(0);
    }, [selectedOrderId]);

    const getCourierPosition = useCallback(() => new Promise((resolve, reject) => {
        if (!navigator.geolocation) {
            reject(new Error('unsupported'));
            return;
        }

        navigator.geolocation.getCurrentPosition(
            (position) => {
                resolve({
                    lat: Number(position.coords.latitude),
                    lng: Number(position.coords.longitude),
                });
            },
            (error) => reject(error),
            {
                enableHighAccuracy: true,
                timeout: 12000,
                maximumAge: 0,
            }
        );
    }), []);

    const captureCourierLocation = useCallback(async (showToast = true) => {
        setGeoPermission((prev) => (prev === 'granted' ? prev : 'requesting'));
        try {
            const coords = await getCourierPosition();
            setCourierLocation(coords);
            setGeoPermission('granted');
            if (showToast) mercado.showToast('Ubicacion del repartidor actualizada');
            return coords;
        } catch (error) {
            if (error?.message === 'unsupported') {
                setGeoPermission('unsupported');
                mercado.showToast('Tu navegador no soporta geolocalizacion', 'error');
                return null;
            }
            if (Number(error?.code) === 1) {
                setGeoPermission('denied');
                mercado.showToast('Debes activar ubicacion para repartir pedidos', 'error');
                return null;
            }
            setGeoPermission('error');
            mercado.showToast('No se pudo obtener ubicacion', 'error');
            return null;
        }
    }, [getCourierPosition, mercado]);

    const syncSelectedOrderLocation = useCallback(async (coords) => {
        const currentOrder = selectedOrderRef.current;
        if (!currentOrder) return;
        if (normalizeStatus(currentOrder.status) === 'entregado') return;
        if (String(currentOrder.courier_id || '') !== currentUserId) return;
        if (syncInFlightRef.current) return;

        const now = Date.now();
        const prevSync = lastSyncRef.current;
        const samePoint = prevSync.lat !== null
            && Math.abs(coords.lat - prevSync.lat) < 0.00004
            && Math.abs(coords.lng - prevSync.lng) < 0.00004;
        if (samePoint && (now - prevSync.at) < 5000) return;

        syncInFlightRef.current = true;
        try {
            const updated = await mercado.OrdersAPI.updateLocation(currentOrder.id, coords.lat, coords.lng);
            setOrders((prev) => prev.map((item) => (item.id === updated.id ? { ...item, ...updated } : item)));
            lastSyncRef.current = { lat: coords.lat, lng: coords.lng, at: Date.now() };

            if (normalizeStatus(updated.status) === 'pedido_realizado') {
                const updatedStatus = await mercado.OrdersAPI.updateStatus(updated.id, 'en_transito');
                setOrders((prev) => prev.map((item) => (item.id === updatedStatus.id ? { ...item, ...updatedStatus } : item)));
            }
        } catch {
            // Silent in watch loop.
        } finally {
            syncInFlightRef.current = false;
        }
    }, [mercado, currentUserId]);

    useEffect(() => {
        if (geoPermission === 'idle') {
            void captureCourierLocation(false);
        }
    }, [geoPermission, captureCourierLocation]);

    useEffect(() => {
        if (geoPermission !== 'granted' || !navigator.geolocation) {
            if (watchIdRef.current !== null) {
                navigator.geolocation.clearWatch(watchIdRef.current);
                watchIdRef.current = null;
            }
            return undefined;
        }

        if (watchIdRef.current !== null) {
            navigator.geolocation.clearWatch(watchIdRef.current);
            watchIdRef.current = null;
        }

        watchIdRef.current = navigator.geolocation.watchPosition(
            (position) => {
                const coords = {
                    lat: Number(position.coords.latitude),
                    lng: Number(position.coords.longitude),
                };
                setCourierLocation(coords);
                void syncSelectedOrderLocation(coords);
            },
            (error) => {
                if (Number(error?.code) === 1) {
                    setGeoPermission('denied');
                    mercado.showToast('Debes activar ubicacion para repartir pedidos', 'error');
                    return;
                }
                setGeoPermission('error');
            },
            {
                enableHighAccuracy: true,
                timeout: 12000,
                maximumAge: 0,
            }
        );

        return () => {
            if (watchIdRef.current !== null && navigator.geolocation) {
                navigator.geolocation.clearWatch(watchIdRef.current);
                watchIdRef.current = null;
            }
        };
    }, [geoPermission, mercado, syncSelectedOrderLocation]);

    const loadOrdersNow = async () => {
        setIsRefreshingOrders(true);
        try {
            await loadOrders(false);
        } finally {
            setIsRefreshingOrders(false);
        }
    };

    const takeOrder = async () => {
        if (!selectedOrder) {
            mercado.showToast('Selecciona un pedido primero', 'error');
            return;
        }
        if (!hasRequiredLocation) {
            mercado.showToast('Activa tu ubicacion para poder tomar pedidos', 'error');
            return;
        }
        try {
            const updated = await mercado.OrdersAPI.assign(selectedOrder.id);
            setOrders((prev) => prev.map((item) => (item.id === updated.id ? { ...item, ...updated } : item)));
            mercado.showToast('Pedido tomado correctamente');
            if (courierLocation) {
                await syncSelectedOrderLocation(courierLocation);
            }
        } catch (error) {
            mercado.showToast(error.message || 'No se pudo tomar el pedido', 'error');
        }
    };

    const updateStatus = async (status) => {
        if (!selectedOrder) {
            mercado.showToast('Selecciona un pedido primero', 'error');
            return;
        }
        if (!isMine) {
            mercado.showToast('Toma el pedido antes de cambiar su estado', 'error');
            return;
        }
        if (!hasRequiredLocation) {
            mercado.showToast('Activa tu ubicacion para continuar con el reparto', 'error');
            return;
        }

        try {
            const updated = await mercado.OrdersAPI.updateStatus(selectedOrder.id, status);
            setOrders((prev) => prev.map((item) => (item.id === updated.id ? { ...item, ...updated } : item)));
            mercado.showToast(`Estado actualizado a ${STATUS_LABELS[normalizeStatus(updated.status)]}`);
        } catch (error) {
            mercado.showToast(error.message || 'No se pudo actualizar estado', 'error');
        }
    };

    const moveToMyLocation = async () => {
        if (!selectedOrder) {
            mercado.showToast('Selecciona un pedido primero', 'error');
            return;
        }
        if (!isMine) {
            mercado.showToast('Toma el pedido para compartir tu ubicacion en tiempo real', 'error');
            return;
        }

        const coords = await captureCourierLocation(false);
        if (!coords) return;
        await syncSelectedOrderLocation(coords);
        mercado.showToast('Ubicacion del pedido actualizada con tu posicion');
    };

    const openTracking = () => {
        if (!selectedOrder) return;
        const params = new URLSearchParams({ id: selectedOrder.id });
        if (selectedOrder.tracking_token) params.set('token', selectedOrder.tracking_token);
        window.open(`/seguimiento-cliente?${params.toString()}`, '_blank', 'noopener,noreferrer');
    };

    const openRouteToCustomer = () => {
        if (!selectedOrder) return;
        const originPoint = isValidCoords(courierLocation) ? courierLocation : BASE_LOCATION;
        if (selectedDestination) {
            const destination = `${Number(selectedDestination.lat)},${Number(selectedDestination.lng)}`;
            const origin = `${Number(originPoint.lat)},${Number(originPoint.lng)}`;
            const url = `https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent(origin)}&destination=${encodeURIComponent(destination)}&travelmode=driving`;
            window.open(url, '_blank', 'noopener,noreferrer');
            return;
        }
        const addressText = String(selectedOrder?.customer?.address || '').trim();
        if (addressText) {
            const origin = `${Number(originPoint.lat)},${Number(originPoint.lng)}`;
            const url = `https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent(origin)}&destination=${encodeURIComponent(addressText)}&travelmode=driving`;
            window.open(url, '_blank', 'noopener,noreferrer');
            return;
        }
        mercado.showToast('Este pedido no tiene direccion destino valida', 'error');
    };


    return (
        <div className="container page-main courier-page">
            <div className="courier-layout">
                <aside className="card orders-panel">
                    <div className="panel-head">
                        <h1>Pedidos para repartir</h1>
                        <button
                            className={`btn btn-sm orders-refresh-btn ${isRefreshingOrders ? 'is-loading' : ''}`}
                            type="button"
                            onClick={loadOrdersNow}
                            disabled={isRefreshingOrders}
                        >
                            <span className="refresh-icon" aria-hidden="true">&#8635;</span>
                            {isRefreshingOrders ? 'Actualizando...' : 'Actualizar'}
                        </button>
                    </div>
                    <p className="panel-subtitle">
                        Se ordenan por cercania en tiempo real para ayudarte a escoger el mas cercano.
                    </p>
                    <div className="orders-filters" role="group" aria-label="Filtros de pedidos">
                        <button
                            type="button"
                            className={`orders-filter-btn ${ordersFilter === 'all' ? 'is-active' : ''}`}
                            onClick={() => setOrdersFilter('all')}
                        >
                            Disponibles + mios
                        </button>
                        <button
                            type="button"
                            className={`orders-filter-btn ${ordersFilter === 'available' ? 'is-active' : ''}`}
                            onClick={() => setOrdersFilter('available')}
                        >
                            Solo disponibles
                        </button>
                        <button
                            type="button"
                            className={`orders-filter-btn ${ordersFilter === 'mine' ? 'is-active' : ''}`}
                            onClick={() => setOrdersFilter('mine')}
                        >
                            Solo mios
                        </button>
                    </div>

                    <div className="orders-list">
                        {filteredOrders.length ? filteredOrders.map((order) => {
                            const status = normalizeStatus(order.status);
                            const distanceLabel = Number.isFinite(Number(order._meta?.distanceKm))
                                ? `${Number(order._meta.distanceKm).toFixed(2)} km`
                                : 'Sin distancia';
                            const productsPreview = (order.items || [])
                                .slice(0, 2)
                                .map((item) => item.name)
                                .filter(Boolean)
                                .join(' | ');
                            const ownerLabel = order._meta?.isMine
                                ? 'Mi pedido'
                                : order._meta?.isAvailable
                                    ? 'Disponible'
                                    : 'Tomado';
                            return (
                                <button
                                    key={order.id}
                                    className={`order-card ${order.id === selectedOrderId ? 'selected' : ''}`}
                                    type="button"
                                    onClick={() => setSelectedOrderId(order.id)}
                                >
                                    <div className="order-card-top">
                                        <strong>{order.id}</strong>
                                        <span className={`order-status status-${status}`}>{STATUS_LABELS[status]}</span>
                                    </div>
                                    <p className="order-card-line">{order.customer?.name || 'Cliente'}</p>
                                    <p className="order-card-line muted">{(order.customer?.address || 'Sin direccion').slice(0, 72)}</p>
                                    <p className="order-card-products">{productsPreview || 'Sin productos cargados'}</p>
                                    <div className="order-card-foot">
                                        <span className={`order-owner ${order._meta?.isMine ? 'is-mine' : order._meta?.isAvailable ? 'is-available' : 'is-taken'}`}>
                                            {ownerLabel}
                                        </span>
                                        <span className="order-distance">{distanceLabel}</span>
                                    </div>
                                    <p className="order-card-total">{mercado.formatPrice(order.total || 0)}</p>
                                </button>
                            );
                        }) : (
                            <p className="empty-state">
                                {ordersFilter === 'available'
                                    ? 'No hay pedidos disponibles en este momento.'
                                    : ordersFilter === 'mine'
                                        ? 'Aun no tienes pedidos tomados.'
                                        : 'No hay pedidos disponibles para repartir.'}
                            </p>
                        )}
                    </div>
                </aside>

                <section className="workspace">
                    <article className="card detail-card">
                        <h2>{selectedOrder ? `Pedido ${selectedOrder.id}` : 'Selecciona un pedido'}</h2>

                        {selectedOrder ? (
                            <div className="detail-body">
                                {!hasRequiredLocation ? (
                                    <div className="geo-required-box">
                                        <strong>Ubicacion obligatoria para repartir</strong>
                                        <p>Activa el permiso para ver que pedido te queda mas cerca y compartir tu trayecto.</p>
                                        <button className="btn btn-primary btn-sm" type="button" onClick={() => captureCourierLocation(true)}>
                                            Activar ubicacion ahora
                                        </button>
                                    </div>
                                ) : null}

                                <p className="detail-status">Estado: {STATUS_LABELS[selectedStatus]}</p>
                                <p>Cliente: {selectedOrder.customer?.name || '--'}</p>
                                <p>Telefono: {selectedOrder.customer?.phone || '--'}</p>
                                <p>Direccion destino: {selectedOrder.customer?.address || '--'}</p>
                                <p>Total: {mercado.formatPrice(selectedOrder.total || 0)}</p>
                                {Number.isFinite(selectedDistanceKm) ? (
                                    <p className="detail-distance">Distancia aproximada: {selectedDistanceKm.toFixed(2)} km</p>
                                ) : null}
                                <div className="route-summary-card">
                                    <div className="route-summary-row">
                                        <span>Ruta sugerida</span>
                                        <strong>{routeDistanceLabel}</strong>
                                    </div>
                                    <div className="route-summary-row">
                                        <span>Tiempo estimado</span>
                                        <strong>{routeDurationLabel}</strong>
                                    </div>
                                    <p className={`route-summary-state state-${routeStatus}`}>
                                        {routeStatus === 'loading'
                                            ? 'Calculando ruta real...'
                                            : routeStatus === 'ready'
                                                ? 'Ruta optimizada con LocationIQ.'
                                                : routeStatus === 'fallback'
                                                    ? 'Mostrando trazo aproximado mientras se actualiza la ruta.'
                                                    : 'Selecciona un pedido para calcular la ruta.'}
                                    </p>
                                    {routeStepsPreview.length ? (
                                        <div className="route-steps">
                                            {routeStepsPreview.map((step, index) => (
                                                <p key={step.id} className="route-step-line">
                                                    <strong>{index + 1}.</strong> {step.instruction}
                                                </p>
                                            ))}
                                        </div>
                                    ) : null}
                                </div>

                                <div className="product-picker">
                                    <p className="product-picker-title">Selecciona el producto a llevar</p>
                                    <div className="product-picker-list">
                                        {(selectedOrder.items || []).map((item, index) => (
                                            <button
                                                key={`${item.product_id || item.name || 'item'}-${index}`}
                                                type="button"
                                                className={`product-chip ${index === selectedProductIndex ? 'is-active' : ''}`}
                                                onClick={() => setSelectedProductIndex(index)}
                                            >
                                                {item.name || `Producto ${index + 1}`} · x{Number(item.quantity || 1)}
                                            </button>
                                        ))}
                                    </div>
                                    {selectedProduct ? (
                                        <div className="product-picked-summary">
                                            <strong>{selectedProduct.name || 'Producto'}</strong>
                                            <span>Cantidad: {Number(selectedProduct.quantity || 1)}</span>
                                            <span>Precio unitario: {mercado.formatPrice(selectedProduct.price || 0)}</span>
                                        </div>
                                    ) : null}
                                </div>

                                <div className="detail-actions">
                                    <button className="btn btn-secondary" type="button" onClick={() => updateStatus('pedido_realizado')} disabled={!canOperateOrder}>Pedido realizado</button>
                                    <button className="btn btn-primary" type="button" onClick={() => updateStatus('en_transito')} disabled={!canOperateOrder}>En transito</button>
                                    <button className="btn btn-sage" type="button" onClick={() => updateStatus('entregado')} disabled={!canOperateOrder}>Entregado</button>
                                </div>

                                <div className="location-actions">
                                    <button className="btn btn-secondary" type="button" onClick={() => captureCourierLocation(true)}>
                                        Activar ubicacion
                                    </button>
                                    <button className="btn btn-primary" type="button" onClick={moveToMyLocation} disabled={!canOperateOrder}>
                                        Compartir mi ubicacion
                                    </button>
                                    <button
                                        className="btn btn-outline"
                                        type="button"
                                        onClick={openTracking}
                                        disabled={!selectedOrder || (!isMine && !selectedOrder.tracking_token)}
                                    >
                                        Abrir seguimiento cliente
                                    </button>
                                    <button
                                        className="btn btn-outline"
                                        type="button"
                                        onClick={openRouteToCustomer}
                                        disabled={!selectedOrder}
                                    >
                                        Ir a domicilio
                                    </button>
                                    <button className="btn btn-primary" type="button" onClick={takeOrder} disabled={!canTakeOrder}>
                                        Tomar pedido
                                    </button>
                                </div>

                                <p className={`geo-status geo-${geoPermission}`}>
                                    {geoPermissionLabel(geoPermission)}
                                </p>
                                {courierLocation ? (
                                    <p className="geo-coords">
                                        Tu ubicacion: {courierLocation.lat.toFixed(5)}, {courierLocation.lng.toFixed(5)}
                                    </p>
                                ) : null}
                                {selectedDestination ? (
                                    <p className="geo-coords">
                                        Destino: {Number(selectedDestination.lat).toFixed(5)}, {Number(selectedDestination.lng).toFixed(5)}
                                    </p>
                                ) : null}
                            </div>
                        ) : null}
                    </article>

                    <article className="card map-card">
                        <h2>Mapa de ruta repartidor - cliente</h2>
                        
                        <p className="map-coords">
                            {selectedOrder
                                ? `Ruta actual: ${routeDistanceLabel}${routeDurationLabel !== '--' ? ` · ETA ${routeDurationLabel}` : ''}`
                                : 'Selecciona un pedido para ver la ruta y distancia'}
                        </p>
                        <div className="map-embed-block">
                            <div className="map-embed-head">
                                <strong>Vista Google Maps</strong>
                            </div>
                            <iframe
                                title="Vista Google Maps reparto"
                                src={googleEmbedUrl}
                                className="map-embed-iframe"
                                loading="lazy"
                                referrerPolicy="no-referrer-when-downgrade"
                            />
                        </div>
                    </article>
                </section>
            </div>
        </div>
    );
}

