import os
from datetime import datetime
from uuid import uuid4

from fastapi import Depends, FastAPI, HTTPException, Query, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import JWTError, jwt
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from infraestructura.adapters.db import Categoria, Producto, get_session, init_db


app = FastAPI(title='Microservicio Productos MercadoLocal', version='1.0.0')
security_scheme = HTTPBearer(auto_error=False)
JWT_SECRET_KEY = os.getenv('JWT_SECRET_KEY', '').strip()
JWT_ALGORITHM = os.getenv('JWT_ALGORITHM', 'HS256').strip()

raw_origins = os.getenv('ALLOWED_ORIGINS', '*').strip()
allow_all_origins = raw_origins == '*' or raw_origins == ''
allowed_origins = ['*'] if allow_all_origins else [item.strip() for item in raw_origins.split(',') if item.strip()]

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=not allow_all_origins,
    allow_methods=['*'],
    allow_headers=['*'],
)


class CategoriaIn(BaseModel):
    name: str = Field(min_length=2, max_length=120)
    description: str | None = Field(default='')


class ProductoIn(BaseModel):
    seller_id: str = Field(min_length=2, max_length=60)
    seller_name: str = Field(min_length=2, max_length=120)
    name: str = Field(min_length=2, max_length=180)
    category: str = Field(min_length=2, max_length=60)
    category_label: str = Field(min_length=2, max_length=80)
    price: float = Field(gt=0)
    stock: int = Field(ge=0)
    description: str = Field(min_length=4)
    featured: bool = False
    local: bool = True
    verified: bool = True
    rating: float = 5
    views: int = 0
    image_key: str | None = None
    image_data: str | None = None


class ProductoUpdate(BaseModel):
    seller_name: str | None = None
    name: str | None = None
    category: str | None = None
    category_label: str | None = None
    price: float | None = None
    stock: int | None = None
    description: str | None = None
    featured: bool | None = None
    local: bool | None = None
    verified: bool | None = None
    rating: float | None = None
    views: int | None = None
    image_key: str | None = None
    image_data: str | None = None


def normalize_role(value: str) -> str:
    safe = str(value or '').strip().lower()
    aliases = {
        'buyer': 'buyer',
        'comprador': 'buyer',
        'seller': 'seller',
        'vendedor': 'seller',
        'courier': 'courier',
        'repartidor': 'courier',
        'admin': 'admin',
    }
    return aliases.get(safe, '')


def ensure_jwt_configured() -> None:
    if not JWT_SECRET_KEY:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail='JWT no configurado en servidor (JWT_SECRET_KEY).',
        )


def decode_jwt_claims(credentials: HTTPAuthorizationCredentials | None = Depends(security_scheme)) -> dict:
    if not credentials or credentials.scheme.lower() != 'bearer':
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail='Token requerido')
    ensure_jwt_configured()
    try:
        payload = jwt.decode(credentials.credentials or '', JWT_SECRET_KEY, algorithms=[JWT_ALGORITHM])
    except JWTError:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail='Token invalido') from None

    user_id = str(payload.get('sub') or '').strip()
    role = normalize_role(payload.get('role') or '')
    if not user_id or role not in {'buyer', 'seller', 'courier', 'admin'}:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail='Token invalido')
    return {'sub': user_id, 'role': role, 'email': str(payload.get('email') or '').strip().lower()}


def require_roles(*roles: str):
    allowed = {normalize_role(role) for role in roles if normalize_role(role)}

    def _guard(claims: dict = Depends(decode_jwt_claims)) -> dict:
        role = str(claims.get('role') or '')
        if role not in allowed:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail='No autorizado para esta ruta')
        return claims

    return _guard


def ensure_seller_or_admin_scope(target_seller_id: str, claims: dict) -> None:
    role = str(claims.get('role') or '')
    requester_id = str(claims.get('sub') or '')
    if role == 'admin':
        return
    if role != 'seller' or requester_id != str(target_seller_id or '').strip():
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail='No autorizado para este vendedor')


def slugify(value: str) -> str:
    safe = ''.join(ch.lower() if ch.isalnum() else '-' for ch in str(value or '').strip())
    while '--' in safe:
        safe = safe.replace('--', '-')
    safe = safe.strip('-')
    return safe or f'categoria-{uuid4().hex[:6]}'


def serialize_categoria(item: Categoria) -> dict:
    return {
        'id': item.categoria_id,
        'name': item.nombre,
        'description': item.descripcion or '',
        'status': item.status,
        'created_at': item.created_at.isoformat() if item.created_at else '',
    }


def serialize_producto(item: Producto) -> dict:
    return {
        'id': item.producto_id,
        'sellerId': item.seller_id,
        'sellerName': item.seller_name,
        'name': item.nombre,
        'category': item.categoria,
        'categoryLabel': item.categoria_label,
        'price': item.precio,
        'stock': item.stock,
        'description': item.descripcion,
        'featured': item.featured,
        'local': item.local,
        'verified': item.verified,
        'rating': item.rating,
        'views': item.views,
        'imageKey': item.image_key,
        'imageData': item.image_data,
        'createdAt': item.created_at.isoformat() if item.created_at else '',
        'updatedAt': item.updated_at.isoformat() if item.updated_at else '',
    }


@app.on_event('startup')
def on_startup():
    init_db()


@app.get('/')
def root():
    return {'service': 'productos', 'status': 'ok', 'port': 8005}


@app.get('/health')
def health():
    return {'ok': True, 'service': 'productos'}


@app.get('/categorias')
def listar_categorias(db: Session = Depends(get_session)):
    rows = db.query(Categoria).order_by(Categoria.created_at.asc()).all()
    return {'status': 'ok', 'categories': [serialize_categoria(row) for row in rows]}


@app.post('/categorias', status_code=status.HTTP_201_CREATED)
def crear_categoria(
    payload: CategoriaIn,
    db: Session = Depends(get_session),
    _claims: dict = Depends(require_roles('seller', 'admin')),
):
    cid = slugify(payload.name)
    exists = db.get(Categoria, cid)
    if exists:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail='La categoria ya existe')
    row = Categoria(categoria_id=cid, nombre=payload.name.strip(), descripcion=(payload.description or '').strip(), status='pending', created_at=datetime.utcnow())
    db.add(row)
    db.commit()
    db.refresh(row)
    return {'status': 'ok', 'category': serialize_categoria(row)}


@app.get('/productos')
def listar_productos(
    seller_id: str | None = Query(default=None),
    category: str | None = Query(default=None),
    db: Session = Depends(get_session),
):
    query = db.query(Producto)
    if seller_id:
        query = query.filter(Producto.seller_id == seller_id)
    if category:
        query = query.filter(Producto.categoria == category)
    rows = query.order_by(Producto.created_at.desc()).all()
    return {'status': 'ok', 'products': [serialize_producto(row) for row in rows]}


@app.get('/productos/{producto_id}')
def obtener_producto(producto_id: str, db: Session = Depends(get_session)):
    row = db.get(Producto, producto_id)
    if not row:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail='Producto no encontrado')
    return {'status': 'ok', 'product': serialize_producto(row)}


@app.post('/productos', status_code=status.HTTP_201_CREATED)
def crear_producto(
    payload: ProductoIn,
    db: Session = Depends(get_session),
    claims: dict = Depends(require_roles('seller', 'admin')),
):
    ensure_seller_or_admin_scope(payload.seller_id, claims)
    row = Producto(
        producto_id=f"p-{uuid4().hex[:10]}",
        seller_id=payload.seller_id,
        seller_name=payload.seller_name,
        nombre=payload.name,
        categoria=payload.category,
        categoria_label=payload.category_label,
        precio=payload.price,
        stock=payload.stock,
        descripcion=payload.description,
        featured=payload.featured,
        local=payload.local,
        verified=payload.verified,
        rating=payload.rating,
        views=payload.views,
        image_key=payload.image_key,
        image_data=payload.image_data,
        created_at=datetime.utcnow(),
        updated_at=datetime.utcnow(),
    )
    db.add(row)
    db.commit()
    db.refresh(row)
    return {'status': 'ok', 'product': serialize_producto(row)}


@app.put('/productos/{producto_id}')
def actualizar_producto(
    producto_id: str,
    payload: ProductoUpdate,
    db: Session = Depends(get_session),
    claims: dict = Depends(require_roles('seller', 'admin')),
):
    row = db.get(Producto, producto_id)
    if not row:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail='Producto no encontrado')
    ensure_seller_or_admin_scope(row.seller_id, claims)

    data = payload.model_dump(exclude_unset=True)
    field_map = {
        'seller_name': 'seller_name',
        'name': 'nombre',
        'category': 'categoria',
        'category_label': 'categoria_label',
        'price': 'precio',
        'stock': 'stock',
        'description': 'descripcion',
        'featured': 'featured',
        'local': 'local',
        'verified': 'verified',
        'rating': 'rating',
        'views': 'views',
        'image_key': 'image_key',
        'image_data': 'image_data',
    }
    for key, value in data.items():
        setattr(row, field_map[key], value)
    row.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(row)
    return {'status': 'ok', 'product': serialize_producto(row)}


@app.delete('/productos/{producto_id}')
def eliminar_producto(
    producto_id: str,
    db: Session = Depends(get_session),
    claims: dict = Depends(require_roles('seller', 'admin')),
):
    row = db.get(Producto, producto_id)
    if not row:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail='Producto no encontrado')
    ensure_seller_or_admin_scope(row.seller_id, claims)
    db.delete(row)
    db.commit()
    return {'status': 'ok', 'deleted': True, 'product_id': producto_id}


@app.put('/productos/{producto_id}/stock')
def actualizar_stock(
    producto_id: str,
    stock: int = Query(...),
    db: Session = Depends(get_session),
    claims: dict = Depends(require_roles('seller', 'admin')),
):
    row = db.get(Producto, producto_id)
    if not row:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail='Producto no encontrado')
    ensure_seller_or_admin_scope(row.seller_id, claims)
    row.stock = max(0, int(stock))
    row.updated_at = datetime.utcnow()
    db.commit()
    return {'status': 'ok', 'product': serialize_producto(row)}


