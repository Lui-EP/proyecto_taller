import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useSession } from '../context/SessionContext';
import { getMercadoLocal } from '../lib/mercadoLocal';
import { resolveImageSrc } from '../lib/assets';
import SafeImage from '../components/SafeImage';
import PageLoader from '../components/PageLoader';

export default function CartPage() {
    const mercado = getMercadoLocal();
    const session = useSession();
    const navigate = useNavigate();

    const [items, setItems] = useState([]);
    const [loading, setLoading] = useState(true);

    const loadCart = async () => {
        setLoading(true);
        try {
            const detailed = await mercado.getCartDetailedItems();
            setItems(Array.isArray(detailed) ? detailed : []);
        } catch {
            mercado.showToast('No se pudo cargar el carrito', 'error');
            setItems([]);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        void loadCart();
    }, []);

    const changeQty = async (productId, delta) => {
        const current = items.find((item) => item.product.id === productId);
        if (!current) return;

        const maxStock = Math.max(1, Number(current.product.stock || 1));
        const next = Math.min(maxStock, Math.max(1, Number(current.quantity || 1) + delta));
        await mercado.updateCartItemQuantity(productId, next);
        session.syncState();
        await loadCart();
    };

    const removeItem = async (productId) => {
        await mercado.removeFromCart(productId);
        session.syncState();
        await loadCart();
    };

    const clearCart = async () => {
        await mercado.clearCart();
        session.syncState();
        await loadCart();
    };

    const subtotal = mercado.getCartSubtotal(items);
    const itemsCount = items.reduce((sum, item) => sum + Number(item.quantity || 0), 0);

    if (loading) {
        return <PageLoader text="Cargando carrito..." />;
    }

    return (
        <div className="container checkout-react-page">
            <header className="checkout-header">
                <h1>Mi carrito</h1>
                <p>Revisa lo que ya agregaste antes de continuar con tu compra.</p>
            </header>

            <div className="checkout-layout">
                <section className="checkout-products">
                    <h2>Productos agregados</h2>
                    {!items.length ? (
                        <div className="empty-state">
                            <h3>Tu carrito está vacío</h3>
                            <Link to="/catalogo" className="btn btn-primary">Ir al catálogo</Link>
                        </div>
                    ) : (
                        items.map((item) => (
                            <article key={item.product.id} className="checkout-item">
                                <SafeImage
                                    src={resolveImageSrc(item.product.images?.[0], mercado.createPlaceholderImage(item.product.name))}
                                    alt={item.product.name}
                                    fallback={mercado.createPlaceholderImage(item.product.name)}
                                    loading="lazy"
                                />
                                <div className="checkout-item-info">
                                    <h3>{item.product.name}</h3>
                                    <p>{mercado.formatPrice(item.product.price)} c/u</p>
                                    <p className="stock-note">Stock disponible: {item.product.stock || 0}</p>
                                    <div className="checkout-item-actions">
                                        <button type="button" onClick={() => changeQty(item.product.id, -1)}>-</button>
                                        <span>{item.quantity}</span>
                                        <button type="button" onClick={() => changeQty(item.product.id, 1)}>+</button>
                                        <button type="button" className="remove" onClick={() => removeItem(item.product.id)}>Quitar</button>
                                    </div>
                                </div>
                                <strong>{mercado.formatPrice(item.subtotal)}</strong>
                            </article>
                        ))
                    )}
                </section>

                <aside className="checkout-summary">
                    <h2>Resumen del carrito</h2>
                    <div className="summary-row"><span>Productos</span><strong>{itemsCount}</strong></div>
                    <div className="summary-row"><span>Subtotal</span><strong>{mercado.formatPrice(subtotal)}</strong></div>
                    <div className="summary-row"><span>Envío</span><strong>Se calcula al pagar</strong></div>
                    <div className="summary-row total"><span>Total estimado</span><strong>{mercado.formatPrice(subtotal)}</strong></div>

                    <div className="cart-summary-actions">
                        <button className="btn btn-primary w-full" type="button" disabled={!items.length} onClick={() => navigate('/checkout')}>
                            Ir a pagar
                        </button>
                        <button className="btn btn-secondary w-full" type="button" onClick={() => navigate('/catalogo')}>
                            Seguir comprando
                        </button>
                        <button className="btn btn-outline w-full" type="button" disabled={!items.length} onClick={clearCart}>
                            Vaciar carrito
                        </button>
                    </div>
                </aside>
            </div>
        </div>
    );
}
