import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, Text, View } from 'react-native';
import { colors, radius, spacing, statusPalette, typography } from '../theme';

export default function StatusPill({ label, icon, status, compact = false }) {
  const palette = statusPalette[status] || statusPalette.pedido_realizado;

  return (
    <View style={[styles.pill, { backgroundColor: palette.bg, borderColor: palette.border }, compact && styles.compact]}>
      {icon ? <Ionicons name={icon} size={compact ? 12 : 14} color={palette.text} /> : null}
      <Text style={[styles.text, { color: palette.text }, compact && styles.compactText]} numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: spacing.xs,
    borderRadius: radius.pill,
    borderWidth: 1,
    paddingHorizontal: spacing.sm,
    paddingVertical: 7,
  },
  compact: {
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  text: {
    fontSize: typography.caption,
    fontWeight: '800',
  },
  compactText: {
    fontSize: typography.tiny,
  },
});
