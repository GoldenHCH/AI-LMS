# ScholarSync AI — Marketing Site

Static marketing/landing page for ScholarSync AI, built with Vite + React + Tailwind CSS. It is a
standalone site — no backend, no API keys, no dependency on the Canvas course editor app that lives
in the rest of this repository. Fonts, icons, and the product mockup image are all self-hosted; the
only external call the deployed site makes is opening the demo-request form in a new tab.

## Local development

```bash
npm install
cp .env.example .env.local   # then set VITE_DEMO_REQUEST_URL
npm run dev
```

`npm run dev` works without `.env.local` — "Request a Demo" links just render as inert `#` links
(with a console warning) until you set the variable.

## Environment variables

| Variable                 | Required            | Description                                                                 |
| ------------------------ | -------------------- | ----------------------------------------------------------------------------- |
| `VITE_DEMO_REQUEST_URL`  | Yes, for `npm run build` | HTTPS URL every "Request a Demo" control links to (currently a Google Form). |

`npm run build` (and `vite.config.ts` directly) validate this at build time and **fail the build**
if it is missing or not a valid `https://` URL — a broken or absent demo link can't reach a deployed
build. `npm run dev` stays lenient so the app still renders locally without it set.

## Available scripts

- `npm run dev` — start the Vite dev server
- `npm run typecheck` — `tsc --noEmit`
- `npm run build` — typecheck, then build the static site into `dist/`
- `npm run preview` — serve the production build from `dist/` locally
- `npm run clean` — remove `dist/`

## Deploying to Cloudflare Pages

This site deploys independently from the rest of the repo. In the Cloudflare Pages dashboard,
create a project connected to this GitHub repository with:

- **Repository:** `GoldenHCH/AI-LMS`
- **Production branch:** `main`
- **Root directory:** `scholarsync-ai`
- **Build command:** `npm run build`
- **Build output directory:** `dist`
- **Environment variable (Production):** `VITE_DEMO_REQUEST_URL` = the real Google Form URL

Cloudflare Pages automatically builds preview deployments for non-production branches/PRs using the
same settings. The target hostname is the free `scholarsync-ai.pages.dev` subdomain, subject to
availability; a custom domain can be attached later from the same dashboard.

If you change the deployed hostname (e.g. a custom domain), update the canonical/`og:url`/
`twitter:image` URLs hardcoded in [`index.html`](index.html) — they currently point at
`https://scholarsync-ai.pages.dev/`.

## Self-hosted assets

- **Fonts:** Inter and Source Serif 4, via `@fontsource/*` packages imported in
  [`src/index.css`](src/index.css) — no Google Fonts CDN request at runtime.
- **Icons:** [`lucide-react`](https://lucide.dev) SVG components — no icon webfont.
- **Mockup image, favicon, OG image:** static files in [`public/`](public).
