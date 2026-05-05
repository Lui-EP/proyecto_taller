import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { listUsers, loginRequest, registerRequest } from '../lib/authApi';
import { setAuthToken } from '../lib/httpAuth';

const SessionContext = createContext(null);

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
    const remoteUsers = (await listUsers()).map(normalizeUser);
    setUsers(remoteUsers);
    return remoteUsers;
  }, []);

  useEffect(() => {
    let active = true;

    async function loadSession() {
      try {
        setAuthToken('');
        if (active) {
          setUser(null);
          setToken('');
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
    if (!nextToken) throw new Error('No se recibio token de sesión');
    setAuthToken(nextToken);
    setUser(normalized);
    setToken(nextToken);
    return normalized;
  };

  const register = async (payload) => {
    const result = await registerRequest(payload);
    const normalized = normalizeUser(result?.user || null);
    const nextToken = `${result?.token || ''}`.trim();
    if (!nextToken) throw new Error('No se recibio token de sesión tras registro');
    setAuthToken(nextToken);
    setUser(normalized);
    setToken(nextToken);
    return normalized;
  };

  const loginAsRole = async (role) => {
    const found = users.find((item) => item.role === role);
    if (!found) throw new Error('Rol no disponible');
    throw new Error('Seleccion de rol deshabilitada: inicia sesion con correo y contraseña reales.');
  };

  const logout = async () => {
    setAuthToken('');
    setUser(null);
    setToken('');
  };

  const value = useMemo(() => ({
    user,
    token,
    users,
    guestId,
    source: token ? 'remote-auth' : 'remote',
    ready,
    login,
    register,
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
