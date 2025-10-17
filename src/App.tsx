import { useState, useCallback } from 'react';
import SimulationView from './components/SimulationView';
import Sidebar from './components/Sidebar';

function App() {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [stats, setStats] = useState({
    nodeCount: 0,
    connectionCount: 0,
    connectionRadius: 2.0,
    inactiveRoutingTimeout: 5 * 60 * 1000, // 5 minutes default
    triageGenerationInterval: 3000, // 3 seconds default
  });
  const [isAutoGenerating, setIsAutoGenerating] = useState(false);
  const [setConnectionRadiusHandler, setSetConnectionRadiusHandler] = useState<((radius: number) => void) | null>(null);
  const [setInactiveRoutingTimeoutHandler, setSetInactiveRoutingTimeoutHandler] = useState<((timeout: number) => void) | null>(null);
  const [setTriageGenerationIntervalHandler, setSetTriageGenerationIntervalHandler] = useState<((interval: number) => void) | null>(null);
  const [playPauseHandler, setPlayPauseHandler] = useState<(() => void) | null>(null);
  const [resetHandler, setResetHandler] = useState<(() => void) | null>(null);
  const [fitToViewHandler, setFitToViewHandler] = useState<(() => void) | null>(null);

  const handleStatsUpdate = useCallback((newStats: { nodeCount: number; connectionCount: number; connectionRadius: number }) => {
    setStats(prev => ({
      ...prev,
      ...newStats,
    }));
  }, []);

  const handleConnectionRadiusChange = useCallback((radius: number) => {
    if (setConnectionRadiusHandler) {
      setConnectionRadiusHandler(radius);
    }
  }, [setConnectionRadiusHandler]);

  const handleSetConnectionRadiusHandler = useCallback((handler: (radius: number) => void) => {
    setSetConnectionRadiusHandler(() => handler);
  }, []);

  const handleFitToView = useCallback(() => {
    if (fitToViewHandler) {
      fitToViewHandler();
    }
  }, [fitToViewHandler]);

  const handleSetFitToViewHandler = useCallback((handler: () => void) => {
    setFitToViewHandler(() => handler);
  }, []);

  const handleInactiveRoutingTimeoutChange = useCallback((timeout: number) => {
    if (setInactiveRoutingTimeoutHandler) {
      setInactiveRoutingTimeoutHandler(timeout);
    }
    setStats(prev => ({ ...prev, inactiveRoutingTimeout: timeout }));
  }, [setInactiveRoutingTimeoutHandler]);

  const handleSetInactiveRoutingTimeoutHandler = useCallback((handler: (timeout: number) => void) => {
    setSetInactiveRoutingTimeoutHandler(() => handler);
  }, []);

  const handleTriageGenerationIntervalChange = useCallback((interval: number) => {
    if (setTriageGenerationIntervalHandler) {
      setTriageGenerationIntervalHandler(interval);
    }
    setStats(prev => ({ ...prev, triageGenerationInterval: interval }));
  }, [setTriageGenerationIntervalHandler]);

  const handleSetTriageGenerationIntervalHandler = useCallback((handler: (interval: number) => void) => {
    setSetTriageGenerationIntervalHandler(() => handler);
  }, []);

  const handlePlayPause = useCallback(() => {
    if (playPauseHandler) {
      playPauseHandler();
    }
  }, [playPauseHandler]);

  const handleSetPlayPauseHandler = useCallback((handler: () => void) => {
    setPlayPauseHandler(() => handler);
  }, []);

  const handleReset = useCallback(() => {
    if (resetHandler) {
      resetHandler();
    }
  }, [resetHandler]);

  const handleSetResetHandler = useCallback((handler: () => void) => {
    setResetHandler(() => handler);
  }, []);

  const handleAutoGeneratingStateChange = useCallback((isGenerating: boolean) => {
    setIsAutoGenerating(isGenerating);
  }, []);

  return (
    <div className="app-container">
      <SimulationView
        onStatsUpdate={handleStatsUpdate}
        onConnectionRadiusChange={handleSetConnectionRadiusHandler}
        onInactiveRoutingTimeoutChange={handleSetInactiveRoutingTimeoutHandler}
        onTriageGenerationIntervalChange={handleSetTriageGenerationIntervalHandler}
        onPlayPause={handleSetPlayPauseHandler}
        onReset={handleSetResetHandler}
        onAutoGeneratingStateChange={handleAutoGeneratingStateChange}
        onFitToView={handleSetFitToViewHandler}
      />
      <Sidebar
        isOpen={isSidebarOpen}
        setIsOpen={setIsSidebarOpen}
        connectionRadius={stats.connectionRadius}
        inactiveRoutingTimeout={stats.inactiveRoutingTimeout}
        triageGenerationInterval={stats.triageGenerationInterval}
        isAutoGenerating={isAutoGenerating}
        nodeCount={stats.nodeCount}
        connectionCount={stats.connectionCount}
        onConnectionRadiusChange={handleConnectionRadiusChange}
        onInactiveRoutingTimeoutChange={handleInactiveRoutingTimeoutChange}
        onTriageGenerationIntervalChange={handleTriageGenerationIntervalChange}
        onPlayPause={handlePlayPause}
        onReset={handleReset}
        onFitToView={handleFitToView}
      />
    </div>
  );
}

export default App;
