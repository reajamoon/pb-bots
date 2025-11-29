import processAO3Job from './src/shared/recUtils/processAO3Job.js';
import { Recommendation } from './src/models/index.js';

async function testAuthorOverwrite() {
  try {
    // Find a recommendation to test with
    const rec = await Recommendation.findOne({
      order: [['id', 'DESC']],
      attributes: ['id', 'ao3ID', 'url', 'author', 'authors', 'title']
    });
    
    if (!rec) {
      console.log('No recommendations found');
      return;
    }
    
    console.log('Original recommendation:', {
      id: rec.id,
      ao3ID: rec.ao3ID,
      currentAuthor: rec.author,
      currentAuthors: rec.authors,
      title: rec.title
    });
    
    // Artificially corrupt the author data to test overwriting
    const originalAuthor = rec.author;
    const originalAuthors = rec.authors;
    
    await rec.update({
      author: 'CORRUPTED_AUTHOR_TEST',
      authors: ['CORRUPTED_AUTHOR_TEST', 'FAKE_SECOND_AUTHOR']
    });
    
    console.log('After corruption:', {
      author: rec.author,
      authors: rec.authors
    });
    
    // Now trigger an update to see if it fixes the corruption
    const result = await processAO3Job({
      url: rec.url,
      ao3ID: rec.ao3ID,
      user: { id: 'test-user', username: 'test-user' },
      isUpdate: true
    });
    
    console.log('Update result success:', !!result.recommendation);
    
    // Check the recommendation after update
    await rec.reload();
    console.log('After update attempt:', {
      author: rec.author,
      authors: rec.authors
    });
    
    // Determine if the corruption was fixed
    const wasFixed = rec.author === originalAuthor && 
                    JSON.stringify(rec.authors) === JSON.stringify(originalAuthors);
    
    console.log('🔍 TEST RESULT:', {
      wasCorrupted: true,
      wasFixed: wasFixed,
      expectedAuthor: originalAuthor,
      expectedAuthors: originalAuthors,
      actualAuthor: rec.author,
      actualAuthors: rec.authors
    });
    
  } catch (error) {
    console.error('Test error:', error);
  }
}

testAuthorOverwrite();