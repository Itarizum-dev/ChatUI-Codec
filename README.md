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
# Copy .env.example to .env and add your API keys
cp .env.example .env
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

## Ollama Configuration

By default, the backend connects to Ollama at `localhost:11434`. If you're running the backend inside a devcontainer, you'll need to update the `.env` file:

```bash
# In backend/.env
OLLAMA_HOST=host.docker.internal:11434
```
