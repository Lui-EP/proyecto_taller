import os
import time
from datetime import datetime
from typing import Generator

from dotenv import load_dotenv
from sqlalchemy import Boolean, Column, DateTime, Float, Integer, String, Text, create_engine, text
from sqlalchemy.exc import OperationalError
from sqlalchemy.orm import declarative_base, sessionmaker


load_dotenv()

pg_config = {
    'dbname': os.getenv('POSTGRES_DB', 'bd_proypedidos'),
    'user': os.getenv('POSTGRES_USER', 'postgres'),
    'password': os.getenv('POSTGRES_PASSWORD', 'pERSONAL04'),
    'host': os.getenv('POSTGRES_HOST', '127.0.0.1'),
    'port': int(os.getenv('POSTGRES_PORT', 5433)),
}

if pg_config['password']:
    DATABASE_URL = (
        f"postgresql+psycopg2://{pg_config['user']}:{pg_config['password']}"
        f"@{pg_config['host']}:{pg_config['port']}/{pg_config['dbname']}"
    )
else:
    DATABASE_URL = (
        f"postgresql+psycopg2://{pg_config['user']}"
        f"@{pg_config['host']}:{pg_config['port']}/{pg_config['dbname']}"
    )

engine = create_engine(DATABASE_URL, pool_pre_ping=True)
SessionLocal = sessionmaker(bind=engine, autocommit=False, autoflush=False)
Base = declarative_base()

ESTADOS_PEDIDO = {
    'pedido_realizado',
    'asignado',
    'en_transito',
    'listo_recoger',
    'entregado',
    'cancelado',
}

SEED_ORDERS = [
    {
        'pedido_uid': 'o-1774804180283',
        'customer_id': 'buyer-1',
        'customer_name': 'Cliente Demo',
        'customer_phone': '9610000000',
        'delivery_method': 'delivery',
        'pickup_store_id': '',
        'pickup_store_name': '',
        'address': 'Avenida Miguel Hidalgo, Tuxtla Gutiérrez, Chiapas',
        'address_label': 'Avenida Miguel Hidalgo, Bienestar Social, Tuxtla Gutiérrez, Chiapas, México',
        'address_lat': 16.74481,
        'address_lng': -93.09304,
        'address_colony': 'Bienestar Social',
        'address_subdivision': '',
        'status': 'pedido_realizado',
        'courier_id': '',
        'courier_name': '',
        'courier_lat': None,
        'courier_lng': None,
        'last_location_at': None,
        'note': 'Tocar antes de llegar.',
        'items_json': '[{"productId":"p-4","productName":"Café molido artesanal","sellerId":"seller-1","sellerName":"Artesana Luna","categoryLabel":"Alimentos","price":190,"quantity":1,"subtotal":190},{"productId":"p-7","productName":"Pulsera de ámbar","sellerId":"seller-1","sellerName":"Artesana Luna","categoryLabel":"Joyería","price":310,"quantity":1,"subtotal":310}]',
        'total': 500,
    },
    {
        'pedido_uid': 'o-demo-1',
        'customer_id': 'buyer-1',
        'customer_name': 'QWE',
        'customer_phone': '9611111111',
        'delivery_method': 'delivery',
        'pickup_store_id': '',
        'pickup_store_name': '',
        'address': 'Centro, Tuxtla Gutiérrez, Chiapas',
        'address_label': 'Centro, Tuxtla Gutiérrez, Chiapas, México',
        'address_lat': 16.7516,
        'address_lng': -93.1166,
        'address_colony': 'Centro',
        'address_subdivision': '',
        'status': 'en_transito',
        'courier_id': 'courier-1',
        'courier_name': 'Repartidor Demo',
        'courier_lat': 16.7493,
        'courier_lng': -93.1108,
        'last_location_at': datetime(2026, 4, 27, 8, 55, 0),
        'note': 'Entregar en recepción.',
        'items_json': '[{"productId":"p-1","productName":"Canastas de palma","sellerId":"seller-1","sellerName":"Artesana Luna","categoryLabel":"Artesanías","price":450,"quantity":1,"subtotal":450},{"productId":"p-10","productName":"Tazas de arcilla","sellerId":"seller-1","sellerName":"Artesana Luna","categoryLabel":"Artesanías","price":340,"quantity":2,"subtotal":680}]',
        'total': 1130,
    },
    {
        'pedido_uid': 'o-demo-2',
        'customer_id': 'buyer-1',
        'customer_name': 'Cliente Feria',
        'customer_phone': '9612222222',
        'delivery_method': 'pickup',
        'pickup_store_id': 'store-chiapa-corzo',
        'pickup_store_name': 'MercadoLocal Chiapa de Corzo',
        'address': 'Tienda MercadoLocal, Chiapa de Corzo, Chiapas',
        'address_label': 'MercadoLocal Chiapa de Corzo, Centro, Chiapa de Corzo, Chiapas, México',
        'pickup_store_lat': 16.7076,
        'pickup_store_lng': -93.011,
        'status': 'listo_recoger',
        'courier_id': '',
        'courier_name': '',
        'courier_lat': None,
        'courier_lng': None,
        'last_location_at': None,
        'note': 'Mostrar código al llegar.',
        'items_json': '[{"productId":"p-6","productName":"Molcajete volcánico","sellerId":"seller-1","sellerName":"Artesana Luna","categoryLabel":"Artesanías","price":640,"quantity":1,"subtotal":640}]',
        'total': 640,
    },
]


class PedidoApp(Base):
    __tablename__ = 'pedidos_app'

    id = Column(Integer, primary_key=True, autoincrement=True)
    pedido_uid = Column(String(60), nullable=False, unique=True, index=True)
    customer_id = Column(String(60), nullable=False, index=True)
    customer_name = Column(String(120), nullable=False)
    customer_phone = Column(String(40), nullable=False)
    delivery_method = Column(String(20), nullable=False, default='delivery')
    pickup_store_id = Column(String(80), nullable=True)
    pickup_store_name = Column(String(180), nullable=True)
    pickup_store_lat = Column(Float, nullable=True)
    pickup_store_lng = Column(Float, nullable=True)
    address = Column(String(255), nullable=False)
    address_label = Column(String(255), nullable=True)
    address_lat = Column(Float, nullable=True)
    address_lng = Column(Float, nullable=True)
    address_colony = Column(String(120), nullable=True)
    address_subdivision = Column(String(120), nullable=True)
    status = Column(String(40), nullable=False, default='pedido_realizado')
    courier_id = Column(String(60), nullable=True)
    courier_name = Column(String(120), nullable=True)
    courier_lat = Column(Float, nullable=True)
    courier_lng = Column(Float, nullable=True)
    last_location_at = Column(DateTime, nullable=True)
    note = Column(Text, nullable=True)
    items_json = Column(Text, nullable=False)
    total = Column(Float, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, nullable=False)


class Pedido(Base):
    __tablename__ = 'pedidos'

    pedido_id = Column(Integer, primary_key=True, autoincrement=True)
    cliente_id = Column(Integer, nullable=False, index=True)
    descripcion = Column(String(250), nullable=False)
    total = Column(Float, nullable=False)
    estado = Column(String(40), nullable=False, default='pedido_realizado')
    direccion_entrega = Column(String(255), nullable=False)
    repartidor = Column(String(120), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, nullable=False)


def seed_orders() -> None:
    db = SessionLocal()
    try:
        for payload in SEED_ORDERS:
            existing = db.query(PedidoApp).filter(PedidoApp.pedido_uid == payload['pedido_uid']).first()
            if existing:
                for key, value in payload.items():
                    setattr(existing, key, value)
                continue
            db.add(PedidoApp(**payload))
        db.commit()
    finally:
        db.close()


def ensure_pedidos_app_schema() -> None:
    statements = [
        "ALTER TABLE pedidos_app ADD COLUMN IF NOT EXISTS pickup_store_lat DOUBLE PRECISION",
        "ALTER TABLE pedidos_app ADD COLUMN IF NOT EXISTS pickup_store_lng DOUBLE PRECISION",
        "ALTER TABLE pedidos_app ADD COLUMN IF NOT EXISTS address_label VARCHAR(255)",
        "ALTER TABLE pedidos_app ADD COLUMN IF NOT EXISTS address_lat DOUBLE PRECISION",
        "ALTER TABLE pedidos_app ADD COLUMN IF NOT EXISTS address_lng DOUBLE PRECISION",
        "ALTER TABLE pedidos_app ADD COLUMN IF NOT EXISTS address_colony VARCHAR(120)",
        "ALTER TABLE pedidos_app ADD COLUMN IF NOT EXISTS address_subdivision VARCHAR(120)",
        "ALTER TABLE pedidos_app ADD COLUMN IF NOT EXISTS courier_lat DOUBLE PRECISION",
        "ALTER TABLE pedidos_app ADD COLUMN IF NOT EXISTS courier_lng DOUBLE PRECISION",
        "ALTER TABLE pedidos_app ADD COLUMN IF NOT EXISTS last_location_at TIMESTAMP",
    ]

    with engine.begin() as conn:
        for statement in statements:
            conn.execute(text(statement))


def init_db(retries: int = 20, delay_seconds: int = 2) -> None:
    for attempt in range(1, retries + 1):
        try:
            with engine.connect() as conn:
                conn.execute(text('SELECT 1'))
            Base.metadata.create_all(bind=engine)
            ensure_pedidos_app_schema()
            seed_orders()
            return
        except OperationalError:
            if attempt == retries:
                raise
            time.sleep(delay_seconds)


def get_session() -> Generator:
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
