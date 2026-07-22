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
      max_memory_restart: "500M",
      env: {
        NODE_ENV: "production",
        PORT: 3000,
        HOSTNAME: "0.0.0.0",
      },
    },
  ],
};
