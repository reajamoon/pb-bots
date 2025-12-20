'use strict';

const fs = require('fs');
const path = require('path');

function loadWordsFromConfig() {
  try {
    const filePath = path.resolve(process.cwd(), 'config', 'projectPublicIdWords.json');
    const raw = fs.readFileSync(filePath, 'utf8');
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed) || !parsed.length) return null;
    const cleaned = parsed
      .map(w => String(w || '').trim().toUpperCase())
      .filter(w => w && /^[A-Z0-9]{2,24}$/.test(w));
    return cleaned.length ? cleaned : null;
  } catch (e) {
    return null;
  }
}

const WORDS = loadWordsFromConfig() || [
  'ZEPPELIN', 'PAGE', 'PLANT', 'BONHAM', 'JONES',
  'LENNON', 'MCCARTNEY', 'HARRISON', 'STARR',
  'STONES', 'JAGGER', 'RICHARDS', 'WATTS', 'WOOD',
  'FLOYD', 'GILMOUR', 'WATERS', 'MASON', 'WRIGHT',
  'RUSH', 'LEE', 'LIFESON', 'PEART',
  'QUEEN', 'MERCURY', 'MAY', 'TAYLOR', 'DEACON',
  'DALTRY', 'TOWNSHEND', 'ENTWISTLE', 'MOON',
  'DOORS', 'MORRISON', 'MANZAREK', 'KRIEGER', 'DENSMORE',
  'KINKS', 'DAVIES',
  'HENLEY', 'FREY', 'WALSH',
  'JOURNEY', 'PERRY',
  'SANTANA',
  'HEART', 'WILSON',
  'BLONDIE', 'HARRY',
  'COPELAND', 'SUMNER',
  'GENESIS', 'COLLINS', 'GABRIEL', 'BANKS', 'RUTHERFORD', 'HACKETT',
  'SUPERTRAMP',
  'FLEETWOODMAC', 'BUCKINGHAM', 'NICKS', 'MCVIE',
  'VANHALEN', 'EDDIE', 'ROTH', 'HAGAR',
  'BONJOVI',
  'SABBATH', 'OZZY', 'IOMMI', 'BUTLER', 'WARD',
  'DIO',
  'IRONMAIDEN', 'DICKINSON', 'HARRIS',
  'JUDASPRIEST', 'HALFORD',
  'METALLICA',
  'RAMONES',
  'CLASH',
  'IGGY',
  'BOWIE',
  'SPRINGSTEEN',
  'PETTY', 'HEARTBREAKER',
  'SIMON', 'GARFUNKEL',
];

function randInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function pick(arr) {
  return arr[randInt(0, arr.length - 1)];
}

function pad3(n) {
  const s = String(n);
  if (s.length >= 3) return s.slice(-3);
  return s.padStart(3, '0');
}

function makeCandidate() {
  const word = pick(WORDS);
  const num = pad3(randInt(0, 999));
  return `${word}-${num}`;
}

module.exports = {
  async up(queryInterface, Sequelize) {
    const cols = await queryInterface.describeTable('Projects').catch(() => null);
    if (!cols) return;

    if (!cols.publicId) {
      await queryInterface.addColumn('Projects', 'publicId', {
        type: Sequelize.STRING,
        allowNull: true,
      });
    }

    // Unique index (defensive across partial deploys)
    const existingIdx = await queryInterface.showIndex('Projects').catch(() => []);
    const idxNames = new Set((existingIdx || []).map(ix => ix.name));
    if (!idxNames.has('projects_public_id_unique')) {
      await queryInterface.addIndex('Projects', ['publicId'], {
        name: 'projects_public_id_unique',
        unique: true,
      }).catch(() => {});
    }

    // Backfill for existing rows
    const [rows] = await queryInterface.sequelize.query(
      "SELECT id FROM \"Projects\" WHERE \"publicId\" IS NULL OR \"publicId\" = ''"
    ).catch(() => [[], null]);

    const used = new Set();

    for (const r of rows || []) {
      const id = r.id;
      if (!id) continue;

      let candidate = null;
      for (let attempt = 0; attempt < 50; attempt++) {
        const c = makeCandidate();
        if (used.has(c)) continue;

        const [existing] = await queryInterface.sequelize.query(
          "SELECT id FROM \"Projects\" WHERE \"publicId\" = :c LIMIT 1",
          { replacements: { c } }
        ).catch(() => [[], null]);

        if (existing && existing.length) continue;
        candidate = c;
        used.add(c);
        break;
      }

      if (!candidate) continue;

      await queryInterface.sequelize.query(
        "UPDATE \"Projects\" SET \"publicId\" = :c, \"updatedAt\" = CURRENT_TIMESTAMP WHERE id = :id",
        { replacements: { c: candidate, id } }
      ).catch(() => {});
    }
  },

  async down(queryInterface) {
    const cols = await queryInterface.describeTable('Projects').catch(() => null);
    if (!cols) return;

    await queryInterface.removeIndex('Projects', 'projects_public_id_unique').catch(() => {});

    if (cols.publicId) {
      await queryInterface.removeColumn('Projects', 'publicId').catch(() => {});
    }
  },
};
