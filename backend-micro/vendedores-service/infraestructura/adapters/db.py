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
    'dbname': os.getenv('POSTGRES_DB', 'bd_vendedores_ms'),
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


class Vendedor(Base):
    __tablename__ = 'vendedores'

    vendedor_id = Column(String(60), primary_key=True)
    nombre = Column(String(120), nullable=False)
    email = Column(String(180), nullable=False, unique=True, index=True)
    telefono = Column(String(40), nullable=True)
    ubicacion = Column(String(255), nullable=True)
    curp = Column(String(40), nullable=True)
    negocio = Column(String(160), nullable=False)
    descripcion = Column(Text, nullable=True)
    horario = Column(String(120), nullable=True)
    verificado = Column(Boolean, nullable=False, default=True)
    rating = Column(Float, nullable=False, default=5)
    total_productos = Column(Integer, nullable=False, default=0)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, nullable=False)


SEED_VENDEDORES = [
    {
        'vendedor_id': 'vendedor-1',
        'nombre': 'Artesana Luna',
        'email': 'vendedor@mercadolocal.mx',
        'telefono': '9611111111',
        'ubicacion': 'Tuxtla Gutierrez, Chiapas',
        'curp': '',
        'negocio': 'Artesana Luna',
        'descripcion': 'Productos artesanales hechos a mano',
        'horario': 'Lun-Vie 9:00-18:00',
        'verificado': True,
        'rating': 5,
        'total_productos': 10,
    },
]


def seed_vendedores() -> None:
    db = SessionLocal()
    try:
        for payload in SEED_VENDEDORES:
            row = db.get(Vendedor, payload['vendedor_id'])
            if not row:
                row = db.query(Vendedor).filter(Vendedor.email == payload['email']).first()
            if row:
                for key, value in payload.items():
                    setattr(row, key, value)
                row.updated_at = datetime.utcnow()
            else:
                db.add(Vendedor(**payload, created_at=datetime.utcnow(), updated_at=datetime.utcnow()))
        db.commit()
    finally:
        db.close()


def init_db(retries: int = 20, delay_seconds: int = 2) -> None:
    for attempt in range(1, retries + 1):
        try:
            with engine.connect() as conn:
                conn.execute(text('SELECT 1'))
            Base.metadata.create_all(bind=engine)
            seed_vendedores()
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



