#!/usr/bin/env bash
# Compila i prepara l'app per servir amb PM2 (output standalone).
# Ús:  ./deploy.sh
set -euo pipefail

cd "$(dirname "$0")"

echo "▸ Instal·lant dependències…"
npm install

echo "▸ Compilant (build)…"
npm run build

echo "▸ Copiant assets estàtics al standalone…"
cp -r .next/static .next/standalone/.next/static
[ -d public ] && cp -r public .next/standalone/public

if [ -f .env.local ]; then
  echo "▸ Copiant .env.local al standalone…"
  cp .env.local .next/standalone/.env.local
else
  echo "⚠ No s'ha trobat .env.local — recorda crear-lo dins de .next/standalone/"
fi

echo "▸ (Re)arrencant amb PM2…"
pm2 startOrReload ecosystem.config.js
pm2 save

echo "▸ Alliberant espai (node_modules del build ja no cal)…"
rm -rf node_modules .next/cache

echo "✓ Desplegat. Comprova-ho amb: pm2 status"
