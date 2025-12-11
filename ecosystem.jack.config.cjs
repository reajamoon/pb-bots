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
        AO3_NAV_TIMEOUT: process.env.AO3_NAV_TIMEOUT,
        AO3_LOGIN_RETRY_MAX: process.env.AO3_LOGIN_RETRY_MAX,
        AO3_LOGIN_RETRY_BASE_DELAY: process.env.AO3_LOGIN_RETRY_BASE_DELAY,
        AO3_SERIES_NAV_TIMEOUT: process.env.AO3_SERIES_NAV_TIMEOUT,
        PARSEQUEUE_PENDING_STUCK_MIN: process.env.PARSEQUEUE_PENDING_STUCK_MIN,
        PARSEQUEUE_PROCESSING_STUCK_MIN: process.env.PARSEQUEUE_PROCESSING_STUCK_MIN,
        PARSEQUEUE_SERIES_PROCESSING_STUCK_MIN: process.env.PARSEQUEUE_SERIES_PROCESSING_STUCK_MIN
      }
    }
  ],
};
