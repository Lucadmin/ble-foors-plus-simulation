import * as THREE from 'three';
import type { Node } from '../types/Node';

export class NodeRenderer {
  private scene: THREE.Scene;
  private nodeMeshes: Map<string, THREE.Group> = new Map();

  constructor(scene: THREE.Scene) {
    this.scene = scene;
  }

  createNodeVisual(node: Node): THREE.Group {
    const group = new THREE.Group();
    const radius = node.radius;

    // Main body with subtle fill
    const bodyGeometry = new THREE.CircleGeometry(radius * 0.92, 64);
    const bodyMaterial = new THREE.MeshBasicMaterial({
      color: node.color,
      transparent: true,
      opacity: 0.08,
      side: THREE.DoubleSide,
    });
    const body = new THREE.Mesh(bodyGeometry, bodyMaterial);
    body.userData.isBody = true;
    group.add(body);

    // Inner subtle glow for depth
    const glowGeometry = new THREE.CircleGeometry(radius * 0.5, 64);
    const glowMaterial = new THREE.MeshBasicMaterial({
      color: node.color,
      transparent: true,
      opacity: 0.06,
      side: THREE.DoubleSide,
    });
    const glow = new THREE.Mesh(glowGeometry, glowMaterial);
    glow.userData.isGlow = true;
    group.add(glow);

    // Thicker border ring
    const borderGeometry = new THREE.RingGeometry(
      radius * 0.92,
      radius,
      64
    );
    const borderMaterial = new THREE.MeshBasicMaterial({
      color: node.color,
      transparent: true,
      opacity: 0.7,
      side: THREE.DoubleSide,
    });
    const border = new THREE.Mesh(borderGeometry, borderMaterial);
    border.userData.isBorder = true;
    group.add(border);

    // Subtle inner border for depth
    const innerBorderGeometry = new THREE.RingGeometry(
      radius * 0.91,
      radius * 0.92,
      64
    );
    const innerBorderMaterial = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.15,
      side: THREE.DoubleSide,
    });
    const innerBorder = new THREE.Mesh(innerBorderGeometry, innerBorderMaterial);
    innerBorder.userData.isInnerBorder = true;
    group.add(innerBorder);

    // Three indicator dots ON the border (top-right arc)
    const indicatorRadius = radius * 0.14;
    const indicatorDistance = radius * 0.96; // Place on border line
    
    // Calculate positions along arc (top-right: 25°, 40°, 55° from top)
    const angles = [25, 40, 55];
    angles.forEach((angle, index) => {
      const angleRad = (angle * Math.PI) / 180;
      const x = Math.sin(angleRad) * indicatorDistance;
      const y = Math.cos(angleRad) * indicatorDistance;

      // Indicator outer ring (dark background)
      const indicatorBgGeometry = new THREE.CircleGeometry(indicatorRadius, 32);
      const indicatorBgMaterial = new THREE.MeshBasicMaterial({
        color: 0x0a0a0a,
        side: THREE.DoubleSide,
      });
      const indicatorBg = new THREE.Mesh(indicatorBgGeometry, indicatorBgMaterial);
      indicatorBg.position.set(x, y, 0.02);
      indicatorBg.userData.isIndicatorBg = true;
      indicatorBg.userData.indicatorIndex = index;
      group.add(indicatorBg);

      // Indicator circle fill
      const indicatorGeometry = new THREE.CircleGeometry(indicatorRadius * 0.75, 32);
      const indicatorMaterial = new THREE.MeshBasicMaterial({
        color: this.getIndicatorColor(index),
        transparent: true,
        opacity: 0.85,
        side: THREE.DoubleSide,
      });
      const indicator = new THREE.Mesh(indicatorGeometry, indicatorMaterial);
      indicator.position.set(x, y, 0.03);
      indicator.userData.isIndicator = true;
      indicator.userData.indicatorIndex = index;
      group.add(indicator);

      // Indicator border ring
      const indicatorBorderGeometry = new THREE.RingGeometry(
        indicatorRadius * 0.88,
        indicatorRadius * 0.96,
        32
      );
      const indicatorBorderMaterial = new THREE.MeshBasicMaterial({
        color: this.getIndicatorColor(index),
        transparent: true,
        opacity: 0.9,
        side: THREE.DoubleSide,
      });
      const indicatorBorder = new THREE.Mesh(indicatorBorderGeometry, indicatorBorderMaterial);
      indicatorBorder.position.set(x, y, 0.03);
      indicatorBorder.userData.isIndicatorBorder = true;
      indicatorBorder.userData.indicatorIndex = index;
      group.add(indicatorBorder);

      // Subtle glow around indicator
      const indicatorGlowGeometry = new THREE.CircleGeometry(indicatorRadius * 1.2, 32);
      const indicatorGlowMaterial = new THREE.MeshBasicMaterial({
        color: this.getIndicatorColor(index),
        transparent: true,
        opacity: 0.12,
        side: THREE.DoubleSide,
      });
      const indicatorGlow = new THREE.Mesh(indicatorGlowGeometry, indicatorGlowMaterial);
      indicatorGlow.position.set(x, y, 0.01);
      indicatorGlow.userData.isIndicatorGlow = true;
      indicatorGlow.userData.indicatorIndex = index;
      group.add(indicatorGlow);
    });

    group.position.set(node.position.x, node.position.y, 0.1);
    group.userData.nodeId = node.id;
    return group;
  }

  private getIndicatorColor(index: number): number {
    // Colors for the three indicators (can be customized per node later)
    const colors = [0x2563EB, 0x10B981, 0xF59E0B]; // Blue, Green, Yellow
    return colors[index] || 0xB8B8B8;
  }

  private getRoutingStateColor(mode: string): number {
    // Indicator 0 (leftmost) shows routing state
    switch (mode) {
      case 'intelligent':
        return 0x10B981; // Green - has active routes
      case 'flooding':
        return 0xF59E0B; // Orange - flooding mode
      case 'inactive':
        return 0xA855F7; // Purple - has inactive routing tables
      case 'no-connections':
        return 0x6B7280; // Gray - isolated
      default:
        return 0xB8B8B8; // Fallback gray
    }
  }

  updateNodes(nodes: Node[]): void {
    // Remove nodes that no longer exist
    this.nodeMeshes.forEach((group, id) => {
      if (!nodes.find(n => n.id === id)) {
        this.scene.remove(group);
        this.disposeGroup(group);
        this.nodeMeshes.delete(id);
      }
    });

    // Add or update nodes
    nodes.forEach(node => {
      let group = this.nodeMeshes.get(node.id);

      if (!group) {
        group = this.createNodeVisual(node);
        this.scene.add(group);
        this.nodeMeshes.set(node.id, group);
      }

      // Update position
      group.position.set(node.position.x, node.position.y, 0.1);

      // Update colors for body, glow and border
      group.children.forEach(child => {
        const mesh = child as THREE.Mesh;
        const material = mesh.material as THREE.MeshBasicMaterial;
        
        if (child.userData.isBody || child.userData.isBorder || child.userData.isGlow) {
          material.color.set(node.color);
        }

        // Update indicator 0 (leftmost) to show routing state
        if (child.userData.isIndicator && child.userData.indicatorIndex === 0) {
          const routingColor = this.getRoutingStateColor(node.routingState.mode);
          material.color.set(routingColor);
        }
        if (child.userData.isIndicatorBorder && child.userData.indicatorIndex === 0) {
          const routingColor = this.getRoutingStateColor(node.routingState.mode);
          material.color.set(routingColor);
        }
        if (child.userData.isIndicatorGlow && child.userData.indicatorIndex === 0) {
          const routingColor = this.getRoutingStateColor(node.routingState.mode);
          material.color.set(routingColor);
        }
      });

      // Update selection state
      if (node.selected) {
        this.addSelectionRing(group, node);
      } else {
        this.removeSelectionRing(group);
      }

      // Update message arrival pulse effect
      this.updateMessagePulse(group, node);
    });
  }

  private updateMessagePulse(group: THREE.Group, node: Node): void {
    const now = Date.now();
    const timeSinceArrival = node.lastMessageReceivedAt ? now - node.lastMessageReceivedAt : Infinity;
    const pulseDuration = 800; // ms

    if (timeSinceArrival < pulseDuration) {
      // Create pulse ring if it doesn't exist
      let pulseRing = group.children.find(
        child => child.userData.isPulseRing
      ) as THREE.Mesh | undefined;

      if (!pulseRing) {
        const pulseGeometry = new THREE.RingGeometry(
          node.radius * 1.0,
          node.radius * 1.05,
          64
        );
        const pulseMaterial = new THREE.MeshBasicMaterial({
          color: 0xF59E0B, // Amber color matching message
          transparent: true,
          opacity: 0.8,
          side: THREE.DoubleSide,
        });
        pulseRing = new THREE.Mesh(pulseGeometry, pulseMaterial);
        pulseRing.userData.isPulseRing = true;
        pulseRing.position.z = 0.15;
        group.add(pulseRing);
      }

      // Animate the pulse (expand and fade out)
      const progress = timeSinceArrival / pulseDuration;
      const scale = 1 + progress * 0.5; // Expand from 1.0 to 1.5
      const opacity = (1 - progress) * 0.8; // Fade from 0.8 to 0

      pulseRing.scale.set(scale, scale, 1);
      if (pulseRing.material instanceof THREE.MeshBasicMaterial) {
        pulseRing.material.opacity = opacity;
      }
    } else {
      // Remove pulse ring if animation is complete
      const pulseRing = group.children.find(
        child => child.userData.isPulseRing
      );
      if (pulseRing) {
        group.remove(pulseRing);
        if (pulseRing instanceof THREE.Mesh) {
          pulseRing.geometry.dispose();
          if (pulseRing.material instanceof THREE.Material) {
            pulseRing.material.dispose();
          }
        }
      }
    }
  }

  private addSelectionRing(group: THREE.Group, node: Node): void {
    // Check if selection ring already exists
    const existingRing = group.children.find(
      child => child.userData.isSelectionRing
    );
    if (existingRing) return;

    // Outer selection ring
    const selectionGeometry = new THREE.RingGeometry(
      node.radius * 1.06,
      node.radius * 1.10,
      64
    );
    const selectionMaterial = new THREE.MeshBasicMaterial({
      color: 0xFFFFFF,
      transparent: true,
      opacity: 0.6,
      side: THREE.DoubleSide,
    });
    const selectionRing = new THREE.Mesh(selectionGeometry, selectionMaterial);
    selectionRing.userData.isSelectionRing = true;
    selectionRing.position.z = 0.01;
    group.add(selectionRing);
  }

  private removeSelectionRing(group: THREE.Group): void {
    const selectionRing = group.children.find(
      child => child.userData.isSelectionRing
    );
    if (selectionRing) {
      group.remove(selectionRing);
      (selectionRing as THREE.Mesh).geometry.dispose();
      ((selectionRing as THREE.Mesh).material as THREE.Material).dispose();
    }
  }

  private disposeGroup(group: THREE.Group): void {
    group.children.forEach(child => {
      if (child instanceof THREE.Mesh) {
        child.geometry.dispose();
        (child.material as THREE.Material).dispose();
      }
    });
  }

  dispose(): void {
    this.nodeMeshes.forEach(group => {
      this.scene.remove(group);
      this.disposeGroup(group);
    });
    this.nodeMeshes.clear();
  }
}
