import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import ProductCard from '../components/ProductCard';
import PageLoader from '../components/PageLoader';
import { getMercadoLocal } from '../lib/mercadoLocal';

export default function SellerProfilePage() {
    const [searchParams] = useSearchParams();
    const sellerId = searchParams.get('id') || 'u-seller';
    const mercado = getMercadoLocal();

    const [loading, setLoading] = useState(true);
    const [seller, setSeller] = useState(null);
    const [products, setProducts] = useState([]);

    useEffect(() => {
        let cancelled = false;

        async function loadSeller() {
            setLoading(true);
            try {
                const [sellerResp, productsResp] = await Promise.all([
                    mercado.SellersAPI.getById(sellerId),
                    mercado.ProductsAPI.getAll({ seller_id: sellerId, limit: 120 }),
                ]);

                if (!cancelled) {
                    setSeller(sellerResp || null);
                    setProducts(productsResp?.products || []);
                }
            } catch {
                if (!cancelled) {
                    setSeller(null);
                    setProducts([]);
                }
                mercado.showToast('No se pudo cargar perfil del vendedor', 'error');
            } finally {
                if (!cancelled) setLoading(false);
            }
        }

        loadSeller();

        return () => {
            cancelled = true;
        };
    }, [sellerId]);

    if (loading) {
        return <PageLoader text="Cargando vendedor..." />;
    }

    if (!seller) {
        return (
            <div className="container page-main">
                <div className="empty-state">
                    <h2>Vendedor no encontrado</h2>
                </div>
            </div>
        );
    }

    const profile = seller.seller_profile || {};

    return (
        <div className="container page-main seller-profile-react">
            <section className="card seller-profile-head">
                <h1>{profile.business_name || seller.name}</h1>
                <p>{profile.description || 'Vendedor local de MercadoLocal'}</p>
                <div className="seller-meta-grid">
                    <span>📍 {profile.location || 'Ubicación no definida'}</span>
                    <span>📞 {profile.phone || seller.phone || 'Sin teléfono'}</span>
                    <span>🕒 {profile.schedule || 'Horario no definido'}</span>
                </div>
            </section>

            <section className="mt-xl">
                <h2>Productos publicados</h2>
                {products.length ? (
                    <div className="products-grid-react mt-xl">
                        {products.map((product) => (
                            <ProductCard key={product.id} product={product} />
                        ))}
                    </div>
                ) : (
                    <div className="empty-state mt-xl">Este vendedor aún no publica productos.</div>
                )}
            </section>
        </div>
    );
}
