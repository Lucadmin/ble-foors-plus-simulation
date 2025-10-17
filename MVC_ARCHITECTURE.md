# MVC Architecture for FOORS+ Simulation

## Overview

The simulation has been refactored to follow the **Model-View-Controller (MVC)** pattern, separating concerns and making it easy to implement and test simulation algorithms without touching UI code.

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                         View                             │
│              (SimulationView.tsx)                        │
│  - Three.js rendering                                    │
│  - UI components (NodeInfoPanel)                         │
│  - React state management                                │
└─────────────────┬──────────────────┬────────────────────┘
                  │                  │
                  │ subscribes       │ calls methods
                  │                  │
        ┌─────────▼─────────┐ ┌─────▼──────────────────┐
        │      Model        │ │     Controller         │
        │ SimulationModel   │ │ SimulationController   │
        │                   │ │                        │
        │ - Node data       │ │ - User interactions    │
        │ - Simulation      │ │ - Mouse/keyboard       │
        │   logic           │ │ - Camera controls      │
        │ - Algorithm       │ │ - Updates model        │
        └───────────────────┘ └────────────────────────┘
```

## Components

### 📊 Model (`src/models/SimulationModel.ts`)

**Responsibility**: Manages all simulation data and business logic.

**Key Features**:

- Stores and manages node data
- Implements simulation algorithm logic
- Provides observer pattern for state changes
- No UI dependencies

**Public API**:

```typescript
// Data access
getNodes(): Node[]
getNode(id: string): Node | undefined

// Mutations
addNode(x: number, y: number): Node
removeNode(id: string): void
updateNodePosition(id: string, x: number, y: number): void
updateNodeVelocity(id: string, vx: number, vy: number): void
clearNodes(): void

// Simulation
tick(deltaTime: number): void  // ← Implement your algorithm here!

// Observability
subscribe(listener: () => void): () => void

// Stats
getStats(): { nodeCount: number, totalVelocity: number }
```

**Where to implement your algorithm**:

- The `tick()` method is called every frame
- Update node positions, velocities, or any other properties
- The view will automatically re-render when you notify listeners

### 🎮 Controller (`src/controllers/SimulationController.ts`)

**Responsibility**: Handles all user interactions and updates the model.

**Key Features**:

- Mouse event handling (click, drag, zoom, pan)
- Screen-to-world coordinate conversion
- Node selection and hover detection
- Camera manipulation
- Updates model based on user actions

**Public API**:

```typescript
// Setup
setCamera(camera: THREE.OrthographicCamera): void
setRenderer(renderer: THREE.WebGLRenderer): void
setOnHoveredNodeChange(callback: (nodeId: string | null) => void): void
setOnSelectedNodeChange(callback: (nodeId: string | null) => void): void

// Event handlers (called by view)
handleMouseDown(event: MouseEvent): void
handleMouseMove(event: MouseEvent): void
handleMouseUp(event: MouseEvent): void
handleWheel(event: WheelEvent): void
handleMouseLeave(): void

// Actions
deleteNode(nodeId: string): void

// State access
getFrustumSize(): number
```

### 🖼️ View (`src/components/SimulationView.tsx`)

**Responsibility**: Renders the simulation using Three.js and React.

**Key Features**:

- Three.js scene setup
- Rendering loop
- React component lifecycle
- Subscribes to model changes
- Delegates interactions to controller
- Displays UI components (NodeInfoPanel)

**Dependencies**:

- Creates instances of Model and Controller
- Subscribes to model updates
- Passes events to controller
- Renders nodes using NodeRenderer

## How to Implement Your Algorithm

1. **Open `src/models/SimulationModel.ts`**

2. **Find the `tick()` method**:

```typescript
tick(deltaTime: number): void {
  // TODO: Implement simulation algorithm here
  
  // Example: Simple physics
  this.nodes.forEach(node => {
    node.position.x += node.velocity.x * deltaTime;
    node.position.y += node.velocity.y * deltaTime;
  });

  this.notifyListeners();
}
```

3. **Implement your algorithm**:

```typescript
tick(deltaTime: number): void {
  // Example: Force-based layout algorithm
  const nodes = this.nodes;
  
  // Calculate repulsion forces between nodes
  for (let i = 0; i < nodes.length; i++) {
    for (let j = i + 1; j < nodes.length; j++) {
      const dx = nodes[j].position.x - nodes[i].position.x;
      const dy = nodes[j].position.y - nodes[i].position.y;
      const distance = Math.sqrt(dx * dx + dy * dy);
      
      if (distance > 0) {
        const force = -0.5 / (distance * distance);
        const fx = (dx / distance) * force;
        const fy = (dy / distance) * force;
        
        nodes[i].velocity.x += fx;
        nodes[i].velocity.y += fy;
        nodes[j].velocity.x -= fx;
        nodes[j].velocity.y -= fy;
      }
    }
  }
  
  // Apply velocities and damping
  nodes.forEach(node => {
    node.position.x += node.velocity.x * deltaTime;
    node.position.y += node.velocity.y * deltaTime;
    node.velocity.x *= 0.95; // Damping
    node.velocity.y *= 0.95;
  });

  this.notifyListeners();
}
```

4. **Enable simulation loop in the view** (optional - for continuous simulation):

```typescript
// In SimulationView.tsx, add this inside a useEffect:
useEffect(() => {
  if (!modelRef.current) return;
  
  let lastTime = Date.now();
  let animationFrameId: number;
  
  const simulate = () => {
    const currentTime = Date.now();
    const deltaTime = (currentTime - lastTime) / 1000; // Convert to seconds
    lastTime = currentTime;
    
    modelRef.current?.tick(deltaTime);
    animationFrameId = requestAnimationFrame(simulate);
  };
  
  // Start simulation
  simulate();
  
  return () => cancelAnimationFrame(animationFrameId);
}, []);
```

## Benefits of MVC Architecture

✅ **Separation of Concerns**: UI code is separate from logic  
✅ **Testability**: You can unit test the model without Three.js or React  
✅ **Maintainability**: Changes to algorithm don't affect rendering  
✅ **Reusability**: Model can be used in different views or contexts  
✅ **Clarity**: Each component has a single, well-defined responsibility  

## File Structure

```
src/
├── models/
│   └── SimulationModel.ts          ← Algorithm logic goes here
├── controllers/
│   └── SimulationController.ts     ← User interaction handling
├── components/
│   ├── SimulationView.tsx          ← Three.js rendering
│   ├── NodeInfoPanel.tsx           ← UI components
│   └── Sidebar.tsx
├── utils/
│   ├── NodeRenderer.ts             ← Node visualization
│   └── nodeUtils.ts                ← Helper functions
└── types/
    └── Node.ts                     ← Data structures
```

## Architectural Decisions & Trade-offs

### Cursor Style Manipulation in Controller

**Decision**: The `SimulationController` directly manipulates the canvas cursor style (`renderer.domElement.style.cursor`).

**Rationale**:

- **Tight Coupling**: Cursor feedback is tightly coupled to input state (panning, dragging, space key, hover)
- **Performance**: Cursor updates occur on every mousemove event; callback overhead is unnecessary
- **Pragmatism**: Cursor is an extension of input handling, not part of scene rendering
- **Complexity**: Pure MVC would require ~50 lines of callback boilerplate for marginal benefit

**Status**: Acceptable pragmatic trade-off. The violation is limited, isolated, and well-documented in the controller file.

### Keyboard Shortcuts in View

**Decision**: Keyboard shortcuts are handled in `SimulationView.tsx` as a large `useEffect` hook (~100 lines).

**Rationale**:

- Shortcuts directly call model methods (good separation)
- View layer is appropriate for UI event handling
- Consider extracting to custom hook (`useKeyboardShortcuts`) for better organization

**Status**: Acceptable. Extraction to custom hook recommended for improved maintainability.

## Next Steps

1. Implement your algorithm in `SimulationModel.tick()`
2. Add any additional methods to the model as needed
3. Test your algorithm independently of the UI
4. Add simulation controls (play/pause/speed) via the controller
5. Extend the model with more features (connections, algorithms, etc.)
