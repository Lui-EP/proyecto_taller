import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useSession } from '../context/SessionContext';
import { getMercadoLocal } from '../lib/mercadoLocal';

export default function LoginPage() {
    const [form, setForm] = useState({ email: '', password: '' });
    const [showPassword, setShowPassword] = useState(false);
    const [loading, setLoading] = useState(false);
    const session = useSession();
    const navigate = useNavigate();
    const mercado = getMercadoLocal();

    useEffect(() => {
        if (session.token && session.user) {
            navigate('/catalogo', { replace: true });
        }
    }, [session.token, session.user, navigate]);

    const onSubmit = async (event) => {
        event.preventDefault();
        if (!form.email || !form.password) {
            mercado.showToast('Completa todos los campos', 'error');
            return;
        }

        setLoading(true);
        try {
            const user = await session.login(form.email.trim(), form.password);
            mercado.showToast(`Bienvenido, ${user.name}`);

            if (user.role === 'admin') navigate('/admin');
            else if (user.role === 'seller') navigate('/vendedor');
            else if (user.role === 'courier') navigate('/repartidor');
            else navigate('/catalogo');
        } catch (error) {
            mercado.showToast(error.message || 'No se pudo iniciar sesión', 'error');
        } finally {
            setLoading(false);
        }
    };

    return (
        <main className="auth-page">
            <div className="auth-container">
                <Link to="/" className="auth-back-link">
                    <span>←</span>
                    <span>Volver al inicio</span>
                </Link>

                <div className="auth-card">
                    <div className="auth-header">
                        <div className="auth-logo">🌾</div>
                        <h1 className="auth-title">Bienvenido de nuevo</h1>
                        <p className="auth-subtitle">Ingresa a tu cuenta para continuar</p>
                    </div>

                    <div className="auth-body">
                        <form className="auth-form" onSubmit={onSubmit}>
                            <div className="form-group">
                                <label htmlFor="login-email" className="form-label">Correo electrónico</label>
                                <input
                                    type="email"
                                    id="login-email"
                                    className="form-input"
                                    placeholder="tu@email.com"
                                    value={form.email}
                                    onChange={(event) => setForm((prev) => ({ ...prev, email: event.target.value }))}
                                    required
                                />
                            </div>

                            <div className="form-group">
                                <label htmlFor="login-password" className="form-label">Contraseña</label>
                                <div className="password-input-container">
                                    <input
                                        type={showPassword ? 'text' : 'password'}
                                        id="login-password"
                                        className="form-input"
                                        placeholder="********"
                                        value={form.password}
                                        onChange={(event) => setForm((prev) => ({ ...prev, password: event.target.value }))}
                                        required
                                    />
                                    <button type="button" className="password-toggle" onClick={() => setShowPassword((value) => !value)}>👁</button>
                                </div>
                            </div>

                            <button type="submit" className="btn btn-primary btn-lg w-full" disabled={loading}>
                                {loading ? 'Entrando...' : 'Iniciar Sesión'}
                            </button>
                        </form>

                        <div className="auth-footer">
                            <p>¿No tienes cuenta? <Link to="/registro">Regístrate aquí</Link></p>
                        </div>
                    </div>
                </div>
            </div>
        </main>
    );
}
