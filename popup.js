document.addEventListener('DOMContentLoaded', function() {
  const startBtn = document.getElementById('startBtn');
  const stopBtn = document.getElementById('stopBtn');
  const statusDisplay = document.getElementById('statusDisplay');
  const elementCountElem = document.getElementById('elementCount');
  const scrollPositionElem = document.getElementById('scrollPosition');
  const scrollProgressBar = document.getElementById('scrollProgress');
  const progressPercentage = document.getElementById('progressPercentage');
  const statusIndicator = document.getElementById('statusIndicator');
  const speedSlider = document.getElementById('speedSlider');
  const speedValue = document.getElementById('speedValue');
  const autoStopOption = document.getElementById('autoStopOption');
  
  speedSlider.addEventListener('input', function() {
    speedValue.textContent = `${speedSlider.value}×`;
  });
  
  updateStatus();

  function checkNetworkStatus() {
    if (!navigator.onLine) {
      showStatus('Network connection lost. Some features may be limited.', 'error');
      return false;
    }
    return true;
  }

  startBtn.addEventListener('click', function() {
    startBtn.classList.add('clicked');
    setTimeout(() => startBtn.classList.remove('clicked'), 200);
    
    if (!checkNetworkStatus()) {
      showStatus('Attempting to scroll with limited functionality', 'error');
    }
    
    chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
      if (!tabs || tabs.length === 0) {
        showStatus('Error: Cannot access active tab', 'error');
        return;
      }
      
      try {
        chrome.tabs.sendMessage(
          tabs[0].id, 
          {
            action: 'startScrolling',
            speed: speedSlider.value,
            autoStop: autoStopOption.checked
          }, 
          function(response) {
            if (chrome.runtime.lastError) {
              console.log('Error: ', chrome.runtime.lastError.message);
              showStatus('Please refresh the page and try again', 'error');
              return;
            }
            
            if (response && response.success) {
              startBtn.disabled = true;
              stopBtn.disabled = false;
              showStatus('Scrolling at ' + speedSlider.value + '× speed', 'active');
              animateProgress();
            } else {
              showStatus('Could not start scrolling. Try refreshing the page.', 'error');
            }
          }
        );
      } catch (e) {
        console.error("Error sending message:", e);
        showStatus('Extension error. Please refresh and try again.', 'error');
      }
    });
  });
  
  stopBtn.addEventListener('click', function() {
    stopBtn.classList.add('clicked');
    setTimeout(() => stopBtn.classList.remove('clicked'), 200);
    
    stopBtn.disabled = true;
    startBtn.disabled = false;
    
    chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
      if (!tabs || tabs.length === 0) {
        showStatus('Scrolling stopped', 'idle');
        
        chrome.storage.local.set({scrollState: false});
        return;
      }
      
      try {
        chrome.tabs.sendMessage(
          tabs[0].id, 
          {action: 'stopScrolling'}, 
          function(response) {
            if (chrome.runtime.lastError) {
              console.log('Error stopping: ', chrome.runtime.lastError.message);
              showStatus('Scrolling stopped (connection error)', 'idle');
              chrome.storage.local.set({scrollState: false});
              return;
            }
            
            showStatus('Scrolling stopped', 'idle');
          }
        );
      } catch (e) {
        console.error("Error sending stop message:", e);
        chrome.storage.local.set({scrollState: false});
        showStatus('Scrolling stopped (error occurred)', 'error');
      }
    });
  });
  
  function showStatus(message, state) {
    statusDisplay.textContent = message;
    statusDisplay.className = 'status ' + (state || '');
    
    if (state === 'active') {
      statusIndicator.className = 'status-indicator active';
    } else if (state === 'error') {
      statusIndicator.className = 'status-indicator error';
    } else if (state === 'success') {
      statusIndicator.className = 'status-indicator success';
    } else {
      statusIndicator.className = 'status-indicator idle';
    }
  }
  
  let animationFrame;
  function animateProgress() {
    if (animationFrame) cancelAnimationFrame(animationFrame);
    
    const animation = () => {
      const currentValue = parseFloat(scrollProgressBar.value);
      if (currentValue < 95) {
        scrollProgressBar.value = Math.min(currentValue + Math.random() * 0.5, 95);
        progressPercentage.textContent = `${Math.round(scrollProgressBar.value)}%`;
      }
      
      if (startBtn.disabled) {
        animationFrame = requestAnimationFrame(animation);
      }
    };
    
    animationFrame = requestAnimationFrame(animation);
  }
  
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'updateStatus') {
      let state = 'active';
      if (request.status.includes('stopped')) state = 'idle';
      if (request.status.includes('Success') || request.status.includes('Reached')) state = 'success';
      if (request.status.includes('Error') || request.status.includes('Failed')) state = 'error';
      
      showStatus(request.status, state);
      elementCountElem.textContent = request.elementCount.toLocaleString();
      scrollPositionElem.textContent = request.scrollPosition.toLocaleString();
      
      const scrollPercentage = Math.min(
        (request.scrollPosition / request.documentHeight) * 100, 
        100
      );
      scrollProgressBar.value = scrollPercentage;
      progressPercentage.textContent = `${Math.round(scrollPercentage)}%`;
      
      if (state !== 'active') {
        startBtn.disabled = false;
        stopBtn.disabled = true;
        if (animationFrame) {
          cancelAnimationFrame(animationFrame);
          animationFrame = null;
        }
      }
    }
    sendResponse({received: true});
    return true;
  });
  
  function updateStatus() {
    chrome.storage.local.get(['scrollState'], function(savedState) {
      if (savedState.scrollState === true) {
        startBtn.disabled = true;
        stopBtn.disabled = false;
        showStatus('Retrieving scroll status...', 'active');
        animateProgress();
      }
      
      chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
        if (!tabs || tabs.length === 0) {
          showStatus('Ready to scroll! Click Start to begin.', 'idle');
          return;
        }
        
        chrome.tabs.sendMessage(tabs[0].id, {action: 'getStatus'}, function(response) {
          if (chrome.runtime.lastError) {
            console.log('Error: ', chrome.runtime.lastError.message);
            
            if (savedState.scrollState === true) {
              startBtn.disabled = true;
              stopBtn.disabled = false;
              showStatus('Page is scrolling (reconnecting...)', 'active');
            } else {
              startBtn.disabled = false;
              stopBtn.disabled = true;
              showStatus('Ready to scroll! Click Start to begin.', 'idle');
            }
            return;
          }
          
          if (response) {
            if (response.isScrolling) {
              startBtn.disabled = true;
              stopBtn.disabled = false;
              showStatus(`Scrolling at ${response.speed}× speed`, 'active');
              animateProgress();
              
              if (response.speed) {
                speedSlider.value = response.speed;
                speedValue.textContent = `${response.speed}×`;
              }
            } else {
              startBtn.disabled = false;
              stopBtn.disabled = true;
              showStatus('Ready to scroll! Click Start to begin.', 'idle');
            }
            
            elementCountElem.textContent = response.elementCount.toLocaleString();
            scrollPositionElem.textContent = response.scrollPosition.toLocaleString();
            
            const scrollPercentage = Math.min(
              (response.scrollPosition / response.documentHeight) * 100,
              100
            );
            scrollProgressBar.value = scrollPercentage;
            progressPercentage.textContent = `${Math.round(scrollPercentage)}%`;
          }
        });
      });
    });
  }
});
