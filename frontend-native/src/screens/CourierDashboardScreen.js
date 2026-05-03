import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Alert, LayoutAnimation, Linking, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import ScreenContainer from '../components/ScreenContainer';
import FadeInView from '../components/FadeInView';
import MotionPressable from '../components/MotionPressable';
import NativeLocationMap from '../components/NativeLocationMap';
import StatusPill from '../components/StatusPill';
import { formatPrice, getOrderStatusMeta } from '../data/demoData';
import {
  buildRegionFromPoints,
  buildStraightLineRoute,
  distanceKm,
  fetchRoute,
  formatDistance,
  formatDuration,
  isValidCoords,
} from '../lib/locationService';
import { colors, gradients, radius, shadows, spacing, typography } from '../theme';
import { useSession } from '../context/SessionContext';
import { useOrders } from '../context/OrdersContext';
import { useForegroundLocation } from '../hooks/useForegroundLocation';

const tabs = [
  { id: 'available', label: 'Disponibles' },
  { id: 'mine', label: 'Mis entregas' },
];

function getDestinationCoords(order) {
  if (isValidCoords({ lat: order?.addressLat, lng: order?.addressLng })) {
    return { lat: Number(order.addressLat), lng: Number(order.addressLng) };
  }
  return null;
}

function orderDistance(order, courierCoords) {
  const destination = getDestinationCoords(order);
  if (!destination || !courierCoords) return null;
  return distanceKm(courierCoords, destination);
}

export default function CourierDashboardScreen({ navigation }) {
  const { user, logout } = useSession();
  const {
    ready,
    refreshOrders,
    getAvailableCourierOrders,
    getOrdersForCourier,
    assignCourier,
    unassignCourier,
    updateOrderStatus,
  } = useOrders();
  const [activeTab, setActiveTab] = useState('available');
  const [selectedOrderId, setSelectedOrderId] = useState('');
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [routeData, setRouteData] = useState(null);
  const syncRef = useRef({ lat: null, lng: null, at: 0 });
  const selectedOrderRef = useRef(null);
  const courierId = user?.id || 'repartidor-1';

  const {
    coords: courierCoords,
    permissionStatus,
    requestCurrentLocation,
    startWatching,
    stopWatching,
  } = useForegroundLocation();

  const rawAvailableOrders = getAvailableCourierOrders();
  const rawMyOrders = useMemo(
    () => getOrdersForCourier(courierId).filter((order) => order.courierId === courierId && order.status !== 'entregado'),
    [courierId, getOrdersForCourier]
  );
  const deliveredCount = useMemo(
    () => getOrdersForCourier(courierId).filter((order) => order.status === 'entregado').length,
    [courierId, getOrdersForCourier]
  );

  const availableOrders = useMemo(
    () => [...rawAvailableOrders].sort((left, right) => {
      const leftDistance = orderDistance(left, courierCoords);
      const rightDistance = orderDistance(right, courierCoords);
      if (Number.isFinite(leftDistance) && Number.isFinite(rightDistance)) return leftDistance - rightDistance;
      if (Number.isFinite(leftDistance)) return -1;
      if (Number.isFinite(rightDistance)) return 1;
      return new Date(right.createdAt) - new Date(left.createdAt);
    }),
    [courierCoords, rawAvailableOrders]
  );

  const myOrders = useMemo(
    () => [...rawMyOrders].sort((left, right) => {
      const leftDistance = orderDistance(left, courierCoords);
      const rightDistance = orderDistance(right, courierCoords);
      if (left.status === 'en_transito' && right.status !== 'en_transito') return -1;
      if (right.status === 'en_transito' && left.status !== 'en_transito') return 1;
      if (Number.isFinite(leftDistance) && Number.isFinite(rightDistance)) return leftDistance - rightDistance;
      return new Date(right.updatedAt || right.createdAt) - new Date(left.updatedAt || left.createdAt);
    }),
    [courierCoords, rawMyOrders]
  );

  const currentList = activeTab === 'available' ? availableOrders : myOrders;
  const selectedOrder = useMemo(
    () => currentList.find((order) => order.id === selectedOrderId) || currentList[0] || null,
    [currentList, selectedOrderId]
  );

  useEffect(() => {
    selectedOrderRef.current = selectedOrder;
  }, [selectedOrder]);

  useEffect(() => {
    if (!currentList.length) {
      setSelectedOrderId('');
      return;
    }
    if (!currentList.some((order) => order.id === selectedOrderId)) {
      setSelectedOrderId(currentList[0].id);
    }
  }, [currentList, selectedOrderId]);

  const selectedDestination = useMemo(() => getDestinationCoords(selectedOrder), [selectedOrder]);
  const selectedDistanceKm = useMemo(
    () => (courierCoords && selectedDestination ? distanceKm(courierCoords, selectedDestination) : null),
    [courierCoords, selectedDestination]
  );
  const routePoints = routeData?.coordinates?.length
    ? routeData.coordinates
    : courierCoords && selectedDestination
      ? buildStraightLineRoute(courierCoords, selectedDestination).coordinates
      : [];
  const routeDistanceLabel = formatDistance(routeData?.distanceMeters, selectedDistanceKm);
  const routeDurationLabel = formatDuration(routeData?.durationSeconds);

  const mapMarkers = [
    selectedDestination ? {
      key: 'destination',
      lat: selectedDestination.lat,
      lng: selectedDestination.lng,
      title: 'Entrega',
      description: selectedOrder?.addressLabel || selectedOrder?.address,
      pinColor: colors.primary,
    } : null,
    courierCoords ? {
      key: 'courier',
      lat: courierCoords.lat,
      lng: courierCoords.lng,
      title: 'Tu ubicaciÃ³n',
      description: user?.name || 'Repartidor',
      pinColor: colors.accent,
    } : null,
  ].filter(Boolean);

  const mapRegion = buildRegionFromPoints(
    [...mapMarkers.map((marker) => ({ lat: marker.lat, lng: marker.lng })), ...routePoints],
    undefined
  );

  useEffect(() => {
    refreshOrders().catch(() => {});
    const timer = setInterval(() => {
      refreshOrders().catch(() => {});
    }, 9000);
    return () => clearInterval(timer);
  }, [refreshOrders]);

  useEffect(() => {
    requestCurrentLocation().catch(() => {});
  }, [requestCurrentLocation]);

  const syncCourierLocation = useCallback(async (coords) => {
    const order = selectedOrderRef.current;
    if (!order || order.courierId !== courierId || order.status === 'entregado') return;

    const now = Date.now();
    const samePoint = syncRef.current.lat !== null
      && Math.abs(syncRef.current.lat - coords.lat) < 0.00005
      && Math.abs(syncRef.current.lng - coords.lng) < 0.00005;
    if (samePoint && (now - syncRef.current.at) < 5000) return;

    await updateOrderStatus(order.id, order.status, {
      courierId,
      courierName: user?.name || 'Repartidor',
      courierLat: coords.lat,
      courierLng: coords.lng,
      locationAt: new Date().toISOString(),
    }).catch(() => {});

    syncRef.current = {
      lat: coords.lat,
      lng: coords.lng,
      at: Date.now(),
    };
  }, [courierId, updateOrderStatus, user?.name]);

  useEffect(() => {
    let active = true;
    startWatching((coords) => {
      if (!active) return;
      syncCourierLocation(coords).catch(() => {});
    }).catch(() => {});

    return () => {
      active = false;
      stopWatching();
    };
  }, [startWatching, stopWatching, syncCourierLocation]);

  useEffect(() => {
    if (!selectedOrder || !selectedDestination || !courierCoords) {
      setRouteData(null);
      return;
    }
    let active = true;
    fetchRoute({ from: courierCoords, to: selectedDestination }).then((result) => {
      if (active) setRouteData(result);
    });
    return () => {
      active = false;
    };
  }, [courierCoords, selectedDestination, selectedOrder]);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      await refreshOrders();
    } finally {
      setIsRefreshing(false);
    }
  };

  const ensureLocation = async () => {
    const coords = courierCoords || await requestCurrentLocation();
    if (!coords) {
      Alert.alert('UbicaciÃ³n obligatoria', 'Para repartir necesitamos tu ubicaciÃ³n activa.');
      return null;
    }
    return coords;
  };

  const handleAssign = async (order) => {
    const coords = await ensureLocation();
    if (!coords) return;
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    await assignCourier(order.id, courierId, {
      courierLat: coords.lat,
      courierLng: coords.lng,
      locationAt: new Date().toISOString(),
    });
    setActiveTab('mine');
  };

  const handleAdvance = async (order) => {
    const coords = await ensureLocation();
    if (!coords) return;

    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    if (order.status === 'pedido_realizado' || order.status === 'asignado') {
      await updateOrderStatus(order.id, 'en_transito', {
        courierId,
        courierName: user?.name || 'Repartidor',
        courierLat: coords.lat,
        courierLng: coords.lng,
        locationAt: new Date().toISOString(),
      });
      return;
    }
    if (order.status === 'en_transito') {
      await updateOrderStatus(order.id, 'entregado', {
        courierId,
        courierName: user?.name || 'Repartidor',
        courierLat: coords.lat,
        courierLng: coords.lng,
        locationAt: new Date().toISOString(),
      });
    }
  };

  const handleRelease = async (order) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    await unassignCourier(order.id);
  };

  const handleShareNow = async () => {
    const coords = await ensureLocation();
    if (!coords) return;
    await syncCourierLocation(coords);
  };

  const openExternalRoute = async (provider = 'google') => {
    if (!selectedDestination) {
      Alert.alert('Ruta', 'Selecciona un pedido con direccion valida.');
      return;
    }

    const destination = `${Number(selectedDestination.lat)},${Number(selectedDestination.lng)}`;
    const origin = courierCoords ? `${Number(courierCoords.lat)},${Number(courierCoords.lng)}` : '';
    const googleUrl = origin
      ? `https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent(origin)}&destination=${encodeURIComponent(destination)}&travelmode=driving`
      : `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(destination)}&travelmode=driving`;
    const wazeUrl = `https://waze.com/ul?ll=${encodeURIComponent(destination)}&navigate=yes`;
    const targetUrl = provider === 'waze' ? wazeUrl : googleUrl;

    try {
      const canOpen = await Linking.canOpenURL(targetUrl);
      if (!canOpen) {
        Alert.alert('Navegacion', 'No se pudo abrir la app de navegacion.');
        return;
      }
      await Linking.openURL(targetUrl);
    } catch {
      Alert.alert('Navegacion', 'No se pudo abrir la ruta externa.');
    }
  };

  const handleLogout = async () => {
    navigation.navigate('Tabs', { screen: 'Perfil' });
    await logout();
  };

  const locationStatusText = permissionStatus === 'granted'
    ? 'UbicaciÃ³n activa'
    : permissionStatus === 'denied'
      ? 'UbicaciÃ³n denegada'
      : permissionStatus === 'error'
        ? 'No se pudo leer ubicaciÃ³n'
        : 'Pendiente por activar';

  return (
    <ScreenContainer onRefresh={handleRefresh} refreshing={isRefreshing}>
      <FadeInView>
        <LinearGradient colors={gradients.hero} style={styles.heroCard}>
          <Text style={styles.eyebrow}>Repartidor</Text>
          <Text style={styles.title}>Rutas y pedidos desde el celular</Text>
          <Text style={styles.subtitle}>
            La app ya calcula cercanÃ­a, comparte tu posiciÃ³n y deja visible la ruta del pedido para el cliente.
          </Text>

          <View style={styles.heroActions}>
            <MotionPressable style={styles.secondaryAction} onPress={handleRefresh}>
              <Text style={styles.secondaryActionText}>{isRefreshing ? 'Actualizando...' : 'Actualizar'}</Text>
            </MotionPressable>
            <MotionPressable style={styles.secondaryAction} onPress={handleLogout}>
              <Text style={styles.secondaryActionText}>Cerrar sesiÃ³n</Text>
            </MotionPressable>
          </View>

          <View style={styles.locationBadge}>
            <Ionicons name="navigate-outline" size={16} color={colors.primaryDark} />
            <Text style={styles.locationBadgeText}>{locationStatusText}</Text>
          </View>

          <View style={styles.metricsRow}>
            <MetricCard icon="flash-outline" value={`${availableOrders.length}`} label="libres" />
            <MetricCard icon="navigate-outline" value={`${myOrders.length}`} label="mÃ­os" />
            <MetricCard icon="checkmark-circle-outline" value={`${deliveredCount}`} label="cerrados" />
          </View>
        </LinearGradient>
      </FadeInView>

      <FadeInView delay={80}>
        <View style={styles.tabsRow}>
          {tabs.map((tab) => {
            const active = tab.id === activeTab;
            return (
              <MotionPressable
                key={tab.id}
                style={[styles.tabChip, active && styles.tabChipActive]}
                onPress={() => setActiveTab(tab.id)}
              >
                <Text style={[styles.tabChipText, active && styles.tabChipTextActive]}>{tab.label}</Text>
              </MotionPressable>
            );
          })}
        </View>
      </FadeInView>

      <FadeInView delay={140}>
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{activeTab === 'available' ? 'Pedidos para tomar' : 'Pedidos en curso'}</Text>
          <Text style={styles.sectionHelper}>
            {activeTab === 'available'
              ? 'Ya vienen ordenados por cercanÃ­a para que escojas rÃ¡pido el mejor.'
              : 'AquÃ­ controlas el viaje y la app comparte tu ubicaciÃ³n con el cliente.'}
          </Text>
          {currentList.length ? currentList.map((order) => (
            <OrderCard
              key={order.id}
              order={order}
              selected={selectedOrder?.id === order.id}
              distanceKm={orderDistance(order, courierCoords)}
              onPress={() => setSelectedOrderId(order.id)}
              onPrimaryAction={() => activeTab === 'available' ? handleAssign(order) : handleAdvance(order)}
              actionLabel={activeTab === 'available'
                ? 'Tomar pedido'
                : order.status === 'en_transito'
                  ? 'Marcar entregado'
                  : 'Iniciar ruta'}
              onSecondaryAction={activeTab === 'mine' ? () => handleRelease(order) : undefined}
              secondaryLabel={activeTab === 'mine' ? 'Soltar' : ''}
            />
          )) : (
            <Text style={styles.emptyText}>
              {ready
                ? activeTab === 'available'
                  ? 'No hay pedidos libres por ahora.'
                  : 'TodavÃ­a no tienes pedidos asignados.'
                : 'Cargando pedidos...'}
            </Text>
          )}
        </View>
      </FadeInView>

      {selectedOrder ? (
        <>
          <FadeInView delay={190}>
            <View style={styles.card}>
              <View style={styles.cardHeader}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.cardTitle}>{selectedOrder.id}</Text>
                  <Text style={styles.cardText}>Cliente: {selectedOrder.customerName}</Text>
                </View>
                <StatusPill
                  status={selectedOrder.status}
                  icon={getOrderStatusMeta(selectedOrder.status, selectedOrder.deliveryMethod).icon}
                  label={getOrderStatusMeta(selectedOrder.status, selectedOrder.deliveryMethod).label}
                  compact
                />
              </View>

              <Text style={styles.cardText}>Destino: {selectedOrder.addressLabel || selectedOrder.address}</Text>
              <Text style={styles.cardText}>Total: {formatPrice(selectedOrder.total)}</Text>
              {selectedOrder.addressColony ? <Text style={styles.cardText}>Colonia: {selectedOrder.addressColony}</Text> : null}
              {selectedDistanceKm ? <Text style={styles.cardDistance}>Distancia estimada: {selectedDistanceKm.toFixed(2)} km</Text> : null}

              <View style={styles.routeSummary}>
                <SummaryChip icon="navigate-outline" label={`Ruta ${routeDistanceLabel}`} />
                <SummaryChip icon="time-outline" label={`ETA ${routeDurationLabel}`} />
              </View>

              <View style={styles.actionsRow}>
                {activeTab === 'available' ? (
                  <MotionPressable style={styles.primaryButton} onPress={() => handleAssign(selectedOrder)}>
                    <Text style={styles.primaryButtonText}>Tomar pedido</Text>
                  </MotionPressable>
                ) : (
                  <>
                    <MotionPressable style={styles.primaryButton} onPress={() => handleAdvance(selectedOrder)}>
                      <Text style={styles.primaryButtonText}>
                        {selectedOrder.status === 'en_transito' ? 'Marcar entregado' : 'Iniciar ruta'}
                      </Text>
                    </MotionPressable>
                    <MotionPressable style={styles.secondaryButton} onPress={handleShareNow}>
                      <Text style={styles.secondaryButtonText}>Compartir ubicaciÃ³n</Text>
                    </MotionPressable>
                    <MotionPressable style={styles.secondaryButton} onPress={() => openExternalRoute('google')}>
                      <Text style={styles.secondaryButtonText}>Abrir Google Maps</Text>
                    </MotionPressable>
                    <MotionPressable style={styles.secondaryButton} onPress={() => openExternalRoute('waze')}>
                      <Text style={styles.secondaryButtonText}>Abrir Waze</Text>
                    </MotionPressable>
                    <MotionPressable style={styles.secondaryButton} onPress={() => handleRelease(selectedOrder)}>
                      <Text style={styles.secondaryButtonText}>Soltar</Text>
                    </MotionPressable>
                  </>
                )}
              </View>
            </View>
          </FadeInView>

          <FadeInView delay={230}>
            <View style={styles.card}>
              <NativeLocationMap
                title="Ruta actual"
                height={280}
                markers={mapMarkers}
                polyline={routePoints}
                initialRegion={mapRegion}
                helperText={
                  permissionStatus === 'granted'
                    ? 'Mientras el permiso siga activo, tu ubicaciÃ³n se envÃ­a al pedido que estÃ¡s llevando.'
                    : 'Activa la ubicaciÃ³n para que el cliente pueda verte en el mapa.'
                }
              />
            </View>
          </FadeInView>
        </>
      ) : null}
    </ScreenContainer>
  );
}

function OrderCard({
  order,
  selected,
  distanceKm: estimatedDistanceKm,
  onPress,
  onPrimaryAction,
  actionLabel,
  onSecondaryAction,
  secondaryLabel,
}) {
  const status = getOrderStatusMeta(order.status, order.deliveryMethod);
  return (
    <MotionPressable style={[styles.orderCard, selected && styles.orderCardSelected]} onPress={onPress}>
      <View style={styles.cardHeader}>
        <View style={{ flex: 1 }}>
          <Text style={styles.cardTitle}>{order.id}</Text>
          <Text style={styles.cardText}>Cliente: {order.customerName}</Text>
        </View>
        <StatusPill status={order.status} icon={status.icon} label={status.label} compact />
      </View>
      <Text style={styles.cardText}>Destino: {order.addressLabel || order.address}</Text>
      {estimatedDistanceKm ? <Text style={styles.cardDistance}>Aprox. {estimatedDistanceKm.toFixed(2)} km</Text> : null}
      <Text style={styles.cardText}>Total: {formatPrice(order.total)}</Text>
      <View style={styles.orderActions}>
        <MotionPressable style={styles.orderPrimaryButton} onPress={onPrimaryAction}>
          <Text style={styles.orderPrimaryButtonText}>{actionLabel}</Text>
        </MotionPressable>
        {secondaryLabel && onSecondaryAction ? (
          <MotionPressable style={styles.orderSecondaryButton} onPress={onSecondaryAction}>
            <Text style={styles.orderSecondaryButtonText}>{secondaryLabel}</Text>
          </MotionPressable>
        ) : null}
      </View>
    </MotionPressable>
  );
}

function MetricCard({ icon, value, label }) {
  return (
    <View style={styles.metricCard}>
      <Ionicons name={icon} size={18} color={colors.primary} />
      <Text style={styles.metricValue}>{value}</Text>
      <Text style={styles.metricLabel}>{label}</Text>
    </View>
  );
}

function SummaryChip({ icon, label }) {
  return (
    <View style={styles.summaryChip}>
      <Ionicons name={icon} size={16} color={colors.primaryDark} />
      <Text style={styles.summaryChipText}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  heroCard: {
    borderRadius: radius.xl,
    padding: spacing.xl,
    gap: spacing.sm,
    ...shadows.card,
  },
  eyebrow: {
    color: colors.primaryDark,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 1,
    fontSize: typography.tiny,
  },
  title: {
    fontSize: typography.heading,
    fontWeight: '800',
    color: colors.text,
  },
  subtitle: {
    color: colors.textSoft,
    lineHeight: 21,
  },
  heroActions: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  secondaryAction: {
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: 'rgba(255,255,255,0.72)',
    borderRadius: radius.pill,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    alignItems: 'center',
  },
  secondaryActionText: {
    color: colors.text,
    fontWeight: '700',
  },
  locationBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    backgroundColor: 'rgba(255,255,255,0.66)',
    alignSelf: 'flex-start',
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.sm,
    paddingVertical: 6,
  },
  locationBadgeText: {
    color: colors.primaryDark,
    fontWeight: '700',
    fontSize: typography.caption,
  },
  metricsRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  metricCard: {
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.72)',
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    gap: 4,
  },
  metricValue: {
    color: colors.primary,
    fontSize: typography.heading,
    fontWeight: '800',
  },
  metricLabel: {
    color: colors.textSoft,
    fontSize: typography.caption,
  },
  tabsRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.lg,
  },
  tabChip: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: spacing.sm,
    alignItems: 'center',
  },
  tabChipActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  tabChipText: {
    color: colors.text,
    fontWeight: '700',
  },
  tabChipTextActive: {
    color: colors.white,
  },
  section: {
    marginTop: spacing.xl,
    gap: spacing.md,
  },
  sectionTitle: {
    color: colors.text,
    fontSize: typography.subheading,
    fontWeight: '800',
  },
  sectionHelper: {
    color: colors.textSoft,
    lineHeight: 19,
  },
  orderCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    gap: spacing.sm,
    ...shadows.card,
  },
  orderCardSelected: {
    borderColor: colors.primary,
    backgroundColor: '#fff4e1',
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    gap: spacing.sm,
    marginTop: spacing.lg,
    ...shadows.card,
  },
  cardHeader: {
    flexDirection: 'row',
    gap: spacing.md,
    alignItems: 'center',
  },
  cardTitle: {
    color: colors.text,
    fontWeight: '800',
    fontSize: typography.subheading,
  },
  cardText: {
    color: colors.textSoft,
    lineHeight: 18,
  },
  cardDistance: {
    color: colors.primaryDark,
    fontWeight: '700',
  },
  orderActions: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.xs,
  },
  actionsRow: {
    gap: spacing.sm,
    marginTop: spacing.xs,
  },
  primaryButton: {
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.pill,
    alignItems: 'center',
  },
  primaryButtonText: {
    color: colors.white,
    fontWeight: '800',
  },
  secondaryButton: {
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    alignItems: 'center',
  },
  secondaryButtonText: {
    color: colors.text,
    fontWeight: '700',
  },
  orderPrimaryButton: {
    flex: 1,
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.pill,
    alignItems: 'center',
  },
  orderPrimaryButtonText: {
    color: colors.white,
    fontWeight: '800',
  },
  orderSecondaryButton: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
    alignItems: 'center',
  },
  orderSecondaryButtonText: {
    color: colors.text,
    fontWeight: '700',
  },
  routeSummary: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
    marginTop: spacing.xs,
  },
  summaryChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    backgroundColor: '#fff3df',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.sm,
    paddingVertical: 6,
  },
  summaryChipText: {
    color: colors.primaryDark,
    fontWeight: '700',
    fontSize: typography.caption,
  },
  emptyText: {
    color: colors.textSoft,
  },
});

