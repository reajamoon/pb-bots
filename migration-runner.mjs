#!/usr/bin/env node
/**
 * Migration runner for CommonJS migration files
 * This allows ESM modules to run CommonJS migrations via sequelize-cli
 */

import { execSync } from 'child_process';
import { config } from 'dotenv';

// Load environment variables
config();

const command = process.argv.slice(2).join(' ');

if (!command) {
  console.log('Usage: node migration-runner.mjs <sequelize command>');
  console.log('Example: node migration-runner.mjs db:migrate');
  process.exit(1);
}

try {
  execSync(`npx sequelize-cli ${command}`, { stdio: 'inherit' });
} catch (error) {
  console.error('Migration failed:', error.message);
  process.exit(1);
}