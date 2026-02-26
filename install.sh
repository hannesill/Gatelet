#!/bin/bash

# Gatelet — self-hosted MCP permission proxy
# Usage: curl -fsSL https://gatelet.dev/install.sh | sh
#
# Environment variables (optional):
#   GATELET_DIR       Install directory     (default: ~/.gatelet)
#   GATELET_IMAGE     Docker image          (default: ghcr.io/hannesill/gatelet:latest)
#   GATELET_ADMIN_TOKEN  Pre-set admin token (default: auto-generated)
#   GATELET_SECRETS_DIR  Secrets directory   (default: /usr/local/etc/gatelet/secrets)
#   GATELET_LOCAL        Set to 1 to skip pull and use a locally built image

set -e

# -- Colors ------------------------------------------------------------------
Color_Off='\033[0m'
Red='\033[0;31m'
Green='\033[0;32m'
Yellow='\033[0;33m'
Cyan='\033[0;36m'
Dim='\033[2m'

info()    { printf "${Cyan}[info]${Color_Off} %s\n" "$1"; }
warn()    { printf "${Yellow}[warn]${Color_Off} %s\n" "$1"; }
error()   { stty echo < /dev/tty 2>/dev/null || true; printf "${Red}[error]${Color_Off} %s\n" "$1"; exit 1; }
success() { printf "${Green}  ✓${Color_Off} %s\n" "$1"; }

# -- Defaults -----------------------------------------------------------------
GATELET_DIR="${GATELET_DIR:-$HOME/.gatelet}"
GATELET_IMAGE="${GATELET_IMAGE:-ghcr.io/hannesill/gatelet:latest}"

GATELET_SECRETS_DIR="${GATELET_SECRETS_DIR:-/usr/local/etc/gatelet/secrets}"

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
  read -r reply < /dev/tty
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
  # Check existing secrets file first, then legacy .env
  if [ -f "$GATELET_SECRETS_DIR/admin-token" ]; then
    GATELET_ADMIN_TOKEN=$(sudo cat "$GATELET_SECRETS_DIR/admin-token" 2>/dev/null || true)
  elif [ -f "$GATELET_DIR/.env" ]; then
    EXISTING_TOKEN=$(grep '^GATELET_ADMIN_TOKEN=' "$GATELET_DIR/.env" 2>/dev/null | cut -d= -f2- || true)
    GATELET_ADMIN_TOKEN="$EXISTING_TOKEN"
  fi
  if [ -z "$GATELET_ADMIN_TOKEN" ]; then
    GATELET_ADMIN_TOKEN=$(openssl rand -base64 32 2>/dev/null || head -c 32 /dev/urandom | base64)
  fi
fi

# -- Write secrets to root-owned directory (backup, not used by Docker) --------
info "Storing secrets in $GATELET_SECRETS_DIR (requires sudo)..."
sudo mkdir -p "$GATELET_SECRETS_DIR"
printf '%s' "$GATELET_ADMIN_TOKEN" | sudo tee "$GATELET_SECRETS_DIR/admin-token" > /dev/null
sudo chown -R root "$GATELET_SECRETS_DIR"
sudo chmod 700 "$GATELET_SECRETS_DIR"
sudo chmod 600 "$GATELET_SECRETS_DIR/admin-token"
success "Secrets stored (root-only access)"

# -- Write .env (non-sensitive config only) -----------------------------------
cat > "$GATELET_DIR/.env" <<EOF
GATELET_IMAGE=$GATELET_IMAGE
EOF
chmod 600 "$GATELET_DIR/.env"

# -- Write docker-compose.yml ------------------------------------------------
cat > "$GATELET_DIR/docker-compose.yml" <<COMPOSE
services:
  gatelet:
    image: \${GATELET_IMAGE:-ghcr.io/hannesill/gatelet:latest}
    ports:
      - "127.0.0.1:4001:4001"  # Admin dashboard — localhost only
    volumes:
      - gatelet-data:/data
      - gatelet-secrets:/run/secrets/gatelet:ro
    environment:
      - GATELET_DATA_DIR=/data
      - GATELET_ADMIN_TOKEN_FILE=/run/secrets/gatelet/admin-token
    networks:
      - gatelet-internal
      - gatelet-egress
    labels:
      - "com.centurylinklabs.watchtower.enable=true"
    restart: unless-stopped

  watchtower:
    image: containrrr/watchtower
    volumes:
      - /var/run/docker.sock:/var/run/docker.sock
    environment:
      - DOCKER_API_VERSION=1.44
    command: --label-enable --interval 300
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
  gatelet-secrets:
    external: true
COMPOSE

# -- Pull & start -------------------------------------------------------------
if [ "$GATELET_LOCAL" = "1" ]; then
  info "Local mode — skipping pull, using local image $GATELET_IMAGE"
else
  info "Pulling $GATELET_IMAGE..."
  (cd "$GATELET_DIR" && $COMPOSE pull)
fi

# Seed secrets into a Docker volume (avoids bind-mount issues on macOS where
# Docker can only mount paths under /Users, not root-owned system dirs).
info "Loading secrets into Docker..."
docker volume create gatelet-secrets >/dev/null 2>&1 || true
printf '%s' "$GATELET_ADMIN_TOKEN" | docker run --rm -i -v gatelet-secrets:/secrets "$GATELET_IMAGE" sh -c 'cat > /secrets/admin-token && chmod 600 /secrets/admin-token'
success "Secrets loaded"

info "Starting Gatelet..."
(cd "$GATELET_DIR" && $COMPOSE up -d)

# -- Done ---------------------------------------------------------------------
printf "\n"
success "Gatelet is running!"
printf "\n"
URL_TOKEN=$(printf '%s' "$GATELET_ADMIN_TOKEN" | sed -e 's/+/%2B/g' -e 's|/|%2F|g' -e 's/=/%3D/g')
printf "  ${Cyan}Dashboard${Color_Off}    http://localhost:4001/?token=%s\n" "$URL_TOKEN"
printf "  ${Cyan}Install dir${Color_Off}  %s\n" "$GATELET_DIR"
printf "  ${Cyan}Secrets dir${Color_Off}  %s ${Dim}(root-only)${Color_Off}\n" "$GATELET_SECRETS_DIR"
printf "\n"
printf "  ${Dim}MCP endpoint (for agents on the Docker network):${Color_Off}\n"
printf "  ${Dim}http://gatelet:4000/mcp${Color_Off}\n"
printf "\n"
printf "  Manage:  cd %s && %s logs -f\n" "$GATELET_DIR" "$COMPOSE"
printf "  Stop:    cd %s && %s down\n" "$GATELET_DIR" "$COMPOSE"
printf "  Upgrade: cd %s && %s pull && %s up -d\n" "$GATELET_DIR" "$COMPOSE" "$COMPOSE"
