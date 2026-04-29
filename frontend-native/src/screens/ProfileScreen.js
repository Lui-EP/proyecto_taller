import { useCallback, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import ScreenContainer from '../components/ScreenContainer';
import FadeInView from '../components/FadeInView';
import MotionPressable from '../components/MotionPressable';
import StatusPill from '../components/StatusPill';
import { colors, radius, shadows, spacing, typography } from '../theme';
import { useSession } from '../context/SessionContext';
import { useCart } from '../context/CartContext';
import { useOrders } from '../context/OrdersContext';
import { getOrderStatusMeta } from '../data/demoData';

export default function ProfileScreen({ navigation }) {
  const { user, logout, refreshUsers } = useSession();
  const { count } = useCart();
  const { getOrdersByCustomer, refreshOrders } = useOrders();
  const [refreshing, setRefreshing] = useState(false);
  const buyerOrders = user?.role === 'buyer' ? getOrdersByCustomer(user.id).slice(0, 2) : [];

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await Promise.all([
        refreshUsers(),
        refreshOrders(),
      ]);
    } finally {
      setRefreshing(false);
    }
  }, [refreshOrders, refreshUsers]);

  if (!user) {
    return (
      <ScreenContainer onRefresh={handleRefresh} refreshing={refreshing}>
        <FadeInView>
          <View style={styles.heroCard}>
            <Text style={styles.heroTitle}>Entrar a MercadoLocal móvil</Text>
            <Text style={styles.heroText}>Puedes probar la app con cuentas demo de cliente, vendedor, admin y repartidor.</Text>
            <MotionPressable style={styles.primaryBtn} onPress={() => navigation.navigate('Login')}>
              <Text style={styles.primaryBtnText}>Elegir cuenta demo</Text>
            </MotionPressable>
          </View>
        </FadeInView>
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer onRefresh={handleRefresh} refreshing={refreshing}>
      <FadeInView>
        <View style={styles.profileCard}>
          <View style={styles.avatar}><Text style={styles.avatarText}>{user.name.charAt(0).toUpperCase()}</Text></View>
          <Text style={styles.userName}>{user.name}</Text>
          <Text style={styles.userRole}>{roleTitle(user.role)}</Text>
          <Text style={styles.userMeta}>{user.email}</Text>
        </View>
      </FadeInView>

      <FadeInView delay={80}>
        <View style={styles.summaryRow}>
          <MetricCard icon="cart-outline" value={`${count}`} label="en carrito" />
          <MetricCard icon="grid-outline" value={rolePanelTitle(user.role)} label="panel activo" />
        </View>
      </FadeInView>

      <FadeInView delay={140}>
        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>Accesos rápidos</Text>
          <QuickLink icon="cart-outline" title="Ver carrito" text="Revisa productos y finaliza la compra." onPress={() => navigation.navigate('Carrito')} />
          {user.role === 'buyer' ? <QuickLink icon="storefront-outline" title="Explorar catálogo" text="Descubre nuevos productos locales." onPress={() => navigation.navigate('Catalogo')} /> : null}
          <QuickLink icon="receipt-outline" title="Ver pedidos" text="Consulta compras, seguimiento e historial desde la app." onPress={() => navigation.navigate('Pedidos')} />
          {user.role === 'seller' ? <QuickLink icon="briefcase-outline" title="Abrir panel vendedor" text="Pedidos, inventario y carritos activos." onPress={() => navigation.navigate('Vender')} /> : null}
          {user.role === 'admin' ? <QuickLink icon="speedometer-outline" title="Abrir panel admin" text="Resumen operativo y usuarios activos." onPress={() => navigation.navigate('PanelAdmin')} /> : null}
          {user.role === 'courier' ? <QuickLink icon="bicycle-outline" title="Abrir panel repartidor" text="Pedidos disponibles y entregas activas." onPress={() => navigation.navigate('PanelRepartidor')} /> : null}
          <QuickLink icon="log-out-outline" title="Cerrar sesión" text="Salir de tu cuenta actual en este dispositivo." onPress={logout} />
        </View>
      </FadeInView>

      {buyerOrders.length ? (
        <FadeInView delay={200}>
          <View style={styles.sectionCard}>
            <Text style={styles.sectionTitle}>Mis pedidos</Text>
            {buyerOrders.map((order) => {
              const status = getOrderStatusMeta(order.status, order.deliveryMethod);
              return (
                <MotionPressable key={order.id} style={styles.orderCard} onPress={() => navigation.navigate('Seguimiento', { orderId: order.id })}>
                  <View style={styles.orderCardTop}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.orderCardTitle}>{order.id}</Text>
                      <Text style={styles.orderCardText}>{order.deliveryMethod === 'pickup' ? 'Recoge en tienda' : order.address}</Text>
                    </View>
                    <StatusPill status={order.status} icon={status.icon} label={status.label} compact />
                  </View>
                </MotionPressable>
              );
            })}
          </View>
        </FadeInView>
      ) : null}

      <FadeInView delay={260}>
        <MotionPressable style={styles.secondaryBtn} onPress={logout}>
          <Text style={styles.secondaryBtnText}>Cerrar sesión</Text>
        </MotionPressable>
      </FadeInView>
    </ScreenContainer>
  );
}

function QuickLink({ icon, title, text, onPress }) {
  return (
    <MotionPressable style={styles.linkCard} onPress={onPress}>
      <Ionicons name={icon} size={20} color={colors.primary} />
      <View style={{ flex: 1 }}>
        <Text style={styles.linkTitle}>{title}</Text>
        <Text style={styles.linkText}>{text}</Text>
      </View>
      <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
    </MotionPressable>
  );
}

function MetricCard({ icon, value, label }) {
  return (
    <View style={styles.summaryCard}>
      <Ionicons name={icon} size={20} color={colors.primary} />
      <Text style={styles.summaryNumber}>{value}</Text>
      <Text style={styles.summaryLabel}>{label}</Text>
    </View>
  );
}

function roleTitle(role) {
  const labels = {
    buyer: 'Cliente',
    seller: 'Vendedor',
    courier: 'Repartidor',
    admin: 'Administrador',
  };
  return labels[role] || 'Invitado';
}

function rolePanelTitle(role) {
  const labels = {
    buyer: 'Compra',
    seller: 'Ventas',
    courier: 'Reparto',
    admin: 'Control',
  };
  return labels[role] || 'Explora';
}

const styles = StyleSheet.create({
  heroCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.xl,
    gap: spacing.md,
    ...shadows.card,
  },
  heroTitle: {
    fontSize: typography.heading,
    fontWeight: '800',
    color: colors.text,
  },
  heroText: {
    color: colors.textSoft,
    lineHeight: 22,
  },
  profileCard: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.xl,
    gap: spacing.xs,
    ...shadows.card,
  },
  avatar: {
    width: 78,
    height: 78,
    borderRadius: 39,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
  },
  avatarText: {
    color: colors.white,
    fontWeight: '800',
    fontSize: 30,
  },
  userName: {
    color: colors.text,
    fontSize: typography.heading,
    fontWeight: '800',
  },
  userRole: {
    color: colors.primary,
    fontWeight: '700',
  },
  userMeta: {
    color: colors.textSoft,
  },
  summaryRow: {
    flexDirection: 'row',
    gap: spacing.md,
    marginTop: spacing.lg,
  },
  summaryCard: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    gap: spacing.xs,
    ...shadows.card,
  },
  summaryNumber: {
    color: colors.primary,
    fontSize: typography.subheading,
    fontWeight: '800',
  },
  summaryLabel: {
    color: colors.textSoft,
    marginTop: 2,
  },
  sectionCard: {
    marginTop: spacing.lg,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    gap: spacing.md,
    ...shadows.card,
  },
  sectionTitle: {
    color: colors.text,
    fontSize: typography.subheading,
    fontWeight: '800',
  },
  linkCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    backgroundColor: colors.card,
  },
  linkTitle: {
    color: colors.text,
    fontWeight: '800',
  },
  linkText: {
    color: colors.textSoft,
    marginTop: 4,
    lineHeight: 18,
  },
  orderCard: {
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    backgroundColor: colors.card,
  },
  orderCardTop: {
    flexDirection: 'row',
    gap: spacing.md,
    alignItems: 'center',
  },
  orderCardTitle: {
    color: colors.text,
    fontWeight: '800',
  },
  orderCardText: {
    color: colors.textSoft,
    marginTop: 4,
    lineHeight: 18,
  },
  primaryBtn: {
    backgroundColor: colors.primary,
    borderRadius: radius.pill,
    paddingVertical: spacing.sm,
    alignItems: 'center',
  },
  primaryBtnText: {
    color: colors.white,
    fontWeight: '800',
  },
  secondaryBtn: {
    marginTop: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.pill,
    paddingVertical: spacing.sm,
    alignItems: 'center',
    backgroundColor: colors.surface,
  },
  secondaryBtnText: {
    color: colors.text,
    fontWeight: '700',
  },
});
