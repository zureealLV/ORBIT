# Implementation route

## Existing demo versus ORBIT

The researched `2710165659/osu-beatmap-preview` v1.5.1 uses a Node resource layer, Vue UI, Rust/WASM beatmap processing and WebGPU rendering. Reusing that engine is a valid fast route, but it couples rendering/debugging to a larger multi-language graphics pipeline.

ORBIT is independently implemented in TypeScript with Canvas 2D. This trades advanced GPU rendering and client fidelity for a smaller editable codebase and a lower graphics API requirement. It is not inherently faster: dense-slider performance and client compatibility still need measurement.

```text
ID / official link                 local .osz
        |                              |
Node loopback resource API              |
official .osu -> set ID                 |
Sayobot -> Nerinyan fallback            |
bounded disk cache                     |
        +------------ bytes -----------+
                         |
                Web Worker + fflate
                catalog -> selected .osu
                         |
           independent parser and slider geometry
                         |
        HTMLAudio clock --+-- Canvas2D renderer
                         +-- WebAudio hitsound scheduler
                         +-- density/seek/A-B/UI
```

## Source map

| Source | Responsibility |
|---|---|
| `server/index.mjs` | Loopback HTTP, static/Vite hosting, API and host/origin restrictions |
| `server/resources.mjs` | Numeric ID validation, official metadata, mirror fallback, bounded downloads/cache |
| `server/search.mjs` | Bounded/cached exact difficulty + set metadata lookup; no archive download on keystrokes |
| `src/search.ts` | Debounce, stale-response protection, accessible cover/result cards |
| `src/engine/storyboard.ts` | Independent OSB parser, easing/loop/property evaluation and frame selection |
| `src/engine/scene.ts` | On-demand bitmap LRU, storyboard layer composition and music-master native video sync |
| `src/input.ts` | Official link and single-difficulty ID validation |
| `src/archive.worker.ts` | ZIP resource filtering, size/path limits, standard catalog and selected assets |
| `src/engine/parser.ts` | Sections, timing/SV, sample sets, combos, objects, ticks and stacking |
| `src/engine/geometry.ts` | Adaptive Bezier, segmented anchors, circular arcs, uniform Catmull-Rom, arc length |
| `src/engine/playback.ts` | Object position, ping-pong repeats, display transforms and Auto travel |
| `src/engine/renderer.ts` | Canvas paths, visible window, layers, HD fade, cursor/trail and spinner |
| `src/engine/audio.ts` | Music-master clock, silent tail, rate-aware lookahead hitsounds |
| `src/main.ts` | Search/import flow, DOM controls, seek/loop and frame scheduling |

## Implemented optimizations

- Decompress and parse off the UI thread; catalog scanning does not compute every difficulty's slider paths.
- Geometry and Path2D calculated before playback rather than rebuilt per frame.
- Binary search on starts and prefix maximum ends skips most offscreen objects (a very long slider can widen this window).
- Cap render resolution/DPR; skip unchanged paused frames and density charts.
- Music currentTime is the primary clock; playback does not accumulate animation-frame deltas. Silent tail preserves notes after short music ends.
- Audio lookahead is independent of DOM refresh, resets on seek/rate/pause, and avoids a burst after suspension.
- Cache archive bytes, deduplicate same-ID requests, bound download concurrency and archive size.
- Legacy files without embedded IDs use the public Sayobot mapping, then exact SHA-256 verification against the official file; a stale/non-matching archive is rejected rather than silently opening a different difficulty.
- System font fallback, no external font request or telemetry.

## Next improvements, in order

1. Build a stable/lazer reference-map corpus: compare paths, head/tail coordinates, timing, stack heights and screenshots. Add deterministic goldens for legacy formats, negative-time objects, pathological sliders, SV transitions and custom sample lookup.
2. Make archive loading transactional/cancellable; improve stale mirror detection, cache freshness and metadata caching so cached maps can load offline. Current cache does **not** provide offline ID lookup.
3. Slider bodies now use a bounded pre-rasterized gradient texture cache. Consider background caching or optional WebGL only if measured dense-map frame time warrants it. Measure real foreground frame pacing and memory before changing APIs.
4. DT/HT-aware equivalent AR/OD and the MOD catalogue are now present; complete experimental parameters, input-dependent MODs, HD/slider end-tick parity and sample rules remain pending. See MODS.md.
5. For public hosting, separate authenticated/rate-limited resource delivery, cache quotas/expiry and monitoring from the renderer. Current loopback server is not a production deployment design.

## References (specification research, not embedded renderers)

- [Official .osu format](https://osu.ppy.sh/wiki/en/Client/File_formats/osu_(file_format))
- [ppy SliderPath](https://github.com/ppy/osu/blob/master/osu.Game/Rulesets/Objects/SliderPath.cs)
- [ppy osu! beatmap processor](https://github.com/ppy/osu/blob/master/osu.Game.Rulesets.Osu/Beatmaps/OsuBeatmapProcessor.cs)
- [ppy curve approximation reference](https://github.com/ppy/osu-framework/blob/master/osu.Framework/Utils/PathApproximator.cs)
- [Previously demonstrated project](https://github.com/2710165659/osu-beatmap-preview)

Reading these rules does not establish full parity; ORBIT's approximation/resampling, visuals and Auto movement are its own implementation.

## Media increment

See [MEDIA.md](MEDIA.md) for supported commands, bounds, native codec limitations, and remaining game-parity gaps. Full-media archives have separate `.full.osz` disk cache names and a versioned browser request URL; old novideo caches are not reused for video/storyboards.
