/**
 * TrustLens API client
 * Single file — all requests go through here.
 */

const BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:5000/api";
// Render free-tier spins down after inactivity — allow up to 60s for cold start
const REQUEST_TIMEOUT_MS = 60_000;

// ── Helpers ───────────────────────────────────────────────────────────────────

function getToken() {
  return localStorage.getItem("tl_token");
}

function authHeaders() {
  const token = getToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function request(url, options = {}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    return await fetch(url, {
      ...options,
      signal: controller.signal,
    });
  } catch (err) {
    if (err.name === "AbortError") {
      throw new Error("Backend is not responding. Check the Render backend service.");
    }
    throw err;
  } finally {
    clearTimeout(timeout);
  }
}

async function handleResponse(res) {
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error || `Request failed (${res.status})`);
  }
  return data;
}

// ── Auth ──────────────────────────────────────────────────────────────────────

export async function signup(name, email, password) {
  const res = await request(`${BASE_URL}/auth/signup`, {
    method:  "POST",
    headers: { "Content-Type": "application/json" },
    body:    JSON.stringify({ name, email, password }),
  });
  return handleResponse(res);
}

export async function login(email, password) {
  const res = await request(`${BASE_URL}/auth/login`, {
    method:  "POST",
    headers: { "Content-Type": "application/json" },
    body:    JSON.stringify({ email, password }),
  });
  return handleResponse(res);
}

export async function getMe() {
  const res = await request(`${BASE_URL}/auth/me`, {
    headers: authHeaders(),
  });
  return handleResponse(res);
}

// ── Verification ──────────────────────────────────────────────────────────────

export async function verifyFile(file, onProgress) {
  const form = new FormData();
  form.append("file", file);

  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", `${BASE_URL}/verify`);
    xhr.timeout = 120_000;

    const token = getToken();
    if (token) xhr.setRequestHeader("Authorization", `Bearer ${token}`);

    xhr.upload.addEventListener("progress", (e) => {
      if (e.lengthComputable && onProgress) {
        onProgress(Math.round((e.loaded / e.total) * 100));
      }
    });

    xhr.onload = () => {
      try {
        const data = JSON.parse(xhr.responseText);
        if (xhr.status >= 200 && xhr.status < 300) {
          resolve(data);
        } else {
          reject(new Error(data.error || `Upload failed (${xhr.status})`));
        }
      } catch {
        reject(new Error("Invalid server response"));
      }
    };

    xhr.onerror = () => reject(new Error("Network error. Is the server running?"));
    xhr.ontimeout = () => reject(new Error("Backend timed out while analyzing the file."));
    xhr.send(form);
  });
}

export async function getHistory(page = 1, limit = 20) {
  const res = await request(`${BASE_URL}/verify/history?page=${page}&limit=${limit}`, {
    headers: authHeaders(),
  });
  return handleResponse(res);
}

export async function getVerification(id) {
  const res = await request(`${BASE_URL}/verify/${id}`, {
    headers: authHeaders(),
  });
  return handleResponse(res);
}
