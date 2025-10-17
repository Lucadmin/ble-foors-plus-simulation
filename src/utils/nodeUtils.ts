import { v4 as uuidv4 } from 'uuid';
import type { Node, NodeType } from '../types/Node';
import { DEFAULT_NODE_CONFIG } from '../types/Node';

export const createNode = (
  x: number, 
  y: number, 
  type: NodeType = 'source', 
  connectionRadius?: number
): Node => {
  // Choose color based on node type
  const color = type === 'sink' 
    ? DEFAULT_NODE_CONFIG.sinkColor 
    : DEFAULT_NODE_CONFIG.sourceColor;

  return {
    id: uuidv4(),
    type,
    position: { x, y },
    velocity: { x: 0, y: 0 },
    radius: DEFAULT_NODE_CONFIG.defaultRadius,
    connectionRadius: connectionRadius ?? DEFAULT_NODE_CONFIG.defaultConnectionRadius,
    color,
    selected: false,
    connections: new Set<string>(),
    triageStore: new Set<string>(),
    triageQueue: [], // Initialize empty triage queue
    routingTable: new Map(), // Initialize empty routing table
    inactiveRoutingTables: new Map(), // Initialize empty inactive routing tables
    routingState: {
      mode: 'no-connections',
      activeRoutes: 0,
      expiredRoutes: 0,
      inactiveRoutes: 0,
      floodingReason: 'no-connections',
      lastStateChange: Date.now(),
    },
  };
};

export const isPointInNode = (
  point: { x: number; y: number },
  node: Node
): boolean => {
  const dx = point.x - node.position.x;
  const dy = point.y - node.position.y;
  const distance = Math.sqrt(dx * dx + dy * dy);
  return distance <= node.radius;
};
