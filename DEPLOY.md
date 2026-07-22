# Desplegament a CloudPanel — ScribaAI

Guia consolidada (amb totes les correccions apreses). Exemple per al site
`scribaai.elclic.net` amb usuari del site `scribaai`.

## 0. A CloudPanel (abans de l'SSH)

1. **Add Site → Create a Node.js Site.** Domini `scribaai.elclic.net`, versió
   Node **22 LTS**, App Port **3000** (ha de coincidir amb `ecosystem.config.js`).
2. Anota l'usuari del site: **`scribaai`**.
3. **DNS:** registre A de `scribaai.elclic.net` → IP del servidor.

> ⚠️ Connecta't SEMPRE per SSH com a **usuari del site** (`scribaai`), mai com un
> altre usuari. Si no, els fitxers queden amb propietari equivocat i el build
> falla amb `EACCES`.

## 1. Entra per SSH com a `scribaai` i prepara Node 22 + PM2

El Node del sistema sol ser massa antic (18) per a Next 16. Instal·la nvm (va a la
teva carpeta, sense root):

```bash
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.1/install.sh | bash
source ~/.nvm/nvm.sh
nvm install 22
nvm use 22
nvm alias default 22
node -v                 # v22.x.x

# amb nvm actiu, els globals no necessiten root:
npm install -g pm2
pm2 -v
```

## 2. Puja el codi

A l'arrel del site (`~/htdocs/scribaai.elclic.net`), clona el repo o puja per
SFTP **només el codi font** (sense `node_modules` ni `.next`).

## 3. Crea el `.env.local`

```bash
cd ~/htdocs/scribaai.elclic.net
nano .env.local
```

Contingut (el hash va en **base64** per evitar que Next interpreti els `$`):

```
ASSEMBLYAI_API_KEY=la_teva_clau
ASSEMBLYAI_LANGUAGE=ca
AUTH_PASSWORD_HASH_B64=el_hash_en_base64
AUTH_SECRET=els_64_hex
```

Genera els valors:

```bash
# Hash bcrypt en base64
node -e "console.log(Buffer.from(require('bcryptjs').hashSync(process.argv[1],12)).toString('base64'))" 'LA_TEVA_CONTRASENYA'
# Secret de sessió
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

> El `deploy.sh` ja necessita `bcryptjs` instal·lat; si el comando del hash falla,
> executa abans `npm install` un cop.

## 4. Desplega

```bash
bash deploy.sh
pm2 status              # 'scribaai'/'actaai' en verd
```

El `deploy.sh` fa: `npm install` → build → copia `.next/static` i `.env.local`
dins de `.next/standalone` → arrenca amb PM2 → esborra `node_modules` (el build ja
no cal; la app corre des del standalone, ~30 MB).

## 5. Ajusta l'nginx del site

CloudPanel → site → **Vhost**, afegeix dins el bloc server (imprescindible el
`client_max_body_size` o l'àudio de 2 h dona error 413):

```nginx
client_max_body_size 100M;
proxy_read_timeout 300s;
proxy_send_timeout 300s;
```

## 6. SSL

CloudPanel → site → **SSL/TLS** → emet certificat Let's Encrypt.
(HTTPS és obligatori: sense ell, Safari a l'iPhone bloqueja el micròfon.)

## 7. Persistència

```bash
pm2 save
# Reinici del servidor (sense sudo, com a usuari del site):
(crontab -l 2>/dev/null; echo '@reboot /bin/bash -lc "source $HOME/.nvm/nvm.sh && pm2 resurrect"') | crontab -
crontab -l
```

> Tancar l'SSH NO atura l'app (PM2 és un dimoni). El cron `@reboot` la torna a
> aixecar després d'un reinici. Recorda `pm2 save` cada cop que canviïs el procés.

## Actualitzacions futures

```bash
cd ~/htdocs/scribaai.elclic.net
# puja el codi nou (git pull o SFTP)
bash deploy.sh
```

## Problemes habituals (ja resolts aquí)

- **`EACCES` al build** → estàs com l'usuari equivocat; entra com a `scribaai`.
  Si queden residus d'un altre usuari: `rm -f next-env.d.ts` i
  `rm -rf node_modules .next`, i torna a desplegar.
- **`Node.js version ">=20.9.0" is required`** → la shell fa servir el Node del
  sistema; fes `nvm use 22`.
- **`permission denied` a `./deploy.sh`** → `bash deploy.sh` o `chmod +x deploy.sh`.
- **Login sempre incorrecte** → el hash ha d'anar en **base64** a
  `AUTH_PASSWORD_HASH_B64`, no el bcrypt cru (els `$` es corrompen al `.env`).
- **`npm -g` dona `EACCES`** → amb nvm actiu no cal root; si no uses nvm, posa
  `npm config set prefix ~/.npm-global` i afegeix `~/.npm-global/bin` al PATH.
- **`EADDRINUSE: address already in use :::3000`** → un altre site ja té aquell
  port. Dóna a cada app el seu port (vegeu "Diversos sites" a sota).
- **Canvio l'App Port a CloudPanel i el port segueix ocupat** → el camp *App Port*
  de CloudPanel només diu a l'nginx cap a on reenviar; NO és el port on escolta el
  Node. El procés segueix al `PORT` del seu `ecosystem.config.js`. Per canviar-lo
  de debò: edita `PORT` a l'ecosystem, `pm2 delete <nom>` + `pm2 start
  ecosystem.config.js` + `pm2 save`, i posa el mateix valor a l'App Port.
- **El procés surt amb un nom equivocat a `pm2 status`** → és el `name` de
  l'`ecosystem.config.js`. Corregeix-lo, i després `pm2 delete <nom_vell>` +
  `pm2 start ecosystem.config.js` + `pm2 save`.

## Diversos sites al mateix servidor

Cada site és un usuari i un PM2 independents. Per evitar conflictes:

- Dóna a **cada app un port propi** (p. ex. aiacta → 3000, scribaai → 3001) al seu
  `ecosystem.config.js` (`PORT`) i el mateix valor al camp *App Port* de CloudPanel.
- Posa un **`name` únic** a cada `ecosystem.config.js` (`scribaai`, `aiacta`…).
- Recorda que `pm2 status`, `pm2 save` i el cron `@reboot` són **per usuari**: has
  d'estar connectat com l'usuari del site per veure i gestionar el seu procés.
