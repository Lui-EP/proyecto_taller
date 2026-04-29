from datetime import datetime

from infraestructura.adapters.db import ESTADOS_PEDIDO, Pedido
from infraestructura.adapters.rabbit import PEDIDOS_QUEUE, publish_event


def actualizar_estado_pedido(db, pedido_id: int, estado: str, repartidor: str | None = None):
    estado_sanitizado = (estado or '').strip().lower()
    if estado_sanitizado not in ESTADOS_PEDIDO:
        return {
            'ok': False,
            'status_code': 400,
            'message': f'Estado invalido. Usa uno de: {", ".join(sorted(ESTADOS_PEDIDO))}',
        }

    pedido = db.get(Pedido, pedido_id)
    if not pedido:
        return {
            'ok': False,
            'status_code': 404,
            'message': 'Pedido no encontrado',
        }

    pedido.estado = estado_sanitizado
    if repartidor is not None:
        pedido.repartidor = (repartidor or '').strip() or None
    pedido.updated_at = datetime.utcnow()

    try:
        db.commit()
        db.refresh(pedido)
    except Exception as exc:
        db.rollback()
        return {
            'ok': False,
            'status_code': 500,
            'message': f'Error al actualizar pedido: {exc}',
        }

    payload = {
        'event': 'pedido_estado_actualizado',
        'pedido_id': pedido.pedido_id,
        'cliente_id': pedido.cliente_id,
        'estado': pedido.estado,
        'repartidor': pedido.repartidor,
    }
    sent, event_error = publish_event(PEDIDOS_QUEUE, payload)

    return {
        'ok': True,
        'pedido': {
            'pedido_id': pedido.pedido_id,
            'cliente_id': pedido.cliente_id,
            'descripcion': pedido.descripcion,
            'total': pedido.total,
            'estado': pedido.estado,
            'direccion_entrega': pedido.direccion_entrega,
            'repartidor': pedido.repartidor,
            'created_at': pedido.created_at,
            'updated_at': pedido.updated_at,
        },
        'event_sent': sent,
        'event_error': event_error,
    }
