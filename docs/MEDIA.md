# Search and visual media

## Search

Typing a numeric ID or official URL triggers an exact difficulty-ID and exact set-ID metadata lookup after 350ms. Cards show cover art, song/artist/mapper, difficulty, mirror-provided stars, length, BPM and AR/CS/OD. This is **not** an indexed whole-library numeric-prefix search. Incomplete or nonexistent IDs may have no result.

No archive is downloaded until a result is selected or the form is submitted. Responses are deduplicated and cached for 60s (128 keys), with four concurrent search jobs, 10s upstream timeout and 2MB response limit. Stale browser requests cannot overwrite newer results. Enter chooses the exact difficulty if present, otherwise the first listed difficulty; Up/Down and Escape work in the result list. Covers currently come directly from `assets.ppy.sh`, not from the beatmap download mirror; access depends on that separate host.

## Video

The worker preserves Video events and their archive file. Native HTML video is muted; map music remains authoritative. Time offsets, practice/MOD playback rate, pause, seek, A/B wraps and automatic page-hide pause are synchronized from map milliseconds. A 150ms playing drift threshold corrects native clock drift; paused seeking uses a 15ms threshold. Video end does not truncate the map. Video bytes and object URLs are released on replacement/unload.

Native browser decoding is required: H.264 MP4 and supported WebM work; an AVI/MPEG extension does not imply its codec can be decoded. Unsupported files get an explicit status instead of a fake still-frame success. There is no FFmpeg service or browser-side codec transcoder. Native playback accuracy and codec support vary by OS/browser; no frame-perfect/A-V listening certification is claimed.

Online downloads now request **full archives**, not novideo variants. `.full.osz` uses a separate cache key. The existing 128MB compressed / 384MB extracted / 4,096-file bounds still apply. Oversized full packs must be reduced/re-encoded externally; the app never silently falls back to a video-less pack.

## Storyboard visuals

Independent parser/evaluator for inline `.osu` Events followed by the matching shared `.osb`:

- Sprite / Animation, named/numeric layers and origins; Background → Pass → Foreground below hit objects, Overlay above objects/below cursor.
- Auto uses Pass state, not simultaneous Pass and Fail.
- F, M, MX, MY, S, V, R, C, P(H/V flips and additive blending).
- Easing IDs 0–34, constant/end-time/sequential shorthand and plain text variables.
- Compact L loops, including children with a nonzero initial offset; no huge unrolled arrays.
- Animation frame numbering and LoopForever/LoopOnce.
- 640×480 coordinates, aspect-preserving widescreen extension or central clipping, image origins and background replacement when referenced by the storyboard.
- Deterministic random-access evaluation for scrubbing and loops, independent of prior rendered frames.

Textures decode on demand around the current time, not all at once. Four concurrent decodes, a 96-megapixel bitmap LRU and a 16-megapixel tint cache bound retained decoded textures. Source bytes remain browser-local. Lifetime indexes skip most inactive sprites. No guarantee that pathological simultaneously-visible scenes fit this budget or meet a target FPS.

## Explicit remaining limits

- T hit/input-dependent triggers and nested loops are skipped with a status warning; no fabricated trigger outcomes.
- Storyboard Sample audio is not mixed; map music and ordinary map hitsounds remain available.
- Negative-time intro is parsed but preview starts at 0ms. Extremely old format-specific animation timing, UseSkinSprites, complete stable/lazer lifetime quirks and pixel parity are not certified.
- Missing images, unsupported codecs or decode failures are reported. A numerical sprite/image count means parsed/present resources, not exhaustive visual acceptance of every frame.
- Resource limits: 20,000 sprites, 250,000 compiled commands (including expanded shorthand), 2,048 distinct image assets, 16MB per script. Video/storyboard outro is capped at one hour in the preview timeline.

Specifications checked against official [commands](https://osu.ppy.sh/wiki/en/Storyboard/Scripting/Commands), [general rules](https://osu.ppy.sh/wiki/en/Storyboard/Scripting/General_Rules), [compound commands](https://osu.ppy.sh/wiki/en/Storyboard/Scripting/Compound_Commands) and [shorthand](https://osu.ppy.sh/wiki/en/Storyboard/Scripting/Shorthand). Parameter endpoint and loop semantics were cross-checked with the official osu! decoder/model. No external rendering engine was embedded.
