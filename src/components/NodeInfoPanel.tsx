import { useEffect, useState } from 'react';
import { HiTrash } from 'react-icons/hi';
import { MdPushPin, MdOutlinePushPin, MdSwapVert, MdWarning, MdViewSidebar } from 'react-icons/md';
import type { Node } from '../types/Node';
import type { MessageType, TriageSeverity } from '../types/Message';
import './NodeInfoPanel.css';

interface NodeInfoPanelProps {
  node: Node | null;
  isVisible: boolean;
  isPinned: boolean;
  isInDetailPanel?: boolean;
  triageSeverity?: TriageSeverity;
  onTriageSeverityChange?: (severity: TriageSeverity) => void;
  onDeleteNode?: (nodeId: string) => void;
  onTogglePin?: () => void;
  onSendMessage?: (nodeId: string, messageType: MessageType, triageSeverity?: TriageSeverity) => void;
  onToggleType?: (nodeId: string) => void;
  onAddToDetails?: (nodeId: string) => void;
}

const NodeInfoPanel = ({ node, isVisible, isPinned, isInDetailPanel, triageSeverity = 'red', onTriageSeverityChange, onDeleteNode, onTogglePin, onSendMessage, onToggleType, onAddToDetails }: NodeInfoPanelProps) => {
  const [shouldRender, setShouldRender] = useState(false);
  const [isAnimatingIn, setIsAnimatingIn] = useState(false);

  useEffect(() => {
    if (isVisible && node) {
      // Mount the element first
      setShouldRender(true);
      // Trigger animation on next frame
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          setIsAnimatingIn(true);
        });
      });
    } else {
      // Start exit animation
      setIsAnimatingIn(false);
      // Delay unmounting to allow exit animation
      const timer = setTimeout(() => {
        setShouldRender(false);
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [isVisible, node]);

  const handleDelete = () => {
    if (node && onDeleteNode) {
      onDeleteNode(node.id);
    }
  };

  const handleTogglePin = () => {
    if (onTogglePin) {
      onTogglePin();
    }
  };

  if (!shouldRender || !node) return null;

  return (
    <div className={`node-info-container ${isAnimatingIn ? 'visible' : ''} ${isPinned ? 'pinned' : ''}`}>
      <div className="node-info-panel">
        <div className="node-info-header">
          <div className="node-info-title-section">
            <h3>Node Information</h3>
            <button
              className={`node-pin-btn ${isPinned ? 'pinned' : ''}`}
              onClick={handleTogglePin}
              title={isPinned ? "Unpin (P) - allow switching nodes" : "Pin (P) - keep this node's info"}
            >
              {isPinned ? <MdPushPin /> : <MdOutlinePushPin />}
              <span className="keyboard-hint">P</span>
            </button>
          </div>
          <div className="node-info-id">{node.id.substring(0, 8)}</div>
        </div>
        <div className="node-info-content">
          {/* Compact stats grid */}
          <div className="node-info-grid">
            <div className="node-info-stat">
              <span className="stat-label">Type</span>
              <span className="stat-value" style={{
                color: node.type === 'sink' ? '#6366F1' : '#10B981'
              }}>
                {node.type === 'sink' ? '🎯 Sink' : '📡 Source'}
              </span>
            </div>
            <div className="node-info-stat">
              <span className="stat-label">Connections</span>
              <span className="stat-value">{node.connections.size}</span>
            </div>
            <div className="node-info-stat">
              <span className="stat-label">Triages</span>
              <span className="stat-value">{node.triageStore.size}</span>
            </div>
            {node.triageQueue.length > 0 && (
              <div className="node-info-stat queued">
                <span className="stat-label">Queued</span>
                <span className="stat-value" style={{ color: '#F59E0B' }}>
                  🔔 {node.triageQueue.length}
                </span>
              </div>
            )}
          </div>

          {/* FOORS+ Routing Status Badge */}
          <div className="routing-status-badge" data-mode={node.routingState.mode}>
            <div className="routing-badge-header">
              <span className="routing-badge-icon">
                {node.routingState.mode === 'intelligent' && '✓'}
                {node.routingState.mode === 'flooding' && '⚠️'}
                {node.routingState.mode === 'inactive' && '⏸'}
                {node.routingState.mode === 'no-connections' && '⊘'}
              </span>
              <span className="routing-badge-mode">
                {node.routingState.mode === 'intelligent' && 'Intelligent Routing'}
                {node.routingState.mode === 'flooding' && 'Flooding Mode'}
                {node.routingState.mode === 'inactive' && 'Inactive Routes'}
                {node.routingState.mode === 'no-connections' && 'Isolated'}
              </span>
            </div>

            {/* Compact route info */}
            {(node.routingState.activeRoutes > 0 || node.routingState.expiredRoutes > 0 || node.routingState.inactiveRoutes > 0) && (
              <div className="routing-badge-stats">
                {node.routingState.activeRoutes > 0 && (
                  <span className="route-stat active">{node.routingState.activeRoutes} active</span>
                )}
                {node.routingState.expiredRoutes > 0 && (
                  <span className="route-stat expired">{node.routingState.expiredRoutes} expired</span>
                )}
                {node.routingState.inactiveRoutes > 0 && (
                  <span className="route-stat inactive">{node.routingState.inactiveRoutes} inactive</span>
                )}
              </div>
            )}

            {/* Reason shown as small text */}
            {node.routingState.floodingReason && (
              <div className="routing-badge-reason">
                {node.routingState.floodingReason === 'no-routes' && 'No routes to sinks'}
                {node.routingState.floodingReason === 'routes-expired' && 'All routes expired'}
                {node.routingState.floodingReason === 'no-connections' && 'No peer connections'}
                {node.routingState.floodingReason === 'has-inactive-routes' && 'Flooding for disconnected sinks'}
              </div>
            )}
          </div>
        </div>
      </div>
      <div className="node-info-actions">
        <button
          className={`node-action-btn ${isInDetailPanel ? 'active' : ''}`}
          onClick={() => onAddToDetails?.(node.id)}
          title={isInDetailPanel ? "Remove from Detail Panel (I)" : "Add to Detail Panel (I)"}
        >
          <MdViewSidebar />
          <span className="keyboard-hint">I</span>
        </button>
        <div className="triage-controls">
          <div className="severity-selector" title="Select triage severity">
            {(['black', 'green', 'yellow', 'red'] as TriageSeverity[]).map(s => (
              <button
                key={s}
                className={`severity-chip ${s} ${triageSeverity === s ? 'selected' : ''}`}
                onClick={() => onTriageSeverityChange?.(s)}
                aria-label={`Set severity ${s}`}
              />
            ))}
          </div>
          <button
            className="node-action-btn triage-btn"
            title={node.connections.size === 0 ? "Queue Triage (T) - Will send when reconnected" : "Send Triage Message (T)"}
            onClick={() => onSendMessage?.(node.id, 'triage', triageSeverity)}
          >
            <MdWarning />
            <span className="keyboard-hint">T</span>
          </button>
        </div>
        <button
          className="node-action-btn"
          title={`Toggle Type (S) - Current: ${node.type === 'sink' ? 'Sink' : 'Source'}`}
          onClick={() => onToggleType?.(node.id)}
        >
          <MdSwapVert />
          <span className="keyboard-hint">S</span>
        </button>
        <button
          className="node-action-btn delete-btn"
          onClick={handleDelete}
          title="Delete Node (Del)"
        >
          <HiTrash />
          <span className="keyboard-hint">Del</span>
        </button>
      </div>
    </div>
  );
};

export default NodeInfoPanel;
