/**
 * Message types
 */
export type MessageType = 'triage' | 'normal';

/**
 * Message - Represents a message traveling between nodes
 */
export interface Message {
  id: string; // Unique ID for this message instance (transport ID)
  fromNodeId: string;
  toNodeId: string;
  progress: number; // 0 to 1, representing position along the connection
  speed: number; // Units per second
  color: string;
  createdAt: number;
  type: MessageType; // Type of message
  triageId?: string; // Unique identifier for triage content (used for deduplication)
}

export const DEFAULT_MESSAGE_CONFIG = {
  defaultSpeed: 2.0, // Units per second
  defaultColor: '#F59E0B', // Amber/yellow color for visibility
  triageColor: '#EF4444', // Red color for triage messages
  messageRadius: 0.15,
};
