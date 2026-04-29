from infraestructura.adapters.clientes_http import validar_cliente_existente
from infraestructura.adapters.db import Pedido
from infraestructura.adapters.rabbit import PEDIDOS_QUEUE, publish_event


def crear_pedido(db, cliente_id: int, descripcion: str, total: float, direccion_entrega: str):
    existe_cliente, validation_error = validar_cliente_existente(cliente_id)
    if not existe_cliente:
        return {
            'ok': False,
            'status_code': 400,
            'message': validation_error,
        }

    pedido = Pedido(
        cliente_id=cliente_id,
        descripcion=descripcion.strip(),
        total=total,
        estado='pedido_realizado',
        direccion_entrega=direccion_entrega.strip(),
    )
    db.add(pedido)

    try:
        db.commit()
        db.refresh(pedido)
    except Exception as exc:
        db.rollback()
        return {
            'ok': False,
            'status_code': 500,
            'message': f'Error al guardar pedido: {exc}',
        }

    payload = {
        'event': 'pedido_creado',
        'pedido_id': pedido.pedido_id,
        'cliente_id': pedido.cliente_id,
        'descripcion': pedido.descripcion,
        'total': pedido.total,
        'estado': pedido.estado,
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
