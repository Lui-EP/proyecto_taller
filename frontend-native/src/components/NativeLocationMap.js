import { useEffect, useMemo, useRef } from 'react';
import { Platform, StyleSheet, Text, View } from 'react-native';
import { colors, radius, shadows, spacing, typography } from '../theme';
import { buildRegionFromPoints, toMapCoordinate, toRouteCoordinates } from '../lib/locationService';

let NativeMapView = null;
let NativeMarker = null;
let NativePolyline = null;

if (Platform.OS !== 'web') {
  const Maps = require('react-native-maps');
  NativeMapView = Maps.default;
  NativeMarker = Maps.Marker;
  NativePolyline = Maps.Polyline;
}

export default function NativeLocationMap({
  title,
  helperText,
  markers = [],
  polyline = [],
  initialRegion,
  onPress,
  height = 240,
}) {
  const mapRef = useRef(null);
  const mapMarkers = useMemo(
    () => markers
      .filter((item) => Number.isFinite(Number(item?.lat)) && Number.isFinite(Number(item?.lng)))
      .map((item) => ({
        ...item,
        coordinate: toMapCoordinate(item),
      })),
    [markers]
  );
  const routeCoordinates = useMemo(() => toRouteCoordinates(polyline), [polyline]);
  const effectiveRegion = useMemo(
    () => buildRegionFromPoints([...markers, ...polyline], initialRegion),
    [initialRegion, markers, polyline]
  );

  useEffect(() => {
    if (Platform.OS === 'web' || !mapRef.current) return;
    const points = [
      ...mapMarkers.map((item) => item.coordinate),
      ...routeCoordinates,
    ];
    if (!points.length) return;

    const timer = setTimeout(() => {
      if (!mapRef.current) return;
      if (points.length === 1) {
        mapRef.current.animateToRegion({
          ...effectiveRegion,
          latitude: points[0].latitude,
          longitude: points[0].longitude,
        }, 500);
        return;
      }

      mapRef.current.fitToCoordinates(points, {
        edgePadding: {
          top: 42,
          right: 42,
          bottom: 42,
          left: 42,
        },
        animated: true,
      });
    }, 140);

    return () => clearTimeout(timer);
  }, [effectiveRegion, mapMarkers, routeCoordinates]);

  return (
    <View style={styles.wrapper}>
      {title ? <Text style={styles.title}>{title}</Text> : null}
      <View style={[styles.mapFrame, { height }]}>
        {Platform.OS === 'web' || !NativeMapView ? (
          <View style={styles.webFallback}>
            <Text style={styles.webFallbackTitle}>Mapa nativo disponible en Expo Go</Text>
            <Text style={styles.webFallbackText}>
              En celular verás el mapa interactivo con el pin y la ruta en tiempo real.
            </Text>
            {mapMarkers.map((item) => (
              <Text key={item.key || item.title} style={styles.webFallbackCoords}>
                {item.title || 'Punto'}: {item.coordinate.latitude.toFixed(5)}, {item.coordinate.longitude.toFixed(5)}
              </Text>
            ))}
          </View>
        ) : (
          <NativeMapView
            ref={mapRef}
            style={StyleSheet.absoluteFill}
            initialRegion={effectiveRegion}
            onPress={onPress ? (event) => {
              const coordinate = event.nativeEvent.coordinate;
              onPress({
                lat: Number(coordinate.latitude),
                lng: Number(coordinate.longitude),
              });
            } : undefined}
          >
            {routeCoordinates.length > 1 ? (
              <NativePolyline
                coordinates={routeCoordinates}
                strokeColor={colors.primary}
                strokeWidth={5}
              />
            ) : null}

            {mapMarkers.map((item) => (
              <NativeMarker
                key={item.key || item.title}
                coordinate={item.coordinate}
                title={item.title}
                description={item.description}
                pinColor={item.pinColor || colors.primary}
              />
            ))}
          </NativeMapView>
        )}
      </View>
      {helperText ? <Text style={styles.helperText}>{helperText}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    gap: spacing.sm,
  },
  title: {
    color: colors.text,
    fontSize: typography.subheading,
    fontWeight: '800',
  },
  mapFrame: {
    overflow: 'hidden',
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceMuted,
    ...shadows.soft,
  },
  helperText: {
    color: colors.textSoft,
    lineHeight: 19,
  },
  webFallback: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
    gap: spacing.xs,
  },
  webFallbackTitle: {
    color: colors.text,
    fontWeight: '800',
    textAlign: 'center',
  },
  webFallbackText: {
    color: colors.textSoft,
    textAlign: 'center',
    lineHeight: 18,
  },
  webFallbackCoords: {
    color: colors.primaryDark,
    fontWeight: '700',
    textAlign: 'center',
  },
});
