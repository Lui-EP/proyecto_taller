import os
import time
from datetime import datetime
from typing import Generator

from dotenv import load_dotenv
from sqlalchemy import Boolean, Column, DateTime, Float, String, create_engine, text
from sqlalchemy.exc import OperationalError
from sqlalchemy.orm import declarative_base, sessionmaker

load_dotenv()

pg_config = {
    'dbname': os.getenv('POSTGRES_DB', 'bd_repartidores_ms'),
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


class Repartidor(Base):
    __tablename__ = 'repartidores'

    repartidor_id = Column(String(60), primary_key=True)
    nombre = Column(String(120), nullable=False)
    email = Column(String(180), nullable=False, unique=True, index=True)
    telefono = Column(String(40), nullable=True)
    activo = Column(Boolean, nullable=False, default=True)
    estado = Column(String(40), nullable=False, default='disponible')
    ubicacion_lat = Column(Float, nullable=True)
    ubicacion_lng = Column(Float, nullable=True)
    updated_at = Column(DateTime, default=datetime.utcnow, nullable=False)


SEED_REPARTIDORES = [
    {
        'repartidor_id': 'repartidor-1',
        'nombre': 'Repartidor Demo',
        'email': 'repartidor@mercadolocal.mx',
        'telefono': '9612222222',
        'activo': True,
        'estado': 'disponible',
        'ubicacion_lat': 16.749,
        'ubicacion_lng': -93.116,
    },
]


def seed_repartidores() -> None:
    db = SessionLocal()
    try:
        for payload in SEED_REPARTIDORES:
            repartidor = db.get(Repartidor, payload['repartidor_id'])
            if not repartidor:
                repartidor = db.query(Repartidor).filter(Repartidor.email == payload['email']).first()
            if repartidor:
                for key, value in payload.items():
                    setattr(repartidor, key, value)
                repartidor.updated_at = datetime.utcnow()
            else:
                db.add(Repartidor(**payload, updated_at=datetime.utcnow()))
        db.commit()
    finally:
        db.close()


def init_db(retries: int = 20, delay_seconds: int = 2) -> None:
    for attempt in range(1, retries + 1):
        try:
            with engine.connect() as conn:
                conn.execute(text('SELECT 1'))
            Base.metadata.create_all(bind=engine)
            seed_repartidores()
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



