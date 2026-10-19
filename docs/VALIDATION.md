# Verification record — 2026-10-19

Environment: Windows 10, Node.js 24.15.0, Edge browser. Independent ORBIT v0.1.0 at `http://127.0.0.1:4173`. This record does not describe the earlier upstream demo at port 8787.

## Search / media increment — latest checkpoint, 2026-10-19

- `npm test`: **65 passing** (58 TypeScript + 7 server tests); TypeScript/Vite production build passes. New tests cover ID lookup, metadata limits/cache/errors, set grouping and exact-difficulty preservation, storyboard extraction, commands/easing/compact loops, safe paths/image headers and video offsets. Not full game parity tests.
- Edge query **320118** shows **one No title card for 14 standard difficulties**, a real 900px cover and 1.13–6.61 star range. Single-column layout; query **738063** retains the exact difficulty as its set's load target. ArrowDown focused that card. Different sets sharing a numeric ID are separate legitimate matches.
- Added 220ms list expansion and 240ms staggered card fade/slide; reduced-motion opt-out. Browser computed style confirms animation and one grid column. Outside dismissal uses click rather than pointerdown so layout collapse does not swallow the target click. A settled-list Reading-tab click both activated Reading and closed the list.
- Removed the marked intro tagline/index, speed explanation, local-skin explanation and obsolete Auto/video/storyboard footnote. Operational media/error status remains.
- Card selection **738063** loaded No title / Lust's Insane, 288 objects and the correct URL. Typing queries requests metadata only, not archives.
- Full-media archives use separate disk and browser cache keys. The older cached Hexen Noir novideo pack kept its OSB but stripped nearly all images and video. Verified full set **2551985**: **41,739,474 bytes**, **538 storyboard images**, **9,493 sprites**, 31.733s MP4. Edge reports these resources without missing-image warnings.
- Hexen Noir **5662042** native video: readyState=4; map 16,328ms vs video 16.289102s during play. After pause, map stopped at 16,365ms and video paused at 16.364718s. This establishes basic clock/pause wiring, not frame-perfect or subjective A/V certification. Music restored to 50% after temporary muting.
- Seek **57,000ms** displays the actual illustrated/typographic OSB scene beneath skin objects, not the static cover or intro video. Texture decoding is lazy with bounded bitmap/tint caches. Screenshot dim is 25%; app default remains 82%.
- Screenshots: `artifacts/orbit-search-storyboard.jpg` and `artifacts/orbit-background-video.jpg`. No screenshot proves animation smoothness, complete-song playback or performance.
- Remaining: T triggers, storyboard Sample audio, negative-time lead-in, full stable/lazer parity and unsupported video codecs. No transcoder. Full-archive size caps still apply. Public deployment, all-MOD parity and manual local-import acceptance remain separate work.

## Automated / integration

- `npm test`: **23 passing** (20 TypeScript tests + 3 resource-layer tests). Fixtures cover ID handling, CSV, ZIP/path rejection, catalog/asset resolution, legacy SHA-256 binding, curve maths/degeneracy/lengths, SV resets, repeat endpoints/ticks, combos, stacking/mods, density and music/silent-tail clocks.
- `npm run build`: TypeScript check and Vite production build pass.
- `npx tsx scripts/validate-cache.ts`: **15 real difficulties**, across No title and Scarlet Rose; finite geometry and valid object end-time checks pass. This is not visual parity testing.
- `/api/health`: correct independent-engine identity; invalid ID returns 400, foreign Origin returns 403.
- `npm audit --omit=dev --audit-level=high --registry=https://registry.npmjs.org`: 0 reported vulnerabilities in production dependencies at check time. The configured npm mirror's audit API was unsupported; the command-specific registry override did not change npm settings. This is not a complete security audit.
- Windows launcher tested both reuse of an existing ORBIT server and fresh hidden-process startup. Loopback health and saved PID/log files verified.

## Browser acceptance

- ID **738063**, Reol / No title / Lust's Insane: online load, 288 objects (177 circles, 111 sliders), 14 difficulty choices, playback and seek observed; music/sample resources decoded without console errors.
- Switched to **713689**, Celsius' Easy: 105 objects, including a spinner; metadata and selected URL update.
- HR: AR 10 / CS 5.2 / OD 10; switching to EZ clears HR and yields AR 4.7 / CS 2 / OD 4.
- 0.75× selected; marked A=30s, B=34s; playback visibly wrapped back below B; pause/clear succeeded.
- ID **131564**, Lily / Scarlet Rose / 0108 style: original v9 file lacks embedded IDs. Public ID mapping + exact official-file SHA-256 verified in Worker; 725 objects (334 circles, 390 sliders, 1 spinner), 3:11 visual duration, playback and seek observed.
- No assertion that subjective audible sync or complete-song real-time playback has been independently measured.

## Remaining acceptance gaps

- Automated local file chooser selection was blocked by Edge extension's file-URL permission. That permission was **not changed**. Browser import UI exists and its Worker path is covered by synthetic OSZ tests, but manual local-import end-to-end acceptance remains pending.
- Mobile-size layout, complete-song playback, fullscreen, every mod combination, cross-browser codecs, legacy edge cases, exhaustive custom hitsounds and stable/lazer visual parity are not fully accepted.
- FPS shown by the debug badge varied with browser visibility/throttling. No controlled comparison to the upstream renderer, guaranteed 60 FPS claim or memory benchmark is made. The displayed milliseconds time only JavaScript drawing calls, not full GPU/compositor work.
- Public deployment/security hardening, cache freshness/offline metadata resolution and transactional loading remain follow-up work.

Screenshot artifacts illustrate the real independent page, not a performance benchmark or game-client fidelity proof.

## Gameplay skin increment — 2026-10-19

- Supplied Spoo Freedom DiVE `.osk` installed as a local, trimmed default; original file hash rechecked against installation manifest. No skin upload or source overwrite.
- `npm test`: **31 passing** (28 TypeScript + 3 server tests). Additional coverage: CRCRLF INI/options, HD selection, gameplay-only filtering, traversal/missing assets, prototype safety, absolute colour ordinals for 3-colour skins, skin/map audio priority and intentional silent samples. Audio unit tests use a fake context, not listening tests.
- Production build passes. Local skin endpoint returns the selected archive; foreign Origin remains rejected.
- Edge page loaded ID **738063** with **25 decoded skin image variants / 15 sound files**. Real circles, digit sprites, approach circles, grey/black slider body, slider ball/follow circle, glowing cursor and trail observed during playback; timeline advanced from 32s to 41s+ without captured warnings/errors.
- Switching to builtin updates both selector and actual canvas; switching back loads the supplied skin. Colour/sound preference toggles and cursor size 1.00→1.40→1.00 reflected their UI states; defaults restored. Subjective audible similarity/sync was not measured.
- Screenshot: `artifacts/orbit-freedom-dive-skin.png`. New-style spinner variants, full-client layering and all third-party skins are not accepted. Local chooser automation restriction remains as documented above.

## Slider/MOD increment — latest checkpoint, 2026-10-19

- `npm test`: **44 passing** (41 TypeScript + 3 server). New tests cover gradient profile/opacity, snaking and slicing, 48 unique catalogue codes, unavailable MOD protection, conflicts, HR caps/DA overrides, real-time AR/OD equivalents, mirror/Auto agreement, slider-inclusive Auto combo, timing origins, deterministic motion, URL presets and NC drum scheduling/reset/late first timing point.
- Production TypeScript/Vite build passes. NC audio tests use a fake context; they do not establish audible game parity.
- Reinstalled the supplied skin with followpoint animation selection: 176 selected ZIP files, 668,953 bytes; browser decoded **88 image variants and 15 sounds**. Original 65,949,988-byte source SHA-256 still equals the installation manifest: `24c6e5d7a9814f8029d299a6ce0aa30e2e7ac90343baee59458d63ada8ca85ad`.
- Replaced flat black slider strokes with cached translucent gradient bodies, opaque borders/shadows, snaking reveal/final-span retraction, independent HD body fade, visible tick samples and skin followpoint animation. Legacy digit scale corrected to 0.8. Paused preview no longer adds an extra whole-field dimmer or central play symbol.
- Edge ID 738063 at 32s: gradient body, supplied skin circle/ball/follow-circle/digits/cursor observed. MR flips both displayed tracks and Auto; DT shows 1.50x / AR 10.5 / CS 4 / OD 9.8 / BPM 300. NC selection clears DT. NC playback advanced without captured warning/error logs; subjective sound quality was not judged.
- DA input issue caught in browser QA (change-only listeners could lose edits), repaired with validated input events; rechecked AR **8.0** and CS **5.0**. TC displays empty circle bodies and outlined sliders. FL masks the field with a delayed cursor-centred aperture and slider dim. Cinema removes objects/cursor and removes background dim. Reset restores NM.
- Catalogue displays **8 preview-connected / 21 approximate / 14 explanation-only / 5 unavailable**. RD/TP/MG/RP/AS disabled. All lazer parameters, actual input-dependent MOD semantics, exhaustive combinations and parity remain unaccepted. The catalogue is not proof of all-MOD implementation; see MODS.md.
- Screenshots: `artifacts/orbit-slider-v2.png`, `artifacts/orbit-mod-catalog.png`, `artifacts/orbit-traceable-da.png`.

## Workspace UI refresh — 2026-10-19

- Implemented the requested minimal osu! tool style: compact header/search, map identity above the canvas, neutral dark surfaces with a restrained pink accent, readable labels and unified controls.
- Replaced the always-expanded settings column with Reading / Skin / Audio & Visual tabs. Arrow keys wrap between tabs; Home/End select the first/last. Only the active panel is exposed. Slider animation options use native details; Blinds HP is visible only with BL enabled. All 73 pre-existing template IDs remain present and unique.
- No engine, skin-parser, audio-engine, MOD catalogue or server logic was modified. This is not a new compatibility/parity claim.
- `npm test`: **47 passing** (44 TypeScript + 3 server), including three new tab-keyboard unit tests. `npm run build` passes; `/api/health` still identifies the independent engine.
- Edge ID **5662042**, Hexen Noir / Crimson Blood: 1,624 objects, 38 decoded map samples; supplied skin still reports 88 image variants and 15 sounds. Observed paused rendering at 87,299ms with DT (1.50x). Tested playback/pause, seeking, forward jump, A/B mark/clear, skin details disclosure, keyboard tab activation and sound controls. Temporary audio muting was restored to 50% music / hitsounds ON.
- MOD dialog still contains 48 entries, including five disabled unavailable entries. BL enabled its HP control in Audio & Visual; disabling BL hid it again. No exhaustive MOD-combination acceptance was performed.
- Responsive checks at 375x812, 768x1024 and 1440x900: no document horizontal overflow. At 768px Reading settings use two columns below the player; mobile uses one column. The original viewport override was reset. This is desktop-browser viewport simulation, not a physical mobile-device/codec test.
- Fullscreen was attempted through the browser automation, but entry into DOM fullscreen was not observed; fullscreen remains an acceptance gap rather than a pass. Captured warning/error log query returned no entries.
- Actual browser screenshots: `artifacts/orbit-ui-desktop-1440.jpg`, `artifacts/orbit-ui-v2.jpg`, `artifacts/orbit-ui-mobile.jpg`, `artifacts/orbit-ui-tablet.jpg`. Original edited source files were copied to `artifacts/ui-before/` before editing. No deployment, purchases, Git initialization or remote pushes were made.
