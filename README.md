# LLM Playground OS

[![License: MIT](https://img.shields.io/badge/License-MIT-emerald.svg)](LICENSE)
[![Nuxt](https://img.shields.io/badge/Nuxt-4-00DC82?logo=nuxt.js&logoColor=white)](https://nuxt.com)
[![Vue](https://img.shields.io/badge/Vue-3-4FC08D?logo=vue.js&logoColor=white)](https://vuejs.org)

Open-source **multi-LLM playground** for developers and AI enthusiasts. Design prompts with dynamic variables, run them in parallel against up to 4 models, and compare responses with real-time metrics — all **local-first** in your browser.

![LLM Playground OS](https://img.shields.io/badge/Status-MVP-blue)

## Features

- **Multi-provider support** — OpenAI, Anthropic, Google Gemini, Groq, and local Ollama
- **Parallel execution** — Compare up to 4 models side-by-side in a responsive grid
- **Variable engine** — Use `{{variable_name}}` syntax with auto-generated input fields
- **Real-time metrics** — Latency, TTFT, token counts, and estimated cost per model
- **Local-first API keys** — Stored in browser localStorage, never persisted server-side
- **Code exporter** — Generate snippets for JavaScript, Python, cURL, and PHP
- **History & library** — Save prompts with versioning and browse past executions

## Quick Start

```bash
git clone https://github.com/ale94lko/llm-playground-os.git
cd llm-playground-os
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### Configure providers

1. Go to **Settings** and add your API keys (or Ollama URL for local models)
2. Select models in the **Playground**
3. Write your prompt with optional `{{variables}}`
4. Click **Run All**

> **Ollama tip:** Install [Ollama](https://ollama.com) and run `ollama pull llama3.2` — no API key needed.

## Deploy

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/ale94lko/llm-playground-os)

## Tech Stack

| Layer | Technology |
| :--- | :--- |
| Framework | Nuxt 4 (Vue 3 Composition API) |
| Styling | Tailwind CSS v4 |
| State | Pinia + persistedstate |
| Icons | Lucide Vue |
| Server | Nitro proxy for CORS-free streaming |

## Project Structure

```text
app/
├── components/
│   ├── ui/              # Base UI components
│   ├── playground/      # Prompt editor, model selector, response cards
│   ├── settings/        # API key manager
│   └── layout/          # Header navigation
├── composables/         # LLM streaming, cost calculator, code exporter
├── pages/               # Playground, history, settings
├── stores/              # Provider & prompt state (persisted)
└── server/api/          # Stream proxy endpoint
```

## Contributing

Contributions are welcome! Please open an issue first to discuss what you'd like to change.

1. Fork the repo
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes
4. Push and open a Pull Request

## License

MIT © [Fidel Alejandro Fernandez Arias](LICENSE)
