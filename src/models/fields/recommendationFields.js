// Centralized field name constants for Recommendation model
// Use these to avoid typos and casing mistakes in queries/updates.

export const RecommendationFields = Object.freeze({
  id: 'id',
  url: 'url',
  ao3ID: 'ao3ID',
  title: 'title',
  author: 'author', // deprecated
  authors: 'authors',
  summary: 'summary',
  tags: 'tags',
  character_tags: 'character_tags',
  fandom_tags: 'fandom_tags',
  rating: 'rating',
  wordCount: 'wordCount',
  chapters: 'chapters',
  status: 'status',
  language: 'language',
  publishedDate: 'publishedDate',
  updatedDate: 'updatedDate',
  recommendedBy: 'recommendedBy',
  recommendedByUsername: 'recommendedByUsername',
  additionalTags: 'additionalTags',
  notes: 'notes', // deprecated in favor of UserFicMetadata
  archive_warnings: 'archive_warnings',
  kudos: 'kudos',
  hits: 'hits',
  bookmarks: 'bookmarks',
  comments: 'comments',
  category: 'category',
  seriesId: 'seriesId',
  part: 'part',
  deleted: 'deleted',
  attachmentUrl: 'attachmentUrl',
  notPrimaryWork: 'notPrimaryWork',
});
