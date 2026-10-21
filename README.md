# NariShield.ai — Smart Women’s Safety Web Platform

Production-grade, full-stack safety tech web platform built with a modern React frontend and Node.js + Express backend, integrated with **Firebase Authentication**, **Cloud Firestore**, and **Advanced Safety Features**.

---

## 🚀 Live Services & Documentation URLs

- **Web Dashboard**: `http://localhost:5174` (or `http://localhost:5173`)
- **Swagger API Documentation**: `http://localhost:5000/api-docs`
- **OpenAPI 3.0 Specification**: `http://localhost:5000/api-docs.json`
- **API Health Check**: `http://localhost:5000/api/v1/health`

---

## 🛡️ Completed Safety Features

### 1. 🚨 Emergency Siren Sound
- **Web Audio API Dual-Tone Synthesizer**: Generates genuine acoustic wailing emergency deterrent tone locally in the browser.
- **Controls**: Play, Stop, dynamic volume slider (0-100%), and instant Mute toggle.
- **Safety Disclaimer**: Explicitly informs the user that acoustic siren playback is an immediate deterrence tool and does not replace official emergency services.
- **Overlapping Prevention**: Automatically clears prior audio contexts before starting new instances.

### 2. ⏱️ Safety Check-In Timer
- **Journey Monitoring**: 5, 15, 30, or 60-minute duration selections with destination tracking.
- **Actions**: "I'm Safe" (completed), "+15 Mins" (extend), and "End Journey" (cancel).
- **Backend Expiry Worker**: Node.js background process continuously evaluates expired check-ins and marks missed journeys safely.

### 3. 📄 Emergency Incident Reports & PDF Export
- **Confidential Statements**: Category (Harassment, Stalking, Theft, Medical, Unsafe Environment), landmark/coordinates, and formal report indicators.
- **PDF Export (`/api/v1/incidents/:id/pdf`)**: Direct binary PDF download generated via `pdfkit` complete with official headers, timestamps, and compliance disclaimers.

### 4. 👥 Safety Circle
- **Consent-Based Guardians**: Secure invitation workflow.
- **Granular Sharing Permissions**: Independent toggles for Journey Status, Distress SOS Alerts, and Real-Time GPS Geolocation sharing.

### 5. 🏥 Nearby Emergency Resources
- **Verified Directory**: Police stations, trauma centers, and women helpline desks (1091/112).
- **Directions & Calling**: One-click Google Maps turn-by-turn directions and direct telephone links.

### 6. ✨ AI Safety Planner
- **Predictive Checklists**: Generates tailored pre-departure checklists and situational precautions based on commute type, destination, departure time, and transport mode.
- **Resilient Fallback**: Rule-based safety model guarantees instant synthesis even when third-party AI keys are unconfigured.

---

## 🧪 Testing

Run backend unit tests:
```bash
cd backend
npm test
```
All 6 test suites pass (Check-In calculation, Incident ownership isolation, Safety circle permission boundaries, AI fallback, SOS idempotency, Contact limit cap).

Build frontend:
```bash
cd frontend
npm run build
```
Vite production build succeeds.
