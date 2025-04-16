// background.js
let isAppendMode = false;
let clipboardBuffer = "";
let clipboardHistory = [];
const MAX_HISTORY_SIZE = 50;

// Toggle clipboard append mode
browser.commands.onCommand.addListener((command) => {
  if (command === "append-clipboard") {
    isAppendMode = !isAppendMode;
    
    // Notify the user about mode change
    browser.notifications.create({
      type: "basic",
      title: "Clipboard Appender",
      message: isAppendMode ? "Append mode enabled" : "Append mode disabled",
      iconUrl: "icons/icon-48.png"
    });
    
    // Also notify any active tabs through content scripts
    notifyContentScripts({ action: "modeChanged", isAppendMode });
    
    if (!isAppendMode && clipboardBuffer) {
      saveToHistory(clipboardBuffer);
      clipboardBuffer = "";
      browser.storage.local.set({ currentBuffer: "" });
    }
  }
});

// Notify all content scripts about state changes
function notifyContentScripts(message) {
  browser.tabs.query({}).then(tabs => {
    for (const tab of tabs) {
      browser.tabs.sendMessage(tab.id, message).catch(err => {
        // Suppress errors for tabs where content script isn't loaded
        if (!err.message.includes("Could not establish connection")) {
          console.error(`Error sending message to tab ${tab.id}:`, err);
        }
      });
    }
  });
}

// Listen for messages from content scripts
browser.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === "getAppendMode") {
    sendResponse({ isAppendMode });
  } else if (message.action === "appendToBuffer") {
    try {
      const text = message.text;
      if (!text) return;
      
      if (clipboardBuffer) {
        clipboardBuffer += "\n" + text;
      } else {
        clipboardBuffer = text;
      }
      
      // Update the storage
      browser.storage.local.set({ currentBuffer: clipboardBuffer });
      sendResponse({ success: true, buffer: clipboardBuffer });
    } catch (error) {
      console.error("Error appending to buffer:", error);
      sendResponse({ success: false, error: error.message });
    }
  } else if (message.action === "getHistory") {
    sendResponse({ history: clipboardHistory, currentBuffer: clipboardBuffer });
  } else if (message.action === "clearBuffer") {
    clipboardBuffer = "";
    browser.storage.local.set({ currentBuffer: "" });
    notifyContentScripts({ action: "bufferCleared" });
    sendResponse({ success: true });
  } else if (message.action === "clearHistory") {
    clipboardHistory = [];
    browser.storage.local.set({ clipboardHistory: [] });
    sendResponse({ success: true });
  } else if (message.action === "copyToClipboard") {
    // We'll handle this in content script for better clipboard access
    notifyContentScripts({ 
      action: "copyToClipboard", 
      text: message.text
    });
    sendResponse({ success: true });
  }
  // Inside the browser.runtime.onMessage.addListener function, add this case:
else if (message.action === "toggleAppendMode") {
    isAppendMode = !isAppendMode;
    
    // Notify the user about mode change
    browser.notifications.create({
      type: "basic",
      title: "Clipboard Appender",
      message: isAppendMode ? "Append mode enabled" : "Append mode disabled",
      iconUrl: "icons/icon-48.png"
    });
    
    // Also notify any active tabs through content scripts
    notifyContentScripts({ action: "modeChanged", isAppendMode });
    
    if (!isAppendMode && clipboardBuffer) {
      saveToHistory(clipboardBuffer);
      clipboardBuffer = "";
      browser.storage.local.set({ currentBuffer: "" });
    }
    
    sendResponse({ success: true, isAppendMode });
  }
  return true; // Indicate we might respond asynchronously
});

// Save completed buffer to history
function saveToHistory(text) {
  if (!text) return;
  
  clipboardHistory.unshift(text);
  
  // Trim history if it exceeds maximum size
  if (clipboardHistory.length > MAX_HISTORY_SIZE) {
    clipboardHistory = clipboardHistory.slice(0, MAX_HISTORY_SIZE);
  }
  
  // Update storage
  browser.storage.local.set({ clipboardHistory });
}

// Initialize from storage
browser.storage.local.get(['currentBuffer', 'clipboardHistory'])
  .then(result => {
    if (result.currentBuffer) {
      clipboardBuffer = result.currentBuffer;
    }
    if (result.clipboardHistory) {
      clipboardHistory = result.clipboardHistory;
    }
  })
  .catch(error => console.error("Error loading from storage:", error));