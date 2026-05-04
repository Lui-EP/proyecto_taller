import { useState } from 'react';
import { Alert, StyleSheet, Text, TextInput, View, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import ScreenContainer from '../components/ScreenContainer';
import FadeInView from '../components/FadeInView';
import MotionPressable from '../components/MotionPressable';
import { colors, radius, shadows, spacing, typography } from '../theme';
import { useSession } from '../context/SessionContext';

export default function LoginScreen({ navigation, isEmbedded = false }) {
  const { login, register } = useSession();
  const [isLogin, setIsLogin] = useState(true);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [role, setRole] = useState('buyer');

  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    if (!email || !password) {
      Alert.alert('Faltan datos', 'Ingresa tu correo y contraseña.');
      return;
    }

    if (!isLogin && !name) {
      Alert.alert('Faltan datos', 'Ingresa tu nombre para registrarte.');
      return;
    }

    setLoading(true);
    try {
      if (isLogin) {
        await login(email, password);
      } else {
        await register({ email, password, name, role });
      }
      if (!isEmbedded && navigation) {
        navigation.replace('Tabs');
      }
    } catch (error) {
      Alert.alert('Error', error?.message || 'Revisa tu conexión e intenta de nuevo.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScreenContainer>
      <ScrollView contentContainerStyle={styles.scroll}>
        <FadeInView>
          <Text style={styles.title}>{isLogin ? 'Iniciar Sesión' : 'Crear Cuenta'}</Text>
          <Text style={styles.subtitle}>
            {isLogin
              ? 'Ingresa tus datos para continuar.'
              : 'Únete para comprar o vender productos locales.'}
          </Text>
        </FadeInView>

        <FadeInView delay={70}>
          <View style={styles.card}>
            {!isLogin && (
              <>
                <Text style={styles.label}>Nombre</Text>
                <TextInput
                  style={styles.input}
                  value={name}
                  onChangeText={setName}
                  placeholder="Tu nombre completo"
                  placeholderTextColor={colors.textMuted}
                  autoCapitalize="words"
                />

                <Text style={styles.label}>Perfil</Text>
                <View style={styles.roleContainer}>
                  <MotionPressable
                    style={[styles.roleBtn, role === 'buyer' && styles.roleBtnActive]}
                    onPress={() => setRole('buyer')}
                  >
                    <Ionicons name="person-outline" size={18} color={role === 'buyer' ? colors.white : colors.text} />
                    <Text style={[styles.roleTxt, role === 'buyer' && styles.roleTxtActive]}>Comprador</Text>
                  </MotionPressable>

                  <MotionPressable
                    style={[styles.roleBtn, role === 'seller' && styles.roleBtnActive]}
                    onPress={() => setRole('seller')}
                  >
                    <Ionicons name="briefcase-outline" size={18} color={role === 'seller' ? colors.white : colors.text} />
                    <Text style={[styles.roleTxt, role === 'seller' && styles.roleTxtActive]}>Vendedor</Text>
                  </MotionPressable>

                  <MotionPressable
                    style={[styles.roleBtn, role === 'courier' && styles.roleBtnActive]}
                    onPress={() => setRole('courier')}
                  >
                    <Ionicons name="bicycle-outline" size={18} color={role === 'courier' ? colors.white : colors.text} />
                    <Text style={[styles.roleTxt, role === 'courier' && styles.roleTxtActive]}>Repartidor</Text>
                  </MotionPressable>
                </View>
              </>
            )}

            <Text style={styles.label}>Correo electrónico</Text>
            <TextInput
              style={styles.input}
              value={email}
              onChangeText={setEmail}
              placeholder="tu@correo.com"
              placeholderTextColor={colors.textMuted}
              keyboardType="email-address"
              autoCapitalize="none"
            />

            <Text style={styles.label}>Contraseña</Text>
            <TextInput
              style={styles.input}
              value={password}
              onChangeText={setPassword}
              placeholder="******"
              placeholderTextColor={colors.textMuted}
              secureTextEntry
            />

            <MotionPressable
              style={[styles.submitBtn, loading && styles.submitBtnDisabled]}
              onPress={handleSubmit}
              disabled={loading}
            >
              <Text style={styles.submitBtnTxt}>
                {loading ? 'Cargando...' : isLogin ? 'Entrar' : 'Registrarme'}
              </Text>
            </MotionPressable>
          </View>
        </FadeInView>

        <FadeInView delay={140}>
          <MotionPressable style={styles.toggleBtn} onPress={() => setIsLogin(!isLogin)}>
            <Text style={styles.toggleBtnTxt}>
              {isLogin ? '¿No tienes cuenta? Regístrate' : '¿Ya tienes cuenta? Inicia sesión'}
            </Text>
          </MotionPressable>
        </FadeInView>
      </ScrollView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  scroll: {
    paddingBottom: spacing.xl,
  },
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
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    ...shadows.card,
  },
  label: {
    fontSize: typography.caption,
    fontWeight: '700',
    color: colors.textSoft,
    marginBottom: spacing.xs,
    marginTop: spacing.md,
  },
  input: {
    backgroundColor: colors.surfaceMuted,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: 12,
    fontSize: 16,
    color: colors.text,
  },
  roleContainer: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.xs,
  },
  roleBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.pill,
    paddingVertical: 10,
    backgroundColor: colors.surface,
  },
  roleBtnActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  roleTxt: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.text,
  },
  roleTxtActive: {
    color: colors.white,
  },
  submitBtn: {
    backgroundColor: colors.primary,
    borderRadius: radius.pill,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: spacing.xl,
  },
  submitBtnDisabled: {
    opacity: 0.6,
  },
  submitBtnTxt: {
    color: colors.white,
    fontWeight: '800',
    fontSize: 16,
  },
  toggleBtn: {
    marginTop: spacing.lg,
    alignItems: 'center',
    padding: spacing.sm,
  },
  toggleBtnTxt: {
    color: colors.primary,
    fontWeight: '700',
    fontSize: 15,
  },
});
