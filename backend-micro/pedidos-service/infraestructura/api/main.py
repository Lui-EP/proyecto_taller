import json
import os
from datetime import datetime
from uuid import uuid4

from fastapi import Depends, FastAPI, HTTPException, Query, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import JWTError, jwt
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from infraestructura.adapters.db import ESTADOS_PEDIDO, PedidoApp, PickupStore, get_session, init_db


app = FastAPI(title='Microservicio Pedidos MercadoLocal', version='2.0.0')
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


class OrderItemIn(BaseModel):
    productId: str
    quantity: int = Field(ge=1)
    productName: str
    sellerId: str
    sellerName: str
    categoryLabel: str
    price: float = Field(gt=0)
    subtotal: float = Field(ge=0)


class PedidoIn(BaseModel):
    customerId: str = Field(min_length=1, max_length=60)
    customerName: str = Field(min_length=2, max_length=120)
    customerPhone: str = Field(min_length=6, max_length=40)
    deliveryMethod: str = Field(min_length=4, max_length=20)
    pickupStoreId: str | None = Field(default='')
    pickupStoreName: str | None = Field(default='')
    pickupStoreLat: float | None = Field(default=None)
    pickupStoreLng: float | None = Field(default=None)
    address: str = Field(min_length=4, max_length=255)
    addressLabel: str | None = Field(default='')
    addressLat: float | None = Field(default=None)
    addressLng: float | None = Field(default=None)
    addressColony: str | None = Field(default='')
    addressSubdivision: str | None = Field(default='')
    note: str | None = None
    items: list[OrderItemIn] = Field(min_length=1)
    total: float = Field(gt=0)


class EstadoIn(BaseModel):
    status: str = Field(min_length=3, max_length=40)
    courierId: str | None = Field(default='')
    courierName: str | None = Field(default='')
    courierLat: float | None = Field(default=None)
    courierLng: float | None = Field(default=None)
    locationAt: datetime | None = Field(default=None)


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
    role = str(payload.get('role') or '').strip().lower()
    if not user_id or role not in {'buyer', 'seller', 'courier', 'admin'}:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail='Token invalido')
    return {'sub': user_id, 'role': role, 'email': str(payload.get('email') or '').strip().lower()}


def require_roles(*roles: str):
    allowed = {str(role or '').strip().lower() for role in roles}

    def _guard(claims: dict = Depends(decode_jwt_claims)) -> dict:
        role = str(claims.get('role') or '').lower()
        if role not in allowed:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail='No autorizado para esta ruta')
        return claims

    return _guard


@app.on_event('startup')
def on_startup():
    init_db()


@app.get('/')
def root():
    return {'service': 'pedidos', 'status': 'ok', 'port': 8002}


@app.get('/health')
def health():
    return {'ok': True, 'service': 'pedidos'}


@app.post('/pedidos', status_code=status.HTTP_201_CREATED)
def registrar_pedido(
    payload: PedidoIn,
    db: Session = Depends(get_session),
    claims: dict = Depends(require_roles('buyer', 'seller', 'admin')),
):
    requester_role = str(claims.get('role') or '')
    requester_id = str(claims.get('sub') or '')
    if requester_role in ('buyer', 'seller') and payload.customerId != requester_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail='No autorizado para crear pedido para otro cliente')

    delivery_method = (payload.deliveryMethod or 'delivery').strip().lower()
    if delivery_method not in {'delivery', 'pickup'}:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail='deliveryMethod inválido')

    now = datetime.utcnow()
    pedido = PedidoApp(
        pedido_uid=f'o-{uuid4().hex[:12]}',
        customer_id=payload.customerId,
        customer_name=payload.customerName.strip(),
        customer_phone=payload.customerPhone.strip(),
        delivery_method=delivery_method,
        pickup_store_id=(payload.pickupStoreId or '').strip(),
        pickup_store_name=(payload.pickupStoreName or '').strip(),
        pickup_store_lat=payload.pickupStoreLat,
        pickup_store_lng=payload.pickupStoreLng,
        address=payload.address.strip(),
        address_label=(payload.addressLabel or payload.address or '').strip(),
        address_lat=payload.addressLat,
        address_lng=payload.addressLng,
        address_colony=(payload.addressColony or '').strip(),
        address_subdivision=(payload.addressSubdivision or '').strip(),
        status='pedido_realizado',
        courier_id='',
        courier_name='',
        courier_lat=None,
        courier_lng=None,
        last_location_at=None,
        note=(payload.note or '').strip(),
        items_json=json.dumps([item.model_dump() for item in payload.items], ensure_ascii=False),
        total=payload.total,
        created_at=now,
        updated_at=now,
    )
    db.add(pedido)
    db.commit()
    db.refresh(pedido)
    return {'status': 'ok', 'pedido': serialize_pedido(pedido)}


@app.put('/pedidos/{pedido_uid}/estado')
def cambiar_estado_pedido(
    pedido_uid: str,
    payload: EstadoIn,
    db: Session = Depends(get_session),
    claims: dict = Depends(require_roles('admin', 'courier', 'seller')),
):
    status_value = (payload.status or '').strip().lower()
    if status_value not in ESTADOS_PEDIDO:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f'Estado inválido: {status_value}')

    pedido = db.query(PedidoApp).filter(PedidoApp.pedido_uid == pedido_uid).first()
    if not pedido:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail='Pedido no encontrado')

    requester_role = str(claims.get('role') or '')
    requester_id = str(claims.get('sub') or '')
    if requester_role == 'courier':
        requested_courier_id = str(payload.courierId or '').strip()
        if requested_courier_id and requested_courier_id != requester_id:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail='No autorizado para este repartidor')
        if pedido.courier_id and pedido.courier_id != requester_id:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail='Pedido asignado a otro repartidor')
        payload.courierId = requester_id

    pedido.status = status_value
    pedido.courier_id = (payload.courierId or '').strip()
    pedido.courier_name = (payload.courierName or '').strip()
    pedido.courier_lat = payload.courierLat
    pedido.courier_lng = payload.courierLng
    pedido.last_location_at = payload.locationAt or (datetime.utcnow() if payload.courierLat is not None and payload.courierLng is not None else pedido.last_location_at)
    pedido.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(pedido)
    return {'status': 'ok', 'pedido': serialize_pedido(pedido)}


@app.get('/pedidos')
def listar_pedidos(
    customer_id: str | None = Query(default=None),
    courier_id: str | None = Query(default=None),
    seller_id: str | None = Query(default=None),
    db: Session = Depends(get_session),
    claims: dict = Depends(require_roles('buyer', 'seller', 'courier', 'admin')),
):
    pedidos = db.query(PedidoApp).order_by(PedidoApp.created_at.desc()).all()
    serialized = [serialize_pedido(pedido) for pedido in pedidos]

    requester_role = str(claims.get('role') or '')
    requester_id = str(claims.get('sub') or '')

    if requester_role == 'buyer':
        if customer_id and customer_id != requester_id:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail='No autorizado para ese cliente')
        customer_id = requester_id
    elif requester_role == 'courier':
        if courier_id and courier_id != requester_id:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail='No autorizado para ese repartidor')
    elif requester_role == 'seller':
        if seller_id and seller_id != requester_id:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail='No autorizado para ese vendedor')
        seller_id = requester_id

    if customer_id:
        serialized = [pedido for pedido in serialized if pedido['customerId'] == customer_id]
    if requester_role == 'courier' and not courier_id:
        serialized = [
            pedido
            for pedido in serialized
            if not str(pedido.get('courierId') or '').strip() or str(pedido.get('courierId') or '').strip() == requester_id
        ]
    elif courier_id:
        serialized = [pedido for pedido in serialized if pedido['courierId'] == courier_id]
    if seller_id:
        serialized = [pedido for pedido in serialized if any(item.get('sellerId') == seller_id for item in pedido['items'])]

    return {'status': 'ok', 'pedidos': serialized}


@app.get('/pedidos/{pedido_uid}')
def obtener_pedido(
    pedido_uid: str,
    db: Session = Depends(get_session),
    claims: dict = Depends(require_roles('buyer', 'seller', 'courier', 'admin')),
):
    pedido = db.query(PedidoApp).filter(PedidoApp.pedido_uid == pedido_uid).first()
    if not pedido:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail='Pedido no encontrado')
    serialized = serialize_pedido(pedido)
    requester_role = str(claims.get('role') or '')
    requester_id = str(claims.get('sub') or '')
    if requester_role == 'buyer' and serialized['customerId'] != requester_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail='No autorizado para este pedido')
    if requester_role == 'courier':
        assigned_courier = str(serialized.get('courierId') or '').strip()
        if assigned_courier and assigned_courier != requester_id:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail='No autorizado para este pedido')
    if requester_role == 'seller' and not any(item.get('sellerId') == requester_id for item in serialized['items']):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail='No autorizado para este pedido')
    return {'status': 'ok', 'pedido': serialized}


@app.get('/pickup-stores')
def listar_pickup_stores(db: Session = Depends(get_session)):
    stores = (
        db.query(PickupStore)
        .filter(PickupStore.active.is_(True))
        .order_by(PickupStore.name.asc())
        .all()
    )
    return {
        'status': 'ok',
        'stores': [
            {
                'id': store.store_id,
                'name': store.name,
                'address': store.address,
                'hours': store.hours,
                'lat': store.lat,
                'lng': store.lng,
            }
            for store in stores
        ],
    }


def serialize_pedido(pedido: PedidoApp) -> dict:
    items = json.loads(pedido.items_json or '[]')
    return {
        'id': pedido.pedido_uid,
        'customerId': pedido.customer_id,
        'customerName': pedido.customer_name,
        'customerPhone': pedido.customer_phone,
        'deliveryMethod': pedido.delivery_method,
        'pickupStoreId': pedido.pickup_store_id or '',
        'pickupStoreName': pedido.pickup_store_name or '',
        'pickupStoreLat': pedido.pickup_store_lat,
        'pickupStoreLng': pedido.pickup_store_lng,
        'address': pedido.address,
        'addressLabel': pedido.address_label or pedido.address,
        'addressLat': pedido.address_lat,
        'addressLng': pedido.address_lng,
        'addressColony': pedido.address_colony or '',
        'addressSubdivision': pedido.address_subdivision or '',
        'status': pedido.status,
        'courierId': pedido.courier_id or '',
        'courierName': pedido.courier_name or '',
        'courierLat': pedido.courier_lat,
        'courierLng': pedido.courier_lng,
        'lastLocationAt': pedido.last_location_at.isoformat() if pedido.last_location_at else '',
        'note': pedido.note or '',
        'items': items,
        'total': pedido.total,
        'createdAt': pedido.created_at.isoformat() if pedido.created_at else '',
        'updatedAt': pedido.updated_at.isoformat() if pedido.updated_at else '',
    }

