import processAO3Job from './src/shared/recUtils/processAO3Job.js';
import { Recommendation } from './src/models/index.js';

async function testSpecificAuthorUpdate() {
  try {
    // Test the specific recommendation with bad author data
    const rec = await Recommendation.findByPk(1387, {
      attributes: ['id', 'ao3ID', 'url', 'author', 'authors', 'title']
    });
    
    if (!rec) {
      console.log('Recommendation 1387 not found');
      return;
    }
    
    console.log('Before update - Rec 1387:', {
      id: rec.id,
      ao3ID: rec.ao3ID,
      currentAuthor: rec.author,
      currentAuthors: rec.authors,
      title: rec.title,
      url: rec.url
    });
    
    // Trigger an update to see if it fixes the bad author data
    const result = await processAO3Job({
      url: rec.url,
      ao3ID: rec.ao3ID,
      user: { id: 'test-user', username: 'test-user' },
      isUpdate: true
    });
    
    console.log('Update result success:', !!result.recommendation);
    if (result.error) {
      console.log('Update error:', result.error);
    }
    
    // Check the recommendation after update
    await rec.reload();
    console.log('After update - Rec 1387:', {
      author: rec.author,
      authors: rec.authors
    });
    
  } catch (error) {
    console.error('Test error:', error);
  }
}

testSpecificAuthorUpdate();