import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import ScreenContainer from '../components/ScreenContainer';
import FadeInView from '../components/FadeInView';
import MotionPressable from '../components/MotionPressable';
import { formatPrice } from '../data/demoData';
import { colors, radius, shadows, spacing, typography } from '../theme';
import { useSession } from '../context/SessionContext';
import { useProducts } from '../context/ProductsContext';

export default function SellerProductsScreen({ navigation }) {
  const { user } = useSession();
  const { getSellerProducts } = useProducts();
  const sellerId = user?.id || 'vendedor-1';
  const sellerProducts = getSellerProducts(sellerId);

  return (
    <ScreenContainer>
      <FadeInView>
        <Text style={styles.title}>Editar productos</Text>
        <Text style={styles.subtitle}>Aquí puedes abrir cualquier producto y ajustar nombre, precio, stock, categoría, imagen o descripción.</Text>
        <MotionPressable style={styles.createButton} onPress={() => navigation.navigate('CrearProducto')}>
          <Text style={styles.createButtonText}>Crear nuevo producto</Text>
        </MotionPressable>
      </FadeInView>

      <FadeInView delay={80}>
        <View style={styles.section}>
          {sellerProducts.map((product) => (
            <MotionPressable key={product.id} style={styles.card} onPress={() => navigation.navigate('EditarProducto', { productId: product.id })}>
              <View style={styles.cardTop}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.cardTitle}>{product.name}</Text>
                  <Text style={styles.cardSub}>{product.categoryLabel}</Text>
                </View>
                <Ionicons name="create-outline" size={20} color={colors.primary} />
              </View>
              <View style={styles.cardBottom}>
                <Text style={styles.price}>{formatPrice(product.price)}</Text>
                <Text style={styles.stock}>{product.stock} unidades</Text>
              </View>
            </MotionPressable>
          ))}
        </View>
      </FadeInView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  title: { color: colors.text, fontSize: typography.heading, fontWeight: '800' },
  subtitle: { color: colors.textSoft, lineHeight: 21, marginTop: 6, marginBottom: spacing.lg },
  createButton: {
    backgroundColor: colors.primary,
    borderRadius: radius.pill,
    paddingVertical: spacing.sm,
    alignItems: 'center',
    ...shadows.soft,
  },
  createButtonText: { color: colors.white, fontWeight: '800' },
  section: { gap: spacing.md, marginTop: spacing.lg },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    gap: spacing.sm,
    ...shadows.card,
  },
  cardTop: { flexDirection: 'row', gap: spacing.md, alignItems: 'center' },
  cardTitle: { color: colors.text, fontWeight: '800', fontSize: typography.subheading },
  cardSub: { color: colors.textSoft, marginTop: 4 },
  cardBottom: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  price: { color: colors.primary, fontWeight: '800', fontSize: typography.subheading },
  stock: { color: colors.textSoft, fontWeight: '700' },
});

