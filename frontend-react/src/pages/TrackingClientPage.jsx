import { useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import L from 'leaflet';
import { getMercadoLocal } from '../lib/mercadoLocal';
import { resolveImageSrc } from '../lib/assets';
import SafeImage from '../components/SafeImage';
import { buildStraightLineRoute, fetchLocationIqRoute, isValidCoords } from '../lib/locationIqRouting';

const STATUS_LABELS = {
    pedido_realizado: 'Pedido realizado',
    en_transito: 'En tránsito',
    entregado: 'Entregado',
    cancelado_no_show: 'Cancelado (cliente no vino)',
};

const STATUS_ORDER = ['pedido_realizado', 'en_transito', 'entregado'];
const PICKUP_STATUS_ORDER = ['pedido_realizado', 'entregado'];
const DEFAULT_LOCATION = { lat: 16.749, lng: -93.116 };

function normalizeStatus(value) {
    if (value === 'en_transito' || value === 'En tránsito') return 'en_transito';
    if (value === 'entregado' || value === 'Entregado') return 'entregado';
    if (value === 'cancelado_no_show' || value === 'Cancelado (cliente no vino)') return 'cancelado_no_show';
    return 'pedido_realizado';
}

function geoPermissionLabel(permission) {
    if (permission === 'granted') return 'Permiso de ubicacion activo';
    if (permission === 'from_order') return 'Ubicacion tomada del pedido confirmado';
    if (permission === 'denied') return 'Permiso de ubicacion denegado';
    if (permission === 'unsupported') return 'Ubicacion no soportada en este navegador';
    if (permission === 'error') return 'No se pudo obtener tu ubicacion';
    if (permission === 'requesting') return 'Solicitando ubicacion...';
    return 'Ubicacion del cliente: pendiente';
}

function distanceInKm(origin, destination) {
    const toRad = (value) => (value * Math.PI) / 180;
    const earthRadius = 6371;
    const lat1 = toRad(Number(origin.lat));
    const lat2 = toRad(Number(destination.lat));
    const dLat = toRad(Number(destination.lat) - Number(origin.lat));
    const dLng = toRad(Number(destination.lng) - Number(origin.lng));
    const sinLat = Math.sin(dLat / 2);
    const sinLng = Math.sin(dLng / 2);
    const a = (sinLat * sinLat) + (Math.cos(lat1) * Math.cos(lat2) * sinLng * sinLng);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return earthRadius * c;
}

function formatRouteDistance(distanceMeters) {
    if (!Number.isFinite(Number(distanceMeters))) return '--';
    return `${(Number(distanceMeters) / 1000).toFixed(2)} km`;
}

function formatRouteDuration(durationSeconds) {
    if (!Number.isFinite(Number(durationSeconds))) return '--';
    const totalMinutes = Math.max(1, Math.round(Number(durationSeconds) / 60));
    if (totalMinutes < 60) return `${totalMinutes} min`;
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    return minutes ? `${hours} h ${minutes} min` : `${hours} h`;
}

export default function TrackingClientPage() {
    const mercado = getMercadoLocal();
    const [searchParams] = useSearchParams();
    const orderId = searchParams.get('id') || '';
    const token = searchParams.get('token') || '';

    const [order, setOrder] = useState(null);
    const [error, setError] = useState('');
    const [clientLocation, setClientLocation] = useState(null);
    const [clientGeoPermission, setClientGeoPermission] = useState('idle');
    const [routeData, setRouteData] = useState(null);

    const mapRef = useRef(null);
    const markerRef = useRef(null);
    const clientMarkerRef = useRef(null);
    const destinationMarkerRef = useRef(null);
    const routeLineRef = useRef(null);

    const status = useMemo(() => normalizeStatus(order?.status), [order?.status]);
    const isPickup = useMemo(() => String(order?.delivery_method || '').toLowerCase() === 'pickup', [order?.delivery_method]);
    const statusSteps = useMemo(() => (isPickup ? PICKUP_STATUS_ORDER : STATUS_ORDER), [isPickup]);
    const courierLat = Number(order?.location?.lat);
    const courierLng = Number(order?.location?.lng);
    const destinationLat = Number(order?.delivery_location?.lat);
    const destinationLng = Number(order?.delivery_location?.lng);
    const hasCourierPoint = Number.isFinite(courierLat) && Number.isFinite(courierLng);
    const hasDestinationPoint = Number.isFinite(destinationLat) && Number.isFinite(destinationLng);
    const resolvedCourierLat = hasCourierPoint ? courierLat : DEFAULT_LOCATION.lat;
    const resolvedCourierLng = hasCourierPoint ? courierLng : DEFAULT_LOCATION.lng;
    const routeRequestKey = useMemo(() => {
        if (isPickup || !hasDestinationPoint) return '';
        return [
            order?.id || 'none',
            Number(resolvedCourierLat).toFixed(4),
            Number(resolvedCourierLng).toFixed(4),
            Number(destinationLat).toFixed(4),
            Number(destinationLng).toFixed(4),
        ].join(':');
    }, [destinationLat, destinationLng, hasDestinationPoint, isPickup, order?.id, resolvedCourierLat, resolvedCourierLng]);
    const activeRouteData = useMemo(() => {
        if (!routeData || routeData.requestKey !== routeRequestKey) return null;
        return routeData;
    }, [routeData, routeRequestKey]);
    const routeDistanceLabel = useMemo(
        () => formatRouteDistance(activeRouteData?.distanceMeters),
        [activeRouteData]
    );
    const routeDurationLabel = useMemo(
        () => formatRouteDuration(activeRouteData?.durationSeconds),
        [activeRouteData]
    );
    const visibleRouteStatus = useMemo(() => {
        if (isPickup || !hasDestinationPoint) return 'idle';
        if (!activeRouteData) return 'loading';
        return activeRouteData.source === 'locationiq' ? 'ready' : 'fallback';
    }, [activeRouteData, hasDestinationPoint, isPickup]);
    const pickupAddress = String(order?.pickup_point?.location || '').trim();
    const googleEmbedUrl = useMemo(() => {
        if (isPickup) {
            if (pickupAddress) {
                return `https://www.google.com/maps?q=${encodeURIComponent(pickupAddress)}&output=embed`;
            }
            return `https://www.google.com/maps?q=${DEFAULT_LOCATION.lat},${DEFAULT_LOCATION.lng}&z=13&output=embed`;
        }

        const origin = `${Number(resolvedCourierLat)},${Number(resolvedCourierLng)}`;
        if (hasDestinationPoint) {
            const destination = `${Number(destinationLat)},${Number(destinationLng)}`;
            return `https://www.google.com/maps?saddr=${encodeURIComponent(origin)}&daddr=${encodeURIComponent(destination)}&output=embed`;
        }
        return `https://www.google.com/maps?q=${encodeURIComponent(origin)}&z=13&output=embed`;
    }, [destinationLat, destinationLng, hasDestinationPoint, isPickup, pickupAddress, resolvedCourierLat, resolvedCourierLng]);

    useEffect(() => {
        const map = L.map('tracking-map-react', { attributionControl: false }).setView([DEFAULT_LOCATION.lat, DEFAULT_LOCATION.lng], 13);
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(map);

        const icon = L.divIcon({
            className: 'tracking-marker-wrap',
            html: '<div class="tracking-marker">🛵</div>',
            iconSize: [56, 56],
            iconAnchor: [28, 44],
            popupAnchor: [0, -34],
        });

        const marker = L.marker([DEFAULT_LOCATION.lat, DEFAULT_LOCATION.lng], { icon }).addTo(map);
        const destinationMarker = L.marker([DEFAULT_LOCATION.lat, DEFAULT_LOCATION.lng], {
            icon: L.divIcon({
                className: 'tracking-destination-marker-wrap',
                html: '<div class="tracking-destination-marker">🏠</div>',
                iconSize: [44, 44],
                iconAnchor: [22, 38],
                popupAnchor: [0, -30],
            }),
            opacity: 0,
        }).addTo(map);
        const routeLine = L.polyline([], {
            color: '#b47127',
            weight: 5,
            opacity: 0.9,
        }).addTo(map);

        const clientIcon = L.divIcon({
            className: 'tracking-client-marker-wrap',
            html: '<div class="tracking-client-marker">📍</div>',
            iconSize: [44, 44],
            iconAnchor: [22, 38],
            popupAnchor: [0, -30],
        });
        const clientMarker = L.marker([DEFAULT_LOCATION.lat, DEFAULT_LOCATION.lng], {
            icon: clientIcon,
            opacity: 0,
        }).addTo(map);

        mapRef.current = map;
        markerRef.current = marker;
        clientMarkerRef.current = clientMarker;
        destinationMarkerRef.current = destinationMarker;
        routeLineRef.current = routeLine;

        return () => {
            map.remove();
            mapRef.current = null;
            markerRef.current = null;
            clientMarkerRef.current = null;
            destinationMarkerRef.current = null;
            routeLineRef.current = null;
        };
    }, []);

    useEffect(() => {
        let timer = null;

        const loadOrder = async () => {
            if (!orderId) {
                setError('Falta el id del pedido en la URL.');
                return;
            }

            try {
                const response = await mercado.OrdersAPI.getById(orderId, token);
                setOrder(response);
                setError('');
            } catch (loadError) {
                setError(loadError.message || 'No se pudo cargar el pedido.');
            }
        };

        loadOrder();
        timer = window.setInterval(loadOrder, 8000);

        return () => {
            if (timer) window.clearInterval(timer);
        };
    }, [mercado, orderId, token]);

    useEffect(() => {
        if (isPickup || !hasDestinationPoint) return;

        const requestKey = routeRequestKey;
        let cancelled = false;
        const fromPoint = { lat: resolvedCourierLat, lng: resolvedCourierLng };
        const toPoint = { lat: destinationLat, lng: destinationLng };

        fetchLocationIqRoute({
            from: fromPoint,
            to: toPoint,
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
                    ...buildStraightLineRoute(fromPoint, toPoint),
                    requestKey,
                });
            });

        return () => {
            cancelled = true;
        };
    }, [destinationLat, destinationLng, hasDestinationPoint, isPickup, resolvedCourierLat, resolvedCourierLng, routeRequestKey]);

    useEffect(() => {
        if (!order || !mapRef.current || !markerRef.current || !routeLineRef.current || !destinationMarkerRef.current) return;

        const currentStatus = STATUS_LABELS[normalizeStatus(order.status)] || 'Pedido realizado';
        markerRef.current.setLatLng([resolvedCourierLat, resolvedCourierLng]);
        markerRef.current.setPopupContent(`<strong>Estado:</strong> ${currentStatus}`);

        if (hasDestinationPoint) {
            destinationMarkerRef.current.setLatLng([destinationLat, destinationLng]);
            destinationMarkerRef.current.setOpacity(1);
            destinationMarkerRef.current.setPopupContent('<strong>Destino de entrega</strong>');
        } else {
            destinationMarkerRef.current.setOpacity(0);
        }

        const routeCoordinates = activeRouteData?.coordinates?.length
            ? activeRouteData.coordinates
            : hasDestinationPoint
                ? buildStraightLineRoute({ lat: resolvedCourierLat, lng: resolvedCourierLng }, { lat: destinationLat, lng: destinationLng }).coordinates
                : [{ lat: resolvedCourierLat, lng: resolvedCourierLng }];

        routeLineRef.current.setLatLngs(
            routeCoordinates.map((point) => [Number(point.lat), Number(point.lng)])
        );

        const boundsPoints = [...routeCoordinates];
        if (isValidCoords(clientLocation)) boundsPoints.push(clientLocation);

        if (boundsPoints.length > 1) {
            mapRef.current.fitBounds(
                boundsPoints.map((point) => [Number(point.lat), Number(point.lng)]),
                { padding: [40, 40], maxZoom: 15, animate: true }
            );
            return;
        }

        mapRef.current.flyTo([resolvedCourierLat, resolvedCourierLng], Math.max(mapRef.current.getZoom(), 14), {
            animate: true,
            duration: 1,
            easeLinearity: 0.25,
        });
    }, [activeRouteData, clientLocation, destinationLat, destinationLng, hasDestinationPoint, order, resolvedCourierLat, resolvedCourierLng]);

    useEffect(() => {
        if (isPickup || !order || clientLocation) return;
        if (!isValidCoords(order?.delivery_location)) return;

        const coords = {
            lat: Number(order.delivery_location.lat),
            lng: Number(order.delivery_location.lng),
        };
        setClientLocation(coords);
        setClientGeoPermission((prev) => (prev === 'granted' ? prev : 'from_order'));

        if (clientMarkerRef.current) {
            clientMarkerRef.current.setLatLng([coords.lat, coords.lng]);
            clientMarkerRef.current.setOpacity(1);
            clientMarkerRef.current.setPopupContent('<strong>Ubicacion de entrega confirmada</strong>');
        }
    }, [clientLocation, isPickup, order]);

    const requestClientLocation = () => {
        if (!navigator.geolocation) {
            setClientGeoPermission('unsupported');
            mercado.showToast('Tu navegador no soporta geolocalizacion', 'error');
            return;
        }

        setClientGeoPermission('requesting');
        navigator.geolocation.getCurrentPosition(
            (position) => {
                const coords = {
                    lat: Number(position.coords.latitude),
                    lng: Number(position.coords.longitude),
                };
                setClientLocation(coords);
                setClientGeoPermission('granted');

                if (clientMarkerRef.current) {
                    clientMarkerRef.current.setLatLng([coords.lat, coords.lng]);
                    clientMarkerRef.current.setOpacity(1);
                    clientMarkerRef.current.setPopupContent('<strong>Tu ubicacion</strong>');
                }

                mercado.showToast('Ubicacion del cliente activada');
            },
            (locationError) => {
                if (Number(locationError?.code) === 1) {
                    setClientGeoPermission('denied');
                    mercado.showToast('Permiso de ubicacion denegado', 'error');
                    return;
                }
                setClientGeoPermission('error');
                mercado.showToast('No se pudo obtener tu ubicacion', 'error');
            },
            {
                enableHighAccuracy: true,
                timeout: 12000,
                maximumAge: 0,
            }
        );
    };

    const distanceKm = clientLocation && order?.location
        ? distanceInKm(clientLocation, order.location)
        : null;

    return (
        <div className="container page-main tracking-react-page">
            <section className="tracking-head card">
                <div>
                    <h1>Seguimiento del pedido</h1>
                    <p className="tracking-subtitle">Consulta estado y ubicación en tiempo real.</p>
                </div>
                <div className="tracking-order-id">Pedido: <strong>{order?.id || '--'}</strong></div>
            </section>

            {error ? <section className="tracking-error">{error}</section> : null}

                <section className="tracking-grid mt-xl">
                <article className="card tracking-status-card">
                    <h2>Estado actual</h2>
                    <p className={`status-chip status-${status}`}>{STATUS_LABELS[status]}</p>
                    <div className="status-steps">
                        {statusSteps.map((step) => {
                            const currentIndex = statusSteps.indexOf(status);
                            const stepIndex = statusSteps.indexOf(step);
                            const stateClass = stepIndex < currentIndex ? 'done' : stepIndex === currentIndex ? 'active' : '';
                            return (
                                <div key={step} className={`status-step ${stateClass}`}>
                                    <span className="status-dot"></span>
                                    <span>{STATUS_LABELS[step]}</span>
                                </div>
                            );
                        })}
                    </div>
                    <p className="tracking-updated">Última actualización: {order?.updated_at ? mercado.formatDate(order.updated_at) : '--'}</p>
                    <div className="tracking-geo-tools">
                        <button className="btn btn-secondary btn-sm" type="button" onClick={requestClientLocation} disabled={clientGeoPermission === 'requesting'}>
                            {clientGeoPermission === 'requesting' ? 'Solicitando...' : 'Usar mi ubicacion actual'}
                        </button>
                        <p className={`tracking-geo-state geo-${clientGeoPermission}`}>{geoPermissionLabel(clientGeoPermission)}</p>
                        {!isPickup ? (
                            <p className={`tracking-route-state state-${visibleRouteStatus}`}>
                                {visibleRouteStatus === 'loading'
                                    ? 'Calculando ruta real del repartidor...'
                                    : visibleRouteStatus === 'ready'
                                        ? `Ruta activa: ${routeDistanceLabel}${routeDurationLabel !== '--' ? ` · ETA ${routeDurationLabel}` : ''}`
                                        : visibleRouteStatus === 'fallback'
                                            ? 'Mostrando trayecto aproximado mientras se actualiza la ruta.'
                                            : 'Esperando ruta del pedido.'}
                            </p>
                        ) : null}
                        {distanceKm !== null ? (
                            <p className="tracking-distance">Distancia aproximada al pedido: {distanceKm.toFixed(2)} km</p>
                        ) : null}
                    </div>
                </article>

                <article className="card tracking-summary-card">
                    <h2>Resumen del pedido</h2>
                    <div className="order-items">
                        {(order?.items || []).map((item, index) => (
                            <div className="order-item-row" key={`${item.product_id}-${index}`}>
                                <SafeImage
                                    src={resolveImageSrc(item.image, mercado.createPlaceholderImage(item.name || 'Producto'))}
                                    alt={item.name || 'Producto'}
                                    fallback={mercado.createPlaceholderImage(item.name || 'Producto')}
                                    loading="lazy"
                                />
                                <div className="order-item-info">
                                    <strong>{item.name || 'Producto'}</strong>
                                    <span>{item.quantity} x {mercado.formatPrice(item.price)}</span>
                                </div>
                                <strong className="order-item-subtotal">{mercado.formatPrice(Number(item.quantity || 0) * Number(item.price || 0))}</strong>
                            </div>
                        ))}
                    </div>

                    <div className="order-total-row">
                        <span>Total</span>
                        <strong>{mercado.formatPrice(order?.total || 0)}</strong>
                    </div>

                    <div className="order-customer">
                        {isPickup
                            ? `Recogida en tienda: ${order?.pickup_point?.name || 'Tienda local'} · ${order?.pickup_point?.location || 'Ubicación de tienda por confirmar'}`
                            : `Datos de entrega: ${order?.customer?.name || '--'} · ${order?.customer?.phone || '--'} · ${order?.customer?.address || '--'}`}
                    </div>
                </article>
            </section>

            {isPickup ? (
                <section className="card tracking-map-card mt-xl">
                    <h2>Punto de recogida</h2>
                    <p className="tracking-subtitle">
                        Dirección de tienda: <strong>{order?.pickup_point?.location || 'Ubicación de tienda por confirmar'}</strong>
                    </p>
                    <p className="tracking-subtitle">
                        Recoge con tu número de pedido: <strong>{order?.id || '--'}</strong>
                    </p>
                    <div className="tracking-google-block">
                        <div className="tracking-google-head">
                            <strong>Vista Google Maps</strong>
                        </div>
                        <iframe
                            title="Google Maps punto de recogida"
                            src={googleEmbedUrl}
                            className="tracking-google-iframe"
                            loading="lazy"
                            referrerPolicy="no-referrer-when-downgrade"
                        />
                    </div>
                </section>
            ) : (
                <section className="card tracking-map-card mt-xl">
                    <h2>Ubicación del pedido</h2>
                    <div className="map-note">
                        {routeDistanceLabel !== '--'
                            ? `Recorrido restante: ${routeDistanceLabel}${routeDurationLabel !== '--' ? ` · ETA ${routeDurationLabel}` : ''}`
                            : 'Veras el movimiento del repartidor sobre la ruta hacia tu entrega.'}
                    </div>
                    <div id="tracking-map-react" className="tracking-map" aria-label="Mapa de seguimiento" />
                    <div className="tracking-google-block">
                        <div className="tracking-google-head">
                            <strong>Vista Google Maps</strong>
                        </div>
                        <iframe
                            title="Google Maps seguimiento"
                            src={googleEmbedUrl}
                            className="tracking-google-iframe"
                            loading="lazy"
                            referrerPolicy="no-referrer-when-downgrade"
                        />
                    </div>
                </section>
            )}
        </div>
    );
}

