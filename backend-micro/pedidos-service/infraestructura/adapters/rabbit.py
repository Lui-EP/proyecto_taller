import json
import os

import pika
from dotenv import load_dotenv


load_dotenv()


def _as_bool(value: str | None, default: bool = False) -> bool:
    if value is None:
        return default
    return str(value).strip().lower() in {'1', 'true', 'yes', 'si', 'on'}


RABBIT_HOST = os.getenv('RABBIT_HOST', 'localhost')
RABBIT_PORT = int(os.getenv('RABBIT_PORT', '5672'))
RABBIT_USER = os.getenv('RABBIT_USER', 'guest')
RABBIT_PASSWORD = os.getenv('RABBIT_PASSWORD', 'guest')
PEDIDOS_QUEUE = os.getenv('PEDIDOS_EVENTS_QUEUE', 'PEDIDOS_EVENTS')
ENABLE_RABBIT = _as_bool(os.getenv('ENABLE_RABBIT'), default=False)


def publish_event(queue_name: str, payload: dict):
    if not ENABLE_RABBIT:
        return False, 'RabbitMQ desactivado por configuración (ENABLE_RABBIT=false)'

    credentials = pika.PlainCredentials(RABBIT_USER, RABBIT_PASSWORD)
    params = pika.ConnectionParameters(
        host=RABBIT_HOST,
        port=RABBIT_PORT,
        credentials=credentials,
        blocked_connection_timeout=5,
    )

    try:
        connection = pika.BlockingConnection(params)
        channel = connection.channel()
        channel.queue_declare(queue=queue_name, durable=True)
        channel.basic_publish(
            exchange='',
            routing_key=queue_name,
            body=json.dumps(payload).encode('utf-8'),
            properties=pika.BasicProperties(delivery_mode=2),
        )
        connection.close()
        return True, None
    except Exception as exc:
        return False, str(exc)
