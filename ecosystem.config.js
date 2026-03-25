// ecosystem.config.js
module.exports = {
  apps: [
    {
      name: "neuron2fb",
      script: "express.js",
      instances: 1,
      autorestart: true,
      watch: false,
      cron_restart: "0 * * * *",
      restart_delay: 30000,
      env: {
        NODE_ENV: "production",
        PORT: 3290,
      },
    },
    {
      name: "dashboard",
      script: "dashboard_server.js",
      instances: 1,
      autorestart: true,
      watch: false,
      env: {
        NODE_ENV: "production",
        PORT: 3291,
      },
    },
  ],
};
