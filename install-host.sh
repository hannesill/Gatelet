#!/bin/bash

# Gatelet — Native Host Installer
# Installs Gatelet as a system service with a dedicated OS user for agent isolation.
#
# Usage: curl -fsSL https://gatelet.dev/install-host.sh | bash
#
# Security model:
#   A dedicated system user (_gatelet on macOS, gatelet on Linux) owns the data
#   directory. The agent process (running as the normal user) cannot read the admin
#   token, database, or stored credentials — Unix file permissions enforce isolation.
#
# Environment variables (optional):
#   GATELET_DIR          App install directory  (default: /usr/local/lib/gatelet)
#   GATELET_DATA_DIR     Data directory         (default: /var/lib/gatelet)
#   GATELET_ADMIN_TOKEN  Pre-set admin token    (default: auto-generated)
#   GATELET_LOCAL        Set to 1 to use local build instead of downloading

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
error()   { printf "${Red}[error]${Color_Off} %s\n" "$1"; exit 1; }
success() { printf "${Green}  ✓${Color_Off} %s\n" "$1"; }

# -- Defaults -----------------------------------------------------------------
GATELET_DIR="${GATELET_DIR:-/usr/local/lib/gatelet}"
GATELET_DATA_DIR="${GATELET_DATA_DIR:-/var/lib/gatelet}"

# -- OS detection -------------------------------------------------------------
detect_os() {
  case "$(uname -s)" in
    Darwin) OS="macos" ;;
    Linux)  OS="linux" ;;
    *)      error "Unsupported operating system: $(uname -s). Only macOS and Linux are supported." ;;
  esac
}

# -- Preflight checks ---------------------------------------------------------
preflight() {
  info "Checking prerequisites..."

  # Node.js
  if ! command -v node >/dev/null 2>&1; then
    error "Node.js is not installed. Install Node.js 22+ from https://nodejs.org"
  fi

  NODE_VERSION=$(node -v | sed 's/^v//' | cut -d. -f1)
  if [ "$NODE_VERSION" -lt 22 ]; then
    error "Node.js 22+ is required (found v$(node -v | sed 's/^v//')). Update from https://nodejs.org"
  fi
  success "Node.js $(node -v) found"

  # npm
  if ! command -v npm >/dev/null 2>&1; then
    error "npm is not installed."
  fi
  success "npm found"

  # sudo
  if ! command -v sudo >/dev/null 2>&1; then
    error "sudo is required for creating system users and service files."
  fi

  NODE_PATH=$(which node)
  success "Using node at $NODE_PATH"
}

# -- System user creation -----------------------------------------------------
create_system_user() {
  info "Creating system user..."

  if [ "$OS" = "macos" ]; then
    SERVICE_USER="_gatelet"
    SERVICE_GROUP="_gatelet"

    # Check if user already exists
    if dscl . -read /Users/_gatelet >/dev/null 2>&1; then
      success "System user _gatelet already exists"
      return
    fi

    # Find an unused UID in the system range (< 500 on macOS)
    local uid=450
    while dscl . -list /Users UniqueID 2>/dev/null | awk '{print $2}' | grep -q "^${uid}$"; do
      uid=$((uid + 1))
      if [ "$uid" -ge 500 ]; then
        error "Could not find a free system UID (tried 450-499)"
      fi
    done

    sudo dscl . -create /Users/_gatelet
    sudo dscl . -create /Users/_gatelet UserShell /usr/bin/false
    sudo dscl . -create /Users/_gatelet RealName "Gatelet Service"
    sudo dscl . -create /Users/_gatelet UniqueID "$uid"
    sudo dscl . -create /Users/_gatelet PrimaryGroupID "$uid"
    sudo dscl . -create /Users/_gatelet NFSHomeDirectory /var/empty
    sudo dscl . -create /Groups/_gatelet
    sudo dscl . -create /Groups/_gatelet PrimaryGroupID "$uid"
    sudo dscl . -create /Groups/_gatelet Password '*'
    success "Created system user _gatelet (UID $uid)"

  elif [ "$OS" = "linux" ]; then
    SERVICE_USER="gatelet"
    SERVICE_GROUP="gatelet"

    if id -u gatelet >/dev/null 2>&1; then
      success "System user gatelet already exists"
      return
    fi

    sudo useradd --system --shell /usr/sbin/nologin --home-dir /var/lib/gatelet --no-create-home gatelet
    success "Created system user gatelet"
  fi
}

# -- Directory setup ----------------------------------------------------------
setup_directories() {
  info "Setting up directories..."

  # App directory (root-owned, read-only for service user)
  sudo mkdir -p "$GATELET_DIR"
  sudo chown -R root "$GATELET_DIR"
  success "App directory: $GATELET_DIR (root-owned)"

  # Data directory (service-user-owned, mode 700)
  sudo mkdir -p "$GATELET_DATA_DIR"
  sudo chown "$SERVICE_USER:$SERVICE_GROUP" "$GATELET_DATA_DIR"
  sudo chmod 700 "$GATELET_DATA_DIR"
  success "Data directory: $GATELET_DATA_DIR ($SERVICE_USER-owned, mode 700)"
}

# -- Install application files ------------------------------------------------
install_app() {
  info "Installing application files..."

  if [ "$GATELET_LOCAL" = "1" ]; then
    # Local build mode — copy from the repo this script lives in
    SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

    if [ ! -d "$SCRIPT_DIR/dist" ]; then
      error "No dist/ directory found. Run 'npm run build' first."
    fi

    sudo cp -r "$SCRIPT_DIR/dist" "$GATELET_DIR/"
    sudo cp "$SCRIPT_DIR/package.json" "$GATELET_DIR/"
    sudo cp "$SCRIPT_DIR/package-lock.json" "$GATELET_DIR/"

    # Copy dashboard workspace if present (needed for package-lock resolution)
    if [ -d "$SCRIPT_DIR/dashboard" ]; then
      sudo mkdir -p "$GATELET_DIR/dashboard"
      sudo cp "$SCRIPT_DIR/dashboard/package.json" "$GATELET_DIR/dashboard/"
    fi

    success "Copied local build to $GATELET_DIR"
  else
    # Download release tarball
    info "Downloading latest release..."
    RELEASE_URL="https://github.com/hannesill/gatelet/releases/latest/download/gatelet.tar.gz"
    TMPFILE=$(mktemp)
    if ! curl -fsSL "$RELEASE_URL" -o "$TMPFILE"; then
      rm -f "$TMPFILE"
      error "Failed to download release from $RELEASE_URL"
    fi
    sudo tar -xzf "$TMPFILE" -C "$GATELET_DIR" --strip-components=1
    rm -f "$TMPFILE"
    success "Downloaded and extracted release"
  fi

  # Install production dependencies (needed for native modules like better-sqlite3, sodium-native)
  info "Installing dependencies..."
  (cd "$GATELET_DIR" && sudo npm ci --production --ignore-scripts 2>/dev/null && sudo npm rebuild 2>/dev/null) || \
  (cd "$GATELET_DIR" && sudo npm ci --production 2>/dev/null) || \
    error "Failed to install dependencies"
  success "Dependencies installed"

  # Ensure app directory is root-owned
  sudo chown -R root "$GATELET_DIR"
}

# -- Admin token --------------------------------------------------------------
setup_admin_token() {
  info "Setting up admin token..."

  TOKEN_PATH="$GATELET_DATA_DIR/admin.token"

  # Reuse existing token if present
  if sudo test -f "$TOKEN_PATH"; then
    GATELET_ADMIN_TOKEN=$(sudo cat "$TOKEN_PATH" 2>/dev/null || true)
  fi

  if [ -z "$GATELET_ADMIN_TOKEN" ]; then
    GATELET_ADMIN_TOKEN=$(openssl rand -base64 32 2>/dev/null || head -c 32 /dev/urandom | base64)
  fi

  printf '%s' "$GATELET_ADMIN_TOKEN" | sudo tee "$TOKEN_PATH" > /dev/null
  sudo chown "$SERVICE_USER:$SERVICE_GROUP" "$TOKEN_PATH"
  sudo chmod 600 "$TOKEN_PATH"
  success "Admin token stored at $TOKEN_PATH ($SERVICE_USER-owned, mode 600)"
}

# -- Service installation -----------------------------------------------------
install_service() {
  info "Installing system service..."

  if [ "$OS" = "macos" ]; then
    PLIST_SRC="$GATELET_DIR/service/dev.gatelet.plist"
    PLIST_DST="/Library/LaunchDaemons/dev.gatelet.plist"

    # If the plist wasn't shipped in the release, use the one from the repo
    if [ ! -f "$PLIST_SRC" ]; then
      SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
      PLIST_SRC="$SCRIPT_DIR/service/dev.gatelet.plist"
    fi

    if [ ! -f "$PLIST_SRC" ]; then
      error "Cannot find service/dev.gatelet.plist"
    fi

    # Substitute node path and data dir
    sudo sed \
      -e "s|__NODE_PATH__|$NODE_PATH|g" \
      -e "s|/usr/local/lib/gatelet|$GATELET_DIR|g" \
      -e "s|/var/lib/gatelet|$GATELET_DATA_DIR|g" \
      "$PLIST_SRC" > /tmp/dev.gatelet.plist
    sudo mv /tmp/dev.gatelet.plist "$PLIST_DST"
    sudo chown root:wheel "$PLIST_DST"
    sudo chmod 644 "$PLIST_DST"

    # Unload if already loaded, then bootstrap
    sudo launchctl bootout system/dev.gatelet 2>/dev/null || true
    sudo launchctl bootstrap system "$PLIST_DST"
    success "launchd service installed and started"

  elif [ "$OS" = "linux" ]; then
    UNIT_SRC="$GATELET_DIR/service/gatelet.service"
    UNIT_DST="/etc/systemd/system/gatelet.service"

    # If the unit wasn't shipped in the release, use the one from the repo
    if [ ! -f "$UNIT_SRC" ]; then
      SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
      UNIT_SRC="$SCRIPT_DIR/service/gatelet.service"
    fi

    if [ ! -f "$UNIT_SRC" ]; then
      error "Cannot find service/gatelet.service"
    fi

    # Substitute node path and data dir
    sudo sed \
      -e "s|__NODE_PATH__|$NODE_PATH|g" \
      -e "s|/usr/local/lib/gatelet|$GATELET_DIR|g" \
      -e "s|/var/lib/gatelet|$GATELET_DATA_DIR|g" \
      "$UNIT_SRC" > /tmp/gatelet.service
    sudo mv /tmp/gatelet.service "$UNIT_DST"
    sudo chown root:root "$UNIT_DST"
    sudo chmod 644 "$UNIT_DST"

    sudo systemctl daemon-reload
    sudo systemctl enable --now gatelet
    success "systemd service installed and started"
  fi
}

# -- Copy service files to app dir --------------------------------------------
copy_service_files() {
  # Ensure service files are available in the install dir for future reference
  if [ "$GATELET_LOCAL" = "1" ]; then
    SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
    if [ -d "$SCRIPT_DIR/service" ]; then
      sudo cp -r "$SCRIPT_DIR/service" "$GATELET_DIR/"
    fi
  fi
}

# -- Main ---------------------------------------------------------------------
main() {
  printf "\n"
  printf "${Cyan}Gatelet — Native Host Installer${Color_Off}\n"
  printf "${Dim}Installs Gatelet as a system service with OS-level agent isolation${Color_Off}\n"
  printf "\n"

  detect_os
  preflight
  create_system_user
  setup_directories
  install_app
  copy_service_files
  setup_admin_token
  install_service

  # -- Summary ----------------------------------------------------------------
  # NOTE: install.sh (Docker) uses a different summary format — it embeds the
  # token in the dashboard URL (?token=…) so "Next steps" don't apply there.
  printf "\n"
  success "Gatelet is running!"
  printf "\n"
  printf "  ${Cyan}Dashboard${Color_Off}    http://localhost:4001\n"
  printf "  ${Cyan}MCP endpoint${Color_Off} http://localhost:4000/mcp\n"
  printf "  ${Cyan}App dir${Color_Off}      %s ${Dim}(root-owned)${Color_Off}\n" "$GATELET_DIR"
  printf "  ${Cyan}Data dir${Color_Off}     %s ${Dim}(%s-owned, mode 700)${Color_Off}\n" "$GATELET_DATA_DIR" "$SERVICE_USER"
  printf "\n"

  printf "  ${Cyan}Next steps:${Color_Off}\n"
  printf "    ${Green}1.${Color_Off} Get your admin token:  sudo cat %s/admin.token\n" "$GATELET_DATA_DIR"
  printf "    ${Green}2.${Color_Off} Open the dashboard:    http://localhost:4001\n"
  printf "    ${Dim}   Paste the admin token to sign in.${Color_Off}\n"
  printf "\n"

  if [ "$OS" = "macos" ]; then
    printf "  ${Dim}Manage:${Color_Off}\n"
    printf "    Status:   sudo launchctl print system/dev.gatelet\n"
    printf "    Logs:     cat %s/gatelet.log\n" "$GATELET_DATA_DIR"
    printf "    Stop:     sudo launchctl bootout system/dev.gatelet\n"
    printf "    Start:    sudo launchctl bootstrap system /Library/LaunchDaemons/dev.gatelet.plist\n"
    printf "    Uninstall: sudo launchctl bootout system/dev.gatelet && sudo rm /Library/LaunchDaemons/dev.gatelet.plist\n"
  elif [ "$OS" = "linux" ]; then
    printf "  ${Dim}Manage:${Color_Off}\n"
    printf "    Status:    sudo systemctl status gatelet\n"
    printf "    Logs:      sudo journalctl -u gatelet -f\n"
    printf "    Stop:      sudo systemctl stop gatelet\n"
    printf "    Start:     sudo systemctl start gatelet\n"
    printf "    Uninstall: sudo systemctl disable --now gatelet && sudo rm /etc/systemd/system/gatelet.service\n"
  fi

  printf "\n"
  printf "  ${Dim}Security: The agent cannot read %s (wrong user, mode 700)${Color_Off}\n" "$GATELET_DATA_DIR"
  printf "\n"
}

main
