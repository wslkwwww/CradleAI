import { CradleService } from '@/NodeST/nodest/services/cradle-service';
import { FeedType } from '@/NodeST/nodest/services/character-generator-service';
import { CharacterInitialData } from '@/NodeST/nodest/services/character-generator-service';

// Mock API key for testing
const TEST_API_KEY = "test_api_key_12345";

describe('CradleService', () => {
  let cradleService: CradleService;
  
  beforeEach(() => {
    cradleService = new CradleService(TEST_API_KEY);
    cradleService.initialize();
  });
  
  afterEach(() => {
    cradleService.shutdown();
  });
  
  test('should initialize without errors', () => {
    expect(cradleService).toBeDefined();
  });
  
  test('should add feed data correctly', () => {
    const feedContent = "This is a test feed content";
    const feedType = FeedType.MATERIAL;
    
    const feedId = cradleService.addFeed(feedContent, feedType);
    expect(feedId).toBeDefined();
    
    const allFeeds = cradleService.getAllFeeds();
    expect(allFeeds.length).toBe(1);
    expect(allFeeds[0].content).toBe(feedContent);
    expect(allFeeds[0].type).toBe(feedType);
    expect(allFeeds[0].processed).toBe(false);
  });
  
  test('should add multiple feed types', () => {
    cradleService.addFeed("Material content", FeedType.MATERIAL);
    cradleService.addFeed("About me content", FeedType.ABOUT_ME);
    cradleService.addFeed("Knowledge content", FeedType.KNOWLEDGE);
    
    const allFeeds = cradleService.getAllFeeds();
    expect(allFeeds.length).toBe(3);
    
    const materialFeeds = allFeeds.filter(f => f.type === FeedType.MATERIAL);
    const aboutMeFeeds = allFeeds.filter(f => f.type === FeedType.ABOUT_ME);
    const knowledgeFeeds = allFeeds.filter(f => f.type === FeedType.KNOWLEDGE);
    
    expect(materialFeeds.length).toBe(1);
    expect(aboutMeFeeds.length).toBe(1);
    expect(knowledgeFeeds.length).toBe(1);
  });
  
  test('reset should clear all data', () => {
    cradleService.addFeed("Test content", FeedType.MATERIAL);
    expect(cradleService.getAllFeeds().length).toBe(1);
    
    cradleService.reset();
    expect(cradleService.getAllFeeds().length).toBe(0);
  });
});
