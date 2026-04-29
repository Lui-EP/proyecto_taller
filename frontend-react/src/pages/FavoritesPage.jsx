import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import ProductCard from '../components/ProductCard';
import PageLoader from '../components/PageLoader';
import { useSession } from '../context/SessionContext';
import { getMercadoLocal } from '../lib/mercadoLocal';

export default function FavoritesPage() {
    const session = useSession();
    const mercado = getMercadoLocal();
    const [loading, setLoading] = useState(true);
    const [products, setProducts] = useState([]);

    const loadFavorites = async () => {
        setLoading(true);
        try {
            const list = await mercado.FavoritesAPI.getAll();
            setProducts(list || []);
            mercado.AppState.favorites = (list || []).map((item) => item.id);
            localStorage.setItem('favorites', JSON.stringify(mercado.AppState.favorites));
            session.syncState();
        } catch {
            setProducts([]);
            mercado.showToast('No se pudieron cargar favoritos', 'error');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (!session.token) {
            setLoading(false);
            return;
        }
        loadFavorites();
    }, [session.token]);

    if (!session.token) {
        return (
            <div className="container page-main">
                <div className="empty-state">
                    <h2>Inicia sesión para ver favoritos</h2>
                    <Link to="/login" className="btn btn-primary">Ir a login</Link>
                </div>
            </div>
        );
    }

    if (loading) {
        return <PageLoader text="Cargando favoritos..." />;
    }

    return (
        <div className="container page-main">
            <div className="section-head-react">
                <h1>Mis favoritos</h1>
                <button className="btn btn-secondary btn-sm" onClick={loadFavorites}>Actualizar</button>
            </div>

            {products.length ? (
                <div className="products-grid-react">
                    {products.map((product) => (
                        <ProductCard key={product.id} product={product} onChanged={loadFavorites} />
                    ))}
                </div>
            ) : (
                <div className="empty-state">
                    <h3>Aún no tienes favoritos</h3>
                    <Link to="/catalogo" className="btn btn-primary">Explorar catálogo</Link>
                </div>
            )}
        </div>
    );
}
