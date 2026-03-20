#!/bin/bash
set -e

#=============================================================================
# PIOLI DB - Deploy / Redeploy Script
# Uso:
#   ./deploy.sh              # Deploy completo (primeira vez)
#   ./deploy.sh update       # Redeploy (atualiza imagem e servico)
#   ./deploy.sh seed         # Importa dados iniciais do XML
#   ./deploy.sh logs         # Ver logs do servico
#   ./deploy.sh status       # Status do servico
#   ./deploy.sh backup       # Backup do banco de dados
#   ./deploy.sh destroy      # Remove tudo (CUIDADO!)
#=============================================================================

STACK_NAME="pioli"
IMAGE_NAME="bancodedadospioli:latest"
DB_NAME="bancodedadospioli"
DB_CONTAINER_FILTER="name=postgres_postgres"
DOMAIN="pioli.talkhub.me"
DATA_XML="data/planos.xml"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

log() { echo -e "${GREEN}[PIOLI]${NC} $1"; }
warn() { echo -e "${YELLOW}[PIOLI]${NC} $1"; }
err() { echo -e "${RED}[PIOLI]${NC} $1"; }

#--- Verifica pre-requisitos ---
check_prereqs() {
  if ! command -v docker &> /dev/null; then
    err "Docker nao encontrado. Instale o Docker primeiro."
    exit 1
  fi
  if ! docker network ls | grep -q talkhub; then
    err "Rede 'talkhub' nao encontrada. Verifique sua configuracao do Traefik."
    exit 1
  fi
}

#--- Cria o banco de dados no PostgreSQL existente ---
create_database() {
  log "Verificando banco de dados..."
  local PG_CONTAINER=$(docker ps -q -f "${DB_CONTAINER_FILTER}" 2>/dev/null | head -1)

  if [ -z "$PG_CONTAINER" ]; then
    err "Container PostgreSQL nao encontrado (filtro: ${DB_CONTAINER_FILTER})"
    err "Ajuste DB_CONTAINER_FILTER no script se necessario."
    exit 1
  fi

  # Check if DB exists
  local DB_EXISTS=$(docker exec "$PG_CONTAINER" psql -U postgres -tAc "SELECT 1 FROM pg_database WHERE datname='${DB_NAME}'" 2>/dev/null)

  if [ "$DB_EXISTS" = "1" ]; then
    log "Banco '${DB_NAME}' ja existe."
  else
    log "Criando banco '${DB_NAME}'..."
    docker exec "$PG_CONTAINER" psql -U postgres -c "CREATE DATABASE ${DB_NAME};" 2>/dev/null
    log "Banco criado com sucesso!"
  fi
}

#--- Build da imagem Docker ---
build_image() {
  log "Construindo imagem Docker..."
  docker build -t "${IMAGE_NAME}" . --no-cache
  log "Imagem construida: ${IMAGE_NAME}"
}

#--- Deploy/Redeploy do stack ---
deploy_stack() {
  log "Fazendo deploy do stack '${STACK_NAME}'..."
  docker stack deploy -c docker-compose.yaml "${STACK_NAME}"
  log "Stack deployado! Aguardando servico iniciar..."

  # Espera o servico ficar saudavel
  local retries=0
  local max_retries=30
  while [ $retries -lt $max_retries ]; do
    sleep 2
    local STATUS=$(docker service ls --filter "name=${STACK_NAME}_pioli" --format "{{.Replicas}}" 2>/dev/null)
    if [ "$STATUS" = "1/1" ]; then
      log "Servico iniciado com sucesso!"
      log "Frontend: https://${DOMAIN}"
      log "API: https://${DOMAIN}/api"
      log "Health: https://${DOMAIN}/api/health"
      return 0
    fi
    retries=$((retries + 1))
    echo -n "."
  done
  echo ""
  warn "Servico pode ainda estar iniciando. Verifique com: ./deploy.sh status"
}

#--- Seed dos dados iniciais ---
seed_data() {
  log "Importando dados iniciais..."

  if [ ! -f "${DATA_XML}" ]; then
    warn "Arquivo ${DATA_XML} nao encontrado."
    warn "Gerando XML a partir do Excel..."
    npm run convert-xlsx 2>/dev/null || {
      err "Falha ao converter XLSX. Certifique-se que as dependencias estao instaladas (npm install)"
      exit 1
    }
  fi

  if [ ! -f "${DATA_XML}" ]; then
    err "XML nao encontrado apos conversao."
    exit 1
  fi

  # Aguarda o servico estar pronto
  local retries=0
  while [ $retries -lt 15 ]; do
    if curl -sf "https://${DOMAIN}/api/health" > /dev/null 2>&1; then
      break
    fi
    sleep 2
    retries=$((retries + 1))
  done

  log "Enviando XML para importacao..."
  local API_KEY=$(grep -oP "API_KEY=\K.*" docker-compose.yaml 2>/dev/null | head -1 || echo "")

  local CURL_ARGS=(-s -X POST -F "file=@${DATA_XML}" "https://${DOMAIN}/api/xml/import")
  if [ -n "$API_KEY" ]; then
    CURL_ARGS+=(-H "x-api-key: ${API_KEY}")
  fi

  local RESULT=$(curl "${CURL_ARGS[@]}" 2>/dev/null)
  echo "$RESULT" | python3 -m json.tool 2>/dev/null || echo "$RESULT"
  log "Importacao concluida!"
}

#--- Ver logs ---
show_logs() {
  log "Logs do servico ${STACK_NAME}_pioli:"
  docker service logs "${STACK_NAME}_pioli" --tail 100 -f
}

#--- Status ---
show_status() {
  log "Status do stack ${STACK_NAME}:"
  echo ""
  docker service ls --filter "name=${STACK_NAME}"
  echo ""
  docker service ps "${STACK_NAME}_pioli" --no-trunc 2>/dev/null
  echo ""

  log "Health check:"
  curl -sf "https://${DOMAIN}/api/health" 2>/dev/null | python3 -m json.tool 2>/dev/null || {
    warn "Servico nao respondeu ao health check"
  }
}

#--- Backup ---
backup_db() {
  local PG_CONTAINER=$(docker ps -q -f "${DB_CONTAINER_FILTER}" 2>/dev/null | head -1)
  if [ -z "$PG_CONTAINER" ]; then
    err "Container PostgreSQL nao encontrado."
    exit 1
  fi

  local BACKUP_FILE="backup_${DB_NAME}_$(date +%Y%m%d_%H%M%S).sql"
  log "Fazendo backup do banco '${DB_NAME}' para ${BACKUP_FILE}..."
  docker exec "$PG_CONTAINER" pg_dump -U postgres "${DB_NAME}" > "${BACKUP_FILE}"
  log "Backup salvo: ${BACKUP_FILE} ($(du -h ${BACKUP_FILE} | cut -f1))"
}

#--- Destroy ---
destroy() {
  warn "ATENCAO: Isso vai remover o stack e todos os dados!"
  read -p "Tem certeza? (digite 'sim' para confirmar): " confirm
  if [ "$confirm" != "sim" ]; then
    log "Cancelado."
    exit 0
  fi

  log "Removendo stack ${STACK_NAME}..."
  docker stack rm "${STACK_NAME}" 2>/dev/null
  log "Stack removido."

  read -p "Deseja tambem apagar o banco de dados? (s/N): " drop_db
  if [ "$drop_db" = "s" ] || [ "$drop_db" = "S" ]; then
    local PG_CONTAINER=$(docker ps -q -f "${DB_CONTAINER_FILTER}" 2>/dev/null | head -1)
    if [ -n "$PG_CONTAINER" ]; then
      docker exec "$PG_CONTAINER" psql -U postgres -c "DROP DATABASE IF EXISTS ${DB_NAME};" 2>/dev/null
      log "Banco apagado."
    fi
  fi
}

#--- Update/Redeploy ---
update() {
  log "=== REDEPLOY: Atualizando servico ==="
  build_image

  log "Atualizando servico com nova imagem..."
  docker service update --image "${IMAGE_NAME}" --force "${STACK_NAME}_pioli" 2>/dev/null || {
    warn "Service update falhou, tentando redeploy completo..."
    deploy_stack
  }
  log "Redeploy concluido!"
  show_status
}

#=============================================================================
# MAIN
#=============================================================================

check_prereqs

case "${1:-deploy}" in
  deploy)
    log "=== DEPLOY COMPLETO ==="
    create_database
    build_image
    deploy_stack
    echo ""
    log "Deploy concluido! Para importar dados iniciais execute:"
    log "  ./deploy.sh seed"
    ;;
  update|redeploy)
    update
    ;;
  seed)
    seed_data
    ;;
  logs)
    show_logs
    ;;
  status)
    show_status
    ;;
  backup)
    backup_db
    ;;
  destroy)
    destroy
    ;;
  build)
    build_image
    ;;
  *)
    echo "Uso: $0 {deploy|update|seed|logs|status|backup|destroy|build}"
    echo ""
    echo "  deploy   - Deploy completo (primeira vez)"
    echo "  update   - Redeploy com nova imagem"
    echo "  seed     - Importar dados iniciais do XML"
    echo "  logs     - Ver logs do servico"
    echo "  status   - Status do servico"
    echo "  backup   - Backup do banco de dados"
    echo "  destroy  - Remover tudo (CUIDADO!)"
    echo "  build    - Apenas build da imagem"
    ;;
esac
