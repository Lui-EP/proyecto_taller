import os

import requests
from dotenv import load_dotenv


load_dotenv()

CLIENTES_SERVICE_URL = os.getenv('CLIENTES_SERVICE_URL', '').strip()
if not CLIENTES_SERVICE_URL:
    raise RuntimeError('Falta CLIENTES_SERVICE_URL en el entorno de pedidos-service')


def validar_cliente_existente(cliente_id: int):
    url = f'{CLIENTES_SERVICE_URL}/clientes/{cliente_id}'

    try:
        response = requests.get(url, timeout=4)
    except requests.RequestException as exc:
        return False, f'No se pudo validar cliente por HTTP: {exc}'

    if response.status_code == 200:
        return True, None
    if response.status_code == 404:
        return False, 'El cliente_id no existe en el microservicio de clientes.'

    return False, f'Respuesta inesperada del microservicio de clientes: {response.status_code}'
