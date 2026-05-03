import { useCallback, useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import ScreenContainer from '../components/ScreenContainer';
import FadeInView from '../components/FadeInView';
import MotionPressable from '../components/MotionPressable';
import StatusPill from '../components/StatusPill';
import { formatPrice, getOrderStatusMeta } from '../data/demoData';
import { colors, gradients, radius, shadows, spacing, typography } from '../theme';
import { useSession } from '../context/SessionContext';
import { useOrders } from '../context/OrdersContext';
import { useProducts } from '../context/ProductsContext';
import { listSellerActiveCarts } from '../lib/productsApi';

export default function SellerDashboardScreen({ navigation }) {
  const { user, logout } = useSession();
  const { getOrdersForSeller, refreshOrders } = useOrders();
  const { getSellerProducts, getLowStockProducts, refreshProducts } = useProducts();
  const [refreshing, setRefreshing] = useState(false);
  const [sellerCarts, setSellerCarts] = useState([]);
  const sellerId = user?.id || 'vendedor-1';
  const sellerProducts = getSellerProducts(sellerId);
  const sellerOrders = getOrdersForSeller(sellerId);
  const lowStock = getLowStockProducts(10).filter((product) => product.sellerId === sellerId);
  const revenue = sellerOrders.reduce((sum, order) => sum + order.items
    .filter((item) => item.sellerId === sellerId)
    .reduce((subtotal, item) => subtotal + item.subtotal, 0), 0);

  useEffect(() => {
    let active = true;
    listSellerActiveCarts(sellerId)
      .then((carts) => {
        if (!active) return;
        setSellerCarts(Array.isArray(carts) ? carts : []);
      })
      .catch(() => {
        if (!active) return;
        setSellerCarts([]);
      });
    return () => {
      active = false;
    };
  }, [sellerId]);

  const handleLogout = async () => {
    navigation.navigate('Perfil');
    await logout();
  };

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await Promise.all([
        refreshOrders(),
        refreshProducts(),
        listSellerActiveCarts(sellerId).then((carts) => setSellerCarts(Array.isArray(carts) ? carts : [])),
      ]);
    } finally {
      setRefreshing(false);
    }
  }, [refreshOrders, refreshProducts, sellerId]);

  return (
    <ScreenContainer onRefresh={handleRefresh} refreshing={refreshing}>
      <FadeInView>
        <LinearGradient colors={gradients.accent} style={styles.heroCard}>
          <Text style={styles.eyebrow}>Vendedor</Text>
          <Text style={styles.title}>Tu operación en una sola vista</Text>
          <Text style={styles.subtitle}>Controla inventario, carritos activos y pedidos confirmados sin salir del celular.</Text>

          <View style={styles.heroActions}>
            <MotionPressable style={styles.primaryAction} onPress={() => navigation.navigate('CrearProducto')}>
              <Text style={styles.primaryActionText}>Nuevo producto</Text>
            </MotionPressable>
            <MotionPressable style={styles.secondaryAction} onPress={handleLogout}>
              <Text style={styles.secondaryActionText}>Cerrar sesión</Text>
            </MotionPressable>
          </View>

          <View style={styles.heroMetricsRow}>
            <MetricCard icon="cube-outline" value={`${sellerProducts.length}`} label="productos" />
            <MetricCard icon="alert-circle-outline" value={`${lowStock.length}`} label="críticos" />
            <MetricCard icon="cash-outline" value={formatPrice(revenue)} label="venta" compactValue />
          </View>
        </LinearGradient>
      </FadeInView>

      <FadeInView delay={70}>
        <Section title="Mis productos" helper="Edita nombre, precio, stock y descripción desde aquí." emptyText="No tienes productos cargados todavía.">
          {sellerProducts.map((product) => (
            <View key={product.id} style={styles.card}>
              <View style={styles.cardTop}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.cardTitle}>{product.name}</Text>
                  <Text style={styles.cardSub}>{product.categoryLabel} · {formatPrice(product.price)}</Text>
                </View>
                <StatusPill status="pedido_realizado" icon="cube-outline" label={`${product.stock} unidades`} compact />
              </View>
              <MotionPressable style={styles.editButton} onPress={() => navigation.navigate('EditarProducto', { productId: product.id })}>
                <Text style={styles.editButtonText}>Editar producto</Text>
              </MotionPressable>
            </View>
          ))}
        </Section>
      </FadeInView>

      <FadeInView delay={130}>
        <Section title="Inventario por agotarse" helper="Revisa primero lo que necesita reposición rápida." emptyText="No hay productos con stock crítico.">
          {lowStock.map((product) => (
            <View key={product.id} style={styles.card}>
              <View style={styles.cardTop}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.cardTitle}>{product.name}</Text>
                  <Text style={styles.cardSub}>{product.categoryLabel}</Text>
                </View>
                <StatusPill status="listo_recoger" icon="alert-outline" label={`${product.stock} unidades`} compact />
              </View>
              <Text style={styles.cardTotal}>{formatPrice(product.price)}</Text>
            </View>
          ))}
        </Section>
      </FadeInView>

      <FadeInView delay={190}>
        <Section title="Carritos activos" helper="Estas compras todavía no se pagan, pero te ayudan a medir intención real." emptyText="Sin carritos activos por ahora.">
          {sellerCarts.map((cart) => (
            <View key={cart.owner_id} style={styles.card}>
              <View style={styles.cardTop}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.cardTitle}>{cart.owner_name}</Text>
                  <Text style={styles.cardSub}>Actualizado: {formatDate(cart.updated_at)}</Text>
                </View>
                <View style={styles.badgeSoft}>
                  <Text style={styles.badgeSoftText}>{cart.items.length} producto(s)</Text>
                </View>
              </View>
              {cart.items.map((item) => (
                <Text key={`${cart.owner_id}-${item.product_id}`} style={styles.lineItem}>{item.quantity} x {item.name}</Text>
              ))}
              <Text style={styles.cardTotal}>Total potencial: {formatPrice(cart.total)}</Text>
            </View>
          ))}
        </Section>
      </FadeInView>

      <FadeInView delay={250}>
        <Section title="Pedidos confirmados" helper="Aquí ya ves lo que entró de verdad y cómo avanza." emptyText="Sin pedidos confirmados todavía.">
          {sellerOrders.map((order) => {
            const status = getOrderStatusMeta(order.status, order.deliveryMethod);
            const sellerItems = order.items.filter((item) => item.sellerId === sellerId);
            return (
              <View key={order.id} style={styles.card}>
                <View style={styles.cardTop}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.cardTitle}>{order.id}</Text>
                    <Text style={styles.cardSub}>{order.customerName} · {order.deliveryMethod === 'pickup' ? 'Recoge en tienda' : 'Entrega a domicilio'}</Text>
                  </View>
                  <StatusPill status={order.status} icon={status.icon} label={status.label} compact />
                </View>
                {sellerItems.map((item) => (
                  <Text key={`${order.id}-${item.productId}`} style={styles.lineItem}>{item.quantity} x {item.productName}</Text>
                ))}
                <Text style={styles.cardTotal}>{formatPrice(sellerItems.reduce((sum, item) => sum + item.subtotal, 0))}</Text>
              </View>
            );
          })}
        </Section>
      </FadeInView>
    </ScreenContainer>
  );
}

function MetricCard({ icon, value, label, compactValue = false }) {
  return (
    <View style={styles.metricCard}>
      <Ionicons name={icon} size={18} color={colors.primary} />
      <Text style={[styles.metricValue, compactValue && styles.metricValueCompact]} numberOfLines={1}>{value}</Text>
      <Text style={styles.metricLabel}>{label}</Text>
    </View>
  );
}

function Section({ title, helper, emptyText, children }) {
  const hasChildren = Array.isArray(children) ? children.length > 0 : Boolean(children);
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {helper ? <Text style={styles.sectionHelper}>{helper}</Text> : null}
      {hasChildren ? children : <Text style={styles.emptyText}>{emptyText}</Text>}
    </View>
  );
}

function formatDate(value) {
  return new Date(value).toLocaleString('es-MX');
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
  title: { fontSize: typography.heading, fontWeight: '800', color: colors.text },
  subtitle: { color: colors.textSoft, lineHeight: 21 },
  heroActions: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md },
  primaryAction: {
    flex: 1,
    backgroundColor: colors.primary,
    borderRadius: radius.pill,
    paddingVertical: spacing.sm,
    alignItems: 'center',
  },
  primaryActionText: { color: colors.white, fontWeight: '800' },
  secondaryAction: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: 'rgba(255,255,255,0.72)',
    borderRadius: radius.pill,
    paddingVertical: spacing.sm,
    alignItems: 'center',
  },
  secondaryActionText: { color: colors.text, fontWeight: '700' },
  heroMetricsRow: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.sm },
  metricCard: {
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.72)',
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    gap: 4,
  },
  metricValue: { color: colors.primary, fontSize: typography.heading, fontWeight: '800' },
  metricValueCompact: { fontSize: 16 },
  metricLabel: { color: colors.textSoft, fontSize: typography.caption },
  section: { marginTop: spacing.xl, gap: spacing.md },
  sectionTitle: { color: colors.text, fontSize: typography.subheading, fontWeight: '800' },
  sectionHelper: { color: colors.textSoft, lineHeight: 19 },
  card: {
    backgroundColor: colors.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border,
    padding: spacing.lg, gap: 8, ...shadows.card,
  },
  cardTop: { flexDirection: 'row', gap: spacing.md, alignItems: 'center' },
  cardTitle: { color: colors.text, fontWeight: '800' },
  cardSub: { color: colors.textSoft, lineHeight: 18 },
  lineItem: { color: colors.text },
  cardTotal: { color: colors.primary, fontWeight: '800', marginTop: spacing.xs },
  editButton: {
    marginTop: spacing.xs,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
    borderRadius: radius.pill,
    paddingVertical: spacing.sm,
    alignItems: 'center',
  },
  editButtonText: { color: colors.text, fontWeight: '700' },
  badgeSoft: {
    backgroundColor: colors.warningSoft,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.sm,
    paddingVertical: 6,
  },
  badgeSoftText: { color: colors.primaryDark, fontWeight: '700', fontSize: typography.caption },
  emptyText: { color: colors.textSoft },
});








