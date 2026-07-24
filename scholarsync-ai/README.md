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

## Deploying to GitHub Pages

This site deploys independently from the rest of the repo, via
[`.github/workflows/deploy-landing.yml`](../.github/workflows/deploy-landing.yml). The workflow
builds `scholarsync-ai/` and publishes `dist/` to GitHub Pages on every push to `main` that touches
this directory (or on manual `workflow_dispatch`). Nothing else in the repository is deployed.

Live URL: **https://goldenhch.github.io/AI-LMS/**

One-time setup in the GitHub UI:

1. **Settings → Pages → Build and deployment → Source: GitHub Actions.**
2. **Settings → Secrets and variables → Actions → Variables → New repository variable:**
   `VITE_DEMO_REQUEST_URL` = the real demo-request form URL. The build fails loudly if it is
   missing or not HTTPS, so a deploy with dead CTAs is not possible.

Because a GitHub Pages *project* site is served from a subpath (`/AI-LMS/`), the workflow builds
with `VITE_BASE_PATH=/AI-LMS/`. Locally, `npm run dev` and `npm run preview` default to `/`; to
reproduce the deployed subpath exactly, run `VITE_BASE_PATH=/AI-LMS/ npm run preview` and open
`http://localhost:4173/AI-LMS/`.

Note that GitHub Pages on a **private** repository requires a paid GitHub plan. If Pages is
unavailable, the same workflow drops unchanged into a separate public repo for this site — only
`VITE_BASE_PATH` and the absolute URLs below need to change.

If you change the deployed hostname or path (a custom domain, a different repo name), update
`VITE_BASE_PATH` in the workflow **and** the canonical / `og:url` / `og:image` / `twitter:image`
URLs hardcoded in [`index.html`](index.html) — they currently point at
`https://goldenhch.github.io/AI-LMS/`.

## Self-hosted assets

- **Fonts:** Inter and Source Serif 4, via `@fontsource/*` packages imported in
  [`src/index.css`](src/index.css) — no Google Fonts CDN request at runtime.
- **Icons:** [`lucide-react`](https://lucide.dev) SVG components — no icon webfont.
- **Mockup image, favicon, OG image:** static files in [`public/`](public).
