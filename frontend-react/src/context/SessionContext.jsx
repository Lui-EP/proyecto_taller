/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { ensureLegacySession, getMercadoLocal, snapshotState, getCartCount } from '../lib/mercadoLocal';

const SessionContext = createContext(null);

export function SessionProvider({ children }) {
    const [state, setState] = useState({
        user: null,
        token: null,
        favorites: [],
        cart: [],
        viewHistory: [],
        accessibilityMode: false,
        highContrast: false,
    });
    const [ready, setReady] = useState(false);

    const syncState = () => {
        setState(snapshotState());
    };

    useEffect(() => {
        let cancelled = false;

        async function boot() {
            try {
                await ensureLegacySession();
                if (!cancelled) {
                    syncState();
                }
            } catch (error) {
                console.error(error);
            } finally {
                if (!cancelled) {
                    setReady(true);
                }
            }
        }

        boot();

        return () => {
            cancelled = true;
        };
    }, []);

    const login = async (email, password) => {
        const mercado = getMercadoLocal();
        const result = await mercado.AuthAPI.login(email, password);
        mercado.AppState.token = result.token;
        mercado.AppState.user = result.user;
        localStorage.setItem('token', result.token);
        if (typeof mercado.syncCartAfterAuth === 'function') {
            mercado.syncCartAfterAuth(result.user);
        }
        syncState();
        return result.user;
    };

    const register = async (payload) => {
        const mercado = getMercadoLocal();
        const result = await mercado.AuthAPI.register(
            payload.email,
            payload.password,
            payload.name,
            payload.role,
            {
                phone: payload.phone,
                location: payload.location,
                curp: payload.curp,
            }
        );

        mercado.AppState.token = result.token;
        mercado.AppState.user = result.user;
        localStorage.setItem('token', result.token);
        if (typeof mercado.syncCartAfterAuth === 'function') {
            mercado.syncCartAfterAuth(result.user);
        }
        syncState();
        return result.user;
    };

    const logout = () => {
        const mercado = getMercadoLocal();
        mercado.AppState.token = null;
        mercado.AppState.user = null;
        localStorage.removeItem('token');
        localStorage.removeItem('demoUserId');
        if (typeof mercado.syncCartStateForUser === 'function') {
            mercado.syncCartStateForUser(null);
        }
        syncState();
    };

    const value = useMemo(() => ({
        ...state,
        cartCount: getCartCount(state.cart),
        ready,
        syncState,
        login,
        register,
        logout,
    }), [state, ready]);

    return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession() {
    const context = useContext(SessionContext);
    if (!context) {
        throw new Error('useSession debe usarse dentro de SessionProvider');
    }
    return context;
}

