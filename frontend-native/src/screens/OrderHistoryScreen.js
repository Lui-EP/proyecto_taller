import { useCallback, useMemo, useState } from 'react';
import { LayoutAnimation, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import ScreenContainer from '../components/ScreenContainer';
import FadeInView from '../components/FadeInView';
import MotionPressable from '../components/MotionPressable';
import StatusPill from '../components/StatusPill';
import { colors, gradients, radius, shadows, spacing, typography } from '../theme';
import { useSession } from '../context/SessionContext';
import { useOrders } from '../context/OrdersContext';
import { formatPrice, getOrderStatusMeta, sortOrdersByDate } from '../data/utils';
import { hapticSelection } from '../lib/haptics';

const filterOptions = [
  { id: 'all', label: 'Todos' },
  { id: 'active', label: 'Activos' },
  { id: 'pickup', label: 'Recoger' },
  { id: 'delivered', label: 'Entregados' },
];

export default function OrderHistoryScreen({ navigation }) {
  const { user, guestId } = useSession();
  const { orders, getOrdersByCustomer, getOrdersForSeller, getOrdersForCourier, refreshOrders } = useOrders();
  const [activeFilter, setActiveFilter] = useState('all');
  const [refreshing, setRefreshing] = useState(false);

  const role = user?.role || 'guest';
  const baseOrders = useMemo(() => {
    if (!user) return getOrdersByCustomer(guestId);
    if (role === 'buyer') return getOrdersByCustomer(user.id);
    if (role === 'seller') return getOrdersForSeller(user.id);
    if (role === 'courier') return getOrdersForCourier(user.id);
    if (role === 'admin') return orders;
    return [];
  }, [getOrdersByCustomer, getOrdersForCourier, getOrdersForSeller, guestId, orders, role, user]);

  const filteredOrders = useMemo(() => {
    const list = sortOrdersByDate(baseOrders);
    return list.filter((order) => {
      if (activeFilter === 'active') return order.status !== 'entregado';
      if (activeFilter === 'pickup') return order.deliveryMethod === 'pickup';
      if (activeFilter === 'delivered') return order.status === 'entregado';
      return true;
    });
  }, [activeFilter, baseOrders]);

  const stats = useMemo(() => ({
    total: baseOrders.length,
    active: baseOrders.filter((order) => order.status !== 'entregado').length,
    pickup: baseOrders.filter((order) => order.deliveryMethod === 'pickup').length,
  }), [baseOrders]);
  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await refreshOrders();
    } finally {
      setRefreshing(false);
    }
  }, [refreshOrders]);

  if (!user && !baseOrders.length) {
    return (
      <ScreenContainer onRefresh={handleRefresh} refreshing={refreshing}>
        <FadeInView>
          <View style={styles.emptyCard}>
            <Ionicons name="receipt-outline" size={34} color={colors.primary} />
            <Text style={styles.emptyTitle}>Inicia sesión para ver tus pedidos</Text>
            <Text style={styles.emptyText}>Desde aquí podrás revisar seguimiento, entregas y compras anteriores.</Text>
            <MotionPressable style={styles.primaryButton} onPress={() => navigation.navigate('Login')}>
              <Text style={styles.primaryButtonText}>Entrar</Text>
            </MotionPressable>
          </View>
        </FadeInView>
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer onRefresh={handleRefresh} refreshing={refreshing}>
      <FadeInView>
        <LinearGradient colors={gradients.warm} style={styles.heroCard}>
          <Text style={styles.eyebrow}>Historial</Text>
          <Text style={styles.heroTitle}>{screenTitle(role)}</Text>
          <Text style={styles.heroText}>{screenSubtitle(role)}</Text>

          <View style={styles.metricsRow}>
            <MetricCard icon="receipt-outline" value={`${stats.total}`} label="totales" />
            <MetricCard icon="time-outline" value={`${stats.active}`} label="activos" />
            <MetricCard icon="storefront-outline" value={`${stats.pickup}`} label="recoger" />
          </View>
        </LinearGradient>
      </FadeInView>

      <FadeInView delay={80}>
        <View style={styles.filtersWrap}>
          {filterOptions.map((option) => {
            const active = option.id === activeFilter;
            return (
              <MotionPressable
                key={option.id}
                style={[styles.filterChip, active && styles.filterChipActive]}
                onPress={() => { LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut); hapticSelection(); setActiveFilter(option.id); }}
              >
                <Text style={[styles.filterChipText, active && styles.filterChipTextActive]}>{option.label}</Text>
              </MotionPressable>
            );
          })}
        </View>
      </FadeInView>

      <FadeInView delay={140}>
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{filteredOrders.length} pedido(s)</Text>
          {filteredOrders.length ? filteredOrders.map((order) => {
            const statusMeta = getOrderStatusMeta(order.status, order.deliveryMethod);
            return (
              <MotionPressable
                key={order.id}
                style={styles.orderCard}
                onPress={() => navigation.navigate('Seguimiento', { orderId: order.id })}
              >
                <View style={styles.orderTop}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.orderId}>{order.id}</Text>
                    <Text style={styles.orderMeta}>{new Date(order.createdAt).toLocaleString('es-MX')}</Text>
                  </View>
                  <StatusPill status={order.status} icon={statusMeta.icon} label={statusMeta.label} compact />
                </View>

                <Text style={styles.orderAddress}>{order.deliveryMethod === 'pickup' ? order.pickupStoreName || 'Recoge en tienda' : order.address}</Text>
                <Text style={styles.orderHelper}>{secondaryLine(role, order)}</Text>

                <View style={styles.orderFooter}>
                  <Text style={styles.orderTotal}>{formatPrice(order.total)}</Text>
                  <View style={styles.inlineAction}>
                    <Text style={styles.inlineActionText}>Ver detalle</Text>
                    <Ionicons name="chevron-forward" size={16} color={colors.primary} />
                  </View>
                </View>
              </MotionPressable>
            );
          }) : (
            <View style={styles.emptyCardSmall}>
              <Ionicons name="file-tray-outline" size={30} color={colors.primary} />
              <Text style={styles.emptySmallTitle}>No hay pedidos para este filtro</Text>
              <Text style={styles.emptySmallText}>Cambia el filtro o regresa más tarde.</Text>
            </View>
          )}
        </View>
      </FadeInView>
    </ScreenContainer>
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

function screenTitle(role) {
  if (role === 'seller') return 'Pedidos de tu tienda';
  if (role === 'courier') return 'Entregas y rutas';
  if (role === 'admin') return 'Historial operativo';
  if (role === 'guest') return 'Pedidos en este dispositivo';
  return 'Tus pedidos';
}

function screenSubtitle(role) {
  if (role === 'seller') return 'Revisa compras confirmadas, entregas y recolecciones desde una vista móvil.';
  if (role === 'courier') return 'Consulta pedidos tomados y entregas finalizadas sin salir del celular.';
  if (role === 'admin') return 'Monitorea la operación completa, desde pedidos activos hasta entregas cerradas.';
  if (role === 'guest') return 'Si compraste como invitado, aquí mismo puedes seguir tus pedidos recientes.';
  return 'Aquí tienes tus compras activas y entregadas para seguirlas o revisarlas después.';
}

function secondaryLine(role, order) {
  if (role === 'seller') return `${order.customerName} · ${order.items.length} producto(s)`;
  if (role === 'courier') return `${order.customerName} · ${order.customerPhone}`;
  if (role === 'admin') return `${order.customerName} · ${order.courierName || 'Sin repartidor'}`;
  return order.deliveryMethod === 'pickup' ? 'Recoger en tienda' : order.customerPhone;
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
  heroTitle: {
    color: colors.text,
    fontSize: typography.heading,
    fontWeight: '800',
  },
  heroText: {
    color: colors.textSoft,
    lineHeight: 21,
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
    fontWeight: '800',
    fontSize: typography.subheading,
  },
  metricLabel: {
    color: colors.textSoft,
    fontSize: typography.caption,
  },
  filtersWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginTop: spacing.lg,
  },
  filterChip: {
    backgroundColor: colors.surface,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  filterChipActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  filterChipText: {
    color: colors.text,
    fontWeight: '700',
  },
  filterChipTextActive: {
    color: colors.white,
  },
  section: {
    marginTop: spacing.lg,
    gap: spacing.md,
  },
  sectionTitle: {
    color: colors.text,
    fontSize: typography.subheading,
    fontWeight: '800',
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
  orderTop: {
    flexDirection: 'row',
    gap: spacing.md,
    alignItems: 'flex-start',
  },
  orderId: {
    color: colors.text,
    fontWeight: '800',
    fontSize: typography.subheading,
  },
  orderMeta: {
    color: colors.textMuted,
    marginTop: 2,
  },
  orderAddress: {
    color: colors.text,
    lineHeight: 20,
  },
  orderHelper: {
    color: colors.textSoft,
    lineHeight: 19,
  },
  orderFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: spacing.xs,
  },
  orderTotal: {
    color: colors.primary,
    fontWeight: '800',
    fontSize: typography.subheading,
  },
  inlineAction: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  inlineActionText: {
    color: colors.primary,
    fontWeight: '700',
  },
  emptyCard: {
    marginTop: spacing.xl,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.xl,
    alignItems: 'center',
    gap: spacing.md,
    ...shadows.card,
  },
  emptyTitle: {
    color: colors.text,
    fontSize: typography.subheading,
    fontWeight: '800',
    textAlign: 'center',
  },
  emptyText: {
    color: colors.textSoft,
    lineHeight: 21,
    textAlign: 'center',
  },
  primaryButton: {
    backgroundColor: colors.primary,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.sm,
    marginTop: spacing.sm,
  },
  primaryButtonText: {
    color: colors.white,
    fontWeight: '800',
  },
  emptyCardSmall: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.xl,
    alignItems: 'center',
    gap: spacing.sm,
    ...shadows.card,
  },
  emptySmallTitle: {
    color: colors.text,
    fontWeight: '800',
  },
  emptySmallText: {
    color: colors.textSoft,
    textAlign: 'center',
  },
});


