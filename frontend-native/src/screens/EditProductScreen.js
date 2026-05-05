import { useMemo, useState } from 'react';
import { Alert, Image, StyleSheet, Switch, Text, TextInput, View } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import ScreenContainer from '../components/ScreenContainer';
import FadeInView from '../components/FadeInView';
import MotionPressable from '../components/MotionPressable';
import { colors, radius, shadows, spacing, typography } from '../theme';
import { useProducts } from '../context/ProductsContext';
import { useSession } from '../context/SessionContext';
import { hapticError, hapticSuccess, hapticWarning } from '../lib/haptics';

function buildPlaceholder(name = 'Producto') {
  const label = encodeURIComponent(String(name || 'Producto').trim() || 'Producto');
  return { uri: `https://placehold.co/720x720/f2e5cf/6c4724?text=${label}` };
}

export default function EditProductScreen({ route, navigation }) {
  const { productId } = route.params || {};
  const creating = !productId;
  const { user } = useSession();
  const { getProductById, categories, updateProduct, createProduct } = useProducts();
  const product = creating ? null : getProductById(productId);
  const categoryOptions = useMemo(() => categories.filter((item) => item.id !== 'all'), [categories]);
  const [name, setName] = useState(product?.name || '');
  const [price, setPrice] = useState(product ? String(product.price) : '');
  const [stock, setStock] = useState(product ? String(product.stock) : '');
  const [description, setDescription] = useState(product?.description || '');
  const [category, setCategory] = useState(product?.category || categoryOptions[0]?.id || 'artesanias');
  const [featured, setFeatured] = useState(Boolean(product?.featured));
  const [imageKey, setImageKey] = useState(product?.imageKey || '');
  const [imageData, setImageData] = useState(product?.imageData || '');
  const [saving, setSaving] = useState(false);

  if (!creating && !product) {
    return (
      <ScreenContainer>
        <Text style={styles.emptyTitle}>Producto no encontrado</Text>
      </ScreenContainer>
    );
  }

  const previewSource = imageData
    ? { uri: imageData }
    : (product?.image || (imageKey ? { uri: imageKey } : buildPlaceholder(name || product?.name || 'Producto')));

  const handlePickImage = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      hapticWarning();
      Alert.alert('Permiso requerido', 'Necesitamos acceso a tus fotos para cambiar la imagen del producto.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.72,
      base64: true,
    });

    if (result.canceled || !result.assets?.length) return;

    const asset = result.assets[0];
    const mimeType = asset.mimeType || 'image/jpeg';
    const nextImageData = asset.base64 ? `data:${mimeType};base64,${asset.base64}` : asset.uri;
    setImageData(nextImageData || '');
    setImageKey('');
  };

  const handleTakePhoto = async () => {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) {
      hapticWarning();
      Alert.alert('Permiso requerido', 'Necesitamos permiso de cámara para tomar la foto del producto.');
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.72,
      base64: true,
    });

    if (result.canceled || !result.assets?.length) return;

    const asset = result.assets[0];
    if (!asset.base64) {
      hapticError();
      Alert.alert('Error al capturar', 'No se pudo procesar la foto. Intenta tomarla de nuevo.');
      return;
    }
    const mimeType = asset.mimeType || 'image/jpeg';
    const nextImageData = `data:${mimeType};base64,${asset.base64}`;
    setImageData(nextImageData);
    setImageKey('');
  };

  const handleSave = async () => {
    const nextPrice = Number(price);
    const nextStock = Number(stock);
    const selectedCategory = categoryOptions.find((item) => item.id === category);

    if (!name.trim() || !description.trim()) {
      hapticWarning();
      Alert.alert('Faltan datos', 'Completa nombre y descripción.');
      return;
    }
    if (Number.isNaN(nextPrice) || nextPrice <= 0) {
      hapticWarning();
      Alert.alert('Precio inválido', 'Escribe un precio mayor a 0.');
      return;
    }
    if (Number.isNaN(nextStock) || nextStock < 0) {
      hapticWarning();
      Alert.alert('Stock inválido', 'El stock no puede ser negativo.');
      return;
    }

    try {
      setSaving(true);
      if (!user?.id) throw new Error('Inicia sesión para crear o editar productos');
      const payload = {
        sellerId: user.id,
        sellerName: user?.name || 'Vendedor',
        name: name.trim(),
        category,
        categoryLabel: selectedCategory?.label || product?.categoryLabel || 'General',
        price: nextPrice,
        stock: nextStock,
        description: description.trim(),
        featured,
        local: product?.local ?? true,
        verified: product?.verified ?? true,
        rating: product?.rating ?? 5,
        views: product?.views ?? 0,
        imageKey: imageData ? '' : imageKey,
        imageData: imageData || '',
      };

      if (creating) {
        await createProduct(payload);
        hapticSuccess();
        Alert.alert('Producto creado', 'El producto ya quedó agregado al catálogo.');
        navigation.replace('EditarProductoLista');
      } else {
        await updateProduct(product.id, {
          sellerName: payload.sellerName,
          name: payload.name,
          category: payload.category,
          categoryLabel: payload.categoryLabel,
          price: payload.price,
          stock: payload.stock,
          description: payload.description,
          featured: payload.featured,
          imageKey: payload.imageKey,
          imageData: payload.imageData,
        });
        hapticSuccess();
        Alert.alert('Guardado', 'El producto ya quedó actualizado.');
        navigation.goBack();
      }
    } catch (error) {
      hapticError();
      Alert.alert('No se pudo guardar', error?.message || 'Intenta nuevamente en unos segundos.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <ScreenContainer>
      <FadeInView>
        <Text style={styles.title}>{creating ? 'Nuevo producto' : 'Editar producto'}</Text>
        <Text style={styles.subtitle}>{creating ? 'Crea un producto nuevo desde el móvil y publícalo en el catálogo.' : 'Cambia la información de venta y se reflejará en el catálogo móvil.'}</Text>
      </FadeInView>

      <FadeInView delay={80}>
        <View style={styles.card}>
          <Field label="Imagen del producto">
            <Image source={previewSource} style={styles.previewImage} resizeMode="cover" />
            <View style={styles.photoActionRow}>
              <MotionPressable style={styles.galleryButton} onPress={handlePickImage}>
                <Text style={styles.galleryButtonText}>Elegir de galería</Text>
              </MotionPressable>
              <MotionPressable style={styles.cameraButton} onPress={handleTakePhoto}>
                <Text style={styles.cameraButtonText}>Tomar foto</Text>
              </MotionPressable>
            </View>
          </Field>

          <Field label="Nombre del producto">
            <TextInput value={name} onChangeText={setName} style={styles.input} placeholder="Nombre" placeholderTextColor={colors.textMuted} />
          </Field>

          <Field label="Categoría">
            <View style={styles.categoryWrap}>
              {categoryOptions.map((item) => {
                const active = item.id === category;
                return (
                  <MotionPressable key={item.id} style={[styles.categoryChip, active && styles.categoryChipActive]} onPress={() => setCategory(item.id)}>
                    <Text style={[styles.categoryChipText, active && styles.categoryChipTextActive]}>{item.label}</Text>
                  </MotionPressable>
                );
              })}
            </View>
          </Field>

          <View style={styles.inlineFields}>
            <View style={{ flex: 1 }}>
              <Field label="Precio">
                <TextInput value={price} onChangeText={setPrice} style={styles.input} keyboardType="numeric" placeholder="$0" placeholderTextColor={colors.textMuted} />
              </Field>
            </View>
            <View style={{ flex: 1 }}>
              <Field label="Stock">
                <TextInput value={stock} onChangeText={setStock} style={styles.input} keyboardType="numeric" placeholder="0" placeholderTextColor={colors.textMuted} />
              </Field>
            </View>
          </View>

          <Field label="Descripción">
            <TextInput
              value={description}
              onChangeText={setDescription}
              style={[styles.input, styles.textarea]}
              multiline
              placeholder="Descripción del producto"
              placeholderTextColor={colors.textMuted}
            />
          </Field>

          <View style={styles.switchRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.fieldLabel}>Mostrar como destacado</Text>
              <Text style={styles.fieldHelper}>Si lo activas, aparecerá como producto destacado en la app.</Text>
            </View>
            <Switch value={featured} onValueChange={setFeatured} trackColor={{ false: colors.border, true: colors.primarySoft }} thumbColor={featured ? colors.primary : colors.surface} />
          </View>
        </View>
      </FadeInView>

      <FadeInView delay={160}>
        <MotionPressable style={[styles.saveButton, saving && styles.buttonDisabled]} onPress={handleSave} disabled={saving}>
          <Text style={styles.saveButtonText}>{saving ? 'Guardando...' : creating ? 'Crear producto' : 'Guardar cambios'}</Text>
        </MotionPressable>
      </FadeInView>
    </ScreenContainer>
  );
}

function Field({ label, children }) {
  return (
    <View style={styles.fieldBlock}>
      <Text style={styles.fieldLabel}>{label}</Text>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  title: { color: colors.text, fontSize: typography.heading, fontWeight: '800' },
  subtitle: { color: colors.textSoft, lineHeight: 21, marginTop: 6, marginBottom: spacing.lg },
  emptyTitle: { color: colors.text, fontSize: typography.heading, fontWeight: '800' },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    gap: spacing.md,
    ...shadows.card,
  },
  fieldBlock: { gap: spacing.xs },
  fieldLabel: { color: colors.text, fontWeight: '800' },
  fieldHelper: { color: colors.textSoft, lineHeight: 18, marginTop: 2 },
  previewImage: {
    width: '100%',
    height: 220,
    borderRadius: radius.lg,
    backgroundColor: colors.surfaceMuted,
  },
  galleryButton: {
    marginTop: spacing.sm,
    flex: 1,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
    borderRadius: radius.pill,
    paddingVertical: spacing.sm,
    alignItems: 'center',
  },
  galleryButtonText: { color: colors.text, fontWeight: '700' },
  photoActionRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  cameraButton: {
    marginTop: spacing.sm,
    flex: 1,
    borderWidth: 1,
    borderColor: colors.primary,
    backgroundColor: colors.primary,
    borderRadius: radius.pill,
    paddingVertical: spacing.sm,
    alignItems: 'center',
  },
  cameraButtonText: { color: colors.white, fontWeight: '700' },
  input: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    color: colors.text,
  },
  textarea: { minHeight: 110, textAlignVertical: 'top' },
  categoryWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  categoryChip: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  categoryChipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  categoryChipText: { color: colors.text, fontWeight: '700' },
  categoryChipTextActive: { color: colors.white },
  inlineFields: { flexDirection: 'row', gap: spacing.md },
  switchRow: {
    flexDirection: 'row',
    gap: spacing.md,
    alignItems: 'center',
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing.md,
  },
  saveButton: {
    marginTop: spacing.lg,
    backgroundColor: colors.primary,
    borderRadius: radius.pill,
    paddingVertical: spacing.md,
    alignItems: 'center',
    ...shadows.soft,
  },
  saveButtonText: { color: colors.white, fontWeight: '800', fontSize: typography.body },
  buttonDisabled: { opacity: 0.7 },
});

