import { OpenRouterRequestParams, OpenRouterResponse } from '@/shared/types/api-types';

/**
 * OpenRouter API adapter for AI model communication
 */
export class OpenRouterAdapter {
  private apiKey: string;
  private model: string;
  private baseUrl = 'https://openrouter.ai/api/v1';
  private conversationHistory: Array<{role: string, parts: Array<{text: string}>}> = [];

  constructor(apiKey: string, model: string = 'openai/gpt-3.5-turbo') {
    this.apiKey = apiKey;
    this.model = model;
    console.log(`[OpenRouterAdapter] Initialized with model: ${this.model}`);
  }

  /**
   * Generate content using OpenRouter API
   * @param messages Array of message objects with role and parts (Gemini format)
   * @returns Generated content as string
   */
  async generateContent(messages: Array<{role: string, parts: Array<{text: string}>}>): Promise<string> {
    try {
      console.log(`[OpenRouterAdapter] Generating content with model: ${this.model}`);
      console.log(`[OpenRouterAdapter] Request messages count: ${messages.length}`);
      
      if (!this.apiKey) {
        throw new Error('OpenRouter API key is missing');
      }

      // Store messages in conversation history
      this.conversationHistory = [...this.conversationHistory, ...messages];

      // Transform Gemini-style messages to OpenRouter format
      const transformedMessages = messages.map(msg => {
        // For system messages, use 'system' role
        if (msg.role === 'system') {
          return {
            role: 'system' as const,
            content: msg.parts[0]?.text || ''
          };
        }
        
        // For user messages
        if (msg.role === 'user') {
          return {
            role: 'user' as const,
            content: msg.parts[0]?.text || ''
          };
        }
        
        // For assistant/model messages
        if (msg.role === 'model') {
          return {
            role: 'assistant' as const,
            content: msg.parts[0]?.text || ''
          };
        }
        
        // Default to user if role is unknown
        return {
          role: 'user' as const,
          content: msg.parts[0]?.text || ''
        };
      });

      // Ensure we have valid messages
      if (transformedMessages.length === 0) {
        throw new Error('No valid messages to send to OpenRouter');
      }

      // Log the transformed messages
      console.log(`[OpenRouterAdapter] Transformed messages:`, JSON.stringify(transformedMessages));

      // Create request body
      const requestBody: OpenRouterRequestParams = {
        model: this.model,
        messages: transformedMessages,
        temperature: 0.7,
        max_tokens: 1000
      };

      console.log(`[OpenRouterAdapter] Sending request to ${this.baseUrl}/chat/completions`);

      const response = await fetch(`${this.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify(requestBody)
      });

      console.log(`[OpenRouterAdapter] Response status: ${response.status}`);

      // Detailed error handling with response body
      if (!response.ok) {
        let errorMessage = `OpenRouter API returned ${response.status}`;
        try {
          const errorData = await response.text();
          console.error(`[OpenRouterAdapter] API error details: ${errorData}`);
          errorMessage += `: ${errorData}`;
        } catch (e) {
          console.error('[OpenRouterAdapter] Could not parse error response');
        }
        throw new Error(errorMessage);
      }

      const data: OpenRouterResponse = await response.json();
      
      // Log entire response for debugging
      console.log('[OpenRouterAdapter] Response data:', JSON.stringify(data));
      
      // More detailed validation of the response
      if (!data) {
        throw new Error('Empty response from OpenRouter API');
      }
      
      if (!data.choices) {
        console.error('[OpenRouterAdapter] Response missing choices array:', JSON.stringify(data));
        
        // Check for error details and provide better error message
        if (data.error) {
          throw new Error(`API Error: ${data.error.message || 'Unknown error'}`);
        }
        
        throw new Error('Invalid response format from OpenRouter API');
      }
      
      if (data.choices.length === 0) {
        console.error('[OpenRouterAdapter] Response has empty choices array:', JSON.stringify(data));
        throw new Error('No completion choices returned');
      }
      
      if (!data.choices[0].message || !data.choices[0].message.content) {
        console.error('[OpenRouterAdapter] Response missing message content:', JSON.stringify(data.choices));
        throw new Error('Missing content in OpenRouter API response');
      }

      const responseText = data.choices[0].message.content;
      
      // Add assistant response to conversation history
      this.conversationHistory.push({
        role: 'model',
        parts: [{ text: responseText }]
      });
      
      // Log successful response details
      console.log(`[OpenRouterAdapter] Received response content length: ${responseText.length}`);
      return responseText;
    } catch (error) {
      console.error('[OpenRouterAdapter] Error generating content:', error);
      
      // Return a fallback response instead of throwing
      console.log('[OpenRouterAdapter] Returning fallback response due to error');
      return "I apologize, but I encountered an error processing your request. Could you please try again or rephrase your message?";
    }
  }

  /**
   * Get chat history for compatibility with other adapters
   */
  getChatHistory(): Array<{ role: string; text: string }> {
    return this.conversationHistory.map(msg => ({
      role: msg.role,
      text: msg.parts[0]?.text || ''
    }));
  }

  /**
   * List available models from OpenRouter
   * @returns Array of available models
   */
  async listModels(): Promise<any[]> {
    try {
      console.log(`[OpenRouterAdapter] Fetching available models`);
      
      const response = await fetch(`${this.baseUrl}/models`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
        }
      });

      if (!response.ok) {
        const errorData = await response.text();
        console.error(`[OpenRouterAdapter] Models API error: ${errorData}`);
        throw new Error(`OpenRouter API returned ${response.status}: ${errorData}`);
      }

      const data = await response.json();
      return data.data;
    } catch (error) {
      console.error('[OpenRouterAdapter] Error listing models:', error);
      throw error;
    }
  }
}
