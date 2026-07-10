/**
 * TrustLens Extension — Popup Logic
 * ════════════════════════════════════════════════════════════════════════════
 * Flow:
 *   1. Popup opens (user clicked extension icon)
 *   2. Check if a pending image URL exists (from right-click context menu)
 *      → YES: analyze that image URL
 *      → NO:  capture a screenshot of the current tab and analyze it
 *   3. Show loading animation while capturing + sending to ML service
 *   4. Render result card: verdict, confidence, signal details, report
 *   5. "View History" opens the TrustLens website history page
 * ════════════════════════════════════════════════════════════════════════════
 */

'use strict';

// ── Defaults (override in Settings panel or when deploying) ─────────────────
const DEFAULTS = {
  mlServiceUrl: 'https://trustlens-ml.onrender.com',
  websiteUrl:   'https://frontend-rhid6kx7h-shreyasmegharaj2-2447s-projects.vercel.app',
};

// ── State helpers ────────────────────────────────────────────────────────────
function showState(id) {
  ['stateCapturing', 'stateAnalyzing', 'stateResult', 'stateError']
    .forEach(s => document.getElementById(s).classList.toggle('hidden', s !== id));
}

// ── Storage helpers ──────────────────────────────────────────────────────────
function getSettings() {
  return new Promise(resolve => {
    chrome.storage.sync.get(['mlServiceUrl', 'websiteUrl'], data => {
      resolve({
        mlServiceUrl: (data.mlServiceUrl || DEFAULTS.mlServiceUrl).replace(/\/$/, ''),
        websiteUrl:   (data.websiteUrl   || DEFAULTS.websiteUrl).replace(/\/$/, ''),
      });
    });
  });
}

// ── dataURL ↔ Blob helpers ───────────────────────────────────────────────────
function dataUrlToBlob(dataUrl) {
  const [header, b64] = dataUrl.split(',');
  const mime  = header.match(/:(.*?);/)[1];
  const bytes = atob(b64);
  const buf   = new Uint8Array(bytes.length);
  for (let i = 0; i < bytes.length; i++) buf[i] = bytes.charCodeAt(i);
  return new Blob([buf], { type: mime });
}

function blobToDataUrl(blob) {
  return new Promise(resolve => {
    const r = new FileReader();
    r.onloadend = () => resolve(r.result);
    r.readAsDataURL(blob);
  });
}

// ── Core: send image blob to ML service ─────────────────────────────────────
async function analyzeBlob(blob, filename, dataUrl) {
  const { mlServiceUrl } = await getSettings();
  const form = new FormData();
  form.append('file', blob, filename);

  const res = await fetch(`${mlServiceUrl}/analyze/document`, {
    method: 'POST',
    body:   form,
  });

  if (!res.ok) {
    const errBody = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(`ML service (${res.status}): ${errBody.error || res.statusText}`);
  }

  return res.json();
}

// ── Show result card ─────────────────────────────────────────────────────────
function showResult(mlResult, dataUrl) {
  showState('stateResult');

  const verdict    = mlResult.verdict || 'SUSPICIOUS';
  const confidence = mlResult.confidence_score ?? 0;
  const elaScore   = mlResult.ela_score ?? 0;
  const details    = mlResult.ela_details ?? {};

  // ── Thumbnail ──────────────────────────────────────────────────────────────
  document.getElementById('thumbImg').src = dataUrl;

  // ── Color theme mapping ────────────────────────────────────────────────────
  let colorKey, emoji, label;
  if (verdict === 'CLEAN') {
    colorKey = 'clean'; emoji = '✅'; label = 'Appears Authentic';
  } else if (verdict === 'SUSPICIOUS') {
    colorKey = 'suspicious'; emoji = '⚠️'; label = 'Suspicious — Possible Tampering';
  } else {
    colorKey = 'tampered'; emoji = '🚨'; label = 'Tampered / AI-Generated';
  }

  // Overlay tint on thumbnail
  const overlay = document.getElementById('thumbOverlay');
  overlay.className = `thumb-overlay overlay-${colorKey}`;

  // Corner emoji badge
  document.getElementById('thumbCornerBadge').textContent = emoji;

  // ── Verdict badge ──────────────────────────────────────────────────────────
  const badge = document.getElementById('verdictBadge');
  badge.className = `verdict-badge badge-${colorKey}`;
  badge.innerHTML = `
    <span class="badge-emoji">${emoji}</span>
    <span class="badge-text">${label}</span>
  `;

  // ── Confidence bar ─────────────────────────────────────────────────────────
  document.getElementById('confVal').textContent = `${Math.round(confidence)}%`;
  setTimeout(() => {
    const bar = document.getElementById('confBar');
    bar.style.width = `${Math.min(confidence, 100)}%`;
    bar.className = `conf-bar bar-${colorKey}`;
  }, 80);

  // ── ELA signal details ─────────────────────────────────────────────────────
  const signalEntries = Object.entries(details).filter(([, v]) => typeof v === 'number');
  if (signalEntries.length > 0) {
    document.getElementById('signalsSection').classList.remove('hidden');
    const list = document.getElementById('signalsList');
    list.innerHTML = signalEntries.map(([k, v]) => `
      <div class="signal-row">
        <span class="signal-name">${k.replace(/_/g, ' ')}</span>
        <span class="signal-val">${v.toFixed(4)}</span>
      </div>
    `).join('');
  }

  // ── Plain-language report ──────────────────────────────────────────────────
  let report = '';
  if (verdict === 'CLEAN') {
    report = `No significant signs of AI generation or tampering detected. Image compression history appears consistent. ELA Score: ${elaScore.toFixed(2)}.`;
  } else if (verdict === 'SUSPICIOUS') {
    report = `Anomalies detected that may indicate editing or AI generation. Some regions show inconsistent compression. ELA Score: ${elaScore.toFixed(2)}.`;
  } else {
    report = `Strong evidence of AI generation or digital tampering found. Multiple forensic signals indicate manipulation. ELA Score: ${elaScore.toFixed(2)}.`;
  }
  document.getElementById('reportText').textContent = report;

  // ── Update history link ────────────────────────────────────────────────────
  updateLinks();
}

// ── Main: capture screenshot + analyze ──────────────────────────────────────
async function captureAndAnalyze() {
  showState('stateCapturing');

  try {
    // 1. Capture the active tab
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    const dataUrl = await chrome.tabs.captureVisibleTab(null, { format: 'png' });

    // 2. Show analyzing state with preview
    document.getElementById('previewImg').src = dataUrl;
    showState('stateAnalyzing');

    // 3. Convert to blob and analyze
    const blob     = dataUrlToBlob(dataUrl);
    const mlResult = await analyzeBlob(blob, 'screenshot.png', dataUrl);

    showResult(mlResult, dataUrl);

  } catch (err) {
    showError(err);
  }
}

// ── Alternate: analyze a specific image URL (from context menu) ──────────────
async function analyzeImageUrl(imageUrl) {
  showState('stateCapturing');

  try {
    const response = await fetch(imageUrl);
    if (!response.ok) throw new Error(`Cannot fetch image (${response.status})`);
    const blob    = await response.blob();
    const dataUrl = await blobToDataUrl(blob);

    document.getElementById('previewImg').src = dataUrl;
    showState('stateAnalyzing');

    const mlResult = await analyzeBlob(blob, 'image.jpg', dataUrl);
    showResult(mlResult, dataUrl);

  } catch (err) {
    showError(err);
  }
}

// ── Error display ────────────────────────────────────────────────────────────
function showError(err) {
  showState('stateError');

  const isNetwork = err.message.includes('fetch') ||
                    err.message.includes('NetworkError') ||
                    err.message.includes('Failed to fetch') ||
                    err.message.includes('ERR_CONNECTION');

  document.getElementById('errTitle').textContent = isNetwork
    ? 'Cannot Reach ML Service' : 'Analysis Failed';

  document.getElementById('errMsg').textContent = isNetwork
    ? 'Make sure the TrustLens ML service is running. ' +
      'Go to Settings → update the ML Service URL to your deployed Render URL.'
    : err.message;
}

// ── Update footer / history links ────────────────────────────────────────────
async function updateLinks() {
  const { websiteUrl } = await getSettings();
  document.getElementById('historyLink').href = `${websiteUrl}/history`;
  document.getElementById('openSite').href    = websiteUrl;
}

// ── Settings panel ────────────────────────────────────────────────────────────
document.getElementById('settingsBtn').addEventListener('click', () => {
  const panel = document.getElementById('settingsPanel');
  const isOpen = !panel.classList.contains('hidden');
  panel.classList.toggle('hidden', isOpen);

  if (!isOpen) {
    // Populate current values when opening
    chrome.storage.sync.get(['mlServiceUrl', 'websiteUrl'], data => {
      document.getElementById('inputMlUrl').value = data.mlServiceUrl || DEFAULTS.mlServiceUrl;
      document.getElementById('inputWebUrl').value = data.websiteUrl  || DEFAULTS.websiteUrl;
    });
  }
});

document.getElementById('cancelSettings').addEventListener('click', () => {
  document.getElementById('settingsPanel').classList.add('hidden');
});

document.getElementById('saveSettings').addEventListener('click', () => {
  const mlUrl  = document.getElementById('inputMlUrl').value.trim() || DEFAULTS.mlServiceUrl;
  const webUrl = document.getElementById('inputWebUrl').value.trim() || DEFAULTS.websiteUrl;

  chrome.storage.sync.set({ mlServiceUrl: mlUrl, websiteUrl: webUrl }, () => {
    document.getElementById('settingsPanel').classList.add('hidden');
    updateLinks();

    // Brief flash of the save button
    const btn = document.getElementById('saveSettings');
    btn.textContent = '✓ Saved!';
    setTimeout(() => { btn.textContent = 'Save'; }, 1500);
  });
});

// ── Signal details toggle ─────────────────────────────────────────────────────
document.getElementById('signalsToggle').addEventListener('click', () => {
  const body  = document.getElementById('signalsBody');
  const arrow = document.querySelector('.toggle-arrow');
  const isOpen = !body.classList.contains('hidden');
  body.classList.toggle('hidden', isOpen);
  arrow.classList.toggle('open', !isOpen);
});

// ── Retry buttons ─────────────────────────────────────────────────────────────
document.getElementById('reanalyzeBtn').addEventListener('click', captureAndAnalyze);
document.getElementById('retryBtn').addEventListener('click', captureAndAnalyze);

document.getElementById('errSettingsBtn').addEventListener('click', () => {
  document.getElementById('settingsPanel').classList.remove('hidden');
  chrome.storage.sync.get(['mlServiceUrl', 'websiteUrl'], data => {
    document.getElementById('inputMlUrl').value = data.mlServiceUrl || DEFAULTS.mlServiceUrl;
    document.getElementById('inputWebUrl').value = data.websiteUrl  || DEFAULTS.websiteUrl;
  });
});

// ══ Initialise ════════════════════════════════════════════════════════════════
document.addEventListener('DOMContentLoaded', async () => {
  await updateLinks();

  // Check for a pending image URL from a right-click context menu action
  // (timestamp check prevents stale data from being used)
  chrome.storage.local.get(['pendingImageUrl', 'pendingMode', 'pendingTimestamp'], data => {
    const isRecent = data.pendingTimestamp && (Date.now() - data.pendingTimestamp) < 15_000;

    if (data.pendingImageUrl && data.pendingMode === 'image_url' && isRecent) {
      // Clear the pending data immediately to avoid re-use
      chrome.storage.local.remove(['pendingImageUrl', 'pendingMode', 'pendingTimestamp']);
      analyzeImageUrl(data.pendingImageUrl);
    } else {
      // Default: take a screenshot of the current tab
      captureAndAnalyze();
    }
  });
});
