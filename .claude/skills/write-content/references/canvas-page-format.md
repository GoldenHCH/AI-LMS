# Canvas Pages API — write payload

Endpoint: `POST /api/v1/courses/:course_id/pages` (create) or `PUT /api/v1/courses/:course_id/pages/:url_or_id` (update). Body wraps everything in `wiki_page`.

```json
{
  "wiki_page": {
    "title": "Photosynthesis: The Light-Dependent Reactions",
    "body": "<h2>Why this matters</h2><p>...</p>",
    "published": false,
    "front_page": false,
    "editing_roles": "teachers",
    "notify_of_update": false
  }
}
```

| Field | Type | Notes |
|---|---|---|
| `title` | string, required | page URL slug is derived from it by Canvas |
| `body` | string (HTML), required for our output | Canvas-safe HTML only — see below |
| `published` | boolean | ALWAYS `false` from this skill; professor publishes after review |
| `front_page` | boolean | leave `false`; setting it swaps the course home page |
| `editing_roles` | enum: `teachers`, `students`, `members`, `public` | default `teachers`; comma-combinable |
| `notify_of_update` | boolean | `false` — don't spam enrolled students |

## Canvas-safe HTML

Canvas sanitizes page bodies with a tag allowlist. Anything outside it is stripped at render — the content silently disappears or degrades, which reads as a broken page to the professor.

Use: `h2`–`h4` (never `h1` — the page title renders as the h1), `p`, `ul`/`ol`/`li`, `table`/`thead`/`tbody`/`tr`/`th`/`td`, `blockquote`, `strong`, `em`, `code`, `pre`, `a href`, `img` (with `alt`), `hr`, `details`/`summary` (collapsible self-checks), `div`/`span` with simple inline `style`.

Never use: `<script>`, `<style>` blocks, `on*` event-handler attributes, `<form>`/`<input>`, `<iframe>` (only allowlisted LTI domains survive — don't rely on it). The validator rejects script tags and event handlers outright.

Internal course links: link other Canvas pages by their page URL (`/courses/:course_id/pages/page-slug`). When the target page is also being generated in this batch, use the slugified title and note it in your review summary so the professor knows the link lands after upload.
