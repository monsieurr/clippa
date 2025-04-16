// content.js
let isAppendMode = false;
let lastCopyTime = 0;
const COPY_DEBOUNCE_TIME = 300; // ms

// Initialize
init();

async function init() {
  try {
    // Check initial state
    const response = await browser.runtime.sendMessage({ action: "getAppendMode" });
    isAppendMode = response.isAppendMode;
    
    // Watch for copy events
    document.addEventListener('copy', handleCopyEvent);
    
    // Create status overlay element (hidden initially)
    createStatusOverlay();
  } catch (error) {
    console.error("Error initializing content script:", error);
  }
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
      }
    } catch (error) {
      console.error("Error handling copy:", error);
      showStatus("Failed to append text", 2000);
    }
  }, 100);
}

// Listen for messages from background script
browser.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === "modeChanged") {
    isAppendMode = message.isAppendMode;
    showStatus(isAppendMode ? "Append mode enabled" : "Append mode disabled", 3000);
  } else if (message.action === "bufferCleared") {
    showStatus("Buffer cleared", 2000);
  } else if (message.action === "copyToClipboard") {
    navigator.clipboard.writeText(message.text)
      .then(() => showStatus("Copied to clipboard", 2000))
      .catch(error => {
        console.error("Failed to copy to clipboard:", error);
        showStatus("Failed to copy to clipboard", 2000);
      });
  }
});