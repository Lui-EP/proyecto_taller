import { Alert, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import ScreenContainer from '../components/ScreenContainer';
import FadeInView from '../components/FadeInView';
import MotionPressable from '../components/MotionPressable';
import { colors, radius, shadows, spacing, typography } from '../theme';
import { useSession } from '../context/SessionContext';

export default function LoginScreen({ navigation }) {
  const { demoUsers, loginAsRole, ready } = useSession();

  const handleLogin = async (account) => {
    try {
      await loginAsRole(account.role);
      navigation.replace('Tabs');
    } catch (error) {
      Alert.alert('No se pudo entrar', error?.message || 'Revisa la conexión con el backend o vuelve a intentar.');
    }
  };

  return (
    <ScreenContainer>
      <FadeInView>
        <Text style={styles.title}>Cuentas demo</Text>
        <Text style={styles.subtitle}>
          {ready
            ? 'Elige un rol para probar la experiencia móvil completa.'
            : 'Cargando cuentas desde backend...'}
        </Text>
      </FadeInView>

      <View style={styles.list}>
        {demoUsers.map((account, index) => (
          <FadeInView key={account.id} delay={index * 70}>
            <MotionPressable style={styles.card} onPress={() => handleLogin(account)}>
              <View style={styles.cardHeader}>
                <View style={styles.iconWrap}>
                  <Ionicons name={roleIcon(account.role)} size={22} color={colors.primary} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.cardRole}>{roleLabel(account.role)}</Text>
                  <Text style={styles.cardName}>{account.name}</Text>
                </View>
              </View>
              <Text style={styles.cardEmail}>{account.email}</Text>
              <Text style={styles.cardHint}>Toca para entrar con esta cuenta</Text>
            </MotionPressable>
          </FadeInView>
        ))}

        {ready && demoUsers.length === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyTitle}>No se cargaron cuentas demo</Text>
            <Text style={styles.emptyText}>Verifica que clientes-service esté activo en el backend.</Text>
          </View>
        ) : null}
      </View>
    </ScreenContainer>
  );
}

function roleLabel(role) {
  const labels = {
    buyer: 'Cliente',
    seller: 'Vendedor',
    courier: 'Repartidor',
    admin: 'Admin',
  };
  return labels[role] || role;
}

function roleIcon(role) {
  const icons = {
    buyer: 'person-outline',
    seller: 'briefcase-outline',
    courier: 'bicycle-outline',
    admin: 'shield-checkmark-outline',
  };
  return icons[role] || 'person-outline';
}

const styles = StyleSheet.create({
  title: {
    fontSize: typography.heading,
    fontWeight: '800',
    color: colors.text,
  },
  subtitle: {
    color: colors.textSoft,
    marginTop: 6,
    marginBottom: spacing.lg,
    lineHeight: 20,
  },
  list: {
    gap: spacing.md,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    gap: 8,
    marginBottom: spacing.md,
    ...shadows.card,
  },
  cardHeader: {
    flexDirection: 'row',
    gap: spacing.md,
    alignItems: 'center',
  },
  iconWrap: {
    width: 46,
    height: 46,
    borderRadius: 23,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff0da',
  },
  cardRole: {
    color: colors.primary,
    fontWeight: '800',
  },
  cardName: {
    color: colors.text,
    fontSize: typography.subheading,
    fontWeight: '800',
    marginTop: 3,
  },
  cardEmail: {
    color: colors.textSoft,
    marginTop: spacing.xs,
  },
  cardHint: {
    color: colors.success,
    marginTop: spacing.sm,
    fontWeight: '700',
  },
  emptyCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    ...shadows.card,
  },
  emptyTitle: {
    color: colors.text,
    fontWeight: '800',
    fontSize: typography.subheading,
    marginBottom: 6,
  },
  emptyText: {
    color: colors.textSoft,
    lineHeight: 20,
  },
});
