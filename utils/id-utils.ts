/**
 * Generates a simple ID string
 */
export function generateId(): string {
  return Math.random().toString(36).substring(2) + Date.now().toString(36);
}

/**
 * Generates a unique action ID based on source, target and type
 */
export function generateActionId(source: string, target: string, type: string): string {
  const timestamp = Date.now().toString(36);
  return `${source.substring(0, 4)}-${target.substring(0, 4)}-${type.substring(0, 4)}-${timestamp}`;
}

/**
 * Generates a unique ID for action-service
 */
export function generateUniqueId(): string {
  return `action-${Date.now()}-${Math.random().toString(36).substring(2, 10)}`;
}
