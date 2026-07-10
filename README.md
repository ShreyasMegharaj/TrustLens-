# 🔍 TrustLens

> **TrustLens is an AI-powered platform designed to combat misinformation by detecting deepfake videos and document tampering in real-time.** 

---

## 📖 About The Project

In an era of rampant misinformation and AI-generated media, distinguishing fact from fiction is harder than ever. **TrustLens** is a full-stack AI application and browser extension that helps users quickly verify the authenticity of digital media. 

Whether you are browsing the web, reading an article, or analyzing a document, TrustLens acts as your personal forensic assistant—giving you instant, AI-backed verdicts and detailed reports.

### 🌟 Key Features
- **Deepfake Video Detection:** Upload videos to detect AI-generated face manipulations using a state-of-the-art ResNeXt50 neural network.
- **Document Tampering Analysis:** Detects image forgery and pixel-level tampering in documents and screenshots using Error Level Analysis (ELA).
- **Comprehensive AI Reports:** Integrates with Anthropic's Claude API to provide human-readable, detailed explanations of the forensic findings.
- **Real-Time Browser Extension:** A Chrome/Edge extension that allows users to right-click any image on the web or take instant screenshots to verify authenticity on the fly.
- **User Dashboard & History:** Secure user authentication with a dashboard to view the history of past verifications and analyses.

---

## 🧠 How It Works (Under the Hood)

TrustLens is built with a modern, microservice-inspired architecture to ensure scalability and performance. Here is how the different pieces work together:

1. **The Client (React Frontend & Browser Extension):** 
   Users interact with a sleek, responsive React (Vite) web app or the lightweight Chrome extension. When a user submits an image or video, the client sends it to our Backend API.

2. **The Brain (Node.js Backend):** 
   Our Express server handles user authentication (JWT), talks to the MongoDB database to save user history, and securely orchestrates requests between the frontend, the ML Service, and the Claude API.

3. **The Engine (Python/PyTorch ML Service):** 
   This is the core forensic engine running on Flask. 
   - For **videos**, it extracts frames and runs them through a `ResNeXt50` deep learning model trained specifically for deepfake detection.
   - For **images/documents**, it performs Error Level Analysis (ELA) to highlight areas that have been digitally altered.

4. **The Analyst (Claude API):** 
   The backend takes the raw statistical output from the ML Service (e.g., confidence scores, anomaly rates) and passes it to Anthropic's Claude API. Claude translates these numbers into an easy-to-understand, detailed forensic report for the user.

---

## 🛠️ Tech Stack

- **Frontend:** React, Vite, CSS
- **Backend:** Node.js, Express.js
- **Database:** MongoDB Atlas
- **Machine Learning:** Python, Flask, PyTorch (ResNeXt50)
- **AI Integration:** Anthropic Claude API
- **Browser Extension:** Manifest V3 (Chrome/Edge), JavaScript

---

## 🚀 Quick Start (For Developers)

*(If you're a developer looking to run this locally, follow these steps!)*

### 1. Start the Machine Learning Service
```bash
cd ml-service
pip install -r requirements.txt
cp .env.example .env
python app.py # Runs on http://localhost:5001
```
*(Note: Place your trained `resnext50_deepfake.pth` checkpoint in `ml-service/model/`)*

### 2. Start the Backend API
```bash
cd backend
npm install
cp .env.example .env # Fill in MONGODB_URI, JWT_SECRET, ANTHROPIC_API_KEY
npm run dev # Runs on http://localhost:5000
```

### 3. Start the Frontend
```bash
cd frontend
npm install
cp .env.example .env # VITE_API_URL=http://localhost:5000/api
npm run dev # Runs on http://localhost:5173
```

### 4. Load the Chrome Extension
1. Open Chrome and go to `chrome://extensions/`
2. Enable **Developer mode**
3. Click **Load unpacked** and select the `extension/` folder in this repository.

---

## 📈 Future Scope & Improvements
- Expanding model capabilities to detect audio deepfakes.
- Implementing a caching layer (Redis) for frequently analyzed public URLs.
- Open-sourcing the base dataset for community-driven model improvements.

---
*Created by a passionate developer bridging the gap between AI and digital trust.*
