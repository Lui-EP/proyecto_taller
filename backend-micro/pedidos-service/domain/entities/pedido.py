from dataclasses import dataclass
from datetime import datetime


@dataclass
class PedidoEntidad:
    pedido_id: int
    cliente_id: int
    descripcion: str
    total: float
    estado: str
    direccion_entrega: str
    repartidor: str | None
    created_at: datetime
