# CODEC Version History

## v0.2.1 - Gemini 2.5 Flash Fix (2025-12-13)
- **Bug Fix**: Gemini 2.5 Flashモデル名を修正 (`gemini-2.0-flash-exp` → `gemini-2.5-flash`)
- **Character**: 新キャラクター「Me」（敵兵ポートレート）を追加
- **UI**: 左側キャラクター表示の調整

## v0.2.0 - UI Redesign & Features (2025-12-12)
- **UI Redesign**: Authentic Metal Gear 2 Codec interface
  - Dual-portrait layout
  - Simplified frequency display
  - "Config" modal for independent Character and LLM selection
- **Character Portraits**: Added custom 8-bit MSX2 pixel art for Snake, Colonel, and Otacon
- **Providers**: Added Google Gemini Pro support
- **Experience**: Enhanced CRT effects and green monochrome filters

## v0.1.0 - Initial Setup (2024-12-12)
- Next.js 14 project structure with TypeScript
- Dev Container configuration for Node.js 20
- MGS2 Codec-inspired UI design with CRT effects
- Multi-LLM provider support (Ollama, Claude)
- Character personas (Snake, Colonel, Otacon) with frequency-based selection
- Chat API route with token tracking and latency measurement
- Debug panel for performance metrics
