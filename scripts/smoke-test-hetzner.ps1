param(
  [Parameter(Mandatory = $true)]
  [string]$ServerIp,

  [Parameter(Mandatory = $true)]
  [string]$SshKey,

  [string]$Domain = "manutencaox.com.br",
  [string]$RemoteUser = "root"
)

$ErrorActionPreference = "Stop"
$remote = "$RemoteUser@$ServerIp"

Write-Host "[1/4] Verificando containers..."
ssh -i $SshKey $remote "docker ps --filter name=manutencao --format 'table {{.Names}}\t{{.Status}}'"

Write-Host "[2/4] Verificando health check da API..."
ssh -i $SshKey $remote "curl -fsS https://$Domain/api/health"

Write-Host "[3/4] Logs recentes do backend..."
ssh -i $SshKey $remote "docker logs --tail 80 manutencao-api"

Write-Host "[4/4] Logs recentes do frontend..."
ssh -i $SshKey $remote "docker logs --tail 40 manutencao-app"