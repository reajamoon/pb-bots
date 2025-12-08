// ao3QueueRateHelper.js
// Utility for AO3 queue-aware rate limiting


// Minimum interval between AO3 requests (default: 20s)
export const MIN_INTERVAL_MS = parseInt(process.env.AO3_MIN_REQUEST_INTERVAL_MS, 10) || 20000;
// Apply slight variability to intervals to avoid synchronized pacing
function withJitter(baseMs) {
    // ±10% jitter
    const jitterRatio = (Math.random() * 0.2) - 0.1;
    return Math.max(0, Math.floor(baseMs + baseMs * jitterRatio));
}
let lastRequestTime = 0;


/**
 * Returns the next available time (ms since epoch) when AO3 requests can be made.
 * @param {number} numRequests - Number of AO3 requests to schedule.
 */
export function getNextAvailableAO3Time(numRequests = 1) {
    const now = Date.now();
    const base = MIN_INTERVAL_MS * numRequests;
    const earliest = lastRequestTime + withJitter(base);
    return Math.max(now, earliest);
}

/**
 * Marks AO3 requests as used, advancing the limiter.
 * @param {number} numRequests - Number of AO3 requests just made.
 */
export function markAO3Requests(numRequests = 1) {
    const base = MIN_INTERVAL_MS * numRequests;
    lastRequestTime = Math.max(Date.now(), lastRequestTime + withJitter(base));
}

/**
 * Resets the AO3 rate limiter (for testing/ops).
 */
export function resetAO3RateLimiter() {
    lastRequestTime = 0;
}
