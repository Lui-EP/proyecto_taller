import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getMeRequest, listDemoUsers, loginRequest } from '../lib/authApi';
import { setAuthToken } from '../lib/httpAuth';

const SessionContext = createContext(null);
const SESSION_TOKEN_KEY = 'mercadolocal.mobile.jwt';
const DEFAULT_DEMO_PASSWORD = `${process.env.EXPO_PUBLIC_DEMO_PASSWORD || '123456'}`.trim() || '123456';

function createGuestId() {
  return `guest-device-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
}

function normalizeUser(user) {
  if (!user) return null;
  return {
    id: user.id || user.usuario_id || '',
    name: user.name || user.nombre || '',
    email: user.email || '',
    role: user.role || 'buyer',
    phone: user.phone || user.telefono || '',
    address: user.address || user.direccion || '',
    password: user.password || DEFAULT_DEMO_PASSWORD,
    active: user.active ?? user.activo ?? true,
  };
}

export function SessionProvider({ children }) {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState('');
  const [guestId] = useState(() => createGuestId());
  const [users, setUsers] = useState([]);
  const [ready, setReady] = useState(false);

  const refreshUsers = useCallback(async () => {
    const remoteUsers = (await listDemoUsers()).map(normalizeUser);
    setUsers(remoteUsers);
    return remoteUsers;
  }, []);

  useEffect(() => {
    let active = true;

    async function loadSession() {
      try {
        const storedToken = `${(await AsyncStorage.getItem(SESSION_TOKEN_KEY)) || ''}`.trim();
        if (storedToken) {
          setAuthToken(storedToken);
          try {
            const me = normalizeUser(await getMeRequest());
            if (active) {
              setUser(me);
              setToken(storedToken);
            }
          } catch {
            await AsyncStorage.removeItem(SESSION_TOKEN_KEY);
            setAuthToken('');
            if (active) {
              setUser(null);
              setToken('');
            }
          }
        } else {
          setAuthToken('');
          if (active) {
            setUser(null);
            setToken('');
          }
        }

        const remoteUsers = await refreshUsers();
        if (!active) return;
        setUsers(remoteUsers);
      } catch {
        if (!active) return;
        setUsers([]);
        setUser(null);
        setToken('');
      } finally {
        if (active) setReady(true);
      }
    }

    loadSession();
    return () => {
      active = false;
    };
  }, [refreshUsers]);

  const login = async (email, password) => {
    const cleanEmail = `${email || ''}`.trim().toLowerCase();
    const cleanPassword = `${password || ''}`;
    const result = await loginRequest(cleanEmail, cleanPassword);
    const normalized = normalizeUser(result?.user || null);
    const nextToken = `${result?.token || ''}`.trim();
    if (!nextToken) throw new Error('No se recibio token de sesion');
    setAuthToken(nextToken);
    await AsyncStorage.setItem(SESSION_TOKEN_KEY, nextToken);
    setUser(normalized);
    setToken(nextToken);
    return normalized;
  };

  const loginAsRole = async (role) => {
    const found = users.find((item) => item.role === role);
    if (!found) throw new Error('Rol no disponible');
    return login(found.email, found.password || DEFAULT_DEMO_PASSWORD);
  };

  const logout = async () => {
    await AsyncStorage.removeItem(SESSION_TOKEN_KEY);
    setAuthToken('');
    setUser(null);
    setToken('');
  };

  const value = useMemo(() => ({
    user,
    token,
    users,
    demoUsers: users,
    guestId,
    source: token ? 'remote-auth' : 'remote',
    ready,
    login,
    loginAsRole,
    logout,
    refreshUsers,
  }), [user, token, users, guestId, ready, refreshUsers]);

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession() {
  const context = useContext(SessionContext);
  if (!context) {
    throw new Error('useSession debe usarse dentro de SessionProvider');
  }
  return context;
}

