# Frontend Web (React + Vite)

Aplicacion web de MercadoLocal en React.

Modo actual: **remoto estricto**.  
No usa datos locales ni `localStorage` para negocio; todo sale del backend API.

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
# opcion A (recomendada): una sola URL del gateway/API publica
VITE_API_URL=http://localhost:8010

# opcion B: URLs separadas (si no usas gateway)
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

## 5.1) Deploy en Vercel

El proyecto ya incluye `vercel.json` para rutas SPA.

Configuracion recomendada (2 proyectos separados):

1. Landing publica (repo `proyecto_taller_landingpage`)
   - `VITE_API_URL=https://mercado-local.ddns.net`
   - `VITE_APP_URL=https://TU-WEB-APP.vercel.app`
2. Web app principal (este repo, carpeta `frontend-react`)
   - `VITE_API_URL=https://mercado-local.ddns.net`
   - `VITE_CLIENTES_API_URL=https://mercado-local.ddns.net/api/clientes`
   - `VITE_PEDIDOS_API_URL=https://mercado-local.ddns.net/api/pedidos`

Variables recomendadas en Vercel:

```env
# recomendado si expones el gateway:
VITE_API_URL=https://mercado-local.ddns.net
VITE_APP_URL=https://TU-WEB-APP.vercel.app

# alternativa (si expones servicios por separado):
VITE_CLIENTES_API_URL=https://api-clientes.tu-dominio.com
VITE_PEDIDOS_API_URL=https://api-pedidos.tu-dominio.com

VITE_LOCATIONIQ_API_KEY=pk_xxx
VITE_GOOGLE_MAPS_API_KEY=xxx (opcional)
```

Importante: si Vercel corre en `https://`, tu backend tambien debe responder por `https://` (si usas `http://` el navegador lo bloqueara por seguridad).

Validacion rapida despues de deploy:

1. Abrir landing y hacer click en `Explorar Plataforma`:
   - Debe abrir `https://TU-WEB-APP.vercel.app/inicio` directo.
2. Abrir `https://mercado-local.ddns.net/health`:
   - Debe responder `ok`.
3. En web app, abrir catalogo:
   - Deben cargar productos e imagenes sin errores CORS.

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
- Si LocationIQ falla, no se inyectan sugerencias locales; se mantiene flujo remoto.
- En web tambien existe vista integrada tipo Google Maps dentro de la app (sin obligar salida externa).

## 9) Nota de integracion

Define siempre `VITE_CLIENTES_API_URL` y `VITE_PEDIDOS_API_URL` antes de correr la app.
