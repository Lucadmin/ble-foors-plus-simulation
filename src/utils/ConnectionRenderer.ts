import * as THREE from 'three';
import type { Node } from '../types/Node';

/**
 * ConnectionRenderer - Renders connections between nodes
 */
export class ConnectionRenderer {
  private scene: THREE.Scene;
  private connectionMeshes: THREE.Mesh[] = [];

  constructor(scene: THREE.Scene) {
    this.scene = scene;
  }

  /**
   * Update connections based on nodes
   * @param nodes - Array of all nodes
   * @param selectedNodeId - ID of currently selected node (for routing path highlighting)
   */
  updateConnections(nodes: Node[], selectedNodeId: string | null = null): void {
    // Remove old connection meshes
    this.connectionMeshes.forEach(mesh => {
      this.scene.remove(mesh);
      mesh.geometry.dispose();
      if (Array.isArray(mesh.material)) {
        mesh.material.forEach(mat => mat.dispose());
      } else {
        mesh.material.dispose();
      }
    });
    this.connectionMeshes = [];

    // Build connection meshes
    const nodeMap = new Map<string, Node>();
    nodes.forEach(node => nodeMap.set(node.id, node));

    // Get routing paths from selected node if any
    // We'll trace the complete path from selected node to all reachable sinks
    const routingPaths = new Set<string>();
    if (selectedNodeId) {
      const selectedNode = nodeMap.get(selectedNodeId);
      if (selectedNode) {
        // For each sink in the routing table, trace the full path
        selectedNode.routingTable.forEach((_, sinkId) => {
          // BFS to trace all paths from selected node to this sink
          const visited = new Set<string>();
          const queue: string[] = [selectedNodeId];
          visited.add(selectedNodeId);
          
          while (queue.length > 0) {
            const currentId = queue.shift()!;
            const currentNode = nodeMap.get(currentId);
            
            if (!currentNode) continue;
            if (currentId === sinkId) continue; // Reached the sink
            
            // Check if this node has a route to the sink
            const routeToSink = currentNode.routingTable.get(sinkId);
            if (!routeToSink) continue;
            
            // Follow all next hops that lead to the sink
            routeToSink.nextHops.forEach((_, nextHopId) => {
              // Add this connection to the path
              const key = [currentId, nextHopId].sort().join('-');
              routingPaths.add(key);
              
              // Continue tracing from the next hop
              if (!visited.has(nextHopId)) {
                visited.add(nextHopId);
                queue.push(nextHopId);
              }
            });
          }
        });
      }
    }

    // Create thick lines for each connection
    const seen = new Set<string>();
    nodes.forEach(node => {
      node.connections.forEach(connectedId => {
        const key = [node.id, connectedId].sort().join('-');
        if (!seen.has(key)) {
          seen.add(key);
          const connectedNode = nodeMap.get(connectedId);
          if (connectedNode) {
            // Calculate direction vector
            const dx = connectedNode.position.x - node.position.x;
            const dy = connectedNode.position.y - node.position.y;
            const distance = Math.sqrt(dx * dx + dy * dy);
            
            if (distance > 0) {
              // Normalize direction
              const dirX = dx / distance;
              const dirY = dy / distance;
              
              // Calculate border points
              const startX = node.position.x + dirX * node.radius;
              const startY = node.position.y + dirY * node.radius;
              const endX = connectedNode.position.x - dirX * connectedNode.radius;
              const endY = connectedNode.position.y - dirY * connectedNode.radius;
              
              // Calculate actual line length
              const lineLength = Math.sqrt(
                Math.pow(endX - startX, 2) + Math.pow(endY - startY, 2)
              );
              
              // Determine if this is a routing path
              const isRoutingPath = routingPaths.has(key);
              
              // Create thick line using a thin box geometry
              const lineWidth = isRoutingPath ? 0.08 : 0.04; // Thicker for routing paths
              const geometry = new THREE.BoxGeometry(lineLength, lineWidth, 0.01);
              
              // Choose color based on whether it's a routing path
              const material = new THREE.MeshBasicMaterial({
                color: isRoutingPath ? 0x10B981 : 0x2563eb, // Green for routing, blue for normal
                opacity: isRoutingPath ? 0.8 : 0.4,
                transparent: true,
              });
              
              const mesh = new THREE.Mesh(geometry, material);
              
              // Position at midpoint
              mesh.position.set(
                (startX + endX) / 2,
                (startY + endY) / 2,
                isRoutingPath ? 0 : -0.01 // Routing paths on top
              );
              
              // Rotate to align with connection
              const angle = Math.atan2(dy, dx);
              mesh.rotation.z = angle;
              
              this.scene.add(mesh);
              this.connectionMeshes.push(mesh);
            }
          }
        }
      });
    });
  }

  /**
   * Clean up resources
   */
  dispose(): void {
    this.connectionMeshes.forEach(mesh => {
      this.scene.remove(mesh);
      mesh.geometry.dispose();
      if (Array.isArray(mesh.material)) {
        mesh.material.forEach(mat => mat.dispose());
      } else {
        mesh.material.dispose();
      }
    });
    this.connectionMeshes = [];
  }
}
