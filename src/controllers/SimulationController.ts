import * as THREE from 'three';
import type { SimulationModel } from '../models/SimulationModel';
import { isPointInNode } from '../utils/nodeUtils';

/**
 * SimulationController - Handles user interactions and updates the model
 * This is the "Controller" in MVC - manages user input and updates the model
 * 
 * ARCHITECTURAL DECISION: Cursor Style Manipulation
 * ================================================
 * This controller directly manipulates the canvas cursor style (renderer.domElement.style.cursor).
 * While this is technically a view concern, we've chosen to keep it here for the following reasons:
 * 
 * 1. TIGHT COUPLING: Cursor feedback must be immediate and tightly coupled to input state
 *    (isPanning, isDraggingNode, isSpacePressed, hoveredNode). Separating this would require
 *    passing 4+ state variables through callbacks.
 * 
 * 2. PERFORMANCE: Cursor updates happen on every mousemove event. Adding a callback layer
 *    would introduce unnecessary overhead for high-frequency updates.
 * 
 * 3. PRAGMATISM: The cursor is a direct extension of the input mechanism, not part of the
 *    simulation's visual representation. It's more closely related to input handling than
 *    to scene rendering.
 * 
 * 4. COMPLEXITY TRADE-OFF: A "pure" MVC approach would require a dedicated cursor state
 *    management system with callbacks, adding ~50 lines of boilerplate for marginal benefit.
 * 
 * This is an acceptable pragmatic trade-off for a project of this scale. The violation is
 * limited, isolated, and well-documented.
 */
export class SimulationController {
  private model: SimulationModel;
  private camera: THREE.OrthographicCamera | null = null;
  private renderer: THREE.WebGLRenderer | null = null;

  // Interaction state
  private isPanning = false;
  private isDraggingNode = false;
  private draggedNodeId: string | null = null;
  private lastMousePos = { x: 0, y: 0 };
  private mouseDownPos = { x: 0, y: 0 };
  private frustumSize = 10;
  private isSpacePressed = false;

  // Touch/trackpad interaction state
  private touches: Map<number, { x: number; y: number }> = new Map();
  private lastTouchDistance = 0;
  private lastTouchCenter = { x: 0, y: 0 };

  // Animation state for fit to view
  private isAnimating = false;
  private animationStartTime = 0;
  private animationDuration = 800; // ms
  private animationStart = { x: 0, y: 0, frustumSize: 10 };
  private animationEnd = { x: 0, y: 0, frustumSize: 10 };

  // Callbacks for UI state changes
  private onHoveredNodeChange?: (nodeId: string | null) => void;
  private onSelectedNodeChange?: (nodeId: string | null) => void;
  private selectedNodeId: string | null = null;

  constructor(model: SimulationModel) {
    this.model = model;
  }

  /**
   * Set the camera reference
   */
  setCamera(camera: THREE.OrthographicCamera): void {
    this.camera = camera;
    this.frustumSize = (camera.top - camera.bottom);
  }

  /**
   * Set the renderer reference
   */
  setRenderer(renderer: THREE.WebGLRenderer): void {
    this.renderer = renderer;
  }

  /**
   * Set callback for hovered node changes
   */
  setOnHoveredNodeChange(callback: (nodeId: string | null) => void): void {
    this.onHoveredNodeChange = callback;
  }

  /**
   * Set callback for selected node changes
   */
  setOnSelectedNodeChange(callback: (nodeId: string | null) => void): void {
    this.onSelectedNodeChange = callback;
  }

  /**
   * Convert screen coordinates to world coordinates
   */
  private screenToWorld(screenX: number, screenY: number): { x: number; y: number } | null {
    if (!this.camera || !this.renderer) return null;

    const rect = this.renderer.domElement.getBoundingClientRect();
    const x = ((screenX - rect.left) / rect.width) * 2 - 1;
    const y = -((screenY - rect.top) / rect.height) * 2 + 1;

    const vector = new THREE.Vector3(x, y, 0);
    vector.unproject(this.camera);

    return { x: vector.x, y: vector.y };
  }

  /**
   * Handle key down for pan mode
   */
  handleKeyDown(event: KeyboardEvent): void {
    if (event.code === 'Space' && !this.isSpacePressed) {
      event.preventDefault();
      this.isSpacePressed = true;
      if (this.renderer?.domElement.style) {
        this.renderer.domElement.style.cursor = 'grab';
      }
    }
  }

  /**
   * Handle key up for pan mode
   */
  handleKeyUp(event: KeyboardEvent): void {
    if (event.code === 'Space') {
      event.preventDefault();
      this.isSpacePressed = false;
      this.isPanning = false;
      if (this.renderer?.domElement.style) {
        this.renderer.domElement.style.cursor = 'crosshair';
      }
    }
  }

  /**
   * Handle mouse down event
   */
  handleMouseDown(event: MouseEvent): void {
    // Space + Left click = Pan
    if (this.isSpacePressed && event.button === 0) {
      event.preventDefault();
      this.isPanning = true;
      this.lastMousePos = { x: event.clientX, y: event.clientY };

      if (this.renderer?.domElement.style) {
        this.renderer.domElement.style.cursor = 'grabbing';
      }
    } else if (event.button === 1) { // Middle mouse button
      event.preventDefault();
      this.isPanning = true;
      this.lastMousePos = { x: event.clientX, y: event.clientY };

      if (this.renderer?.domElement.style) {
        this.renderer.domElement.style.cursor = 'grabbing';
      }
    } else if (event.button === 0) { // Left mouse button
      const worldPos = this.screenToWorld(event.clientX, event.clientY);
      if (!worldPos) return;

      // Check if clicking on a node
      const nodes = this.model.getNodes();
      const clickedNode = nodes.find(node =>
        isPointInNode(worldPos, node)
      );

      if (clickedNode) {
        this.isDraggingNode = true;
        this.draggedNodeId = clickedNode.id;
        if (this.renderer?.domElement.style) {
          this.renderer.domElement.style.cursor = 'grabbing';
        }
      }
    }

    // Store mouse down position to detect drag
    this.mouseDownPos = { x: event.clientX, y: event.clientY };
  }

  /**
   * Handle mouse move event
   */
  handleMouseMove(event: MouseEvent): void {
    if (!this.camera || !this.renderer) return;

    // Handle panning
    if (this.isPanning) {
      const deltaX = event.clientX - this.lastMousePos.x;
      const deltaY = event.clientY - this.lastMousePos.y;

      // Convert pixel delta to world coordinates delta
      const rect = this.renderer.domElement.getBoundingClientRect();
      const worldDeltaX = -(deltaX / rect.width) * (this.camera.right - this.camera.left);
      const worldDeltaY = (deltaY / rect.height) * (this.camera.top - this.camera.bottom);

      this.camera.position.x += worldDeltaX;
      this.camera.position.y += worldDeltaY;

      this.lastMousePos = { x: event.clientX, y: event.clientY };
      return;
    }

    const worldPos = this.screenToWorld(event.clientX, event.clientY);
    if (!worldPos) return;

    // Handle node dragging
    if (this.isDraggingNode && this.draggedNodeId) {
      this.model.updateNodePosition(this.draggedNodeId, worldPos.x, worldPos.y);
      
      if (this.renderer.domElement.style) {
        this.renderer.domElement.style.cursor = 'grabbing';
      }
      return;
    }

    // Check if hovering over a node
    const nodes = this.model.getNodes();
    const hoveredNode = nodes.find(node =>
      isPointInNode(worldPos, node)
    );

    this.onHoveredNodeChange?.(hoveredNode?.id || null);

    // Update cursor style
    if (this.renderer.domElement.style) {
      if (this.isPanning) {
        this.renderer.domElement.style.cursor = 'grabbing';
      } else if (this.isDraggingNode) {
        this.renderer.domElement.style.cursor = 'grabbing';
      } else if (this.isSpacePressed) {
        this.renderer.domElement.style.cursor = 'grab';
      } else {
        this.renderer.domElement.style.cursor = hoveredNode ? 'pointer' : 'crosshair';
      }
    }
  }

  /**
   * Handle mouse up event
   */
  handleMouseUp(event: MouseEvent): void {
    const wasPanning = this.isPanning;
    const wasDraggingNode = this.isDraggingNode;
    const draggedNodeId = this.draggedNodeId;

    this.isPanning = false;
    this.isDraggingNode = false;
    this.draggedNodeId = null;

    if (!this.camera || !this.renderer) return;

    if (this.renderer.domElement.style && (wasPanning || wasDraggingNode)) {
      this.renderer.domElement.style.cursor = 'crosshair';
    }

    // Calculate drag distance
    const dragDistance = Math.sqrt(
      Math.pow(event.clientX - this.mouseDownPos.x, 2) +
      Math.pow(event.clientY - this.mouseDownPos.y, 2)
    );

    // If drag distance is less than 5 pixels, consider it a click
    if (dragDistance < 5 && event.button === 0) { // Left click only
      const worldPos = this.screenToWorld(event.clientX, event.clientY);
      if (!worldPos) return;

      // Check if clicked on existing node
      const nodes = this.model.getNodes();
      const clickedNode = nodes.find(node =>
        isPointInNode(worldPos, node)
      );

      if (clickedNode) {
        // Toggle selection: deselect if already selected, select if not
        const newSelectedId = this.selectedNodeId === clickedNode.id ? null : clickedNode.id;
        this.selectedNodeId = newSelectedId;
        this.onSelectedNodeChange?.(newSelectedId);
      } else {
        // Create new node at click position and deselect any selected node
        this.model.addNode(worldPos.x, worldPos.y);
        this.selectedNodeId = null;
        this.onSelectedNodeChange?.(null);
      }
    } else if (wasDraggingNode && draggedNodeId && dragDistance >= 5) {
      // If we actually dragged a node (not just clicked), keep it selected
      this.selectedNodeId = draggedNodeId;
      this.onSelectedNodeChange?.(draggedNodeId);
    }
  }

  /**
   * Handle mouse wheel for zoom
   */
  handleWheel(event: WheelEvent): void {
    event.preventDefault();
    if (!this.camera) return;

    const zoomSpeed = 0.1;
    const delta = event.deltaY > 0 ? 1 + zoomSpeed : 1 - zoomSpeed;

    // Calculate new frustum size
    const aspect = window.innerWidth / window.innerHeight;
    const currentWidth = this.camera.right - this.camera.left;
    const newWidth = currentWidth * delta;

    // Limit zoom
    const minWidth = 2;
    const maxWidth = 100;
    if (newWidth < minWidth || newWidth > maxWidth) return;

    const newFrustumSize = newWidth / aspect;
    this.frustumSize = newFrustumSize;

    this.camera.left = -newFrustumSize * aspect / 2;
    this.camera.right = newFrustumSize * aspect / 2;
    this.camera.top = newFrustumSize / 2;
    this.camera.bottom = -newFrustumSize / 2;
    this.camera.updateProjectionMatrix();
  }

  /**
   * Handle mouse leave
   */
  handleMouseLeave(): void {
    this.isPanning = false;
    this.isDraggingNode = false;
    this.draggedNodeId = null;
    if (this.renderer?.domElement.style) {
      this.renderer.domElement.style.cursor = 'crosshair';
    }
  }

  /**
   * Delete a node
   */
  deleteNode(nodeId: string): void {
    this.model.removeNode(nodeId);
    if (this.selectedNodeId === nodeId) {
      this.selectedNodeId = null;
      this.onSelectedNodeChange?.(null);
    }
  }

  /**
   * Get frustum size
   */
  getFrustumSize(): number {
    return this.frustumSize;
  }

  /**
   * Fit camera to show all nodes with smooth animation
   */
  fitToView(): void {
    if (!this.camera || !this.renderer) return;

    const nodes = this.model.getNodes();
    if (nodes.length === 0) return;

    // Calculate bounding box of all nodes (including their radii)
    let minX = Infinity, maxX = -Infinity;
    let minY = Infinity, maxY = -Infinity;

    nodes.forEach(node => {
      const nodeRadius = node.radius;
      minX = Math.min(minX, node.position.x - nodeRadius);
      maxX = Math.max(maxX, node.position.x + nodeRadius);
      minY = Math.min(minY, node.position.y - nodeRadius);
      maxY = Math.max(maxY, node.position.y + nodeRadius);
    });

    // Calculate center
    const centerX = (minX + maxX) / 2;
    const centerY = (minY + maxY) / 2;

    // Calculate required frustum size with padding
    const width = maxX - minX;
    const height = maxY - minY;
    const aspect = this.renderer.domElement.clientWidth / this.renderer.domElement.clientHeight;
    
    // Add 20% padding
    const padding = 1.2;
    let newFrustumSize: number;
    
    if (width / aspect > height) {
      // Width is the limiting factor
      newFrustumSize = (width / aspect) * padding;
    } else {
      // Height is the limiting factor
      newFrustumSize = height * padding;
    }

    // Clamp to reasonable limits
    newFrustumSize = Math.max(2, Math.min(100, newFrustumSize));

    // Set up animation
    this.animationStart = {
      x: this.camera.position.x,
      y: this.camera.position.y,
      frustumSize: this.frustumSize,
    };
    this.animationEnd = {
      x: centerX,
      y: centerY,
      frustumSize: newFrustumSize,
    };
    this.animationStartTime = performance.now();
    this.isAnimating = true;
  }

  /**
   * Update animation (call this in render loop)
   */
  updateAnimation(): void {
    if (!this.isAnimating || !this.camera || !this.renderer) return;

    const now = performance.now();
    const elapsed = now - this.animationStartTime;
    const progress = Math.min(elapsed / this.animationDuration, 1);

    // Easing function (ease-in-out)
    const easeInOutCubic = (t: number): number => {
      return t < 0.5
        ? 4 * t * t * t
        : 1 - Math.pow(-2 * t + 2, 3) / 2;
    };

    const easedProgress = easeInOutCubic(progress);

    // Interpolate position and frustum size
    const currentX = this.animationStart.x + (this.animationEnd.x - this.animationStart.x) * easedProgress;
    const currentY = this.animationStart.y + (this.animationEnd.y - this.animationStart.y) * easedProgress;
    const currentFrustumSize = this.animationStart.frustumSize + 
      (this.animationEnd.frustumSize - this.animationStart.frustumSize) * easedProgress;

    // Update camera
    this.frustumSize = currentFrustumSize;
    const aspect = this.renderer.domElement.clientWidth / this.renderer.domElement.clientHeight;
    this.camera.left = -currentFrustumSize * aspect / 2;
    this.camera.right = currentFrustumSize * aspect / 2;
    this.camera.top = currentFrustumSize / 2;
    this.camera.bottom = -currentFrustumSize / 2;
    this.camera.position.set(currentX, currentY, 10);
    this.camera.updateProjectionMatrix();

    // End animation
    if (progress >= 1) {
      this.isAnimating = false;
    }
  }

  /**
   * Handle touch start event (for touchpad and touch screen)
   */
  handleTouchStart(event: TouchEvent): void {
    event.preventDefault();

    // Store all touch points
    for (let i = 0; i < event.touches.length; i++) {
      const touch = event.touches[i];
      this.touches.set(touch.identifier, {
        x: touch.clientX,
        y: touch.clientY,
      });
    }

    // Calculate initial distance and center for pinch-to-zoom
    if (event.touches.length === 2) {
      const touch1 = event.touches[0];
      const touch2 = event.touches[1];
      
      const dx = touch2.clientX - touch1.clientX;
      const dy = touch2.clientY - touch1.clientY;
      this.lastTouchDistance = Math.sqrt(dx * dx + dy * dy);
      
      this.lastTouchCenter = {
        x: (touch1.clientX + touch2.clientX) / 2,
        y: (touch1.clientY + touch2.clientY) / 2,
      };
    }
  }

  /**
   * Handle touch move event (for touchpad and touch screen)
   */
  handleTouchMove(event: TouchEvent): void {
    event.preventDefault();
    
    if (!this.camera || !this.renderer) return;

    if (event.touches.length === 2) {
      // Two-finger gesture: pan and zoom
      const touch1 = event.touches[0];
      const touch2 = event.touches[1];

      // Calculate current distance and center
      const dx = touch2.clientX - touch1.clientX;
      const dy = touch2.clientY - touch1.clientY;
      const currentDistance = Math.sqrt(dx * dx + dy * dy);
      
      const currentCenter = {
        x: (touch1.clientX + touch2.clientX) / 2,
        y: (touch1.clientY + touch2.clientY) / 2,
      };

      // Calculate scale change
      const scale = this.lastTouchDistance > 0 ? currentDistance / this.lastTouchDistance : 1;
      const scaleChange = Math.abs(1 - scale);
      
      // Calculate pan movement
      const centerDeltaX = currentCenter.x - this.lastTouchCenter.x;
      const centerDeltaY = currentCenter.y - this.lastTouchCenter.y;
      const panDistance = Math.sqrt(centerDeltaX * centerDeltaX + centerDeltaY * centerDeltaY);

      // Threshold to determine if this is primarily a pinch or a pan
      // If scale change is significant, treat it as pinch-zoom
      // Otherwise, treat it as pan
      const PINCH_THRESHOLD = 0.02; // 2% scale change threshold

      if (scaleChange > PINCH_THRESHOLD) {
        // Handle pinch-to-zoom
        if (this.lastTouchDistance > 0) {
          // Get world position at pinch center before zoom
          const worldPosBeforeZoom = this.screenToWorld(currentCenter.x, currentCenter.y);
          
          // Apply zoom
          this.frustumSize = Math.max(1, Math.min(50, this.frustumSize / scale));
          this.updateCameraProjection();
          
          // Get world position at pinch center after zoom
          const worldPosAfterZoom = this.screenToWorld(currentCenter.x, currentCenter.y);
          
          // Adjust camera to keep pinch center at the same world position
          if (worldPosBeforeZoom && worldPosAfterZoom) {
            this.camera.position.x += worldPosBeforeZoom.x - worldPosAfterZoom.x;
            this.camera.position.y += worldPosBeforeZoom.y - worldPosAfterZoom.y;
          }
        }
      }

      // Always handle two-finger pan (even during pinch, for smooth UX)
      if (panDistance > 0.5) { // Minimum pan threshold in pixels
        const rect = this.renderer.domElement.getBoundingClientRect();
        const worldDeltaX = -(centerDeltaX / rect.width) * (this.camera.right - this.camera.left);
        const worldDeltaY = (centerDeltaY / rect.height) * (this.camera.top - this.camera.bottom);

        this.camera.position.x += worldDeltaX;
        this.camera.position.y += worldDeltaY;
      }

      // Update for next frame
      this.lastTouchDistance = currentDistance;
      this.lastTouchCenter = currentCenter;
    } else if (event.touches.length === 1) {
      // Single finger: drag node or pan
      const touch = event.touches[0];
      const worldPos = this.screenToWorld(touch.clientX, touch.clientY);
      
      if (!worldPos) return;

      // If dragging a node
      if (this.isDraggingNode && this.draggedNodeId) {
        this.model.updateNodePosition(this.draggedNodeId, worldPos.x, worldPos.y);
      } else {
        // Single finger pan
        const prevTouch = this.touches.get(touch.identifier);
        if (prevTouch) {
          const deltaX = touch.clientX - prevTouch.x;
          const deltaY = touch.clientY - prevTouch.y;

          const rect = this.renderer.domElement.getBoundingClientRect();
          const worldDeltaX = -(deltaX / rect.width) * (this.camera.right - this.camera.left);
          const worldDeltaY = (deltaY / rect.height) * (this.camera.top - this.camera.bottom);

          this.camera.position.x += worldDeltaX;
          this.camera.position.y += worldDeltaY;
        }

        // Update touch position
        this.touches.set(touch.identifier, {
          x: touch.clientX,
          y: touch.clientY,
        });
      }
    }
  }

  /**
   * Handle touch end event (for touchpad and touch screen)
   */
  handleTouchEnd(event: TouchEvent): void {
    event.preventDefault();

    // Remove ended touches
    const currentTouchIds = new Set<number>();
    for (let i = 0; i < event.touches.length; i++) {
      currentTouchIds.add(event.touches[i].identifier);
    }

    // Clean up touches that ended
    for (const [id] of this.touches) {
      if (!currentTouchIds.has(id)) {
        this.touches.delete(id);
      }
    }

    // Reset touch state when all touches end
    if (event.touches.length === 0) {
      this.touches.clear();
      this.lastTouchDistance = 0;
      this.isDraggingNode = false;
      this.draggedNodeId = null;
    } else if (event.touches.length === 2) {
      // Recalculate for remaining two touches
      const touch1 = event.touches[0];
      const touch2 = event.touches[1];
      
      const dx = touch2.clientX - touch1.clientX;
      const dy = touch2.clientY - touch1.clientY;
      this.lastTouchDistance = Math.sqrt(dx * dx + dy * dy);
      
      this.lastTouchCenter = {
        x: (touch1.clientX + touch2.clientX) / 2,
        y: (touch1.clientY + touch2.clientY) / 2,
      };
    }
  }

  /**
   * Update camera projection matrix
   */
  private updateCameraProjection(): void {
    if (!this.camera || !this.renderer) return;

    const aspect = this.renderer.domElement.clientWidth / this.renderer.domElement.clientHeight;
    this.camera.left = -this.frustumSize * aspect / 2;
    this.camera.right = this.frustumSize * aspect / 2;
    this.camera.top = this.frustumSize / 2;
    this.camera.bottom = -this.frustumSize / 2;
    this.camera.updateProjectionMatrix();
  }
}
