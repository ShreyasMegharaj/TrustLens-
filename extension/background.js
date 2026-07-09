/**
 * TrustLens Extension — Background Service Worker
 * Handles: context menu registration + pending image URL storage
 */

// ── Register context menu on install ────────────────────────────────────────
chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: 'trustlens-check-image',
    title: '🔍 Check with TrustLens',
    contexts: ['image'],
  });

  // Set default settings
  chrome.storage.sync.get(['mlServiceUrl', 'websiteUrl'], (data) => {
    if (!data.mlServiceUrl) {
      chrome.storage.sync.set({
        mlServiceUrl: 'http://localhost:5001',
        websiteUrl:   'http://localhost:5173',
      });
    }
  });
});

// ── Context menu: right-click any image → Check with TrustLens ──────────────
chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === 'trustlens-check-image' && info.srcUrl) {
    // Store the image URL so the popup picks it up when opened
    chrome.storage.local.set({
      pendingImageUrl:       info.srcUrl,
      pendingMode:           'image_url',
      pendingTimestamp:      Date.now(),
    });
  }
});
