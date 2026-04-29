import { useState } from 'react';
import { Alert, Image, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import ScreenContainer from '../components/ScreenContainer';
import FadeInView from '../components/FadeInView';
import MotionPressable from '../components/MotionPressable';
import StatusPill from '../components/StatusPill';
import { formatPrice } from '../data/demoData';
import { colors, radius, shadows, spacing, typography } from '../theme';
import { useCart } from '../context/CartContext';
import { useProducts } from '../context/ProductsContext';

export default function ProductDetailScreen({ route, navigation }) {
  const { productId } = route.params || {};
  const { getProductById } = useProducts();
  const product = getProductById(productId);
  const { addItem } = useCart();
  const [quantity, setQuantity] = useState(1);

  if (!product) {
    return (
      <ScreenContainer scroll={false} contentStyle={styles.centered}>
        <Text style={styles.emptyTitle}>Producto no encontrado</Text>
      </ScreenContainer>
    );
  }

  const total = product.price * quantity;

  const handleAdd = async () => {
    if (product.stock < 1) {
      Alert.alert('Sin stock', 'Este producto ya no tiene unidades disponibles.');
      return;
    }
    await addItem(product.id, quantity);
  };

  return (
    <ScreenContainer>
      <FadeInView>
        <Image source={product.image} style={styles.image} resizeMode="cover" />
      </FadeInView>

      <FadeInView delay={80}>
        <View style={styles.card}>
          <Text style={styles.category}>{product.categoryLabel}</Text>
          <Text style={styles.name}>{product.name}</Text>
          <Text style={styles.price}>{formatPrice(product.price)}</Text>

          <View style={styles.row}>
            <StatusPill status="pedido_realizado" label={`${product.stock} unidades`} icon="cube-outline" compact />
            {product.local ? <StatusPill status="listo_recoger" label="Local" icon="leaf-outline" compact /> : null}
            {product.verified ? <StatusPill status="entregado" label="Verificado" icon="shield-checkmark-outline" compact /> : null}
          </View>

          <Text style={styles.description}>{product.description}</Text>

          <View style={styles.metaBox}>
            <InfoLine icon="person-outline" label="Vendedor" value={product.sellerName} />
            <InfoLine icon="star-outline" label="Calificación" value={`${product.rating.toFixed(1)} / 5`} />
            <InfoLine icon="eye-outline" label="Vistas" value={`${product.views}`} />
          </View>

          <View style={styles.qtyWrap}>
            <Text style={styles.qtyLabel}>Cantidad</Text>
            <View style={styles.qtyRow}>
              <MotionPressable style={styles.qtyBtn} onPress={() => setQuantity((value) => Math.max(1, value - 1))}>
                <Text style={styles.qtyBtnText}>-</Text>
              </MotionPressable>
              <Text style={styles.qtyValue}>{quantity}</Text>
              <MotionPressable style={styles.qtyBtn} onPress={() => setQuantity((value) => Math.min(product.stock, value + 1))}>
                <Text style={styles.qtyBtnText}>+</Text>
              </MotionPressable>
            </View>
          </View>

          <View style={styles.totalCard}>
            <Text style={styles.totalLabel}>Total estimado</Text>
            <Text style={styles.totalValue}>{formatPrice(total)}</Text>
          </View>

          <MotionPressable style={[styles.button, product.stock < 1 && styles.buttonDisabled]} onPress={handleAdd} disabled={product.stock < 1}>
            <Text style={styles.buttonText}>{product.stock < 1 ? 'Sin stock disponible' : 'Agregar al carrito'}</Text>
          </MotionPressable>
          <MotionPressable style={styles.secondaryButton} onPress={() => navigation.navigate('Carrito')}>
            <Text style={styles.secondaryButtonText}>Ir al carrito</Text>
          </MotionPressable>
        </View>
      </FadeInView>
    </ScreenContainer>
  );
}

function InfoLine({ icon, label, value }) {
  return (
    <View style={styles.infoLine}>
      <Ionicons name={icon} size={16} color={colors.primary} />
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyTitle: {
    color: colors.text,
    fontSize: typography.heading,
    fontWeight: '800',
  },
  image: {
    width: '100%',
    height: 340,
    borderRadius: radius.xl,
    marginBottom: spacing.lg,
    backgroundColor: colors.surfaceMuted,
  },
  card: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    padding: spacing.lg,
    gap: spacing.md,
    ...shadows.card,
  },
  category: {
    color: colors.textSoft,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  name: {
    color: colors.text,
    fontSize: typography.heading,
    fontWeight: '800',
  },
  price: {
    color: colors.primary,
    fontSize: 30,
    fontWeight: '800',
  },
  row: {
    flexDirection: 'row',
    gap: spacing.xs,
    flexWrap: 'wrap',
  },
  description: {
    color: colors.textSoft,
    lineHeight: 22,
  },
  metaBox: {
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: spacing.md,
    gap: spacing.sm,
  },
  infoLine: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  infoLabel: {
    color: colors.textSoft,
    minWidth: 82,
  },
  infoValue: {
    flex: 1,
    color: colors.text,
    fontWeight: '700',
  },
  qtyWrap: {
    gap: spacing.sm,
  },
  qtyLabel: {
    color: colors.text,
    fontWeight: '800',
  },
  qtyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  qtyBtn: {
    width: 44,
    height: 44,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
    alignItems: 'center',
    justifyContent: 'center',
  },
  qtyBtnText: {
    color: colors.text,
    fontSize: 24,
    fontWeight: '800',
  },
  qtyValue: {
    color: colors.text,
    fontSize: typography.subheading,
    fontWeight: '800',
    minWidth: 36,
    textAlign: 'center',
  },
  totalCard: {
    backgroundColor: '#fff3df',
    borderRadius: radius.md,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  totalLabel: {
    color: colors.textSoft,
  },
  totalValue: {
    marginTop: 4,
    color: colors.primary,
    fontSize: typography.subheading,
    fontWeight: '800',
  },
  button: {
    backgroundColor: colors.primary,
    paddingVertical: spacing.md,
    borderRadius: radius.pill,
    alignItems: 'center',
  },
  buttonDisabled: {
    opacity: 0.65,
  },
  buttonText: {
    color: colors.white,
    fontWeight: '800',
  },
  secondaryButton: {
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: spacing.md,
    borderRadius: radius.pill,
    alignItems: 'center',
    backgroundColor: colors.card,
  },
  secondaryButtonText: {
    color: colors.text,
    fontWeight: '700',
  },
});
