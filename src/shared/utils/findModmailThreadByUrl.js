// Finds an existing modmail thread that references a given fic URL.
// Searches active threads first, then falls back to cached/archived threads if available.
// Returns the ThreadChannel or null.

export async function findModmailThreadByUrl(modmailChannel, ficUrl, cache = null) {
  if (!modmailChannel || !ficUrl) return null;
  // Normalize URL to reduce false negatives
  let normalized = ficUrl.replace(/\/?$/, '');
  try {
    const { normalizeAO3Url } = await import('../recUtils/normalizeAO3Url.js');
    normalized = normalizeAO3Url(normalized);
  } catch {}
  // Tiny cache: check for a cached thread id for this URL
  if (cache && typeof cache.get === 'function') {
    const cachedId = cache.get(normalized) || cache.get(ficUrl);
    if (cachedId) {
      const t = modmailChannel.threads.cache.get(cachedId);
      if (t) return t;
    }
  }
  // 1) Check active threads
  try {
    const active = await modmailChannel.threads.fetchActive();
    const candidates = active && active.threads ? active.threads : modmailChannel.threads.cache;
    for (const [, t] of candidates) {
      try {
        const starter = await t.fetchStarterMessage();
        const content = starter && starter.content ? starter.content : '';
        if (content && (content.includes(normalized) || content.includes(ficUrl))) {
          if (cache && typeof cache.set === 'function') cache.set(normalized, t.id);
          return t;
        }
      } catch {}
    }
  } catch {}
  // 2) Check archived threads cache if present (Discord.js may cache some)
  try {
    const archived = await modmailChannel.threads.fetchArchived({ type: 'public' }).catch(() => null);
    const archivedThreads = archived && archived.threads ? archived.threads : [];
    for (const [, t] of archivedThreads) {
      try {
        const starter = await t.fetchStarterMessage();
        const content = starter && starter.content ? starter.content : '';
        if (content && (content.includes(normalized) || content.includes(ficUrl))) {
          if (cache && typeof cache.set === 'function') cache.set(normalized, t.id);
          return t;
        }
      } catch {}
    }
  } catch {}
  return null;
}
