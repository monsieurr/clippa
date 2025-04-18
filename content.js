// content.js
let isAppendMode = false;
let lastCopyTime = 0;
const COPY_DEBOUNCE_TIME = 300; // ms
let highlightedRanges = [];
let selectionRanges = [];
const HIGHLIGHT_CLASS = 'clipboard-appender-highlight';
let highlightEnabled = true;

// Initialize
init();

async function init() {
  try {
    // Check initial state
    const response = await browser.runtime.sendMessage({ action: "getAppendMode" });
    isAppendMode = response.isAppendMode;
    
    // Load highlight preference
    const result = await browser.storage.local.get('highlightEnabled');
    highlightEnabled = result.highlightEnabled !== false; // Default to true
    
    // Watch for copy events
    document.addEventListener('copy', handleCopyEvent);
    
    // Watch for selections to track potential highlights
    document.addEventListener('selectionchange', captureSelection);
    
    // Create status overlay element (hidden initially)
    createStatusOverlay();
    
    // Add highlight styles
    addHighlightStyles();
  } catch (error) {
    console.error("Error initializing content script:", error);
  }
}

// Add CSS for highlights
function addHighlightStyles() {
  const style = document.createElement('style');
  style.textContent = `
    .${HIGHLIGHT_CLASS} {
      background-color: rgba(255, 255, 0, 0.3);
      border-radius: 2px;
      transition: background-color 0.3s ease;
    }
    
    .${HIGHLIGHT_CLASS}:hover {
      background-color: rgba(255, 255, 0, 0.5);
    }
  `;
  document.head.appendChild(style);
}

// Create status overlay for visual feedback
function createStatusOverlay() {
  const overlay = document.createElement('div');
  overlay.id = 'clipboard-appender-status';
  overlay.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    background-color: rgba(0, 0, 0, 0.7);
    color: white;
    padding: 10px 15px;
    border-radius: 5px;
    z-index: 10000;
    font-family: system-ui, sans-serif;
    font-size: 14px;
    transition: opacity 0.3s ease;
    opacity: 0;
    pointer-events: none;
  `;
  document.body.appendChild(overlay);
}

// Show status message
function showStatus(message, duration = 2000) {
  const overlay = document.getElementById('clipboard-appender-status');
  if (!overlay) return;
  
  overlay.textContent = message;
  overlay.style.opacity = '1';
  
  setTimeout(() => {
    overlay.style.opacity = '0';
  }, duration);
}

// Capture current selection for highlighting
function captureSelection() {
  // Only track selection if in append mode
  if (!isAppendMode) return;
  
  const selection = window.getSelection();
  if (!selection.rangeCount) return;
  
  // Store the current selection ranges
  selectionRanges = [];
  for (let i = 0; i < selection.rangeCount; i++) {
    selectionRanges.push(selection.getRangeAt(i).cloneRange());
  }
}

// Handle copy events
function handleCopyEvent(e) {
  // Debounce multiple rapid copy events
  const now = Date.now();
  if (now - lastCopyTime < COPY_DEBOUNCE_TIME) return;
  lastCopyTime = now;
  
  if (!isAppendMode) return;
  
  // Use a small timeout to ensure the copy operation completes
  setTimeout(async () => {
    try {
      // Get the copied text
      const text = await navigator.clipboard.readText();
      if (!text) return;
      
      // Send to background script to append to buffer
      const response = await browser.runtime.sendMessage({ 
        action: "appendToBuffer", 
        text: text 
      });
      
      if (response.success) {
        showStatus("Text appended to buffer");
        
        // Highlight the copied text
        highlightSelectedText();
      }
    } catch (error) {
      console.error("Error handling copy:", error);
      showStatus("Failed to append text", 2000);
    }
  }, 100);
}

// Highlight the selected text that was just copied
function highlightSelectedText() {
  // Skip highlighting if disabled
  if (!highlightEnabled || !selectionRanges.length) return;
  
  try {
    // Use requestAnimationFrame for better performance
    requestAnimationFrame(() => {
      // Create a fragment to batch DOM operations
      const highlightFragment = document.createDocumentFragment();
      
      selectionRanges.forEach(range => {
        // Skip if range is empty or detached
        if (range.collapsed || !range.startContainer || !range.endContainer) return;
        
        // Create a marker for this highlight
        const highlightEl = document.createElement('mark');
        highlightEl.className = HIGHLIGHT_CLASS;
        
        try {
          // Clone the range contents into our highlight element
          const contents = range.cloneContents();
          highlightEl.appendChild(contents);
          
          // Replace the range with our highlighted version
          range.deleteContents();
          range.insertNode(highlightEl);
          
          // Store highlight for potential removal later
          highlightedRanges.push(highlightEl);
        } catch (e) {
          console.error("Error highlighting range:", e);
        }
      });
      
      // Reset selection tracking
      selectionRanges = [];
    });
  } catch (error) {
    console.error("Error highlighting text:", error);
  }
}

// Clear all highlights
function clearHighlights() {
  // Use requestIdleCallback for non-critical operation
  // with fallback to setTimeout for older browsers
  const scheduleTask = window.requestIdleCallback || 
    ((cb) => setTimeout(cb, 1));
  
  scheduleTask(() => {
    highlightedRanges.forEach(highlight => {
      try {
        // Replace highlight with its text content
        if (highlight && highlight.parentNode) {
          const textNode = document.createTextNode(highlight.textContent);
          highlight.parentNode.replaceChild(textNode, highlight);
        }
      } catch (e) {
        console.error("Error removing highlight:", e);
      }
    });
    
    highlightedRanges = [];
  });
}

// Listen for messages from background script
browser.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === "modeChanged") {
    isAppendMode = message.isAppendMode;
    showStatus(isAppendMode ? "Append mode enabled" : "Append mode disabled", 3000);
    
    // Clear highlights when mode is disabled
    if (!isAppendMode) {
      clearHighlights();
    }
  } else if (message.action === "bufferCleared") {
    showStatus("Buffer cleared", 2000);
    clearHighlights();
  } else if (message.action === "copyToClipboard") {
    navigator.clipboard.writeText(message.text)
      .then(() => showStatus("Copied to clipboard", 2000))
      .catch(error => {
        console.error("Failed to copy to clipboard:", error);
        showStatus("Failed to copy to clipboard", 2000);
      });
  } else if (message.action === "setHighlightEnabled") {
    highlightEnabled = message.enabled;
    
    // Clear highlights if disabled
    if (!highlightEnabled) {
      clearHighlights();
    }
  }
});