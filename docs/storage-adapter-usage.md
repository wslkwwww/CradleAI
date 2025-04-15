# StorageAdapter Usage Guide

The `StorageAdapter` provides a simplified interface to access chat history data, focusing exclusively on the actual conversation between users and AI characters without exposing framework details like D-class entries or the rFramework structure.

## Overview

The StorageAdapter extracts clean conversation history from NodeST's internal storage format, making it easy for other components to:
- Retrieve clean conversation history
- Get recent messages
- Check if a conversation exists
- Get the greeting message
- Export conversations in a shareable format

## Using the StorageAdapter

### Import

```typescript
import { StorageAdapter } from '@/NodeST/nodest/utils/storage-adapter';
```

### Retrieving Clean Chat History

```typescript
// Get all messages for a conversation
const messages = await StorageAdapter.getCleanChatHistory('conversation123');

// Display in a component
messages.forEach(msg => {
  console.log(`${msg.role}: ${msg.parts[0].text}`);
});
```

### Getting Recent Messages

```typescript
// Get the 10 most recent messages
const recentMessages = await StorageAdapter.getRecentMessages('conversation123', 10);
```

### Checking If A Conversation Has History

```typescript
// Check if the user has interacted with this character before
const hasHistory = await StorageAdapter.hasConversationHistory('conversation123');
if (hasHistory) {
  console.log('This conversation has existing messages');
}
```

### Getting the First Message (Character Greeting)

```typescript
// Get the character's greeting message
const firstMessage = await StorageAdapter.getFirstMessage('conversation123');
if (firstMessage) {
  console.log(`Greeting: ${firstMessage.parts[0].text}`);
}
```

### Exporting Conversations

```typescript
// Export conversation in a clean format for sharing
const exportedChat = await StorageAdapter.exportConversation('conversation123');

// Output looks like:
// [
//   { role: "assistant", content: "Hello! How can I help you today?" },
//   { role: "user", content: "Tell me about yourself" },
//   { role: "assistant", content: "I'm an AI assistant designed to..." }
// ]
```

### Managing Conversations

```typescript
// Store a new user-AI message exchange
await StorageAdapter.storeMessageExchange(
  'conversation123',
  'What's your favorite color?',
  'I really like blue! It reminds me of the sky and ocean.'
);

// Delete all data for a conversation
await StorageAdapter.deleteConversationData('conversation123');

// List all available conversation IDs
const allConversations = await StorageAdapter.getAllConversationIds();
```

## Integration with NodeSTCore

The NodeSTCore class has been updated to leverage the StorageAdapter, maintaining API compatibility while delegating storage operations. You can access messages directly through NodeSTCore:

```typescript
const nodeSTCore = new NodeSTCore(apiKey);

// Get clean conversation messages
const messages = await nodeSTCore.getConversationMessages('conversation123');

// Get recent messages
const recentMessages = await nodeSTCore.getRecentMessages('conversation123', 10);
```

## Data Format

The messages returned by StorageAdapter contain only actual conversation exchanges, with this structure:

```typescript
interface ChatMessage {
  role: string;        // "user" or "model"/"assistant"
  parts: [{
    text: string       // The message content
  }];
  // Other properties removed or filtered
}
```

## Best Practices

1. Use the StorageAdapter when you only need conversation history without framework details
2. Use NodeSTCore for complete character operations (creating, updating, continuing chats)
3. Consider caching results for performance in UI components
4. Use the clean export format for sharing or displaying conversations
