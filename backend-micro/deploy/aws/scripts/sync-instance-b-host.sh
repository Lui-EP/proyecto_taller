#!/usr/bin/env bash
set -euo pipefail

# Busca la IP privada de la Instancia B por Tag Name y actualiza /etc/hosts.
# Uso rapido:
#   INSTANCE_B_TAG_NAME="mercadolocal-instancia-b" \
#   INSTANCE_B_HOST_ALIAS="instancia-b" \
#   AWS_REGION="us-east-1" \
#   ./sync-instance-b-host.sh

INSTANCE_B_TAG_NAME="${INSTANCE_B_TAG_NAME:-mercadolocal-instancia-b}"
INSTANCE_B_HOST_ALIAS="${INSTANCE_B_HOST_ALIAS:-instancia-b}"
AWS_REGION="${AWS_REGION:-}"
AWS_PROFILE="${AWS_PROFILE:-default}"
ENV_OUTPUT_FILE="${ENV_OUTPUT_FILE:-/home/ubuntu/proyecto_taller/backend-micro/deploy/aws/instances.env}"
COMPOSE_DIR="${COMPOSE_DIR:-/home/ubuntu/proyecto_taller/backend-micro/deploy/aws}"
COMPOSE_FILE="${COMPOSE_FILE:-docker-compose.instance-a.yml}"
COMPOSE_ENV_FILE="${COMPOSE_ENV_FILE:-instances.env}"
RESTART_ALWAYS="${RESTART_ALWAYS:-false}"

run_privileged() {
  if [[ "${EUID}" -eq 0 ]]; then
    "$@"
  else
    sudo "$@"
  fi
}

if ! command -v aws >/dev/null 2>&1; then
  echo "ERROR: aws CLI no esta instalado o no esta en PATH." >&2
  exit 1
fi

if [[ -z "${AWS_REGION}" ]]; then
  # Fallback de region via IMDS (EC2)
  AWS_REGION="$(curl -s --max-time 2 http://169.254.169.254/latest/dynamic/instance-identity/document \
    | grep -o '"region"[[:space:]]*:[[:space:]]*"[^"]*"' \
    | sed -E 's/.*"region"[[:space:]]*:[[:space:]]*"([^"]+)".*/\1/' || true)"
fi

if [[ -z "${AWS_REGION}" ]]; then
  echo "ERROR: No se pudo resolver AWS_REGION. Exportalo manualmente." >&2
  exit 1
fi

echo "Buscando Instancia B con Tag Name='${INSTANCE_B_TAG_NAME}' en region '${AWS_REGION}'..."
INSTANCE_B_IP="$(aws ec2 describe-instances \
  --region "${AWS_REGION}" \
  --profile "${AWS_PROFILE}" \
  --filters "Name=tag:Name,Values=${INSTANCE_B_TAG_NAME}" "Name=instance-state-name,Values=running" \
  --query "Reservations[].Instances[].PrivateIpAddress" \
  --output text | awk 'NF {print $1; exit}')"

if [[ -z "${INSTANCE_B_IP}" || "${INSTANCE_B_IP}" == "None" ]]; then
  echo "ERROR: No se encontro una IP privada para la Instancia B (running)." >&2
  exit 1
fi

echo "Instancia B detectada: ${INSTANCE_B_IP}"

# Lee IP previa para detectar cambios.
PREVIOUS_IP=""
if grep -qE "[[:space:]]${INSTANCE_B_HOST_ALIAS}([[:space:]]|\$)" /etc/hosts; then
  PREVIOUS_IP="$(grep -E "[[:space:]]${INSTANCE_B_HOST_ALIAS}([[:space:]]|\$)" /etc/hosts | awk '{print $1}' | tail -n1)"
fi

# Limpia entradas anteriores del alias en /etc/hosts y agrega la actual.
run_privileged sed -i.bak -E "/[[:space:]]${INSTANCE_B_HOST_ALIAS}([[:space:]]|\$)/d" /etc/hosts
echo "${INSTANCE_B_IP} ${INSTANCE_B_HOST_ALIAS}" | run_privileged tee -a /etc/hosts >/dev/null

echo "Actualizado /etc/hosts -> ${INSTANCE_B_IP} ${INSTANCE_B_HOST_ALIAS}"

# Opcional: sincroniza archivo de variables para docker compose.
mkdir -p "$(dirname "${ENV_OUTPUT_FILE}")"
if [[ ! -f "${ENV_OUTPUT_FILE}" ]]; then
  touch "${ENV_OUTPUT_FILE}"
fi
sed -i.bak -E '/^INSTANCE_B_IP=/d' "${ENV_OUTPUT_FILE}"
echo "INSTANCE_B_IP=${INSTANCE_B_IP}" >> "${ENV_OUTPUT_FILE}"
echo "Actualizado ${ENV_OUTPUT_FILE} con INSTANCE_B_IP=${INSTANCE_B_IP}"

IP_CHANGED="false"
if [[ "${PREVIOUS_IP}" != "${INSTANCE_B_IP}" ]]; then
  IP_CHANGED="true"
fi

if [[ "${IP_CHANGED}" == "true" || "${RESTART_ALWAYS}" == "true" ]]; then
  echo "Reiniciando Nginx..."
  run_privileged systemctl restart nginx

  echo "Reiniciando Docker Compose (${COMPOSE_FILE})..."
  if [[ ! -d "${COMPOSE_DIR}" ]]; then
    echo "ERROR: COMPOSE_DIR no existe: ${COMPOSE_DIR}" >&2
    exit 1
  fi
  (
    cd "${COMPOSE_DIR}"
    run_privileged docker compose --env-file "${COMPOSE_ENV_FILE}" -f "${COMPOSE_FILE}" up -d
  )
  echo "Reinicio aplicado (IP_CHANGED=${IP_CHANGED}, RESTART_ALWAYS=${RESTART_ALWAYS})."
else
  echo "IP sin cambios (${INSTANCE_B_IP}). No se reinicia Nginx ni Docker Compose."
fi

echo "Listo."
