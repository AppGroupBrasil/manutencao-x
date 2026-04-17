param(
  [Parameter(Mandatory = $true)]
  [string]$ServerIp,

  [Parameter(Mandatory = $true)]
  [string]$SshKey,

  [ValidateSet("production", "staging")]
  [string]$Environment = "production",

  [string]$EnvFile,

  [string]$RemotePath = "/opt/manutencao-app",
  [string]$RemoteUser = "root"
)

$ErrorActionPreference = "Stop"

$projectRoot = Split-Path -Parent $PSScriptRoot
$remote = "$RemoteUser@$ServerIp"

if (-not $PSBoundParameters.ContainsKey('EnvFile')) {
  $EnvFile = if ($Environment -eq 'staging') { '.env.staging' } else { '.env' }
}

if ($Environment -eq 'staging' -and $RemotePath -eq '/opt/manutencao-app') {
  $RemotePath = '/opt/manutencao-staging'
}

if ($Environment -eq 'staging') {
  $composeArgs = '-f docker-compose.staging.yml -p manutencao-staging'
} else {
  $composeArgs = '-f docker-compose.yml'
}
$envSourcePath = Join-Path $projectRoot $EnvFile

if (-not (Test-Path $envSourcePath)) {
  throw "Arquivo de ambiente não encontrado: $envSourcePath"
}

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
  $tarFile = Join-Path $env:TEMP "manutencao-deploy.tar.gz"
  Push-Location $projectRoot
  try {
    tar -czf $tarFile `
      --exclude='node_modules' `
      --exclude='.git' `
      --exclude='dist' `
      --exclude='android' `
      --exclude='ios' `
      --exclude='server/uploads/avatars/*' `
      --exclude='server/uploads/fotos/*' `
      --exclude='server/uploads/documentos/*' `
      --exclude='server/uploads/qrcodes/*' `
      src public server scripts index.html package.json package-lock.json `
      Dockerfile docker-compose.yml docker-compose.staging.yml nginx.conf `
      vite.config.ts tsconfig.json tsconfig.node.json capacitor.config.ts `
      seed-master.sql 2>$null
  } finally {
    Pop-Location
  }
  scp -i $SshKey $tarFile "$remote`:/tmp/manutencao-deploy.tar.gz"
  ssh -i $SshKey $remote "cd $RemotePath && tar -xzf /tmp/manutencao-deploy.tar.gz && rm /tmp/manutencao-deploy.tar.gz"
  Remove-Item $tarFile -ErrorAction SilentlyContinue

  scp -i $SshKey $envSourcePath "$remote`:$RemotePath/.env"

  Write-Host "[4/5] Garantindo rede Docker coolify..."
  ssh -i $SshKey $remote "docker network inspect coolify >/dev/null 2>&1 || docker network create coolify"

  Write-Host "[5/5] Rebuildando e subindo stack..."
  ssh -i $SshKey $remote "cd $RemotePath && docker compose $composeArgs down && docker compose $composeArgs build --no-cache && docker compose $composeArgs up -d"

  Write-Host "Deploy concluído. Rode scripts/smoke-test-hetzner.ps1 -Environment $Environment para validar."
} finally {
  Pop-Location
}