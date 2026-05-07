# Backend Microservicios (5 servicios)

Ahora el backend esta separado en **5 microservicios** y cada uno usa su **propia base de datos**:

1. `clientes-service` -> `bd_clientes_ms` (puerto `8001`)
2. `pedidos-service` -> `bd_pedidos_ms` (puerto `8002`)
3. `repartidores-service` -> `bd_repartidores_ms` (puerto `8003`)
4. `vendedores-service` -> `bd_vendedores_ms` (puerto `8004`)
5. `productos-service` -> `bd_productos_ms` (puerto `8005`)

## 1) Requisitos

- Python 3.11+
- PostgreSQL en `127.0.0.1:5433`
- (Opcional) WSL

## 2) Crear bases de datos

En SQL Workbench o psql ejecuta:

```sql
\i backend-micro/sql/crear_bd.sql
```

O copia y pega:

```sql
CREATE DATABASE bd_clientes_ms;
CREATE DATABASE bd_pedidos_ms;
CREATE DATABASE bd_repartidores_ms;
CREATE DATABASE bd_vendedores_ms;
CREATE DATABASE bd_productos_ms;
```

## 3) Un solo entorno virtual para todo

```bash
cd /mnt/c/Users/luisa/OneDrive/Documents/proyecto_interfaz/backend-micro
python3 -m venv .venv
source .venv/bin/activate
pip install --upgrade pip
pip install -r requirements.txt
```

## 4) Variables `.env`

```bash
cp clientes-service/.env.example clientes-service/.env
cp pedidos-service/.env.example pedidos-service/.env
cp repartidores-service/.env.example repartidores-service/.env
cp vendedores-service/.env.example vendedores-service/.env
cp productos-service/.env.example productos-service/.env
```

Todas apuntan por defecto a:

- `POSTGRES_HOST=127.0.0.1`
- `POSTGRES_PORT=5433`
- `POSTGRES_USER=postgres`
- `POSTGRES_PASSWORD=pERSONAL04`
- `POSTGRES_SSLMODE=disable`
- `ALLOWED_ORIGINS=*`

Para AWS RDS y frontend en Vercel:

- `POSTGRES_SSLMODE=require`
- `ALLOWED_ORIGINS=https://tu-web.vercel.app,https://tu-dominio.com`

## 5) Levantar microservicios

Abre 5 terminales (misma `.venv` activa):

### clientes-service

```bash
cd /mnt/c/Users/luisa/OneDrive/Documents/proyecto_interfaz/backend-micro/clientes-service
source ../.venv/bin/activate
uvicorn infraestructura.api.main:app --host 0.0.0.0 --port 8001 --reload
```

### pedidos-service

```bash
cd /mnt/c/Users/luisa/OneDrive/Documents/proyecto_interfaz/backend-micro/pedidos-service
source ../.venv/bin/activate
uvicorn infraestructura.api.main:app --host 0.0.0.0 --port 8002 --reload
```

### repartidores-service

```bash
cd /mnt/c/Users/luisa/OneDrive/Documents/proyecto_interfaz/backend-micro/repartidores-service
source ../.venv/bin/activate
uvicorn infraestructura.api.main:app --host 0.0.0.0 --port 8003 --reload
```

### vendedores-service

```bash
cd /mnt/c/Users/luisa/OneDrive/Documents/proyecto_interfaz/backend-micro/vendedores-service
source ../.venv/bin/activate
uvicorn infraestructura.api.main:app --host 0.0.0.0 --port 8004 --reload
```

### productos-service

```bash
cd /mnt/c/Users/luisa/OneDrive/Documents/proyecto_interfaz/backend-micro/productos-service
source ../.venv/bin/activate
uvicorn infraestructura.api.main:app --host 0.0.0.0 --port 8005 --reload
```

## 6) Health checks

- `http://localhost:8001/health`
- `http://localhost:8002/health`
- `http://localhost:8003/health`
- `http://localhost:8004/health`
- `http://localhost:8005/health`

## 7) Endpoints principales por servicio

### clientes-service (`8001`)

- `POST /auth/login`
- `GET /usuarios-app/demo`
- `GET /clientes`

### pedidos-service (`8002`)

- `POST /pedidos`
- `GET /pedidos`
- `PUT /pedidos/{pedido_uid}/estado`

### repartidores-service (`8003`)

- `GET /repartidores`
- `POST /repartidores`
- `PUT /repartidores/{id}/estado`
- `PUT /repartidores/{id}/ubicacion`

### vendedores-service (`8004`)

- `GET /vendedores`
- `POST /vendedores`
- `PUT /vendedores/{id}/perfil`

### productos-service (`8005`)

- `GET /categorias`
- `POST /categorias`
- `GET /productos`
- `POST /productos`
- `PUT /productos/{id}`
- `PUT /productos/{id}/stock`

## 8) Cuentas demo

- `admin@mercadolocal.mx` / `123456`
- `vendedor@mercadolocal.mx` / `123456`
- `cliente@mercadolocal.mx` / `123456`
- `repartidor@mercadolocal.mx` / `123456`

## 9) Despliegue en 2 instancias (AWS)

Se agregaron 2 archivos compose en `backend-micro/deploy/aws`:

- `docker-compose.instance-a.yml` (Acceso)
  - `frontend-react` (Nginx puerto `80`)
  - `api-gateway` (interno en `8010`, sin exponer publico)
  - `clientes-service` (puerto `8001`)
- `docker-compose.instance-b.yml` (Backend)
  - `postgres-micro` (puerto `5433`)
  - `productos-service` (`8005`)
  - `pedidos-service` (`8002`)
  - `repartidores-service` (`8003`)
  - `vendedores-service` (`8004`)

Variables de referencia:

```bash
cd /mnt/c/Users/luisa/OneDrive/Documents/proyecto_interfaz/backend-micro/deploy/aws
cp instances.env.example instances.env
```

### Levantar Instancia B

```bash
docker compose --env-file instances.env -f docker-compose.instance-b.yml up -d --build
```

### Levantar Instancia A

```bash
docker compose --env-file instances.env -f docker-compose.instance-a.yml up -d --build
```

Nota de arquitectura: estos compose no alteran la arquitectura hexagonal.  
Cada microservicio conserva separación de:

- `dominio` (lógica de negocio)
- `aplicacion` (casos de uso)
- `infraestructura/adapters` (FastAPI, SQLAlchemy, HTTP externo)

Con esta separación, el frontend consume:

- `http://<IP_INSTANCIA_A>/` (web)
- `http://<IP_INSTANCIA_A>/api/...` (proxy Nginx -> api-gateway -> microservicios)
