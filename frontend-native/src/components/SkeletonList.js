import { useEffect, useRef } from 'react';
import { Animated, StyleSheet, View } from 'react-native';
import { colors, radius, shadows, spacing } from '../theme';

function SkeletonRow({ width = '100%', height = 12, rounded = 8 }) {
  return <View style={[styles.block, { width, height, borderRadius: rounded }]} />;
}

export function SkeletonCard() {
  return (
    <View style={styles.card}>
      <SkeletonRow width="100%" height={140} rounded={18} />
      <View style={styles.content}>
        <SkeletonRow width="38%" height={10} />
        <SkeletonRow width="74%" height={18} />
        <SkeletonRow width="28%" height={16} />
        <SkeletonRow width="52%" height={12} />
      </View>
    </View>
  );
}

export function SkeletonList({ count = 3 }) {
  const opacity = useRef(new Animated.Value(0.55)).current;

  useEffect(() => {
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 0.95, duration: 620, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0.55, duration: 620, useNativeDriver: true }),
      ])
    );
    pulse.start();
    return () => pulse.stop();
  }, [opacity]);

  return (
    <Animated.View style={{ opacity }}>
      <View style={styles.list}>
        {Array.from({ length: count }).map((_, idx) => <SkeletonCard key={`skeleton-${idx}`} />)}
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  list: {
    gap: spacing.md,
  },
  card: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    overflow: 'hidden',
    ...shadows.card,
  },
  content: {
    padding: spacing.md,
    gap: spacing.sm,
  },
  block: {
    backgroundColor: '#eadfce',
  },
});
