import os
from datetime import datetime

from fastapi import Depends, FastAPI, HTTPException, Query, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import JWTError, jwt
from pydantic import BaseModel, EmailStr, Field
from sqlalchemy.orm import Session

from infraestructura.adapters.db import Repartidor, get_session, init_db


app = FastAPI(title='Microservicio Repartidores MercadoLocal', version='1.0.0')
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


class RepartidorIn(BaseModel):
    nombre: str = Field(min_length=2, max_length=120)
    email: EmailStr
    telefono: str | None = Field(default=None, max_length=40)


class EstadoIn(BaseModel):
    estado: str = Field(min_length=3, max_length=40)


class UbicacionIn(BaseModel):
    lat: float
    lng: float


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


def ensure_courier_or_admin_scope(target_courier_id: str, claims: dict) -> None:
    role = str(claims.get('role') or '')
    requester_id = str(claims.get('sub') or '')
    if role == 'admin':
        return
    if role != 'courier' or requester_id != str(target_courier_id or '').strip():
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail='No autorizado para este repartidor')


def normalize_spaces(value: str | None) -> str:
    return ' '.join(str(value or '').strip().split())


def capitalize_words(value: str | None) -> str:
    safe = normalize_spaces(value)
    if not safe:
        return ''
    return ' '.join(part[:1].upper() + part[1:].lower() for part in safe.split(' '))


def format_phone_with_hyphens(value: str | None) -> str:
    digits = ''.join(ch for ch in str(value or '') if ch.isdigit())
    if len(digits) == 10:
        return f'{digits[:3]}-{digits[3:6]}-{digits[6:]}'
    return normalize_spaces(value)


def serialize_repartidor(item: Repartidor) -> dict:
    return {
        'id': item.repartidor_id,
        'name': item.nombre,
        'email': item.email,
        'phone': item.telefono or '',
        'active': bool(item.activo),
        'status': item.estado,
        'location': {
            'lat': item.ubicacion_lat,
            'lng': item.ubicacion_lng,
        },
        'updated_at': item.updated_at.isoformat() if item.updated_at else '',
    }


@app.on_event('startup')
def on_startup():
    init_db()


@app.get('/')
def root():
    return {'service': 'repartidores', 'status': 'ok', 'port': 8003}


@app.get('/health')
def health():
    return {'ok': True, 'service': 'repartidores'}


@app.get('/repartidores')
def listar_repartidores(
    activo: bool | None = Query(default=None),
    db: Session = Depends(get_session),
    _claims: dict = Depends(require_roles('courier', 'seller', 'admin')),
):
    query = db.query(Repartidor)
    if activo is not None:
        query = query.filter(Repartidor.activo.is_(bool(activo)))
    rows = query.order_by(Repartidor.nombre.asc()).all()
    return {'status': 'ok', 'couriers': [serialize_repartidor(row) for row in rows]}


@app.get('/repartidores/demo')
def demo_repartidores(
    db: Session = Depends(get_session),
    _claims: dict = Depends(require_roles('courier', 'seller', 'admin')),
):
    rows = db.query(Repartidor).filter(Repartidor.activo.is_(True)).order_by(Repartidor.nombre.asc()).all()
    return {'status': 'ok', 'couriers': [serialize_repartidor(row) for row in rows]}


@app.get('/repartidores/{repartidor_id}')
def obtener_repartidor(
    repartidor_id: str,
    db: Session = Depends(get_session),
    claims: dict = Depends(require_roles('courier', 'admin')),
):
    ensure_courier_or_admin_scope(repartidor_id, claims)
    row = db.get(Repartidor, repartidor_id)
    if not row:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail='Repartidor no encontrado')
    return {'status': 'ok', 'courier': serialize_repartidor(row)}


@app.post('/repartidores', status_code=status.HTTP_201_CREATED)
def crear_repartidor(
    payload: RepartidorIn,
    db: Session = Depends(get_session),
    _claims: dict = Depends(require_roles('admin')),
):
    existing = db.query(Repartidor).filter(Repartidor.email == payload.email).first()
    if existing:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail='Correo ya registrado')
    rid = f"repartidor-{int(datetime.utcnow().timestamp())}"
    row = Repartidor(
        repartidor_id=rid,
        nombre=capitalize_words(payload.nombre),
        email=payload.email.strip().lower(),
        telefono=format_phone_with_hyphens(payload.telefono),
        activo=True,
        estado='disponible',
        updated_at=datetime.utcnow(),
    )
    db.add(row)
    db.commit()
    db.refresh(row)
    return {'status': 'ok', 'courier': serialize_repartidor(row)}


@app.put('/repartidores/{repartidor_id}/estado')
def actualizar_estado_repartidor(
    repartidor_id: str,
    payload: EstadoIn,
    db: Session = Depends(get_session),
    claims: dict = Depends(require_roles('courier', 'admin')),
):
    ensure_courier_or_admin_scope(repartidor_id, claims)
    row = db.get(Repartidor, repartidor_id)
    if not row:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail='Repartidor no encontrado')
    row.estado = payload.estado.strip().lower()
    row.updated_at = datetime.utcnow()
    db.commit()
    return {'status': 'ok', 'courier': serialize_repartidor(row)}


@app.put('/repartidores/{repartidor_id}/ubicacion')
def actualizar_ubicacion_repartidor(
    repartidor_id: str,
    payload: UbicacionIn,
    db: Session = Depends(get_session),
    claims: dict = Depends(require_roles('courier', 'admin')),
):
    ensure_courier_or_admin_scope(repartidor_id, claims)
    row = db.get(Repartidor, repartidor_id)
    if not row:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail='Repartidor no encontrado')
    row.ubicacion_lat = float(payload.lat)
    row.ubicacion_lng = float(payload.lng)
    row.updated_at = datetime.utcnow()
    db.commit()
    return {'status': 'ok', 'courier': serialize_repartidor(row)}


