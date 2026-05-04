import { useCallback, useEffect, useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import ScreenContainer from '../components/ScreenContainer';
import FadeInView from '../components/FadeInView';
import MotionPressable from '../components/MotionPressable';
import NativeLocationMap from '../components/NativeLocationMap';
import StatusPill from '../components/StatusPill';
import { useOrders } from '../context/OrdersContext';
import { formatPrice, getOrderStatusMeta, getTimelineSteps } from '../data/utils';
import {
  buildRegionFromPoints,
  buildStraightLineRoute,
  distanceKm,
  fetchRoute,
  formatDistance,
  formatDuration,
  isValidCoords,
} from '../lib/locationService';
import { colors, radius, shadows, spacing, typography } from '../theme';

function getDestinationCoords(order) {
  if (isValidCoords({ lat: order?.addressLat, lng: order?.addressLng })) {
    return { lat: Number(order.addressLat), lng: Number(order.addressLng) };
  }
  if (isValidCoords({ lat: order?.pickupStoreLat, lng: order?.pickupStoreLng })) {
    return { lat: Number(order.pickupStoreLat), lng: Number(order.pickupStoreLng) };
  }
  return null;
}

function getCourierCoords(order) {
  if (!isValidCoords({ lat: order?.courierLat, lng: order?.courierLng })) return null;
  return {
    lat: Number(order.courierLat),
    lng: Number(order.courierLng),
  };
}

export default function TrackingScreen({ route, navigation }) {
  const { orderId } = route.params || {};
  const { getOrderById, refreshOrders } = useOrders();
  const [routeData, setRouteData] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const order = getOrderById(orderId);

  const destinationCoords = useMemo(() => getDestinationCoords(order), [order]);
  const courierCoords = useMemo(() => getCourierCoords(order), [order]);
  const statusMeta = getOrderStatusMeta(order?.status, order?.deliveryMethod);
  const timeline = useMemo(() => (order ? getTimelineSteps(order) : []), [order]);
  const fallbackDistance = useMemo(
    () => (courierCoords && destinationCoords ? distanceKm(courierCoords, destinationCoords) : null),
    [courierCoords, destinationCoords]
  );

  useEffect(() => {
    if (!orderId) return undefined;
    refreshOrders().catch(() => {});
    const timer = setInterval(() => {
      refreshOrders().catch(() => {});
    }, 9000);
    return () => clearInterval(timer);
  }, [orderId, refreshOrders]);

  useEffect(() => {
    if (!order || order.deliveryMethod !== 'delivery' || !courierCoords || !destinationCoords) {
      setRouteData(null);
      return;
    }

    let active = true;
    fetchRoute({ from: courierCoords, to: destinationCoords }).then((result) => {
      if (active) setRouteData(result);
    });
    return () => {
      active = false;
    };
  }, [courierCoords, destinationCoords, order]);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await refreshOrders();
    } finally {
      setRefreshing(false);
    }
  }, [refreshOrders]);

  if (!order) {
    return (
      <ScreenContainer onRefresh={handleRefresh} refreshing={refreshing}>
        <View style={styles.emptyCard}>
          <Ionicons name="locate-outline" size={36} color={colors.primary} />
          <Text style={styles.emptyTitle}>Pedido no encontrado</Text>
          <Text style={styles.emptyText}>Parece que ese pedido ya no existe en la sesión actual.</Text>
          <MotionPressable style={styles.primaryButton} onPress={() => navigation.navigate('Catalogo')}>
            <Text style={styles.primaryButtonText}>Volver al catálogo</Text>
          </MotionPressable>
        </View>
      </ScreenContainer>
    );
  }

  const mapMarkers = [
    destinationCoords ? {
      key: 'destination',
      lat: destinationCoords.lat,
      lng: destinationCoords.lng,
      title: order.deliveryMethod === 'pickup' ? 'Tienda' : 'Destino',
      description: order.addressLabel || order.address,
      pinColor: colors.primary,
    } : null,
    courierCoords ? {
      key: 'courier',
      lat: courierCoords.lat,
      lng: courierCoords.lng,
      title: 'Repartidor',
      description: order.courierName || 'Repartidor en ruta',
      pinColor: colors.accent,
    } : null,
  ].filter(Boolean);

  const routePoints = routeData?.coordinates?.length
    ? routeData.coordinates
    : courierCoords && destinationCoords
      ? buildStraightLineRoute(courierCoords, destinationCoords).coordinates
      : [];

  const mapRegion = buildRegionFromPoints(
    [...mapMarkers.map((marker) => ({ lat: marker.lat, lng: marker.lng })), ...routePoints],
    undefined
  );

  return (
    <ScreenContainer onRefresh={handleRefresh} refreshing={refreshing}>
      <FadeInView>
        <View style={styles.heroCard}>
          <View style={styles.heroTop}>
            <View style={{ flex: 1 }}>
              <Text style={styles.orderId}>{order.id}</Text>
              <Text style={styles.orderDate}>{new Date(order.createdAt).toLocaleString('es-MX')}</Text>
            </View>
            <StatusPill status={order.status} icon={statusMeta.icon} label={statusMeta.label} />
          </View>
          <Text style={styles.heroTitle}>
            {order.deliveryMethod === 'pickup' ? 'Tu pedido está listo para recogerse' : 'Sigue la ruta de tu pedido'}
          </Text>
          <Text style={styles.heroText}>{order.addressLabel || order.address}</Text>
        </View>
      </FadeInView>

      {(destinationCoords || courierCoords) ? (
        <FadeInView delay={70}>
          <View style={styles.sectionCard}>
            <NativeLocationMap
              title={order.deliveryMethod === 'pickup' ? 'Mapa de recogida' : 'Mapa en vivo'}
              height={260}
              markers={mapMarkers}
              polyline={routePoints}
              initialRegion={mapRegion}
              helperText={
                order.deliveryMethod === 'pickup'
                  ? 'Aquí tienes el punto exacto de la tienda donde recogerás tu pedido.'
                  : courierCoords
                    ? 'La ruta se actualiza con la última ubicación compartida por el repartidor.'
                    : 'En cuanto el repartidor comparta su ubicación, verás la ruta aquí.'
              }
            />

            {order.deliveryMethod === 'delivery' ? (
              <View style={styles.routeSummary}>
                <SummaryPill icon="navigate-outline" label={`Ruta ${formatDistance(routeData?.distanceMeters, fallbackDistance)}`} />
                <SummaryPill icon="time-outline" label={`ETA ${formatDuration(routeData?.durationSeconds)}`} />
              </View>
            ) : null}
          </View>
        </FadeInView>
      ) : null}

      <FadeInView delay={110}>
        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>Progreso del pedido</Text>
          <View style={styles.timeline}>
            {timeline.map((step, index) => {
              const currentIndex = timeline.findIndex((item) => item.key === order.status);
              const active = currentIndex >= 0 ? index <= currentIndex : index === 0;
              return (
                <View key={step.key} style={styles.timelineRow}>
                  <View style={styles.timelineCol}>
                    <View style={[styles.timelineDot, active && styles.timelineDotActive]} />
                    {index < timeline.length - 1 ? <View style={[styles.timelineLine, active && styles.timelineLineActive]} /> : null}
                  </View>
                  <View style={styles.timelineContent}>
                    <Text style={[styles.timelineText, active && styles.timelineTextActive]}>{step.label}</Text>
                    <Text style={styles.timelineHint}>{active ? 'Paso alcanzado' : 'Pendiente'}</Text>
                  </View>
                </View>
              );
            })}
          </View>
        </View>
      </FadeInView>

      <FadeInView delay={150}>
        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>Resumen</Text>
          {order.items.map((item) => (
            <View key={`${order.id}-${item.productId}`} style={styles.summaryItem}>
              <View style={{ flex: 1 }}>
                <Text style={styles.summaryName}>{item.productName}</Text>
                <Text style={styles.summaryMeta}>{item.quantity} x {formatPrice(item.price)}</Text>
              </View>
              <Text style={styles.summaryValue}>{formatPrice(item.subtotal)}</Text>
            </View>
          ))}
          <View style={styles.divider} />
          <View style={styles.summaryItem}>
            <Text style={styles.totalLabel}>Total</Text>
            <Text style={styles.totalValue}>{formatPrice(order.total)}</Text>
          </View>
        </View>
      </FadeInView>

      <FadeInView delay={200}>
        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>{order.deliveryMethod === 'pickup' ? 'Recoge en tienda' : 'Datos de entrega'}</Text>
          <InfoRow icon="person-outline" label="Cliente" value={order.customerName} />
          <InfoRow icon="call-outline" label="Teléfono" value={order.customerPhone} />
          <InfoRow icon="location-outline" label="Destino" value={order.addressLabel || order.address} />
          {order.addressColony ? <InfoRow icon="business-outline" label="Colonia" value={order.addressColony} /> : null}
          {order.addressSubdivision ? <InfoRow icon="map-outline" label="Fraccionamiento" value={order.addressSubdivision} /> : null}
          {order.courierName ? <InfoRow icon="bicycle-outline" label="Repartidor" value={order.courierName} /> : null}
          {order.lastLocationAt ? <InfoRow icon="time-outline" label="Última actualización" value={new Date(order.lastLocationAt).toLocaleString('es-MX')} /> : null}
          {order.note ? <InfoRow icon="chatbox-ellipses-outline" label="Nota" value={order.note} /> : null}
        </View>
      </FadeInView>

      <FadeInView delay={260}>
        <View style={styles.actionsRow}>
          <MotionPressable style={styles.primaryButton} onPress={() => navigation.navigate('Pedidos')}>
            <Text style={styles.primaryButtonText}>Ver mis pedidos</Text>
          </MotionPressable>
          <MotionPressable style={styles.secondaryButton} onPress={() => navigation.navigate('Catalogo')}>
            <Text style={styles.secondaryButtonText}>Seguir comprando</Text>
          </MotionPressable>
        </View>
      </FadeInView>
    </ScreenContainer>
  );
}

function InfoRow({ icon, label, value }) {
  return (
    <View style={styles.infoRow}>
      <Ionicons name={icon} size={18} color={colors.primary} />
      <View style={{ flex: 1 }}>
        <Text style={styles.infoLabel}>{label}</Text>
        <Text style={styles.infoValue}>{value}</Text>
      </View>
    </View>
  );
}

function SummaryPill({ icon, label }) {
  return (
    <View style={styles.routePill}>
      <Ionicons name={icon} size={16} color={colors.primaryDark} />
      <Text style={styles.routePillText}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  heroCard: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    padding: spacing.xl,
    gap: spacing.sm,
    marginBottom: spacing.lg,
    ...shadows.card,
  },
  heroTop: {
    flexDirection: 'row',
    gap: spacing.md,
    alignItems: 'flex-start',
  },
  orderId: {
    color: colors.text,
    fontSize: typography.subheading,
    fontWeight: '800',
  },
  orderDate: {
    color: colors.textSoft,
    marginTop: 2,
  },
  heroTitle: {
    color: colors.text,
    fontSize: typography.heading,
    fontWeight: '800',
  },
  heroText: {
    color: colors.textSoft,
    lineHeight: 21,
  },
  sectionCard: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    padding: spacing.lg,
    gap: spacing.md,
    marginBottom: spacing.lg,
    ...shadows.card,
  },
  sectionTitle: {
    color: colors.text,
    fontSize: typography.subheading,
    fontWeight: '800',
  },
  routeSummary: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  routePill: {
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
  routePillText: {
    color: colors.primaryDark,
    fontWeight: '700',
    fontSize: typography.caption,
  },
  timeline: {
    gap: spacing.sm,
  },
  timelineRow: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  timelineCol: {
    alignItems: 'center',
  },
  timelineDot: {
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: colors.secondary,
    borderWidth: 2,
    borderColor: colors.border,
  },
  timelineDotActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  timelineLine: {
    width: 2,
    flex: 1,
    minHeight: 28,
    backgroundColor: colors.border,
    marginTop: 4,
  },
  timelineLineActive: {
    backgroundColor: colors.primary,
  },
  timelineContent: {
    flex: 1,
    paddingBottom: spacing.sm,
  },
  timelineText: {
    color: colors.textSoft,
    fontWeight: '700',
  },
  timelineTextActive: {
    color: colors.text,
  },
  timelineHint: {
    color: colors.textMuted,
    fontSize: typography.caption,
    marginTop: 2,
  },
  summaryItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  summaryName: {
    color: colors.text,
    fontWeight: '700',
  },
  summaryMeta: {
    color: colors.textSoft,
    marginTop: 2,
    fontSize: typography.caption,
  },
  summaryValue: {
    color: colors.text,
    fontWeight: '700',
  },
  divider: {
    height: 1,
    backgroundColor: colors.border,
  },
  totalLabel: {
    color: colors.text,
    fontWeight: '800',
  },
  totalValue: {
    color: colors.primary,
    fontSize: typography.subheading,
    fontWeight: '800',
  },
  infoRow: {
    flexDirection: 'row',
    gap: spacing.md,
    alignItems: 'flex-start',
  },
  infoLabel: {
    color: colors.textMuted,
    fontSize: typography.caption,
  },
  infoValue: {
    color: colors.text,
    lineHeight: 20,
    marginTop: 2,
  },
  emptyCard: {
    marginTop: spacing.xl,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    padding: spacing.xl,
    alignItems: 'center',
    gap: spacing.md,
    ...shadows.card,
  },
  emptyTitle: {
    color: colors.text,
    fontSize: typography.subheading,
    fontWeight: '800',
  },
  emptyText: {
    color: colors.textSoft,
    textAlign: 'center',
    lineHeight: 21,
  },
  primaryButton: {
    backgroundColor: colors.primary,
    borderRadius: radius.pill,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.xl,
    flex: 1,
    alignItems: 'center',
  },
  primaryButtonText: {
    color: colors.white,
    fontWeight: '800',
  },
  actionsRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  secondaryButton: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.pill,
    paddingVertical: spacing.sm,
    alignItems: 'center',
    backgroundColor: colors.surface,
  },
  secondaryButtonText: {
    color: colors.text,
    fontWeight: '700',
  },
});
