# Frontend Web (React + Vite)

Aplicacion web de MercadoLocal en React.

## 1) Requisitos

- Node.js 20+
- npm 10+
- Backend micro corriendo (`8001` y `8002`) si usaras datos remotos

## 2) Instalacion

```bash
cd frontend-react
npm install
```

## 3) Configuracion `.env.local`

Crea `frontend-react/.env.local`:

```env
VITE_USE_BACKEND=true
VITE_CLIENTES_API_URL=http://localhost:8001
VITE_PEDIDOS_API_URL=http://localhost:8002
VITE_LOCATIONIQ_API_KEY=TU_API_KEY_LOCATIONIQ
# opcional
VITE_GOOGLE_MAPS_API_KEY=TU_API_KEY_GOOGLE
```

Si entras desde otro equipo/celular, cambia `localhost` por la IP de tu laptop.

## 4) Ejecutar en desarrollo

```bash
npm run dev
```

Abrir:

- `http://localhost:5173`

## 5) Build de produccion

```bash
npm run build
npm run preview
```

## 6) Cuentas demo

- `admin@mercadolocal.mx` / `123456`
- `vendedor@mercadolocal.mx` / `123456`
- `cliente@mercadolocal.mx` / `123456`
- `repartidor@mercadolocal.mx` / `123456`

## 7) Rutas principales

- `/`
- `/login`
- `/registro`
- `/catalogo`
- `/producto?id=<id>`
- `/checkout`
- `/carrito`
- `/favoritos`
- `/historial`
- `/seguimiento-cliente?id=<id>&token=<token-opcional>`
- `/repartidor`
- `/vendedor`
- `/admin`

## 8) Mapa y geolocalizacion

- El proyecto usa LocationIQ para sugerencias/ruta cuando hay API key.
- Si LocationIQ falla, usa fallback visual de ruta para no romper UX.
- En web tambien existe vista integrada tipo Google Maps dentro de la app (sin obligar salida externa).

## 9) Nota de integracion

`VITE_USE_BACKEND=true` usa backend real.
Si lo pones en `false`, el adaptador puede usar datos locales/demo para algunas pantallas.
