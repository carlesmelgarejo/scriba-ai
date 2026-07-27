# Desplegament a CloudPanel — ScribaAI

Guia consolidada (amb totes les correccions apreses). Exemple per al site
`scribaai.elclic.net` amb usuari del site `scribaai`.

## Desplegament automàtic (GitHub Actions)

Amb `.github/workflows/deploy.yml`, cada `push` a `main` entra al servidor per SSH
i executa `deploy.sh`. Configuració (un sol cop):

1. **El servidor ha de ser un clon de git** (no fitxers per SFTP). Al directori del
   site, conservant `.env.local` i `data/` (que estan al `.gitignore`):

   ```bash
   cd ~/htdocs/scribaai.elclic.net
   git init
   git remote add origin <URL_DEL_REPO>
   git fetch origin
   git reset --hard origin/main
   ```

2. **Clau SSH de desplegament.** Genera un parell de claus dedicat:

   ```bash
   ssh-keygen -t ed25519 -f ~/deploy_key -N ""
   cat ~/deploy_key.pub >> ~/.ssh/authorized_keys   # com a usuari scribaai
   chmod 600 ~/.ssh/authorized_keys
   cat ~/deploy_key                                 # la privada → secret de GitHub
   ```

3. **Secrets del repo** (GitHub → Settings → Secrets and variables → Actions):
   - `SSH_HOST`: IP o domini del servidor
   - `SSH_USER`: `scribaai`
   - `SSH_PORT`: `22` (o el teu port SSH)
   - `SSH_KEY`: el contingut de la clau **privada** (`~/deploy_key`)
   - `PROJECT_DIR`: `/home/scribaai/htdocs/scribaai.elclic.net`

A partir d'aquí, cada `git push` a `main` desplega sol. També es pot llançar a mà
des de la pestanya **Actions** (workflow_dispatch).

> `deploy.sh` fa `git reset --hard` no; el workflow sí. Els fitxers ignorats
> (`.env.local`, `data/`, `node_modules`, `.next`) no es toquen, així que la config
> i l'històric es conserven entre desplegaments.

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
ASSEMBLYAI_LLM_MODEL=claude-haiku-4-5-20251001
AUTH_PASSWORD_HASH_B64=el_hash_en_base64
AUTH_SECRET=els_64_hex
SCRIBA_DATA_DIR=/home/scribaai/scriba-data
```

> **Històric (dades persistents):** `SCRIBA_DATA_DIR` ha d'apuntar a una carpeta
> **fora del repo/checkout git** i fora de `.next`. Recomanat: `~/scriba-data`
> (`/home/scribaai/scriba-data`). Així les reunions (JSON + Markdown + àudio Opus)
> sobreviuen a cada `deploy.sh` (que reconstrueix `.next`) **i** a qualsevol
> `git reset --hard` o re-clonat, que mai toquen res de fora del directori del site.
> Si la poses dins del site (p. ex. `.../scribaai.elclic.net/data`) segueix
> funcionant, però hauràs de moure-la a mà cada cop que buidis la carpeta per
> re-clonar.

> **La crea `deploy.sh` sol:** el script llegeix `SCRIBA_DATA_DIR` del `.env.local`
> i fa `mkdir -p`. Com que el desplegament corre com a `scribaai`, la carpeta queda
> **amb el propietari correcte** i no cal cap `chown` ni `sudo`.

> **Àudio (ffmpeg):** per desar l'àudio de cada reunió en Opus cal `ffmpeg` al
> servidor: `sudo apt install ffmpeg` (un cop, com a root/admin). Si no hi és,
> l'app funciona igual però no desa àudio. Comprova-ho amb `ffmpeg -version`.

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
dins de `.next/standalone` → **crea `SCRIBA_DATA_DIR` si no existeix** (amb el
propietari correcte, ja que corre com `scribaai`) → arrenca amb PM2 → esborra
`node_modules` (el build ja no cal; la app corre des del standalone, ~30 MB).

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
- **`EACCES: permission denied` en desar l'àudio/reunió** → la carpeta de
  `SCRIBA_DATA_DIR` (o algun fitxer) és d'un altre usuari (típicament `root`, si
  alguna cosa es va executar amb `sudo`). Comprova-ho amb
  `stat -c '%U:%G %a' <SCRIBA_DATA_DIR>`; ha de ser `scribaai:scribaai`. Solució
  neta: posa `SCRIBA_DATA_DIR` **fora del site** (`~/scriba-data`) i deixa que
  `deploy.sh` la creï. Si ja té fitxers de root: copia'ls com a `scribaai`
  (`cp -r`, tenen lectura per a tothom) o fes el `chown` **com a root**.
- **`sudo` demana contrasenya i no l'accepta** → l'usuari del site de CloudPanel
  (`scribaai`) **no és sudoer** (i sovint no té contrasenya; entres per clau SSH).
  No facis servir `sudo` amb aquest usuari: treballa dins de la seva carpeta sense
  `sudo`, o entra com a **root** per a operacions que el necessitin.
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
