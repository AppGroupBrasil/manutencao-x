param(
  [Parameter(Mandatory = $true)]
  [string]$ServerIp,

  [Parameter(Mandatory = $true)]
  [string]$SshKey,

  [ValidateSet("production", "staging")]
  [string]$Environment = "production",

  [string]$Domain,

  [string]$RemotePath = "/opt/manutencao-app",
  [string]$RemoteUser = "root"
)

$ErrorActionPreference = "Stop"
$remote = "$RemoteUser@$ServerIp"

if (-not $PSBoundParameters.ContainsKey('Domain')) {
  $Domain = if ($Environment -eq 'staging') { 'staging.manutencaox.com.br' } else { 'manutencaox.com.br' }
}

if ($Environment -eq 'staging' -and $RemotePath -eq '/opt/manutencao-app') {
  $RemotePath = '/opt/manutencao-staging'
}

$composeFiles = @('docker-compose.yml')
if ($Environment -eq 'staging') {
  $composeFiles += 'docker-compose.staging.yml'
}

$composeArgs = ($composeFiles | ForEach-Object { "-f $_" }) -join ' '
$apiContainer = if ($Environment -eq 'staging') { 'manutencao-staging-api' } else { 'manutencao-api' }
$appContainer = if ($Environment -eq 'staging') { 'manutencao-staging-app' } else { 'manutencao-app' }

Write-Host "[1/5] Verificando containers da stack $Environment..."
ssh -i $SshKey $remote "cd $RemotePath && docker compose $composeArgs ps"

Write-Host "[2/5] Verificando health check da API..."
ssh -i $SshKey $remote "curl -fsS https://$Domain/api/health"

Write-Host "[3/5] Verificando readiness da API..."
ssh -i $SshKey $remote "curl -fsS https://$Domain/api/ready"

Write-Host "[4/5] Logs recentes do backend..."
ssh -i $SshKey $remote "docker logs --tail 80 $apiContainer"

Write-Host "[5/5] Logs recentes do frontend..."
ssh -i $SshKey $remote "docker logs --tail 40 $appContainer"