# Aura Math typography refresh — proposed plan for one Claude review

**Prepared:** 2026-10-05 by Codex's typography agent. **Status:** implemented after single review R-64–R-74; final integration verification recorded in handover. The user likes the playful layout and palette but finds the current Georgia/Times headings dated. Keep the current colours, illustrations and information architecture.

## Recommendation

Use **Outfit** for display headings, topic names and the Aura Math wordmark, paired with **Atkinson Hyperlegible Next** for lesson text, buttons, navigation, author controls and numerals. Outfit's geometric shapes should give the illustrated homepage a fresher voice; Atkinson Next was designed by Braille Institute for distinct letterforms and numerals. Those are design reasons to *trial* the pair, not evidence that it improves learning or that all children prefer it. If the paired fonts look too disparate in the real lesson, use Atkinson Next throughout and reserve playful shapes for artwork.

Both families appear in Google Fonts' source tree as variable font files with [SIL Open Font License 1.1 text for Outfit](https://github.com/google/fonts/blob/main/ofl/outfit/OFL.txt) and [for Atkinson Hyperlegible Next](https://github.com/google/fonts/blob/main/ofl/atkinsonhyperlegiblenext/OFL.txt). Braille Institute describes Atkinson Next's seven weights, variable version and deliberately differentiated letters/numbers on its [font page](https://www.brailleinstitute.org/freefont/). The specific binary selected during implementation must be checked against its accompanying licence and glyph map; include the copyright/OFL text with the redistributed font files. Do not use Braille Institute's gated download without checking its separate EULA; the Google Fonts OFL source is the proposed supply route.

## Current audit

`src/styles.css` sets Arial as the root face and Georgia/Times for all `h1`–`h3`. Additional Georgia declarations occur in the brand, number labels, tile names and material-card headings; some explicit Arial shorthand declarations would bypass a new root token. `src/author.css` inherits most text but has one explicit Arial shorthand. No `@font-face` currently exists. The fixed topic and hero artwork in `src/ui/visuals.ts` is SVG shapes, while the wordmark, headings and lesson numbers remain CSS text. Topic mathematical diagrams mostly use text or SVG text rendered by browser fonts; they need a separate visual check for symbols and alignment.

Several inherited or explicit sizes are too small for comfortable learner scanning: examples in `src/styles.css` include 7–10px brand/sidebar labels and 9–12px lesson metadata, hints and notes. The author workspace also has 11–13px labels. Changing family without correcting these sizes could leave the app looking newer but no easier to read. Inventory every explicit `font`/`font-family`/`font-size` rule in `src/styles.css` and `src/author.css` during implementation; remove stale pre-library sidebar typography only when its markup is demonstrably unused.

## Proposed type system and implementation

| Role | Face and weight | Starting size / line height | Notes |
| --- | --- | --- | --- |
| Hero and topic display | Outfit 600–700 | `clamp(2.25rem, 4vw, 3.75rem)` / 1.08 hero; `1.5–2rem` / 1.18 topic | Avoid tight negative tracking on long translated or user-authored titles. |
| Lesson title and section headings | Outfit 600–700 | `1.75–2.25rem` / 1.2 title; `1.375–1.75rem` / 1.25 section | Keep heading hierarchy and wrapping. |
| Learner story, prompt, answer choices | Atkinson Next 400–600 | `1.125rem` / 1.5 story; `1rem` / 1.5 controls and explanations | Prioritise numerals and operation signs at the existing mathematical size or larger. |
| Navigation, metadata, hints, notices | Atkinson Next 500–700 | `0.875rem` / 1.4 minimum for essential learner text; `1rem` for touch actions | Retain uppercase only for short eyebrow labels; reduce excessive letter spacing. |
| Author editor | Atkinson Next 400–700; Outfit headings | `0.875rem` / 1.45 minimum controls; `1rem` preferred for editable inputs | Ensure text caret, selection, field labels and preview match the learner surface. |
| Aligned numeric tables or graph keys | Atkinson Next with `font-variant-numeric: tabular-nums` only where alignment matters | Match surrounding text | Keep proportional numerals in prose if they read better. |

Implement as two CSS variables (`--font-display`, `--font-body`) at `:root`, then replace explicit Georgia/Times/Arial declarations across both stylesheets. Apply body family to form controls and any SVG text that is text rather than geometry. Keep `font-synthesis: none`, declare the available weight range accurately in `@font-face`, and use a system sans fallback. Use `rem` for text and allow wrapping; do not rely on fixed-height cards after size increases. The shared lesson renderer's DOM, hints, diagrams and task data should remain unchanged; CSS-only type changes need visual impact checks but no new content approval.

Self-host reviewed Latin WOFF2 assets in `assets/fonts/` and serve through Vite in both preview and learner builds. Use `font-display: swap` so text appears while loading. Measure actual transfer size and layout shift before deciding whether to preload a single critical face; avoid preloading every weight. [web.dev's font guidance](https://web.dev/learn/performance/optimize-web-fonts) supports WOFF2, careful preloading and `crossorigin` even for self-hosted fonts. Target a small subset: two upright variable files if they fit a proposed **120 KB combined transferred font budget**; otherwise trial static weights or one family. Italic files are needed only if live content uses italic. Do not fetch a remote font CDN at learner runtime. Include licence text and source/version in `assets/fonts/README.md` when implemented.

Before committing any font binary, inspect its cmap for `0–9`, `O0`, `I1l`, `+`, `−` (U+2212), `×`, `÷`, `=`, `<`, `>`, `≤`, `≥`, `%`, decimal point, comma, `°`, `½`, `¼`, `¾`, arrows and punctuation present in lessons. If the chosen subset omits a character, supply a visible system fallback or retain a fuller subset. Spot-check 101/110, 6/9, 0/O, 1/I/l, fractions, place-value columns, graph keys and angle labels with both fonts at phone size. A `document.fonts.check()` call alone does not prove a glyph is present.

## Acceptance and evidence

1. Capture matched before/after views at 390, 768 and 1280px for home, one topic, comparison and place-value lessons, Try and hint states, author library and a long-title editor. Inspect real text wrapping, line spacing, numerals and labels; do not infer appeal from font names.
2. Test 200% browser text resize/zoom and a 640 CSS-pixel reflow case for clipped headings, buttons, graph labels and inspector controls. Test the [WCAG 2.2 text-spacing overrides](https://www.w3.org/WAI/WCAG22/Understanding/text-spacing) (line height 1.5, paragraph spacing 2, letter spacing .12, word spacing .16) without loss of content; [WCAG's resize-text guidance](https://www.w3.org/WAI/WCAG21/Understanding/resize-text) expects text up to 200% without loss of content or functionality.
3. Keep text contrast at least 4.5:1 for ordinary labels and 3:1 for large text against actual surfaces; check every token affected by the new weight and each state. Retest focus rings and meaningful mathematical marks; [WCAG non-text contrast](https://www.w3.org/WAI/WCAG22/understanding/non-text-contrast.html) requires 3:1 for essential graphical objects.
4. Run the existing unit/DOM, browser, lint, typecheck, format, content validation, both builds and learner artifact scan. Browser checks must include font loading from the built learner artifact, with no CDN requests, no horizontal page overflow, no broken glyph squares and no critical button clipped in the author inspector.
5. Have a human reviewer look at paired comparison captures for the desired playful, modern feel and at a short lesson for reading comfort. This is visual/product feedback, separate from human mathematical and pedagogical approval. If the pair does not improve those views, trial the single-family fallback before adopting typography site-wide.

## Review brief for Claude

Review this plan once against the user's font feedback, current CSS and lesson/author surfaces. Check the paired-font rationale, exact licence source, glyph and loading plan, size hierarchy and practical acceptance coverage. Cite section and code evidence; assign findings beginning with the next unused `R-` ID from `handover.md`. Suggest remedies without implementing. Codex will assess each finding independently and record accept, modify, reject or defer before any typography implementation.

## Codex dispositions after the single review

Implement the pair without another pre-switch approval gate (user instructed continuation). Audit actual repository characters against shipped cmaps and document symbol fallback; pin source and binary hashes, inspect reserved names, distribute licence notices in both builds. Deliberately use an upright wordmark and verify actual weights. Preserve palette, inspect real before/after captures and fix reflow regressions. R-66/R-68/R-69/R-73/R-74 dispositions are in handover.
