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
