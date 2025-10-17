import { useEffect, useState } from 'react';
import { HiQuestionMarkCircle } from 'react-icons/hi';
import './KeyboardShortcuts.css';

interface Shortcut {
  keys: string[];
  description: string;
  category: string;
}

const shortcuts: Shortcut[] = [
  // View Controls
  { keys: ['F'], description: 'Fit all nodes to view', category: 'View' },
  { keys: ['Space', 'Drag'], description: 'Pan the view', category: 'View' },
  { keys: ['Middle Mouse', 'Drag'], description: 'Pan the view', category: 'View' },
  { keys: ['Mouse Wheel'], description: 'Zoom in/out', category: 'View' },
  { keys: ['Two Finger Drag'], description: 'Pan on touchpad', category: 'View' },
  { keys: ['Pinch'], description: 'Zoom on touchpad', category: 'View' },

  // Node Selection
  { keys: ['Tab'], description: 'Select next node', category: 'Selection' },
  { keys: ['Shift', 'Tab'], description: 'Select previous node', category: 'Selection' },
  { keys: ['Escape'], description: 'Deselect node / Close panels', category: 'Selection' },
  { keys: ['P'], description: 'Pin/unpin selected node info', category: 'Selection' },

  // Node Actions
  { keys: ['T'], description: 'Send triage from selected node', category: 'Actions' },
  { keys: ['S'], description: 'Toggle node type (Source/Sink)', category: 'Actions' },
  { keys: ['I'], description: 'Add selected node to detail panel', category: 'Actions' },
  { keys: ['Delete'], description: 'Delete selected node', category: 'Actions' },
  { keys: ['Backspace'], description: 'Delete selected node', category: 'Actions' },

  // Node Creation
  { keys: ['N'], description: 'Create new Source node at center', category: 'Creation' },
  { keys: ['Shift', 'N'], description: 'Create new Sink node at center', category: 'Creation' },
  { keys: ['Double Click'], description: 'Create node at cursor', category: 'Creation' },

  // Help
  { keys: ['?'], description: 'Toggle this help panel', category: 'Help' },
];

const KeyboardShortcuts = () => {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      // Toggle help with '?' or 'Shift+/'
      if (e.key === '?' && !e.ctrlKey && !e.altKey && !e.metaKey) {
        e.preventDefault();
        setIsVisible(prev => !prev);
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, []);

  const categories = Array.from(new Set(shortcuts.map(s => s.category)));

  return (
    <>
      <button
        className="keyboard-help-toggle"
        onClick={() => setIsVisible(prev => !prev)}
        title="Keyboard Shortcuts (?)"
      >
        <HiQuestionMarkCircle />
      </button>

      {isVisible && (
        <div className="keyboard-shortcuts-overlay" onClick={() => setIsVisible(false)}>
          <div className="keyboard-shortcuts-panel" onClick={(e) => e.stopPropagation()}>
            <div className="shortcuts-header">
              <h2>Keyboard Shortcuts</h2>
              <button className="shortcuts-close" onClick={() => setIsVisible(false)}>
                ×
              </button>
            </div>
            <div className="shortcuts-content">
              {categories.map(category => (
                <div key={category} className="shortcuts-category">
                  <h3>{category}</h3>
                  <div className="shortcuts-list">
                    {shortcuts
                      .filter(s => s.category === category)
                      .map((shortcut, idx) => (
                        <div key={idx} className="shortcut-item">
                          <div className="shortcut-keys">
                            {shortcut.keys.map((key, i) => (
                              <span key={i}>
                                <kbd>{key}</kbd>
                                {i < shortcut.keys.length - 1 && <span className="key-separator">+</span>}
                              </span>
                            ))}
                          </div>
                          <div className="shortcut-description">{shortcut.description}</div>
                        </div>
                      ))}
                  </div>
                </div>
              ))}
            </div>
            <div className="shortcuts-footer">
              Press <kbd>?</kbd> or <kbd>Esc</kbd> to close
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default KeyboardShortcuts;
