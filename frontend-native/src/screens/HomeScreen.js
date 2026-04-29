import { useCallback, useEffect, useRef, useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import ProductCard from '../components/ProductCard';
import ScreenContainer from '../components/ScreenContainer';
import FadeInView from '../components/FadeInView';
import MotionPressable from '../components/MotionPressable';
import { SkeletonList } from '../components/SkeletonList';
import StatusPill from '../components/StatusPill';
import { colors, radius, shadows, spacing, typography } from '../theme';
import { useCart } from '../context/CartContext';
import { useSession } from '../context/SessionContext';
import { useOrders } from '../context/OrdersContext';
import { useProducts } from '../context/ProductsContext';
import { getOrderStatusMeta } from '../data/demoData';

const FEATURED_CARD_WIDTH = 252;
const FEATURED_CARD_GAP = spacing.md;
const FEATURED_STEP = FEATURED_CARD_WIDTH + FEATURED_CARD_GAP;
const FEATURED_AUTOPLAY_MS = 2600;
const FEATURED_PAUSE_AFTER_TOUCH_MS = 4200;

export default function HomeScreen({ navigation }) {
  const { ready: productsReady, getFeaturedProducts, getLowStockProducts, categories, refreshProducts } = useProducts();
  const featured = getFeaturedProducts();
  const lowStock = getLowStockProducts(10);
  const { addItem } = useCart();
  const { user, guestId } = useSession();
  const { ready: ordersReady, getOrdersByCustomer, refreshOrders } = useOrders();
  const [refreshing, setRefreshing] = useState(false);

  const featuredScrollRef = useRef(null);
  const featuredAutoIndexRef = useRef(0);
  const featuredPauseUntilRef = useRef(0);

  const recentOrder = user
    ? (user.role === 'buyer' ? getOrdersByCustomer(user.id)[0] : null)
    : getOrdersByCustomer(guestId)[0];

  const recentStatus = recentOrder ? getOrderStatusMeta(recentOrder.status, recentOrder.deliveryMethod) : null;

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await Promise.all([
        refreshProducts(),
        refreshOrders(),
      ]);
    } finally {
      setRefreshing(false);
    }
  }, [refreshOrders, refreshProducts]);

  const isInitialLoading = !productsReady || !ordersReady;

  useEffect(() => {
    if (featured.length < 2) return undefined;

    const timer = setInterval(() => {
      if (!featuredScrollRef.current) return;
      if (Date.now() < featuredPauseUntilRef.current) return;

      const next = (featuredAutoIndexRef.current + 1) % featured.length;
      featuredAutoIndexRef.current = next;
      featuredScrollRef.current.scrollTo({ x: next * FEATURED_STEP, y: 0, animated: true });
    }, FEATURED_AUTOPLAY_MS);

    return () => clearInterval(timer);
  }, [featured.length]);

  const pauseFeaturedAutoplay = useCallback(() => {
    featuredPauseUntilRef.current = Date.now() + FEATURED_PAUSE_AFTER_TOUCH_MS;
  }, []);

  const syncFeaturedIndex = useCallback((event) => {
    const x = event?.nativeEvent?.contentOffset?.x || 0;
    featuredAutoIndexRef.current = Math.max(0, Math.round(x / FEATURED_STEP));
  }, []);

  return (
    <ScreenContainer onRefresh={handleRefresh} refreshing={refreshing}>
      {isInitialLoading ? <SkeletonList count={3} /> : null}
      {!isInitialLoading ? (
        <>
          <FadeInView>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>MercadoLocal</Text>
              <Text style={styles.sectionText}>Explora productos locales, artesanales y listos para compra desde el celular.</Text>
            </View>
          </FadeInView>

          {recentOrder ? (
            <FadeInView delay={80}>
              <MotionPressable style={styles.orderCard} onPress={() => navigation.navigate('Seguimiento', { orderId: recentOrder.id })}>
                <View style={styles.orderCardHeader}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.orderCardTitle}>Pedido reciente</Text>
                    <Text style={styles.orderCardId}>{recentOrder.id}</Text>
                  </View>
                  <StatusPill status={recentOrder.status} label={recentStatus.label} icon={recentStatus.icon} compact />
                </View>
                <Text style={styles.orderCardText}>{recentOrder.deliveryMethod === 'pickup' ? 'Recoge en tienda' : recentOrder.address}</Text>
              </MotionPressable>
            </FadeInView>
          ) : null}

          <FadeInView delay={120}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Categorías</Text>
              <Text style={styles.sectionText}>Misma línea artesanal, pero pensada para tocar y navegar rápido.</Text>
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.categoryRow}>
              {categories.filter((item) => item.id !== 'all').map((category) => (
                <MotionPressable
                  key={category.id}
                  style={[styles.categoryCard, { backgroundColor: category.accent }]}
                  onPress={() => navigation.navigate('Catalogo', { categoryId: category.id })}
                >
                  <View style={styles.categoryIconCircle}>
                    <Ionicons name={category.icon} size={26} color={colors.primary} />
                  </View>
                  <Text style={styles.categoryLabel}>{category.label}</Text>
                </MotionPressable>
              ))}
            </ScrollView>
          </FadeInView>

          <FadeInView delay={180}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Destacados</Text>
              <Text style={styles.sectionText}>Ya con fotos reales y tarjetas más cercanas a tu catálogo web.</Text>
            </View>
            <ScrollView
              ref={featuredScrollRef}
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.productRow}
              snapToInterval={FEATURED_STEP}
              decelerationRate="fast"
              snapToAlignment="start"
              onTouchStart={pauseFeaturedAutoplay}
              onScrollBeginDrag={pauseFeaturedAutoplay}
              onMomentumScrollEnd={syncFeaturedIndex}
            >
              {featured.map((product) => (
                <ProductCard
                  key={product.id}
                  compact
                  product={product}
                  onPress={() => navigation.navigate('Producto', { productId: product.id })}
                  onAddToCart={() => addItem(product.id, 1)}
                />
              ))}
            </ScrollView>
          </FadeInView>

          <FadeInView delay={240}>
            <View style={styles.dualRow}>
              <View style={styles.statCard}>
                <Text style={styles.statValue}>{featured.length}</Text>
                <Text style={styles.statLabel}>productos destacados</Text>
              </View>
              <View style={styles.statCard}>
                <Text style={styles.statValue}>{lowStock.length}</Text>
                <Text style={styles.statLabel}>productos por agotarse</Text>
              </View>
            </View>
          </FadeInView>
        </>
      ) : null}
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  orderCard: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    padding: spacing.lg,
    marginBottom: spacing.lg,
    ...shadows.soft,
  },
  orderCardHeader: {
    flexDirection: 'row',
    gap: spacing.md,
    alignItems: 'center',
  },
  orderCardTitle: {
    color: colors.text,
    fontWeight: '800',
  },
  orderCardId: {
    color: colors.textSoft,
    marginTop: 3,
    fontSize: typography.caption,
  },
  orderCardText: {
    color: colors.textSoft,
    marginTop: spacing.sm,
    lineHeight: 20,
  },
  sectionHeader: {
    marginBottom: spacing.md,
  },
  sectionTitle: {
    fontSize: typography.heading,
    fontWeight: '800',
    color: colors.text,
  },
  sectionText: {
    marginTop: 4,
    color: colors.textSoft,
    lineHeight: 20,
  },
  categoryRow: {
    paddingBottom: spacing.md,
  },
  categoryCard: {
    width: 138,
    padding: spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.lg,
    marginRight: spacing.md,
    gap: spacing.sm,
    ...shadows.soft,
  },
  categoryIconCircle: {
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: 'rgba(255,255,255,0.6)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  categoryLabel: {
    color: colors.text,
    fontWeight: '800',
    textAlign: 'center',
  },
  productRow: {
    paddingBottom: spacing.md,
    paddingRight: spacing.md,
  },
  dualRow: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  statCard: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadows.card,
  },
  statValue: {
    color: colors.primary,
    fontSize: typography.heading,
    fontWeight: '800',
  },
  statLabel: {
    color: colors.textSoft,
    marginTop: spacing.xs,
  },
});
