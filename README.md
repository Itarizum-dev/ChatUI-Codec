# CODEC Chat UI - Retro Sci-Fi AI Interface

[日本語版 (Japanese Version)](./README.ja.md)

An immersive AI chat interface inspired by retro-futuristic wireless communicators (CODEC).
Communicate with local LLMs (Ollama) as well as major AI models like Gemini, Claude, and OpenAI. It supports advanced agent features such as **MCP (Model Context Protocol)** and **Agent Skills**.

![Codec UI Screenshot](/frontend/public/og-image.png?raw=true)

## Features
- 🤖 **Multi-LLM Support**: Full support for Google Gemini, Anthropic Claude, OpenAI, and local Ollama. (Cloud LLMs require separate API keys)
- 🛠 **MCP (Model Context Protocol)**: Supports Claude Desktop-compatible MCP. Infinitely extend AI capabilities with web search, file operations, GitHub integration, and more.
- ⚡️ **Agent Skills**: Define procedures in `SKILL.md` (Markdown) to allow the AI to autonomously execute complex tasks.
- 📟 **Retro Aesthetics**: An immersive retro UI experience involving scanlines, monochrome green, and pixel art.
- 🏠 **Local First**: Runs locally with Ollama + Docker, ensuring privacy.

## Feature Guide

### ⚙️ MCP (Model Context Protocol)
Toggle with the **"MCP ON/OFF"** button.
Allows AI to safely use external tools via the standardized "MCP" protocol.
- Manage connected MCP servers via the settings button at the bottom right.
- Enables agent-like behaviors such as file system operations, browser control, and database connections.

### ⚡️ Skills
Teach the AI specific task procedures.
Simply place a Markdown file (`SKILL.md`) in the `/skills` directory, and the AI will understand and execute the procedure.
- Examples: Automating routine tasks like document creation, code review, and data analysis.
- Type `/skill` in the chat to see a list of available skills.

### 👥 Persona Switching (Frequency)
The right panel displays communication channels by Frequency.
Click to instantly switch the AI's tone and role (Persona).
- **140.85 (Tactical)**: A calm and composed field professional.
- **141.12 (Command)**: A commander type giving precise instructions.
- **141.80 (Science)**: An engineer type excelling in technical explanations.

### 🧠 Thinking Mode
Toggle with the **"🧠 ON/OFF"** button (supported models only).
Supports Chain of Thought models like DeepSeek-R1 and Qwen, initializing a visual "log of thoughts" leading up to the AI's response.

## Requirements
- **Docker Desktop**: Recommended (Launch with a single command)
- Or **Node.js**: v18+ (For manual setup)
- **Ollama**: If using local LLMs

## Quick Start (Using Docker) 🐳

If Docker Desktop is installed, you can launch with just the following commands:

```bash
# 1. Clone the repository
git clone https://github.com/Itarizum-dev/ChatUI-Codec.git
cd ChatUI-Codec

# 2. Configure environment variables
cp backend/.env.example backend/.env
# Edit backend/.env and enter necessary API keys (Google, Anthropic, etc.)

# 3. Build & Run
docker compose up --build
```

Access [http://localhost:3000](http://localhost:3000) in your browser to start.

### How to Stop
```bash
docker compose down
```

### Using Ollama
To use local Ollama with the Docker version, **Ollama must be running on the host side (Mac/Windows/Linux)**.
Docker Compose is configured to automatically connect to the host's Ollama via `host.docker.internal`.

---

## Manual Setup (Using Node.js)

If not using Docker, follow these steps:

### 1. Clone the repository
```bash
git clone https://github.com/Itarizum-dev/ChatUI-Codec.git
cd ChatUI-Codec
```

### 2. Configure environment variables
Prepare `.env` files for both Backend and Frontend.

**Backend (API Keys, etc.)**
```bash
cd backend
npm install
cp .env.example .env
# Edit .env and enter necessary API keys (Google, Anthropic, etc.)
```

**Frontend (UI Settings)**
```bash
cd ../frontend
npm install
cp .env.example .env
# Generally, no changes are needed
```

### 3. Launch the Application
Start Backend and Frontend in separate terminals.

**Terminal 1 (Backend)**
```bash
cd backend
npm run dev
```

**Terminal 2 (Frontend)**
```bash
cd frontend
npm run dev
```

Access [http://localhost:3000](http://localhost:3000) in your browser to start.

## External Access (ngrok)
Use `ngrok` to show your screen to a friend or access from a smartphone.

1. Install and authenticate [ngrok](https://ngrok.com/download).
2. While the app is running, execute the following in a new terminal:
   ```bash
   ngrok http 3000
   ```
3. Access the displayed `https://...` URL.
(Caution ⚠️) Exposing APIs to the public can be dangerous.

## 🚀 Persona Setup (Initialization)

Immediately after installation, only the AI Assistant (SYSTEM) and You (ME) are displayed.
To chat with the default characters, copy the persona data using the following command:

```bash
cp frontend/public/data/personas.sample.json frontend/public/data/personas.json
```

### Customization
You can edit the created `personas.json` to change character settings or add new personas (Private settings are possible as this file is ignored by Git).
You can basically customize within the app, but since it saves to browser storage, edit the file directly if you want to use it in a different environment.

## License
MIT License
