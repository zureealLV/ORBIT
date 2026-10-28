# Cloudflare Pages integration

The same ORBIT frontend supports both local/LAN use and an independent cloud deployment.

## Build for a blog subpath

Build with `vite build --base=/orbit/` and environment variables:

- `VITE_ORBIT_API_BASE=/api/orbit/`
- `VITE_ORBIT_POLL_PROGRESS=false`

The blog builds a pinned ORBIT Git revision, copies its generated `dist/` into the blog's generated `dist/orbit/`, and bundles `cloudflare/api.mjs` into a Pages Function mounted at `/api/orbit/*`. Nothing points to the local computer. Keep the blog's root `functions/` outside the Astro output directory. Restrict Functions invocation with `_routes.json` so static blog requests do not invoke it.

Allow `blob:` media in the app's Content Security Policy: archive music/video is decoded in the browser. Exclude `/orbit/` from Swup navigation so its full document and Worker initialize normally. Shared URLs retain `/orbit/`.

## Cloud behavior and boundaries

- Official `.osu` metadata is bounded to 2 MB and validated against the requested difficulty. Legacy IDs are bound to the SHA-256 of exact official bytes, not guessed.
- Numeric metadata searches use Sayobot. Archive downloads try Sayobot, then Nerinyan. Third-party availability and content remain outside ORBIT's control.
- Archives are signature-checked and streamed with backpressure and a 128 MB cap. No archive is buffered or unzipped in the Worker; parsing/rendering stays in the browser.
- A failed upstream during an already-started stream requires retrying; it cannot transparently switch mirrors halfway through the response.
- Best-effort per-isolate rate guards are not a distributed quota, authentication, or a billing cap. No new paid plan, R2 bucket, storage binding, or tunnel is required by this implementation. It still consumes the existing account's Functions quota under that account's plan.
- There is no persistent archive cache or cross-request download progress in the cloud. Polling is disabled in the cloud build to avoid wasting Functions requests. Small, short-lived metadata cache entries contain only IDs/checksums.
- Built-in skin and browser-local `.osk` import remain available. Private `.cache/skins/default.osk` and beatmap caches are deliberately NOT uploaded.
- Only same-origin read APIs are exposed. User-supplied URLs cannot select proxy destinations; no wildcard CORS is enabled.
- Local `.osz`/`.osk` files stay in the browser. A successful build or mocked tests alone do not establish live upstream availability or mobile-browser compatibility.
