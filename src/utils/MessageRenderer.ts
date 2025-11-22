import * as THREE from 'three';
import type { Message } from '../types/Message';
import type { Node } from '../types/Node';

/**
 * MessageRenderer - Renders animated messages traveling between nodes
 */
export class MessageRenderer {
  private scene: THREE.Scene;
  private messageMeshes: Map<string, THREE.Group> = new Map();

  constructor(scene: THREE.Scene) {
    this.scene = scene;
  }

  /**
   * Update messages based on current state
   */
  updateMessages(messages: Message[], nodes: Node[]): void {
    const nodeMap = new Map<string, Node>();
    nodes.forEach(node => nodeMap.set(node.id, node));

    // Track which messages are still active
    const activeMessageIds = new Set<string>();

    messages.forEach(message => {
      activeMessageIds.add(message.id);

      const fromNode = nodeMap.get(message.fromNodeId);
      const toNode = nodeMap.get(message.toNodeId);

      if (!fromNode || !toNode) return;

      // Calculate current position along the connection (border to border)
      const dx = toNode.position.x - fromNode.position.x;
      const dy = toNode.position.y - fromNode.position.y;
      const distance = Math.sqrt(dx * dx + dy * dy);

      if (distance === 0) return;

      // Normalize direction
      const dirX = dx / distance;
      const dirY = dy / distance;

      // Start and end points (on borders)
      const startX = fromNode.position.x + dirX * fromNode.radius;
      const startY = fromNode.position.y + dirY * fromNode.radius;
      const endX = toNode.position.x - dirX * toNode.radius;
      const endY = toNode.position.y - dirY * toNode.radius;

      // Interpolate position
      const currentX = startX + (endX - startX) * message.progress;
      const currentY = startY + (endY - startY) * message.progress;

      // Calculate angle for direction
      const angle = Math.atan2(dy, dx);

      // Create or update message group
      let messageGroup = this.messageMeshes.get(message.id);
      if (!messageGroup) {
        messageGroup = new THREE.Group();

        // Regular rich triage/normal visual
        const coreGeometry = new THREE.SphereGeometry(0.06, 16, 16);
        const coreMaterial = new THREE.MeshBasicMaterial({
          color: 0xFFFFFF,
          transparent: true,
          opacity: 1.0,
        });
        const core = new THREE.Mesh(coreGeometry, coreMaterial);
        messageGroup.add(core);

        const innerGlowGeometry = new THREE.SphereGeometry(0.10, 16, 16);
        const innerGlowMaterial = new THREE.MeshBasicMaterial({
          color: message.color,
          transparent: true,
          opacity: 0.7,
        });
        const innerGlow = new THREE.Mesh(innerGlowGeometry, innerGlowMaterial);
        messageGroup.add(innerGlow);

        const outerGlowGeometry = new THREE.SphereGeometry(0.16, 16, 16);
        const outerGlowMaterial = new THREE.MeshBasicMaterial({
          color: message.color,
          transparent: true,
          opacity: 0.3,
        });
        const outerGlow = new THREE.Mesh(outerGlowGeometry, outerGlowMaterial);
        messageGroup.add(outerGlow);

        const streakGeometry = new THREE.CylinderGeometry(0.01, 0.04, 0.35, 8);
        streakGeometry.rotateZ(Math.PI / 2);
        const streakMaterial = new THREE.MeshBasicMaterial({
          color: message.color,
          transparent: true,
          opacity: 0.6,
        });
        const streak = new THREE.Mesh(streakGeometry, streakMaterial);
        streak.position.x = -0.175;
        messageGroup.add(streak);

        this.scene.add(messageGroup);
        this.messageMeshes.set(message.id, messageGroup);
      }

      messageGroup.position.set(currentX, currentY, 0.5);
      messageGroup.rotation.z = angle;

      // Animated pulsing for all glows
      const time = Date.now() * 0.005;
      const pulse = 1 + Math.sin(time) * 0.2;
      const innerGlow = messageGroup.children[1] as THREE.Mesh;
      const outerGlow = messageGroup.children[2] as THREE.Mesh;
      if (innerGlow) innerGlow.scale.set(pulse, pulse, pulse);
      if (outerGlow) {
        const outerPulse = 1 + Math.sin(time * 0.7) * 0.3;
        outerGlow.scale.set(outerPulse, outerPulse, outerPulse);
      }
    });

    // Remove meshes for completed messages
    this.messageMeshes.forEach((messageGroup, id) => {
      if (!activeMessageIds.has(id)) {
        this.scene.remove(messageGroup);
        // Dispose all children in the group
        messageGroup.children.forEach(child => {
          if (child instanceof THREE.Mesh) {
            child.geometry.dispose();
            if (Array.isArray(child.material)) {
              child.material.forEach((mat: THREE.Material) => mat.dispose());
            } else {
              child.material.dispose();
            }
          }
        });
        this.messageMeshes.delete(id);
      }
    });
  }

  /**
   * Clean up all resources
   */
  dispose(): void {
    this.messageMeshes.forEach(messageGroup => {
      this.scene.remove(messageGroup);
      // Dispose all children in the group
      messageGroup.children.forEach(child => {
        if (child instanceof THREE.Mesh) {
          child.geometry.dispose();
          if (Array.isArray(child.material)) {
            child.material.forEach((mat: THREE.Material) => mat.dispose());
          } else {
            child.material.dispose();
          }
        }
      });
    });
    this.messageMeshes.clear();
  }
}
