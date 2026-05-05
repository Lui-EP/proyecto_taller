import base64
import os
from datetime import datetime, timedelta, timezone
from uuid import uuid4

from fastapi import Depends, FastAPI, File, Form, HTTPException, Query, UploadFile, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import JWTError, jwt
from passlib.hash import pbkdf2_sha256
from pydantic import BaseModel, EmailStr, Field
from sqlalchemy.orm import Session

from application.use_cases.registrar_cliente import registrar_cliente
from infraestructura.adapters.db import (
    CarritoItem,
    Categoria,
    Cliente,
    Favorito,
    Producto,
    Reporte,
    Resena,
    SessionLocal,
    SellerProfile,
    UsuarioApp,
    get_session,
    init_db,
)


app = FastAPI(title='Microservicio Clientes MercadoLocal', version='2.0.0')
security_scheme = HTTPBearer(auto_error=False)
JWT_SECRET_KEY = os.getenv('JWT_SECRET_KEY', '').strip()
JWT_ALGORITHM = os.getenv('JWT_ALGORITHM', 'HS256').strip()
JWT_EXPIRE_MINUTES = int(os.getenv('JWT_EXPIRE_MINUTES', '120'))
PASSWORD_HASH_ROUNDS = int(os.getenv('PASSWORD_HASH_ROUNDS', '29000'))

app.add_middleware(
    CORSMiddleware,
    allow_origins=['*'],
    allow_credentials=True,
    allow_methods=['*'],
    allow_headers=['*'],
)


class ClienteIn(BaseModel):
    nombre: str = Field(min_length=2, max_length=120)
    email: EmailStr
    telefono: str | None = Field(default=None, max_length=40)
    direccion: str | None = Field(default=None, max_length=255)


class LoginIn(BaseModel):
    email: EmailStr
    password: str = Field(min_length=4, max_length=120)


class RegisterIn(BaseModel):
    email: EmailStr
    password: str = Field(min_length=4, max_length=120)
    name: str = Field(min_length=2, max_length=120)
    role: str = Field(min_length=4, max_length=40)
    phone: str | None = Field(default=None, max_length=40)
    location: str | None = Field(default=None, max_length=255)
    curp: str | None = Field(default=None, max_length=40)


class ProductoIn(BaseModel):
    seller_id: str = Field(min_length=2, max_length=40)
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
    image_key: str | None = Field(default=None, max_length=80)
    image_data: str | None = None


class ProductoUpdate(BaseModel):
    seller_name: str | None = Field(default=None, min_length=2, max_length=120)
    name: str | None = Field(default=None, min_length=2, max_length=180)
    category: str | None = Field(default=None, min_length=2, max_length=60)
    category_label: str | None = Field(default=None, min_length=2, max_length=80)
    price: float | None = Field(default=None, gt=0)
    stock: int | None = Field(default=None, ge=0)
    description: str | None = Field(default=None, min_length=4)
    featured: bool | None = None
    local: bool | None = None
    verified: bool | None = None
    rating: float | None = None
    views: int | None = None
    image_key: str | None = Field(default=None, max_length=80)
    image_data: str | None = None


class CategoriaIn(BaseModel):
    name: str = Field(min_length=2, max_length=120)
    description: str | None = Field(default='', max_length=500)


class ReviewIn(BaseModel):
    user_id: str = Field(min_length=2, max_length=60)
    product_id: str = Field(min_length=2, max_length=60)
    rating: int = Field(ge=1, le=5)
    comment: str | None = Field(default='')


class ReportIn(BaseModel):
    reporter_id: str = Field(min_length=2, max_length=60)
    target_type: str = Field(min_length=3, max_length=40)
    target_id: str = Field(min_length=2, max_length=60)
    reason: str = Field(min_length=2, max_length=40)
    description: str | None = Field(default='')


class SellerProfileIn(BaseModel):
    business_name: str = Field(min_length=2, max_length=160)
    description: str | None = Field(default='')
    schedule: str | None = Field(default='')
    location: str | None = Field(default='')
    phone: str | None = Field(default='')
    curp: str | None = Field(default='')


class TokenUser(BaseModel):
    id: str
    role: str
    email: str


ROLE_ID_PREFIX = {
    'buyer': 'comprador',
    'seller': 'vendedor',
    'courier': 'repartidor',
    'admin': 'admin',
}


def normalize_role(value: str) -> str:
    role = str(value or '').strip().lower()
    if role in {'buyer', 'seller', 'courier', 'admin'}:
        return role
    return 'buyer'


def role_id_prefix(role: str) -> str:
    return ROLE_ID_PREFIX.get(normalize_role(role), 'comprador')


def ensure_jwt_configured() -> None:
    if not JWT_SECRET_KEY:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail='JWT no configurado en servidor (JWT_SECRET_KEY).',
        )


def is_password_hashed(value: str) -> bool:
    safe = str(value or '').strip()
    return safe.startswith('$pbkdf2-sha256$')


def hash_password(plain_password: str) -> str:
    return pbkdf2_sha256.using(rounds=PASSWORD_HASH_ROUNDS).hash(str(plain_password or ''))


def verify_password(plain_password: str, hashed_password: str) -> bool:
    safe_hash = str(hashed_password or '').strip()
    if not safe_hash:
        return False
    if safe_hash.startswith('$pbkdf2-sha256$'):
        return pbkdf2_sha256.verify(str(plain_password or ''), safe_hash)
    return str(plain_password or '') == safe_hash


def migrate_plaintext_passwords(db: Session) -> int:
    users = db.query(UsuarioApp).all()
    updated = 0
    for user in users:
        if not is_password_hashed(user.password):
            user.password = hash_password(user.password)
            updated += 1
    if updated:
        db.commit()
    return updated


def migrate_user_id_prefixes(db: Session) -> int:
    users = db.query(UsuarioApp).all()
    updated = 0
    for user in users:
        old_id = str(user.usuario_id or '').strip()
        role = normalize_role(user.role)
        prefix = role_id_prefix(role)
        if not old_id:
            continue
        if '-' not in old_id:
            continue
        current_prefix, suffix = old_id.split('-', 1)
        old_prefixes = {'buyer', 'seller', 'courier'}
        if current_prefix not in old_prefixes:
            continue
        new_id = f'{prefix}-{suffix}'
        if new_id == old_id:
            continue
        if db.get(UsuarioApp, new_id):
            continue

        if role == 'seller':
            db.query(Producto).filter(Producto.seller_id == old_id).update({'seller_id': new_id})
            profile = db.get(SellerProfile, old_id)
            if profile:
                profile.seller_id = new_id

        db.query(CarritoItem).filter(CarritoItem.owner_id == old_id).update({'owner_id': new_id})
        db.query(Favorito).filter(Favorito.user_id == old_id).update({'user_id': new_id})
        db.query(Resena).filter(Resena.user_id == old_id).update({'user_id': new_id})
        db.query(Reporte).filter(Reporte.reporter_id == old_id).update({'reporter_id': new_id})
        user.usuario_id = new_id
        updated += 1

    if updated:
        db.commit()
    return updated


def issue_access_token(usuario: UsuarioApp) -> str:
    ensure_jwt_configured()
    now = datetime.now(timezone.utc)
    payload = {
        'sub': usuario.usuario_id,
        'role': normalize_role(usuario.role),
        'email': usuario.email,
        'iat': int(now.timestamp()),
        'exp': int((now + timedelta(minutes=JWT_EXPIRE_MINUTES)).timestamp()),
    }
    return jwt.encode(payload, JWT_SECRET_KEY, algorithm=JWT_ALGORITHM)


def get_current_user_from_jwt(
    credentials: HTTPAuthorizationCredentials | None = Depends(security_scheme),
    db: Session = Depends(get_session),
) -> UsuarioApp:
    if not credentials or credentials.scheme.lower() != 'bearer':
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail='Token requerido')

    token = credentials.credentials or ''
    ensure_jwt_configured()
    try:
        payload = jwt.decode(token, JWT_SECRET_KEY, algorithms=[JWT_ALGORITHM])
        user_id = str(payload.get('sub') or '').strip()
    except JWTError:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail='Token invalido') from None

    if not user_id:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail='Token invalido')

    usuario = db.get(UsuarioApp, user_id)
    if not usuario or not usuario.activo:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail='Usuario no autorizado')
    return usuario


def require_roles(*roles: str):
    normalized_roles = {normalize_role(role) for role in roles}

    def _guard(usuario: UsuarioApp = Depends(get_current_user_from_jwt)) -> UsuarioApp:
        if normalize_role(usuario.role) not in normalized_roles:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail='No autorizado para esta ruta')
        return usuario

    return _guard


def ensure_seller_or_admin_scope(target_seller_id: str, usuario: UsuarioApp) -> None:
    role = normalize_role(usuario.role)
    if role == 'admin':
        return
    if role != 'seller' or usuario.usuario_id != str(target_seller_id or '').strip():
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail='No autorizado para este vendedor')


def slugify_category(value: str) -> str:
    safe = ''.join(ch.lower() if ch.isalnum() else '-' for ch in str(value or '').strip())
    while '--' in safe:
        safe = safe.replace('--', '-')
    safe = safe.strip('-')
    return safe or f'categoria-{uuid4().hex[:6]}'


def serialize_usuario(usuario: UsuarioApp, include_password: bool = False) -> dict:
    data = {
        'id': usuario.usuario_id,
        'name': usuario.nombre,
        'email': usuario.email,
        'role': usuario.role,
        'phone': usuario.telefono or '',
        'address': usuario.direccion or '',
        'active': usuario.activo,
        'createdAt': usuario.created_at.isoformat() if usuario.created_at else '',
    }
    if include_password:
        data['password'] = usuario.password
    return data


def serialize_profile(profile: SellerProfile | None) -> dict:
    if not profile:
        return {
            'business_name': '',
            'description': '',
            'schedule': '',
            'location': '',
            'phone': '',
            'curp': '',
        }
    return {
        'business_name': profile.business_name or '',
        'description': profile.description or '',
        'schedule': profile.schedule or '',
        'location': profile.location or '',
        'phone': profile.phone or '',
        'curp': profile.curp or '',
    }


def serialize_resena(review: Resena) -> dict:
    return {
        'id': f'r-{review.resena_id}',
        'product_id': review.product_id,
        'user_id': review.user_id,
        'user_name': review.user_name,
        'rating': int(review.rating or 0),
        'comment': review.comment or '',
        'created_at': review.created_at.isoformat() if review.created_at else '',
    }


def serialize_producto(producto: Producto, db: Session) -> dict:
    reviews = db.query(Resena).filter(Resena.product_id == producto.producto_id).order_by(Resena.created_at.desc()).all()
    avg_rating = 0
    if reviews:
        avg_rating = round(sum(int(item.rating or 0) for item in reviews) / len(reviews), 1)

    favorites_count = db.query(Favorito).filter(Favorito.product_id == producto.producto_id).count()
    seller = db.get(UsuarioApp, producto.seller_id)
    profile = db.get(SellerProfile, producto.seller_id)
    seller_product_count = db.query(Producto).filter(Producto.seller_id == producto.seller_id).count()
    seller_reviews_count = 0
    if seller_product_count:
        seller_product_ids = [row.producto_id for row in db.query(Producto).filter(Producto.seller_id == producto.seller_id).all()]
        if seller_product_ids:
            seller_reviews_count = db.query(Resena).filter(Resena.product_id.in_(seller_product_ids)).count()

    return {
        'id': producto.producto_id,
        'sellerId': producto.seller_id,
        'sellerName': producto.seller_name,
        'name': producto.nombre,
        'category': producto.categoria,
        'categoryLabel': producto.categoria_label,
        'price': producto.precio,
        'stock': producto.stock,
        'description': producto.descripcion,
        'status': getattr(producto, 'status', None) or 'approved',
        'featured': producto.featured,
        'local': producto.local,
        'verified': producto.verified,
        'rating': avg_rating or producto.rating,
        'views': producto.views,
        'imageKey': producto.image_key,
        'imageData': producto.image_data,
        'createdAt': producto.created_at.isoformat() if producto.created_at else '',
        'updatedAt': producto.updated_at.isoformat() if producto.updated_at else '',
        'reviews': [serialize_resena(item) for item in reviews],
        'favoritesCount': favorites_count,
        'seller': {
            'id': seller.usuario_id if seller else producto.seller_id,
            'name': seller.nombre if seller else producto.seller_name,
            'status': 'verified' if seller and seller.activo else 'new',
            'seller_profile': serialize_profile(profile),
            'average_rating': avg_rating or producto.rating,
            'total_products': seller_product_count,
            'total_reviews': seller_reviews_count,
        },
    }


@app.on_event('startup')
def on_startup():
    init_db()
    db = SessionLocal()
    try:
        migrate_user_id_prefixes(db)
        migrate_plaintext_passwords(db)
    finally:
        db.close()


@app.get('/')
def root():
    return {'service': 'clientes', 'status': 'ok', 'port': 8001}


@app.get('/health')
def health():
    return {'ok': True, 'service': 'clientes'}


@app.post('/clientes', status_code=status.HTTP_201_CREATED)
def crear_cliente(payload: ClienteIn, db: Session = Depends(get_session)):
    result = registrar_cliente(
        db=db,
        nombre=payload.nombre,
        email=payload.email,
        telefono=payload.telefono,
        direccion=payload.direccion,
    )
    if not result['ok']:
        raise HTTPException(status_code=result['status_code'], detail=result['message'])
    return {'status': 'ok', 'cliente': result['cliente']}


@app.get('/clientes')
def listar_clientes(db: Session = Depends(get_session)):
    clientes = db.query(Cliente).order_by(Cliente.cliente_id.desc()).all()
    return {
        'status': 'ok',
        'clientes': [
            {
                'cliente_id': c.cliente_id,
                'nombre': c.nombre,
                'email': c.email,
                'telefono': c.telefono,
                'direccion': c.direccion,
                'created_at': c.created_at.isoformat() if c.created_at else '',
            }
            for c in clientes
        ],
    }


@app.get('/clientes/{cliente_id}')
def obtener_cliente(cliente_id: int, db: Session = Depends(get_session)):
    cliente = db.get(Cliente, cliente_id)
    if not cliente:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail='Cliente no encontrado')
    return {
        'status': 'ok',
        'cliente': {
            'cliente_id': cliente.cliente_id,
            'nombre': cliente.nombre,
            'email': cliente.email,
            'telefono': cliente.telefono,
            'direccion': cliente.direccion,
            'created_at': cliente.created_at.isoformat() if cliente.created_at else '',
        },
    }


@app.get('/usuarios-app')
def listar_usuarios_app(role: str | None = Query(default=None), db: Session = Depends(get_session)):
    query = db.query(UsuarioApp).filter(UsuarioApp.activo.is_(True))
    if role:
        query = query.filter(UsuarioApp.role == normalize_role(role))
    usuarios = query.order_by(UsuarioApp.nombre.asc()).all()
    return {'status': 'ok', 'users': [serialize_usuario(usuario) for usuario in usuarios]}


@app.get('/usuarios-app/demo')
def listar_usuarios_demo(role: str | None = Query(default=None), db: Session = Depends(get_session)):
    query = db.query(UsuarioApp).filter(UsuarioApp.activo.is_(True))
    if role:
        query = query.filter(UsuarioApp.role == normalize_role(role))
    usuarios = query.order_by(UsuarioApp.nombre.asc()).all()
    return {'status': 'ok', 'users': [serialize_usuario(usuario, include_password=False) for usuario in usuarios]}


@app.get('/usuarios-app/{usuario_id}')
def obtener_usuario_app(usuario_id: str, db: Session = Depends(get_session)):
    usuario = db.get(UsuarioApp, usuario_id)
    if not usuario or not usuario.activo:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail='Usuario no encontrado')
    return {'status': 'ok', 'user': serialize_usuario(usuario)}


@app.post('/auth/login')
def login_app(payload: LoginIn, db: Session = Depends(get_session)):
    usuario = db.query(UsuarioApp).filter(
        UsuarioApp.email == payload.email,
        UsuarioApp.activo.is_(True),
    ).first()
    if not usuario:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail='Credenciales invalidas')
    if not verify_password(payload.password, usuario.password):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail='Credenciales invalidas')
    access_token = issue_access_token(usuario)
    return {
        'status': 'ok',
        'access_token': access_token,
        'token_type': 'bearer',
        'expires_in': JWT_EXPIRE_MINUTES * 60,
        'user': serialize_usuario(usuario),
    }


@app.post('/auth/register')
def register_app(payload: RegisterIn, db: Session = Depends(get_session)):
    existing = db.query(UsuarioApp).filter(UsuarioApp.email == payload.email).first()
    if existing:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail='El correo ya existe')

    role = normalize_role(payload.role)
    user = UsuarioApp(
        usuario_id=f'{role_id_prefix(role)}-{uuid4().hex[:8]}',
        nombre=payload.name.strip(),
        email=payload.email.strip().lower(),
        password=hash_password(payload.password),
        role=role,
        telefono=(payload.phone or '').strip(),
        direccion=(payload.location or '').strip(),
        activo=True,
        created_at=datetime.utcnow(),
    )
    db.add(user)
    db.commit()
    db.refresh(user)

    if role == 'seller':
        profile = SellerProfile(
            seller_id=user.usuario_id,
            business_name=user.nombre,
            description='',
            schedule='',
            location=user.direccion or '',
            phone=user.telefono or '',
            curp=(payload.curp or '').strip(),
            updated_at=datetime.utcnow(),
        )
        db.add(profile)
        db.commit()

    access_token = issue_access_token(user)
    return {
        'status': 'ok',
        'access_token': access_token,
        'token_type': 'bearer',
        'expires_in': JWT_EXPIRE_MINUTES * 60,
        'user': serialize_usuario(user),
    }


@app.get('/auth/me')
def auth_me(usuario: UsuarioApp = Depends(get_current_user_from_jwt)):
    return {'status': 'ok', 'user': serialize_usuario(usuario)}


@app.get('/categorias')
def listar_categorias(db: Session = Depends(get_session)):
    categories = db.query(Categoria).order_by(Categoria.created_at.asc()).all()
    return {
        'status': 'ok',
        'categories': [
            {
                'id': item.categoria_id,
                'name': item.nombre,
                'description': item.descripcion or '',
                'status': item.status,
                'created_at': item.created_at.isoformat() if item.created_at else '',
            }
            for item in categories
        ],
    }


@app.post('/categorias')
def crear_categoria(payload: CategoriaIn, db: Session = Depends(get_session)):
    category_id = slugify_category(payload.name)
    existing = db.get(Categoria, category_id)
    if existing:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail='La categoria ya existe')
    category = Categoria(
        categoria_id=category_id,
        nombre=payload.name.strip(),
        descripcion=(payload.description or '').strip(),
        status='pending',
        created_at=datetime.utcnow(),
    )
    db.add(category)
    db.commit()
    db.refresh(category)
    return {
        'status': 'ok',
        'category': {
            'id': category.categoria_id,
            'name': category.nombre,
            'description': category.descripcion or '',
            'status': category.status,
            'created_at': category.created_at.isoformat() if category.created_at else '',
        },
    }


@app.put('/categorias/{categoria_id}/status')
def actualizar_status_categoria(categoria_id: str, status_value: str = Query(default='approved'), db: Session = Depends(get_session)):
    category = db.get(Categoria, categoria_id)
    if not category:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail='Categoria no encontrada')
    category.status = str(status_value or 'approved').strip().lower()
    db.commit()
    return {'status': 'ok', 'category_id': categoria_id, 'new_status': category.status}


@app.delete('/categorias/{categoria_id}')
def eliminar_categoria(categoria_id: str, db: Session = Depends(get_session)):
    category = db.get(Categoria, categoria_id)
    if not category:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail='Categoria no encontrada')
    
    db.query(Producto).filter(Producto.categoria == categoria_id).update({
        Producto.categoria: 'sin-categoria',
        Producto.categoria_label: 'Sin categoria'
    }, synchronize_session=False)

    db.delete(category)
    db.commit()
    return {'status': 'ok', 'deleted': True}


@app.get('/productos')
def listar_productos(
    seller_id: str | None = Query(default=None),
    status_value: str | None = Query(default=None, alias='status'),
    include_all_status: bool = Query(default=False),
    db: Session = Depends(get_session),
):
    query = db.query(Producto)
    if seller_id:
        query = query.filter(Producto.seller_id == seller_id)
    if status_value:
        query = query.filter(Producto.status == str(status_value).strip().lower())
    elif not include_all_status and not seller_id:
        # Public catalog only shows approved products.
        query = query.filter(Producto.status == 'approved')
    productos = query.order_by(Producto.created_at.desc()).all()
    return {'status': 'ok', 'products': [serialize_producto(producto, db) for producto in productos]}


@app.get('/productos/{producto_id}')
def obtener_producto(producto_id: str, db: Session = Depends(get_session)):
    producto = db.get(Producto, producto_id)
    if not producto:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail='Producto no encontrado')
    return {'status': 'ok', 'product': serialize_producto(producto, db)}


@app.post('/productos', status_code=status.HTTP_201_CREATED)
def crear_producto(
    payload: ProductoIn,
    db: Session = Depends(get_session),
    usuario: UsuarioApp = Depends(require_roles('seller', 'admin')),
):
    ensure_seller_or_admin_scope(payload.seller_id, usuario)
    producto = Producto(
        producto_id=f'pn-{uuid4().hex[:10]}',
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
        status='approved' if usuario.role == 'admin' else 'pending',
        created_at=datetime.utcnow(),
        updated_at=datetime.utcnow(),
    )
    db.add(producto)
    db.commit()
    db.refresh(producto)
    return {'status': 'ok', 'product': serialize_producto(producto, db)}


@app.put('/productos/{producto_id}')
def actualizar_producto(
    producto_id: str,
    payload: ProductoUpdate,
    db: Session = Depends(get_session),
    usuario: UsuarioApp = Depends(require_roles('seller', 'admin')),
):
    producto = db.get(Producto, producto_id)
    if not producto:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail='Producto no encontrado')
    ensure_seller_or_admin_scope(producto.seller_id, usuario)

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
        setattr(producto, field_map[key], value)
    producto.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(producto)
    return {'status': 'ok', 'product': serialize_producto(producto, db)}


@app.delete('/productos/{producto_id}')
def eliminar_producto(
    producto_id: str,
    db: Session = Depends(get_session),
    usuario: UsuarioApp = Depends(require_roles('seller', 'admin')),
):
    producto = db.get(Producto, producto_id)
    if not producto:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail='Producto no encontrado')
    ensure_seller_or_admin_scope(producto.seller_id, usuario)
    db.delete(producto)
    db.commit()
    return {'status': 'ok', 'deleted': True, 'product_id': producto_id}


@app.post('/productos/{producto_id}/feature')
def destacar_producto(
    producto_id: str,
    days: int = Query(default=7),
    db: Session = Depends(get_session),
    usuario: UsuarioApp = Depends(require_roles('seller', 'admin')),
):
    producto = db.get(Producto, producto_id)
    if not producto:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail='Producto no encontrado')
    ensure_seller_or_admin_scope(producto.seller_id, usuario)
    producto.featured = True
    producto.updated_at = datetime.utcnow()
    db.commit()
    return {'status': 'ok', 'product_id': producto_id, 'featured': True, 'days': int(max(1, days))}


@app.get('/cart')
def obtener_carrito(
    owner_id: str | None = Query(default=None),
    db: Session = Depends(get_session),
    usuario: UsuarioApp = Depends(require_roles('buyer', 'seller', 'courier', 'admin')),
):
    resolved_owner_id = str(owner_id or '').strip()
    if normalize_role(usuario.role) != 'admin':
        resolved_owner_id = usuario.usuario_id
    elif not resolved_owner_id:
        resolved_owner_id = usuario.usuario_id

    items = db.query(CarritoItem).filter(CarritoItem.owner_id == resolved_owner_id).order_by(CarritoItem.updated_at.desc()).all()
    return {
        'status': 'ok',
        'owner_id': resolved_owner_id,
        'items': [
            {'product_id': item.product_id, 'quantity': item.quantity, 'updated_at': item.updated_at.isoformat() if item.updated_at else ''}
            for item in items
        ],
        'updated_at': items[0].updated_at.isoformat() if items and items[0].updated_at else '',
    }


@app.post('/cart/items')
def agregar_carrito(
    owner_id: str | None = Query(default=None),
    product_id: str = Query(...),
    quantity: int = Query(default=1),
    db: Session = Depends(get_session),
    usuario: UsuarioApp = Depends(require_roles('buyer', 'seller', 'courier', 'admin')),
):
    resolved_owner_id = str(owner_id or '').strip()
    if normalize_role(usuario.role) != 'admin':
        resolved_owner_id = usuario.usuario_id
    elif not resolved_owner_id:
        resolved_owner_id = usuario.usuario_id

    item = db.query(CarritoItem).filter(CarritoItem.owner_id == resolved_owner_id, CarritoItem.product_id == product_id).first()
    qty = max(1, int(quantity))
    if item:
        item.quantity = qty
        item.updated_at = datetime.utcnow()
    else:
        db.add(CarritoItem(owner_id=resolved_owner_id, product_id=product_id, quantity=qty, updated_at=datetime.utcnow()))
    db.commit()
    return {'status': 'ok'}


@app.put('/cart/items/{product_id}')
def actualizar_carrito(
    product_id: str,
    owner_id: str | None = Query(default=None),
    quantity: int = Query(default=1),
    db: Session = Depends(get_session),
    usuario: UsuarioApp = Depends(require_roles('buyer', 'seller', 'courier', 'admin')),
):
    resolved_owner_id = str(owner_id or '').strip()
    if normalize_role(usuario.role) != 'admin':
        resolved_owner_id = usuario.usuario_id
    elif not resolved_owner_id:
        resolved_owner_id = usuario.usuario_id

    item = db.query(CarritoItem).filter(CarritoItem.owner_id == resolved_owner_id, CarritoItem.product_id == product_id).first()
    if not item:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail='Item no encontrado')
    qty = int(quantity)
    if qty <= 0:
        db.delete(item)
    else:
        item.quantity = qty
        item.updated_at = datetime.utcnow()
    db.commit()
    return {'status': 'ok'}


@app.delete('/cart/items/{product_id}')
def eliminar_item_carrito(
    product_id: str,
    owner_id: str | None = Query(default=None),
    db: Session = Depends(get_session),
    usuario: UsuarioApp = Depends(require_roles('buyer', 'seller', 'courier', 'admin')),
):
    resolved_owner_id = str(owner_id or '').strip()
    if normalize_role(usuario.role) != 'admin':
        resolved_owner_id = usuario.usuario_id
    elif not resolved_owner_id:
        resolved_owner_id = usuario.usuario_id

    item = db.query(CarritoItem).filter(CarritoItem.owner_id == resolved_owner_id, CarritoItem.product_id == product_id).first()
    if item:
        db.delete(item)
        db.commit()
    return {'status': 'ok'}


@app.delete('/cart')
def limpiar_carrito(
    owner_id: str | None = Query(default=None),
    db: Session = Depends(get_session),
    usuario: UsuarioApp = Depends(require_roles('buyer', 'seller', 'courier', 'admin')),
):
    resolved_owner_id = str(owner_id or '').strip()
    if normalize_role(usuario.role) != 'admin':
        resolved_owner_id = usuario.usuario_id
    elif not resolved_owner_id:
        resolved_owner_id = usuario.usuario_id

    db.query(CarritoItem).filter(CarritoItem.owner_id == resolved_owner_id).delete()
    db.commit()
    return {'status': 'ok'}


@app.get('/seller/carts/active')
def carritos_activos_seller(
    seller_id: str = Query(...),
    db: Session = Depends(get_session),
    usuario: UsuarioApp = Depends(require_roles('seller', 'admin')),
):
    ensure_seller_or_admin_scope(seller_id, usuario)
    carts_map: dict[str, dict] = {}
    items = db.query(CarritoItem).order_by(CarritoItem.updated_at.desc()).all()
    for item in items:
        product = db.get(Producto, item.product_id)
        if not product or product.seller_id != seller_id:
            continue
        owner_id = item.owner_id
        if owner_id not in carts_map:
            user = db.get(UsuarioApp, owner_id)
            carts_map[owner_id] = {
                'owner_id': owner_id,
                'owner_name': user.nombre if user else 'Invitado',
                'owner_role': user.role if user else 'guest',
                'updated_at': item.updated_at.isoformat() if item.updated_at else '',
                'items': [],
            }
        carts_map[owner_id]['items'].append({
            'product_id': product.producto_id,
            'name': product.nombre,
            'quantity': int(item.quantity),
            'price': float(product.precio),
            'subtotal': float(product.precio) * int(item.quantity),
            'image': product.image_data or (f"/img/productos/{product.image_key}.jpg" if product.image_key else ''),
        })
    carts = list(carts_map.values())
    for cart in carts:
        cart['total'] = float(sum(float(item.get('subtotal', 0)) for item in cart['items']))
    return {'status': 'ok', 'carts': carts}


@app.get('/favorites')
def listar_favoritos(
    user_id: str | None = Query(default=None),
    db: Session = Depends(get_session),
    usuario: UsuarioApp = Depends(require_roles('buyer', 'seller', 'courier', 'admin')),
):
    resolved_user_id = str(user_id or '').strip()
    if normalize_role(usuario.role) != 'admin':
        resolved_user_id = usuario.usuario_id
    elif not resolved_user_id:
        resolved_user_id = usuario.usuario_id

    items = db.query(Favorito).filter(Favorito.user_id == resolved_user_id).all()
    return {'status': 'ok', 'favorites': [item.product_id for item in items]}


@app.post('/favorites/{product_id}')
def agregar_favorito(
    product_id: str,
    user_id: str | None = Query(default=None),
    db: Session = Depends(get_session),
    usuario: UsuarioApp = Depends(require_roles('buyer', 'seller', 'courier', 'admin')),
):
    resolved_user_id = str(user_id or '').strip()
    if normalize_role(usuario.role) != 'admin':
        resolved_user_id = usuario.usuario_id
    elif not resolved_user_id:
        resolved_user_id = usuario.usuario_id

    existing = db.query(Favorito).filter(Favorito.user_id == resolved_user_id, Favorito.product_id == product_id).first()
    if not existing:
        db.add(Favorito(user_id=resolved_user_id, product_id=product_id, created_at=datetime.utcnow()))
        db.commit()
    return {'status': 'ok'}


@app.delete('/favorites/{product_id}')
def eliminar_favorito(
    product_id: str,
    user_id: str | None = Query(default=None),
    db: Session = Depends(get_session),
    usuario: UsuarioApp = Depends(require_roles('buyer', 'seller', 'courier', 'admin')),
):
    resolved_user_id = str(user_id or '').strip()
    if normalize_role(usuario.role) != 'admin':
        resolved_user_id = usuario.usuario_id
    elif not resolved_user_id:
        resolved_user_id = usuario.usuario_id

    db.query(Favorito).filter(Favorito.user_id == resolved_user_id, Favorito.product_id == product_id).delete()
    db.commit()
    return {'status': 'ok'}


@app.post('/reviews')
def crear_resena(
    payload: ReviewIn,
    db: Session = Depends(get_session),
    usuario: UsuarioApp = Depends(require_roles('buyer', 'seller', 'courier', 'admin')),
):
    user_id = payload.user_id
    if normalize_role(usuario.role) != 'admin':
        user_id = usuario.usuario_id

    user = db.get(UsuarioApp, user_id)
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail='Usuario no encontrado')
    product = db.get(Producto, payload.product_id)
    if not product:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail='Producto no encontrado')
    review = Resena(
        product_id=payload.product_id,
        user_id=user_id,
        user_name=user.nombre,
        rating=int(payload.rating),
        comment=(payload.comment or '').strip(),
        created_at=datetime.utcnow(),
    )
    db.add(review)
    db.commit()
    return {'status': 'ok', 'review': serialize_resena(review)}


@app.delete('/reviews/{review_id}')
def eliminar_resena(
    review_id: str,
    db: Session = Depends(get_session),
    _usuario: UsuarioApp = Depends(require_roles('admin')),
):
    raw_id = str(review_id or '').strip().lower()
    if raw_id.startswith('r-'):
        raw_id = raw_id[2:]

    try:
        numeric_id = int(raw_id)
    except ValueError:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail='ID de reseña invalido') from None

    review = db.get(Resena, numeric_id)
    if not review:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail='Reseña no encontrada')

    db.delete(review)
    db.commit()
    return {'status': 'ok', 'deleted': True, 'review_id': f'r-{numeric_id}'}


@app.get('/reviews/{review_id}/context')
def obtener_contexto_resena(
    review_id: str,
    db: Session = Depends(get_session),
    _usuario: UsuarioApp = Depends(require_roles('admin')),
):
    raw_id = str(review_id or '').strip().lower()
    if raw_id.startswith('r-'):
        raw_id = raw_id[2:]

    try:
        numeric_id = int(raw_id)
    except ValueError:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail='ID de reseña invalido') from None

    review = db.get(Resena, numeric_id)
    if not review:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail='Reseña no encontrada')

    return {
        'status': 'ok',
        'context': {
            'review_id': f'r-{numeric_id}',
            'product_id': review.product_id,
        },
    }


@app.post('/reports')
def crear_reporte(
    payload: ReportIn,
    db: Session = Depends(get_session),
    usuario: UsuarioApp = Depends(require_roles('buyer', 'seller', 'courier', 'admin')),
):
    reporter_id = payload.reporter_id
    if normalize_role(usuario.role) != 'admin':
        reporter_id = usuario.usuario_id

    reporter = db.get(UsuarioApp, reporter_id)
    if not reporter:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail='Usuario reportante no encontrado')
    report = Reporte(
        reporte_id=f'rep-{uuid4().hex[:10]}',
        reporter_id=reporter_id,
        reporter_name=reporter.nombre,
        target_type=payload.target_type,
        target_id=payload.target_id,
        reason=payload.reason,
        description=(payload.description or '').strip(),
        status='pending',
        admin_notes='',
        created_at=datetime.utcnow(),
    )
    db.add(report)
    db.commit()
    return {'status': 'ok', 'report': serialize_reporte(report)}


@app.get('/reports')
def listar_reportes(
    status_value: str | None = Query(default=None, alias='status'),
    db: Session = Depends(get_session),
    _usuario: UsuarioApp = Depends(require_roles('admin')),
):
    query = db.query(Reporte)
    if status_value:
        query = query.filter(Reporte.status == status_value)
    list_items = query.order_by(Reporte.created_at.desc()).all()
    return {'status': 'ok', 'reports': [serialize_reporte(item) for item in list_items]}


@app.get('/reports/my')
def mis_reportes(
    user_id: str = Query(...),
    db: Session = Depends(get_session),
    usuario: UsuarioApp = Depends(require_roles('buyer', 'seller', 'courier', 'admin')),
):
    if normalize_role(usuario.role) != 'admin' and usuario.usuario_id != user_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail='No autorizado para este usuario')
    list_items = db.query(Reporte).filter(Reporte.reporter_id == user_id).order_by(Reporte.created_at.desc()).all()
    return {'status': 'ok', 'reports': [serialize_reporte(item) for item in list_items]}


@app.put('/reports/{report_id}')
def actualizar_reporte(
    report_id: str,
    status_value: str = Query(..., alias='status'),
    admin_notes: str = Query(default='', alias='admin_notes'),
    db: Session = Depends(get_session),
    _usuario: UsuarioApp = Depends(require_roles('admin')),
):
    report = db.get(Reporte, report_id)
    if not report:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail='Reporte no encontrado')
    report.status = status_value
    report.admin_notes = admin_notes or ''
    db.commit()
    return {'status': 'ok', 'report': serialize_reporte(report)}


@app.get('/seller/profile')
def obtener_profile_seller(
    seller_id: str = Query(...),
    db: Session = Depends(get_session),
    usuario: UsuarioApp = Depends(require_roles('seller', 'admin')),
):
    ensure_seller_or_admin_scope(seller_id, usuario)
    profile = db.get(SellerProfile, seller_id)
    return {'status': 'ok', 'profile': serialize_profile(profile)}


@app.put('/seller/profile')
def actualizar_profile_seller(
    seller_id: str = Query(...),
    payload: SellerProfileIn | None = None,
    db: Session = Depends(get_session),
    usuario: UsuarioApp = Depends(require_roles('seller', 'admin')),
):
    ensure_seller_or_admin_scope(seller_id, usuario)
    if payload is None:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail='Payload requerido')
    user = db.get(UsuarioApp, seller_id)
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail='Vendedor no encontrado')
    profile = db.get(SellerProfile, seller_id)
    if not profile:
        profile = SellerProfile(seller_id=seller_id, updated_at=datetime.utcnow())
        db.add(profile)
    profile.business_name = payload.business_name
    profile.description = payload.description or ''
    profile.schedule = payload.schedule or ''
    profile.location = payload.location or ''
    profile.phone = payload.phone or ''
    profile.curp = payload.curp or ''
    profile.updated_at = datetime.utcnow()
    user.nombre = payload.business_name or user.nombre
    user.telefono = payload.phone or user.telefono
    user.direccion = payload.location or user.direccion
    db.commit()
    return {'status': 'ok', 'profile': serialize_profile(profile)}


@app.get('/seller/metrics')
def seller_metrics(
    seller_id: str = Query(...),
    db: Session = Depends(get_session),
    usuario: UsuarioApp = Depends(require_roles('seller', 'admin')),
):
    ensure_seller_or_admin_scope(seller_id, usuario)
    seller_products = db.query(Producto).filter(Producto.seller_id == seller_id).all()
    product_ids = [item.producto_id for item in seller_products]
    review_count = db.query(Resena).filter(Resena.product_id.in_(product_ids)).count() if product_ids else 0
    avg_rating = 0
    if product_ids and review_count:
        ratings = db.query(Resena).filter(Resena.product_id.in_(product_ids)).all()
        avg_rating = round(sum(int(item.rating or 0) for item in ratings) / len(ratings), 1)
    return {
        'status': 'ok',
        'metrics': {
            'total_products': len(seller_products),
            'total_sales': 0,
            'total_orders': 0,
            'average_rating': avg_rating,
            'total_reviews': review_count,
        },
    }


@app.get('/sellers')
def listar_sellers(db: Session = Depends(get_session)):
    sellers = db.query(UsuarioApp).filter(UsuarioApp.role == 'seller', UsuarioApp.activo.is_(True)).all()
    payload = []
    for seller in sellers:
        profile = db.get(SellerProfile, seller.usuario_id)
        payload.append({
            **serialize_usuario(seller),
            'seller_profile': serialize_profile(profile),
        })
    return {'status': 'ok', 'sellers': payload}


@app.get('/sellers/{seller_id}')
def obtener_seller(seller_id: str, db: Session = Depends(get_session)):
    seller = db.get(UsuarioApp, seller_id)
    if not seller or seller.role != 'seller':
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail='Vendedor no encontrado')
    profile = db.get(SellerProfile, seller.usuario_id)
    return {'status': 'ok', 'seller': {**serialize_usuario(seller), 'seller_profile': serialize_profile(profile)}}


@app.put('/admin/products/{product_id}/status')
def admin_status_producto(
    product_id: str,
    status_value: str = Query(default='approved', alias='status'),
    db: Session = Depends(get_session),
    _usuario: UsuarioApp = Depends(require_roles('admin')),
):
    product = db.get(Producto, product_id)
    if not product:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail='Producto no encontrado')
    allowed_statuses = {'pending', 'approved', 'paused', 'rejected'}
    safe_status = str(status_value or '').strip().lower()
    if safe_status not in allowed_statuses:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail='Estado de producto invalido')
    if not hasattr(product, 'status'):
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail='Este backend no tiene campo status en productos. Actualiza clientes-service con el modelo mas reciente.',
        )
    product.status = safe_status
    product.updated_at = datetime.utcnow()
    db.commit()
    return {'status': 'ok', 'product_id': product_id, 'new_status': product.status}


@app.put('/admin/products/{product_id}/verify-local')
def admin_verify_local(
    product_id: str,
    verified: bool = Query(default=True),
    db: Session = Depends(get_session),
    _usuario: UsuarioApp = Depends(require_roles('admin')),
):
    product = db.get(Producto, product_id)
    if not product:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail='Producto no encontrado')
    product.verified = bool(verified)
    product.updated_at = datetime.utcnow()
    db.commit()
    return {'status': 'ok', 'product_id': product_id, 'verified': product.verified}


@app.put('/admin/products/{product_id}/feature')
def admin_feature_product(
    product_id: str,
    days: int = Query(default=7),
    db: Session = Depends(get_session),
    _usuario: UsuarioApp = Depends(require_roles('admin')),
):
    product = db.get(Producto, product_id)
    if not product:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail='Producto no encontrado')
    product.featured = True
    product.updated_at = datetime.utcnow()
    db.commit()
    return {'status': 'ok', 'product_id': product_id, 'featured': True, 'days': int(max(1, days))}


@app.put('/admin/sellers/{seller_id}/status')
def admin_status_seller(
    seller_id: str,
    status_value: str = Query(default='verified', alias='status'),
    db: Session = Depends(get_session),
    _usuario: UsuarioApp = Depends(require_roles('admin')),
):
    seller = db.get(UsuarioApp, seller_id)
    if not seller or seller.role != 'seller':
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail='Vendedor no encontrado')
    seller.activo = status_value != 'blocked'
    db.commit()
    return {'status': 'ok', 'seller_id': seller_id, 'new_status': status_value}


@app.put('/admin/users/{user_id}/status')
def admin_status_user(
    user_id: str,
    status_value: str = Query(default='active', alias='status'),
    db: Session = Depends(get_session),
    _usuario: UsuarioApp = Depends(require_roles('admin')),
):
    user = db.get(UsuarioApp, user_id)
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail='Usuario no encontrado')
    user.activo = status_value != 'blocked'
    db.commit()
    return {'status': 'ok', 'user_id': user_id, 'new_status': status_value}


@app.get('/admin/stats')
def admin_stats(
    db: Session = Depends(get_session),
    _usuario: UsuarioApp = Depends(require_roles('admin')),
):
    return {
        'status': 'ok',
        'stats': {
            'users_total': db.query(UsuarioApp).count(),
            'products_total': db.query(Producto).count(),
            'orders_total': 0,
            'reports_pending': db.query(Reporte).filter(Reporte.status == 'pending').count(),
            'sellers_pending': 0,
        },
    }


@app.get('/admin/users')
def admin_users(
    role: str | None = Query(default=None),
    status_value: str | None = Query(default=None, alias='status'),
    db: Session = Depends(get_session),
    _usuario: UsuarioApp = Depends(require_roles('admin')),
):
    query = db.query(UsuarioApp)
    if role:
        query = query.filter(UsuarioApp.role == normalize_role(role))
    users = query.order_by(UsuarioApp.created_at.desc()).all()
    data = []
    for user in users:
        if status_value == 'blocked' and user.activo:
            continue
        if status_value in {'active', 'verified'} and not user.activo:
            continue
        data.append({
            **serialize_usuario(user),
            'status': 'verified' if user.activo else 'blocked',
            'created_at': user.created_at.isoformat() if user.created_at else '',
        })
    return {'status': 'ok', 'users': data}


@app.post('/subscription')
def subscription_update(user_id: str = Query(...), plan: str = Query(default='free')):
    return {'status': 'ok', 'user_id': user_id, 'plan': plan}


@app.post('/uploads/images')
async def upload_images(files: list[UploadFile] = File(default_factory=list)):
    urls = []
    for file in files:
        content = await file.read()
        if not content:
            continue
        content_type = file.content_type or 'image/jpeg'
        encoded = base64.b64encode(content).decode('utf-8')
        urls.append(f'data:{content_type};base64,{encoded}')
    return {'status': 'ok', 'urls': urls}


def serialize_reporte(report: Reporte) -> dict:
    return {
        'id': report.reporte_id,
        'reporter_id': report.reporter_id,
        'reporter_name': report.reporter_name,
        'target_type': report.target_type,
        'target_id': report.target_id,
        'reason': report.reason,
        'description': report.description or '',
        'status': report.status,
        'admin_notes': report.admin_notes or '',
        'created_at': report.created_at.isoformat() if report.created_at else '',
    }


