import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import SplitText from '../components/SplitText';
import { useSession } from '../context/SessionContext';
import { getMercadoLocal } from '../lib/mercadoLocal';

function resolveInitialRole(rawRole) {
    const safe = String(rawRole || '').toLowerCase();
    if (safe === 'seller' || safe === 'courier') return safe;
    return 'buyer';
}

export default function RegisterPage() {
    const [searchParams] = useSearchParams();
    const initialRole = resolveInitialRole(searchParams.get('role'));

    const [loading, setLoading] = useState(false);
    const [showPassword, setShowPassword] = useState(false);
    const [showConfirm, setShowConfirm] = useState(false);
    const [form, setForm] = useState({
        name: '',
        email: '',
        password: '',
        confirmPassword: '',
        role: initialRole,
        phone: '',
        location: '',
        curp: '',
    });

    const session = useSession();
    const navigate = useNavigate();
    const mercado = getMercadoLocal();

    useEffect(() => {
        if (session.token && session.user) {
            navigate('/catalogo', { replace: true });
        }
    }, [session.token, session.user, navigate]);

    const isSeller = form.role === 'seller';
    const needsProfileFields = form.role === 'seller' || form.role === 'courier';

    const canSubmit = useMemo(() => {
        if (!form.name || !form.email || !form.password || !form.confirmPassword) return false;
        if (form.password !== form.confirmPassword) return false;
        if (needsProfileFields && (!form.phone || !form.location)) return false;
        if (isSeller && !form.curp) return false;
        return true;
    }, [form, isSeller, needsProfileFields]);

    const onSubmit = async (event) => {
        event.preventDefault();

        if (!canSubmit) {
            mercado.showToast('Completa los datos correctamente', 'error');
            return;
        }

        if (form.password.length < 6) {
            mercado.showToast('La contrasena debe tener al menos 6 caracteres', 'error');
            return;
        }

        if (needsProfileFields && form.phone.trim().length !== 10) {
            mercado.showToast('El numero de telefono debe tener 10 digitos', 'error');
            return;
        }

        if (isSeller && form.curp.trim().length !== 18) {
            mercado.showToast('La CURP debe tener 18 caracteres', 'error');
            return;
        }

        setLoading(true);
        try {
            const user = await session.register({
                name: form.name.trim(),
                email: form.email.trim(),
                password: form.password,
                role: form.role,
                phone: form.phone.trim(),
                location: form.location.trim(),
                curp: form.curp.trim().toUpperCase(),
            });

            mercado.showToast(`Bienvenido, ${user.name}`);
            if (user.role === 'seller') navigate('/vendedor');
            else if (user.role === 'courier') navigate('/repartidor');
            else navigate('/catalogo');
        } catch (error) {
            mercado.showToast(error.message || 'No se pudo crear la cuenta', 'error');
        } finally {
            setLoading(false);
        }
    };

    return (
        <main className="auth-page">
            <div className="auth-container">
                <Link to="/inicio" className="auth-back-link">
                    <span>&larr;</span>
                    <span>Volver al inicio</span>
                </Link>

                <div className="auth-card">
                    <div className="auth-header">
                        <div className="auth-logo">
                            <img src="/img/logo-jaguar.png" alt="JAGUARYU" className="auth-logo-image" />
                        </div>
                        <SplitText as="h1" text="Crear cuenta" className="auth-title" delay={30} stagger={26} />
                        <p className="auth-subtitle">Unete a nuestra comunidad</p>
                    </div>

                    <div className="auth-body">
                        <form className="auth-form" onSubmit={onSubmit}>
                            <div className="form-group">
                                <label className="form-label">Como quieres usar MercadoLocal?</label>
                                <div className="role-selection">
                                    <label className="role-option">
                                        <input
                                            type="radio"
                                            name="role"
                                            value="buyer"
                                            checked={form.role === 'buyer'}
                                            onChange={() => setForm((prev) => ({ ...prev, role: 'buyer' }))}
                                        />
                                        <div className="role-option-content">
                                            <div className="role-icon buyer">🛒</div>
                                            <span className="role-title">Comprador</span>
                                            <span className="role-subtitle">Busco productos locales</span>
                                        </div>
                                    </label>
                                    <label className="role-option">
                                        <input
                                            type="radio"
                                            name="role"
                                            value="seller"
                                            checked={form.role === 'seller'}
                                            onChange={() => setForm((prev) => ({ ...prev, role: 'seller' }))}
                                        />
                                        <div className="role-option-content">
                                            <div className="role-icon seller">🏪</div>
                                            <span className="role-title">Vendedor</span>
                                            <span className="role-subtitle">Quiero vender productos</span>
                                        </div>
                                    </label>
                                    <label className="role-option">
                                        <input
                                            type="radio"
                                            name="role"
                                            value="courier"
                                            checked={form.role === 'courier'}
                                            onChange={() => setForm((prev) => ({ ...prev, role: 'courier' }))}
                                        />
                                        <div className="role-option-content">
                                            <div className="role-icon courier">🛵</div>
                                            <span className="role-title">Repartidor</span>
                                            <span className="role-subtitle">Quiero entregar pedidos</span>
                                        </div>
                                    </label>
                                </div>
                            </div>

                            <div className="form-group">
                                <label htmlFor="register-name" className="form-label">Nombre completo</label>
                                <input
                                    type="text"
                                    id="register-name"
                                    className="form-input"
                                    placeholder="Tu nombre"
                                    value={form.name}
                                    onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))}
                                    required
                                />
                            </div>

                            <div className="form-group">
                                <label htmlFor="register-email" className="form-label">Correo electronico</label>
                                <input
                                    type="email"
                                    id="register-email"
                                    className="form-input"
                                    placeholder="tu@email.com"
                                    value={form.email}
                                    onChange={(event) => setForm((prev) => ({ ...prev, email: event.target.value }))}
                                    required
                                />
                            </div>

                            <div className="form-group">
                                <label htmlFor="register-password" className="form-label">Contrasena</label>
                                <div className="password-input-container">
                                    <input
                                        type={showPassword ? 'text' : 'password'}
                                        id="register-password"
                                        className="form-input"
                                        placeholder="Minimo 6 caracteres"
                                        value={form.password}
                                        onChange={(event) => setForm((prev) => ({ ...prev, password: event.target.value }))}
                                        minLength={6}
                                        required
                                    />
                                    <button type="button" className="password-toggle" onClick={() => setShowPassword((value) => !value)}>👁</button>
                                </div>
                            </div>

                            <div className="form-group">
                                <label htmlFor="register-confirm-password" className="form-label">Confirmar contrasena</label>
                                <div className="password-input-container">
                                    <input
                                        type={showConfirm ? 'text' : 'password'}
                                        id="register-confirm-password"
                                        className="form-input"
                                        placeholder="Repite tu contrasena"
                                        value={form.confirmPassword}
                                        onChange={(event) => setForm((prev) => ({ ...prev, confirmPassword: event.target.value }))}
                                        required
                                    />
                                    <button type="button" className="password-toggle" onClick={() => setShowConfirm((value) => !value)}>👁</button>
                                </div>
                            </div>

                            <div className={needsProfileFields ? '' : 'hidden'}>
                                <div className="form-group">
                                    <label htmlFor="register-phone" className="form-label">Numero de telefono</label>
                                    <input
                                        type="tel"
                                        id="register-phone"
                                        className="form-input"
                                        placeholder="10 digitos"
                                        value={form.phone}
                                        onChange={(event) => setForm((prev) => ({ ...prev, phone: event.target.value.replace(/\D/g, '').slice(0, 10) }))}
                                        pattern="[0-9]{10}"
                                        maxLength="10"
                                        required={needsProfileFields}
                                    />
                                </div>
                                <div className="form-group">
                                    <label htmlFor="register-location" className="form-label">Ubicacion</label>
                                    <input
                                        type="text"
                                        id="register-location"
                                        className="form-input"
                                        placeholder="Ciudad, Estado"
                                        value={form.location}
                                        onChange={(event) => setForm((prev) => ({ ...prev, location: event.target.value }))}
                                        required={needsProfileFields}
                                    />
                                </div>
                                <div className={isSeller ? 'form-group' : 'hidden'}>
                                    <label htmlFor="register-curp" className="form-label">CURP</label>
                                    <input
                                        type="text"
                                        id="register-curp"
                                        className="form-input"
                                        placeholder="18 caracteres"
                                        maxLength={18}
                                        value={form.curp}
                                        onChange={(event) => setForm((prev) => ({ ...prev, curp: event.target.value }))}
                                        required={isSeller}
                                    />
                                </div>
                            </div>

                            <button type="submit" className="btn btn-primary btn-lg w-full" disabled={loading}>
                                {loading ? 'Creando cuenta...' : 'Crear cuenta'}
                            </button>
                        </form>

                        <div className="auth-footer">
                            <p>Ya tienes cuenta? <Link to="/login">Inicia sesion</Link></p>
                        </div>
                    </div>
                </div>
            </div>
        </main>
    );
}
