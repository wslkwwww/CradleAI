/**
 * SSE Client for TTS Service
 * This client provides a simple way to connect to the TTS service's SSE endpoint
 * and listen for task updates in real-time.
 */
class TTSEventClient {
  /**
   * Creates a new TTS Event Client
   * @param {Object} options - Configuration options
   * @param {string} options.baseUrl - Base URL of the TTS service
   * @param {number} options.reconnectDelay - Delay (ms) before reconnecting after failure (default: 3000)
   * @param {number} options.maxReconnectAttempts - Maximum reconnection attempts (default: 5)
   */
  constructor(options = {}) {
    this.baseUrl = options.baseUrl || '';
    this.eventSource = null;
    this.clientId = null;
    this.reconnectDelay = options.reconnectDelay || 3000;
    this.maxReconnectAttempts = options.maxReconnectAttempts || 5;
    this.currentReconnectAttempts = 0;
    this.taskCallbacks = new Map();
    this.eventListeners = new Map();
    this.isConnected = false;
    this.autoReconnect = true;
  }

  /**
   * Connect to SSE endpoint, optionally subscribing to a specific task
   * @param {string} taskId - Optional task ID to subscribe to
   * @returns {Promise} - Resolves when connected, rejects on error
   */
  connect(taskId = null) {
    return new Promise((resolve, reject) => {
      try {
        if (this.eventSource) {
          this.disconnect();
        }

        const url = new URL(`${this.baseUrl}/events`, window.location.origin);
        
        if (taskId) {
          url.searchParams.append('taskId', taskId);
        }

        this.eventSource = new EventSource(url.toString());
        
        // Set up one-time connection handler
        const connectionHandler = (event) => {
          try {
            const data = JSON.parse(event.data);
            this.clientId = data.clientId;
            this.isConnected = true;
            this.currentReconnectAttempts = 0;
            this._triggerEvent('connected', { clientId: this.clientId });
            resolve(this.clientId);
            
            // Remove this one-time handler
            this.eventSource.removeEventListener('connected', connectionHandler);
          } catch (error) {
            reject(new Error('Failed to parse connection response'));
          }
        };
        
        // Listen for the initial connected event
        this.eventSource.addEventListener('connected', connectionHandler);

        // Set up task update handler
        this.eventSource.addEventListener('task_update', (event) => {
          try {
            const data = JSON.parse(event.data);
            this._triggerEvent('task_update', data);
            
            // If there's a specific callback for this task, call it
            if (data.taskId && this.taskCallbacks.has(data.taskId)) {
              this.taskCallbacks.get(data.taskId)(data);
            }
            
            // For final states, clean up task callbacks
            if (data.status === 'succeeded' || data.status === 'failed') {
              this.taskCallbacks.delete(data.taskId);
            }
          } catch (error) {
            console.error('Error processing task update:', error);
          }
        });

        // Set up error handling
        this.eventSource.onerror = (error) => {
          console.error('SSE connection error:', error);
          this.isConnected = false;
          this._triggerEvent('error', { message: 'Connection error' });
          
          if (this.autoReconnect && this.currentReconnectAttempts < this.maxReconnectAttempts) {
            this.currentReconnectAttempts++;
            this._triggerEvent('reconnecting', { 
              attempt: this.currentReconnectAttempts, 
              maxAttempts: this.maxReconnectAttempts 
            });
            
            setTimeout(() => {
              this.connect(taskId)
                .catch(err => console.error('Reconnect failed:', err));
            }, this.reconnectDelay);
          } else if (this.currentReconnectAttempts >= this.maxReconnectAttempts) {
            this._triggerEvent('max_reconnect_attempts', { 
              maxAttempts: this.maxReconnectAttempts 
            });
          }
          
          if (!this.isConnected && this.eventSource) {
            this.disconnect();
            reject(new Error('Connection failed'));
          }
        };
        
        // Handle heartbeats
        this.eventSource.addEventListener('heartbeat', (event) => {
          this._triggerEvent('heartbeat', JSON.parse(event.data));
        });
        
      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * Disconnect from the SSE endpoint
   */
  disconnect() {
    if (this.eventSource) {
      this.eventSource.close();
      this.eventSource = null;
      this.isConnected = false;
      this._triggerEvent('disconnected', {});
    }
  }

  /**
   * Subscribe to a specific task for updates
   * @param {string} taskId - The task ID to subscribe to
   * @param {function} callback - Callback function to be called with updates
   * @returns {boolean} - True if successfully subscribed
   */
  subscribeToTask(taskId, callback) {
    if (!taskId) return false;
    
    this.taskCallbacks.set(taskId, callback);
    
    // If we're already connected but not to this task, reconnect with this task
    if (this.isConnected && this.eventSource) {
      this.connect(taskId).catch(err => console.error('Failed to subscribe to task:', err));
    }
    
    return true;
  }

  /**
   * Unsubscribe from a specific task
   * @param {string} taskId - The task ID to unsubscribe from
   */
  unsubscribeFromTask(taskId) {
    this.taskCallbacks.delete(taskId);
  }

  /**
   * Add an event listener
   * @param {string} event - Event name to listen for
   * @param {function} callback - Callback function
   */
  addEventListener(event, callback) {
    if (!this.eventListeners.has(event)) {
      this.eventListeners.set(event, []);
    }
    
    this.eventListeners.get(event).push(callback);
  }

  /**
   * Remove an event listener
   * @param {string} event - Event name
   * @param {function} callback - Callback function to remove
   */
  removeEventListener(event, callback) {
    if (!this.eventListeners.has(event)) return;
    
    const callbacks = this.eventListeners.get(event);
    const index = callbacks.indexOf(callback);
    
    if (index !== -1) {
      callbacks.splice(index, 1);
    }
    
    if (callbacks.length === 0) {
      this.eventListeners.delete(event);
    }
  }

  /**
   * Get the client ID assigned by the server
   * @returns {string|null} - Client ID if connected, null otherwise
   */
  getClientId() {
    return this.clientId;
  }

  /**
   * Check if connected to SSE endpoint
   * @returns {boolean} - True if connected
   */
  isConnected() {
    return this.isConnected;
  }

  /**
   * Internal method to trigger event callbacks
   * @param {string} event - Event name
   * @param {object} data - Event data
   * @private
   */
  _triggerEvent(event, data) {
    if (this.eventListeners.has(event)) {
      this.eventListeners.get(event).forEach(callback => {
        try {
          callback(data);
        } catch (error) {
          console.error(`Error in ${event} event listener:`, error);
        }
      });
    }
    
    // Also trigger "all" event listeners
    if (this.eventListeners.has('all')) {
      this.eventListeners.get('all').forEach(callback => {
        try {
          callback({ event, data });
        } catch (error) {
          console.error('Error in "all" event listener:', error);
        }
      });
    }
  }

  /**
   * Generate audio using the TTS service
   * @param {Object} params - TTS parameters
   * @param {string} params.templateId - Template ID
   * @param {string} params.tts_text - Text to convert to speech
   * @param {string} [params.instruction] - Optional instruction for voice generation
   * @param {string} [params.task] - Optional task parameter
   * @returns {Promise} - Resolves with TTS response
   */
  async generateAudio(params) {
    if (!this.isConnected) {
      await this.connect();
    }
    
    const response = await fetch(`${this.baseUrl}/api/tts`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Client-ID': this.clientId || ''
      },
      body: JSON.stringify(params)
    });
    
    const result = await response.json();
    
    if (!result.success) {
      throw new Error(result.error || 'Failed to generate audio');
    }
    
    // Auto-subscribe to task updates if a task ID is returned
    if (result.data.taskId) {
      this.subscribeToTask(result.data.taskId, (data) => {
        this._triggerEvent('task_update', data);
      });
    }
    
    return result;
  }

  /**
   * Retry a failed audio generation task
   * @param {Object} params - Retry parameters
   * @param {string} params.taskId - Task ID to retry
   * @param {string} params.templateId - Template ID
   * @param {string} params.tts_text - Text to convert to speech
   * @param {string} [params.instruction] - Optional instruction for voice generation
   * @param {string} [params.task] - Optional task parameter
   * @returns {Promise} - Resolves with retry response
   */
  async retryAudio(params) {
    if (!params.taskId) {
      throw new Error('Task ID is required for retry');
    }
    
    const response = await fetch(`${this.baseUrl}/api/tts/retry`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(params)
    });
    
    const result = await response.json();
    
    if (!result.success) {
      throw new Error(result.error || 'Failed to retry audio generation');
    }
    
    // Auto-subscribe to task updates
    if (result.data.taskId) {
      this.subscribeToTask(result.data.taskId, (data) => {
        this._triggerEvent('task_update', data);
      });
    }
    
    return result;
  }

  /**
   * Get task status
   * @param {string} taskId - Task ID
   * @returns {Promise} - Resolves with task status
   */
  async getTaskStatus(taskId) {
    const response = await fetch(`${this.baseUrl}/api/tts/task/${taskId}`, {
      method: 'GET',
      headers: {
        'Accept': 'application/json'
      }
    });
    
    const result = await response.json();
    
    if (!result.success) {
      throw new Error(result.error || 'Failed to get task status');
    }
    
    return result.data;
  }
}

// Export for CommonJS or browser
if (typeof module !== 'undefined' && module.exports) {
  module.exports = TTSEventClient;
} else {
  window.TTSEventClient = TTSEventClient;
}
