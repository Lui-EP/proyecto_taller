import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import MotionPressable from './MotionPressable';
import { colors, radius, shadows, spacing, typography } from '../theme';
import { formatPrice } from '../data/utils';

export default function ProductCard({ product, onPress, onAddToCart, compact = false, dense = false }) {
  const outOfStock = product.stock < 1;

  return (
    <MotionPressable style={[styles.card, compact && styles.compactCard, dense && styles.denseCard]} onPress={onPress}>
      <Image source={product.image} style={[styles.image, compact && styles.compactImage, dense && styles.denseImage]} resizeMode="cover" />
      <View style={styles.overlayRow}>
        {outOfStock ? <Badge label="Agotado" tone="danger" /> : null}
        {product.featured ? <Badge label="Destacado" tone="warm" /> : null}
        {product.local ? <Badge label="Local" tone="soft" /> : null}
      </View>
      <View style={[styles.body, dense && styles.denseBody]}>
        <Text style={styles.category}>{product.categoryLabel.toUpperCase()}</Text>
        <Text style={[styles.name, dense && styles.denseName]} numberOfLines={2}>{product.name}</Text>
        <Text style={[styles.price, dense && styles.densePrice]}>{formatPrice(product.price)}</Text>
        <View style={[styles.metaRow, dense && styles.denseMetaRow]}>
          <Ionicons name="cube-outline" size={14} color={colors.textSoft} />
          <Text style={styles.meta}>{outOfStock ? 'Sin stock' : `${product.stock} unidades`}</Text>
          <Ionicons name="star" size={14} color={colors.warning} />
          <Text style={styles.meta}>{product.rating.toFixed(1)}</Text>
        </View>
        <Text style={styles.seller}>{product.sellerName}</Text>
        {onAddToCart ? (
          <Pressable style={[styles.button, dense && styles.denseButton, outOfStock && styles.buttonDisabled]} onPress={onAddToCart} disabled={outOfStock}>
            <Text style={[styles.buttonText, dense && styles.denseButtonText]}>{outOfStock ? 'Agotado' : 'Agregar'}</Text>
          </Pressable>
        ) : null}
      </View>
    </MotionPressable>
  );
}

function Badge({ label, tone }) {
  const toneStyles = {
    warm: styles.badgeWarm,
    soft: styles.badgeSoft,
    danger: styles.badgeDanger,
  };

  return (
    <View style={[styles.badge, toneStyles[tone]]}>
      <Text style={styles.badgeText}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    width: '100%',
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
    marginBottom: spacing.md,
    ...shadows.card,
  },
  compactCard: {
    width: 252,
    marginRight: spacing.md,
  },
  denseCard: {
    marginBottom: 0,
  },
  image: {
    width: '100%',
    height: 184,
    backgroundColor: colors.surfaceMuted,
  },
  compactImage: {
    height: 170,
  },
  denseImage: {
    height: 148,
  },
  overlayRow: {
    position: 'absolute',
    top: spacing.md,
    left: spacing.md,
    right: spacing.md,
    flexDirection: 'row',
    gap: spacing.xs,
    flexWrap: 'wrap',
  },
  body: {
    padding: spacing.md,
    gap: 6,
  },
  denseBody: {
    padding: spacing.sm,
    gap: 4,
  },
  category: {
    color: colors.textSoft,
    fontSize: typography.caption,
    letterSpacing: 0.7,
  },
  name: {
    color: colors.text,
    fontSize: typography.subheading,
    fontWeight: '800',
    minHeight: 46,
  },
  denseName: {
    fontSize: 16,
    minHeight: 40,
  },
  price: {
    color: colors.primary,
    fontSize: typography.heading,
    fontWeight: '800',
  },
  densePrice: {
    fontSize: 17,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexWrap: 'wrap',
  },
  denseMetaRow: {
    gap: 4,
  },
  meta: {
    color: colors.textSoft,
    fontSize: typography.caption,
  },
  seller: {
    color: colors.text,
    fontSize: typography.caption,
    fontWeight: '700',
  },
  badge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 6,
    borderRadius: radius.pill,
  },
  badgeWarm: {
    backgroundColor: '#f7e0bf',
  },
  badgeSoft: {
    backgroundColor: '#dceadf',
  },
  badgeDanger: {
    backgroundColor: colors.dangerSoft,
  },
  badgeText: {
    color: colors.text,
    fontSize: 12,
    fontWeight: '700',
  },
  button: {
    marginTop: spacing.xs,
    backgroundColor: colors.primary,
    borderRadius: radius.pill,
    paddingVertical: spacing.sm,
    alignItems: 'center',
  },
  denseButton: {
    paddingVertical: 10,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    color: colors.white,
    fontWeight: '800',
  },
  denseButtonText: {
    fontSize: 14,
  },
});
