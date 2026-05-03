import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useSession } from '../context/SessionContext';
import { getMercadoLocal } from '../lib/mercadoLocal';
import SafeImage from '../components/SafeImage';
import PageLoader from '../components/PageLoader';

const REPORT_OPTIONS = [
    { value: 'fake', label: 'Producto falso o engañoso' },
    { value: 'inappropriate', label: 'Contenido inapropiado' },
    { value: 'scam', label: 'Posible estafa' },
    { value: 'other', label: 'Otro' },
];

export default function ProductPage() {
    const [searchParams] = useSearchParams();
    const productId = searchParams.get('id') || '';
    const mercado = getMercadoLocal();
    const session = useSession();
    const navigate = useNavigate();

    const [product, setProduct] = useState(null);
    const [loading, setLoading] = useState(true);
    const [imageIndex, setImageIndex] = useState(0);
    const [showReportModal, setShowReportModal] = useState(false);
    const [showShareModal, setShowShareModal] = useState(false);

    const [review, setReview] = useState({ rating: 0, comment: '' });
    const [report, setReport] = useState({ reason: 'fake', description: '' });

    const images = useMemo(() => {
        if (!product) return [];
        const fallback = mercado.createPlaceholderImage(product.name || 'Producto');
        return product.images?.length ? product.images : [fallback];
    }, [product]);

    const isFav = useMemo(() => session.favorites.includes(product?.id), [session.favorites, product?.id]);

    useEffect(() => {
        let cancelled = false;

        async function loadProduct() {
            if (!productId) {
                setLoading(false);
                return;
            }

            try {
                const response = await mercado.ProductsAPI.getById(productId);
                if (!cancelled) {
                    setProduct(response);
                    setImageIndex(0);
                    mercado.addToHistory(response);
                    session.syncState();
                }
            } catch {
                if (!cancelled) setProduct(null);
                mercado.showToast('No se encontró el producto', 'error');
            } finally {
                if (!cancelled) setLoading(false);
            }
        }

        loadProduct();

        return () => {
            cancelled = true;
        };
    }, [productId]);

    const buyNow = async () => {
        if (!product) return;
        await mercado.addProductToCart(product.id, 1);
        session.syncState();
        navigate('/checkout');
    };

    const toggleFavorite = async () => {
        if (!product) return;
        if (!session.user) {
            mercado.showToast('Inicia sesión para guardar favoritos', 'error');
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
        } catch {
            mercado.showToast('Error al actualizar favoritos', 'error');
        }
    };

    const submitReview = async (event) => {
        event.preventDefault();

        if (!session.user) {
            mercado.showToast('Inicia sesión para dejar reseña', 'error');
            navigate('/login');
            return;
        }

        if (!review.rating) {
            mercado.showToast('Selecciona una calificación', 'error');
            return;
        }

        try {
            await mercado.ReviewsAPI.create({
                product_id: product.id,
                rating: Number(review.rating || 0),
                comment: review.comment,
            });
            mercado.showToast('¡Reseña enviada!');
            setReview({ rating: 0, comment: '' });
            const refreshed = await mercado.ProductsAPI.getById(product.id);
            setProduct(refreshed);
        } catch (error) {
            mercado.showToast(error.message || 'No se pudo enviar reseña', 'error');
        }
    };

    const reportReview = async (reviewId) => {
        if (!session.user) {
            mercado.showToast('Inicia sesión para reportar', 'error');
            navigate('/login');
            return;
        }

        const description = window.prompt('Describe por qué quieres reportar esta reseña:');
        if (description === null) return;

        try {
            await mercado.ReportsAPI.create({
                target_type: 'review',
                target_id: reviewId,
                reason: 'inappropriate',
                description,
            });
            mercado.showToast('Reseña reportada');
        } catch {
            mercado.showToast('Error al reportar la reseña', 'error');
        }
    };

    const submitReport = async (event) => {
        event.preventDefault();

        if (!session.user) {
            mercado.showToast('Inicia sesión para reportar', 'error');
            navigate('/login');
            return;
        }

        if (!report.reason) {
            mercado.showToast('Selecciona un motivo', 'error');
            return;
        }

        try {
            await mercado.ReportsAPI.create({
                target_type: 'product',
                target_id: product.id,
                reason: report.reason,
                description: report.description,
            });
            mercado.showToast('Reporte enviado. Gracias por ayudarnos.');
            setShowReportModal(false);
            setReport({ reason: 'fake', description: '' });
        } catch {
            mercado.showToast('Error al enviar reporte', 'error');
        }
    };

    const shareWhatsApp = () => {
        if (!product) return;
        const url = `${window.location.origin}/producto?id=${product.id}`;
        const text = `Mira este producto: ${product.name} - ${mercado.formatPrice(product.price)}`;
        window.open(`https://wa.me/?text=${encodeURIComponent(`${text} ${url}`)}`, '_blank', 'noopener,noreferrer');
    };

    const shareFacebook = () => {
        if (!product) return;
        const url = `${window.location.origin}/producto?id=${product.id}`;
        window.open(`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`, '_blank', 'noopener,noreferrer');
    };

    if (loading) {
        return <PageLoader text="Cargando producto..." />;
    }

    if (!product) {
        return (
            <main className="product-detail-page">
                <div className="container">
                    <div className="empty-state">
                        <div className="empty-state-icon">❌</div>
                        <h3 className="empty-state-title">Producto no encontrado</h3>
                        <p className="empty-state-description">El producto que buscas no existe o ha sido eliminado.</p>
                        <Link to="/catalogo" className="btn btn-primary">Volver al catálogo</Link>
                    </div>
                </div>
            </main>
        );
    }

    const fallback = mercado.createPlaceholderImage(product.name || 'Producto');
    const averageRounded = Math.max(0, Math.min(5, Math.round(Number(product.average_rating || 0))));

    return (
        <>
            <main className="product-detail-page">
                <div className="container">
                    <Link to="/catalogo" className="back-button">
                        <span>←</span>
                        <span>Volver al catálogo</span>
                    </Link>

                    <div className="product-detail-grid">
                        <div className="product-gallery">
                            <div className="product-main-image">
                                <SafeImage
                                    src={images[imageIndex]}
                                    alt={product.name}
                                    fallback={fallback}
                                />
                                {images.length > 1 ? (
                                    <>
                                        <button className="gallery-nav prev" onClick={() => setImageIndex((index) => (index - 1 + images.length) % images.length)}>‹</button>
                                        <button className="gallery-nav next" onClick={() => setImageIndex((index) => (index + 1) % images.length)}>›</button>
                                    </>
                                ) : null}
                            </div>

                            {images.length > 1 ? (
                                <div className="product-thumbnails">
                                    {images.map((image, index) => (
                                        <button key={`${image}-${index}`} className={`product-thumbnail ${imageIndex === index ? 'active' : ''}`} onClick={() => setImageIndex(index)}>
                                            <SafeImage src={image} alt={`Imagen ${index + 1}`} fallback={fallback} loading="lazy" />
                                        </button>
                                    ))}
                                </div>
                            ) : null}
                        </div>

                        <div className="product-info">
                            <Link to={`/catalogo?category=${encodeURIComponent(product.category_id || '')}`} className="product-category-link">
                                {product.category?.name || 'Sin categoría'}
                            </Link>

                            <h1 className="product-detail-title">{product.name}</h1>

                            <div className="product-badge-row">
                                {product.is_featured ? <span className="badge badge-terracotta">⭐ Destacado</span> : null}
                                {product.is_local_handmade ? (
                                    <span className={`badge ${product.local_handmade_verified ? 'badge-sage' : 'badge-warning'}`}>
                                        {product.local_handmade_verified ? '✓ ' : ''}Local/Artesanal
                                    </span>
                                ) : null}
                            </div>

                            <p className="product-detail-price">{mercado.formatPrice(product.price)}</p>

                            <div className="product-detail-stats">
                                <div className="product-detail-stat">
                                    <span>{'★'.repeat(averageRounded)}{'☆'.repeat(5 - averageRounded)}</span>
                                    <span>({product.reviews?.length || 0} reseñas)</span>
                                </div>
                                <div className="product-detail-stat"><span>📦</span><span>{product.stock || 0} unidades</span></div>
                                <div className="product-detail-stat"><span>👁</span><span>{product.views || 0} vistas</span></div>
                                <div className="product-detail-stat"><span>♥</span><span>{product.favorites_count || 0} favoritos</span></div>
                            </div>

                            <div className="product-detail-actions">
                                <button className="btn btn-primary" onClick={buyNow}>Comprar ahora</button>
                                <button className={`btn ${isFav ? 'btn-primary' : 'btn-outline'}`} onClick={toggleFavorite}>
                                    {isFav ? '♥ En Favoritos' : '🤍 Añadir a Favoritos'}
                                </button>
                                <button className="btn btn-secondary" onClick={() => setShowShareModal(true)}>📤 Compartir</button>
                            </div>

                            <div className="product-description">
                                <h3>Descripción</h3>
                                <p>{product.description || 'Sin descripción disponible.'}</p>
                            </div>

                            <div className="seller-info-card">
                                <div className="seller-info-header">
                                    <div className="seller-info-avatar">{String(product.seller?.name || 'V').charAt(0).toUpperCase()}</div>
                                    <div className="seller-info-details">
                                        <h4>
                                            {product.seller?.seller_profile?.business_name || product.seller?.name || 'Vendedor'}
                                            {product.seller?.status === 'verified' ? <span className="badge badge-sage">✓ Verificado</span> : null}
                                        </h4>
                                        <p><span>📍</span>{product.seller?.seller_profile?.location || 'Ubicación no especificada'}</p>
                                    </div>
                                </div>

                                {product.seller?.seller_profile?.description ? <p className="seller-description">{product.seller.seller_profile.description}</p> : null}

                                <div className="seller-metrics">
                                    <span className="badge badge-info">Productos: {product.seller?.total_products || 0}</span>
                                    <span className="badge badge-info">Reseñas: {product.seller?.total_reviews || 0}</span>
                                    {(product.seller?.average_rating || 0) > 0 ? <span className="badge badge-sage">★ {product.seller.average_rating}</span> : null}
                                </div>

                                <Link to={`/seller?id=${encodeURIComponent(product.seller_id || '')}`} className="btn btn-secondary btn-sm">Ver perfil del vendedor</Link>
                                <Link to={`/catalogo?seller=${encodeURIComponent(product.seller_id || '')}`} className="btn btn-secondary btn-sm">Ver más productos de este vendedor</Link>
                            </div>
                        </div>
                    </div>

                    <section className="reviews-section">
                        <h2>Reseñas y Calificaciones</h2>
                        <div className="reviews-grid">
                            <div className="write-review-card" id="review-form-container">
                                {session.user ? (
                                    <>
                                        <h3>Deja tu reseña</h3>
                                        <form onSubmit={submitReview}>
                                            <div className="rating-input">
                                                <label>Tu calificación</label>
                                                <div className="star-rating">
                                                    {[1, 2, 3, 4, 5].map((value) => (
                                                        <button
                                                            key={value}
                                                            type="button"
                                                            className={`star ${review.rating >= value ? 'filled' : ''}`}
                                                            onClick={() => setReview((prev) => ({ ...prev, rating: value }))}
                                                        >
                                                            ★
                                                        </button>
                                                    ))}
                                                </div>
                                            </div>
                                            <div className="form-group">
                                                <label className="form-label">Comentario (opcional)</label>
                                                <textarea
                                                    className="form-input form-textarea"
                                                    placeholder="Cuéntanos tu experiencia..."
                                                    value={review.comment}
                                                    onChange={(event) => setReview((prev) => ({ ...prev, comment: event.target.value }))}
                                                ></textarea>
                                            </div>
                                            <button type="submit" className="btn btn-primary w-full">Enviar Reseña</button>
                                        </form>
                                    </>
                                ) : (
                                    <p className="review-login-hint"><Link to="/login" className="review-login-link">Inicia sesión</Link> para dejar una reseña</p>
                                )}
                            </div>

                            <div className="reviews-list" id="reviews-list">
                                {(product.reviews || []).length ? (
                                    (product.reviews || []).map((item) => (
                                        <div className="review-card" key={item.id}>
                                            <div className="review-header">
                                                <div>
                                                    <span className="review-author">{item.user_name}</span>
                                                    <div className="review-stars">{'★'.repeat(item.rating)}{'☆'.repeat(5 - item.rating)}</div>
                                                </div>
                                                <div className="review-meta-actions">
                                                    <span className="review-date">{mercado.formatDate(item.created_at)}</span>
                                                    <button className="btn btn-secondary btn-sm" onClick={() => reportReview(item.id)} title="Reportar reseña">🚩</button>
                                                </div>
                                            </div>
                                            {item.comment ? <p className="review-content">{item.comment}</p> : null}
                                        </div>
                                    ))
                                ) : (
                                    <div className="empty-state">
                                        <div className="empty-state-icon">💬</div>
                                        <h3 className="empty-state-title">Sin reseñas aún</h3>
                                        <p className="empty-state-description">Sé el primero en dejar una reseña.</p>
                                    </div>
                                )}
                            </div>
                        </div>

                        <div className="review-actions-footer">
                            <button className="btn btn-secondary btn-sm report-product-btn" onClick={() => setShowReportModal(true)}>🚩 Reportar producto</button>
                        </div>
                    </section>
                </div>
            </main>

            <div className="product-mobile-buybar" aria-label="Acciones rápidas del producto">
                <div className="product-mobile-buybar-price">
                    <strong>{mercado.formatPrice(product.price)}</strong>
                    <span>{Math.max(0, Number(product.stock || 0))} unidades disponibles</span>
                </div>
                <button className="btn btn-primary product-mobile-buybtn" onClick={buyNow}>Comprar</button>
                <button
                    type="button"
                    className={`product-mobile-favbtn ${isFav ? 'active' : ''}`}
                    onClick={toggleFavorite}
                    aria-label={isFav ? 'Quitar de favoritos' : 'Agregar a favoritos'}
                >
                    {isFav ? '♥' : '♡'}
                </button>
            </div>

            <div className={`modal-overlay ${showReportModal ? 'show' : ''}`}>
                <div className="modal">
                    <div className="modal-header">
                        <h3 className="modal-title">Reportar Producto</h3>
                        <button className="modal-close" onClick={() => setShowReportModal(false)}>×</button>
                    </div>
                    <div className="modal-body">
                        <form onSubmit={submitReport}>
                            <div className="report-options">
                                {REPORT_OPTIONS.map((option) => (
                                    <label key={option.value} className="report-option">
                                        <input
                                            type="radio"
                                            name="report-reason"
                                            value={option.value}
                                            checked={report.reason === option.value}
                                            onChange={(event) => setReport((prev) => ({ ...prev, reason: event.target.value }))}
                                        />
                                        <span>{option.label}</span>
                                    </label>
                                ))}
                            </div>
                            <div className="form-group">
                                <label className="form-label">Descripción adicional (opcional)</label>
                                <textarea
                                    className="form-input form-textarea"
                                    placeholder="Cuéntanos más detalles..."
                                    value={report.description}
                                    onChange={(event) => setReport((prev) => ({ ...prev, description: event.target.value }))}
                                ></textarea>
                            </div>
                            <button type="submit" className="btn btn-primary w-full">Enviar Reporte</button>
                        </form>
                    </div>
                </div>
            </div>

            <div className={`modal-overlay ${showShareModal ? 'show' : ''}`}>
                <div className="modal">
                    <div className="modal-header">
                        <h3 className="modal-title">Compartir Producto</h3>
                        <button className="modal-close" onClick={() => setShowShareModal(false)}>×</button>
                    </div>
                    <div className="modal-body">
                        <div className="share-buttons">
                            <button className="share-btn whatsapp" onClick={shareWhatsApp}>📱 WhatsApp</button>
                            <button className="share-btn facebook" onClick={shareFacebook}>📘 Facebook</button>
                        </div>
                    </div>
                </div>
            </div>
        </>
    );
}
