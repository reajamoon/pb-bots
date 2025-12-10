// PM2 ecosystem file for Jack (queue worker)
module.exports = {
  apps: [
    {
      name: 'jack',
      script: './src/bots/jack/jack.js',
      instances: 1,
      autorestart: true,
      watch: false,
      exec_mode: "fork",
      max_memory_restart: '700M',
      max_restarts: 5,
      restart_delay: 10000,
      env: {
        NODE_ENV: 'production',
        DATABASE_URL: process.env.DATABASE_URL,
        AO3_NAV_TIMEOUT: 180000,
        AO3_LOGIN_RETRY_MAX: 3,
        AO3_LOGIN_RETRY_BASE_DELAY: 5000,
      }
    }
  ],
};
