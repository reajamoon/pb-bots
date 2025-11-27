import updateMessages from '../text/updateMessages.js';
import { fetchHTML } from './fetchHtmlUtil.js';
import normalizeMetadata from './normalizeMetadata.js';

/**
 * Fetch metadata from a FFNet story
 * @param {string} url - The FFNet story URL
 * @param {boolean} includeRawHtml - Include raw HTML for debugging
 * @returns {Promise<Object>} - Fic metadata object
 */
async function fetchFFNetMetadata(url, includeRawHtml = false) {
    let html;
    
    try {
        html = await fetchHTML(url);
    } catch (error) {
        if (error.message === 'HTTP_404_NOT_FOUND') {
            return {
                title: 'Story Not Found',
                authors: ['Unknown Author'],
                url: url,
                error: '404_not_found',
                summary: updateMessages.notFound404,
                is404: true
            };
        } else if (error.message === 'HTTP_403_FORBIDDEN') {
            return {
                title: 'Access Denied',
                authors: ['Unknown Author'],
                url: url,
                error: 'Access denied',
                summary: updateMessages.forbidden403,
                is403: true
            };
        } else if (error.message.startsWith('HTTP_')) {
            return {
                title: 'Connection Error',
                authors: ['Unknown Author'],
                url: url,
                error: error.message,
                summary: updateMessages.connectionError,
                isHttpError: true
            };
        }
        return { error: 'Failed to fetch FFNet metadata' };
    }

    // Check for Cloudflare or other protection
    if (html.includes('challenge') || html.includes('cloudflare') || html.includes('Enable JavaScript')) {
        const result = {
            title: 'Unknown Title',
            authors: ['Unknown Author'],
            url: url,
            error: 'Site protection detected',
            summary: updateMessages.siteProtection
        };
        if (includeRawHtml) result.rawHtml = html.substring(0, 500) + '...';
        return result;
    }

    try {
        const metadata = { url: url };
        // Always set archiveWarnings to an empty array unless found
        metadata.archiveWarnings = [];

        // Multiple patterns for title - FFNet has changed their HTML structure over time
        let titleMatch = html.match(/<b class='xcontrast_txt'>([^<]+)/);
        if (!titleMatch) {
            titleMatch = html.match(/<title>([^|]+)/);
            if (titleMatch) {
                metadata.title = titleMatch[1].replace('Chapter 1:', '').trim();
            }
        } else {
            metadata.title = titleMatch[1].trim();
        }

        if (!metadata.title) {
            metadata.title = 'Unknown Title';
        }

        // Multiple patterns for author
        let authorMatch = html.match(/<a class='xcontrast_txt' href='\/u\/\d+\/[^']*'>([^<]+)/);
        if (!authorMatch) {
            authorMatch = html.match(/By:\s*<a[^>]*>([^<]+)/i);
        }
        metadata.authors = [authorMatch ? authorMatch[1].trim() : 'Unknown Author'];

        // Summary - multiple patterns
        let summaryMatch = html.match(/<div class='xcontrast_txt' style='margin-top:2px'>([^<]+)/);
        if (!summaryMatch) {
            summaryMatch = html.match(/<div[^>]*class="[^"]*storytext[^"]*"[^>]*>(.*?)<\/div>/s);
            if (summaryMatch) {
                metadata.summary = summaryMatch[1].replace(/<[^>]*>/g, '').trim().substring(0, 500);
            }
        } else {
            metadata.summary = summaryMatch[1].trim();
        }

        // Try to find metadata in various formats
        const metaPatterns = [
            /<span class='xgray xcontrast_txt'>([^<]+)/,
            /<span[^>]*class="[^"]*xgray[^"]*"[^>]*>([^<]+)/,
            /<div[^>]*id="profile_top"[^>]*>(.*?)<\/div>/s
        ];

        let metaText = '';
        for (const pattern of metaPatterns) {
            const match = html.match(pattern);
            if (match) {
                metaText = match[1];
                break;
            }
        }

        if (metaText) {
            // Look for rating
            const ratingMatch = metaText.match(/Rated:\s*([^\-\s]+)/i);
            metadata.rating = ratingMatch ? ratingMatch[1].trim() : 'Not Rated';

            // Look for language
            const languageMatch = metaText.match(/(?:English|Spanish|French|German|Italian|Portuguese|Russian)\b/i);
            metadata.language = languageMatch ? languageMatch[0] : 'English';

            // Look for word count
            const wordMatch = metaText.match(/Words:\s*([\d,]+)/i);
            if (wordMatch) {
                metadata.wordCount = parseInt(wordMatch[1].replace(/,/g, ''));
            }

            // Look for chapters
            const chapterMatch = metaText.match(/Chapters:\s*(\d+)/i);
            metadata.chapters = chapterMatch ? chapterMatch[1] : '1';

            // Status
            metadata.status = metaText.match(/Complete/i) ? 'Complete' : 'Work in Progress';

            // Look for published/updated dates
            const publishedMatch = metaText.match(/Published:\s*([^-]+)/i);
            if (publishedMatch) {
                try {
                    metadata.publishedDate = new Date(publishedMatch[1]).toISOString().split('T')[0];
                } catch {
                    metadata.publishedDate = null;
                }
            }

            const updatedMatch = metaText.match(/Updated:\s*([^-]+)/i);
            if (updatedMatch) {
                try {
                    metadata.updatedDate = new Date(updatedMatch[1].trim()).toISOString().split('T')[0];
                } catch {
                    metadata.updatedDate = null;
                }
            }
        }

        if (includeRawHtml) metadata.rawHtml = html;
        
        // Remove legacy 'author' field if present
        if (metadata.author) delete metadata.author;
        
        // Ensure archiveWarnings is always an array
        if (!Array.isArray(metadata.archiveWarnings)) metadata.archiveWarnings = [];
        
        return normalizeMetadata(metadata, 'ffnet');
        
    } catch (error) {
        return { error: 'Failed to parse FFNet metadata' };
    }
}

export { fetchFFNetMetadata };
