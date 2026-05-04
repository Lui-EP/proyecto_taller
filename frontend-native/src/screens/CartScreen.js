import { useCallback, useState } from 'react';
import { LayoutAnimation, StyleSheet, Text, View, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import ScreenContainer from '../components/ScreenContainer';
import FadeInView from '../components/FadeInView';
import MotionPressable from '../components/MotionPressable';
import { formatPrice } from '../data/utils';
import { colors, radius, shadows, spacing, typography } from '../theme';
import { useCart } from '../context/CartContext';
import { useProducts } from '../context/ProductsContext';
import { useSession } from '../context/SessionContext';

export default function CartScreen({ navigation }) {
  const { items, count, subtotal, updateItem, removeItem, clearCart } = useCart();
  const { refreshProducts } = useProducts();
  const [refreshing, setRefreshing] = useState(false);
  const { user } = useSession();
  const shipping = items.length ? 45 : 0;
  const total = subtotal + shipping;

  const animate = () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
  };

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await refreshProducts();
    } finally {
      setRefreshing(false);
    }
  }, [refreshProducts]);

  return (
    <ScreenContainer onRefresh={handleRefresh} refreshing={refreshing}>
      <FadeInView>
        <Text style={styles.title}>Mi carrito</Text>
        <Text style={styles.subtitle}>Ajusta cantidades, revisa el total y cierra la compra desde la app.</Text>
      </FadeInView>

      {!items.length ? (
        <FadeInView delay={80}>
          <View style={styles.emptyState}>
            <Ionicons name="cart-outline" size={40} color={colors.primary} />
            <Text style={styles.emptyTitle}>Tu carrito está vacío</Text>
            <Text style={styles.emptyText}>Explora el catálogo y agrega productos para empezar una compra.</Text>
            <MotionPressable style={styles.primaryBtn} onPress={() => navigation.navigate('Catalogo')}>
              <Text style={styles.primaryBtnText}>Ir al catálogo</Text>
            </MotionPressable>
          </View>
        </FadeInView>
      ) : (
        <>
          <FadeInView delay={80}>
            <View style={styles.list}>
              {items.map((item) => (
                <View key={item.product.id} style={styles.itemCard}>
                  <Image source={item.product.image} style={styles.itemImage} />
                  <View style={styles.itemBody}>
                    <Text style={styles.itemName}>{item.product.name}</Text>
                    <Text style={styles.itemMeta}>{formatPrice(item.product.price)} c/u · stock {item.product.stock}</Text>
                    <View style={styles.qtyRow}>
                      <MotionPressable
                        style={styles.qtyBtn}
                        onPress={() => {
                          animate();
                          updateItem(item.product.id, Math.max(1, item.quantity - 1));
                        }}
                      >
                        <Text style={styles.qtyText}>-</Text>
                      </MotionPressable>
                      <Text style={styles.qtyValue}>{item.quantity}</Text>
                      <MotionPressable
                        style={styles.qtyBtn}
                        onPress={() => {
                          animate();
                          updateItem(item.product.id, Math.min(item.product.stock, item.quantity + 1));
                        }}
                      >
                        <Text style={styles.qtyText}>+</Text>
                      </MotionPressable>
                      <MotionPressable
                        style={styles.removePill}
                        onPress={() => {
                          animate();
                          removeItem(item.product.id);
                        }}
                      >
                        <Text style={styles.removeText}>Quitar</Text>
                      </MotionPressable>
                    </View>
                  </View>
                  <Text style={styles.itemSubtotal}>{formatPrice(item.subtotal)}</Text>
                </View>
              ))}
            </View>
          </FadeInView>

          <FadeInView delay={140}>
            <View style={styles.summaryCard}>
              <Text style={styles.summaryTitle}>Resumen</Text>
              <SummaryRow label="Productos" value={`${count}`} />
              <SummaryRow label="Subtotal" value={formatPrice(subtotal)} />
              <SummaryRow label="Envío estimado" value={formatPrice(shipping)} />
              <SummaryRow label="Total" value={formatPrice(total)} strong />
              <Text style={styles.helperText}>{user ? 'Tu pedido quedará ligado a tu cuenta.' : 'Puedes continuar como invitado y luego rastrear tu pedido.'}</Text>
              <MotionPressable style={styles.primaryBtn} onPress={() => navigation.navigate('Checkout')}>
                <Text style={styles.primaryBtnText}>Ir a pagar</Text>
              </MotionPressable>
              <MotionPressable style={styles.secondaryBtn} onPress={() => navigation.navigate('Catalogo')}>
                <Text style={styles.secondaryBtnText}>Seguir comprando</Text>
              </MotionPressable>
              <MotionPressable
                style={styles.ghostBtn}
                onPress={() => {
                  animate();
                  clearCart();
                }}
              >
                <Text style={styles.ghostBtnText}>Vaciar carrito</Text>
              </MotionPressable>
            </View>
          </FadeInView>
        </>
      )}
    </ScreenContainer>
  );
}

function SummaryRow({ label, value, strong = false }) {
  return (
    <View style={styles.summaryRow}>
      <Text style={[styles.summaryLabel, strong && styles.summaryLabelStrong]}>{label}</Text>
      <Text style={[styles.summaryValue, strong && styles.summaryValueStrong]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  title: {
    fontSize: typography.heading,
    fontWeight: '800',
    color: colors.text,
  },
  subtitle: {
    color: colors.textSoft,
    marginTop: 6,
    marginBottom: spacing.lg,
    lineHeight: 20,
  },
  emptyState: {
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
    lineHeight: 20,
  },
  list: {
    gap: spacing.md,
  },
  itemCard: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    padding: spacing.md,
    gap: spacing.md,
    marginBottom: spacing.md,
    ...shadows.card,
  },
  itemImage: {
    width: 92,
    height: 92,
    borderRadius: radius.md,
  },
  itemBody: {
    flex: 1,
    gap: spacing.xs,
  },
  itemName: {
    color: colors.text,
    fontWeight: '800',
    fontSize: typography.subheading,
  },
  itemMeta: {
    color: colors.textSoft,
    lineHeight: 18,
  },
  qtyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.sm,
    flexWrap: 'wrap',
  },
  qtyBtn: {
    width: 34,
    height: 34,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.white,
  },
  qtyText: {
    color: colors.text,
    fontWeight: '800',
    fontSize: 18,
  },
  qtyValue: {
    color: colors.text,
    fontWeight: '700',
    minWidth: 20,
    textAlign: 'center',
  },
  removePill: {
    borderRadius: radius.pill,
    backgroundColor: colors.dangerSoft,
    paddingHorizontal: spacing.sm,
    paddingVertical: 8,
  },
  removeText: {
    color: colors.danger,
    fontWeight: '700',
  },
  itemSubtotal: {
    color: colors.primary,
    fontWeight: '800',
    fontSize: typography.body,
  },
  summaryCard: {
    marginTop: spacing.lg,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    padding: spacing.lg,
    gap: spacing.sm,
    ...shadows.card,
  },
  summaryTitle: {
    color: colors.text,
    fontSize: typography.subheading,
    fontWeight: '800',
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  summaryLabel: {
    color: colors.textSoft,
  },
  summaryLabelStrong: {
    color: colors.text,
    fontWeight: '800',
  },
  summaryValue: {
    color: colors.text,
    fontWeight: '700',
  },
  summaryValueStrong: {
    color: colors.primary,
    fontSize: typography.subheading,
    fontWeight: '800',
  },
  helperText: {
    color: colors.textSoft,
    lineHeight: 20,
    marginVertical: spacing.xs,
  },
  primaryBtn: {
    marginTop: spacing.sm,
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
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.pill,
    paddingVertical: spacing.sm,
    alignItems: 'center',
    backgroundColor: colors.white,
  },
  secondaryBtnText: {
    color: colors.text,
    fontWeight: '700',
  },
  ghostBtn: {
    borderRadius: radius.pill,
    paddingVertical: spacing.sm,
    alignItems: 'center',
    backgroundColor: colors.dangerSoft,
  },
  ghostBtnText: {
    color: colors.danger,
    fontWeight: '700',
  },
});

