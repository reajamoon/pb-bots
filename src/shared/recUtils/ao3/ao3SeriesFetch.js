// ao3SeriesFetch.js
// Fetches and parses AO3 series metadata

import { getLoggedInAO3Page, bypassStayLoggedInInterstitial } from './ao3Utils.js';

// Series pages often wait on child work parsing; allow longer timeouts.
const SERIES_NAV_TIMEOUT = (() => {
    const fromEnv = parseInt(process.env.AO3_SERIES_NAV_TIMEOUT, 10);
    if (!Number.isNaN(fromEnv) && fromEnv > 0) return fromEnv;
    const base = parseInt(process.env.AO3_NAV_TIMEOUT, 10);
    if (!Number.isNaN(base) && base > 0) return Math.max(base * 1.5, base + 60000);
    return 240000; // default 4 minutes for series navigations
})();
import { parseAO3SeriesMetadata } from './ao3SeriesParser.js';

async function fetchAO3SeriesMetadata(url, includeRawHtml = false) {
    let html, browser, page;
    try {
        const loginResult = await getLoggedInAO3Page(url);
        browser = loginResult.browser;
        page = loginResult.page;
        await page.goto(url, { waitUntil: 'domcontentloaded', timeout: SERIES_NAV_TIMEOUT });
        await bypassStayLoggedInInterstitial(page, url);
        html = await page.content();
        if (browser && browser.isConnected()) {
            try { await browser.close(); } catch {}
        }
        const metadata = parseAO3SeriesMetadata(html, url);
        if (includeRawHtml) metadata.rawHtml = html;
        return metadata;
    } catch (err) {
        if (browser && browser.isConnected()) {
            try { await browser.close(); } catch {}
        }
        // Debug: print full error stack to help trace 'fs is not defined'
        console.error('[AO3 SERIES FETCH ERROR]', err && err.stack ? err.stack : err);
        return {
            url,
            type: 'series',
            error: true,
            message: 'Failed to fetch AO3 series metadata',
            details: err && err.message ? err.message : err
        };
    }
}

export { fetchAO3SeriesMetadata };
