# Paperloom frontend

The React interface for Paperloom's research library, community blogs, and
author/admin dashboards. Built with Vite, TailwindCSS, and React Router.

## Development

Use Node.js 22.12+ (or a newer supported release).

```bash
npm ci
npm run dev
```

The development server proxies `/api` to `http://localhost:5000`. Set
`VITE_API_URL` in `.env` to use another backend; see `.env.example`.

```bash
npm run build
npm run lint
```

## UI components

React Bits' BlurText and SpotlightCard are adapted in
`src/components/ReactBits/`, with reduced-motion support and shared styles in
`src/index.css`. Publication cards are reused across the home and browse pages.
The original license and attribution are in `public/third-party-licenses.txt`
and are included in production builds.
