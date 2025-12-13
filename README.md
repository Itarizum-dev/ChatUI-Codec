# Codec Chat UI

This project has been restructured into two parts:

- **frontend/**: Next.js application (UI).
- **backend/**: Node.js Express application (Chat Logic).

## Getting Started

You need to run both the frontend and backend services.

### 1. Start Backend
```bash
cd backend
npm install
npm run dev
```
Runs on `http://localhost:3001`.

### 2. Start Frontend
```bash
cd frontend
npm install
npm run dev
```
Runs on `http://localhost:3002` (or 3000 if available).

## Architecture

The frontend handles the UI and connects to the backend API at `http://localhost:3001/api/chat`.
The backend handles communications with LLM providers (Ollama, Anthropic, Google).
