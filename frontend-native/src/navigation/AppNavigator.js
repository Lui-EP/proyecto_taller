import { View, Text, StyleSheet } from 'react-native';
import { NavigationContainer, DefaultTheme } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import HomeScreen from '../screens/HomeScreen';
import CatalogScreen from '../screens/CatalogScreen';
import ProductDetailScreen from '../screens/ProductDetailScreen';
import CartScreen from '../screens/CartScreen';
import ProfileScreen from '../screens/ProfileScreen';
import LoginScreen from '../screens/LoginScreen';
import SellerDashboardScreen from '../screens/SellerDashboardScreen';
import SellerProductsScreen from '../screens/SellerProductsScreen';
import EditProductScreen from '../screens/EditProductScreen';
import AdminDashboardScreen from '../screens/AdminDashboardScreen';
import CourierDashboardScreen from '../screens/CourierDashboardScreen';
import CheckoutScreen from '../screens/CheckoutScreen';
import TrackingScreen from '../screens/TrackingScreen';
import OrderHistoryScreen from '../screens/OrderHistoryScreen';
import { useCart } from '../context/CartContext';
import { useSession } from '../context/SessionContext';
import { colors, radius, shadows } from '../theme';

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

const navTheme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    background: colors.background,
    card: colors.surface,
    text: colors.text,
    primary: colors.primary,
    border: colors.border,
  },
};

function TabBadge({ value }) {
  if (!value) return null;
  return (
    <View style={styles.badge}>
      <Text style={styles.badgeText}>{value > 99 ? '99+' : value}</Text>
    </View>
  );
}

function RootTabs() {
  const { count } = useCart();
  const { user } = useSession();
  const isSeller = user?.role === 'seller';

  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        animation: 'shift',
        tabBarHideOnKeyboard: true,
        tabBarStyle: {
          position: 'absolute',
          left: 12,
          right: 12,
          bottom: 12,
          height: 72,
          paddingTop: 8,
          paddingBottom: 8,
          backgroundColor: colors.surface,
          borderTopWidth: 1,
          borderTopColor: colors.border,
          borderRadius: radius.xl,
          ...shadows.card,
        },
        tabBarActiveTintColor: colors.primary,
        tabBarActiveBackgroundColor: 'transparent',
        tabBarInactiveTintColor: colors.textSoft,
        tabBarLabelStyle: { fontSize: 12, fontWeight: '800' },
        tabBarIconStyle: { marginBottom: 2 },
        tabBarItemStyle: {
          borderRadius: radius.lg,
          marginHorizontal: 2,
          paddingVertical: 2,
        },
        tabBarIcon: ({ color, size, focused }) => {
          const icons = {
            Inicio: focused ? 'home' : 'home-outline',
            Catalogo: focused ? 'storefront' : 'storefront-outline',
            Carrito: focused ? 'cart' : 'cart-outline',
            Vender: focused ? 'briefcase' : 'briefcase-outline',
            Perfil: focused ? 'person-circle' : 'person-circle-outline',
          };

          return (
            <View style={[styles.iconHighlight, focused && styles.iconHighlightActive]}>
              <Ionicons name={icons[route.name]} size={size} color={color} />
              {route.name === 'Carrito' ? <TabBadge value={count} /> : null}
            </View>
          );
        },
      })}
    >
      <Tab.Screen name="Inicio" component={HomeScreen} />
      <Tab.Screen name="Catalogo" component={CatalogScreen} options={{ title: 'Catálogo' }} />
      <Tab.Screen name="Carrito" component={CartScreen} />
      {isSeller ? <Tab.Screen name="Vender" component={SellerDashboardScreen} /> : null}
      <Tab.Screen name="Perfil" component={ProfileScreen} />
    </Tab.Navigator>
  );
}

export default function AppNavigator() {
  return (
    <NavigationContainer theme={navTheme}>
      <Stack.Navigator
      screenOptions={{
        headerStyle: { backgroundColor: colors.surface },
        headerTintColor: colors.text,
        headerShadowVisible: false,
        headerTitleStyle: { fontWeight: '800' },
        contentStyle: { backgroundColor: colors.background },
        animation: 'fade_from_bottom',
        gestureEnabled: true,
        fullScreenGestureEnabled: true,
        animationDuration: 160,
      }}
      >
        <Stack.Screen name="Tabs" component={RootTabs} options={{ headerShown: false }} />
        <Stack.Screen name="Producto" component={ProductDetailScreen} options={{ title: 'Detalle del producto' }} />
        <Stack.Screen name="Checkout" component={CheckoutScreen} options={{ title: 'Finalizar compra' }} />
        <Stack.Screen name="Seguimiento" component={TrackingScreen} options={{ title: 'Seguimiento' }} />
        <Stack.Screen name="Pedidos" component={OrderHistoryScreen} options={{ title: 'Pedidos' }} />
        <Stack.Screen name="Login" component={LoginScreen} options={{ title: 'Entrar' }} />
        <Stack.Screen name="PanelVendedor" component={SellerDashboardScreen} options={{ title: 'Panel vendedor' }} />
        <Stack.Screen name="EditarProductoLista" component={SellerProductsScreen} options={{ title: 'Mis productos' }} />
        <Stack.Screen name="CrearProducto" component={EditProductScreen} options={{ title: 'Nuevo producto' }} />
        <Stack.Screen name="EditarProducto" component={EditProductScreen} options={{ title: 'Editar producto' }} />
        <Stack.Screen name="PanelAdmin" component={AdminDashboardScreen} options={{ title: 'Panel admin' }} />
        <Stack.Screen name="PanelRepartidor" component={CourierDashboardScreen} options={{ title: 'Panel repartidor' }} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}

const styles = StyleSheet.create({
  iconHighlight: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconHighlightActive: {
    backgroundColor: '#f8eddc',
    borderWidth: 1,
    borderColor: '#e3c79f',
  },
  badge: {
    position: 'absolute',
    top: -6,
    right: -10,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: colors.danger,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  badgeText: {
    color: colors.white,
    fontSize: 10,
    fontWeight: '800',
  },
});
