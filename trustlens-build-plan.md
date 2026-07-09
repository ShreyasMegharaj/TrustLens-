# TrustLens — Full Build Plan
(Deepfake Video + Document Tampering Detector — MERN + Flask ML + Claude API)

---

## PHASE 0 — Project Setup (Day 1, ~1 hour)

- [ ] Create GitHub repo: `trustlens`
- [ ] Inside it, create three top-level folders: `frontend`, `backend`, `ml-service`
- [ ] Sign up (free tier): Render.com, Vercel.com, MongoDB Atlas, Anthropic Console, HuggingFace (backup ML hosting)
- [ ] Generate Anthropic API key from console.anthropic.com — save safely, **never hardcode in code**
- [ ] Collect test data in parallel:
  - 10–15 real face videos
  - 10–15 deepfake videos (reuse internship dataset)
  - 10–15 genuine ID/document images
  - 10–15 tampered versions of those (crop-paste photo, change a number)

---

## PHASE 1 — ML Service (Weekend 1, first half)

**File structure — `ml-service/`**
```
app.py            # main Flask server
model/            # saved ResNeXt50 model file (from internship)
utils.py          # frame extraction, image preprocessing helpers
requirements.txt  # Flask, torch, opencv-python, pillow, numpy
```

**Steps**
1. Copy trained ResNeXt50 model file into `model/`
2. Set up basic Flask server that accepts file uploads
3. Build endpoint #1: accepts video → extracts frames → runs through model → returns verdict (real/fake) + confidence score
4. Build endpoint #2: accepts image → runs Error Level Analysis (ELA) → returns tampered/clean verdict
5. Test both endpoints locally via Postman with sample video + image — confirm sensible responses
6. Calibrate tampering-detection threshold using genuine vs. edited samples — compare scores, pick cutoff
7. Write `requirements.txt` listing every package used

---

## PHASE 2 — Backend API Gateway (Weekend 1, second half)

**File structure — `backend/`**
```
server.js           # entry point
routes/              # verification-related routes
models/              # MongoDB schema for verification records
middleware/          # file upload handling, JWT auth (reuse MeetSync pattern)
.env.example         # template of required env vars, no real values
package.json
```

**Steps**
1. Set up basic Express server
2. Connect MongoDB Atlas via connection string
3. Create `Verification` schema: type (video/document), result, confidence score, report text, timestamp, userId
4. Build route: receive file from frontend → forward to Flask ML service → await response
5. Send ML response to Claude API with a short prompt → convert raw score into plain-language fraud report
6. Save combined result (ML output + Claude report) into MongoDB
7. Return combined result to frontend
8. Test full chain via Postman first: file → ML service → Claude → MongoDB → response
9. Set up JWT login/auth reusing MeetSync pattern (per-user history)

---

## PHASE 3 — Frontend (Weekend 2, first half)

**File structure — `frontend/`**
```
Standard Vite + React structure
components/    # Upload, Result Card, History Table
pages/         # Home/Upload, History/Dashboard
api/           # single file with all backend API calls
```

**Steps**
1. Build login/signup page (reuse MeetSync auth UI as base)
2. Build upload page — drag-and-drop for video or document image
3. Build results view — verdict badge (Authentic/Suspicious/Fraudulent), confidence score, Claude's plain-language report
4. Build history/dashboard page — list past verifications for logged-in user
5. Style with TailwindCSS — one accent color, clean spacing, no clutter
6. Connect all pages to backend, test full flow locally: sign up → upload → result → check history

---

## PHASE 4 — Deployment (Weekend 2, second half)

1. Push all three folders to GitHub (one repo or three, your call)
2. Deploy `ml-service` to Render (Python web service) — set start command + env vars
3. Deploy `backend` to Render (Node web service) — env vars: MongoDB URI, Anthropic API key, deployed ML service URL
4. Deploy `frontend` to Vercel — connect repo, set env var for deployed backend URL
5. Test entire live flow end-to-end on deployed URLs (not just local)
6. If Flask ML service is too slow on Render free tier, move it to HuggingFace Spaces instead

---

## Status Tracker
- [x] Phase 0 done
- [x] Phase 1 done  ← `ml-service/app.py` + `utils.py` complete (demo mode if no .pth file)
- [x] Phase 2 done  ← `backend/` Express + MongoDB + Gemini AI reports complete
- [x] Phase 3 done  ← `frontend/` React + Vite + all pages/components complete
- [ ] Phase 4 done  ← Deploy: push to GitHub → Render (backend + ml) → Vercel (frontend)
