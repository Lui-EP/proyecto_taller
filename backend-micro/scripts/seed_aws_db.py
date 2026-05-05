import os
import sys

# Forzar conexion a la base de datos remota
os.environ['POSTGRES_HOST'] = '127.0.0.1' # o tu IP de AWS si corres esto sin port-forwarding
os.environ['POSTGRES_PORT'] = '5433'
os.environ['POSTGRES_PASSWORD'] = 'pERSONAL04'

# Agregar el root al sys.path para poder importar
import os
import sys
import importlib

# Forzar conexion a la base de datos remota
os.environ['POSTGRES_HOST'] = '<IP_DE_AWS>' # Cambia esto por la IP de AWS
os.environ['POSTGRES_PORT'] = '5433'
os.environ['POSTGRES_PASSWORD'] = 'pERSONAL04'

sys.path.append(os.path.join(os.path.dirname(__file__), '..', 'clientes-service'))
sys.path.append(os.path.join(os.path.dirname(__file__), '..', 'pedidos-service'))
sys.path.append(os.path.join(os.path.dirname(__file__), '..', 'repartidores-service'))
sys.path.append(os.path.join(os.path.dirname(__file__), '..', 'vendedores-service'))
sys.path.append(os.path.join(os.path.dirname(__file__), '..', 'productos-service'))

print("Conectando a AWS en el puerto 5433 para poblar bases de datos...")

servicios = [
    ('bd_clientes_ms', 'clientes-service'),
    ('bd_pedidos_ms', 'pedidos-service'),
    ('bd_repartidores_ms', 'repartidores-service'),
    ('bd_vendedores_ms', 'vendedores-service'),
    ('bd_productos_ms', 'productos-service'),
]

for db_name, folder in servicios:
    try:
        os.environ['POSTGRES_DB'] = db_name
        # Como las carpetas tienen guion, importamos el modulo asi:
        sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', folder))
        db_module = importlib.import_module('infraestructura.adapters.db')
        db_module.init_db()
        sys.path.pop(0)
        print(f"✅ {db_name} poblada exitosamente")
    except Exception as e:
        print(f"❌ Error en {db_name}: {e}")

print("¡Proceso de Seed completado!")

