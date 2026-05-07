# REPORTE TECNICO - Backend (principal) y Frontend (resumen)

Proyecto: `proyecto_interfaz`
Fecha de corte: `2026-05-06`


## 1) Resumen rapido

- Backend actual: **arquitectura de microservicios** en `backend-micro`.
- Total de microservicios de negocio: **5**.
- API Gateway: **1** servicio adicional de entrada.
- Persistencia: **PostgreSQL** (una base por microservicio, mismo servidor).
- Contenedores: configuracion Docker para local y para AWS.
- Frontends:
  - Web: `frontend-react` (Vite + React)
  - Movil: `frontend-native` (Expo + React Native)

## 2) Estructura backend encontrada

Carpeta principal backend:
- `backend-micro/api-gateway`
- `backend-micro/clientes-service`
- `backend-micro/pedidos-service`
- `backend-micro/productos-service`
- `backend-micro/repartidores-service`
- `backend-micro/vendedores-service`

Archivo principal por servicio:
- `backend-micro/api-gateway/infraestructura/api/main.py`
- `backend-micro/clientes-service/infraestructura/api/main.py`
- `backend-micro/pedidos-service/infraestructura/api/main.py`
- `backend-micro/productos-service/infraestructura/api/main.py`
- `backend-micro/repartidores-service/infraestructura/api/main.py`
- `backend-micro/vendedores-service/infraestructura/api/main.py`

## 3) Microservicios, puertos y base de datos

| Servicio | Puerto app | Base de datos | Variables DB por defecto |
|---|---:|---|---|
| clientes-service | 8001 | `bd_clientes_ms` | `POSTGRES_HOST=127.0.0.1`, `POSTGRES_PORT=5433` |
| pedidos-service | 8002 | `bd_pedidos_ms` | `POSTGRES_HOST=127.0.0.1`, `POSTGRES_PORT=5433` |
| repartidores-service | 8003 | `bd_repartidores_ms` | `POSTGRES_HOST=127.0.0.1`, `POSTGRES_PORT=5433` |
| vendedores-service | 8004 | `bd_vendedores_ms` | `POSTGRES_HOST=127.0.0.1`, `POSTGRES_PORT=5433` |
| productos-service | 8005 | `bd_productos_ms` | `POSTGRES_HOST=127.0.0.1`, `POSTGRES_PORT=5433` |
| api-gateway | 8010 | No aplica | Enruta a 8001..8005 |

Creacion de bases detectada:
- `backend-micro/sql/crear_bd.sql`
  - `CREATE DATABASE bd_clientes_ms;`
  - `CREATE DATABASE bd_pedidos_ms;`
  - `CREATE DATABASE bd_repartidores_ms;`
  - `CREATE DATABASE bd_vendedores_ms;`
  - `CREATE DATABASE bd_productos_ms;`

## 4) Docker o no Docker

### 4.1 Modo Docker local (archivo: `backend-micro/docker-compose.yml`)

- Levanta:
  - `postgres-micro` (externo `5433`, interno `5432`)
  - `rabbitmq` (externo `5673/15673`)
  - `clientes-service` (externo `8001`)
  - `pedidos-service` (externo `8002`)
  - `repartidores-service` (externo `8003`)
  - `vendedores-service` (externo `8004`)
  - `productos-service` (externo `8005`)
- En este compose local, **gateway no esta incluido**.

### 4.2 Modo Docker AWS (archivo: `backend-micro/deploy/aws/docker-compose.yml`)

- Levanta:
  - `postgres-micro` (externo `5433`, interno `5432`)
  - Los 5 microservicios
  - `api-gateway` (externo `8010`)
- Red docker: `mercadolocal-net`
- El acceso publico recomendado es por gateway:
  - `https://tu-dominio/...` -> Nginx reverse proxy -> `api-gateway:8010`

### 4.3 Modo sin Docker (manual)

En README de backend se define arranque con Uvicorn por servicio:
- clientes: `--port 8001`
- pedidos: `--port 8002`
- repartidores: `--port 8003`
- vendedores: `--port 8004`
- productos: `--port 8005`

## 5) API Gateway (entrada unica)

Archivo: `backend-micro/api-gateway/infraestructura/api/main.py`

Mapeo de servicios por variable de entorno:
- `CLIENTES_SERVICE_URL` -> `http://127.0.0.1:8001` (default)
- `PEDIDOS_SERVICE_URL` -> `http://127.0.0.1:8002`
- `REPARTIDORES_SERVICE_URL` -> `http://127.0.0.1:8003`
- `VENDEDORES_SERVICE_URL` -> `http://127.0.0.1:8004`
- `PRODUCTOS_SERVICE_URL` -> `http://127.0.0.1:8005`

Rutas del gateway:
- `GET /`
- `GET /health`
- `ANY /api/{service}`
- `ANY /api/{service}/{path:path}`

Metodos soportados en proxy:
- `GET, POST, PUT, PATCH, DELETE, OPTIONS, HEAD`

## 6) CORS y seguridad (backend)

### CORS
- Todos los `main.py` analizados importan `CORSMiddleware`.
- En los microservicios de negocio se encontro `allow_origins=['*']`.
- En gateway se controla por:
  - `ALLOWED_ORIGINS`
  - `ALLOWED_ORIGIN_REGEX`

### JWT
- JWT activo en:
  - `clientes-service`
  - `pedidos-service`
  - `productos-service`
  - `repartidores-service`
  - `vendedores-service`
- Variables comunes:
  - `JWT_SECRET_KEY`
  - `JWT_ALGORITHM` (HS256)
- Login principal detectado en:
  - `POST /auth/login` (clientes-service)

### Hash de passwords
- En `clientes-service` se usa `passlib.hash.pbkdf2_sha256`.
- Configurable con `PASSWORD_HASH_ROUNDS`.

## 7) Endpoints por microservicio (detallado)

Nota: abajo se listan rutas internas del servicio. Via gateway se consumen como:
- `https://tu-dominio/api/clientes/...`
- `https://tu-dominio/api/pedidos/...`
- `https://tu-dominio/api/repartidores/...`
- `https://tu-dominio/api/vendedores/...`
- `https://tu-dominio/api/productos/...`

### 7.1 clientes-service (56 endpoints)

- `GET /`
- `GET /health`
- `POST /clientes`
- `GET /clientes`
- `GET /clientes/{cliente_id}`
- `GET /usuarios-app`
- `GET /usuarios-app/demo`
- `GET /usuarios-app/{usuario_id}`
- `POST /auth/login`
- `POST /auth/register`
- `GET /auth/me`
- `GET /categorias`
- `POST /categorias`
- `PUT /categorias/{categoria_id}/status`
- `DELETE /categorias/{categoria_id}`
- `GET /productos`
- `GET /productos/{producto_id}`
- `POST /productos`
- `PUT /productos/{producto_id}`
- `DELETE /productos/{producto_id}`
- `POST /productos/{producto_id}/feature`
- `POST /internal/products/consume-stock`
- `POST /internal/products/release-stock`
- `GET /cart`
- `POST /cart/items`
- `PUT /cart/items/{product_id}`
- `DELETE /cart/items/{product_id}`
- `DELETE /cart`
- `GET /seller/carts/active`
- `GET /favorites`
- `POST /favorites/{product_id}`
- `DELETE /favorites/{product_id}`
- `GET /reviews/eligibility`
- `POST /reviews`
- `DELETE /reviews/{review_id}`
- `GET /reviews/{review_id}/context`
- `POST /reports`
- `GET /reports`
- `GET /reports/my`
- `PUT /reports/{report_id}`
- `GET /seller/profile`
- `PUT /seller/profile`
- `GET /seller/metrics`
- `GET /sellers`
- `GET /sellers/{seller_id}`
- `PUT /admin/products/{product_id}/status`
- `DELETE /admin/products/{product_id}`
- `PUT /admin/products/{product_id}/verify-local`
- `PUT /admin/products/{product_id}/feature`
- `PUT /admin/sellers/{seller_id}/status`
- `PUT /admin/users/{user_id}/status`
- `DELETE /admin/users/{user_id}`
- `GET /admin/stats`
- `GET /admin/users`
- `POST /subscription`
- `POST /uploads/images`

Observacion importante:
- `POST /uploads/images` convierte imagenes a `data:image/...;base64,...` (no guarda archivo fisico en disco de forma directa).

### 7.2 pedidos-service (7 endpoints)

- `GET /`
- `GET /health`
- `POST /pedidos`
- `PUT /pedidos/{pedido_uid}/estado`
- `GET /pedidos`
- `GET /pedidos/{pedido_uid}`
- `GET /pickup-stores`

Integracion interna detectada:
- consume stock via clientes-service (`/internal/products/consume-stock`)
- libera stock via clientes-service (`/internal/products/release-stock`)

### 7.3 productos-service (10 endpoints)

- `GET /`
- `GET /health`
- `GET /categorias`
- `POST /categorias`
- `GET /productos`
- `GET /productos/{producto_id}`
- `POST /productos`
- `PUT /productos/{producto_id}`
- `DELETE /productos/{producto_id}`
- `PUT /productos/{producto_id}/stock`

### 7.4 repartidores-service (8 endpoints)

- `GET /`
- `GET /health`
- `GET /repartidores`
- `GET /repartidores/demo`
- `GET /repartidores/{repartidor_id}`
- `POST /repartidores`
- `PUT /repartidores/{repartidor_id}/estado`
- `PUT /repartidores/{repartidor_id}/ubicacion`

### 7.5 vendedores-service (7 endpoints)

- `GET /`
- `GET /health`
- `GET /vendedores`
- `GET /vendedores/{vendedor_id}`
- `POST /vendedores`
- `PUT /vendedores/{vendedor_id}/perfil`
- `PUT /vendedores/{vendedor_id}/metrics`

## 8) Variables de entorno detectadas (AWS deploy)

Archivo: `backend-micro/deploy/aws/.env.*`

- Gateway:
  - `CLIENTES_SERVICE_URL`
  - `PEDIDOS_SERVICE_URL`
  - `REPARTIDORES_SERVICE_URL`
  - `VENDEDORES_SERVICE_URL`
  - `PRODUCTOS_SERVICE_URL`
  - `HTTP_TIMEOUT_SECONDS`
  - `ALLOWED_ORIGINS`
  - `ALLOWED_ORIGIN_REGEX`

- Clientes:
  - `POSTGRES_*`
  - `JWT_SECRET_KEY`, `JWT_ALGORITHM`, `JWT_EXPIRE_MINUTES`
  - `PASSWORD_HASH_ROUNDS`
  - `PEDIDOS_SERVICE_URL`
  - `ALLOWED_ORIGINS`
  - `ENABLE_RABBIT`

- Pedidos:
  - `POSTGRES_*`
  - `CLIENTES_SERVICE_URL`
  - `JWT_SECRET_KEY`, `JWT_ALGORITHM`
  - `ALLOWED_ORIGINS`
  - `ENABLE_RABBIT`

- Productos / Repartidores / Vendedores:
  - `POSTGRES_*`
  - `JWT_SECRET_KEY`, `JWT_ALGORITHM`
  - `ALLOWED_ORIGINS`

## 9) Frontend (resumen breve)

### 9.1 frontend-react

- Stack: React + Vite + React Router + Tailwind + Leaflet
- Scripts:
  - `npm run dev`
  - `npm run build`
  - `npm run preview`
- Variables API detectadas:
  - `VITE_API_URL`
  - `VITE_CLIENTES_API_URL`
  - `VITE_PEDIDOS_API_URL`
  - `VITE_LOCATIONIQ_API_KEY`
  - `VITE_GOOGLE_MAPS_API_KEY`
  - `VITE_APP_URL` (landing -> app)

### 9.2 frontend-native

- Stack: Expo + React Native + React Navigation + AsyncStorage + react-native-maps
- Scripts:
  - `npm run start`
  - `npm run qr`
  - `npm run android`
- Variables API detectadas:
  - `EXPO_PUBLIC_CLIENTES_API_URL`
  - `EXPO_PUBLIC_PEDIDOS_API_URL`
  - `EXPO_PUBLIC_LOCATIONIQ_API_KEY`

## 10) Conclusiones tecnicas

- Tu backend **si esta dividido en 5 microservicios + gateway**.
- **Si esta dockerizado** (modo local y modo AWS).
- **Si tiene endpoints amplios** para auth, catalogo, carrito, pedidos, admin, reportes, reseñas y seguimiento.
- Para produccion, la forma limpia es exponer solo gateway (`8010`) detras de Nginx (`80/443`) y consumir desde los frontends por dominio HTTPS.

---

Si quieres, en el siguiente paso te genero una segunda version de este reporte en formato "entregable de uni" (mas formal, con tabla por endpoint incluyendo tipo de auth: publico/JWT/rol), usando este mismo inventario.
