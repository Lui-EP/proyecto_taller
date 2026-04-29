import { useCallback, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import ScreenContainer from '../components/ScreenContainer';
import FadeInView from '../components/FadeInView';
import MotionPressable from '../components/MotionPressable';
import StatusPill from '../components/StatusPill';
import { activeCarts, getOrderStatusMeta } from '../data/demoData';
import { colors, gradients, radius, shadows, spacing, typography } from '../theme';
import { useOrders } from '../context/OrdersContext';
import { useProducts } from '../context/ProductsContext';
import { useSession } from '../context/SessionContext';

export default function AdminDashboardScreen({ navigation }) {
  const { orders, stats, refreshOrders } = useOrders();
  const { products, refreshProducts } = useProducts();
  const { logout, users, refreshUsers } = useSession();
  const [refreshing, setRefreshing] = useState(false);
  const sellers = users.filter((user) => user.role === 'seller');
  const couriers = users.filter((user) => user.role === 'courier');
  const recentOrders = orders.slice(0, 4);
  const handleLogout = async () => {
    navigation.navigate('Tabs', { screen: 'Perfil' });
    await logout();
  };
  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await Promise.all([
        refreshUsers(),
        refreshProducts(),
        refreshOrders(),
      ]);
    } finally {
      setRefreshing(false);
    }
  }, [refreshOrders, refreshProducts, refreshUsers]);

  return (
    <ScreenContainer onRefresh={handleRefresh} refreshing={refreshing}>
      <FadeInView>
        <LinearGradient colors={gradients.hero} style={styles.heroCard}>
          <Text style={styles.eyebrow}>Admin</Text>
          <Text style={styles.title}>Control operativo móvil</Text>
          <Text style={styles.subtitle}>Supervisa usuarios, pedidos activos y movimiento general del mercado desde una vista más clara.</Text>

          <View style={styles.heroActions}>
            <MotionPressable style={styles.secondaryAction} onPress={handleLogout}>
              <Text style={styles.secondaryActionText}>Cerrar sesión</Text>
            </MotionPressable>
          </View>

          <View style={styles.metricsRow}>
            <MetricCard icon="cube-outline" value={`${products.length}`} label="productos" />
            <MetricCard icon="cart-outline" value={`${activeCarts.length}`} label="carritos" />
            <MetricCard icon="bicycle-outline" value={`${stats.transit}`} label="ruta" />
          </View>
        </LinearGradient>
      </FadeInView>

      <FadeInView delay={80}>
        <Section title="Equipo activo" helper="Usuarios listos para vender y repartir.">
          <View style={styles.dualColumn}>
            <View style={styles.columnCard}>
              <Text style={styles.columnTitle}>Vendedores</Text>
              {sellers.map((seller) => <InfoCard key={seller.id} icon="briefcase-outline" title={seller.name} text={seller.email} />)}
            </View>
            <View style={styles.columnCard}>
              <Text style={styles.columnTitle}>Repartidores</Text>
              {couriers.map((courier) => <InfoCard key={courier.id} icon="bicycle-outline" title={courier.name} text={courier.email} />)}
            </View>
          </View>
        </Section>
      </FadeInView>

      <FadeInView delay={160}>
        <Section title="Pedidos recientes" helper="Una lectura rápida de lo que está entrando y avanzando.">
          {recentOrders.map((order) => {
            const status = getOrderStatusMeta(order.status, order.deliveryMethod);
            return (
              <View key={order.id} style={styles.card}>
                <View style={styles.cardTop}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.cardTitle}>{order.id}</Text>
                    <Text style={styles.cardText}>{order.customerName} · {order.courierName || 'Sin repartidor'}</Text>
                  </View>
                  <StatusPill status={order.status} icon={status.icon} label={status.label} compact />
                </View>
                <Text style={styles.helperText}>{order.deliveryMethod === 'pickup' ? order.pickupStoreName || 'Recoge en tienda' : order.address}</Text>
              </View>
            );
          })}
        </Section>
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

function Section({ title, helper, children }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {helper ? <Text style={styles.sectionHelper}>{helper}</Text> : null}
      {children}
    </View>
  );
}

function InfoCard({ icon, title, text }) {
  return (
    <View style={styles.infoCard}>
      <View style={styles.infoTop}>
        <Ionicons name={icon} size={18} color={colors.primary} />
        <View style={{ flex: 1 }}>
          <Text style={styles.infoTitle}>{title}</Text>
          <Text style={styles.infoText}>{text}</Text>
        </View>
      </View>
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
  title: { fontSize: typography.heading, fontWeight: '800', color: colors.text },
  subtitle: { color: colors.textSoft, lineHeight: 21 },
  heroActions: { flexDirection: 'row', marginTop: spacing.sm },
  secondaryAction: {
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: 'rgba(255,255,255,0.72)',
    borderRadius: radius.pill,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    alignItems: 'center',
  },
  secondaryActionText: { color: colors.text, fontWeight: '700' },
  metricsRow: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.sm },
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
  metricLabel: { color: colors.textSoft, fontSize: typography.caption },
  section: { marginTop: spacing.xl, gap: spacing.md },
  sectionTitle: { color: colors.text, fontSize: typography.subheading, fontWeight: '800' },
  sectionHelper: { color: colors.textSoft, lineHeight: 19 },
  dualColumn: { gap: spacing.md },
  columnCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    gap: spacing.sm,
    ...shadows.card,
  },
  columnTitle: { color: colors.text, fontWeight: '800' },
  infoCard: {
    backgroundColor: colors.card,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
  },
  infoTop: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  infoTitle: { color: colors.text, fontWeight: '800' },
  infoText: { color: colors.textSoft, marginTop: 4 },
  card: { backgroundColor: colors.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, padding: spacing.lg, ...shadows.card },
  cardTop: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  cardTitle: { color: colors.text, fontWeight: '800' },
  cardText: { color: colors.textSoft, marginTop: 4 },
  helperText: { color: colors.textSoft, lineHeight: 18, marginTop: spacing.sm },
});


