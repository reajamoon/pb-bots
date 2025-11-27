// AO3 fic tag validation for Castiel/Dean Winchester rec library
// Returns { valid: boolean, reason: string|null }

const CANONICAL_SHIP = 'Castiel/Dean Winchester';
const CANONICAL_FANDOM = 'Supernatural (TV 2005)';

/**
 * Checks if a fic meets the fandom/ship requirements for this library.
 * @param {string[]} fandomTags - Array of fandom tags
 * @param {string[]} relationshipTags - Array of relationship tags
 * @returns {{ valid: boolean, reason: string|null }}
 */

export function validateDeanCasRec(fandomTags, relationshipTags) {
  // 1. Must have Supernatural fandom (allow variations with/without year/parentheses)
  const supernaturalRegex = /^supernatural(\s*\(.*\))?$/i;
  if (!fandomTags.some(f => supernaturalRegex.test(f.trim()))) {
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
    if (/past|minor/i.test(t)) continue; // allow if marked as past/minor
    const parts = t.split('/').map(s => s.trim().toLowerCase()).filter(Boolean);
    const hasDean = parts.includes('dean winchester');
    const hasCas = parts.includes('castiel');
    // If tag is exactly Dean/Cas (in any order, only those two), allow
    if (hasDean && hasCas && parts.length === 2) continue;
    // If tag contains Dean or Cas and anyone else, reject
    if ((hasDean || hasCas) && parts.length > 1) {
      return { valid: false, reason: `Detected multishipping or non-OTP: ${tag}` };
    }
  }
  // 4. If only gen or exactly Dean/Cas, allow
  return { valid: true, reason: null };
}
