// Simple in-memory cache for stats chart files
// Keyed by userId or custom key, values are { files: [AttachmentBuilder, ...], expires: timestamp }

const cache = new Map();
const DEFAULT_TTL = 5 * 60 * 1000; // 5 minutes

export function setStatsChartCache(key, files, ttl = DEFAULT_TTL) {
    cache.set(key, {
        files,
        expires: Date.now() + ttl
    });
}

export function getStatsChartCache(key) {
    const entry = cache.get(key);
    if (!entry) return null;
    if (Date.now() > entry.expires) {
        cache.delete(key);
        return null;
    }
    return entry.files;
}

export function clearStatsChartCache(key) {
    cache.delete(key);
}
// Periodic cleanup of expired cache entries
const CLEANUP_INTERVAL = 60 * 5000; // 1 minute
setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of cache.entries()) {
        if (entry.expires < now) {
            cache.delete(key);
        }
    }
}, CLEANUP_INTERVAL);
