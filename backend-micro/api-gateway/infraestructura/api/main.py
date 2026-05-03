import asyncio
import os
from urllib.parse import urlencode

import httpx
from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException, Request, Response, status
from fastapi.middleware.cors import CORSMiddleware


load_dotenv()

ALL_METHODS = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS', 'HEAD']
HOP_BY_HOP_HEADERS = {
    'connection',
    'keep-alive',
    'proxy-authenticate',
    'proxy-authorization',
    'te',
    'trailers',
    'transfer-encoding',
    'upgrade',
    'host',
    'content-length',
}


def strip_trailing_slash(value: str) -> str:
    return str(value or '').rstrip('/')


SERVICE_MAP = {
    'clientes': strip_trailing_slash(os.getenv('CLIENTES_SERVICE_URL', 'http://127.0.0.1:8001')),
    'pedidos': strip_trailing_slash(os.getenv('PEDIDOS_SERVICE_URL', 'http://127.0.0.1:8002')),
    'repartidores': strip_trailing_slash(os.getenv('REPARTIDORES_SERVICE_URL', 'http://127.0.0.1:8003')),
    'vendedores': strip_trailing_slash(os.getenv('VENDEDORES_SERVICE_URL', 'http://127.0.0.1:8004')),
    'productos': strip_trailing_slash(os.getenv('PRODUCTOS_SERVICE_URL', 'http://127.0.0.1:8005')),
}

HTTP_TIMEOUT_SECONDS = float(os.getenv('HTTP_TIMEOUT_SECONDS', '30'))

app = FastAPI(title='API Gateway MercadoLocal', version='1.0.0')

raw_origins = os.getenv('ALLOWED_ORIGINS', '*').strip()
allow_all_origins = raw_origins in {'', '*'}
allowed_origins = ['*'] if allow_all_origins else [item.strip() for item in raw_origins.split(',') if item.strip()]

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=not allow_all_origins,
    allow_methods=['*'],
    allow_headers=['*'],
)


def build_target_url(service: str, path: str, query_params: list[tuple[str, str]]) -> str:
    base_url = SERVICE_MAP.get(service)
    if not base_url:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f'Servicio no soportado: {service}')
    suffix = f'/{path.lstrip("/")}' if path else ''
    query = urlencode(query_params, doseq=True)
    if query:
        return f'{base_url}{suffix}?{query}'
    return f'{base_url}{suffix}'


def filter_request_headers(headers: Request) -> dict:
    forwarded = {}
    for key, value in headers.headers.items():
        if key.lower() in HOP_BY_HOP_HEADERS:
            continue
        forwarded[key] = value
    return forwarded


def filter_response_headers(headers: httpx.Headers) -> dict:
    safe = {}
    for key, value in headers.items():
        if key.lower() in HOP_BY_HOP_HEADERS:
            continue
        safe[key] = value
    return safe


async def proxy_request(service: str, path: str, request: Request) -> Response:
    target_url = build_target_url(service, path, list(request.query_params.multi_items()))
    body = await request.body()
    headers = filter_request_headers(request)

    timeout = httpx.Timeout(HTTP_TIMEOUT_SECONDS)
    async with httpx.AsyncClient(timeout=timeout) as client:
        try:
            upstream = await client.request(
                method=request.method.upper(),
                url=target_url,
                content=body,
                headers=headers,
            )
        except httpx.TimeoutException as exc:
            raise HTTPException(
                status_code=status.HTTP_504_GATEWAY_TIMEOUT,
                detail=f'Timeout llamando a {service}',
            ) from exc
        except httpx.HTTPError as exc:
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail=f'No se pudo conectar con {service}',
            ) from exc

    return Response(
        content=upstream.content,
        status_code=upstream.status_code,
        headers=filter_response_headers(upstream.headers),
    )


@app.get('/')
def root():
    return {'service': 'api-gateway', 'status': 'ok', 'port': 8010}


@app.get('/health')
async def health():
    timeout = httpx.Timeout(5.0)

    async def check(service: str, base_url: str) -> tuple[str, dict]:
        url = f'{base_url}/health'
        async with httpx.AsyncClient(timeout=timeout) as client:
            try:
                resp = await client.get(url)
                payload = resp.json() if resp.headers.get('content-type', '').startswith('application/json') else {}
                return service, {'ok': resp.status_code == 200, 'status_code': resp.status_code, 'payload': payload}
            except Exception as exc:
                return service, {'ok': False, 'error': str(exc)}

    results = await asyncio.gather(*[check(name, url) for name, url in SERVICE_MAP.items()])
    services = {name: data for name, data in results}
    all_ok = all(item.get('ok') for item in services.values())
    return {'ok': all_ok, 'service': 'api-gateway', 'services': services}


@app.api_route('/api/{service}', methods=ALL_METHODS)
async def proxy_service_root(service: str, request: Request):
    return await proxy_request(service, '', request)


@app.api_route('/api/{service}/{path:path}', methods=ALL_METHODS)
async def proxy_service_path(service: str, path: str, request: Request):
    return await proxy_request(service, path, request)
