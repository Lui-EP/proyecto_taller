import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import ProductCard from '../components/ProductCard';
import PageLoader from '../components/PageLoader';
import SafeImage from '../components/SafeImage';
import { useSession } from '../context/SessionContext';
import { getMercadoLocal } from '../lib/mercadoLocal';
import { resolveImageSrc } from '../lib/assets';

function LocalHistoryFallback() {
    const mercado = getMercadoLocal();
    const history = mercado.AppState.viewHistory || [];

    if (!history.length) {
        return (
            <div className="empty-state">
                <h3>No hay historial reciente</h3>
                <Link to="/catalogo" className="btn btn-primary">Ir al catálogo</Link>
            </div>
        );
    }

    return (
        <div className="local-history-grid">
            {history.map((item) => (
                <article className="local-history-card" key={item.id}>
                    <SafeImage
                        src={resolveImageSrc(item.image, mercado.createPlaceholderImage(item.name || 'Producto'))}
                        alt={item.name}
                        fallback={mercado.createPlaceholderImage(item.name || 'Producto')}
                        loading="lazy"
                    />
                    <div>
                        <h3>{item.name}</h3>
                        <p>{mercado.formatPrice(item.price)}</p>
                        <p className="text-muted">Visto: {mercado.formatDate(item.viewedAt)}</p>
                    </div>
                    <Link className="btn btn-secondary btn-sm" to={`/producto?id=${encodeURIComponent(item.id)}`}>Ver</Link>
                </article>
            ))}
        </div>
    );
}

export default function HistoryPage() {
    const session = useSession();
    const mercado = getMercadoLocal();

    const [loading, setLoading] = useState(true);
    const [products, setProducts] = useState([]);

    const loadHistory = async () => {
        setLoading(true);
        try {
            const list = await mercado.apiRequest('/history');
            setProducts(list || []);
        } catch {
            setProducts([]);
            mercado.showToast('No se pudo cargar historial del servidor', 'error');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (!session.token) {
            setLoading(false);
            return;
        }
        loadHistory();
    }, [session.token]);

    const clearHistory = () => {
        mercado.AppState.viewHistory = [];
        localStorage.removeItem('viewHistory');
        session.syncState();
        mercado.showToast('Historial local limpiado');
    };

    if (loading) {
        return <PageLoader text="Cargando historial..." />;
    }

    return (
        <div className="container page-main">
            <div className="section-head-react">
                <h1>Historial</h1>
                <button className="btn btn-secondary btn-sm" onClick={clearHistory}>Limpiar historial local</button>
            </div>

            {session.token && products.length ? (
                <div className="products-grid-react">
                    {products.map((product) => (
                        <ProductCard key={product.id} product={product} />
                    ))}
                </div>
            ) : (
                <LocalHistoryFallback />
            )}
        </div>
    );
}

