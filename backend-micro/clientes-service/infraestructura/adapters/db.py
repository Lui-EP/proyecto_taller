import os
import time
from datetime import datetime
from typing import Generator

from dotenv import load_dotenv
from passlib.hash import pbkdf2_sha256
from sqlalchemy import Boolean, Column, DateTime, Float, Integer, String, Text, create_engine, text
from sqlalchemy.exc import OperationalError
from sqlalchemy.orm import declarative_base, sessionmaker


load_dotenv()

pg_config = {
    'dbname': os.getenv('POSTGRES_DB', 'bd_clientes_ms'),
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
PASSWORD_HASH_ROUNDS = int(os.getenv('PASSWORD_HASH_ROUNDS', '29000'))

PRODUCTOS_SEED = [
    {
        'producto_id': 'p-1',
        'seller_id': 'vendedor-1',
        'seller_name': 'Artesana Luna',
        'nombre': 'Canastas de palma',
        'categoria': 'artesanias',
        'categoria_label': 'Artesanías',
        'precio': 450,
        'stock': 18,
        'descripcion': 'Canastas tejidas a mano para cocina, regalo o decoración.',
        'featured': True,
        'local': True,
        'verified': True,
        'rating': 5,
        'views': 18,
        'image_key': 'canastas',
    },
    {
        'producto_id': 'p-2',
        'seller_id': 'vendedor-1',
        'seller_name': 'Artesana Luna',
        'nombre': 'Miel orgánica',
        'categoria': 'alimentos',
        'categoria_label': 'Alimentos',
        'precio': 220,
        'stock': 8,
        'descripcion': 'Miel local en frasco artesanal, ideal para desayuno y postres.',
        'featured': False,
        'local': True,
        'verified': True,
        'rating': 5,
        'views': 11,
        'image_key': 'miel',
    },
    {
        'producto_id': 'p-3',
        'seller_id': 'vendedor-1',
        'seller_name': 'Artesana Luna',
        'nombre': 'Bolsa textil',
        'categoria': 'textiles',
        'categoria_label': 'Textiles',
        'precio': 380,
        'stock': 4,
        'descripcion': 'Bolsa artesanal colorida, ligera y resistente para uso diario.',
        'featured': False,
        'local': True,
        'verified': True,
        'rating': 5,
        'views': 32,
        'image_key': 'bolsa',
    },
    {
        'producto_id': 'p-4',
        'seller_id': 'vendedor-1',
        'seller_name': 'Artesana Luna',
        'nombre': 'Café molido artesanal',
        'categoria': 'alimentos',
        'categoria_label': 'Alimentos',
        'precio': 190,
        'stock': 26,
        'descripcion': 'Café de tueste medio con aroma intenso y notas dulces.',
        'featured': True,
        'local': True,
        'verified': True,
        'rating': 5,
        'views': 29,
        'image_key': 'cafe',
    },
    {
        'producto_id': 'p-5',
        'seller_id': 'vendedor-1',
        'seller_name': 'Artesana Luna',
        'nombre': 'Jarro de barro',
        'categoria': 'artesanias',
        'categoria_label': 'Artesanías',
        'precio': 520,
        'stock': 14,
        'descripcion': 'Pieza de barro decorada a mano para servir bebidas o adornar.',
        'featured': True,
        'local': True,
        'verified': True,
        'rating': 5,
        'views': 34,
        'image_key': 'jarro',
    },
    {
        'producto_id': 'p-6',
        'seller_id': 'vendedor-1',
        'seller_name': 'Artesana Luna',
        'nombre': 'Molcajete volcánico',
        'categoria': 'artesanias',
        'categoria_label': 'Artesanías',
        'precio': 640,
        'stock': 6,
        'descripcion': 'Molcajete de piedra listo para salsas y cocina tradicional.',
        'featured': False,
        'local': True,
        'verified': True,
        'rating': 5,
        'views': 16,
        'image_key': 'molcajete',
    },
    {
        'producto_id': 'p-7',
        'seller_id': 'vendedor-1',
        'seller_name': 'Artesana Luna',
        'nombre': 'Pulsera de ámbar',
        'categoria': 'joyeria',
        'categoria_label': 'Joyería',
        'precio': 310,
        'stock': 12,
        'descripcion': 'Pulsera ajustable con cuentas de ámbar natural.',
        'featured': True,
        'local': True,
        'verified': True,
        'rating': 5,
        'views': 22,
        'image_key': 'pulsera',
    },
    {
        'producto_id': 'p-8',
        'seller_id': 'vendedor-1',
        'seller_name': 'Artesana Luna',
        'nombre': 'Rebozo de telar',
        'categoria': 'textiles',
        'categoria_label': 'Textiles',
        'precio': 760,
        'stock': 6,
        'descripcion': 'Rebozo tejido con detalle tradicional y caída suave.',
        'featured': True,
        'local': True,
        'verified': True,
        'rating': 5,
        'views': 41,
        'image_key': 'rebozo',
    },
    {
        'producto_id': 'p-9',
        'seller_id': 'vendedor-1',
        'seller_name': 'Artesana Luna',
        'nombre': 'Sombrero charro',
        'categoria': 'artesanias',
        'categoria_label': 'Artesanías',
        'precio': 480,
        'stock': 11,
        'descripcion': 'Sombrero decorativo y festivo con bordado charro.',
        'featured': True,
        'local': True,
        'verified': True,
        'rating': 5,
        'views': 15,
        'image_key': 'sombrero',
    },
    {
        'producto_id': 'p-10',
        'seller_id': 'vendedor-1',
        'seller_name': 'Artesana Luna',
        'nombre': 'Tazas de arcilla',
        'categoria': 'artesanias',
        'categoria_label': 'Artesanías',
        'precio': 340,
        'stock': 19,
        'descripcion': 'Juego de tazas pintadas a mano con inspiración tradicional.',
        'featured': True,
        'local': True,
        'verified': True,
        'rating': 5,
        'views': 23,
        'image_key': 'tazas',
    },
]

USUARIOS_APP_SEED = [
    {
        'usuario_id': 'comprador-1',
        'nombre': 'Cliente Demo',
        'email': 'cliente@mercadolocal.mx',
        'password': '123456',
        'role': 'buyer',
        'telefono': '9610000000',
        'direccion': 'Tuxtla Gutiérrez, Chiapas',
        'activo': True,
    },
    {
        'usuario_id': 'vendedor-1',
        'nombre': 'Artesana Luna',
        'email': 'vendedor@mercadolocal.mx',
        'password': '123456',
        'role': 'seller',
        'telefono': '9611111111',
        'direccion': 'Tuxtla Gutiérrez, Chiapas',
        'activo': True,
    },
    {
        'usuario_id': 'repartidor-1',
        'nombre': 'Repartidor Demo',
        'email': 'repartidor@mercadolocal.mx',
        'password': '123456',
        'role': 'courier',
        'telefono': '9612222222',
        'direccion': 'Tuxtla Gutiérrez, Chiapas',
        'activo': True,
    },
    {
        'usuario_id': 'admin-1',
        'nombre': 'Admin MercadoLocal',
        'email': 'admin@mercadolocal.mx',
        'password': '123456',
        'role': 'admin',
        'telefono': '9613333333',
        'direccion': 'Tuxtla Gutiérrez, Chiapas',
        'activo': True,
    },
]


def is_password_hashed(value: str) -> bool:
    safe = str(value or '').strip()
    return safe.startswith('$pbkdf2-sha256$')


def hash_password(plain_password: str) -> str:
    return pbkdf2_sha256.using(rounds=PASSWORD_HASH_ROUNDS).hash(str(plain_password or ''))


class Cliente(Base):
    __tablename__ = 'clientes'

    cliente_id = Column(Integer, primary_key=True, autoincrement=True)
    nombre = Column(String(120), nullable=False)
    email = Column(String(180), nullable=False, unique=True, index=True)
    telefono = Column(String(40), nullable=True)
    direccion = Column(String(255), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)


class UsuarioApp(Base):
    __tablename__ = 'usuarios_app'

    usuario_id = Column(String(40), primary_key=True)
    nombre = Column(String(120), nullable=False)
    email = Column(String(180), nullable=False, unique=True, index=True)
    password = Column(String(120), nullable=False)
    role = Column(String(40), nullable=False, index=True)
    telefono = Column(String(40), nullable=True)
    direccion = Column(String(255), nullable=True)
    activo = Column(Boolean, nullable=False, default=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)


class Producto(Base):
    __tablename__ = 'productos'

    producto_id = Column(String(40), primary_key=True)
    seller_id = Column(String(40), nullable=False, index=True)
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
    status = Column(String(40), nullable=False, default='approved')
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, nullable=False)


class Categoria(Base):
    __tablename__ = 'categorias'

    categoria_id = Column(String(60), primary_key=True)
    nombre = Column(String(120), nullable=False)
    descripcion = Column(Text, nullable=True)
    status = Column(String(40), nullable=False, default='approved')
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)


class CarritoItem(Base):
    __tablename__ = 'carrito_items'

    item_id = Column(Integer, primary_key=True, autoincrement=True)
    owner_id = Column(String(60), nullable=False, index=True)
    product_id = Column(String(60), nullable=False, index=True)
    quantity = Column(Integer, nullable=False, default=1)
    updated_at = Column(DateTime, default=datetime.utcnow, nullable=False)


class Favorito(Base):
    __tablename__ = 'favoritos'

    favorito_id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(String(60), nullable=False, index=True)
    product_id = Column(String(60), nullable=False, index=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)


class Resena(Base):
    __tablename__ = 'resenas'

    resena_id = Column(Integer, primary_key=True, autoincrement=True)
    product_id = Column(String(60), nullable=False, index=True)
    user_id = Column(String(60), nullable=False, index=True)
    user_name = Column(String(120), nullable=False)
    rating = Column(Integer, nullable=False, default=5)
    comment = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)


class Reporte(Base):
    __tablename__ = 'reportes'

    reporte_id = Column(String(60), primary_key=True)
    reporter_id = Column(String(60), nullable=False, index=True)
    reporter_name = Column(String(120), nullable=False)
    target_type = Column(String(40), nullable=False)
    target_id = Column(String(60), nullable=False)
    reason = Column(String(40), nullable=False, default='other')
    description = Column(Text, nullable=True)
    status = Column(String(40), nullable=False, default='pending')
    admin_notes = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)


class SellerProfile(Base):
    __tablename__ = 'seller_profiles'

    seller_id = Column(String(60), primary_key=True)
    business_name = Column(String(160), nullable=False, default='')
    description = Column(Text, nullable=True)
    schedule = Column(String(120), nullable=True)
    location = Column(String(255), nullable=True)
    phone = Column(String(40), nullable=True)
    curp = Column(String(40), nullable=True)
    updated_at = Column(DateTime, default=datetime.utcnow, nullable=False)


def seed_productos() -> None:
    db = SessionLocal()
    try:
        count = db.query(Producto).count()
        if count:
            return
        for payload in PRODUCTOS_SEED:
            db.add(Producto(**payload))
        db.commit()
    finally:
        db.close()


def seed_usuarios_app() -> None:
    db = SessionLocal()
    try:
        for payload in USUARIOS_APP_SEED:
            usuario = db.get(UsuarioApp, payload['usuario_id'])
            if not usuario:
                usuario = db.query(UsuarioApp).filter(UsuarioApp.email == payload['email']).first()

            if usuario:
                usuario.nombre = payload['nombre']
                usuario.email = payload['email']
                if not is_password_hashed(usuario.password):
                    usuario.password = hash_password(usuario.password)
                usuario.role = payload['role']
                usuario.telefono = payload['telefono']
                usuario.direccion = payload['direccion']
                usuario.activo = payload['activo']
            else:
                safe_payload = {**payload, 'password': hash_password(payload['password'])}
                db.add(UsuarioApp(**safe_payload))
        db.commit()
    finally:
        db.close()


def seed_categorias() -> None:
    db = SessionLocal()
    try:
        if db.query(Categoria).count():
            return
        now = datetime.utcnow()
        categories = [
            Categoria(categoria_id='artesanias', nombre='Artesanias', descripcion='Productos artesanales', status='approved', created_at=now),
            Categoria(categoria_id='alimentos', nombre='Alimentos', descripcion='Comida local', status='approved', created_at=now),
            Categoria(categoria_id='textiles', nombre='Textiles', descripcion='Ropa y tejidos', status='approved', created_at=now),
            Categoria(categoria_id='joyeria', nombre='Joyeria', descripcion='Accesorios y joyeria', status='approved', created_at=now),
        ]
        for category in categories:
            db.add(category)
        db.commit()
    finally:
        db.close()


def seed_seller_profiles() -> None:
    db = SessionLocal()
    try:
        users = db.query(UsuarioApp).filter(UsuarioApp.role == 'seller').all()
        for user in users:
            profile = db.get(SellerProfile, user.usuario_id)
            if not profile:
                db.add(SellerProfile(
                    seller_id=user.usuario_id,
                    business_name=user.nombre,
                    description='Productos artesanales hechos a mano',
                    schedule='Lun-Vie 9:00-18:00',
                    location=user.direccion or 'Chiapas, Mexico',
                    phone=user.telefono or '',
                    curp='',
                    updated_at=datetime.utcnow(),
                ))
        db.commit()
    finally:
        db.close()


def init_db(retries: int = 20, delay_seconds: int = 2) -> None:
    for attempt in range(1, retries + 1):
        try:
            with engine.connect() as conn:
                conn.execute(text('SELECT 1'))
            Base.metadata.create_all(bind=engine)
            # Ensure new columns exist in already-created databases.
            with engine.begin() as conn:
                conn.execute(text("ALTER TABLE productos ADD COLUMN IF NOT EXISTS status VARCHAR(40)"))
                conn.execute(text("UPDATE productos SET status = 'approved' WHERE status IS NULL OR TRIM(status) = ''"))
            seed_productos()
            seed_usuarios_app()
            seed_categorias()
            seed_seller_profiles()
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





