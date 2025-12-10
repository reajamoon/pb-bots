// processAO3Job.js
// Clean implementation for processing AO3 data (used by queue worker)
// User metadata (notes, manual fields) is handled separately by command handlers

import { Recommendation, Series, ModLock, RecommendationFields, SeriesFields } from '../../models/index.js';
import { fetchFicMetadata } from './ficParser.js';
import { isFieldGloballyModlocked, shouldBotsRespectGlobalModlocks } from '../utils/globalModlockUtils.js';
import { createRecEmbed } from './createRecEmbed.js';
import normalizeAO3Url from './normalizeAO3Url.js';
import updateMessages from '../text/updateMessages.js';

/**
 * Processes AO3 recommendation data from queue worker.
 * This function ONLY handles AO3 metadata - user metadata is handled separately.
 * @param {Object} payload - Job payload from queue
 * @param {number} payload.ao3ID - AO3 work ID
 * @param {number} [payload.seriesId] - Database series ID if part of a series
 * @param {Object} payload.user - User context (id, username)
 * @param {boolean} [payload.isUpdate] - Whether updating existing recommendation
 * @param {string} [payload.type] - Type: 'work' or 'series'
 * @param {boolean} [payload.notPrimaryWork] - Flag for non-primary works in series
 * @returns {Promise<{embed: Object, recommendation: Recommendation, error?: string}>}
 */
async function processAO3Job(payload) {
  const {
    ao3ID,
    seriesId,
    user,
    isUpdate = false,
    type = 'work',
    notPrimaryWork = false,
    part = null
  } = payload;

  // Build AO3 URL from work ID
  const url = `https://archiveofourown.org/works/${ao3ID}`;

  // Fetch AO3 metadata
  let metadata;
  try {
    metadata = await fetchFicMetadata(url);

    // Unwrap { metadata } if present (AO3 parser returns { metadata: ... })
    if (metadata && metadata.metadata && typeof metadata.metadata === 'object') {
      metadata = metadata.metadata;
    }

    // Restore stats fields to top-level if present in stats
    if (metadata && metadata.stats) {
      const statsMap = {
        rating: 'rating',
        words: 'wordCount',
        chapters: 'chapters',
        status: 'status',
        published: 'publishedDate',
        updated: 'updatedDate',
        kudos: 'kudos',
        hits: 'hits',
        bookmarks: 'bookmarks',
        comments: 'comments',
      };

      for (const [statsKey, metaKey] of Object.entries(statsMap)) {
        if (metadata.stats[statsKey] !== undefined && metadata[metaKey] === undefined) {
          metadata[metaKey] = metadata.stats[statsKey];
        }
      }
    }

    if (metadata && metadata.url) {
      metadata.url = normalizeAO3Url(metadata.url);
    }
  } catch (err) {
    console.error('[processAO3Job] Error fetching metadata:', err);
    return { error: updateMessages.genericError };
  }

  if (!metadata) {
    console.error('[processAO3Job] Metadata fetch returned null for URL:', url);
    return { error: updateMessages.genericError };
  }

  // Check if mods have approved validation override (persisted flag)
  let skipValidationDueToOverride = false;
  try {
    // Prefer ao3ID match; fallback to seriesId-based override
    const overrides = [];
    if (ao3ID) {
      overrides.push(await ModLock.findOne({ where: { ao3ID: String(ao3ID), field: 'validation_override', locked: true } }));
    }
    if (!overrides[0] && seriesId) {
      // Map DB seriesId to AO3 series numeric ID via Series.url
      try {
        const seriesRecord = await Series.findByPk(seriesId);
        const ao3SeriesMatch = seriesRecord && seriesRecord.url ? seriesRecord.url.match(/archiveofourown\.org\/series\/(\d+)/) : null;
        const ao3SeriesId = ao3SeriesMatch ? parseInt(ao3SeriesMatch[1], 10) : null;
        if (ao3SeriesId) {
          overrides.push(await ModLock.findOne({ where: { seriesId: ao3SeriesId, field: 'validation_override', locked: true } }));
        }
      } catch {}
    }
    skipValidationDueToOverride = !!(overrides.find(Boolean));
    if (skipValidationDueToOverride) {
      console.log('[processAO3Job] Validation override detected; skipping Dean/Cas check.', {
        ao3ID,
        seriesId,
        overrideSource: overrides[0] && overrides[0].ao3ID ? 'work' : 'series'
      });
    }
  } catch (e) {
    // If override check fails, do not skip validation
    skipValidationDueToOverride = false;
  }

  // Handle AO3 errors
  if (metadata.error && metadata.error === 'Site protection detected') {
    return { error: 'Site protection detected. Manual entry required.' };
  }
  if (metadata.is404 || (metadata.error && metadata.error === '404_not_found')) {
    return { error: '404_not_found' };
  }
  if (metadata.is403) {
    return { error: '403_forbidden' };
  }
  if (metadata.isHttpError) {
    return { error: 'connection_error' };
  }

  // Dean/Cas validation (skip if override flag is set)
  if (!skipValidationDueToOverride) {
    try {
      const { validateDeanCasRec } = await import('./ao3/validateDeanCasRec.js');
      const fandomTags = metadata.fandom_tags || metadata.fandom || [];
      const relationshipTags = metadata.relationship_tags || [];
      const freeformTags = metadata.freeform_tags || [];
      // Targeted debug: show counts and samples prior to validation
      try {
        console.log('[processAO3Job] Dean/Cas validation inputs:', {
          ao3ID,
          fandomCount: Array.isArray(fandomTags) ? fandomTags.length : 0,
          fandomSample: Array.isArray(fandomTags) ? fandomTags.slice(0, 5) : [],
          relationshipCount: Array.isArray(relationshipTags) ? relationshipTags.length : 0,
          relationshipSample: Array.isArray(relationshipTags) ? relationshipTags.slice(0, 5) : [],
          freeformCount: Array.isArray(freeformTags) ? freeformTags.length : 0,
          freeformSample: Array.isArray(freeformTags) ? freeformTags.slice(0, 5) : []
        });
      } catch {}
      const validation = validateDeanCasRec(fandomTags, relationshipTags, freeformTags);
      
      if (!validation.valid) {
        // Defensive: re-check override just in case it was created during requeue
        try {
          const workOverride = ao3ID ? await ModLock.findOne({ where: { ao3ID: String(ao3ID), field: 'validation_override', locked: true } }) : null;
          if (workOverride) {
            console.log('[processAO3Job] Post-validation override detected; allowing work to pass.', { ao3ID });
          } else {
            console.log('[processAO3Job] Dean/Cas validation failed with no override; flagging nOTP.', {
              ao3ID,
              seriesId,
              fandomTags,
              relationshipTags,
              freeformTags,
              reason: validation.reason
            });
            return { error: 'validation_failed', error_message: validation.reason || 'Failed Dean/Cas validation' };
          }
        } catch {
          return { error: 'validation_failed', error_message: validation.reason || 'Failed Dean/Cas validation' };
        }
      }
    } catch (err) {
      console.error('[processAO3Job] Error in Dean/Cas validation:', err);
      return { error: 'Dean/Cas validation error' };
    }
  }

  // Normalize metadata for AO3
  const normalizeMetadataModule = await import('./normalizeMetadata.js');
  const normalizeMetadata = normalizeMetadataModule.default || normalizeMetadataModule;
  metadata = normalizeMetadata(metadata, 'ao3');

  // Ensure required fields
  if (!metadata || !metadata.title || !user || !user.id || !user.username) {
    console.error('[processAO3Job] Missing required fields:', { metadata, user });
    return { error: updateMessages.genericError };
  }

  let recommendation;

  if (isUpdate) {
    // Find existing recommendation by ao3ID
    const existingRec = await Recommendation.findOne({ where: { [RecommendationFields.ao3ID]: ao3ID } });

    if (!existingRec) {
      console.error('[processAO3Job] Update requested but no existing recommendation found for ao3ID:', ao3ID);
      return { error: updateMessages.genericError };
    }

    // Resolve locked fields (always respect active locks regardless of requester)
      // ModLocks apply to user edits only — automated AO3 updates bypass them
      const lockedFields = new Set();

    // Update with fresh AO3 data (filter out locked fields)
    const updateFields = await buildUpdateFields(existingRec, metadata, seriesId, notPrimaryWork, lockedFields, part);

    // Debug logging for all updates
    console.log('[processAO3Job] Update fields generated:', {
      ao3ID: existingRec.ao3ID,
      updateFieldKeys: Object.keys(updateFields),
      hasAuthorsUpdate: 'authors' in updateFields,
      authorsUpdate: updateFields.authors,
      fandomTagsLen: Array.isArray(updateFields.fandom_tags) ? updateFields.fandom_tags.length : undefined,
      relationshipTagsLen: Array.isArray(updateFields.relationship_tags) ? updateFields.relationship_tags.length : undefined,
      freeformTagsLen: Array.isArray(updateFields.freeform_tags) ? updateFields.freeform_tags.length : undefined
    });

    if (Object.keys(updateFields).length > 0) {
      try {
        await existingRec.update(updateFields);
        await existingRec.reload();
        console.log('[processAO3Job] Successfully updated recommendation:', existingRec.ao3ID);
      } catch (err) {
        console.error('[processAO3Job] Error updating recommendation:', err);
        return { error: updateMessages.genericError };
      }
    } else {
      console.log('[processAO3Job] No fields to update for:', existingRec.ao3ID);
    }

    recommendation = existingRec;
  } else {
    // Create new recommendation
    try {
      recommendation = await Recommendation.create({
        url,
        title: metadata.title,
        author: (metadata.authors && metadata.authors[0]) || metadata.author || 'Unknown Author',
        authors: metadata.authors || (metadata.author ? [metadata.author] : ['Unknown Author']),
        summary: metadata.summary,
        tags: Array.isArray(metadata.tags) ? metadata.tags : [],
        // Persist AO3 tag groups
        fandom_tags: Array.isArray(metadata.fandom_tags) ? metadata.fandom_tags : (Array.isArray(metadata.fandom) ? metadata.fandom : []),
        relationship_tags: Array.isArray(metadata.relationship_tags) ? metadata.relationship_tags : [],
        freeform_tags: Array.isArray(metadata.freeform_tags) ? metadata.freeform_tags : [],
        rating: metadata.rating,
        wordCount: metadata.wordCount,
        chapters: metadata.chapters,
        status: metadata.status,
        language: metadata.language,
        publishedDate: metadata.publishedDate,
        updatedDate: metadata.updatedDate,
        [RecommendationFields.recommendedBy]: user.id,
        [RecommendationFields.recommendedByUsername]: user.username,
        archive_warnings: Array.isArray(metadata.archiveWarnings) ? metadata.archiveWarnings : [],
        kudos: metadata.kudos,
        hits: metadata.hits,
        bookmarks: metadata.bookmarks,
        comments: metadata.comments,
        category: metadata.category,
        [RecommendationFields.ao3ID]: ao3ID,
        // Only persist normalized AO3 freeform/general tags on Recommendation
        ...(seriesId ? { [RecommendationFields.seriesId]: seriesId } : {}),
        notPrimaryWork,
        ...(part ? { part } : {})
      });
      console.log('[processAO3Job] Create recommendation tag debug:', {
        ao3ID,
        fandomTagsLen: Array.isArray(metadata.fandom_tags) ? metadata.fandom_tags.length : (Array.isArray(metadata.fandom) ? metadata.fandom.length : 0),
        relationshipTagsLen: Array.isArray(metadata.relationship_tags) ? metadata.relationship_tags.length : 0,
        freeformTagsLen: Array.isArray(metadata.freeform_tags) ? metadata.freeform_tags.length : 0
      });
    } catch (err) {
      console.error('[processAO3Job] Error creating recommendation:', err);
      return { error: updateMessages.genericError };
    }
  }

  // Generate embed from database record
  const embed = createRecEmbed(recommendation);

  return { embed, recommendation };
}

/**
 * Builds update fields object by comparing existing and new metadata
 */
function isUnset(val) {
  if (val === null || val === undefined) return true;
  if (typeof val === 'string') return val.trim().length === 0;
  if (Array.isArray(val)) return val.length === 0;
  return false;
}

async function buildUpdateFields(existingRec, metadata, seriesId, notPrimaryWork, lockedFields = new Set(), part = null) {
  const updateFields = {};

  // Check each field for changes
  if (existingRec.title !== metadata.title && !lockedFields.has('title')) {
    updateFields.title = metadata.title;
  }

  // Authors comparison
  const newAuthors = metadata.authors || (metadata.author ? [metadata.author] : ['Unknown Author']);
  const authorsChanged = !Array.isArray(existingRec.authors) ||
    existingRec.authors.length !== newAuthors.length ||
    existingRec.authors.some((a, i) => a !== newAuthors[i]);

  // Debug logging for author updates
  console.log('[buildUpdateFields] Author comparison:', {
    existingAuthors: existingRec.authors,
    newAuthors: newAuthors,
    authorsChanged: authorsChanged,
    ao3ID: existingRec.ao3ID
  });

  if (authorsChanged && !lockedFields.has('author') && !lockedFields.has('authors')) {
    updateFields.authors = newAuthors;
    updateFields.author = newAuthors[0] || 'Unknown Author'; // Legacy field
    console.log('[buildUpdateFields] Authors will be updated:', { newAuthors, ao3ID: existingRec.ao3ID });
  }

  if (existingRec.summary !== metadata.summary && !lockedFields.has('summary')) {
    updateFields.summary = metadata.summary;
  }

  // Tags comparison
  const newTags = Array.isArray(metadata.tags) ? metadata.tags : [];
  const oldTags = Array.isArray(existingRec.tags) ? existingRec.tags : [];
  if (JSON.stringify(oldTags) !== JSON.stringify(newTags) && !lockedFields.has('tags')) {
    updateFields.tags = newTags;
  }

  // AO3 tag groups: fandom, relationship, freeform
  const newFandomTags = Array.isArray(metadata.fandom_tags) ? metadata.fandom_tags : (Array.isArray(metadata.fandom) ? metadata.fandom : []);
  const newRelationshipTags = Array.isArray(metadata.relationship_tags) ? metadata.relationship_tags : [];
  const newFreeformTags = Array.isArray(metadata.freeform_tags) ? metadata.freeform_tags : [];

  const oldFandomTags = Array.isArray(existingRec.fandom_tags) ? existingRec.fandom_tags : [];
  const oldRelationshipTags = Array.isArray(existingRec.relationship_tags) ? existingRec.relationship_tags : [];
  const oldFreeformTags = Array.isArray(existingRec.freeform_tags) ? existingRec.freeform_tags : [];

  if (JSON.stringify(oldFandomTags) !== JSON.stringify(newFandomTags) && !lockedFields.has('fandom_tags')) {
    updateFields.fandom_tags = newFandomTags;
  }
  if (JSON.stringify(oldRelationshipTags) !== JSON.stringify(newRelationshipTags) && !lockedFields.has('relationship_tags')) {
    updateFields.relationship_tags = newRelationshipTags;
  }
  if (JSON.stringify(oldFreeformTags) !== JSON.stringify(newFreeformTags) && !lockedFields.has('freeform_tags')) {
    updateFields.freeform_tags = newFreeformTags;
  }

  // Basic fields
    // Respect global modlocks unless the field is currently unset
    const applyIfAllowed = async (fieldName, newValue, currentValue, predicate = (a,b)=>a!==b) => {
      try {
        const botsRespect = await shouldBotsRespectGlobalModlocks();
        const globallyLocked = botsRespect ? await isFieldGloballyModlocked(fieldName) : false;
        const lockedAndSet = globallyLocked && !isUnset(currentValue);
        if (!lockedAndSet && predicate(currentValue, newValue)) {
          updateFields[fieldName] = newValue;
        }
      } catch {
        // If global check fails, default to applying predicate
        if (predicate(currentValue, newValue)) {
          updateFields[fieldName] = newValue;
        }
      }
    };

    await applyIfAllowed('rating', metadata.rating, existingRec.rating);
  if (existingRec.wordCount !== metadata.wordCount) updateFields.wordCount = metadata.wordCount;
  if (existingRec.chapters !== metadata.chapters) updateFields.chapters = metadata.chapters;
    await applyIfAllowed('status', metadata.status, existingRec.status);
    await applyIfAllowed('language', metadata.language, existingRec.language);
    await applyIfAllowed('publishedDate', metadata.publishedDate, existingRec.publishedDate);
    await applyIfAllowed('updatedDate', metadata.updatedDate, existingRec.updatedDate);
  if (existingRec.kudos !== metadata.kudos) updateFields.kudos = metadata.kudos;
  if (existingRec.hits !== metadata.hits) updateFields.hits = metadata.hits;
  if (existingRec.bookmarks !== metadata.bookmarks) updateFields.bookmarks = metadata.bookmarks;
  if (existingRec.comments !== metadata.comments) updateFields.comments = metadata.comments;
    await applyIfAllowed('category', metadata.category, existingRec.category);

  // Archive warnings
  if (Array.isArray(metadata.archiveWarnings)) {
    const oldWarnings = Array.isArray(existingRec.archive_warnings) ? existingRec.archive_warnings : [];
    if (JSON.stringify(oldWarnings) !== JSON.stringify(metadata.archiveWarnings)) {
      const botsRespect = await shouldBotsRespectGlobalModlocks();
      const globallyLocked = botsRespect ? await isFieldGloballyModlocked('archive_warnings') : false;
      const lockedAndSet = globallyLocked && !isUnset(oldWarnings);
      if (!lockedAndSet) updateFields.archive_warnings = metadata.archiveWarnings;
    }
  }

  // Series and flags
  if (seriesId && existingRec.seriesId !== seriesId && !lockedFields.has('seriesId')) {
    updateFields.seriesId = seriesId;
  }
  if (existingRec.notPrimaryWork !== notPrimaryWork) {
    updateFields.notPrimaryWork = notPrimaryWork;
  }

  // Persist AO3-provided part number when available
  if (part !== null && part !== undefined) {
    const botsRespect = await shouldBotsRespectGlobalModlocks();
    const globallyLocked = botsRespect ? await isFieldGloballyModlocked('part') : false;
    const lockedAndSet = globallyLocked && !isUnset(existingRec.part);
    if (!lockedAndSet && existingRec.part !== part) {
      updateFields.part = part;
    }
  }

  return updateFields;
}

export default processAO3Job;