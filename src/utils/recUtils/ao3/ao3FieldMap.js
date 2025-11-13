// ao3FieldMap.js
// Shared AO3 field label to normalized key mapping for meta and stats groups

const AO3_FIELD_MAP = {
    // Meta group fields
    'rating': 'rating',
    'ratings': 'rating',
    'archive_warning': 'archive_warnings',
    'archive_warnings': 'archive_warnings',
    'category': 'category_tags',
    'categories': 'category_tags',
    'fandom': 'fandom_tags',
    'fandoms': 'fandom_tags',
    'relationship': 'relationship_tags',
    'relationships': 'relationship_tags',
    'character': 'character_tags',
    'characters': 'character_tags',
    'additional_tags': 'freeform_tags',
    'freeform_tags': 'freeform_tags',
    'language': 'language',
    'collections': 'collections',
    // Stats group fields
    'published': 'published',
    'updated': 'updated',
    'completed': 'completed',
    'words': 'words',
    'word_count': 'words',
    'chapters': 'chapters',
    'comments': 'comments',
    'kudos': 'kudos',
    'bookmarks': 'bookmarks',
    'hits': 'hits',
};

module.exports = AO3_FIELD_MAP;
