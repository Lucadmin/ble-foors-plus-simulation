export type NodeType = 'source' | 'sink';

/**
 * Routing table entry for a specific sink
 * Stores multiple next hops with their hop counts for redundancy
 */
export interface RoutingTableEntry {
  nextHops: Map<string, number>; // Map of peer ID -> hop count to reach sink via this peer
  lastUpdate: number; // Timestamp of last routing update (for expiry detection)
}

/**
 * Inactive routing table entry for a disconnected sink
 * Stored temporarily before being deleted after timeout
 */
export interface InactiveRoutingTableEntry {
  sinkId: string; // ID of the disconnected sink
  lastActiveEntry: RoutingTableEntry; // The last known routing entry before disconnection
  inactiveSince: number; // Timestamp when this entry became inactive
}

/**
 * FOORS+ Routing Mode
 * Indicates how the node is currently making routing decisions
 */
export type RoutingMode = 'intelligent' | 'flooding' | 'no-connections' | 'inactive';

/**
 * FOORS+ Routing State
 * Tracks the current routing behavior and why
 */
export interface RoutingState {
  mode: RoutingMode;
  activeRoutes: number; // Number of active (non-expired) routes to sinks
  expiredRoutes: number; // Number of expired routes (within inactivity window)
  inactiveRoutes: number; // Number of inactive routing tables (for disconnected sinks)
  floodingReason?: 'no-routes' | 'routes-expired' | 'no-connections' | 'has-inactive-routes';
  lastStateChange: number; // Timestamp of last mode change
}

/**
 * Queued Triage Entry
 * Stores triage information when a node is disconnected
 */
export interface QueuedTriage {
  triageId: string; // Unique identifier for the triage
  severity: import('./Message').TriageSeverity; // Severity associated with this triage
  queuedAt: number; // Timestamp when triage was queued
}

/**
 * Per-sink triage send tracking.
 * For each triage ID, track which sinks this node has already forwarded it towards.
 * This is purely "sent" bookkeeping and does not imply delivery.
 */
export type TriageSentMap = Map<string, Set<string>>; // Map<triageId, Set<sinkId>>

export interface Node {
  id: string;
  type: NodeType;
  position: {
    x: number;
    y: number;
  };
  velocity: {
    x: number;
    y: number;
  };
  radius: number;
  connectionRadius: number;
  color: string;
  selected: boolean;
  connections: Set<string>; // IDs of connected nodes
  metadata?: Record<string, unknown>;
  lastMessageReceivedAt?: number; // Timestamp of last message arrival for visual effect
  triageStore: Set<string>; // Set of triage IDs this node has seen (for deduplication)
  triageQueue: QueuedTriage[]; // Queue of triages waiting to be sent when reconnected
  // For each triageId, which sink IDs this node has already sent it towards (one or more times)
  sentTriagesToSinks: TriageSentMap;
  
  // FOORS+ Routing Table: one entry per known sink
  // Map<sinkId, RoutingTableEntry>
  routingTable: Map<string, RoutingTableEntry>;
  
  // FOORS+ Inactive Routing Tables: entries for disconnected sinks (Map<sinkId, InactiveRoutingTableEntry>)
  // These remain for a configurable duration before being deleted
  inactiveRoutingTables: Map<string, InactiveRoutingTableEntry>;
  
  // FOORS+ Routing State: current routing mode and statistics
  routingState: RoutingState;
}

export interface NodeConfig {
  defaultRadius: number;
  defaultConnectionRadius: number;
  defaultColor: string;
  selectedColor: string;
  hoveredColor: string;
  sourceColor: string;
  sinkColor: string;
}

export const DEFAULT_NODE_CONFIG: NodeConfig = {
  defaultRadius: 0.4,
  defaultConnectionRadius: 2.0,
  defaultColor: '#2563EB', // Blue (will be overridden by type)
  selectedColor: '#10B981',
  hoveredColor: '#F59E0B',
  sourceColor: '#10B981', // Green for sources (generate/forward)
  sinkColor: '#6366F1', // Indigo for sinks/dashboards (receive)
};
