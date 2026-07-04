# MediQuery RAG frontend

## Commands

```bash
npm install
npm run dev       # development server on port 5173
npm run lint      # ESLint
npm run build     # type-check and production build
npm run preview   # serve the production bundle
```

Copy `.env.example` to `.env` before development.

```env
VITE_API_BASE_URL=http://127.0.0.1:8000
```

Start the FastAPI backend on port 8000 before running the frontend. The frontend never receives provider API keys.
