#!/bin/bash

# Gatelet — self-hosted MCP permission proxy
# Usage: curl -fsSL https://gatelet.dev/install.sh | sh
#
# Environment variables (optional):
#   GATELET_DIR       Install directory     (default: ~/.gatelet)
#   GATELET_IMAGE     Docker image          (default: ghcr.io/hannesill/gatelet:latest)
#   GATELET_ADMIN_TOKEN  Pre-set admin token (default: auto-generated)

set -e

# -- Colors ------------------------------------------------------------------
Color_Off='\033[0m'
Red='\033[0;31m'
Green='\033[0;32m'
Yellow='\033[0;33m'
Cyan='\033[0;36m'
Dim='\033[2m'

info()    { echo -e "${Cyan}[info]${Color_Off} $1"; }
warn()    { echo -e "${Yellow}[warn]${Color_Off} $1"; }
error()   { echo -e "${Red}[error]${Color_Off} $1"; exit 1; }
success() { echo -e "${Green}  ✓${Color_Off} $1"; }

# -- Defaults -----------------------------------------------------------------
GATELET_DIR="${GATELET_DIR:-$HOME/.gatelet}"
GATELET_IMAGE="${GATELET_IMAGE:-ghcr.io/hannesill/gatelet:latest}"

# -- Preflight checks ---------------------------------------------------------
info "Checking prerequisites..."

# Docker
if ! command -v docker >/dev/null 2>&1; then
  error "Docker is not installed. Install it from https://docs.docker.com/get-docker/"
fi
success "Docker found"

# Docker Compose (v2 plugin or standalone)
if docker compose version >/dev/null 2>&1; then
  COMPOSE="docker compose"
elif command -v docker-compose >/dev/null 2>&1; then
  COMPOSE="docker-compose"
else
  error "Docker Compose not found. Install it from https://docs.docker.com/compose/install/"
fi
success "Docker Compose found ($COMPOSE)"

# Docker daemon running
if ! docker info >/dev/null 2>&1; then
  error "Docker daemon is not running. Start Docker and try again."
fi
success "Docker daemon is running"

# -- Install directory --------------------------------------------------------
if [ -f "$GATELET_DIR/docker-compose.yml" ]; then
  warn "Existing installation found at $GATELET_DIR"
  printf "  Overwrite config? Existing data volume will be preserved. [y/N] "
  read -r reply
  case "$reply" in
    [yY]*) ;;
    *)
      info "Aborted. To upgrade, run: cd $GATELET_DIR && $COMPOSE pull && $COMPOSE up -d"
      exit 0
      ;;
  esac
fi

mkdir -p "$GATELET_DIR"

# -- Admin token --------------------------------------------------------------
if [ -z "$GATELET_ADMIN_TOKEN" ]; then
  if [ -f "$GATELET_DIR/.env" ]; then
    # Preserve existing token on reinstall
    EXISTING_TOKEN=$(grep '^GATELET_ADMIN_TOKEN=' "$GATELET_DIR/.env" 2>/dev/null | cut -d= -f2- || true)
  fi
  if [ -n "$EXISTING_TOKEN" ]; then
    GATELET_ADMIN_TOKEN="$EXISTING_TOKEN"
  else
    GATELET_ADMIN_TOKEN=$(openssl rand -base64 32 2>/dev/null || head -c 32 /dev/urandom | base64)
  fi
fi

# -- Write .env ---------------------------------------------------------------
cat > "$GATELET_DIR/.env" <<EOF
GATELET_ADMIN_TOKEN=$GATELET_ADMIN_TOKEN
GATELET_IMAGE=$GATELET_IMAGE
EOF
chmod 600 "$GATELET_DIR/.env"

# -- Write docker-compose.yml ------------------------------------------------
cat > "$GATELET_DIR/docker-compose.yml" <<'COMPOSE'
services:
  gatelet:
    image: ${GATELET_IMAGE:-ghcr.io/hannesill/gatelet:latest}
    ports:
      - "127.0.0.1:4001:4001"  # Admin dashboard — localhost only
    volumes:
      - gatelet-data:/data
    environment:
      - GATELET_DATA_DIR=/data
      - GATELET_ADMIN_TOKEN=${GATELET_ADMIN_TOKEN}
    networks:
      - gatelet-internal
      - gatelet-egress
    restart: unless-stopped

networks:
  gatelet-internal:
    # Agent-facing: containers on this network can reach gatelet:4000
    driver: bridge
  gatelet-egress:
    # Outbound: allows Gatelet to call external APIs
    driver: bridge

volumes:
  gatelet-data:
COMPOSE

# -- Pull & start -------------------------------------------------------------
info "Pulling $GATELET_IMAGE..."
(cd "$GATELET_DIR" && $COMPOSE pull)

info "Starting Gatelet..."
(cd "$GATELET_DIR" && $COMPOSE up -d)

# -- Done ---------------------------------------------------------------------
echo ""
success "Gatelet is running!"
echo ""
echo -e "  ${Cyan}Dashboard${Color_Off}    http://localhost:4001"
echo -e "  ${Cyan}Admin token${Color_Off}  $GATELET_ADMIN_TOKEN"
echo -e "  ${Cyan}Install dir${Color_Off}  $GATELET_DIR"
echo ""
echo -e "  ${Dim}MCP endpoint (for agents on the Docker network):${Color_Off}"
echo -e "  ${Dim}http://gatelet:4000/sse${Color_Off}"
echo ""
echo -e "  Manage:  cd $GATELET_DIR && $COMPOSE logs -f"
echo -e "  Stop:    cd $GATELET_DIR && $COMPOSE down"
echo -e "  Upgrade: cd $GATELET_DIR && $COMPOSE pull && $COMPOSE up -d"
