// AO3 fic tag validation for Castiel/Dean Winchester rec library
// Returns { valid: boolean, reason: string|null }

const CANONICAL_SHIP = 'castiel/dean winchester';
const CANONICAL_FANDOM = 'supernatural';

// Synonyms and normalizers for fandom and relationship tags
const FANDOM_ALIASES = [
  'supernatural',
  'supernatural (tv 2005)',
  'supernatural (2005)',
  'supernatural (tv)',
  'supernatural (tv series)',
  'supernatural (tv series 2005)',
  'supernatural - all media types',
  'supernatural (all media types)',
  'spn'
  // Note: do not include 'spn rpf' here; handle RPF separately
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
  const t = normalizeTag(tag);
  // Broad match: any tag containing 'supernatural' qualifies (handled RPF separately)
  if (/\bsupernatural\b/.test(t)) return true;
  // Alias match
  return FANDOM_ALIASES.some(a => t.includes(a));
}

function isSPNRpfTag(tag) {
  const t = normalizeTag(tag);
  return /\b(supernatural|spn)\b/.test(t) && /\brpf\b/.test(t);
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
    'if you squint',
    'referenced',
    'reference',
    'mentioned',
    'former',
    'ex-',
    'previously',
    'history of',
    'brief',
    'fleeting',
    'short',
    'small role',
    'subplot',
    'side-plot',
    'incidental',
    'subtext',
    'read-between-the-lines',
    'name-dropped',
    'alluded to',
    'nod to',
    'not depicted',
    'pre-relationship',
    'pre-ship',
    'pre-romance',
    'before they’re together',
    'post-breakup',
    'after breakup',
    'broken up',
    'past tense',
    'flashback',
    'memory',
    'recalled',
    'prior chapter',
    'prior event',
    'one-sided',
    'unrequited',
    'pining-only',
    'crush-only',
    'not focus',
    'not central',
    'barely mentioned',
    'a long time ago',
    'widowed',
    'long past',
  ];
  // Quick match on any qualifier token
  if (QUALIFIERS.some(q => t.includes(q))) return true;
  // Phrase-level checks for common disambiguations
  if (/behind the scenes|occurs? behind the scenes|is not shown|not (depicted|shown)|post[- ]breakup|after (a )?breakup|broken up|pre[- ](relationship|ship|romance)|one[- ]sided|unrequited|not (the )?main pairing|secondary pairing/i.test(tag)) return true;
  return false;
}

/**
 * Checks if a fic meets the fandom/ship requirements for this library.
 * @param {string[]} fandomTags - Array of fandom tags
 * @param {string[]} relationshipTags - Array of relationship tags
 * @returns {{ valid: boolean, reason: string|null }}
 */

export async function validateDeanCasRec(fandomTags, relationshipTags, freeformTags = [], cheerioRootForLinks = null) {
  // 1. Must have Supernatural fandom (allow common variants) OR explicit Dean/Cas pairing
  const fandomArray = Array.isArray(fandomTags) ? fandomTags : [];
  const relArray = Array.isArray(relationshipTags) ? relationshipTags : [];
  const freeArray = Array.isArray(freeformTags) ? freeformTags : [];

  // Prefer canonical slug validation when Cheerio root is available
  let hasMainlineSPN = false;
  let hasSPNRpf = false;
  try {
    if (cheerioRootForLinks) {
      const { fandomTagLinks, normalizeFandomSlugToText } = await import('./parseTagList.js');
      const links = fandomTagLinks(cheerioRootForLinks);
      const normSlug = s => {
        let raw = String(s || '');
        try { raw = decodeURIComponent(raw); } catch {}
        return raw.toLowerCase().replace(/\s+/g, ' ').replace(/\+/g, ' ').trim();
      };
      const MAIN_SPN_SLUGS = new Set([
        'supernatural (tv 2005)',
        'supernatural - all media types'
      ]);
      hasMainlineSPN = Array.isArray(links) && links.some(l => {
        const slugNorm = normSlug(l.slug);
        const textNorm = normalizeTag(normalizeFandomSlugToText(l.slug));
        return MAIN_SPN_SLUGS.has(slugNorm) || /\bsupernatural\b/.test(slugNorm) || /\bsupernatural\b/.test(textNorm);
      });
      hasSPNRpf = Array.isArray(links) && links.some(l => normSlug(l.slug) === 'spn rpf' || normSlug(l.slug).includes('supernatural rpf'));
    }
  } catch {}
  if (!hasMainlineSPN && !hasSPNRpf) {
    hasMainlineSPN = fandomArray.some(tag => isSupernaturalFandomTag(tag) && !isSPNRpfTag(tag));
    hasSPNRpf = fandomArray.some(isSPNRpfTag);
  }

  // Consider both relationship tags and, as a fallback, freeform tags for ship aliases like 'destiel'
  const freeformHasShipAlias = freeArray.some(t => SHIP_ALIASES.includes(normalizeTag(t)));
  let hasExplicitDeanCas = relArray.some(isDeanCasExactShip) || freeformHasShipAlias;
  try {
    if (cheerioRootForLinks) {
      const { relationshipTagLinks, normalizeRelationshipSlugToText } = await import('./parseTagList.js');
      const links = relationshipTagLinks(cheerioRootForLinks);
      const normSlug = s => {
        let raw = String(s || '');
        try { raw = decodeURIComponent(raw); } catch {}
        return raw.toLowerCase().replace(/\s+/g, ' ').replace(/\+/g, ' ').trim();
      };
      const normText = s => String(s || '').toLowerCase().replace(/\s+/g, ' ').trim();
      const REL_SPN_SLUGS = new Set([
        'castiel*s*dean winchester',
        'dean winchester*s*castiel'
      ]);
      const REL_TEXT_ALIASES = new Set(SHIP_ALIASES.map(a => a.toLowerCase()));
      hasExplicitDeanCas = hasExplicitDeanCas || (
        Array.isArray(links) && links.some(l => {
          const slug = normSlug(l.slug);
          const text = normText(l.text);
          const canonText = normText(normalizeRelationshipSlugToText(l.slug));
          return REL_SPN_SLUGS.has(slug) || REL_TEXT_ALIASES.has(text) || REL_TEXT_ALIASES.has(canonText);
        })
      );
    }
  } catch {}

  // Accept if:
  // - Mainline Supernatural fandom is present; OR
  // - Explicit Dean/Cas pairing is present (relationship or freeform alias); OR
  // - SPN RPF fandom with explicit Dean/Cas pairing
  if (!(hasMainlineSPN || hasExplicitDeanCas || (hasSPNRpf && hasExplicitDeanCas))) {
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
