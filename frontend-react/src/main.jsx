import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { SessionProvider } from './context/SessionContext';
import App from './App';

import 'leaflet/dist/leaflet.css';
import './styles/common.css';
import './styles/home.css';
import './styles/catalog.css';
import './styles/checkout.css';
import './styles/auth.css';
import './styles/product.css';
import './styles/tracking.css';
import './styles/courier.css';
import './styles/admin.css';
import './styles/vendedor.css';
import './styles/seller.css';
import './styles/listados.css';
import './styles/react-app.css';

createRoot(document.getElementById('root')).render(
    <StrictMode>
        <BrowserRouter>
            <SessionProvider>
                <App />
            </SessionProvider>
        </BrowserRouter>
    </StrictMode>
);
