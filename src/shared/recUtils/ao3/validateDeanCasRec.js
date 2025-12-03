// AO3 fic tag validation for Castiel/Dean Winchester rec library
// Returns { valid: boolean, reason: string|null }

const CANONICAL_SHIP = 'castiel/dean winchester';
const CANONICAL_FANDOM = 'supernatural';

// Synonyms and normalizers for fandom and relationship tags
const FANDOM_ALIASES = [
  'supernatural',
  'supernatural (tv 2005)',
  'spn',
  'spn rpf' // allow if relationship tags clearly indicate Dean/Cas (rare)
];

const SHIP_ALIASES = [
  'castiel/dean winchester',
  'dean winchester/castiel',
  'dean/castiel',
  'castiel/dean',
  'destiel',
  'dean/cas',
  'cas/dean',
  'deancas',
  'castiel (supernatural)/dean winchester'
];

function normalizeTag(s) {
  return s.trim().toLowerCase().replace(/\s+/g, ' ');
}

function isSupernaturalFandomTag(tag) {
  const t = normalizeTag(tag).replace(/\s*\([^)]*\)\s*/g, match => match); // keep variants
  return FANDOM_ALIASES.some(a => t.includes(a));
}

function isDeanCasExactShip(tag) {
  const t = normalizeTag(tag).replace(/\s*\([^)]*\)\s*/g, '');
  if (t.includes('&')) return false; // friendship
  if (isQualifier(tag)) return true; // allow qualified pairings
  // direct alias match
  if (SHIP_ALIASES.includes(t)) return true;
  // split and check names
  const parts = t.split('/').map(p => p.trim()).filter(Boolean);
  const names = parts.map(p => p.replace(/\s*\([^)]*\)\s*/g, '').trim());
  const hasDean = names.some(n => n === 'dean winchester' || n === 'dean');
  const hasCas = names.some(n => n === 'castiel' || n === 'cas');
  return hasDean && hasCas && names.length === 2;
}

// Qualifiers indicating non-primary/on-rails pairing that should be allowed
function isQualifier(tag) {
  const t = normalizeTag(tag);
  const QUALIFIERS = [
    'past',
    'minor',
    'background',
    'offscreen',
    'off-screen',
    'off stage',
    'offstage',
    'off camera',
    'off-camera',
    'implied',
    'hinted',
    'suggested',
    'behind the scenes',
    'not shown',
    'unseen',
    'if you squint'
    'referenced',
    'reference',
    'mentioned'
  ];
  // Quick match on any qualifier token
  if (QUALIFIERS.some(q => t.includes(q))) return true;
  // Phrase-level checks for common disambiguations
  if (/behind the scenes|occurs? behind the scenes|is not shown|not (depicted|shown)/i.test(tag)) return true;
  return false;
}

/**
 * Checks if a fic meets the fandom/ship requirements for this library.
 * @param {string[]} fandomTags - Array of fandom tags
 * @param {string[]} relationshipTags - Array of relationship tags
 * @returns {{ valid: boolean, reason: string|null }}
 */

export function validateDeanCasRec(fandomTags, relationshipTags, freeformTags = []) {
  // 1. Must have Supernatural fandom (allow common aliases)
  if (!Array.isArray(fandomTags) || !fandomTags.some(isSupernaturalFandomTag)) {
    return { valid: false, reason: 'Missing Supernatural fandom tag.' };
  }
  // 2. If no relationship tags, treat as gen (allowed)
  if (!relationshipTags || relationshipTags.length === 0) {
    return { valid: true, reason: null };
  }
  // 3. Strict multishipping exclusion: if any tag (not past/minor/&)
  // contains 'dean winchester' or 'castiel' and also anyone else (not just each other), reject
  for (const tag of relationshipTags) {
    const t = tag.trim();
    if (t.includes('&')) continue; // friendship, allowed
    if (isQualifier(t)) continue; // allow if marked with qualifier
    if (isDeanCasExactShip(t)) continue; // exactly our OTP
    const parts = normalizeTag(t).split('/').map(s => s.trim()).filter(Boolean);
    const hasDean = parts.some(p => p === 'dean winchester' || p === 'dean');
    const hasCas = parts.some(p => p === 'castiel' || p === 'cas');
    // If tag contains Dean or Cas and anyone else (beyond each other), reject
    if ((hasDean || hasCas) && parts.length > 1 && !(hasDean && hasCas && parts.length === 2)) {
      return { valid: false, reason: `Detected multishipping or non-OTP: ${tag}` };
    }
  }
  // 5. Consider freeform tags for qualifier context; if any strong qualifier appears, allow
  if (Array.isArray(freeformTags) && freeformTags.some(isQualifier)) {
    return { valid: true, reason: null };
  }
  // 4. If only gen or exactly Dean/Cas, allow
  return { valid: true, reason: null };
}
