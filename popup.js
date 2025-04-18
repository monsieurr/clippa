// popup.js
document.addEventListener('DOMContentLoaded', () => {
    const bufferTextarea = document.getElementById('current-buffer');
    const copyBufferBtn = document.getElementById('copy-buffer');
    const clearBufferBtn = document.getElementById('clear-buffer');
    const clearHistoryBtn = document.getElementById('clear-history');
    const toggleModeBtn = document.getElementById('toggle-mode');
    const modeIndicator = document.getElementById('mode-indicator');
    const historyContainer = document.getElementById('history-container');
    const statusMessage = document.getElementById('status-message');
    const shortcutKey = document.getElementById('shortcut-key');
    
    // Set platform-specific keyboard shortcut display
    if (navigator.platform.includes('Mac')) {
      shortcutKey.textContent = 'Option+C';
    } else {
      shortcutKey.textContent = 'Alt+C';
    }
    
    let isAppendMode = false;
    
    // Load clipboard data
    loadClipboardData();
    
    // Toggle append mode
    toggleModeBtn.addEventListener('click', () => {
      browser.runtime.sendMessage({ action: 'toggleAppendMode' })
        .then(response => {
          if (response.success) {
            isAppendMode = response.isAppendMode;
            updateModeIndicator();
            showStatus(isAppendMode ? 'Append mode enabled' : 'Append mode disabled');
          }
        })
        .catch(error => {
          console.error('Error toggling mode:', error);
          showStatus('Failed to toggle mode', 'red');
        });
    });
    
    // Event listeners
    copyBufferBtn.addEventListener('click', () => {
      const text = bufferTextarea.value;
      if (!text) {
        showStatus('Nothing to copy', 'red');
        return;
      }
      
      copyToClipboard(text);
    });
    
    clearBufferBtn.addEventListener('click', () => {
      browser.runtime.sendMessage({ action: 'clearBuffer' })
        .then(() => {
          bufferTextarea.value = '';
          showStatus('Buffer cleared');
        })
        .catch(error => {
          console.error('Error clearing buffer:', error);
          showStatus('Failed to clear buffer', 'red');
        });
    });
    
    clearHistoryBtn.addEventListener('click', () => {
      browser.runtime.sendMessage({ action: 'clearHistory' })
        .then(() => {
          historyContainer.innerHTML = '';
          showStatus('History cleared');
        })
        .catch(error => {
          console.error('Error clearing history:', error);
          showStatus('Failed to clear history', 'red');
        });
    });
    
    // Functions
    function loadClipboardData() {
      browser.runtime.sendMessage({ action: 'getHistory' })
        .then(response => {
          if (response.currentBuffer) {
            bufferTextarea.value = response.currentBuffer;
          }
          
          displayHistory(response.history || []);
          
          // Also get current mode
          return browser.runtime.sendMessage({ action: 'getAppendMode' });
        })
        .then(response => {
          isAppendMode = response.isAppendMode;
          updateModeIndicator();
        })
        .catch(error => {
          console.error('Error loading clipboard data:', error);
          showStatus('Failed to load data', 'red');
        });
    }
    
    function updateModeIndicator() {
      if (isAppendMode) {
        modeIndicator.textContent = 'Append Mode: On';
        modeIndicator.className = 'mode-status mode-enabled';
      } else {
        modeIndicator.textContent = 'Append Mode: Off';
        modeIndicator.className = 'mode-status mode-disabled';
      }
    }
    
    function displayHistory(history) {
      historyContainer.innerHTML = '';
      
      if (history.length === 0) {
        historyContainer.innerHTML = '<p>No history yet</p>';
        return;
      }
      
      history.forEach((item, index) => {
        const historyItem = document.createElement('div');
        historyItem.className = 'history-item';
        
        const content = document.createElement('pre');
        content.textContent = item.length > 200 ? item.substring(0, 200) + '...' : item;
        
        const actions = document.createElement('div');
        actions.className = 'actions';
        
        const copyBtn = document.createElement('button');
        copyBtn.textContent = 'Copy';
        copyBtn.addEventListener('click', () => copyToClipboard(item));
        
        const appendBtn = document.createElement('button');
        appendBtn.textContent = 'Append to Buffer';
        appendBtn.addEventListener('click', () => {
          const currentText = bufferTextarea.value;
          const newText = currentText ? currentText + '\n' + item : item;
          bufferTextarea.value = newText;
          
          // Update the buffer in storage
          browser.runtime.sendMessage({ 
            action: 'appendToBuffer', 
            text: item,
            replace: !currentText // Replace buffer if it's empty
          });
          
          showStatus('Appended to buffer');
        });
        
        actions.appendChild(copyBtn);
        actions.appendChild(appendBtn);
        
        historyItem.appendChild(content);
        historyItem.appendChild(actions);
        historyContainer.appendChild(historyItem);
      });
    }
    
    function copyToClipboard(text) {
      browser.runtime.sendMessage({ 
        action: 'copyToClipboard', 
        text: text 
      })
      .then(() => {
        showStatus('Copied to clipboard');
      })
      .catch(error => {
        console.error('Error copying to clipboard:', error);
        showStatus('Failed to copy', 'red');
      });
    }
    
    function showStatus(message, color = 'green') {
      statusMessage.textContent = message;
      statusMessage.style.color = color;
      
      setTimeout(() => {
        statusMessage.textContent = '';
      }, 3000);
    }

    const highlightToggle = document.getElementById('highlight-toggle');

    // Load highlight preference
    browser.storage.local.get('highlightEnabled')
      .then(result => {
        const highlightEnabled = result.highlightEnabled !== false; // Default to true
        highlightToggle.checked = highlightEnabled;
      });

    // Handle highlight toggle
    highlightToggle.addEventListener('change', () => {
      const highlightEnabled = highlightToggle.checked;
      
      // Save preference
      browser.storage.local.set({ highlightEnabled });
      
      // Notify content scripts
      browser.runtime.sendMessage({ 
        action: 'setHighlightEnabled', 
        enabled: highlightEnabled 
      });
      
      showStatus(highlightEnabled ? 'Highlighting enabled' : 'Highlighting disabled');
    });
  });