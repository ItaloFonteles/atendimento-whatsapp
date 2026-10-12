# Conversa com o robô pelo terminal, sem WhatsApp (precisa de MODO_TESTE=true no .env).
# Uso:  powershell -ExecutionPolicy Bypass -File scripts\simular.ps1
param(
  [string]$Telefone = "5595900000001",
  [string]$Nome = "Visitante",
  [string]$Url = "http://localhost:5678/webhook/whatsapp"
)

[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
Write-Host "Simulando o WhatsApp do numero $Telefone. Digite 'sair' para encerrar." -ForegroundColor Yellow

while ($true) {
  $texto = Read-Host "`nVoce"
  if ($texto -eq "sair") { break }

  $corpo = @{ telefone = $Telefone; nome = $Nome; texto = $texto } | ConvertTo-Json -Compress
  $bytes = [System.Text.Encoding]::UTF8.GetBytes($corpo)
  try {
    $r = Invoke-WebRequest -Uri $Url -Method Post -Body $bytes -ContentType "application/json; charset=utf-8" -UseBasicParsing
    $json = [System.Text.Encoding]::UTF8.GetString($r.RawContentStream.ToArray()) | ConvertFrom-Json
    if ($json.resposta) { Write-Host "`nRobo:" -ForegroundColor Cyan; Write-Host $json.resposta }
    else { Write-Host "`n(robo em silencio: atendimento humano)" -ForegroundColor DarkGray }
  } catch {
    Write-Host "Erro ao falar com o n8n: $($_.Exception.Message)" -ForegroundColor Red
  }
}
