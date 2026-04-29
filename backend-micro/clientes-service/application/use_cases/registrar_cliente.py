from sqlalchemy.exc import IntegrityError

from infraestructura.adapters.db import Cliente
from infraestructura.adapters.rabbit import CLIENTES_QUEUE, publish_event


def registrar_cliente(db, nombre: str, email: str, telefono: str | None = None, direccion: str | None = None):
    cliente = Cliente(
        nombre=nombre.strip(),
        email=email.strip().lower(),
        telefono=(telefono or '').strip() or None,
        direccion=(direccion or '').strip() or None,
    )
    db.add(cliente)

    try:
        db.commit()
        db.refresh(cliente)
    except IntegrityError:
        db.rollback()
        return {
            'ok': False,
            'status_code': 409,
            'message': 'Ya existe un cliente con ese email.',
        }
    except Exception as exc:
        db.rollback()
        return {
            'ok': False,
            'status_code': 500,
            'message': f'Error al guardar cliente: {exc}',
        }

    payload = {
        'event': 'cliente_registrado',
        'cliente_id': cliente.cliente_id,
        'nombre': cliente.nombre,
        'email': cliente.email,
    }
    sent, event_error = publish_event(CLIENTES_QUEUE, payload)

    return {
        'ok': True,
        'cliente': {
            'cliente_id': cliente.cliente_id,
            'nombre': cliente.nombre,
            'email': cliente.email,
            'telefono': cliente.telefono,
            'direccion': cliente.direccion,
            'created_at': cliente.created_at,
        },
        'event_sent': sent,
        'event_error': event_error,
    }
