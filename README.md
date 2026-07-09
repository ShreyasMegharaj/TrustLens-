# TrustLens

**AI-powered deepfake video + document tampering detector**
Stack: React + Vite (frontend) · Express + MongoDB (backend) · Flask + PyTorch (ML service) · Claude API (reports)

---

## Quick Start (Local Development)

### 1. ML Service
```bash
cd ml-service
pip install -r requirements.txt
# Copy your ResNeXt50 model checkpoint to ml-service/model/resnext50_deepfake.pth
cp .env.example .env
python app.py          # runs on http://localhost:5001
```

### 2. Backend
```bash
cd backend
npm install
cp .env.example .env
# Fill in: MONGODB_URI, JWT_SECRET, ANTHROPIC_API_KEY
npm run dev            # runs on http://localhost:5000
```

### 3. Frontend
```bash
cd frontend
npm install
cp .env.example .env   # VITE_API_URL=http://localhost:5000/api
npm run dev            # runs on http://localhost:5173
```

---

## Environment Variables

### `backend/.env`
| Variable | Description |
|---|---|
| `MONGODB_URI` | MongoDB Atlas connection string |
| `JWT_SECRET` | Long random string for JWT signing |
| `ANTHROPIC_API_KEY` | From console.anthropic.com |
| `ML_SERVICE_URL` | URL of the running Flask ML service |
| `FRONTEND_URL` | Frontend URL (for CORS) |

### `ml-service/.env`
| Variable | Description |
|---|---|
| `PORT` | Port to run Flask on (default: 5001) |
| `FLASK_ENV` | `development` or `production` |

### `frontend/.env`
| Variable | Description |
|---|---|
| `VITE_API_URL` | Backend API base URL |

---

## ML Model

Place your trained `resnext50_deepfake.pth` checkpoint in `ml-service/model/`.

The app runs in **demo mode** if no model file is found (returns placeholder results).

The model should be a binary ResNeXt50_32x4d classifier:
- Class 0 → Real
- Class 1 → Fake

---

## API Endpoints

### Backend
| Method | Path | Auth | Description |
|---|---|---|---|
| POST | `/api/auth/signup` | ✗ | Register |
| POST | `/api/auth/login` | ✗ | Login |
| GET | `/api/auth/me` | ✓ | Current user |
| POST | `/api/verify` | ✓ | Analyse file |
| GET | `/api/verify/history` | ✓ | User history |
| GET | `/api/verify/:id` | ✓ | Single record |

### ML Service
| Method | Path | Description |
|---|---|---|
| POST | `/analyze/video` | Deepfake detection |
| POST | `/analyze/document` | ELA tampering detection |
| GET | `/health` | Health check |

---

## Deployment

| Service | Platform |
|---|---|
| Frontend | Vercel |
| Backend | Render (Node web service) |
| ML Service | Render (Python web service) or HuggingFace Spaces |
| Database | MongoDB Atlas (free tier) |

See `PHASE 4` in `trustlens-build-plan.md` for full deployment steps.

---

## Chrome Extension

The `extension/` folder contains a Manifest V3 Chrome/Edge extension.

### Features
- **Auto-screenshot on open** — click the toolbar icon → instantly captures + analyzes current page
- **Right-click any image** → "🔍 Check with TrustLens" → instant verdict
- **Settings panel** — configure ML service URL (switch between local and deployed)
- **"View History" link** — opens your TrustLens web app history page

### Install (Developer Mode)
1. Open Chrome → go to `chrome://extensions/`
2. Enable **Developer mode** (toggle top-right)
3. Click **Load unpacked** → select the `extension/` folder
4. The TrustLens icon appears in your toolbar ✅

### Configure for Deployment
After deploying your services, open the extension → click ⚙️ Settings:
- **ML Service URL** → your Render ML service URL (e.g. `https://trustlens-ml.onrender.com`)
- **Website URL** → your Vercel frontend URL (e.g. `https://trustlens.vercel.app`)

