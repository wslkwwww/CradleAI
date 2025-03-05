/**
 * 关系系统与OpenRouter集成测试
 * 验证关系系统与OpenRouter API的集成功能
 */

import { ApiServiceProvider } from '@/services/api-service-provider';
import { RelationshipPromptService } from '@/services/relationship-prompt-service';
import { RelationshipInteractionService } from '@/services/relationship-interaction-service';
import { Character } from '@/shared/types';
import { Relationship } from '@/shared/types/relationship-types';
import { ErrorRecoveryManager } from '@/utils/error-recovery';

// Mock ApiServiceProvider to avoid actual API calls
jest.mock('@/services/api-service-provider', () => ({
  ApiServiceProvider: {
    generateContent: jest.fn()
  }
}));

// Mock ErrorRecoveryManager
jest.mock('@/utils/error-recovery', () => ({
  ErrorRecoveryManager: {
    inferErrorType: jest.fn(),
    logError: jest.fn(),
    getRecoveryAction: jest.fn()
  }
}));

describe('关系系统与OpenRouter集成测试', () => {
  // Test data setup
  const mockApiKey = 'mock-api-key';
  const mockOpenRouterSettings = {
    apiProvider: 'openrouter', 
    openrouter: {
      enabled: true,
      apiKey: 'mock-openrouter-key',
      model: 'anthropic/claude-2'
    }
  };
  
  const mockGeminiSettings = {
    apiProvider: 'gemini'
  };
  
  const sourceCharacter: Character = {
    id: 'source-char-id',
    name: '源角色',
    description: '这是一个测试角色',
    jsonData: '',
    relationshipMap: {
      relationships: {
        'target-char-id': {
          targetId: 'target-char-id',
          strength: 50,
          type: 'friend',
          description: '我们是朋友关系',
          lastUpdated: Date.now(),
          interactions: 5
        }
      },
      lastReviewed: Date.now(),
      lastUpdated: Date.now()
    }
  };
  
  const targetCharacter: Character = {
    id: 'target-char-id',
    name: '目标角色',
    description: '另一个测试角色',
    jsonData: ''
  };
  
  beforeEach(() => {
    jest.clearAllMocks();
    
    // Default mock implementation
    (ApiServiceProvider.generateContent as jest.Mock).mockResolvedValue(
      '我很高兴见到你！作为朋友，我们应该多聚聚。'
    );
  });
  
  describe('RelationshipPromptService 测试', () => {
    test('使用OpenRouter生成关系描述时应调用正确API', async () => {
      // Call the service
      await RelationshipPromptService.generateRelationshipDescription(
        sourceCharacter,
        targetCharacter,
        sourceCharacter.relationshipMap.relationships['target-char-id'] as Relationship,
        mockApiKey,
        mockOpenRouterSettings
      );
      
      // Verify API was called with correct parameters
      expect(ApiServiceProvider.generateContent).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            role: 'user',
            parts: expect.arrayContaining([
              expect.objectContaining({
                text: expect.stringContaining('你是源角色')
              })
            ])
          })
        ]),
        mockApiKey,
        mockOpenRouterSettings
      );
    });
    
    test('生成互动回应时应根据关系类型定制提示词', async () => {
      // Call the service
      await RelationshipPromptService.generateInteractionResponse(
        sourceCharacter,
        targetCharacter,
        {
          scenario: 'greeting',
          detail: '在公园散步'
        },
        mockApiKey,
        mockOpenRouterSettings
      );
      
      // Verify API was called with correctly tailored prompt
      expect(ApiServiceProvider.generateContent).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            parts: expect.arrayContaining([
              expect.objectContaining({
                text: expect.stringMatching(/friend|朋友/)
              })
            ])
          })
        ]),
        mockApiKey,
        mockOpenRouterSettings
      );
    });
    
    test('API调用失败时应使用默认回应', async () => {
      // Mock API failure
      (ApiServiceProvider.generateContent as jest.Mock).mockRejectedValue(
        new Error('API error')
      );
      
      // Call the service
      const result = await RelationshipPromptService.generateInteractionResponse(
        sourceCharacter,
        targetCharacter,
        { scenario: 'greeting' },
        mockApiKey,
        mockOpenRouterSettings
      );
      
      // Verify default response was returned
      expect(result).toContain('嘿');
      expect(ErrorRecoveryManager.inferErrorType).toHaveBeenCalled();
    });
  });
  
  describe('RelationshipInteractionService 测试', () => {
    test('使用OpenRouter生成互动内容时应调用正确API', async () => {
      // Call the service
      await RelationshipInteractionService.generateInteraction(
        sourceCharacter,
        targetCharacter,
        'greeting',
        { location: '咖啡厅' },
        mockApiKey,
        mockOpenRouterSettings
      );
      
      // Verify API was called
      expect(ApiServiceProvider.generateContent).toHaveBeenCalledWith(
        expect.anything(),
        mockApiKey,
        mockOpenRouterSettings
      );
    });
    
    test('生成增强描述时应使用OpenRouter模型', async () => {
      // Call the service
      await RelationshipInteractionService.generateEnhancedDescription(
        sourceCharacter,
        targetCharacter,
        sourceCharacter.relationshipMap.relationships['target-char-id'] as Relationship,
        mockApiKey,
        mockOpenRouterSettings
      );
      
      // Check that API was called with OpenRouter settings
      const apiCallArgs = (ApiServiceProvider.generateContent as jest.Mock).mock.calls[0];
      expect(apiCallArgs[2]).toEqual(mockOpenRouterSettings);
    });
    
    test('切换到Gemini时应正确使用Gemini设置', async () => {
      // Call with Gemini settings
      await RelationshipInteractionService.generateInteraction(
        sourceCharacter,
        targetCharacter,
        'greeting',
        {},
        mockApiKey,
        mockGeminiSettings
      );
      
      // Check that API was called with Gemini settings
      const apiCallArgs = (ApiServiceProvider.generateContent as jest.Mock).mock.calls[0];
      expect(apiCallArgs[2]).toEqual(mockGeminiSettings);
    });
    
    test('处理API错误时应记录错误并返回默认回应', async () => {
      // Mock API failure
      (ApiServiceProvider.generateContent as jest.Mock).mockRejectedValue(
        new Error('API error')
      );
      
      // Call the service
      const result = await RelationshipInteractionService.generateInteraction(
        sourceCharacter,
        targetCharacter,
        'greeting',
        {},
        mockApiKey,
        mockOpenRouterSettings
      );
      
      // Verify error was logged and default response returned
      expect(ErrorRecoveryManager.logError).toHaveBeenCalled();
      expect(result).toBeTruthy(); // Should return default response
    });
  });
});
