# Fuelify Local Integration Runbook


This runbook is for running both repos locally and validating the core backend/frontend wiring.


## 1. Current Workspace Status


- `fuelify-backend` is implemented and installs successfully.
- `fuelify-frontend` is implemented and passes `next build`.
- Local startup currently requires a reachable MongoDB URI.


## 2. Prerequisites


- Node.js 20+ (22 is fine)
- npm 10+
- MongoDB reachable from `fuelify-backend/.env` (`MONGODB_URI`)


## 3. Environment Files


Already created:


- `fuelify-backend/.env`
- `fuelify-frontend/.env.local`


Update these before running in non-dev environments.


## 4. Install Dependencies


```powershell
cd fuelify-backend
npm install


cd ..\fuelify-frontend
npm install
