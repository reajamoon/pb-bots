// Utility for building and parsing stats button customIds with message tracking
import { encodeMessageId, decodeMessageId } from '../../../shared/utils/messageTracking.js';

const STATS_BUTTON_PREFIX = 'stats_charts';

export function buildStatsButtonId(context = '', messageId = '') {
    // Encode messageId for safe inclusion
    const encodedMsgId = messageId ? encodeMessageId(messageId) : '';
    return context || encodedMsgId
        ? `${STATS_BUTTON_PREFIX}:${context}${encodedMsgId ? `:${encodedMsgId}` : ''}`
        : STATS_BUTTON_PREFIX;
}

export function parseStatsButtonId(customId) {
    if (!customId.startsWith(STATS_BUTTON_PREFIX)) return null;
    const parts = customId.split(':');
    // parts[1] = context, parts[2] = encodedMsgId
    return {
        context: parts[1] || '',
        messageId: parts[2] ? decodeMessageId(parts[2]) : ''
    };
}
