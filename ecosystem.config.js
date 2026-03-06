// ecosystem.config.js
module.exports = {
  apps: [
    {
      name: "neuronwin", // Name of your application
      script: "express.js", // The entry file of your Express.js app (e.g., server.js, index.js)
      instances: 1, // Number of instances to run (1 for a single instance, 'max' for all CPU cores)
      autorestart: true, // PM2 will automatically restart if the app crashes
      watch: false, // Set to true if you want PM2 to watch for file changes and auto-restart
      // For production, usually set to false.
      // max_memory_restart: '1G',   // Restart if memory exceeds 1GB (adjust as needed)
      max_memory_restart: false,

      // --- Restart Scheduling ---
      cron_restart: "0 * * * *", // Restart at the 0th minute of every hour (e.g., 1:00 PM, 2:00 PM, etc.)
      // If you want it to restart at 49 minutes past every hour, change to "49 * * * *"

      // --- Restart Delay ---
      restart_delay: 30000, // PM2 will wait 30 seconds (30000 milliseconds)
      // AFTER stopping the app and BEFORE starting it again.

      env: {
        NODE_ENV: "production", // Set environment variables here
      },
      env_development: {
        NODE_ENV: "development",
      },
    },
  ],
};
