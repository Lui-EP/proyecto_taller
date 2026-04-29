from dataclasses import dataclass
from datetime import datetime


@dataclass
class ClienteEntidad:
    cliente_id: int
    nombre: str
    email: str
    telefono: str | None
    direccion: str | None
    created_at: datetime
