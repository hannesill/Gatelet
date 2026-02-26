# Gatelet — self-hosted MCP permission proxy
# Usage: powershell -ExecutionPolicy ByPass -Command "iex (iwr -UseBasicParsing https://gatelet.dev/install.ps1)"
#
# Environment variables (optional):
#   GATELET_DIR          Install directory     (default: ~/.gatelet)
#   GATELET_IMAGE        Docker image          (default: ghcr.io/hannesill/gatelet:latest)
#   GATELET_ADMIN_TOKEN  Pre-set admin token   (default: auto-generated)
#   GATELET_PASSPHRASE   Encryption passphrase (default: prompted)
#   GATELET_SECRETS_DIR  Secrets directory     (default: ~/.gatelet/secrets)

$ErrorActionPreference = 'Stop'

function Write-Info($Message)    { Write-Host "[info] $Message" -ForegroundColor Cyan }
function Write-Warn($Message)    { Write-Host "[warn] $Message" -ForegroundColor Yellow }
function Write-Ok($Message)      { Write-Host "  OK $Message" -ForegroundColor Green }
function Write-Fail($Message)    { Write-Host "[error] $Message" -ForegroundColor Red; exit 1 }

# -- Defaults -----------------------------------------------------------------
$GateletDir   = if ($env:GATELET_DIR)   { $env:GATELET_DIR }   else { Join-Path $HOME ".gatelet" }
$GateletImage = if ($env:GATELET_IMAGE) { $env:GATELET_IMAGE } else { "ghcr.io/hannesill/gatelet:latest" }
$SecretsDir   = if ($env:GATELET_SECRETS_DIR) { $env:GATELET_SECRETS_DIR } else { Join-Path $GateletDir "secrets" }

# -- Preflight checks ---------------------------------------------------------
Write-Info "Checking prerequisites..."

# Docker
try { docker --version | Out-Null } catch { Write-Fail "Docker is not installed. Install it from https://docs.docker.com/get-docker/" }
Write-Ok "Docker found"

# Docker Compose
$Compose = $null
try { docker compose version | Out-Null; $Compose = "docker compose" } catch {}
if (-not $Compose) {
    try { docker-compose version | Out-Null; $Compose = "docker-compose" } catch {}
}
if (-not $Compose) { Write-Fail "Docker Compose not found. Install it from https://docs.docker.com/compose/install/" }
Write-Ok "Docker Compose found ($Compose)"

# Docker daemon running
try { docker info 2>$null | Out-Null } catch { Write-Fail "Docker daemon is not running. Start Docker Desktop and try again." }
Write-Ok "Docker daemon is running"

# -- Install directory --------------------------------------------------------
$ComposeFile = Join-Path $GateletDir "docker-compose.yml"

if (Test-Path $ComposeFile) {
    Write-Warn "Existing installation found at $GateletDir"
    $reply = Read-Host "  Overwrite config? Existing data volume will be preserved. [y/N]"
    if ($reply -notmatch '^[yY]') {
        Write-Info "Aborted. To upgrade, run: cd $GateletDir; $Compose pull; $Compose up -d"
        exit 0
    }
}

New-Item -ItemType Directory -Path $GateletDir -Force | Out-Null

# -- Admin token --------------------------------------------------------------
$AdminToken = $env:GATELET_ADMIN_TOKEN
$EnvFile = Join-Path $GateletDir ".env"
$AdminTokenFile = Join-Path $SecretsDir "admin-token"

if (-not $AdminToken) {
    # Check existing secrets file first, then legacy .env
    if (Test-Path $AdminTokenFile) {
        $AdminToken = (Get-Content $AdminTokenFile -Raw -ErrorAction SilentlyContinue).Trim()
    } elseif (Test-Path $EnvFile) {
        $existing = Select-String -Path $EnvFile -Pattern '^GATELET_ADMIN_TOKEN=(.+)$' -ErrorAction SilentlyContinue
        if ($existing) { $AdminToken = $existing.Matches[0].Groups[1].Value }
    }
}
if (-not $AdminToken) {
    $bytes = New-Object byte[] 32
    [System.Security.Cryptography.RandomNumberGenerator]::Fill($bytes)
    $AdminToken = [Convert]::ToBase64String($bytes)
}

# -- Encryption passphrase ----------------------------------------------------
$Passphrase = $env:GATELET_PASSPHRASE
$PassphraseFile = Join-Path $SecretsDir "passphrase"

if (-not $Passphrase) {
    # Check existing secrets file first, then legacy .env
    if (Test-Path $PassphraseFile) {
        $Passphrase = (Get-Content $PassphraseFile -Raw -ErrorAction SilentlyContinue).Trim()
    } elseif (Test-Path $EnvFile) {
        $existingPass = Select-String -Path $EnvFile -Pattern '^GATELET_PASSPHRASE=(.+)$' -ErrorAction SilentlyContinue
        if ($existingPass) { $Passphrase = $existingPass.Matches[0].Groups[1].Value }
    }
}
if (-not $Passphrase) {
    Write-Host ""
    Write-Info "Set an encryption passphrase for your data (8+ characters)."
    Write-Info "You'll need this if you ever move or restore your installation."
    $secure = Read-Host "  Passphrase" -AsSecureString
    $Passphrase = [System.Runtime.InteropServices.Marshal]::PtrToStringAuto(
        [System.Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)
    )
    if (-not $Passphrase -or $Passphrase.Length -lt 8) {
        Write-Fail "Passphrase must be at least 8 characters."
    }
}

# -- Write secrets to protected directory -------------------------------------
Write-Info "Storing secrets in $SecretsDir..."
New-Item -ItemType Directory -Path $SecretsDir -Force | Out-Null

# Restrict directory to current user only BEFORE writing secrets,
# so files inherit the restrictive ACL at creation time
$acl = New-Object System.Security.AccessControl.DirectorySecurity
$acl.SetAccessRuleProtection($true, $false)
$rule = New-Object System.Security.AccessControl.FileSystemAccessRule(
    [System.Security.Principal.WindowsIdentity]::GetCurrent().Name,
    "FullControl", "ContainerInherit,ObjectInherit", "None", "Allow"
)
$acl.AddAccessRule($rule)
Set-Acl -Path $SecretsDir -AclObject $acl

[System.IO.File]::WriteAllText($AdminTokenFile, $AdminToken)
[System.IO.File]::WriteAllText($PassphraseFile, $Passphrase)
Write-Ok "Secrets stored (current user only)"

# -- Write .env (non-sensitive config only) -----------------------------------
@"
GATELET_IMAGE=$GateletImage
"@ | Set-Content -Path $EnvFile -Encoding UTF8

# -- Write docker-compose.yml ------------------------------------------------
@'
services:
  gatelet:
    image: ${GATELET_IMAGE:-ghcr.io/hannesill/gatelet:latest}
    ports:
      - "127.0.0.1:4001:4001"  # Admin dashboard — localhost only
    volumes:
      - gatelet-data:/data
      - gatelet-secrets:/run/secrets/gatelet:ro
    environment:
      - GATELET_DATA_DIR=/data
      - GATELET_ADMIN_TOKEN_FILE=/run/secrets/gatelet/admin-token
      - GATELET_PASSPHRASE_FILE=/run/secrets/gatelet/passphrase
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
'@ | Set-Content -Path $ComposeFile -Encoding UTF8

# -- Pull & start -------------------------------------------------------------
Write-Info "Pulling $GateletImage..."
Push-Location $GateletDir
try {
    if ($Compose -eq "docker compose") {
        docker compose pull
    } else {
        docker-compose pull
    }

    # Seed secrets into a Docker volume (avoids bind-mount issues where Docker
    # cannot access host directories with restrictive ACLs).
    Write-Info "Loading secrets into Docker..."
    docker volume create gatelet-secrets 2>$null | Out-Null
    $AdminToken | docker run --rm -i -v gatelet-secrets:/secrets $GateletImage sh -c 'cat > /secrets/admin-token && chmod 600 /secrets/admin-token'
    $Passphrase | docker run --rm -i -v gatelet-secrets:/secrets $GateletImage sh -c 'cat > /secrets/passphrase && chmod 600 /secrets/passphrase'
    Write-Ok "Secrets loaded"

    Write-Info "Starting Gatelet..."
    if ($Compose -eq "docker compose") {
        docker compose up -d
    } else {
        docker-compose up -d
    }
} finally {
    Pop-Location
}

# -- Done ---------------------------------------------------------------------
Write-Host ""
Write-Ok "Gatelet is running!"
Write-Host ""
Write-Host "  Dashboard    http://localhost:4001/?token=$AdminToken" -ForegroundColor Cyan
Write-Host "  Install dir  $GateletDir" -ForegroundColor Cyan
Write-Host "  Secrets dir  $SecretsDir (current user only)" -ForegroundColor DarkGray
Write-Host ""
Write-Host "  MCP endpoint (for agents on the Docker network):" -ForegroundColor DarkGray
Write-Host "  http://gatelet:4000/mcp" -ForegroundColor DarkGray
Write-Host ""
Write-Host "  Manage:  cd $GateletDir; $Compose logs -f"
Write-Host "  Stop:    cd $GateletDir; $Compose down"
Write-Host "  Upgrade: cd $GateletDir; $Compose pull; $Compose up -d"
