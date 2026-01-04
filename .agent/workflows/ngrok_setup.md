---
description: How to share your local environment via ngrok
---

# Codec UI - Remote Access via ngrok

This workflow allows you to share your running local Codec UI with others via the internet, while keeping your local Ollama instance fully functional.

## Prerequisites
- [x] ngrok installed (`brew install ngrok/ngrok/ngrok`)
- [x] ngrok authenticated (`ngrok config add-authtoken <TOKEN>`)

## Steps

1. **Start the App**
   Ensure both frontend and backend are running normally.
   ```bash
   # Terminal 1 (Backend)
   cd backend && npm run dev
   
   # Terminal 2 (Frontend)
   cd frontend && npm run dev
   ```

2. **Start ngrok Tunnel**
   Open a new terminal and run:
   ```bash
   ngrok http 3000
   ```
   // turbo
   
3. **Share the URL**
   - Copy the `https://xxxx-xxxx.ngrok-free.app` URL shown in the terminal.
   - Send it to your friend/device.
   - **Important**: If they see a "Visit Site" warning page, they must click "Visit Site" to allow the connection.

## Troubleshooting
- **OFFLINE Error**: Ensure `NEXT_PUBLIC_BACKEND_URL` in `frontend/.env` is empty. The app relies on the internal proxy.
- **Mixed Content**: Do not use `http://localhost:3000` via ngrok. Always use the HTTPS URL provided by ngrok.
