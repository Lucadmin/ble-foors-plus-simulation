import { useState } from 'react';
import { HiMenu, HiX, HiOutlinePlay, HiOutlinePause } from 'react-icons/hi';
import { MdRestartAlt, MdCenterFocusStrong } from 'react-icons/md';
import './Sidebar.css';

interface SidebarProps {
  isOpen: boolean;
  setIsOpen: (isOpen: boolean) => void;
  connectionRadius?: number;
  onConnectionRadiusChange?: (radius: number) => void;
  inactiveRoutingTimeout?: number;
  onInactiveRoutingTimeoutChange?: (timeout: number) => void;
  triageGenerationInterval?: number;
  onTriageGenerationIntervalChange?: (interval: number) => void;
  isAutoGenerating?: boolean;
  onPlayPause?: () => void;
  onReset?: () => void;
  nodeCount?: number;
  connectionCount?: number;
  sinkCount?: number;
  sourceCount?: number;
  routingModes?: { intelligent: number; flooding: number; inactive: number; noConnections: number };
  queuedTriages?: number;
  messagesInFlight?: number;
  triagesSeenAtSinks?: number;
  onFitToView?: () => void;
}

const Sidebar = ({
  isOpen,
  setIsOpen,
  connectionRadius = 2.0,
  onConnectionRadiusChange,
  inactiveRoutingTimeout = 1 * 1000, // Default 1 second
  onInactiveRoutingTimeoutChange,
  triageGenerationInterval = 3000, // Default 3 seconds
  onTriageGenerationIntervalChange,
  isAutoGenerating = false,
  onPlayPause,
  onReset,
  nodeCount = 0,
  connectionCount = 0,
  sinkCount = 0,
  sourceCount = 0,
  routingModes = { intelligent: 0, flooding: 0, inactive: 0, noConnections: 0 },
  queuedTriages = 0,
  messagesInFlight = 0,
  triagesSeenAtSinks = 0,
  onFitToView,
}: SidebarProps) => {
  const [activeTab, setActiveTab] = useState<'controls' | 'info'>('controls');

  const handlePlayPause = () => {
    onPlayPause?.();
  };

  const handleReset = () => {
    onReset?.();
  };

  const handleFitToView = () => {
    onFitToView?.();
  };

  const handleConnectionRadiusChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseFloat(e.target.value);
    onConnectionRadiusChange?.(value);
  };

  const handleInactiveTimeoutChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const valueSeconds = parseFloat(e.target.value); // Slider is in seconds
    const clamped = Math.max(1, Math.min(5 * 60, valueSeconds));
    const valueMs = clamped * 1000; // Convert seconds to milliseconds
    onInactiveRoutingTimeoutChange?.(valueMs);
  };

  const handleTriageIntervalChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseFloat(e.target.value) * 1000; // Convert seconds to milliseconds
    onTriageGenerationIntervalChange?.(value);
  };

  // Convert milliseconds to seconds/minutes for display
  const inactiveTimeoutSeconds = inactiveRoutingTimeout / 1000;
  const inactiveTimeoutMinutes = inactiveTimeoutSeconds / 60;
  const triageIntervalSeconds = triageGenerationInterval / 1000;

  return (
    <>
      {/* Toggle button */}
      <button
        className="sidebar-toggle"
        onClick={() => setIsOpen(!isOpen)}
        aria-label="Toggle sidebar"
      >
        {isOpen ? <HiX size={24} /> : <HiMenu size={24} />}
      </button>

      {/* Bottom control buttons */}
      <div className="bottom-controls">
        <button
          className="bottom-control-button"
          onClick={handlePlayPause}
          aria-label={isAutoGenerating ? 'Pause auto-generation' : 'Start auto-generation'}
          title={isAutoGenerating ? 'Pause' : 'Play'}
        >
          {isAutoGenerating ? <HiOutlinePause size={24} /> : <HiOutlinePlay size={24} />}
        </button>
        <button
          className="bottom-control-button"
          onClick={handleReset}
          aria-label="Reset simulation"
          title="Reset"
        >
          <MdRestartAlt size={24} />
        </button>
        <button
          className="bottom-control-button"
          onClick={handleFitToView}
          aria-label="Fit to view"
          title="Fit to View"
        >
          <MdCenterFocusStrong size={24} />
        </button>
      </div>

      {/* Sidebar */}
      <div className={`sidebar ${isOpen ? 'open' : ''}`}>
        <div className="sidebar-header">
          <h2>FOORS+ Simulation</h2>
        </div>

        <div className="sidebar-tabs">
          <button
            className={`tab ${activeTab === 'controls' ? 'active' : ''}`}
            onClick={() => setActiveTab('controls')}
          >
            Controls
          </button>
          <button
            className={`tab ${activeTab === 'info' ? 'active' : ''}`}
            onClick={() => setActiveTab('info')}
          >
            Info
          </button>
        </div>

        <div className="sidebar-content">
          {activeTab === 'controls' && (
            <div className="controls-panel">
              <h3>Simulation Controls</h3>

              <div className="control-group">
                <label>Connection Range: {connectionRadius.toFixed(1)}</label>
                <input
                  type="range"
                  value={connectionRadius}
                  onChange={handleConnectionRadiusChange}
                  min={0.5}
                  max={10}
                  step={0.1}
                />
              </div>

              <div className="control-group">
                <label>
                  Inactive Route Timeout: {inactiveTimeoutSeconds.toFixed(0)} sec
                  {' '}
                  ({inactiveTimeoutMinutes.toFixed(1)} min)
                </label>
                <input
                  type="range"
                  value={inactiveTimeoutSeconds}
                  onChange={handleInactiveTimeoutChange}
                  min={1}
                  max={5 * 60}
                  step={1}
                />
                <small className="control-hint">
                  Duration before inactive routing tables are deleted (1s–5min)
                </small>
              </div>

              <div className="control-group">
                <label>Auto-Generation Interval: {triageIntervalSeconds.toFixed(1)} sec</label>
                <input
                  type="range"
                  value={triageIntervalSeconds}
                  onChange={handleTriageIntervalChange}
                  min={0.5}
                  max={10}
                  step={0.5}
                />
                <small className="control-hint">
                  Frequency of automatic triage generation when playing
                </small>
              </div>
            </div>
          )}

          {activeTab === 'info' && (
            <div className="info-panel">
              <h3>Simulation Info</h3>
              <div className="info-item">
                <span className="info-label">Active Nodes:</span>
                <span className="info-value">{nodeCount}</span>
              </div>
              <div className="info-item">
                <span className="info-label">Connections:</span>
                <span className="info-value">{connectionCount}</span>
              </div>
              <div className="info-item">
                <span className="info-label">Sources / Sinks:</span>
                <span className="info-value">{sourceCount} / {sinkCount}</span>
              </div>
              <div className="info-item">
                <span className="info-label">Routing Modes (I/F/In/NC):</span>
                <span className="info-value">
                  {routingModes.intelligent}/{routingModes.flooding}/{routingModes.inactive}/{routingModes.noConnections}
                </span>
              </div>
              <div className="info-item">
                <span className="info-label">Queued Triages:</span>
                <span className="info-value">{queuedTriages}</span>
              </div>
              <div className="info-item">
                <span className="info-label">Messages In Flight:</span>
                <span className="info-value">{messagesInFlight}</span>
              </div>
              <div className="info-item">
                <span className="info-label">Triages Seen At Sinks:</span>
                <span className="info-value">{triagesSeenAtSinks}</span>
              </div>
              <div className="info-item">
                <span className="info-label">FPS:</span>
                <span className="info-value">60</span>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
};

export default Sidebar;
