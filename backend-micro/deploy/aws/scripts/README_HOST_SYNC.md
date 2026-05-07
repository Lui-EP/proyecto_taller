# Sync automatico de Instancia B en /etc/hosts

## 1) Dar permisos al script

```bash
cd ~/proyecto_taller/backend-micro/deploy/aws/scripts
chmod +x sync-instance-b-host.sh
```

## 2) Probar manualmente

```bash
INSTANCE_B_TAG_NAME="mercadolocal-instancia-b" \
INSTANCE_B_HOST_ALIAS="instancia-b" \
AWS_REGION="us-east-1" \
./sync-instance-b-host.sh
```

Si quieres forzar reinicio de Nginx + Docker Compose aunque la IP no cambie:

```bash
RESTART_ALWAYS=true ./sync-instance-b-host.sh
```

Verifica:

```bash
grep instancia-b /etc/hosts
cat ~/proyecto_taller/backend-micro/deploy/aws/instances.env
```

## 3) Ejecutarlo en cada arranque (systemd)

```bash
sudo cp instance-b-host-sync.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable instance-b-host-sync.service
sudo systemctl start instance-b-host-sync.service
sudo systemctl status instance-b-host-sync.service
```

Si cambias region, tag o alias, edita el archivo:

```bash
sudo nano /etc/systemd/system/instance-b-host-sync.service
sudo systemctl daemon-reload
sudo systemctl restart instance-b-host-sync.service
```

## 4) Nginx apuntando al alias `instancia-b`

Usa esta plantilla:

`backend-micro/deploy/aws/nginx/mercado-local.conf`

Copiar y activar:

```bash
sudo cp ~/proyecto_taller/backend-micro/deploy/aws/nginx/mercado-local.conf /etc/nginx/sites-available/mercado-local.conf
sudo ln -sf /etc/nginx/sites-available/mercado-local.conf /etc/nginx/sites-enabled/mercado-local.conf
sudo nginx -t
sudo systemctl reload nginx
```
