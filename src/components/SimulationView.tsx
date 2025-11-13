import { useEffect, useRef, useState, useCallback } from 'react';
import * as THREE from 'three';
import { SimulationModel } from '../models/SimulationModel';
import type { TriageSeverity } from '../types/Message';
import { SimulationController } from '../controllers/SimulationController';
import { NodeRenderer } from '../utils/NodeRenderer';
import { ConnectionRenderer } from '../utils/ConnectionRenderer';
import { MessageRenderer } from '../utils/MessageRenderer';
import NodeInfoPanel from './NodeInfoPanel';
import NodeDetailPanel from './NodeDetailPanel';
import KeyboardShortcuts from './KeyboardShortcuts';
import './SimulationCanvas.css';

interface SimulationViewProps {
  onStatsUpdate?: (stats: { nodeCount: number; connectionCount: number; connectionRadius: number }) => void;
  onConnectionRadiusChange?: (handler: (radius: number) => void) => void;
  onInactiveRoutingTimeoutChange?: (handler: (timeout: number) => void) => void;
  onTriageGenerationIntervalChange?: (handler: (interval: number) => void) => void;
  onPlayPause?: (handler: () => void) => void;
  onReset?: (handler: () => void) => void;
  onAutoGeneratingStateChange?: (isGenerating: boolean) => void;
  onFitToView?: (handler: () => void) => void;
}

/**
 * SimulationView - Renders the simulation and handles Three.js rendering
 * This is the "View" in MVC - responsible for visualization only
 */
const SimulationView = ({
  onStatsUpdate,
  onConnectionRadiusChange,
  onInactiveRoutingTimeoutChange,
  onTriageGenerationIntervalChange,
  onPlayPause,
  onReset,
  onAutoGeneratingStateChange,
  onFitToView
}: SimulationViewProps = {}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.OrthographicCamera | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const nodeRendererRef = useRef<NodeRenderer | null>(null);
  const connectionRendererRef = useRef<ConnectionRenderer | null>(null);
  const messageRendererRef = useRef<MessageRenderer | null>(null);

  // MVC instances
  const modelRef = useRef<SimulationModel | null>(null);
  const controllerRef = useRef<SimulationController | null>(null);

  // UI state
  const [nodes, setNodes] = useState<ReturnType<SimulationModel['getNodes']>>([]);
  const [messages, setMessages] = useState<ReturnType<SimulationModel['getMessages']>>([]);
  const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [isPinned, setIsPinned] = useState(false);
  const [pinnedNodeId, setPinnedNodeId] = useState<string | null>(null);
  const [detailNodeIds, setDetailNodeIds] = useState<string[]>([]);
  // Global triage severity selection (used by panel + keyboard 'T')
  const [selectedSeverity, setSelectedSeverity] = useState<TriageSeverity>('red');

  // Initialize model and controller
  useEffect(() => {
    if (!modelRef.current) {
      modelRef.current = new SimulationModel();
    }
    if (!controllerRef.current) {
      controllerRef.current = new SimulationController(modelRef.current);
    }

    const model = modelRef.current;
    const controller = controllerRef.current;

    // Subscribe to model changes
    const unsubscribe = model.subscribe(() => {
      setNodes(model.getNodes());
      setMessages(model.getMessages());

      // Update stats
      if (onStatsUpdate) {
        const stats = model.getStats();
        onStatsUpdate({
          nodeCount: stats.nodeCount,
          connectionCount: stats.connectionCount,
          connectionRadius: model.getConnectionRadius(),
        });
      }
    });

    // Set up controller callbacks
    controller.setOnHoveredNodeChange(setHoveredNodeId);
    controller.setOnSelectedNodeChange((nodeId) => {
      // Only update selected node if not pinned
      if (!isPinned) {
        setSelectedNodeId(nodeId);
      }
    });

    // Expose connection radius handler to parent
    if (onConnectionRadiusChange) {
      onConnectionRadiusChange((radius: number) => {
        model.setConnectionRadius(radius);
      });
    }

    // Expose inactive routing timeout handler to parent
    if (onInactiveRoutingTimeoutChange) {
      onInactiveRoutingTimeoutChange((timeout: number) => {
        model.setInactiveRoutingTimeout(timeout);
      });
    }

    // Expose fit to view handler to parent
    if (onFitToView) {
      onFitToView(() => {
        controller.fitToView();
      });
    }

    // Expose triage generation interval handler to parent
    if (onTriageGenerationIntervalChange) {
      onTriageGenerationIntervalChange((interval: number) => {
        model.setTriageGenerationInterval(interval);
      });
    }

    // Expose play/pause handler to parent
    if (onPlayPause) {
      onPlayPause(() => {
        const isCurrentlyGenerating = model.isAutoGenerationActive();
        if (isCurrentlyGenerating) {
          model.stopAutoGeneration();
        } else {
          model.startAutoGeneration();
        }
      });
    }

    // Expose reset handler to parent
    if (onReset) {
      onReset(() => {
        model.reset();
      });
    }

    // Subscribe to auto-generation state changes
    const updateAutoGenState = () => {
      if (onAutoGeneratingStateChange) {
        onAutoGeneratingStateChange(model.isAutoGenerationActive());
      }
    };

    // Call once to initialize
    updateAutoGenState();

    // Subscribe to model updates to catch state changes
    const autoGenUnsubscribe = model.subscribe(updateAutoGenState);

    return () => {
      unsubscribe();
      autoGenUnsubscribe();
    };
  }, [isPinned, onStatsUpdate, onConnectionRadiusChange, onInactiveRoutingTimeoutChange, onTriageGenerationIntervalChange, onPlayPause, onReset, onAutoGeneratingStateChange, onFitToView]);

  // Initialize Three.js scene
  useEffect(() => {
    if (!containerRef.current || !controllerRef.current) return;

    const container = containerRef.current;
    const controller = controllerRef.current;

    // Scene setup
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0a0a0a);
    sceneRef.current = scene;

    // Camera setup (orthographic for 2D)
    const aspect = window.innerWidth / window.innerHeight;
    const frustumSize = 10;
    const camera = new THREE.OrthographicCamera(
      -frustumSize * aspect / 2,
      frustumSize * aspect / 2,
      frustumSize / 2,
      -frustumSize / 2,
      0.1,
      1000
    );
    camera.position.z = 5;
    cameraRef.current = camera;
    controller.setCamera(camera);

    // Renderer setup
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(window.devicePixelRatio);
    container.appendChild(renderer.domElement);
    rendererRef.current = renderer;
    controller.setRenderer(renderer);

    // Add grid
    const gridHelper = new THREE.GridHelper(80, 80, 0x444444, 0x222222);
    gridHelper.rotation.x = Math.PI / 2;
    scene.add(gridHelper);

    // Initialize node renderer
    nodeRendererRef.current = new NodeRenderer(scene);

    // Initialize connection renderer
    connectionRendererRef.current = new ConnectionRenderer(scene);

    // Initialize message renderer
    messageRendererRef.current = new MessageRenderer(scene);

    // Set cursor style
    renderer.domElement.style.cursor = 'crosshair';

    // Prevent context menu
    const handleContextMenu = (e: MouseEvent) => {
      e.preventDefault();
    };

    // Event handlers using controller
    const handleMouseDown = (e: MouseEvent) => controller.handleMouseDown(e);
    const handleMouseUp = (e: MouseEvent) => controller.handleMouseUp(e);
    const handleMouseMove = (e: MouseEvent) => controller.handleMouseMove(e);
    const handleWheel = (e: WheelEvent) => controller.handleWheel(e);
    const handleMouseLeave = () => controller.handleMouseLeave();
    const handleKeyDownForController = (e: KeyboardEvent) => controller.handleKeyDown(e);
    const handleKeyUpForController = (e: KeyboardEvent) => controller.handleKeyUp(e);
    const handleTouchStart = (e: TouchEvent) => controller.handleTouchStart(e);
    const handleTouchMove = (e: TouchEvent) => controller.handleTouchMove(e);
    const handleTouchEnd = (e: TouchEvent) => controller.handleTouchEnd(e);

    // Prevent browser zoom with Ctrl+Wheel globally
    const preventBrowserZoom = (e: WheelEvent) => {
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
      }
    };

    // Add event listeners
    renderer.domElement.addEventListener('mousedown', handleMouseDown);
    renderer.domElement.addEventListener('mouseup', handleMouseUp);
    renderer.domElement.addEventListener('mousemove', handleMouseMove);
    renderer.domElement.addEventListener('wheel', handleWheel, { passive: false });
    renderer.domElement.addEventListener('mouseleave', handleMouseLeave);
    renderer.domElement.addEventListener('contextmenu', handleContextMenu);
    renderer.domElement.addEventListener('touchstart', handleTouchStart, { passive: false });
    renderer.domElement.addEventListener('touchmove', handleTouchMove, { passive: false });
    renderer.domElement.addEventListener('touchend', handleTouchEnd, { passive: false });
    renderer.domElement.addEventListener('touchcancel', handleTouchEnd, { passive: false });
    window.addEventListener('keydown', handleKeyDownForController);
    window.addEventListener('keyup', handleKeyUpForController);
    window.addEventListener('wheel', preventBrowserZoom, { passive: false });

    // Animation loop
    let lastTime = performance.now();
    const animate = () => {
      requestAnimationFrame(animate);

      // Calculate delta time
      const now = performance.now();
      const deltaTime = (now - lastTime) / 1000; // Convert to seconds
      lastTime = now;

      // Update simulation
      if (modelRef.current) {
        modelRef.current.tick(deltaTime);
      }

      // Update camera animation if active
      controller.updateAnimation();

      renderer.render(scene, camera);
    };
    animate();

    // Handle window resize
    const handleResize = () => {
      if (!cameraRef.current || !rendererRef.current || !controllerRef.current) return;

      const aspect = window.innerWidth / window.innerHeight;
      const currentFrustumSize = controllerRef.current.getFrustumSize();
      cameraRef.current.left = -currentFrustumSize * aspect / 2;
      cameraRef.current.right = currentFrustumSize * aspect / 2;
      cameraRef.current.top = currentFrustumSize / 2;
      cameraRef.current.bottom = -currentFrustumSize / 2;
      cameraRef.current.updateProjectionMatrix();

      rendererRef.current.setSize(window.innerWidth, window.innerHeight);
    };
    window.addEventListener('resize', handleResize);

    // Cleanup
    return () => {
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('keydown', handleKeyDownForController);
      window.removeEventListener('keyup', handleKeyUpForController);
      window.removeEventListener('wheel', preventBrowserZoom);
      if (renderer?.domElement) {
        renderer.domElement.removeEventListener('mousedown', handleMouseDown);
        renderer.domElement.removeEventListener('mouseup', handleMouseUp);
        renderer.domElement.removeEventListener('mousemove', handleMouseMove);
        renderer.domElement.removeEventListener('wheel', handleWheel);
        renderer.domElement.removeEventListener('mouseleave', handleMouseLeave);
        renderer.domElement.removeEventListener('contextmenu', handleContextMenu);
        renderer.domElement.removeEventListener('touchstart', handleTouchStart);
        renderer.domElement.removeEventListener('touchmove', handleTouchMove);
        renderer.domElement.removeEventListener('touchend', handleTouchEnd);
        renderer.domElement.removeEventListener('touchcancel', handleTouchEnd);
      }
      nodeRendererRef.current?.dispose();
      connectionRendererRef.current?.dispose();
      messageRendererRef.current?.dispose();
      if (container && renderer) {
        container.removeChild(renderer.domElement);
      }
      renderer?.dispose();
    };
  }, []);

  // Render nodes and connections with hover and selection state
  useEffect(() => {
    if (nodeRendererRef.current && connectionRendererRef.current && nodes) {
      const nodesWithState = nodes.map(node => ({
        ...node,
        selected: node.id === hoveredNodeId || node.id === selectedNodeId,
      }));
      nodeRendererRef.current.updateNodes(nodesWithState);
      // Pass selectedNodeId to highlight routing paths
      connectionRendererRef.current.updateConnections(nodesWithState, selectedNodeId);
    }
  }, [nodes, hoveredNodeId, selectedNodeId]);

  // Render messages
  useEffect(() => {
    if (messageRendererRef.current && nodes && messages) {
      messageRendererRef.current.updateMessages(messages, nodes);
    }
  }, [messages, nodes]);

  // Handle node deletion
  const handleDeleteNode = useCallback((nodeId: string) => {
    controllerRef.current?.deleteNode(nodeId);
    setHoveredNodeId(null);
    // If deleting the pinned node, unpin
    if (pinnedNodeId === nodeId) {
      setIsPinned(false);
      setPinnedNodeId(null);
    }
  }, [pinnedNodeId]);

  // Handle send message (with optional triage severity)
  const handleSendMessage = useCallback((nodeId: string, messageType: import('../types/Message').MessageType, triageSeverity?: import('../types/Message').TriageSeverity) => {
    modelRef.current?.sendMessage(nodeId, messageType, triageSeverity);
  }, []);

  // Handle toggle node type
  const handleToggleType = useCallback((nodeId: string) => {
    modelRef.current?.toggleNodeType(nodeId);
  }, []);

  // Handle add to detail panel (toggle: add if not present, remove if present)
  const handleAddToDetails = useCallback((nodeId: string) => {
    setDetailNodeIds(prev => {
      if (prev.includes(nodeId)) {
        // Already in the list - remove it (toggle off)
        return prev.filter(id => id !== nodeId);
      }
      // Not in the list - add it to the end (most recent will be last)
      return [...prev, nodeId];
    });
  }, []);

  // Handle remove from detail panel
  const handleRemoveFromDetails = useCallback((nodeId: string) => {
    setDetailNodeIds(prev => prev.filter(id => id !== nodeId));
  }, []);

  // Handle close detail panel
  const handleCloseDetails = useCallback(() => {
    setDetailNodeIds([]);
  }, []);

  // Handle pin toggle
  const handleTogglePin = useCallback(() => {
    if (isPinned) {
      // Unpinning
      setIsPinned(false);
      setPinnedNodeId(null);
    } else {
      // Pinning current selected node
      if (selectedNodeId) {
        setIsPinned(true);
        setPinnedNodeId(selectedNodeId);
      }
    }
  }, [isPinned, selectedNodeId]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore if typing in an input or textarea
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }

      // Don't handle if shortcuts help is open (it has its own handler)
      if (e.key === '?') {
        return;
      }

      const model = modelRef.current;
      const controller = controllerRef.current;
      if (!model || !controller) return;

      const allNodes = model.getNodes();

      switch (e.key.toLowerCase()) {
        case 'f':
          // Fit to view
          e.preventDefault();
          controller.fitToView();
          break;

        case 'tab':
          // Select next/previous node
          e.preventDefault();
          if (allNodes.length > 0) {
            const currentIndex = selectedNodeId ? allNodes.findIndex(n => n.id === selectedNodeId) : -1;
            let nextIndex;
            if (e.shiftKey) {
              // Previous node
              nextIndex = currentIndex <= 0 ? allNodes.length - 1 : currentIndex - 1;
            } else {
              // Next node
              nextIndex = currentIndex >= allNodes.length - 1 ? 0 : currentIndex + 1;
            }
            setSelectedNodeId(allNodes[nextIndex].id);
          }
          break;

        case 'escape':
          // Deselect / close panels
          e.preventDefault();
          setSelectedNodeId(null);
          setIsPinned(false);
          setPinnedNodeId(null);
          setDetailNodeIds([]);
          break;

        case 'p':
          // Pin/unpin
          e.preventDefault();
          handleTogglePin();
          break;

        case 't':
          // Send triage (or queue if disconnected) with currently selected severity
          e.preventDefault();
          if (selectedNodeId) {
            model.sendMessage(selectedNodeId, 'triage', selectedSeverity);
          }
          break;

        case '1':
          // Set severity: black
          e.preventDefault();
          setSelectedSeverity('black');
          break;
        case '2':
          // Set severity: green
          e.preventDefault();
          setSelectedSeverity('green');
          break;
        case '3':
          // Set severity: yellow
          e.preventDefault();
          setSelectedSeverity('yellow');
          break;
        case '4':
          // Set severity: red
          e.preventDefault();
          setSelectedSeverity('red');
          break;

        case 's':
          // Toggle node type
          e.preventDefault();
          if (selectedNodeId) {
            model.toggleNodeType(selectedNodeId);
          }
          break;

        case 'i':
          // Add to detail panel
          e.preventDefault();
          if (selectedNodeId) {
            handleAddToDetails(selectedNodeId);
          }
          break;

        case 'delete':
        case 'backspace':
          // Delete node
          e.preventDefault();
          if (selectedNodeId) {
            handleDeleteNode(selectedNodeId);
          }
          break;

        case 'n':
          // Create new node
          e.preventDefault();
          if (cameraRef.current) {
            // Create at center of view
            const nodeType = e.shiftKey ? 'sink' : 'source';
            model.addNode(0, 0, nodeType);
          }
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedNodeId, isPinned, selectedSeverity, handleTogglePin, handleAddToDetails, handleDeleteNode]);

  // Get the node to display in info panel
  // When pinned, always show the pinned node. Otherwise, show selected or hovered
  const displayNodeId = isPinned ? pinnedNodeId : (selectedNodeId || hoveredNodeId);
  const displayedNode = nodes?.find(n => n.id === displayNodeId) || null;
  const isInfoPanelVisible = !!(displayNodeId);

  // Get nodes for detail panel in reverse order (most recently added first)
  const detailNodes = nodes
    ?.filter(n => detailNodeIds.includes(n.id))
    .sort((a, b) => {
      // Sort by the order in detailNodeIds array, reversed
      const indexA = detailNodeIds.indexOf(a.id);
      const indexB = detailNodeIds.indexOf(b.id);
      return indexB - indexA; // Reverse order: higher index (more recent) comes first
    }) || [];

  return (
    <>
      <div ref={containerRef} className="simulation-canvas" />
      <NodeInfoPanel
        node={displayedNode}
        isVisible={isInfoPanelVisible}
        isPinned={isPinned}
        isInDetailPanel={displayedNode ? detailNodeIds.includes(displayedNode.id) : false}
        triageSeverity={selectedSeverity}
        onTriageSeverityChange={setSelectedSeverity}
        onDeleteNode={handleDeleteNode}
        onTogglePin={handleTogglePin}
        onSendMessage={handleSendMessage}
        onToggleType={handleToggleType}
        onAddToDetails={handleAddToDetails}
      />
      {detailNodes.length > 0 && (
        <NodeDetailPanel
          nodes={detailNodes}
          onRemoveNode={handleRemoveFromDetails}
          onClose={handleCloseDetails}
        />
      )}
      <KeyboardShortcuts />
    </>
  );
};

export default SimulationView;
