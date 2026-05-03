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
    'dbname': os.getenv('POSTGRES_DB', 'bd_productos_ms'),
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


pg_sslmode = os.getenv('POSTGRES_SSLMODE', 'disable').strip().lower()
if pg_sslmode and pg_sslmode != 'disable':
    DATABASE_URL = '{}?sslmode={}'.format(DATABASE_URL, pg_sslmode)

engine = create_engine(DATABASE_URL, pool_pre_ping=True)
SessionLocal = sessionmaker(bind=engine, autocommit=False, autoflush=False)
Base = declarative_base()


class Categoria(Base):
    __tablename__ = 'categorias'

    categoria_id = Column(String(60), primary_key=True)
    nombre = Column(String(120), nullable=False)
    descripcion = Column(Text, nullable=True)
    status = Column(String(40), nullable=False, default='approved')
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)


class Producto(Base):
    __tablename__ = 'productos'

    producto_id = Column(String(60), primary_key=True)
    seller_id = Column(String(60), nullable=False, index=True)
    seller_name = Column(String(120), nullable=False)
    nombre = Column(String(180), nullable=False)
    categoria = Column(String(60), nullable=False)
    categoria_label = Column(String(80), nullable=False)
    precio = Column(Float, nullable=False)
    stock = Column(Integer, nullable=False, default=0)
    descripcion = Column(Text, nullable=False)
    featured = Column(Boolean, nullable=False, default=False)
    local = Column(Boolean, nullable=False, default=True)
    verified = Column(Boolean, nullable=False, default=True)
    rating = Column(Float, nullable=False, default=5)
    views = Column(Integer, nullable=False, default=0)
    image_key = Column(String(80), nullable=True)
    image_data = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, nullable=False)


CATEGORIAS_SEED = [
    {'categoria_id': 'artesanias', 'nombre': 'Artesanias', 'descripcion': 'Productos artesanales', 'status': 'approved'},
    {'categoria_id': 'alimentos', 'nombre': 'Alimentos', 'descripcion': 'Comida local', 'status': 'approved'},
    {'categoria_id': 'textiles', 'nombre': 'Textiles', 'descripcion': 'Ropa y tejidos', 'status': 'approved'},
    {'categoria_id': 'joyeria', 'nombre': 'Joyeria', 'descripcion': 'Accesorios y joyeria', 'status': 'approved'},
]

PRODUCTOS_SEED = [
    {'producto_id': 'p-1', 'seller_id': 'vendedor-1', 'seller_name': 'Artesana Luna', 'nombre': 'Canastas de palma', 'categoria': 'artesanias', 'categoria_label': 'Artesanias', 'precio': 450, 'stock': 18, 'descripcion': 'Canastas tejidas a mano para cocina, regalo o decoracion.', 'featured': True, 'local': True, 'verified': True, 'rating': 5, 'views': 18, 'image_key': 'canastas'},
    {'producto_id': 'p-2', 'seller_id': 'vendedor-1', 'seller_name': 'Artesana Luna', 'nombre': 'Miel organica', 'categoria': 'alimentos', 'categoria_label': 'Alimentos', 'precio': 220, 'stock': 8, 'descripcion': 'Miel local en frasco artesanal.', 'featured': False, 'local': True, 'verified': True, 'rating': 5, 'views': 11, 'image_key': 'miel'},
    {'producto_id': 'p-3', 'seller_id': 'vendedor-1', 'seller_name': 'Artesana Luna', 'nombre': 'Bolsa textil', 'categoria': 'textiles', 'categoria_label': 'Textiles', 'precio': 380, 'stock': 4, 'descripcion': 'Bolsa artesanal colorida.', 'featured': False, 'local': True, 'verified': True, 'rating': 5, 'views': 32, 'image_key': 'bolsa'},
]


def seed_data() -> None:
    db = SessionLocal()
    try:
        if db.query(Categoria).count() == 0:
            for payload in CATEGORIAS_SEED:
                db.add(Categoria(**payload, created_at=datetime.utcnow()))
        if db.query(Producto).count() == 0:
            for payload in PRODUCTOS_SEED:
                db.add(Producto(**payload, created_at=datetime.utcnow(), updated_at=datetime.utcnow()))
        db.commit()
    finally:
        db.close()


def init_db(retries: int = 20, delay_seconds: int = 2) -> None:
    for attempt in range(1, retries + 1):
        try:
            with engine.connect() as conn:
                conn.execute(text('SELECT 1'))
            Base.metadata.create_all(bind=engine)
            seed_data()
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



