# Jamming with Riton

A playful web app for generating creative jam recipes using Gemini.

## Tech Stack
- Backend: Node.js + Express
- Frontend: HTML + CSS + vanilla JavaScript
- Model: `gemini-3-pro-image-preview`

## Run locally
1. `cd server`
2. `npm install`
3. `cp .env.example .env`
4. Edit `.env` and set `GEMINI_API_KEY=...`
5. `npm start`
6. Open `http://localhost:3000`

## API endpoints
- `GET /api/options`
- `POST /api/generate`
- `POST /api/roulette`
