#!/usr/bin/env bash
# ATS BLOQUEIA http:// NUM WKWEBVIEW EMPACOTADO — medido 20/08: https://example.com
# renderiza, http://localhost:4173 abre a janela em BRANCO, e o log nativo diz
# `loadURLInWebView` como se tivesse dado certo. Nenhum erro chega ao bun.
#
# A chave é NSAllowsLocalNetworking e NÃO NSAllowsArbitraryLoads: a primeira libera
# só nome não qualificado, *.local e link-local — que é onde o my-graph mora. A
# segunda libera a internet inteira em texto claro, pra resolver um problema de
# localhost.
#
# Roda DEPOIS do `electrobun build`, porque o build reescreve o Info.plist.
set -euo pipefail
for plist in build/*/*.app/Contents/Info.plist; do
  [ -f "$plist" ] || continue
  plutil -remove NSAppTransportSecurity "$plist" 2>/dev/null || true
  plutil -insert NSAppTransportSecurity -xml \
    '<dict><key>NSAllowsLocalNetworking</key><true/></dict>' "$plist"
  echo "ATS: NSAllowsLocalNetworking em $plist"
done
