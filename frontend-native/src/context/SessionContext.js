import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { listDemoUsers, loginRequest } from '../lib/authApi';

const SessionContext = createContext(null);
const SESSION_KEY = 'mercado_local_native_session';
const GUEST_KEY = 'mercado_local_native_guest_id';

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
    password: user.password || '',
    active: user.active ?? user.activo ?? true,
  };
}

export function SessionProvider({ children }) {
  const [user, setUser] = useState(null);
  const [guestId, setGuestId] = useState('');
  const [users, setUsers] = useState([]);
  const [source, setSource] = useState('remote');
  const [ready, setReady] = useState(false);

  const refreshUsers = useCallback(async () => {
    const remoteUsers = (await listDemoUsers()).map(normalizeUser);
    setUsers(remoteUsers);
    setSource('remote');
    return remoteUsers;
  }, []);

  useEffect(() => {
    let active = true;

    async function loadSession() {
      try {
        const [rawSession, rawGuestId] = await Promise.all([
          AsyncStorage.getItem(SESSION_KEY),
          AsyncStorage.getItem(GUEST_KEY),
        ]);

        const nextGuestId = rawGuestId || createGuestId();
        if (!rawGuestId) {
          await AsyncStorage.setItem(GUEST_KEY, nextGuestId);
        }

        const remoteUsers = await refreshUsers();

        if (!active) return;
        setGuestId(nextGuestId);
        setUsers(remoteUsers);
        setSource('remote');
        setUser(rawSession ? normalizeUser(JSON.parse(rawSession)) : null);
      } catch {
        if (!active) return;
        const fallbackGuestId = createGuestId();
        await AsyncStorage.setItem(GUEST_KEY, fallbackGuestId).catch(() => {});
        setGuestId(fallbackGuestId);
        setUsers([]);
        setSource('remote');
        setUser(null);
      } finally {
        if (active) setReady(true);
      }
    }

    loadSession();
    return () => {
      active = false;
    };
  }, [refreshUsers]);

  const persistUser = async (nextUser) => {
    const normalized = normalizeUser(nextUser);
    setUser(normalized);
    if (normalized) {
      await AsyncStorage.setItem(SESSION_KEY, JSON.stringify(normalized));
    } else {
      await AsyncStorage.removeItem(SESSION_KEY);
    }
  };

  const login = async (email, password) => {
    const cleanEmail = `${email || ''}`.trim().toLowerCase();
    const cleanPassword = `${password || ''}`;
    const remoteUser = await loginRequest(cleanEmail, cleanPassword);
    await persistUser(remoteUser);
    return normalizeUser(remoteUser);
  };

  const loginAsRole = async (role) => {
    const found = users.find((item) => item.role === role);
    if (!found) {
      throw new Error('Rol no disponible');
    }
    return login(found.email, found.password);
  };

  const logout = async () => {
    await persistUser(null);
  };

  const value = useMemo(() => ({
    user,
    users,
    demoUsers: users,
    guestId,
    source,
    ready,
    login,
    loginAsRole,
    logout,
    refreshUsers,
  }), [user, users, guestId, source, ready, refreshUsers]);

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession() {
  const context = useContext(SessionContext);
  if (!context) {
    throw new Error('useSession debe usarse dentro de SessionProvider');
  }
  return context;
}
