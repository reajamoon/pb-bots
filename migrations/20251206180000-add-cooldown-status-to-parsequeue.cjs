/**
 * Migration: add 'cooldown' to ParseQueue.status ENUM
 * - For Postgres: ALTER TYPE to add new value
 * - For SQLite (dev): enums are emulated; no-op
 */

async function up(queryInterface, Sequelize) {
  const dialect = queryInterface.sequelize.getDialect();
  if (dialect === 'postgres') {
    // Add new enum value 'cooldown' to the existing type
    await queryInterface.sequelize.query("ALTER TYPE \"enum_ParseQueue_status\" ADD VALUE IF NOT EXISTS 'cooldown';");
  } else {
    // SQLite or other dialects: no-op, Sequelize emulates ENUM
    console.log('[Migration] Skipping ENUM alteration for dialect:', dialect);
  }
}

async function down(queryInterface, Sequelize) {
  const dialect = queryInterface.sequelize.getDialect();
  if (dialect === 'postgres') {
    // Cannot easily remove an enum value in Postgres without recreating the type.
    // Leave as-is for safety.
    console.log("[Migration] No down migration for removing 'cooldown' from enum_ParseQueue_status.");
  } else {
    // No-op
    console.log('[Migration] Skipping down migration for dialect:', dialect);
  }
}

module.exports = { up, down };
