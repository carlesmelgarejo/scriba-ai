#!/usr/bin/env bash
# Compila i prepara l'app per servir amb PM2 (output standalone).
# Ús:  ./deploy.sh
set -euo pipefail

cd "$(dirname "$0")"

echo "▸ Instal·lant dependències…"
npm install

echo "▸ Netejant build anterior…"
rm -rf .next

echo "▸ Compilant (build)…"
npm run build

echo "▸ Copiant assets estàtics al standalone…"
# Neteja el destí abans de copiar per evitar imbricacions (.next/static/static)
# i assets vells que no coincideixin amb el build actual.
rm -rf .next/standalone/.next/static
cp -r .next/static .next/standalone/.next/static
if [ -d public ]; then
  rm -rf .next/standalone/public
  cp -r public .next/standalone/public
fi

if [ -f .env.local ]; then
  echo "▸ Copiant .env.local al standalone…"
  cp .env.local .next/standalone/.env.local
else
  echo "⚠ No s'ha trobat .env.local — recorda crear-lo dins de .next/standalone/"
fi

# Assegura la carpeta de dades (històric). La crea l'usuari que executa
# deploy.sh, així queda amb el propietari correcte i no cal cap chown/sudo.
DATA_DIR="$(grep -E '^SCRIBA_DATA_DIR=' .env.local 2>/dev/null | tail -n1 | cut -d= -f2- | tr -d '"' | xargs || true)"
DATA_DIR="${DATA_DIR:-$PWD/data}"
echo "▸ Assegurant la carpeta de dades: $DATA_DIR"
mkdir -p "$DATA_DIR"

echo "▸ (Re)arrencant amb PM2…"
pm2 startOrReload ecosystem.config.js
pm2 save

echo "▸ Alliberant espai (node_modules del build ja no cal)…"
rm -rf node_modules .next/cache

echo "✓ Desplegat. Comprova-ho amb: pm2 status"
