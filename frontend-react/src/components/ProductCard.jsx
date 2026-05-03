import { useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useSession } from '../context/SessionContext';
import { getMercadoLocal } from '../lib/mercadoLocal';
import { resolveImageSrc } from '../lib/assets';
import SafeImage from './SafeImage';

export default function ProductCard({ product, onChanged }) {
    const session = useSession();
    const navigate = useNavigate();
    const mercado = getMercadoLocal();

    const stock = Math.max(0, Number(product?.stock || 0));
    const isFav = useMemo(() => session.favorites.includes(product.id), [session.favorites, product.id]);
    const fallback = mercado.createPlaceholderImage(product.name || 'Producto');
    const image = resolveImageSrc(product.images?.[0], fallback);

    const toggleFavorite = async () => {
        if (!session.user) {
            mercado.showToast('Inicia sesión para usar favoritos', 'error');
            navigate('/login');
            return;
        }

        try {
            if (isFav) {
                await mercado.FavoritesAPI.remove(product.id);
                mercado.AppState.favorites = mercado.AppState.favorites.filter((item) => item !== product.id);
                mercado.showToast('Eliminado de favoritos');
            } else {
                await mercado.FavoritesAPI.add(product.id);
                mercado.AppState.favorites.push(product.id);
                mercado.showToast('Añadido a favoritos');
            }
            session.syncState();
            if (typeof onChanged === 'function') onChanged();
        } catch {
            mercado.showToast('No se pudo actualizar favorito', 'error');
        }
    };

    const addCart = async () => {
        await mercado.addProductToCart(product.id, 1);
        session.syncState();
        if (typeof onChanged === 'function') onChanged();
    };

    return (
        <article className="product-card" data-product-id={product.id}>
            <div className="product-image-container">
                <SafeImage
                    src={image}
                    alt={product.name}
                    fallback={fallback}
                    className="product-image"
                    loading="lazy"
                />

                <div className="product-badges">
                    {stock <= 0 ? <span className="badge badge-error">No disponible</span> : null}
                    {stock > 0 && stock <= 10 ? <span className="badge badge-warning">Quedan {stock}</span> : null}
                    {product.is_featured ? <span className="badge badge-terracotta">Destacado</span> : null}
                    {product.is_local_handmade ? <span className="badge badge-sage">✓ Local/Artesanal</span> : null}
                    {product.seller?.status === 'verified' ? <span className="badge badge-sage">✓ Vendedor verificado</span> : null}
                </div>

                <div className="product-actions">
                    <button type="button" className={`product-action-btn ${isFav ? 'favorited' : ''}`} onClick={toggleFavorite} title="Favorito">♥</button>
                    <button type="button" className="product-action-btn" onClick={addCart} title="Agregar al carrito">🛒</button>
                </div>
            </div>

            <Link to={`/producto?id=${encodeURIComponent(product.id)}`} className="product-content">
                <span className="product-category">{product.category?.name || 'Sin categoría'}</span>
                <h3 className="product-name">{product.name}</h3>
                <p className="product-price">{mercado.formatPrice(product.price)}</p>
                <p className="product-seller">📍 {product.seller_name || 'Vendedor local'}</p>
                <div className="product-stats">
                    <span className="product-stat">{stock} unidades</span>
                    <span className="product-stat">★ {product.average_rating || 0}</span>
                    <span className="product-stat">👁 {product.views || 0}</span>
                </div>
            </Link>
        </article>
    );
}
