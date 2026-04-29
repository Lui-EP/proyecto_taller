import { Link } from 'react-router-dom';

export default function NotFoundPage() {
    return (
        <div className="container page-main">
            <div className="empty-state">
                <h1>Página no encontrada</h1>
                <p>La ruta que intentaste abrir no existe.</p>
                <Link to="/" className="btn btn-primary">Volver al inicio</Link>
            </div>
        </div>
    );
}
