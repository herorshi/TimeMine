# TimeMine — Frontend

Nuxt 3 (JavaScript) + Tailwind CSS + axios + Pinia + VueUse.

```bash
cp .env.example .env
npm install
npm run dev        # http://localhost:3000
```

- API base URL: `NUXT_PUBLIC_API_BASE` (default `http://localhost:4000/api`)
- axios instance: `useApi()` (plugin `plugins/axios.js`)
- state: Pinia stores in `stores/`
