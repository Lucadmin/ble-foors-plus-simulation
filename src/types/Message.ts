/**
 * Message types
 */
export type MessageType = 'triage' | 'normal';

/**
 * Triage severity levels (black is most severe)
 */
export type TriageSeverity = 'black' | 'green' | 'yellow' | 'red';

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
  triageSeverity?: TriageSeverity; // Severity for triage messages
}

export const DEFAULT_MESSAGE_CONFIG = {
  defaultSpeed: 2.0, // Units per second
  defaultColor: '#F59E0B', // Amber/yellow color for visibility
  // Default triage color kept for backward compatibility (red)
  triageColor: '#EF4444',
  // Severity color mapping (chosen for visibility on dark background)
  triageSeverityColors: {
    black: '#4B5563',  // Slate-600 (visible on dark bg)
    green: '#10B981',  // Emerald-500
    yellow: '#F59E0B', // Amber-500
    red: '#EF4444',    // Red-500
  } as Record<TriageSeverity, string>,
  messageRadius: 0.15,
};
