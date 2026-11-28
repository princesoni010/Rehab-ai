# Physico Health (Rehab-AI) — Movement Intelligence & Tele-Rehabilitation Platform

[![Status](https://img.shields.io/badge/Status-Active%20Production%20Ready-brightgreen.svg)]()
[![Privacy](https://img.shields.io/badge/Privacy-100%25%20On--Device%20Edge%20Vision-blue.svg)]()
[![Voice AI](https://img.shields.io/badge/Voice%20AI-ElevenLabs%20Multilingual-purple.svg)]()
[![Deep Learning](https://img.shields.io/badge/AI%20Ensemble-PyTorch%20LSTM%20%2B%20Transformer-orange.svg)]()

> **Physico Health** is an intelligent tele-rehabilitation platform that transforms any standard webcam into a real-time personal physiotherapy coach. Designed for post-surgery, stroke, and orthopedic recovery, it delivers sub-50ms exercise form correction, automated repetition counting, and objective 0–100 clinical quality scoring without ever streaming raw patient video to the cloud.

---

## 🌟 Key Highlights & MVP Capabilities

- 🔒 **100% Privacy-by-Design (Edge Computer Vision):** Google MediaPipe runs in-browser via WebAssembly (WASM), computing 33 3D skeletal landmarks locally. Zero raw video frames ever leave the device.
- 🗣️ **Ultra-Realistic AI Voice Coaching (ElevenLabs):** Spoken real-time auditory feedback in Hindi and English *(e.g., "Knees ko straight rakhein", "Slow down the descent")* with offline Web Speech API fallback.
- 🧠 **Hybrid ML Scoring Ensemble:** Combines Deep Learning (PyTorch Bidirectional LSTM + Attention Transformer) with validated deterministic Biomechanical rules (Range of Motion, joint symmetry, hip sway) for explainable 0–100 rep scores.
- ⏱️ **Asymmetric Rehab Tempo Tracking:** Enforces safe rehabilitation dynamics with a $2\times$ safety penalty on fast/jerky repetitions and only $0.5\times$ on slow, controlled eccentric movements.
- 🖐️ **Touchless Gesture Control:** 1-second "Hands-Together" gesture to Start, Pause, or Complete exercises without physically touching the keyboard or mouse.
- 🎬 **Dynamic In-Session Demo Video Player:** Floating, glassmorphic picture-in-picture exercise demonstration video automatically synchronized with assigned regimens.
- 📊 **Doctor Portal & Vector PDF Progress Reports:** Real-time doctor triage dashboard with automated, downloadable clinical progress reports (Matplotlib + ReportLab) plotting ROM trajectories and compliance metrics.

---

## 🏗 System Architecture & Real-Time Pipeline

```
  [ Webcam Capture (30 FPS) ]
              │
              ▼
  [ Google MediaPipe (WASM Edge) ] ── (33 3D Landmarks Extracted)
              │
              ▼ (WebSocket /ws/session ~2 KB/frame)
  [ FastAPI + EMA Landmark Smoother (α=0.5) ]
              │
              ▼ (Hip-Center & Torso Normalization)
  [ Biomechanics Engine (ROM, Tempo & Sway Trackers) ]
              │
              ▼
  [ Hybrid AI Ensemble (LSTM + Transformer + Clinical Rules) ]
              │
     ┌────────┴──────────────────────────┐
     ▼                                   ▼
[ ElevenLabs Voice AI ]       [ MongoDB & Matplotlib PDF ]
(Live Spoken Correction)      (Doctor Portal & Clinical Report)
```

---

## 🛠 Technology Stack

| Layer | Technologies |
| :--- | :--- |
| **Frontend & Vision** | React 18, TypeScript, Vite, Google MediaPipe (`@mediapipe/tasks-vision` WASM), HTML5 Canvas 30 FPS HUD, Tailwind CSS |
| **Real-Time Streaming** | FastAPI (Python 3.12), Uvicorn ASGI, WebSockets (`/ws/session`) |
| **AI / Machine Learning** | PyTorch (Bidirectional LSTM, Attention Transformer), NumPy, SciKit-Learn, EMA Landmark Smoothing |
| **Voice AI & LLMs** | ElevenLabs AI (`eleven_multilingual_v2`), Web Speech API, Google Gemini 2.5 Flash / OpenAI |
| **Database & Security** | MongoDB 7.0, Motor (Async Driver), JWT Authentication, Role-Based Access Control (RBAC) |
| **Reporting & DevOps** | Matplotlib (Agg Engine), ReportLab Vector PDF, Docker, Git/GitHub |

---

## 🚀 Quick Start Guide

### 1. Prerequisites
- [Node.js 20+](https://nodejs.org/)
- [Python 3.12+](https://www.python.org/)
- [MongoDB 7.0](https://www.mongodb.com/try/download/community)

### 2. Backend Setup (`python-server`)
```bash
cd python-server

# Virtual environment setup
python -m venv .venv
# Windows:
.\.venv\Scripts\activate
# Linux/Mac:
source .venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Run server with live reload
uvicorn api_server.main:app --host 0.0.0.0 --port 8000 --reload
```

* API Documentation: `http://localhost:8000/docs`

### 3. Frontend Setup (`web-client`)
```bash
cd web-client

# Install dependencies
npm install

# Run Vite dev server
npm run dev -- --host 0.0.0.0 --port 5173
```

* Web Application: `http://localhost:5173`

---

## 📡 Core API Endpoints

* `POST /auth/register` & `POST /auth/login` — JWT Role-Based Authentication (Patient & Doctor).
* `WS /ws/session` — Low-latency full-duplex WebSocket stream for landmark vectors, gesture triggers, and live coaching feedback.
* `POST /api/tts/speak` — ElevenLabs AI voice synthesis proxy with intelligent server-side caching.
* `GET /patient/progress/pdf` — Generates clinical-grade downloadable PDF progress reports.
* `GET /exercises` — Catalog of guided rehabilitation movement routines.

---

## 📜 License & Compliance
This project is developed for physical therapy tele-rehabilitation and research demonstrations, adhering to strict privacy-first patient data design.
