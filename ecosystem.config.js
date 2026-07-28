const path = require("path");

// Arrenca el servidor empaquetat (output: "standalone") amb PM2.
// Ús:  pm2 start ecosystem.config.js
//
// Requereix haver fet abans:
//   npm run build
//   cp -r .next/static .next/standalone/.next/static
//   cp .env.local .next/standalone/.env.local   (les variables d'entorn)
//
// Ajusta PORT perquè coincideixi amb l'App Port del site de CloudPanel.

module.exports = {
  apps: [
    {
      name: "scribaai",
      cwd: path.join(__dirname, ".next", "standalone"),
      script: "server.js",
      instances: 1,
      autorestart: true,
      // Marge ampli: en pujar/importar àudios grans, Next bufferitza el cos en
      // memòria (pel middleware) i el llegim a un Buffer; amb 500M el procés es
      // reiniciava a mitja transcodificació. 1G va sobrat en un servidor de 4 GB.
      max_memory_restart: "1G",
      env: {
        NODE_ENV: "production",
        PORT: 3000,
        HOSTNAME: "0.0.0.0",
      },
    },
  ],
};
