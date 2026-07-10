/**
 * TrustLens Extension - Background Service Worker
 * Handles context menu registration and default settings migration.
 */

const DEFAULTS = {
  mlServiceUrl: 'https://trustlens-ml-cm23.onrender.com',
  websiteUrl:   'https://frontend-gilt-pi-88.vercel.app',
};

const LEGACY_BAD_SETTINGS = {
  mlServiceUrl: new Set([
    'http://localhost:5001',
    'https://trustlens-ml.onrender.com',
  ]),
  websiteUrl: new Set([
    'http://localhost:5173',
    'https://frontend-rhid6kx7h-shreyasmegharaj2-2447s-projects.vercel.app',
  ]),
};

function migrateSettings() {
  chrome.storage.sync.get(['mlServiceUrl', 'websiteUrl'], (data) => {
    const savedMlUrl = (data.mlServiceUrl || '').replace(/\/$/, '');
    const savedWebUrl = (data.websiteUrl || '').replace(/\/$/, '');
    const mlServiceUrl = !savedMlUrl || LEGACY_BAD_SETTINGS.mlServiceUrl.has(savedMlUrl)
      ? DEFAULTS.mlServiceUrl
      : savedMlUrl;
    const websiteUrl = !savedWebUrl || LEGACY_BAD_SETTINGS.websiteUrl.has(savedWebUrl)
      ? DEFAULTS.websiteUrl
      : savedWebUrl;

    if (mlServiceUrl !== savedMlUrl || websiteUrl !== savedWebUrl) {
      chrome.storage.sync.set({ mlServiceUrl, websiteUrl });
    }
  });
}

chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.removeAll(() => {
    chrome.contextMenus.create({
      id: 'trustlens-check-image',
      title: 'Check with TrustLens',
      contexts: ['image'],
    });
  });

  migrateSettings();
});

chrome.runtime.onStartup.addListener(migrateSettings);

chrome.contextMenus.onClicked.addListener((info) => {
  if (info.menuItemId === 'trustlens-check-image' && info.srcUrl) {
    chrome.storage.local.set({
      pendingImageUrl:  info.srcUrl,
      pendingMode:     'image_url',
      pendingTimestamp: Date.now(),
    });
  }
});
