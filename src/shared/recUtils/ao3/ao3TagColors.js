// AO3 tag color palette utility
// These are the default tag highlight colors as seen on AO3 (approximate)
// Order: yellow, orange, red, purple, blue, teal, green, gold, pink, gray
export const ao3TagColors = [
    '#ffe066', // yellow
    '#ffb366', // orange
    '#ff6666', // red
    '#b366ff', // purple
    '#66b3ff', // blue
    '#66ffb3', // teal
    '#b3ff66', // green
    '#ffd966', // gold
    '#ff66b3', // pink
    '#a3a3a3'  // gray
];
export const ao3TagColorName = {
    yellow: '#ffe066',
    orange: '#ffb366',
    red: '#ff6666',
    purple: '#b366ff',
    blue: '#66b3ff',
    teal: '#66ffb3',
    green: '#b3ff66',
    gold: '#ffd966',
    pink: '#ff66b3',
    gray: '#a3a3a3'
};
// AO3 rating colors (from AO3 CSS and community sources)
export const ao3RatingColors = {
    'general audiences': '#b3ff66', // green (approx. .rating-general)
    'teen and up audiences': '#ffe066', // yellow (approx. .rating-teen)
    'mature': '#ffb366', // orange (approx. .rating-mature)
    'explicit': '#ff6666', // red (approx. .rating-explicit)
    'not rated': '#a3a3a3' // gray (approx. .rating-notrated)
};

/**
 * Get AO3 rating color by normalized rating string
 * @param {string} rating
 * @returns {string} Hex color string
 */
export function getAo3RatingColor(rating) {
    return ao3RatingColors[rating] || ao3RatingColors['not rated'];
};

/**
 * Get AO3 tag color by index (wraps around if more tags than colors)
 * @param {number} i
 * @param {number} [alpha=1] - Alpha as 0..1, returns rgba if < 1
 * @returns {string} Hex or rgba color string
 */
export function getAo3TagColor(i, alpha = 1) {
    const hex = ao3TagColors[i % ao3TagColors.length];
    if (alpha >= 1) return hex;
    // Convert hex to rgba
    const num = parseInt(hex.replace('#', ''), 16);
    const r = (num >> 16) & 255;
    const g = (num >> 8) & 255;
    const b = num & 255;
    return `rgba(${r},${g},${b},${alpha})`;
};

export function lerpHexColor(colorStart, colorEnd, ratio, opacity = 1) {
    const startHex = parseInt(colorStart.slice(1), 16), endHex = parseInt(colorEnd.slice(1), 16);
    const startR = (startHex >> 16) & 255, startG = (startHex >> 8) & 255, startB = startHex & 255;
    const endR = (endHex >> 16) & 255, endG = (endHex >> 8) & 255, endB = endHex & 255;
    const r = Math.round(startR + (endR - startR) * ratio);
    const g = Math.round(startG + (endG - startG) * ratio);
    const bVal = Math.round(startB + (endB - startB) * ratio);
    return `rgba(${r},${g},${bVal},${opacity})`;
};

export function hexToRgba(hex, alpha = 0.85) {
    const num = typeof hex === 'number' ? hex : parseInt(hex.replace('#', ''), 16);
    const r = (num >> 16) & 255;
    const g = (num >> 8) & 255;
    const b = num & 255;
    return `rgba(${r},${g},${b},${alpha})`;
};

export default ao3TagColors;
