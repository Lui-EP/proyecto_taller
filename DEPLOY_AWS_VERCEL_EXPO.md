# Deploy Produccion (AWS + Vercel + Expo)

## 1) Arquitectura recomendada

1. Backend microservicios en AWS (EC2 o ECS).
2. PostgreSQL en AWS RDS (5 bases separadas, una por microservicio).
3. Frontend web React en Vercel.
4. App movil nativa con Expo EAS Build/Submit.

Nota: La app movil nativa **no** se despliega en Vercel.  
Vercel solo sirve para la web.

## 2) Variables de backend (por microservicio)

Usa `.env` basado en cada `.env.example` y define:

```env
POSTGRES_HOST=<host-rds>
POSTGRES_PORT=5432
POSTGRES_DB=<db_del_microservicio>
POSTGRES_USER=<usuario>
POSTGRES_PASSWORD=<password>
POSTGRES_SSLMODE=require
ALLOWED_ORIGINS=https://tu-web.vercel.app,https://www.tu-dominio.com
```

Para local:

```env
POSTGRES_SSLMODE=disable
ALLOWED_ORIGINS=*
```

## 3) CORS en produccion

Ya quedo soportado por variable `ALLOWED_ORIGINS` en los 5 microservicios.

- `*` para desarrollo.
- Lista separada por comas para produccion.

Ejemplo:

```env
ALLOWED_ORIGINS=https://mercadolocal.vercel.app,https://mercadolocal.com
```

## 4) Frontend web (Vercel)

Proyecto: `frontend-react`

Variables en Vercel:

```env
VITE_CLIENTES_API_URL=https://api-clientes.tu-dominio.com
VITE_PEDIDOS_API_URL=https://api-pedidos.tu-dominio.com
VITE_LOCATIONIQ_API_KEY=<tu_key>
VITE_GOOGLE_MAPS_API_KEY=<tu_key_opcional>
```

Ya se incluyo `frontend-react/vercel.json` con rewrite SPA a `index.html`.

## 5) Frontend movil (Expo EAS)

Proyecto: `frontend-native`

Variables (`.env.local` o EAS secrets):

```env
EXPO_PUBLIC_CLIENTES_API_URL=https://api-clientes.tu-dominio.com
EXPO_PUBLIC_PEDIDOS_API_URL=https://api-pedidos.tu-dominio.com
EXPO_PUBLIC_LOCATIONIQ_API_KEY=<tu_key>
```

Comandos base:

```bash
cd frontend-native
npm install
npx expo login
npx eas build:configure
npx eas build -p android --profile preview
```

Ya se incluyo `frontend-native/eas.json`.

## 6) Health checks minimos

Confirma en navegador:

- `https://api-clientes.tu-dominio.com/health`
- `https://api-pedidos.tu-dominio.com/health`
- `https://api-repartidores.tu-dominio.com/health`
- `https://api-vendedores.tu-dominio.com/health`
- `https://api-productos.tu-dominio.com/health`

## 7) Checklist previo a publicar

1. Todos los microservicios levantan sin error de DB.
2. `ALLOWED_ORIGINS` apunta a dominio real de Vercel.
3. Web carga catalogo/login contra backend remoto.
4. Movil inicia sesion contra backend remoto.
5. Checkout, carrito y pedidos persisten en DB.
