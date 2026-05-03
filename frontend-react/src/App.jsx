import { Navigate, Route, Routes } from 'react-router-dom';
import MainLayout from './components/MainLayout';
import LandingPage from './pages/LandingPage';
import HomePage from './pages/HomePage';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import CatalogPage from './pages/CatalogPage';
import ProductPage from './pages/ProductPage';
import CartPage from './pages/CartPage';
import CheckoutPage from './pages/CheckoutPage';
import FavoritesPage from './pages/FavoritesPage';
import HistoryPage from './pages/HistoryPage';
import TrackingClientPage from './pages/TrackingClientPage';
import CourierPage from './pages/CourierPage';
import AdminPage from './pages/AdminPage';
import SellerDashboardPage from './pages/SellerDashboardPage';
import SellerProfilePage from './pages/SellerProfilePage';
import NotFoundPage from './pages/NotFoundPage';

function AppShell({ children }) {
    return <MainLayout>{children}</MainLayout>;
}

export default function App() {
    return (
        <Routes>
            <Route path="/" element={<LandingPage />} />
            <Route path="/inicio" element={<AppShell><HomePage /></AppShell>} />
            <Route path="/login" element={<LoginPage />} />
            <Route path="/registro" element={<RegisterPage />} />
            <Route path="/catalogo" element={<AppShell><CatalogPage /></AppShell>} />
            <Route path="/producto" element={<AppShell><ProductPage /></AppShell>} />
            <Route path="/carrito" element={<AppShell><CartPage /></AppShell>} />
            <Route path="/checkout" element={<AppShell><CheckoutPage /></AppShell>} />
            <Route path="/favoritos" element={<AppShell><FavoritesPage /></AppShell>} />
            <Route path="/historial" element={<AppShell><HistoryPage /></AppShell>} />
            <Route path="/seguimiento-cliente" element={<AppShell><TrackingClientPage /></AppShell>} />
            <Route path="/repartidor" element={<AppShell><CourierPage /></AppShell>} />
            <Route path="/admin" element={<AppShell><AdminPage /></AppShell>} />
            <Route path="/vendedor" element={<AppShell><SellerDashboardPage /></AppShell>} />
            <Route path="/seller" element={<AppShell><SellerProfilePage /></AppShell>} />
            <Route path="/seguimiento" element={<Navigate to="/seguimiento-cliente?id=o-demo-1" replace />} />

            <Route path="/index.html" element={<Navigate to="/" replace />} />
            <Route path="/catalogo.html" element={<Navigate to="/catalogo" replace />} />
            <Route path="/producto.html" element={<Navigate to="/producto" replace />} />
            <Route path="/carrito.html" element={<Navigate to="/carrito" replace />} />
            <Route path="/checkout.html" element={<Navigate to="/checkout" replace />} />
            <Route path="/login.html" element={<Navigate to="/login" replace />} />
            <Route path="/registro.html" element={<Navigate to="/registro" replace />} />
            <Route path="/favoritos.html" element={<Navigate to="/favoritos" replace />} />
            <Route path="/historial.html" element={<Navigate to="/historial" replace />} />
            <Route path="/seguimiento-cliente.html" element={<Navigate to="/seguimiento-cliente" replace />} />
            <Route path="/repartidor.html" element={<Navigate to="/repartidor" replace />} />
            <Route path="/admin.html" element={<Navigate to="/admin" replace />} />
            <Route path="/vendedor.html" element={<Navigate to="/vendedor" replace />} />
            <Route path="/seller.html" element={<Navigate to="/seller" replace />} />

            <Route path="*" element={<AppShell><NotFoundPage /></AppShell>} />
        </Routes>
    );
}
