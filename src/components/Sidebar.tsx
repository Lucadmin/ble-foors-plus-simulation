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
  onFitToView?: () => void;
}

const Sidebar = ({
  isOpen,
  setIsOpen,
  connectionRadius = 2.0,
  onConnectionRadiusChange,
  inactiveRoutingTimeout = 5 * 60 * 1000, // Default 5 minutes
  onInactiveRoutingTimeoutChange,
  triageGenerationInterval = 3000, // Default 3 seconds
  onTriageGenerationIntervalChange,
  isAutoGenerating = false,
  onPlayPause,
  onReset,
  nodeCount = 0,
  connectionCount = 0,
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
    const value = parseFloat(e.target.value) * 60 * 1000; // Convert minutes to milliseconds
    onInactiveRoutingTimeoutChange?.(value);
  };

  const handleTriageIntervalChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseFloat(e.target.value) * 1000; // Convert seconds to milliseconds
    onTriageGenerationIntervalChange?.(value);
  };

  // Convert milliseconds to minutes/seconds for display
  const inactiveTimeoutMinutes = inactiveRoutingTimeout / (60 * 1000);
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
                <label>Number of Nodes</label>
                <input type="number" defaultValue={10} min={1} max={100} />
              </div>

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
                <label>Inactive Route Timeout: {inactiveTimeoutMinutes.toFixed(1)} min</label>
                <input
                  type="range"
                  value={inactiveTimeoutMinutes}
                  onChange={handleInactiveTimeoutChange}
                  min={0.5}
                  max={30}
                  step={0.5}
                />
                <small className="control-hint">
                  Duration before inactive routing tables are deleted
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
