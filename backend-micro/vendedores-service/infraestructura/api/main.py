import os
from datetime import datetime

from fastapi import Depends, FastAPI, HTTPException, Query, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import JWTError, jwt
from pydantic import BaseModel, EmailStr, Field
from sqlalchemy.orm import Session

from infraestructura.adapters.db import Vendedor, get_session, init_db


app = FastAPI(title='Microservicio Vendedores MercadoLocal', version='1.0.0')
security_scheme = HTTPBearer(auto_error=False)
JWT_SECRET_KEY = os.getenv('JWT_SECRET_KEY', '').strip()
JWT_ALGORITHM = os.getenv('JWT_ALGORITHM', 'HS256').strip()

app.add_middleware(
    CORSMiddleware,
    allow_origins=['*'],
    allow_credentials=True,
    allow_methods=['*'],
    allow_headers=['*'],
)


class VendedorIn(BaseModel):
    nombre: str = Field(min_length=2, max_length=120)
    email: EmailStr
    telefono: str | None = Field(default=None, max_length=40)
    ubicacion: str | None = Field(default=None, max_length=255)
    curp: str | None = Field(default=None, max_length=40)
    negocio: str = Field(min_length=2, max_length=160)


class PerfilUpdate(BaseModel):
    descripcion: str | None = Field(default='')
    horario: str | None = Field(default='')
    telefono: str | None = Field(default='')
    ubicacion: str | None = Field(default='')
    curp: str | None = Field(default='')


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


def serialize_vendedor(item: Vendedor) -> dict:
    return {
        'id': item.vendedor_id,
        'name': item.nombre,
        'email': item.email,
        'phone': item.telefono or '',
        'location': item.ubicacion or '',
        'curp': item.curp or '',
        'verified': bool(item.verificado),
        'rating': float(item.rating or 0),
        'total_products': int(item.total_productos or 0),
        'seller_profile': {
            'business_name': item.negocio,
            'description': item.descripcion or '',
            'schedule': item.horario or '',
            'location': item.ubicacion or '',
            'phone': item.telefono or '',
            'curp': item.curp or '',
        },
        'updated_at': item.updated_at.isoformat() if item.updated_at else '',
    }


@app.on_event('startup')
def on_startup():
    init_db()


@app.get('/')
def root():
    return {'service': 'vendedores', 'status': 'ok', 'port': 8004}


@app.get('/health')
def health():
    return {'ok': True, 'service': 'vendedores'}


@app.get('/vendedores')
def listar_vendedores(verified: bool | None = Query(default=None), db: Session = Depends(get_session)):
    query = db.query(Vendedor)
    if verified is not None:
        query = query.filter(Vendedor.verificado.is_(bool(verified)))
    rows = query.order_by(Vendedor.nombre.asc()).all()
    return {'status': 'ok', 'sellers': [serialize_vendedor(row) for row in rows]}


@app.get('/vendedores/{vendedor_id}')
def obtener_vendedor(vendedor_id: str, db: Session = Depends(get_session)):
    row = db.get(Vendedor, vendedor_id)
    if not row:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail='Vendedor no encontrado')
    return {'status': 'ok', 'seller': serialize_vendedor(row)}


@app.post('/vendedores', status_code=status.HTTP_201_CREATED)
def crear_vendedor(
    payload: VendedorIn,
    db: Session = Depends(get_session),
    _claims: dict = Depends(require_roles('admin')),
):
    existing = db.query(Vendedor).filter(Vendedor.email == payload.email).first()
    if existing:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail='Correo ya registrado')
    sid = f"vendedor-{int(datetime.utcnow().timestamp())}"
    row = Vendedor(
        vendedor_id=sid,
        nombre=payload.nombre.strip(),
        email=payload.email.strip().lower(),
        telefono=(payload.telefono or '').strip(),
        ubicacion=(payload.ubicacion or '').strip(),
        curp=(payload.curp or '').strip(),
        negocio=payload.negocio.strip(),
        descripcion='',
        horario='',
        verificado=True,
        rating=5,
        total_productos=0,
        created_at=datetime.utcnow(),
        updated_at=datetime.utcnow(),
    )
    db.add(row)
    db.commit()
    db.refresh(row)
    return {'status': 'ok', 'seller': serialize_vendedor(row)}


@app.put('/vendedores/{vendedor_id}/perfil')
def actualizar_perfil(
    vendedor_id: str,
    payload: PerfilUpdate,
    db: Session = Depends(get_session),
    claims: dict = Depends(require_roles('seller', 'admin')),
):
    ensure_seller_or_admin_scope(vendedor_id, claims)
    row = db.get(Vendedor, vendedor_id)
    if not row:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail='Vendedor no encontrado')
    row.descripcion = (payload.descripcion or '').strip()
    row.horario = (payload.horario or '').strip()
    row.telefono = (payload.telefono or '').strip()
    row.ubicacion = (payload.ubicacion or '').strip()
    row.curp = (payload.curp or '').strip()
    row.updated_at = datetime.utcnow()
    db.commit()
    return {'status': 'ok', 'seller': serialize_vendedor(row)}


@app.put('/vendedores/{vendedor_id}/metrics')
def actualizar_metricas(
    vendedor_id: str,
    total_productos: int = Query(default=0),
    rating: float = Query(default=5),
    db: Session = Depends(get_session),
    claims: dict = Depends(require_roles('seller', 'admin')),
):
    ensure_seller_or_admin_scope(vendedor_id, claims)
    row = db.get(Vendedor, vendedor_id)
    if not row:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail='Vendedor no encontrado')
    row.total_productos = max(0, int(total_productos))
    row.rating = max(0, min(5, float(rating)))
    row.updated_at = datetime.utcnow()
    db.commit()
    return {'status': 'ok', 'seller': serialize_vendedor(row)}


