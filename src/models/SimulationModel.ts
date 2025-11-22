import type { Node } from '../types/Node';
import type { Message } from '../types/Message';
import { createNode } from '../utils/nodeUtils';
import { v4 as uuidv4 } from 'uuid';
import { DEFAULT_MESSAGE_CONFIG } from '../types/Message';
import { DEFAULT_NODE_CONFIG } from '../types/Node';

/**
 * SimulationModel - Manages the state and logic of the simulation
 * This is the "Model" in MVC - handles all data and business logic
 */
export class SimulationModel {
  private nodes: Node[] = [];
  private messages: Message[] = [];
  private listeners: Set<() => void> = new Set();
  private connectionRadius: number = 2.0; // Global default
  private inactiveRoutingTimeout: number = 1 * 1000; // 1 second default (configurable up to 5 minutes)
  // Removed legacy summary chunk size; kept for backward compat previously. No longer needed.
  
  // Auto-generation state
  private isAutoGenerating: boolean = false;
  private triageGenerationInterval: number = 3000; // milliseconds (default 3 seconds)
  private lastTriageGeneration: number = 0;

  constructor() {
    this.nodes = [];
     this.messages = [];
  }

  /**
   * Set the inactive routing table timeout duration (in milliseconds)
   */
  setInactiveRoutingTimeout(timeout: number): void {
    this.inactiveRoutingTimeout = timeout;
    this.notifyListeners();
  }

  /**
   * Get the current inactive routing table timeout duration (in milliseconds)
   */
  getInactiveRoutingTimeout(): number {
    return this.inactiveRoutingTimeout;
  }

  /**
   * Start automatic triage generation
   */
  startAutoGeneration(): void {
    this.isAutoGenerating = true;
    this.lastTriageGeneration = Date.now();
    console.log('[Simulation] Auto-generation started');
    this.notifyListeners();
  }

  /**
   * Stop automatic triage generation
   */
  stopAutoGeneration(): void {
    this.isAutoGenerating = false;
    console.log('[Simulation] Auto-generation stopped');
    this.notifyListeners();
  }

  /**
   * Check if auto-generation is active
   */
  isAutoGenerationActive(): boolean {
    return this.isAutoGenerating;
  }

  /**
   * Set the triage generation interval (in milliseconds)
   */
  setTriageGenerationInterval(interval: number): void {
    this.triageGenerationInterval = interval;
    this.notifyListeners();
  }

  /**
   * Get the current triage generation interval (in milliseconds)
   */
  getTriageGenerationInterval(): number {
    return this.triageGenerationInterval;
  }

  /**
   * Reset simulation - remove all nodes and messages
   */
  reset(): void {
    this.nodes = [];
    this.messages = [];
    this.isAutoGenerating = false;
    console.log('[Simulation] Reset - all nodes and messages cleared');
    this.notifyListeners();
  }

  /**
   * Set the global connection radius
   */
  setConnectionRadius(radius: number): void {
    this.connectionRadius = radius;
    // Update all existing nodes
  this.nodes.forEach(node => {
      node.connectionRadius = radius;
    });
    this.updateConnections();
    this.notifyListeners();
  }

  /**
   * Get the current connection radius
   */
  getConnectionRadius(): number {
    return this.connectionRadius;
  }

  /**
   * Subscribe to model changes
   */
  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /**
   * Notify all listeners of changes
   */
  private notifyListeners(): void {
    this.listeners.forEach(listener => listener());
  }

  /**
   * Get all nodes
   */
  getNodes(): Node[] {
    return [...this.nodes];
  }

  /**
   * Get a specific node by ID
   */
  getNode(id: string): Node | undefined {
    return this.nodes.find(node => node.id === id);
  }

  /**
   * Add a new node at the specified position
   */
  addNode(x: number, y: number, type: import('../types/Node').NodeType = 'source'): Node {
    const node = createNode(x, y, type, this.connectionRadius);
    this.nodes.push(node);
    this.updateConnections();
    this.updateRoutingTables();

    // If this node is created as a sink into an existing network,
    // sync missing triages from any sinks that already have routes to it.
    if (node.type === 'sink') {
      this.syncNewSinkFromExistingSinks(node);
    }
    // Auto-select newly created node if no other node is currently 'pinned'/selected.
    // Selection state is handled in controller; expose a lightweight hint by marking all others unselected.
    const anyCurrentlySelected = this.nodes.some(n => n.selected);
    if (!anyCurrentlySelected) {
      // Clear previous selections just in case
      this.nodes.forEach(n => { n.selected = false; });
      node.selected = true;
    }
    this.notifyListeners();
    return node;
  }

  /**
   * Remove a node by ID
   */
  removeNode(id: string): void {
    // Remove connections to this node from other nodes
    this.nodes.forEach(node => {
      node.connections.delete(id);
    });
    this.nodes = this.nodes.filter(node => node.id !== id);
    this.notifyListeners();
  }

  /**
   * Toggle node type between source and sink
   */
  toggleNodeType(id: string): void {
    const node = this.nodes.find(n => n.id === id);
    if (node) {
      const wasSink = node.type === 'sink';
      node.type = node.type === 'source' ? 'sink' : 'source';
      // Update color based on type
      node.color = node.type === 'sink' 
        ? DEFAULT_NODE_CONFIG.sinkColor 
        : DEFAULT_NODE_CONFIG.sourceColor;
      // If this node just became a sink, update routing and sync from existing sinks
      if (!wasSink && node.type === 'sink') {
        this.updateRoutingTables();
        this.syncNewSinkFromExistingSinks(node);
      }
      this.notifyListeners();
    }
  }

  /**
   * Update a node's position
   */
  updateNodePosition(id: string, x: number, y: number): void {
    const node = this.nodes.find(n => n.id === id);
    if (node) {
      node.position.x = x;
      node.position.y = y;
      this.updateConnections();
      this.notifyListeners();
    }
  }

  /**
   * Update a node's velocity
   */
  updateNodeVelocity(id: string, vx: number, vy: number): void {
    const node = this.nodes.find(n => n.id === id);
    if (node) {
      node.velocity.x = vx;
      node.velocity.y = vy;
      this.notifyListeners();
    }
  }

  /**
   * Clear all nodes
   */
  clearNodes(): void {
    this.nodes = [];
    this.notifyListeners();
  }

  /**
   * When a new sink joins an already routed network (intelligent mode),
   * existing sinks send triages that the new sink has not yet seen using
   * the FOORS+ routing tables (smart paths), not flooding.
   */
  private syncNewSinkFromExistingSinks(newSink: Node): void {
    if (newSink.type !== 'sink') return;

    const existingSinks = this.nodes.filter(n => n.type === 'sink' && n.id !== newSink.id);
    if (existingSinks.length === 0) return;

    existingSinks.forEach(sink => {
      // Only sinks that have a route to the new sink participate
      const routeEntry = sink.routingTable.get(newSink.id);
      if (!routeEntry || routeEntry.nextHops.size === 0) return;

      sink.triageStore.forEach(triageId => {
        // Skip triages that the new sink has already seen
        if (newSink.triageStore.has(triageId)) return;

        // Also skip if this sink has already sent this triage towards the new sink
        const perTriage = sink.sentTriagesToSinks.get(triageId);
        if (perTriage && perTriage.has(newSink.id)) return;

        const severity: import('../types/Message').TriageSeverity = 'red';

        // Use the routing table to send from this sink towards the new sink
        routeEntry.nextHops.forEach((_hopCount, nextHopId) => {
          const message: Message = {
            id: uuidv4(),
            fromNodeId: sink.id,
            toNodeId: nextHopId,
            progress: 0,
            speed: DEFAULT_MESSAGE_CONFIG.defaultSpeed,
            color: DEFAULT_MESSAGE_CONFIG.triageSeverityColors[severity],
            createdAt: Date.now(),
            type: 'triage',
            triageId,
            triageSeverity: severity,
          };
          this.messages.push(message);
        });

        // Mark that this sink has now sent this triage towards the new sink
        let per = sink.sentTriagesToSinks.get(triageId);
        if (!per) {
          per = new Set<string>();
          sink.sentTriagesToSinks.set(triageId, per);
        }
        per.add(newSink.id);
      });
    });

    this.notifyListeners();
  }

  /**
   * Update connections based on node positions and connection radii
   */
  private updateConnections(): void {
    // Store previous connection states and neighbor sets to detect reconnections and new links
    const previousConnectionStates = new Map<string, boolean>();
    const previousNeighbors = new Map<string, Set<string>>();
    this.nodes.forEach(node => {
      previousConnectionStates.set(node.id, node.connections.size > 0);
      previousNeighbors.set(node.id, new Set(node.connections));
    });

    // Clear all existing connections
    this.nodes.forEach(node => {
      node.connections.clear();
    });

    // Check each pair of nodes
    for (let i = 0; i < this.nodes.length; i++) {
      for (let j = i + 1; j < this.nodes.length; j++) {
        const nodeA = this.nodes[i];
        const nodeB = this.nodes[j];

        // Calculate distance between nodes
        const dx = nodeB.position.x - nodeA.position.x;
        const dy = nodeB.position.y - nodeA.position.y;
        const distance = Math.sqrt(dx * dx + dy * dy);

        // Check if within connection radius (use the maximum of the two radii)
        const maxRadius = Math.max(nodeA.connectionRadius, nodeB.connectionRadius);
        if (distance <= maxRadius) {
          nodeA.connections.add(nodeB.id);
          nodeB.connections.add(nodeA.id);
        }
      }
    }
    
    // Don't clear routing tables here - let updateRoutingTables() handle transitions to inactive state
    // The BFS will recalculate which routes are still valid
    
    // Process queued triages for any node that now has connections and trigger subnet sync on new links
    this.nodes.forEach(node => {
      // If node has connections AND queued triages, send them now
      if (node.connections.size > 0 && node.triageQueue.length > 0) {
        const hadConnectionsBefore = previousConnectionStates.get(node.id);
        
        // Log whether this is a reconnection or ongoing connection
        if (hadConnectionsBefore === false) {
          console.log(`[Queue Send] Node ${node.id.substring(0, 8)} RECONNECTED - sending ${node.triageQueue.length} queued triages`);
        } else {
          console.log(`[Queue Send] Node ${node.id.substring(0, 8)} has connections - sending ${node.triageQueue.length} queued triages`);
        }
        
        // Process all queued triages
        const queuedTriages = [...node.triageQueue];
        node.triageQueue = []; // Clear the queue
        
        queuedTriages.forEach(queuedTriage => {
          // Send each queued triage
          this.sendQueuedTriage(node, queuedTriage.triageId, queuedTriage.severity);
        });
      }

      // Detect newly formed links for this node and proactively sync triages
      const prev = previousNeighbors.get(node.id) || new Set<string>();
      node.connections.forEach(peerId => {
        if (!prev.has(peerId)) {
          const peer = this.getNode(peerId);
          if (!peer) return;

          // Special case: if this new neighbor is a sink, push all triages
          // this node has that the sink hasn't yet seen directly to it.
          if (peer.type === 'sink' && node.triageStore.size > 0) {
            node.triageStore.forEach(triageId => {
              if (!peer.triageStore.has(triageId)) {
                const severity: import('../types/Message').TriageSeverity = 'red';

                const message: Message = {
                  id: uuidv4(),
                  fromNodeId: node.id,
                  toNodeId: peer.id,
                  progress: 0,
                  speed: DEFAULT_MESSAGE_CONFIG.defaultSpeed,
                  color: DEFAULT_MESSAGE_CONFIG.triageSeverityColors[severity],
                  createdAt: Date.now(),
                  type: 'triage',
                  triageId,
                  triageSeverity: severity,
                };
                this.messages.push(message);
              }
            });

            if (this.messages.length > 0) {
              this.notifyListeners();
            }
            return; // done for this new link
          }

          // General case: if the peer can reach sinks that this node hasn't
          // yet targeted triages towards, seed those triages across this
          // boundary. Uses sentTriagesToSinks to avoid repeated seeding.
          const reachableSinksFromPeer = Array.from(peer.routingTable.keys());
          if (reachableSinksFromPeer.length > 0 && node.triageStore.size > 0) {
            node.triageStore.forEach(triageId => {
              // For this triage, find if there is at least one sink S reachable
              // from the peer that this node has not yet marked as sent towards.
              const perTriage = node.sentTriagesToSinks.get(triageId);
              const hasNewSinkTarget = reachableSinksFromPeer.some(sinkId => !perTriage || !perTriage.has(sinkId));
              if (!hasNewSinkTarget) return;

              if (!peer.triageStore.has(triageId)) {
                const severity: import('../types/Message').TriageSeverity = 'red';

                const message: Message = {
                  id: uuidv4(),
                  fromNodeId: node.id,
                  toNodeId: peer.id,
                  progress: 0,
                  speed: DEFAULT_MESSAGE_CONFIG.defaultSpeed,
                  color: DEFAULT_MESSAGE_CONFIG.triageSeverityColors[severity],
                  createdAt: Date.now(),
                  type: 'triage',
                  triageId,
                  triageSeverity: severity,
                };
                this.messages.push(message);
              }

              // Mark all peer-reachable sinks as now having been targeted
              // from this node for this triage, so we don't reseed later.
              let per = node.sentTriagesToSinks.get(triageId);
              if (!per) {
                per = new Set<string>();
                node.sentTriagesToSinks.set(triageId, per);
              }
              reachableSinksFromPeer.forEach(sinkId => per!.add(sinkId));
            });

            if (this.messages.length > 0) {
              this.notifyListeners();
            }
          }
        }
      });
    });
  }

  // Link reconciliation and per-link ACK-based sync removed; routing alone will propagate triages.

  /**
   * Send triage summary from a node to a newly connected neighbor (one hop).
   * Chunk into parts to avoid oversized payloads.
   */
  // Summary-based sync removed (reset).

  /**
   * FOORS+ Routing: Update routing tables for all nodes based on BFS from each sink
   * This calculates the shortest path (hop count) from each node to each sink
   */
  private updateRoutingTables(): void {
    const now = Date.now();
    
    // Find all sink nodes
    const sinks = this.nodes.filter(node => node.type === 'sink');
    const sinkIds = new Set(sinks.map(s => s.id));
    
    // First pass: Transition routing entries to inactive state for sinks that no longer exist or are unreachable
    this.nodes.forEach(node => {
      const keysToTransition: string[] = [];
      node.routingTable.forEach((_entry, sinkId) => {
        // Check if sink no longer exists
        if (!sinkIds.has(sinkId)) {
          keysToTransition.push(sinkId);
        }
      });
      
      // Move to inactive routing tables
      keysToTransition.forEach(sinkId => {
        const entry = node.routingTable.get(sinkId)!;
        console.log(`[FOORS+] Node ${node.id.substring(0, 8)} - Sink ${sinkId.substring(0, 8)} no longer exists, transitioning to inactive`);
        node.inactiveRoutingTables.set(sinkId, {
          sinkId,
          lastActiveEntry: entry,
          inactiveSince: now,
        });
        node.routingTable.delete(sinkId);
      });
    });
    
    // Clean up expired inactive routing tables
    this.nodes.forEach(node => {
      const keysToDelete: string[] = [];
      node.inactiveRoutingTables.forEach((inactiveEntry, sinkId) => {
        const inactiveDuration = now - inactiveEntry.inactiveSince;
        if (inactiveDuration > this.inactiveRoutingTimeout) {
          console.log(`[FOORS+] Node ${node.id.substring(0, 8)} - Inactive route to ${sinkId.substring(0, 8)} expired (${Math.floor(inactiveDuration / 1000)}s), deleting`);
          keysToDelete.push(sinkId);
        }
      });
      keysToDelete.forEach(key => node.inactiveRoutingTables.delete(key));
    });
    
    // For each sink, run BFS to calculate hop counts to all reachable nodes
    sinks.forEach(sink => {
      // BFS data structures
      const distances = new Map<string, number>(); // nodeId -> hop count from sink
      const parents = new Map<string, string>(); // nodeId -> parent nodeId in BFS tree
      const queue: string[] = [sink.id];
      
      distances.set(sink.id, 0);
      
      // BFS from sink
      while (queue.length > 0) {
        const currentId = queue.shift()!;
        const currentNode = this.nodes.find(n => n.id === currentId);
        if (!currentNode) continue;
        
        const currentDistance = distances.get(currentId)!;
        
        // Visit all connected neighbors
        currentNode.connections.forEach(neighborId => {
          if (!distances.has(neighborId)) {
            // First time visiting this neighbor
            distances.set(neighborId, currentDistance + 1);
            parents.set(neighborId, currentId);
            queue.push(neighborId);
          }
        });
      }
      
      // Now update routing tables in all nodes
      // For each node that can reach this sink, determine its next hops
      this.nodes.forEach(node => {
        if (node.id === sink.id) return; // Sink doesn't need route to itself
        
        const hopCount = distances.get(node.id);
        if (hopCount === undefined) {
          // Node cannot reach this sink - transition to inactive if exists, otherwise skip
          const existingEntry = node.routingTable.get(sink.id);
          if (existingEntry) {
            console.log(`[FOORS+] Node ${node.id.substring(0, 8)} - Sink ${sink.id.substring(0, 8)} unreachable, transitioning to inactive`);
            // Move to inactive routing table
            node.inactiveRoutingTables.set(sink.id, {
              sinkId: sink.id,
              lastActiveEntry: existingEntry,
              inactiveSince: now,
            });
            node.routingTable.delete(sink.id);
          }
          return;
        }
        
        // Find all next hops: neighbors that are one hop closer to the sink
        const nextHops = new Map<string, number>();
        
        node.connections.forEach(neighborId => {
          const neighborDistance = distances.get(neighborId);
          if (neighborDistance !== undefined && neighborDistance < hopCount) {
            // This neighbor is closer to the sink - it's a valid next hop
            nextHops.set(neighborId, neighborDistance + 1); // Store the total hop count via this neighbor
          }
        });
        
        // Update this node's routing table for this sink
        if (nextHops.size > 0) {
          node.routingTable.set(sink.id, {
            nextHops,
            lastUpdate: now,
          });
          // Remove from inactive tables if it was there (sink reconnected)
          if (node.inactiveRoutingTables.has(sink.id)) {
            console.log(`[FOORS+] Node ${node.id.substring(0, 8)} - Sink ${sink.id.substring(0, 8)} reconnected, removing from inactive`);
            node.inactiveRoutingTables.delete(sink.id);
          }
        } else {
          // No valid next hops found - transition to inactive or delete
          const existingEntry = node.routingTable.get(sink.id);
          if (existingEntry) {
            console.log(`[FOORS+] Node ${node.id.substring(0, 8)} - Sink ${sink.id.substring(0, 8)} no valid next hops, transitioning to inactive`);
            node.inactiveRoutingTables.set(sink.id, {
              sinkId: sink.id,
              lastActiveEntry: existingEntry,
              inactiveSince: now,
            });
          }
          node.routingTable.delete(sink.id);
        }
      });
    });
    
    // Update routing states for all nodes after routing tables are calculated
    this.updateRoutingStates();

    // After routing is updated, if any sink has a route to another sink
    // treat that other sink as "newly reachable" and sync missing triages.
    sinks.forEach(potentialNewSink => {
      const someOtherSinkHasRoute = sinks.some(other =>
        other.id !== potentialNewSink.id && other.routingTable.has(potentialNewSink.id)
      );
      if (someOtherSinkHasRoute) {
        this.syncNewSinkFromExistingSinks(potentialNewSink);
      }
    });
  }

  // Note: replayMissingTriagesToSink helper removed for boundary-only replay.

  /**
   * FOORS+ Routing State Update: Calculate routing mode for each node
   * Determines if node should use intelligent routing or flooding based on route availability
   */
  private updateRoutingStates(): void {
    const now = Date.now();
    const ROUTE_TIMEOUT = 5 * 60 * 1000; // 5 minutes in milliseconds
    
    this.nodes.forEach(node => {
      // Count active and expired routes
      let activeRoutes = 0;
      let expiredRoutes = 0;
      
      node.routingTable.forEach((entry) => {
        const routeAge = now - entry.lastUpdate;
        if (routeAge < ROUTE_TIMEOUT) {
          activeRoutes++;
        } else {
          expiredRoutes++;
        }
      });
      
      // Count inactive routing tables
      const inactiveRoutes = node.inactiveRoutingTables.size;
      
      // Determine routing mode based on FOORS+ policy with sink-specific override
      let mode: import('../types/Node').RoutingMode;
      let floodingReason: 'no-routes' | 'routes-expired' | 'no-connections' | 'has-inactive-routes' | undefined;

      if (node.connections.size === 0) {
        mode = 'no-connections';
        floodingReason = 'no-connections';
      } else if (
        node.type === 'sink' &&
        activeRoutes === 0 &&
        expiredRoutes === 0 &&
        inactiveRoutes === 0
      ) {
        // Single-sink scenario (or sink without any need to route to other sinks):
        // Do not enter flooding just because routing tables are empty.
        // Keep sink quiet in intelligent mode (with no next hops).
        mode = 'intelligent';
        floodingReason = undefined;
      } else if (inactiveRoutes > 0) {
        // Has inactive routing tables - enter inactive mode (use flooding to reach potentially reconnecting sinks)
        mode = 'inactive';
        floodingReason = 'has-inactive-routes';
      } else if (activeRoutes > 0) {
        // Has at least one active route and no inactive routes - use intelligent routing
        mode = 'intelligent';
        floodingReason = undefined;
      } else if (expiredRoutes > 0) {
        // Has expired routes - allow flooding during inactivity window
        mode = 'flooding';
        floodingReason = 'routes-expired';
      } else {
        // No routes at all - allow flooding
        mode = 'flooding';
        floodingReason = 'no-routes';
      }
      
      // Update routing state (only update lastStateChange if mode changed)
      const previousMode = node.routingState.mode;
      const modeChanged = mode !== previousMode;
      
      node.routingState = {
        mode,
        activeRoutes,
        expiredRoutes,
        inactiveRoutes,
        floodingReason,
        lastStateChange: modeChanged ? now : node.routingState.lastStateChange,
      };
      
      // Log mode changes
      if (modeChanged) {
        console.log(`[FOORS+] Node ${node.id.substring(0, 8)} - Mode changed: ${previousMode} → ${mode} (active: ${activeRoutes}, expired: ${expiredRoutes}, inactive: ${inactiveRoutes})`);
      }
    });
  }

  /**
   * Simulation tick - update all nodes based on physics/algorithm
   * This is where you'll implement your algorithm logic
   */
  tick(deltaTime: number): void {
    // TODO: Implement simulation algorithm here
    // For now, just apply velocity to position
    this.nodes.forEach(node => {
      node.position.x += node.velocity.x * deltaTime;
      node.position.y += node.velocity.y * deltaTime;
    });

    // Update connections based on new positions
    this.updateConnections();

    // Update routing tables (FOORS+ algorithm)
    this.updateRoutingTables();

    // Auto-generate triages if enabled
    if (this.isAutoGenerating) {
      this.updateAutoGeneration();
    }

    // Update messages
    this.updateMessages(deltaTime);

    this.notifyListeners();
  }

  /**
   * Auto-generate triages at configured interval
   */
  private updateAutoGeneration(): void {
    const now = Date.now();
    const timeSinceLastGeneration = now - this.lastTriageGeneration;

    if (timeSinceLastGeneration >= this.triageGenerationInterval) {
      // Find all source nodes (not sinks) with connections
      const sourceNodes = this.nodes.filter(
        node => node.type === 'source' && node.connections.size > 0
      );

      if (sourceNodes.length > 0) {
        // Pick a random source node
        const randomNode = sourceNodes[Math.floor(Math.random() * sourceNodes.length)];
        
        // Send triage from this node with random severity
        const severities: import('../types/Message').TriageSeverity[] = ['black','green','yellow','red'];
        const severity = severities[Math.floor(Math.random() * severities.length)];
        this.sendMessage(randomNode.id, 'triage', severity);
        console.log(`[Auto-Gen] Generated triage from node ${randomNode.id.substring(0, 8)}`);
      }

      this.lastTriageGeneration = now;
    }
  }

  /**
   * Get all connections as pairs of node IDs
   */
  getConnections(): Array<[string, string]> {
    const connections: Array<[string, string]> = [];
    const seen = new Set<string>();

    this.nodes.forEach(node => {
      node.connections.forEach(connectedId => {
        // Create a unique key to avoid duplicates
        const key = [node.id, connectedId].sort().join('-');
        if (!seen.has(key)) {
          seen.add(key);
          connections.push([node.id, connectedId]);
        }
      });
    });

    return connections;
  }

  /**
   * Get simulation statistics
   */
  getStats() {
    const connections = this.getConnections();
    const sinks = this.nodes.filter(node => node.type === 'sink');
    const sources = this.nodes.filter(node => node.type === 'source');
    const routingModeCounts = {
      intelligent: this.nodes.filter(n => n.routingState.mode === 'intelligent').length,
      flooding: this.nodes.filter(n => n.routingState.mode === 'flooding').length,
      inactive: this.nodes.filter(n => n.routingState.mode === 'inactive').length,
      noConnections: this.nodes.filter(n => n.routingState.mode === 'no-connections').length,
    };

    const totalQueuedTriages = this.nodes.reduce((sum, n) => sum + n.triageQueue.length, 0);
    const totalMessagesInFlight = this.messages.filter(m => m.progress < 1).length;
    const totalTriagesSeenAtSinks = new Set<string>();
    sinks.forEach(s => s.triageStore.forEach(id => totalTriagesSeenAtSinks.add(id)));

    return {
      nodeCount: this.nodes.length,
      connectionCount: connections.length,
      totalVelocity: this.nodes.reduce(
        (sum, node) => sum + Math.sqrt(node.velocity.x ** 2 + node.velocity.y ** 2),
        0
      ),
      sinkCount: sinks.length,
      sourceCount: sources.length,
      routingModes: routingModeCounts,
      queuedTriages: totalQueuedTriages,
      messagesInFlight: totalMessagesInFlight,
      triagesSeenAtSinks: totalTriagesSeenAtSinks.size,
    };
  }

  /**
   * Send a message from one node using FOORS+ intelligent routing
   * Uses routing tables to forward to next hops, falls back to flooding if no route exists
   * Queues triages when node has no connections
   */
  sendMessage(fromNodeId: string, messageType: import('../types/Message').MessageType = 'normal', triageSeverity?: import('../types/Message').TriageSeverity): void {
    const fromNode = this.nodes.find(n => n.id === fromNodeId);
    if (!fromNode) return;

    // Generate a unique triage ID if this is a triage message
    const triageId = messageType === 'triage' ? uuidv4() : undefined;
    const severity: import('../types/Message').TriageSeverity | undefined = messageType === 'triage'
      ? (triageSeverity ?? 'red')
      : undefined;
    
    // If it's a triage, store it in the node's triage store
    if (messageType === 'triage' && triageId) {
      fromNode.triageStore.add(triageId);
      
      // Queue triage if node has no connections
      if (fromNode.connections.size === 0) {
        console.log(`Node ${fromNode.id.substring(0, 8)} has no connections - queueing triage ${triageId.substring(0, 8)}`);
        fromNode.triageQueue.push({
          triageId,
          severity: severity ?? 'red',
          queuedAt: Date.now(),
        });
        this.notifyListeners();
        return; // Don't try to send yet
      }
    }

    // FOORS+ Routing Logic: Determine which peers to send to
    const targetPeers = this.selectRoutingTargets(fromNode, fromNodeId, messageType, severity);

    // Determine which sinks this send is ultimately targeting (direct or via routing)
    const sinkIdsForSend = new Set<string>();
    if (messageType === 'triage' && triageId) {
      // If this node is itself a sink, include it
      if (fromNode.type === 'sink') sinkIdsForSend.add(fromNode.id);
      // Include all sinks currently reachable via routing table
      fromNode.routingTable.forEach((_entry, sinkId) => {
        sinkIdsForSend.add(sinkId);
      });
    }

    // Create messages to selected target peers
    targetPeers.forEach(toNodeId => {
      const msgId = uuidv4();
      const message: Message = {
        id: msgId,
        fromNodeId,
        toNodeId,
        progress: 0,
        speed: DEFAULT_MESSAGE_CONFIG.defaultSpeed,
        color: messageType === 'triage' && severity
          ? DEFAULT_MESSAGE_CONFIG.triageSeverityColors[severity]
          : (messageType === 'triage' ? DEFAULT_MESSAGE_CONFIG.triageColor : DEFAULT_MESSAGE_CONFIG.defaultColor),
        createdAt: Date.now(),
        type: messageType,
        triageId,
        triageSeverity: severity,
      };
      this.messages.push(message);
      // Mark that we've sent this triage towards the relevant sinks
      if (messageType === 'triage' && triageId && sinkIdsForSend.size > 0) {
        let perTriage = fromNode.sentTriagesToSinks.get(triageId);
        if (!perTriage) {
          perTriage = new Set<string>();
          fromNode.sentTriagesToSinks.set(triageId, perTriage);
        }
        sinkIdsForSend.forEach(sinkId => perTriage!.add(sinkId));
      }
    });

    this.notifyListeners();
  }

  /**
   * Send a queued triage message from a node that has reconnected
   * The triage ID already exists in the node's triage store
   * Uses flooding since routing tables may not be updated yet
   */
  private sendQueuedTriage(fromNode: Node, triageId: string, severity: import('../types/Message').TriageSeverity): void {
    // Triage should already be in the node's triage store
    if (!fromNode.triageStore.has(triageId)) {
      console.warn(`[Queue Send] Queued triage ${triageId.substring(0, 8)} not in node ${fromNode.id.substring(0, 8)} triage store`);
      return;
    }

    console.log(`[Queue Send] Node ${fromNode.id.substring(0, 8)} sending queued triage ${triageId.substring(0, 8)} to ${fromNode.connections.size} connections`);

    // Use flooding: send to all connected neighbors
    // This is necessary because routing tables may not be updated yet after reconnection
    const targetPeers = new Set<string>();
    fromNode.connections.forEach(peerId => {
      targetPeers.add(peerId);
    });

    console.log(`[Queue Send] Using flooding - sending to ${targetPeers.size} peers`);

    // Create messages to all connected peers
    targetPeers.forEach(toNodeId => {
      const message: Message = {
        id: uuidv4(),
        fromNodeId: fromNode.id,
        toNodeId,
        progress: 0,
        speed: DEFAULT_MESSAGE_CONFIG.defaultSpeed,
        color: DEFAULT_MESSAGE_CONFIG.triageSeverityColors[severity],
        createdAt: Date.now(),
        type: 'triage',
        triageId,
        triageSeverity: severity,
      };
      this.messages.push(message);
      console.log(`[Queue Send] Created message from ${fromNode.id.substring(0, 8)} to ${toNodeId.substring(0, 8)}`);
    });

    this.notifyListeners();
  }

  /**
   * Decide multi-route policy based on message type and severity.
   * Returns the maximum number of distinct next hops to use when multiple equal-cost routes exist.
   */
  private getMultiRouteCap(messageType?: import('../types/Message').MessageType, triageSeverity?: import('../types/Message').TriageSeverity): number {
    if (messageType === 'triage') {
      switch (triageSeverity) {
        case 'red':
          return 3; // High urgency: use broader multi-path within reason
        case 'yellow':
          return 2; // Moderate urgency: limited redundancy
        case 'green':
        case 'black':
        default:
          return 1; // Low/normal: single best path
      }
    }
    // Non-triage traffic defaults to single path
    return 1;
  }

  /**
   * FOORS+ Routing Decision: Select which peers to forward to
   * Uses routing state to determine intelligent routing vs flooding
   * Enhanced: When multiple equal-cost next hops exist, choose up to a severity-based cap of neighbors
   * that maximize sink coverage and minimize local load.
   */
  private selectRoutingTargets(
    node: Node,
    excludeNodeId?: string,
    messageType?: import('../types/Message').MessageType,
    triageSeverity?: import('../types/Message').TriageSeverity,
  ): Set<string> {
    const targets = new Set<string>();

    // Use FOORS+ routing state to decide behavior
    if (node.routingState.mode === 'intelligent') {
      // FOORS+ Intelligent Routing: Forward only to next hops from routing tables
      const now = Date.now();
      const ROUTE_TIMEOUT = 5 * 60 * 1000; // 5 minutes

      // Collect coverage: neighbor -> set of sinks reachable via active routes
      const neighborCoverage = new Map<string, Set<string>>();
      node.routingTable.forEach((entry, sinkId) => {
        const routeAge = now - entry.lastUpdate;
        if (routeAge < ROUTE_TIMEOUT) {
          entry.nextHops.forEach((_totalHopCount, peerId) => {
            if (peerId === excludeNodeId) return;
            if (!neighborCoverage.has(peerId)) neighborCoverage.set(peerId, new Set());
            neighborCoverage.get(peerId)!.add(sinkId);
          });
        }
      });

      const candidates = Array.from(neighborCoverage.keys());
      if (candidates.length === 0) {
        return targets; // no candidates in intelligent mode
      }

      const cap = this.getMultiRouteCap(messageType, triageSeverity);
      if (cap >= candidates.length) {
        // Within cap: use all candidates
        candidates.forEach(c => targets.add(c));
        return targets;
      }

      // Greedy selection maximizing sink coverage, tie-break by current load (fewer outgoing messages)
      const selected = new Set<string>();
      const coveredSinks = new Set<string>();

      const getLoad = (peerId: string) => this.messages.reduce((count, m) => (
        m.fromNodeId === node.id && m.toNodeId === peerId && m.progress < 1 ? count + 1 : count
      ), 0);

      const remaining = new Set(candidates);
      while (selected.size < cap && remaining.size > 0) {
        let bestPeer: string | null = null;
        let bestGain = -1;
        let bestLoad = Infinity;
        remaining.forEach(peerId => {
          const sinks = neighborCoverage.get(peerId)!;
          // marginal gain: newly covered sinks
          let gain = 0;
          sinks.forEach(s => { if (!coveredSinks.has(s)) gain++; });
          const load = getLoad(peerId);
          // Prefer higher gain, then lower load
          if (gain > bestGain || (gain === bestGain && load < bestLoad)) {
            bestPeer = peerId;
            bestGain = gain;
            bestLoad = load;
          }
        });
        if (bestPeer == null) break;
        selected.add(bestPeer);
        neighborCoverage.get(bestPeer)!.forEach(s => coveredSinks.add(s));
        remaining.delete(bestPeer);
      }

      // Fallback: if we somehow selected none, pick the lowest-load candidate
      if (selected.size === 0) {
        let minLoad = Infinity; let pick: string | null = null;
        candidates.forEach(peerId => {
          const load = this.messages.reduce((count, m) => (
            m.fromNodeId === node.id && m.toNodeId === peerId && m.progress < 1 ? count + 1 : count
          ), 0);
          if (load < minLoad) { minLoad = load; pick = peerId; }
        });
        if (pick) selected.add(pick);
      }

      selected.forEach(p => targets.add(p));
    } else if (node.routingState.mode === 'flooding' || node.routingState.mode === 'inactive') {
      // FOORS+ Flooding Policy: Send to all neighbors (controlled flooding)
      // Also used for inactive mode when routes exist but sinks are disconnected
      node.connections.forEach(peerId => {
        if (peerId !== excludeNodeId) {
          targets.add(peerId);
        }
      });
      
      if (node.routingState.mode === 'inactive' && targets.size > 0) {
        console.log(`[FOORS+] Node ${node.id.substring(0, 8)} - Using flooding due to inactive routes (${node.inactiveRoutingTables.size} inactive, ${node.routingTable.size} active)`);
      }
    }
    // If mode is 'no-connections', targets remains empty

    return targets;
  }

  /**
   * Get all active messages
   */
  getMessages(): Message[] {
    return this.messages;
  }

  /**
   * Update messages (move them along connections)
   */
  private updateMessages(deltaTime: number): void {
    // Update message progress and check for arrivals
    this.messages.forEach(message => {
      const oldProgress = message.progress;
      message.progress += message.speed * deltaTime;
      
      // Check if message just arrived (crossed the threshold)
      if (oldProgress < 1 && message.progress >= 1) {
        this.onMessageArrival(message);
      }
    });

    // Remove completed messages (progress >= 1)
    this.messages = this.messages.filter(message => message.progress < 1);
  }

  /**
   * Handle message arrival at a node
   * FOORS+ Algorithm: Uses intelligent routing when available, falls back to flooding
   * Queues triages if node becomes disconnected
   */
  private onMessageArrival(message: Message): void {
    const node = this.nodes.find(n => n.id === message.toNodeId);
    if (!node) return;
    
    // Set timestamp for visual effect
    node.lastMessageReceivedAt = Date.now();

    // Handle triage messages with deduplication
    if (message.type === 'triage' && message.triageId) {
      // In flooding/inactive mode, use strict dedup to avoid loops
      if (node.routingState.mode === 'flooding' || node.routingState.mode === 'inactive') {
        if (node.triageStore.has(message.triageId)) {
          return; // already seen in flooding-style propagation
        }
        node.triageStore.add(message.triageId);
      } else {
        // In intelligent mode, remember we've seen it but don't drop solely on that
        if (!node.triageStore.has(message.triageId)) {
          node.triageStore.add(message.triageId);
        }
      }
      
      // If node has no connections, queue the triage for later
      if (node.connections.size === 0) {
        console.log(`Node ${node.id.substring(0, 8)} received triage ${message.triageId.substring(0, 8)} but has no connections - queueing`);
        node.triageQueue.push({
          triageId: message.triageId,
          severity: message.triageSeverity ?? 'red',
          queuedAt: Date.now(),
        });
        this.notifyListeners();
        return; // Don't try to forward yet
      }
    }
    
    // FOORS+ Routing Logic: All nodes (sources and sinks) can forward
    // Sinks act as routers too: they forward intelligently or flood based on routing state
    {
      // Select routing targets using FOORS+ algorithm (exclude sender to avoid loops)
      const targetPeers = this.selectRoutingTargets(node, message.fromNodeId, message.type, message.triageSeverity);

      // For triages, determine sinks this forward is aimed at from this node's perspective
      const sinkIdsForForward = new Set<string>();
      if (message.type === 'triage' && message.triageId) {
        if (node.type === 'sink') sinkIdsForForward.add(node.id);
        node.routingTable.forEach((_entry, sinkId) => {
          sinkIdsForForward.add(sinkId);
        });

        // Only use per-sink forwarding suppression in intelligent mode.
        if (node.routingState.mode === 'intelligent') {
          const perTriage = node.sentTriagesToSinks.get(message.triageId);
          const allAlreadySent = perTriage && sinkIdsForForward.size > 0
            ? Array.from(sinkIdsForForward).every(sinkId => perTriage!.has(sinkId))
            : false;
          if (allAlreadySent) {
            return;
          }
        }
      }

      // Forward to selected peers
      targetPeers.forEach(toNodeId => {
        const forwardedMessage: Message = {
          id: uuidv4(),
          fromNodeId: node.id,
          toNodeId,
          progress: 0,
          speed: DEFAULT_MESSAGE_CONFIG.defaultSpeed,
          color: message.color, // Preserve the original message color
          createdAt: Date.now(),
          type: message.type, // Preserve message type
          triageId: message.triageId, // Preserve triage ID for deduplication
          triageSeverity: message.triageSeverity,
        };
        this.messages.push(forwardedMessage);

        // Mark that this node has forwarded this triage towards these sinks
        if (message.type === 'triage' && message.triageId && sinkIdsForForward.size > 0) {
          let perTriage = node.sentTriagesToSinks.get(message.triageId);
          if (!perTriage) {
            perTriage = new Set<string>();
            node.sentTriagesToSinks.set(message.triageId, perTriage);
          }
          sinkIdsForForward.forEach(sinkId => perTriage!.add(sinkId));
        }
      });

      this.notifyListeners();
    }

  }
}
