import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import ProductCard from '../components/ProductCard';
import PageLoader from '../components/PageLoader';
import { useSession } from '../context/SessionContext';
import { getMercadoLocal } from '../lib/mercadoLocal';

export default function HistoryPage() {
    const session = useSession();
    const mercado = useMemo(() => getMercadoLocal(), []);

    const [loading, setLoading] = useState(true);
    const [products, setProducts] = useState([]);

    const loadHistory = useCallback(async () => {
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
    }, [mercado]);

    useEffect(() => {
        if (!session.token) {
            setLoading(false);
            return;
        }
        void loadHistory();
    }, [session.token, loadHistory]);

    if (loading) {
        return <PageLoader text="Cargando historial..." />;
    }

    return (
        <div className="container page-main">
            <div className="section-head-react">
                <h1>Historial</h1>
            </div>

            {session.token && products.length ? (
                <div className="products-grid-react">
                    {products.map((product) => (
                        <ProductCard key={product.id} product={product} />
                    ))}
                </div>
            ) : (
                <div className="empty-state">
                    <h3>No hay historial reciente</h3>
                    <Link to="/catalogo" className="btn btn-primary">Ir al catálogo</Link>
                </div>
            )}
        </div>
    );
}
