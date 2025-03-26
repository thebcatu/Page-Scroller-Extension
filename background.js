chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === "complete") {
    chrome.storage.local.get(['scrollState'], (data) => {
      if (data.scrollState === true) {
        chrome.tabs.sendMessage(tabId, { action: "checkScrollState" }).catch(() => {
          console.log("Waiting for content script to initialize...");
        });
      }
    });
  }
});

chrome.tabs.onActivated.addListener((activeInfo) => {
  chrome.storage.local.get(['scrollState'], (data) => {
    if (data.scrollState === true) {
      setTimeout(() => {
        chrome.action.setBadgeText({
          text: "ON",
          tabId: activeInfo.tabId
        });
        chrome.action.setBadgeBackgroundColor({
          color: "#1a73e8",
          tabId: activeInfo.tabId
        });
      }, 500);
    } else {
      chrome.action.setBadgeText({
        text: "",
        tabId: activeInfo.tabId
      });
    }
  });
});
