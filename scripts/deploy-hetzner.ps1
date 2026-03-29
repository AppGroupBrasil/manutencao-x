param(
  [Parameter(Mandatory = $true)]
  [string]$ServerIp,

  [Parameter(Mandatory = $true)]
  [string]$SshKey,

  [string]$RemotePath = "/opt/manutencao-app",
  [string]$RemoteUser = "root"
)

$ErrorActionPreference = "Stop"

$projectRoot = Split-Path -Parent $PSScriptRoot
$remote = "$RemoteUser@$ServerIp"

Write-Host "[1/5] Validando build local..."
Push-Location $projectRoot
try {
  npm run build
  Push-Location (Join-Path $projectRoot "server")
  try {
    npm run build
  } finally {
    Pop-Location
  }

  Write-Host "[2/5] Garantindo diretório remoto..."
  ssh -i $SshKey $remote "mkdir -p $RemotePath"

  Write-Host "[3/5] Enviando arquivos para o servidor..."
  $items = @(
    "src",
    "public",
    "server",
    "scripts",
    "index.html",
    "package.json",
    "package-lock.json",
    "Dockerfile",
    "docker-compose.yml",
    "nginx.conf",
    "vite.config.ts",
    "tsconfig.json",
    "tsconfig.node.json",
    "capacitor.config.ts",
    ".env"
  )

  foreach ($item in $items) {
    $localPath = Join-Path $projectRoot $item
    if (Test-Path $localPath) {
      scp -i $SshKey -r $localPath "$remote`:$RemotePath/"
    }
  }

  Write-Host "[4/5] Garantindo rede Docker coolify..."
  ssh -i $SshKey $remote "docker network inspect coolify >/dev/null 2>&1 || docker network create coolify"

  Write-Host "[5/5] Rebuildando e subindo stack..."
  ssh -i $SshKey $remote "cd $RemotePath && docker compose down && docker compose build --no-cache && docker compose up -d"

  Write-Host "Deploy concluído. Rode scripts/smoke-test-hetzner.ps1 para validar."
} finally {
  Pop-Location
}