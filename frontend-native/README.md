# Frontend Movil (React Native + Expo)

Aplicacion movil nativa de MercadoLocal.

Modo actual: **remoto estricto**.  
No hay fallback de datos locales para autenticacion, catalogo, carrito o pedidos.

## 1) Requisitos

- Node.js 20+
- npm 10+
- Expo Go en tu celular (si usaras QR)
- Backend micro corriendo y accesible por red local

## 2) Instalacion

```bash
cd frontend-native
npm install
```

## 3) Configurar `.env.local` (obligatorio)

Crea `frontend-native/.env.local` con la IP de tu laptop:

```env
EXPO_PUBLIC_CLIENTES_API_URL=http://192.168.1.88:8001
EXPO_PUBLIC_PEDIDOS_API_URL=http://192.168.1.88:8002
EXPO_PUBLIC_LOCATIONIQ_API_KEY=pk.tu_api_publica_aqui
```

Si ya usas backend en AWS, puedes dejarlo directo asi:

```env
EXPO_PUBLIC_CLIENTES_API_URL=https://mercado-local.ddns.net/api/clientes
EXPO_PUBLIC_PEDIDOS_API_URL=https://mercado-local.ddns.net/api/pedidos
EXPO_PUBLIC_LOCATIONIQ_API_KEY=pk.tu_api_publica_aqui
```

Importante:

- No uses `localhost` en movil.
- Debe ser la IP LAN de tu laptop.
- Celular y laptop en la misma red Wi-Fi.

## 4) Ejecutar

### QR para Expo Go (recomendado)

```bash
npm run stop
npm run qr
```

### Android (emulador/dispositivo)

```bash
npm run android
```

### Web (vista de apoyo)

```bash
npm run web
```

## 4.1) Deploy movil real (no Vercel)

La app nativa no se despliega en Vercel.
Para Android/iOS usa Expo EAS:

```bash
npm install
npx expo login
npx eas build:configure
npx eas build -p android --profile preview
```

Ya se incluye `eas.json`.

Si quieres flujo "solo AWS":
- Backend en AWS.
- Builds nativos con EAS (o CI propio).
- Publicacion por tiendas o distribucion interna (APK/AAB), no por Vercel.

## 5) Scripts utiles

- `npm start` -> inicia Expo en LAN
- `npm run qr` -> inicia Expo para escanear QR
- `npm run qr:tunnel` -> usa mismo flujo LAN (tunnel no estable en este proyecto)
- `npm run stop` -> cierra procesos Expo previos

## 6) Flujo funcional actual

- Login con backend
- Catalogo, detalle y carrito
- Checkout con direccion + mapa + sugerencias
- Seguimiento de pedido con mapa/ruta
- Historial de pedidos
- Panel vendedor (crear/editar productos)
- Panel repartidor (tomar pedido, mover estado, compartir ubicacion)
- Panel admin (usuarios, pedidos, actividad)

## 7) Usuarios de prueba (en backend)

- `admin@mercadolocal.mx` / `123456`
- `vendedor@mercadolocal.mx` / `123456`
- `cliente@mercadolocal.mx` / `123456`
- `repartidor@mercadolocal.mx` / `123456`

## 8) Validacion de conexion

Desde el navegador del celular prueba:

- `http://TU_IP_LOCAL:8001/health`
- `http://TU_IP_LOCAL:8002/health`

Si eso no abre, la app tampoco podra conectarse.

## 9) Errores comunes

1. No inicia sesion o tarda demasiado
- Normalmente el celular no alcanza `8001/8002`.
- Revisa IP en `.env.local`, firewall y WSL portproxy.

2. `Cannot read properties of undefined (reading 'body')` al usar tunnel
- Usa `npm run qr` (LAN), no tunnel.

3. `adb` no reconocido
- Falta Android SDK en PATH o abrir Android Studio para instalar platform-tools.
