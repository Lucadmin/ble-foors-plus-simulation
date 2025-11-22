import { HiX } from 'react-icons/hi';
import type { Node } from '../types/Node';
import './NodeDetailPanel.css';

interface NodeDetailPanelProps {
  nodes: Node[];
  onRemoveNode: (nodeId: string) => void;
  onClose: () => void;
}

const NodeDetailPanel = ({ nodes, onRemoveNode, onClose }: NodeDetailPanelProps) => {
  if (nodes.length === 0) return null;

  return (
    <div className="node-detail-panel">
      <div className="node-detail-header">
        <h2>Node Details</h2>
        <button className="close-btn" onClick={onClose} title="Close Panel">
          <HiX />
        </button>
      </div>

      <div className="node-detail-content">
        {nodes.map((node) => (
          <div key={node.id} className="node-detail-card">
            <div className="node-detail-card-header">
              <div className="node-detail-title">
                <div
                  className="node-color-indicator"
                  style={{ backgroundColor: node.color }}
                />
                <span className="node-detail-id">{node.id.substring(0, 8)}</span>
              </div>
              <button
                className="remove-from-panel-btn"
                onClick={() => onRemoveNode(node.id)}
                title="Remove from panel"
              >
                <HiX />
              </button>
            </div>

            <div className="node-detail-section">
              <h3>General</h3>
              <div className="detail-row">
                <span className="detail-label">Type:</span>
                <span
                  className="detail-value"
                  style={{
                    fontWeight: 'bold',
                    color: node.type === 'sink' ? '#6366F1' : '#10B981',
                  }}
                >
                  {node.type === 'sink' ? '🎯 Sink (Dashboard)' : '📡 Source (Triage)'}
                </span>
              </div>
              <div className="detail-row">
                <span className="detail-label">Connections:</span>
                <span className="detail-value">{node.connections.size}</span>
              </div>
              <div className="detail-row">
                <span className="detail-label">Triages Seen:</span>
                <span className="detail-value">{node.triageStore.size}</span>
              </div>
              {node.triageQueue.length > 0 && (
                <div className="detail-row">
                  <span className="detail-label">Queued Triages:</span>
                  <span className="detail-value" style={{ color: '#F59E0B', fontWeight: 'bold' }}>
                    {node.triageQueue.length} waiting
                  </span>
                </div>
              )}
            </div>

            {node.triageQueue.length > 0 && (
              <div className="node-detail-section">
                <h3>Triage Queue</h3>
                <p className="section-description">
                  Triages waiting to be sent when node reconnects
                </p>
                <div className="triage-queue-list">
                  {node.triageQueue.map((queuedTriage, index) => {
                    const now = Date.now();
                    const queuedSeconds = Math.floor((now - queuedTriage.queuedAt) / 1000);

                    return (
                      <div key={`${queuedTriage.triageId}-${index}`} className="queued-triage-item">
                        <span className="queued-triage-id">
                          🔔 {queuedTriage.triageId.substring(0, 8)}
                        </span>
                        <span className="queued-triage-severity" data-severity={queuedTriage.severity}>
                          {queuedTriage.severity.toUpperCase()}
                        </span>
                        <span className="queued-triage-time">
                          {queuedSeconds}s ago
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            <div className="node-detail-section">
              <h3>Active Routing Tables</h3>
              {node.routingTable.size > 0 ? (
                <div className="routing-table">
                  {Array.from(node.routingTable.entries()).map(([sinkId, entry]) => {
                    const now = Date.now();
                    const ageSeconds = Math.floor((now - entry.lastUpdate) / 1000);
                    const isStale = ageSeconds > 600; // 10 minutes

                    return (
                      <div key={sinkId} className="routing-entry">
                        <div className="routing-sink-header">
                          <span className="routing-sink-id">
                            🎯 Sink: {sinkId.substring(0, 8)}
                          </span>
                          <span
                            className="routing-status"
                            style={{ color: isStale ? '#EF4444' : '#10B981' }}
                          >
                            {isStale ? '⚠️ Stale' : '✓ Active'}
                          </span>
                        </div>
                        <div className="routing-next-hops">
                          <span className="detail-label">Next Hops:</span>
                          {Array.from(entry.nextHops.entries()).map(([peerId, hopCount]) => (
                            <div key={peerId} className="next-hop-item">
                              <span className="next-hop-peer">{peerId.substring(0, 8)}</span>
                              <span className="next-hop-count">
                                {hopCount} hop{hopCount !== 1 ? 's' : ''}
                              </span>
                            </div>
                          ))}
                        </div>
                        <div className="routing-metadata">
                          <span className="routing-age">
                            Updated {ageSeconds}s ago
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="detail-placeholder">
                  <span>No active routes</span>
                </div>
              )}
            </div>

            {node.inactiveRoutingTables.size > 0 && (
              <div className="node-detail-section">
                <h3>Inactive Routing Tables</h3>
                <div className="routing-table inactive">
                  {Array.from(node.inactiveRoutingTables.entries()).map(([sinkId, inactiveEntry]) => {
                    const now = Date.now();
                    const inactiveSeconds = Math.floor((now - inactiveEntry.inactiveSince) / 1000);
                    const lastActiveSeconds = Math.floor((now - inactiveEntry.lastActiveEntry.lastUpdate) / 1000);

                    return (
                      <div key={sinkId} className="routing-entry inactive">
                        <div className="routing-sink-header">
                          <span className="routing-sink-id">
                            ⏸ Sink: {sinkId.substring(0, 8)}
                          </span>
                          <span className="routing-status" style={{ color: '#A855F7' }}>
                            ⏸ Inactive
                          </span>
                        </div>
                        <div className="routing-next-hops">
                          <span className="detail-label">Last Next Hops:</span>
                          {Array.from(inactiveEntry.lastActiveEntry.nextHops.entries()).map(([peerId, hopCount]) => (
                            <div key={peerId} className="next-hop-item inactive">
                              <span className="next-hop-peer">{peerId.substring(0, 8)}</span>
                              <span className="next-hop-count">
                                {hopCount} hop{hopCount !== 1 ? 's' : ''}
                              </span>
                            </div>
                          ))}
                        </div>
                        <div className="routing-metadata">
                          <span className="routing-age">
                            Inactive for {inactiveSeconds}s
                          </span>
                          <span className="routing-age">
                            Last active {lastActiveSeconds}s ago
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            <div className="node-detail-section">
              <h3>Connected Nodes</h3>
              {node.connections.size > 0 ? (
                <div className="connection-list">
                  {Array.from(node.connections).map((connId) => (
                    <div key={connId} className="connection-item">
                      {connId.substring(0, 8)}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="detail-placeholder">
                  <span>No connections</span>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {nodes.length > 1 && (
        <div className="comparison-hint">
          Comparing {nodes.length} nodes
        </div>
      )}
    </div>
  );
};

export default NodeDetailPanel;
