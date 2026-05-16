# PWA na Google Play

Este projeto ja possui base de PWA via Vite e service worker. Para substituir o app atual da Google Play por um app baseado no PWA hospedado no servidor, o caminho recomendado e usar TWA (Trusted Web Activity).

## O que foi preparado

- Arquivo de associacao de dominio em [public/.well-known/assetlinks.json](public/.well-known/assetlinks.json).
- Estrutura de PWA ja existente em [vite.config.ts](vite.config.ts).

## Valores ja preenchidos

- Package name: `com.appmanutencao.app`
- SHA-256 (keystore local): `6B:C3:71:B7:A9:00:99:4C:EE:21:DE:80:2D:E7:E5:17:BD:8C:4F:C0:4A:5B:BF:DE:24:68:65:2E:A5:33:CB:9E`

**Importante:** se a Play Console usa Google Play App Signing (re-assina o app), o SHA-256 no assetlinks.json precisa ser o da chave de assinatura da Play, nao o da keystore de upload. Verifique em Play Console > Integridade do app > Certificado de assinatura do app.

## Validacao do dominio

Depois do deploy web, confirme que o arquivo esta publico em:

- `https://manutencaox.com.br/.well-known/assetlinks.json`

O conteudo precisa abrir no navegador sem redirecionamento, login ou HTML no lugar do JSON.

## Pontos criticos antes de gerar o TWA

- O package name do app publicado precisa ser mantido.
- O app precisa ser assinado com a mesma identidade aceita pela Play.
- O dominio do PWA precisa estar em HTTPS e servir o manifesto e service worker corretamente.

## Identificadores (resolvido)

Ambos os arquivos agora usam `com.appmanutencao.app`:
- [capacitor.config.ts](capacitor.config.ts)
- [android/app/build.gradle](android/app/build.gradle)

## Proximo passo recomendado

Com o `assetlinks.json` preenchido e publicado, gerar o wrapper TWA com Bubblewrap apontando para o manifesto do site em producao.