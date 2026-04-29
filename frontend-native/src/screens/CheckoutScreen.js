import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import ScreenContainer from '../components/ScreenContainer';
import FadeInView from '../components/FadeInView';
import MotionPressable from '../components/MotionPressable';
import NativeLocationMap from '../components/NativeLocationMap';
import { useCart } from '../context/CartContext';
import { useOrders } from '../context/OrdersContext';
import { useSession } from '../context/SessionContext';
import {
  formatPrice,
  pickupStores,
} from '../data/demoData';
import { useForegroundLocation } from '../hooks/useForegroundLocation';
import {
  DEFAULT_CHIAPAS_COORDS,
  buildRegionFromPoints,
  hasLocationIqKey,
  reverseGeocodeLocation,
  searchAddressSuggestions,
} from '../lib/locationService';
import { hapticError, hapticSuccess, hapticWarning } from '../lib/haptics';
import { colors, radius, shadows, spacing, typography } from '../theme';

const ADDRESS_LOOKUP_DELAY = 700;

export default function CheckoutScreen({ navigation }) {
  const { items, subtotal, clearCart } = useCart();
  const { createOrder } = useOrders();
  const { user, guestId } = useSession();
  const [deliveryMethod, setDeliveryMethod] = useState('delivery');
  const [pickupStoreId, setPickupStoreId] = useState(pickupStores[0].id);
  const [customerName, setCustomerName] = useState(user?.name || '');
  const [phone, setPhone] = useState(user?.phone || '');
  const [addressState, setAddressState] = useState({
    text: user?.address || '',
    label: user?.address || '',
    colony: '',
    subdivision: '',
    coords: null,
    source: '',
  });
  const [note, setNote] = useState('');
  const [addressSuggestions, setAddressSuggestions] = useState([]);
  const [suggestionsLoading, setSuggestionsLoading] = useState(false);
  const [addressLookupStatus, setAddressLookupStatus] = useState('idle');
  const [submitting, setSubmitting] = useState(false);
  const lookupTimerRef = useRef(null);
  const suppressLookupRef = useRef(false);

  const {
    coords: deviceCoords,
    permissionStatus,
    loading: locatingDevice,
    requestCurrentLocation,
  } = useForegroundLocation();

  const selectedStore = useMemo(
    () => pickupStores.find((store) => store.id === pickupStoreId) || pickupStores[0],
    [pickupStoreId]
  );
  const shipping = deliveryMethod === 'delivery' ? 45 : 0;
  const total = subtotal + shipping;

  useEffect(() => () => {
    if (lookupTimerRef.current) {
      clearTimeout(lookupTimerRef.current);
      lookupTimerRef.current = null;
    }
  }, []);

  const applyResolvedAddress = useCallback((result, options = {}) => {
    if (!result) return;
    const updateText = options.updateText ?? true;
    const source = options.source || result.source || 'mapa';
    suppressLookupRef.current = updateText;
    setAddressState((prev) => ({
      ...prev,
      text: updateText ? result.display : prev.text,
      label: result.display || prev.label || prev.text,
      colony: result.colony || '',
      subdivision: result.subdivision || '',
      coords: {
        lat: Number(result.lat),
        lng: Number(result.lng),
      },
      source,
    }));
    setAddressLookupStatus('resolved');
  }, []);

  const resolveCoordsToAddress = useCallback(async (coords, options = {}) => {
    if (!coords) return;
    setAddressLookupStatus('locating');
    try {
      const resolved = await reverseGeocodeLocation(coords);
      applyResolvedAddress(resolved, options);
    } catch {
      setAddressLookupStatus('unresolved');
      setAddressState((prev) => ({
        ...prev,
        coords,
        source: options.source || prev.source || 'mapa',
      }));
    }
  }, [applyResolvedAddress]);

  const handleUseMyLocation = async () => {
    const coords = await requestCurrentLocation();
    if (!coords) {
      hapticWarning();
      Alert.alert('UbicaciÃ³n no disponible', 'Activa el permiso de ubicaciÃ³n para usar tu posiciÃ³n actual.');
      return;
    }

    await resolveCoordsToAddress(coords, { source: 'gps', updateText: true });
  };

  const handleMapPress = async (coords) => {
    await resolveCoordsToAddress(coords, { source: 'mapa', updateText: true });
  };

  const handleAddressChange = (text) => {
    setAddressState((prev) => ({
      ...prev,
      text,
      label: '',
      colony: '',
      subdivision: '',
      coords: null,
      source: 'typing',
    }));
    setAddressLookupStatus(text.trim().length >= 4 ? 'searching' : 'idle');
  };

  const handleSelectSuggestion = (suggestion) => {
    applyResolvedAddress(suggestion, { source: 'suggestion', updateText: true });
    setAddressSuggestions([]);
  };

  useEffect(() => {
    if (deliveryMethod !== 'delivery') return undefined;

    const query = String(addressState.text || '').trim();
    if (!query || query.length < 4) {
      setAddressSuggestions([]);
      setSuggestionsLoading(false);
      return undefined;
    }

    if (suppressLookupRef.current) {
      suppressLookupRef.current = false;
      return undefined;
    }

    if (lookupTimerRef.current) {
      clearTimeout(lookupTimerRef.current);
    }

    let active = true;
    lookupTimerRef.current = setTimeout(() => {
      setSuggestionsLoading(true);

      searchAddressSuggestions(query)
        .then((suggestions) => {
          if (!active) return;
          setAddressSuggestions(suggestions);
          if (suggestions[0]) {
            applyResolvedAddress(suggestions[0], { source: 'typing', updateText: false });
          } else {
            setAddressLookupStatus('unresolved');
          }
        })
        .catch(() => {
          if (!active) return;
          setAddressSuggestions([]);
          setAddressLookupStatus('unresolved');
        })
        .finally(() => {
          if (active) {
            setSuggestionsLoading(false);
          }
        });

    }, ADDRESS_LOOKUP_DELAY);

    return () => {
      active = false;
      if (lookupTimerRef.current) {
        clearTimeout(lookupTimerRef.current);
      }
    };
  }, [addressState.text, applyResolvedAddress, deliveryMethod]);

  const handleSubmit = async () => {
    if (!items.length) {
      hapticWarning();
      Alert.alert('Carrito vacÃ­o', 'Agrega productos antes de continuar.');
      return;
    }

    if (!customerName.trim() || !phone.trim()) {
      hapticWarning();
      Alert.alert('Faltan datos', 'Escribe tu nombre y telÃ©fono.');
      return;
    }

    if (deliveryMethod === 'delivery' && !addressState.text.trim()) {
      hapticWarning();
      Alert.alert('Falta direcciÃ³n', 'Escribe la direcciÃ³n de entrega.');
      return;
    }

    const deliveryAddress = addressState.label || addressState.text.trim();

    try {
      setSubmitting(true);
      const order = await createOrder({
        customerId: user?.id || guestId,
        customerName: customerName.trim() || 'Invitado',
        customerPhone: phone.trim(),
        deliveryMethod,
        pickupStoreId: deliveryMethod === 'pickup' ? selectedStore.id : '',
        pickupStoreName: deliveryMethod === 'pickup' ? selectedStore.name : '',
        pickupStoreLat: deliveryMethod === 'pickup' ? selectedStore.lat : null,
        pickupStoreLng: deliveryMethod === 'pickup' ? selectedStore.lng : null,
        address: deliveryMethod === 'pickup' ? selectedStore.address : deliveryAddress,
        addressLabel: deliveryMethod === 'pickup' ? selectedStore.address : deliveryAddress,
        addressLat: deliveryMethod === 'pickup' ? null : addressState.coords?.lat ?? null,
        addressLng: deliveryMethod === 'pickup' ? null : addressState.coords?.lng ?? null,
        addressColony: deliveryMethod === 'pickup' ? '' : addressState.colony,
        addressSubdivision: deliveryMethod === 'pickup' ? '' : addressState.subdivision,
        note: note.trim(),
        items: items.map((item) => ({
          productId: item.product.id,
          quantity: item.quantity,
          product: item.product,
        })),
        total,
      });
      await clearCart();
      hapticSuccess();
      navigation.replace('Seguimiento', { orderId: order.id });
    } catch (error) {
      hapticError();
      Alert.alert('No se pudo completar la compra', error?.message || 'Intenta nuevamente en unos segundos.');
    } finally {
      setSubmitting(false);
    }
  };

  if (!items.length) {
    return (
      <ScreenContainer>
        <View style={styles.emptyCard}>
          <Ionicons name="cart-outline" size={36} color={colors.primary} />
          <Text style={styles.emptyTitle}>No hay productos para pagar</Text>
          <Text style={styles.emptyText}>Vuelve al catÃ¡logo y agrega algo antes de finalizar la compra.</Text>
          <MotionPressable style={styles.primaryButton} onPress={() => navigation.navigate('Catalogo')}>
            <Text style={styles.primaryButtonText}>Ir al catÃ¡logo</Text>
          </MotionPressable>
        </View>
      </ScreenContainer>
    );
  }

  const pickupMapMarkers = [
    {
      key: selectedStore.id,
      lat: selectedStore.lat,
      lng: selectedStore.lng,
      title: selectedStore.name,
      description: selectedStore.address,
      pinColor: colors.primary,
    },
  ];

  const deliveryMapMarkers = [
    addressState.coords ? {
      key: 'delivery-point',
      lat: addressState.coords.lat,
      lng: addressState.coords.lng,
      title: 'Punto de entrega',
      description: addressState.label || addressState.text,
      pinColor: colors.primary,
    } : null,
    deviceCoords ? {
      key: 'device-point',
      lat: deviceCoords.lat,
      lng: deviceCoords.lng,
      title: 'Mi ubicaciÃ³n',
      description: 'UbicaciÃ³n actual del dispositivo',
      pinColor: colors.accent,
    } : null,
  ].filter(Boolean);

  const deliveryMapRegion = buildRegionFromPoints(
    deliveryMapMarkers.map((marker) => ({ lat: marker.lat, lng: marker.lng })),
    {
      latitude: addressState.coords?.lat || deviceCoords?.lat || DEFAULT_CHIAPAS_COORDS.lat,
      longitude: addressState.coords?.lng || deviceCoords?.lng || DEFAULT_CHIAPAS_COORDS.lng,
      latitudeDelta: 0.015,
      longitudeDelta: 0.015,
    }
  );

  return (
    <ScreenContainer>
      <FadeInView>
        <View style={styles.heroCard}>
          <Text style={styles.heroTitle}>Finaliza tu compra</Text>
          <Text style={styles.heroText}>
            Ya puedes fijar tu direcciÃ³n con mapa, colonia y pin exacto desde la app mÃ³vil.
          </Text>
        </View>
      </FadeInView>

      <FadeInView delay={80}>
        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>MÃ©todo de entrega</Text>
          <View style={styles.segmentRow}>
            <OptionChip
              label="A domicilio"
              icon="bicycle-outline"
              active={deliveryMethod === 'delivery'}
              onPress={() => setDeliveryMethod('delivery')}
            />
            <OptionChip
              label="Recoger en tienda"
              icon="storefront-outline"
              active={deliveryMethod === 'pickup'}
              onPress={() => setDeliveryMethod('pickup')}
            />
          </View>

          {deliveryMethod === 'pickup' ? (
            <View style={styles.storeList}>
              {pickupStores.map((store) => {
                const active = store.id === pickupStoreId;
                return (
                  <MotionPressable
                    key={store.id}
                    style={[styles.storeCard, active && styles.storeCardActive]}
                    onPress={() => setPickupStoreId(store.id)}
                  >
                    <Text style={styles.storeName}>{store.name}</Text>
                    <Text style={styles.storeAddress}>{store.address}</Text>
                    <Text style={styles.storeHours}>{store.hours}</Text>
                  </MotionPressable>
                );
              })}
              <NativeLocationMap
                title="UbicaciÃ³n de la tienda"
                height={220}
                markers={pickupMapMarkers}
                initialRegion={buildRegionFromPoints([{ lat: selectedStore.lat, lng: selectedStore.lng }])}
                helperText="Si eliges recoger en tienda, la app te deja visible el punto exacto desde ahora."
              />
            </View>
          ) : null}
        </View>
      </FadeInView>

      <FadeInView delay={140}>
        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>Datos del comprador</Text>
          <TextInput
            value={customerName}
            onChangeText={setCustomerName}
            placeholder="Nombre completo"
            placeholderTextColor={colors.textMuted}
            style={styles.input}
          />
          <TextInput
            value={phone}
            onChangeText={setPhone}
            placeholder="TelÃ©fono"
            placeholderTextColor={colors.textMuted}
            keyboardType="phone-pad"
            style={styles.input}
          />

          {deliveryMethod === 'delivery' ? (
            <>
              <View style={styles.locationActionRow}>
                <MotionPressable
                  style={styles.secondaryButton}
                  onPress={handleUseMyLocation}
                  disabled={locatingDevice}
                >
                  <Text style={styles.secondaryButtonText}>
                    {locatingDevice ? 'Ubicando...' : 'Usar mi ubicaciÃ³n'}
                  </Text>
                </MotionPressable>
                <View style={styles.locationStatusBox}>
                  <Text style={styles.locationStatusTitle}>
                    {permissionStatus === 'granted'
                      ? 'GPS activo'
                      : permissionStatus === 'denied'
                        ? 'Permiso denegado'
                        : permissionStatus === 'error'
                          ? 'No disponible'
                          : 'GPS opcional'}
                  </Text>
                  <Text style={styles.locationStatusText}>
                    {hasLocationIqKey()
                      ? 'La direccion se traduce a colonia, fraccionamiento y mapa.'
                      : 'Configura LocationIQ para mejorar el detalle de direccion en el mapa.'}
                  </Text>
                </View>
              </View>

              {(addressState.label || addressState.colony || addressState.subdivision) ? (
                <View style={styles.detectedBox}>
                  {addressState.label ? <Text style={styles.detectedAddress}>{addressState.label}</Text> : null}
                  {(addressState.colony || addressState.subdivision) ? (
                    <View style={styles.zoneRow}>
                      {addressState.colony ? <ZoneChip label={addressState.colony} icon="business-outline" /> : null}
                      {addressState.subdivision ? <ZoneChip label={addressState.subdivision} icon="map-outline" /> : null}
                    </View>
                  ) : null}
                </View>
              ) : null}

              <TextInput
                value={addressState.text}
                onChangeText={handleAddressChange}
                placeholder="DirecciÃ³n de entrega"
                placeholderTextColor={colors.textMuted}
                style={[styles.input, styles.textarea]}
                multiline
              />

              {suggestionsLoading ? (
                <View style={styles.suggestionsLoading}>
                  <ActivityIndicator size="small" color={colors.primary} />
                  <Text style={styles.suggestionsLoadingText}>Buscando coincidencias cercanas en Chiapas...</Text>
                </View>
              ) : null}

              {addressSuggestions.length ? (
                <View style={styles.suggestionsCard}>
                  <Text style={styles.suggestionsTitle}>Sugerencias</Text>
                  {addressSuggestions.map((suggestion) => (
                    <MotionPressable
                      key={`${suggestion.placeId || suggestion.display}-${suggestion.lat}-${suggestion.lng}`}
                      style={styles.suggestionItem}
                      onPress={() => handleSelectSuggestion(suggestion)}
                    >
                      <Text style={styles.suggestionMain}>{suggestion.display}</Text>
                      {(suggestion.colony || suggestion.subdivision) ? (
                        <Text style={styles.suggestionMeta}>
                          {[suggestion.colony, suggestion.subdivision].filter(Boolean).join(' Â· ')}
                        </Text>
                      ) : null}
                    </MotionPressable>
                  ))}
                </View>
              ) : null}

              <NativeLocationMap
                title="Vista previa de entrega"
                height={240}
                markers={deliveryMapMarkers}
                initialRegion={deliveryMapRegion}
                onPress={handleMapPress}
                helperText={
                  addressLookupStatus === 'locating'
                    ? 'Buscando la colonia y ajustando el pin...'
                    : 'Toca el mapa para mover el pin o escribe una direcciÃ³n y la app intentarÃ¡ ubicarla sola.'
                }
              />
            </>
          ) : (
            <View style={styles.pickupInfo}>
              <Ionicons name="location-outline" size={18} color={colors.primary} />
              <Text style={styles.pickupInfoText}>{selectedStore.address}</Text>
            </View>
          )}

          <TextInput
            value={note}
            onChangeText={setNote}
            placeholder="Indicaciones para el pedido"
            placeholderTextColor={colors.textMuted}
            style={[styles.input, styles.textarea]}
            multiline
          />
        </View>
      </FadeInView>

      <FadeInView delay={200}>
        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>Resumen del pedido</Text>
          {items.map((item) => (
            <View key={item.product.id} style={styles.summaryItem}>
              <View style={{ flex: 1 }}>
                <Text style={styles.summaryName}>{item.product.name}</Text>
                <Text style={styles.summaryMeta}>{item.quantity} x {formatPrice(item.product.price)}</Text>
              </View>
              <Text style={styles.summaryValue}>{formatPrice(item.subtotal)}</Text>
            </View>
          ))}

          <View style={styles.divider} />
          <SummaryRow label="Subtotal" value={formatPrice(subtotal)} />
          <SummaryRow
            label={deliveryMethod === 'delivery' ? 'EnvÃ­o' : 'Recoger en tienda'}
            value={shipping ? formatPrice(shipping) : 'Gratis'}
          />
          <SummaryRow label="Total" value={formatPrice(total)} strong />
        </View>
      </FadeInView>

      <FadeInView delay={260}>
        <MotionPressable
          style={[styles.primaryButton, submitting && styles.buttonDisabled]}
          onPress={handleSubmit}
          disabled={submitting}
        >
          <Text style={styles.primaryButtonText}>{submitting ? 'Procesando...' : 'Confirmar compra'}</Text>
        </MotionPressable>
      </FadeInView>
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

function OptionChip({ label, icon, active, onPress }) {
  return (
    <MotionPressable style={[styles.optionChip, active && styles.optionChipActive]} onPress={onPress}>
      <Ionicons name={icon} size={18} color={active ? colors.white : colors.primary} />
      <Text style={[styles.optionChipText, active && styles.optionChipTextActive]}>{label}</Text>
    </MotionPressable>
  );
}

function ZoneChip({ icon, label }) {
  return (
    <View style={styles.zoneChip}>
      <Ionicons name={icon} size={14} color={colors.primaryDark} />
      <Text style={styles.zoneChipText}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  heroCard: {
    backgroundColor: colors.cardAlt,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.xl,
    marginBottom: spacing.lg,
    ...shadows.card,
  },
  heroTitle: {
    color: colors.text,
    fontSize: typography.heading,
    fontWeight: '800',
  },
  heroText: {
    marginTop: spacing.xs,
    color: colors.textSoft,
    lineHeight: 21,
  },
  sectionCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    marginBottom: spacing.lg,
    gap: spacing.md,
    ...shadows.card,
  },
  sectionTitle: {
    color: colors.text,
    fontSize: typography.subheading,
    fontWeight: '800',
  },
  segmentRow: {
    gap: spacing.sm,
  },
  optionChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    backgroundColor: colors.card,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  optionChipActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  optionChipText: {
    color: colors.text,
    fontWeight: '700',
  },
  optionChipTextActive: {
    color: colors.white,
  },
  storeList: {
    gap: spacing.sm,
  },
  storeCard: {
    backgroundColor: colors.card,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    gap: 4,
  },
  storeCardActive: {
    borderColor: colors.primary,
    backgroundColor: '#fff3df',
  },
  storeName: {
    color: colors.text,
    fontWeight: '800',
  },
  storeAddress: {
    color: colors.textSoft,
    lineHeight: 19,
  },
  storeHours: {
    color: colors.accent,
    fontWeight: '700',
  },
  input: {
    backgroundColor: colors.card,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    color: colors.text,
  },
  textarea: {
    minHeight: 92,
    textAlignVertical: 'top',
  },
  locationActionRow: {
    gap: spacing.md,
  },
  locationStatusBox: {
    backgroundColor: colors.card,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
  },
  locationStatusTitle: {
    color: colors.text,
    fontWeight: '800',
  },
  locationStatusText: {
    marginTop: 4,
    color: colors.textSoft,
    lineHeight: 18,
  },
  detectedBox: {
    backgroundColor: '#fff3df',
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    gap: spacing.sm,
  },
  detectedAddress: {
    color: colors.text,
    lineHeight: 20,
    fontWeight: '700',
  },
  zoneRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  zoneChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    backgroundColor: colors.surface,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.sm,
    paddingVertical: 6,
  },
  zoneChipText: {
    color: colors.primaryDark,
    fontWeight: '700',
    fontSize: typography.caption,
  },
  suggestionsLoading: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  suggestionsLoadingText: {
    color: colors.textSoft,
    flex: 1,
    lineHeight: 18,
  },
  suggestionsCard: {
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
    overflow: 'hidden',
  },
  suggestionsTitle: {
    color: colors.text,
    fontWeight: '800',
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
  },
  suggestionItem: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    gap: 2,
  },
  suggestionMain: {
    color: colors.text,
    fontWeight: '700',
  },
  suggestionMeta: {
    color: colors.textSoft,
    fontSize: typography.caption,
  },
  pickupInfo: {
    flexDirection: 'row',
    gap: spacing.sm,
    alignItems: 'flex-start',
    backgroundColor: '#fff3df',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing.md,
  },
  pickupInfoText: {
    flex: 1,
    color: colors.text,
    lineHeight: 20,
  },
  summaryItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  summaryName: {
    color: colors.text,
    fontWeight: '700',
  },
  summaryMeta: {
    marginTop: 2,
    color: colors.textSoft,
    fontSize: typography.caption,
  },
  divider: {
    height: 1,
    backgroundColor: colors.border,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
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
  primaryButton: {
    backgroundColor: colors.primary,
    borderRadius: radius.pill,
    paddingVertical: spacing.md,
    alignItems: 'center',
    marginBottom: spacing.md,
    ...shadows.soft,
  },
  primaryButtonText: {
    color: colors.white,
    fontWeight: '800',
    fontSize: typography.body,
  },
  secondaryButton: {
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: spacing.sm,
    borderRadius: radius.pill,
    alignItems: 'center',
    backgroundColor: colors.card,
  },
  secondaryButtonText: {
    color: colors.text,
    fontWeight: '700',
  },
  buttonDisabled: {
    opacity: 0.72,
  },
  emptyCard: {
    marginTop: spacing.xl,
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
    lineHeight: 21,
  },
});

