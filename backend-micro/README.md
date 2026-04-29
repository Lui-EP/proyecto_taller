# Backend Microservicios (FastAPI + PostgreSQL)

Este backend es el que usa el proyecto actualmente.
Incluye dos microservicios:

- `clientes-service` (usuarios, auth, productos, carrito, favoritos, panel vendedor/admin)
- `pedidos-service` (pedidos, estados, seguimiento de reparto)

## 1) Requisitos

- Python 3.11+ (recomendado 3.12)
- PostgreSQL accesible en `127.0.0.1:5433` (Docker o instalacion local)
- WSL (opcional, recomendado si trabajas como en este proyecto)

## 2) Bases de datos que usa

- `bd_proyclientes`
- `bd_proypedidos`

Scripts SQL incluidos:

- `backend-micro/sql/crear_bd_clientes.sql`
- `backend-micro/sql/crear_bd_pedidos.sql`
- `backend-micro/sql/crear_bd.sql` (crea ambas)

Ejemplo minimo en SQL Workbench / psql:

```sql
CREATE DATABASE bd_proyclientes;
CREATE DATABASE bd_proypedidos;
```

## 3) Instalacion (un solo entorno virtual para ambos)

Desde WSL:

```bash
cd /mnt/c/Users/luisa/OneDrive/Documents/proyecto_interfaz/backend-micro
python3 -m venv .venv
source .venv/bin/activate
pip install --upgrade pip
pip install -r requirements.txt
```

## 4) Configurar variables de entorno

```bash
cp clientes-service/.env.example clientes-service/.env
cp pedidos-service/.env.example pedidos-service/.env
```

Valores esperados por defecto:

`clientes-service/.env`

```env
POSTGRES_HOST=127.0.0.1
POSTGRES_PORT=5433
POSTGRES_DB=bd_proyclientes
POSTGRES_USER=postgres
POSTGRES_PASSWORD=TU_PASSWORD
ENABLE_RABBIT=false
```

`pedidos-service/.env`

```env
POSTGRES_HOST=127.0.0.1
POSTGRES_PORT=5433
POSTGRES_DB=bd_proypedidos
POSTGRES_USER=postgres
POSTGRES_PASSWORD=TU_PASSWORD
ENABLE_RABBIT=false
CLIENTES_SERVICE_URL=http://localhost:8001
```

## 5) Levantar microservicios

Usa dos terminales (con la misma `.venv` activada).

Terminal 1:

```bash
cd /mnt/c/Users/luisa/OneDrive/Documents/proyecto_interfaz/backend-micro
source .venv/bin/activate
cd clientes-service
uvicorn infraestructura.api.main:app --host 0.0.0.0 --port 8001 --reload
```

Terminal 2:

```bash
cd /mnt/c/Users/luisa/OneDrive/Documents/proyecto_interfaz/backend-micro
source .venv/bin/activate
cd pedidos-service
uvicorn infraestructura.api.main:app --host 0.0.0.0 --port 8002 --reload
```

## 6) Verificacion rapida

En tu laptop:

- `http://localhost:8001/health`
- `http://localhost:8002/health`
- `http://localhost:8001/docs`
- `http://localhost:8002/docs`

En celular (misma red Wi-Fi):

- `http://TU_IP_LOCAL:8001/health`
- `http://TU_IP_LOCAL:8002/health`

Si usas WSL y no responde desde celular, ejecuta en PowerShell (admin):

```powershell
cd C:\Users\luisa\OneDrive\Documents\proyecto_interfaz\backend-micro
.\scripts\exponer-backend-wsl.ps1
```

## 7) Endpoints principales

`clientes-service` (`:8001`)

- `POST /auth/login`
- `GET /usuarios-app/demo`
- `GET /productos`
- `POST /productos`
- `PUT /productos/{producto_id}`
- `GET /cart`
- `GET /seller/carts/active`
- `GET /admin/stats`
- `GET /admin/users`

`pedidos-service` (`:8002`)

- `GET /pedidos`
- `GET /pedidos/{pedido_uid}`
- `POST /pedidos`
- `PUT /pedidos/{pedido_uid}/estado`

## 8) Credenciales demo

- `admin@mercadolocal.mx` / `123456`
- `vendedor@mercadolocal.mx` / `123456`
- `cliente@mercadolocal.mx` / `123456`
- `repartidor@mercadolocal.mx` / `123456`

## 9) Problemas comunes

1. `connection refused 127.0.0.1:5433`
- PostgreSQL no esta corriendo o el puerto no coincide.

2. Puerto `8001` o `8002` en uso
- Cierra el proceso anterior o cambia puerto en comando uvicorn.

3. Celular no puede abrir `TU_IP_LOCAL:8001/health`
- Falta exponer WSL (`exponer-backend-wsl.ps1`) o firewall bloqueando.
