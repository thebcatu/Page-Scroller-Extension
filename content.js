let isScrolling = false;
let elementCount = 0;
let scrollSpeed = 2000;
let smoothScrollInterval = 20;
let scrollIntervalId = null;
let statusUpdateIntervalId = null;
let lastScrollY = 0;
let autoStopEnabled = true;
let currentUrl = window.location.href;

function initializeScrollState() {
  chrome.storage.local.get(['scrollState', 'scrollSpeed', 'autoStop'], function(result) {
    if (result.scrollState === true) {
      isScrolling = true;
      scrollSpeed = result.scrollSpeed || 2000;
      autoStopEnabled = result.autoStop !== undefined ? result.autoStop : true;
      
      setTimeout(() => {
        removeFixedElements();
        startSimpleScrolling();
        statusUpdateIntervalId = setInterval(updateStatus, 1000);
        sendStatus('Scrolling resumed after page change');
      }, 1000);
    }
  });
}

function saveScrollState() {
  chrome.storage.local.set({
    scrollState: isScrolling,
    scrollSpeed: scrollSpeed,
    autoStop: autoStopEnabled
  });
}

setInterval(() => {
  if (window.location.href !== currentUrl) {
    currentUrl = window.location.href;
    console.log("Detected page change to:", currentUrl);
    
    if (isScrolling) {
      stopScrolling(false);
      setTimeout(() => {
        if (isScrolling) {
          startSimpleScrolling();
          sendStatus('Continuing scroll after page change');
        }
      }, 1500);
    }
  }
}, 500);

initializeScrollState();

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'startScrolling') {
    if (!isScrolling) {
      isScrolling = true;
      lastScrollY = window.scrollY;
      elementCount = countElements();
      
      if (request.speed) {
        const speedMultiplier = parseFloat(request.speed);
        scrollSpeed = Math.floor(2000 * speedMultiplier);
      }
      
      if (request.hasOwnProperty('autoStop')) {
        autoStopEnabled = request.autoStop;
      }
      
      saveScrollState();
      
      removeFixedElements();
      
      startSimpleScrolling();
      
      statusUpdateIntervalId = setInterval(updateStatus, 1000);
      
      sendStatus('Scrolling started');
    }
    sendResponse({success: true, message: 'Scrolling started'});
  } 
  else if (request.action === 'stopScrolling') {
    stopScrolling(true);
    sendResponse({success: true, message: 'Scrolling stopped'});
  }
  else if (request.action === 'getStatus') {
    sendResponse({
      isScrolling: isScrolling,
      elementCount: elementCount,
      scrollPosition: window.scrollY,
      documentHeight: getDocumentHeight(),
      speed: scrollSpeed / 2000
    });
  }
  return true;
});

function startSimpleScrolling() {
  if (scrollIntervalId) {
    clearInterval(scrollIntervalId);
  }
  
  createClickBlocker();
  
  const pixelsPerMs = scrollSpeed / 1000;
  const pixelsPerInterval = pixelsPerMs * smoothScrollInterval;
  
  scrollIntervalId = setInterval(() => {
    if (!isScrolling) {
      clearInterval(scrollIntervalId);
      removeClickBlocker();
      return;
    }
    
    window.scrollBy(0, pixelsPerInterval);
    
    if (autoStopEnabled && isAtBottom()) {
      sendStatus('Reached the end of the page');
      
      const nextPageClicked = clickNextPageLink();
      
      if (!nextPageClicked) {
        stopScrolling(true);
      } else {
        sendStatus('Loading next page...');
      }
      return;
    }
    
  }, smoothScrollInterval);
  
  console.log("Simple scrolling started at speed", scrollSpeed, "pixels/second");
}

function clickNextPageLink() {
  const nextPagePatterns = [
    'next page', 'next', 'siguiente', '›', '»', 'older', 
    'load more', 'show more', 'more posts'
  ];
  
  const potentialNextLinks = Array.from(document.querySelectorAll('a, button, [role="button"]'))
    .filter(el => {
      if (!el.textContent || !el.offsetParent) return false;
      
      const text = el.textContent.toLowerCase().trim();
      const hasNextPattern = nextPagePatterns.some(pattern => 
        text.includes(pattern.toLowerCase())
      );
      
      const hasNavClasses = el.className.toLowerCase().includes('nav') || 
                           el.className.toLowerCase().includes('next') ||
                           el.className.toLowerCase().includes('pagination');
                           
      const hasNextIcon = el.innerHTML.includes('arrow') || 
                          el.innerHTML.includes('chevron') ||
                          el.innerHTML.includes('›') || 
                          el.innerHTML.includes('»');
      
      return hasNextPattern || (hasNavClasses && hasNextIcon);
    });
  
  if (potentialNextLinks.length > 0) {
    console.log("Found potential next page link:", potentialNextLinks[0]);
    try {
      potentialNextLinks[0].click();
      return true;
    } catch(e) {
      console.log("Error clicking next page link:", e);
    }
  }
  
  return false;
}

function createClickBlocker() {
  removeClickBlocker();
  
  const blocker = document.createElement('div');
  blocker.id = 'ultimate-scroller-blocker';
  blocker.style.position = 'fixed';
  blocker.style.top = '0';
  blocker.style.left = '0';
  blocker.style.width = '100%';
  blocker.style.height = '100%';
  blocker.style.zIndex = '9999999';
  blocker.style.background = 'transparent';
  blocker.style.pointerEvents = 'all';
  
  blocker.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
  });
  
  blocker.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      stopScrolling(true);
    }
  });
  
  document.body.appendChild(blocker);
}

function removeClickBlocker() {
  const blocker = document.getElementById('ultimate-scroller-blocker');
  if (blocker) {
    blocker.remove();
  }
}

function isAtBottom() {
  const scrollPosition = window.scrollY + window.innerHeight;
  const totalHeight = getDocumentHeight();
  return scrollPosition >= totalHeight - 200;
}

function countElements() {
  return document.querySelectorAll('div, p, img, article, section, li').length;
}

function getDocumentHeight() {
  return Math.max(
    document.body.scrollHeight,
    document.body.offsetHeight,
    document.documentElement.clientHeight,
    document.documentElement.scrollHeight,
    document.documentElement.offsetHeight
  );
}

function removeFixedElements() {
  try {
    const potentialBlockers = document.querySelectorAll(
      'header, nav, div[class*="header"], div[class*="nav"], div[class*="sticky"], div[class*="fixed"], div[style*="fixed"], div[style*="sticky"]'
    );
    
    let hiddenCount = 0;
    potentialBlockers.forEach(el => {
      const style = window.getComputedStyle(el);
      if (style.position === 'fixed' || style.position === 'sticky') {
        if (el.getBoundingClientRect().top < 150) {
          el.style.display = 'none';
          hiddenCount++;
        }
      }
    });
  } catch (e) {
    console.log('Error removing fixed elements:', e);
  }
}

function stopScrolling(changeState = true) {
  if (changeState) {
    isScrolling = false;
    saveScrollState();
  }
  
  if (scrollIntervalId) {
    clearInterval(scrollIntervalId);
    scrollIntervalId = null;
  }
  
  if (statusUpdateIntervalId) {
    clearInterval(statusUpdateIntervalId);
    statusUpdateIntervalId = null;
  }
  
  removeClickBlocker();
  
  if (changeState) {
    sendStatus('Scrolling stopped');
  }
}

function sendStatus(message) {
  try {
    const sendPromise = new Promise((resolve, reject) => {
      chrome.runtime.sendMessage({
        action: 'updateStatus',
        status: message,
        elementCount: elementCount,
        scrollPosition: window.scrollY,
        documentHeight: getDocumentHeight()
      }, (response) => {
        if (chrome.runtime.lastError) {
          console.log('Handled error:', chrome.runtime.lastError.message);
          resolve();
        } else {
          resolve(response);
        }
      });
      
      setTimeout(() => resolve(), 1000);
    });
    
    sendPromise.catch(() => {
      console.log('Network communication error - continuing scroll operation');
    });
  } catch (e) {
    console.log('Status update error (handled)');
  }
}

function updateStatus() {
  const newElementCount = countElements();
  const position = window.scrollY.toLocaleString();
  const height = getDocumentHeight().toLocaleString();
  const scrollPercent = Math.round((window.scrollY / getDocumentHeight()) * 100);
  
  if (newElementCount > elementCount) {
    elementCount = newElementCount;
  }
  
  sendStatus(`Scrolling at ${scrollPercent}% (${position}px of ${height}px)`);
}
