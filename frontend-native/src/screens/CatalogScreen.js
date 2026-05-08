import { useCallback, useEffect, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, TextInput, View, useWindowDimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import ProductCard from '../components/ProductCard';
import ScreenContainer from '../components/ScreenContainer';
import MotionPressable from '../components/MotionPressable';
import { SkeletonList } from '../components/SkeletonList';
import { colors, radius, shadows, spacing, typography } from '../theme';
import { useCart } from '../context/CartContext';
import { useProducts } from '../context/ProductsContext';
import { hapticSelection } from '../lib/haptics';

const sortOptions = [
  { id: 'featured', label: 'Destacados' },
  { id: 'price_asc', label: 'Menor precio' },
  { id: 'price_desc', label: 'Mayor precio' },
  { id: 'stock_desc', label: 'Más stock' },
];

export default function CatalogScreen({ navigation, route }) {
  const { width } = useWindowDimensions();
  const { ready, categories, products, refreshProducts } = useProducts();
  const initialCategory = route?.params?.categoryId || 'all';

  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState(initialCategory);
  const [activeFlags, setActiveFlags] = useState({ featured: false, local: false, verified: false, lowStock: false });
  const [sortBy, setSortBy] = useState('featured');
  const [refreshing, setRefreshing] = useState(false);

  const { addItem } = useCart();

  const columns = width >= 360 ? 2 : 1;
  const horizontalPadding = spacing.lg * 2;
  const cardGap = spacing.md;
  const cardWidth = columns === 2
    ? Math.floor((width - horizontalPadding - cardGap) / 2)
    : width - horizontalPadding;

  useEffect(() => {
    if (route?.params?.categoryId) {
      setSelectedCategory(route.params.categoryId);
    }
  }, [route?.params?.categoryId]);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    const list = products.filter((product) => {
      const byCategory = selectedCategory === 'all' || product.category === selectedCategory;
      const bySearch = !term
        || product.name.toLowerCase().includes(term)
        || product.categoryLabel.toLowerCase().includes(term)
        || product.description.toLowerCase().includes(term)
        || product.sellerName.toLowerCase().includes(term);
      const byFeatured = !activeFlags.featured || product.featured;
      const byLocal = !activeFlags.local || product.local;
      const byVerified = !activeFlags.verified || product.verified;
      const byLowStock = !activeFlags.lowStock || product.stock <= 10;
      return byCategory && bySearch && byFeatured && byLocal && byVerified && byLowStock;
    });

    return [...list].sort((a, b) => {
      if (sortBy === 'price_asc') return a.price - b.price;
      if (sortBy === 'price_desc') return b.price - a.price;
      if (sortBy === 'stock_desc') return b.stock - a.stock;
      return Number(b.featured) - Number(a.featured) || b.views - a.views;
    });
  }, [activeFlags, products, search, selectedCategory, sortBy]);

  const activeFilterCount = useMemo(() => {
    const flagCount = Object.values(activeFlags).filter(Boolean).length;
    const categoryCount = selectedCategory === 'all' ? 0 : 1;
    const searchCount = search.trim() ? 1 : 0;
    return flagCount + categoryCount + searchCount;
  }, [activeFlags, search, selectedCategory]);

  const clearFilters = useCallback(() => {
    hapticSelection();
    setSearch('');
    setSelectedCategory('all');
    setActiveFlags({ featured: false, local: false, verified: false, lowStock: false });
    setSortBy('featured');
  }, []);

  const toggleFlag = (key) => {
    hapticSelection();
    setActiveFlags((current) => ({ ...current, [key]: !current[key] }));
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
      {!ready ? <SkeletonList count={4} /> : null}
      {ready ? (
        <>
          <View style={styles.heroCard}>
            <Text style={styles.title}>Catálogo móvil</Text>
            <Text style={styles.subtitle}>Explora productos en tiempo real y filtra rápido por categoría, precio y disponibilidad.</Text>
            <View style={styles.searchWrap}>
              <Ionicons name="search-outline" size={18} color={colors.textSoft} />
              <TextInput
                value={search}
                onChangeText={setSearch}
                placeholder="Buscar productos, vendedor o categoría"
                placeholderTextColor={colors.textMuted}
                style={styles.search}
              />
            </View>
            <View style={styles.heroMetaRow}>
              <View style={styles.metaPill}>
                <Ionicons name="layers-outline" size={14} color={colors.primaryDark} />
                <Text style={styles.metaPillText}>{filtered.length} visibles</Text>
              </View>
              <View style={styles.metaPill}>
                <Ionicons name="funnel-outline" size={14} color={colors.primaryDark} />
                <Text style={styles.metaPillText}>{activeFilterCount} filtros activos</Text>
              </View>
              {activeFilterCount ? (
                <MotionPressable style={styles.clearChip} onPress={clearFilters}>
                  <Text style={styles.clearChipText}>Limpiar</Text>
                </MotionPressable>
              ) : null}
            </View>
          </View>

          <View style={styles.sectionBlock}>
            <Text style={styles.sectionLabel}>Categorías</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipsRow}>
              {categories.map((item) => {
                const active = item.id === selectedCategory;
                return (
                  <MotionPressable
                    key={item.id}
                    style={[styles.chip, active && styles.chipActive]}
                    onPress={() => {
                      hapticSelection();
                      setSelectedCategory(item.id);
                    }}
                  >
                    <Text style={[styles.chipText, active && styles.chipTextActive]}>{item.label}</Text>
                  </MotionPressable>
                );
              })}
            </ScrollView>
          </View>

          <View style={styles.sectionBlock}>
            <Text style={styles.sectionLabel}>Filtros rápidos</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipsRow}>
              <FilterChip label="Destacados" active={activeFlags.featured} onPress={() => toggleFlag('featured')} />
              <FilterChip label="Solo local" active={activeFlags.local} onPress={() => toggleFlag('local')} />
              <FilterChip label="Verificados" active={activeFlags.verified} onPress={() => toggleFlag('verified')} />
              <FilterChip label="Poco stock" active={activeFlags.lowStock} onPress={() => toggleFlag('lowStock')} />
            </ScrollView>
          </View>

          <View style={styles.sectionBlock}>
            <Text style={styles.sectionLabel}>Ordenar por</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipsRow}>
              {sortOptions.map((option) => {
                const active = option.id === sortBy;
                return (
                  <MotionPressable
                    key={option.id}
                    style={[styles.sortChip, active && styles.sortChipActive]}
                    onPress={() => {
                      hapticSelection();
                      setSortBy(option.id);
                    }}
                  >
                    <Text style={[styles.sortChipText, active && styles.sortChipTextActive]}>{option.label}</Text>
                  </MotionPressable>
                );
              })}
            </ScrollView>
          </View>

          <View style={styles.resultsHeader}>
            <Text style={styles.resultsTitle}>{filtered.length} producto(s)</Text>
            <Text style={styles.resultsText}>Toca una tarjeta para ver detalle</Text>
          </View>

          <View style={[styles.grid, columns === 1 && styles.gridSingleColumn]}>
            {filtered.map((item) => (
              <View key={item.id} style={[styles.cardWrap, { width: cardWidth }]}>
                <ProductCard
                  dense={columns === 2}
                  product={item}
                  onPress={() => navigation.navigate('Producto', { productId: item.id })}
                  onAddToCart={() => addItem(item.id, 1)}
                />
              </View>
            ))}
          </View>
          {!filtered.length ? (
            <View style={styles.emptyCard}>
              <Ionicons name="search-outline" size={32} color={colors.primary} />
              <Text style={styles.emptyTitle}>No encontramos coincidencias</Text>
              <Text style={styles.emptyText}>Prueba quitando filtros o cambiando el texto de búsqueda.</Text>
            </View>
          ) : null}
        </>
      ) : null}
    </ScreenContainer>
  );
}

function FilterChip({ label, active, onPress }) {
  return (
    <MotionPressable style={[styles.filterChip, active && styles.filterChipActive]} onPress={onPress}>
      <Text style={[styles.filterChipText, active && styles.filterChipTextActive]}>{label}</Text>
    </MotionPressable>
  );
}

const styles = StyleSheet.create({
  title: {
    fontSize: typography.heading,
    fontWeight: '800',
    color: colors.text,
  },
  heroCard: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    padding: spacing.lg,
    ...shadows.soft,
  },
  subtitle: {
    color: colors.textSoft,
    marginTop: 6,
    marginBottom: spacing.md,
    lineHeight: 20,
  },
  searchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.surface,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.lg,
    ...shadows.soft,
  },
  search: {
    flex: 1,
    paddingVertical: spacing.sm,
    color: colors.text,
  },
  heroMetaRow: {
    marginTop: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  metaPill: {
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: '#fff3df',
    paddingHorizontal: spacing.sm,
    paddingVertical: 6,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  metaPillText: {
    color: colors.primaryDark,
    fontSize: typography.caption,
    fontWeight: '700',
  },
  clearChip: {
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.primary,
    backgroundColor: colors.card,
    paddingHorizontal: spacing.sm,
    paddingVertical: 6,
  },
  clearChipText: {
    color: colors.primaryDark,
    fontSize: typography.caption,
    fontWeight: '800',
  },
  sectionBlock: {
    marginTop: spacing.lg,
  },
  sectionLabel: {
    color: colors.text,
    fontWeight: '800',
    marginBottom: spacing.sm,
  },
  chipsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingRight: spacing.md,
  },
  chip: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    marginRight: spacing.sm,
  },
  chipActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  chipText: {
    color: colors.text,
    fontWeight: '700',
  },
  chipTextActive: {
    color: colors.white,
  },
  filterChip: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    marginRight: spacing.sm,
  },
  filterChipActive: {
    backgroundColor: '#fff1dc',
    borderColor: colors.borderStrong,
  },
  filterChipText: {
    color: colors.textSoft,
    fontWeight: '700',
  },
  filterChipTextActive: {
    color: colors.primaryDark,
  },
  sortChip: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    marginRight: spacing.sm,
  },
  sortChipActive: {
    backgroundColor: colors.accent,
    borderColor: colors.accent,
  },
  sortChipText: {
    color: colors.text,
    fontWeight: '700',
  },
  sortChipTextActive: {
    color: colors.white,
  },
  resultsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: spacing.xl,
    marginBottom: spacing.md,
  },
  resultsTitle: {
    color: colors.text,
    fontWeight: '800',
  },
  resultsText: {
    color: colors.textSoft,
    fontSize: 12,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  gridSingleColumn: {
    justifyContent: 'flex-start',
  },
  cardWrap: {
    marginBottom: spacing.md,
  },
  emptyCard: {
    marginTop: spacing.xl,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.xl,
    alignItems: 'center',
    gap: spacing.sm,
    ...shadows.card,
  },
  emptyTitle: {
    color: colors.text,
    fontWeight: '800',
    fontSize: typography.subheading,
  },
  emptyText: {
    color: colors.textSoft,
    textAlign: 'center',
  },
});
