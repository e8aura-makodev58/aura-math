# Bring back the character of Aura Math

**Prepared:** 2026-10-05 by Codex. **Status:** Claude’s single review R-55–R-63 assessed by Codex in `handover.md`; implemented and verified; see `docs/implementation-status.md` and the latest handover entry. This is the next design phase after `docs/library-and-topics-plan.md`.

## User direction and diagnosis

The user reviewed the current live layout, found it more organised but less fun than the original main page, and asked for a modern layout. The current library is the implemented page, not a temporary placeholder. Its information architecture works, but its visual and interaction design regressed.

Evidence inspected: current `src/main.ts`, `src/ui/library-view.ts`, `src/styles.css`, the previous homepage styles still present in that CSS, the earlier library plan, and the current desktop/phone screenshots (`docs/screenshots/lib-d.png`, `lib-p.png`). The original page markup/screenshot is not available in this workspace, so the comparison below uses retained original classes and styles, not a claim of a pixel-perfect visual comparison. The local server at 5178 was unavailable during this inspection; the recent screenshots and source are the available visual record.

| Original page character visible in retained code | What the new page shows | Design correction |
| --- | --- | --- |
| Illustrated hero (`.hero`, `.hero-art`, `.hero-footnote`) with editorial headline and a clear first action | Plain “Explore lessons” heading and single-line introduction | Restore a compact, illustration-led welcome that points into a lesson |
| Topic panels with distinct warm/cool surfaces, icons and short descriptions | Six long text sections; almost identical white lesson cards | Show six recognisable topic worlds before expanding a topic's lessons |
| Numbered lesson rows and a varied page rhythm | Repeated metadata/title/description/button blocks | Make the topic the primary visual unit; reveal its three lessons in a focused view |
| Warm cream/green visual language and serif headlines | Mostly neutral forms and thin outlines | Retain the brand palette, add controlled topic accents, depth, shape and motion |
| A curated entry point for a small set | Search/filter toolbar dominates the first screen | Put discovery and one clear start action first; retain search and filters as easy-to-find tools |

The previous plan explicitly chose “a short introduction rather than a tall hero” to prevent 18 cards from being buried. That solved list length by flattening the entire catalogue. This proposal restores character **and** keeps the catalogue navigable: a compact hero, six topic tiles, then a topic-focused lesson list. It should not return to a permanent all-lesson sidebar.

## Desired experience

On entry, the learner should see: (1) a welcoming illustration and a clear recommended starting action; (2) six colourful, mathematically meaningful topic tiles; (3) a visible way to search or filter all 18 lessons. Selecting a tile opens a dedicated topic view at the top, showing that topic's three lessons, skill sequence and prerequisites, with a clear All topics return. The search results view remains direct and exhaustive for people who know what they want. A learner can reach any lesson in at most two activations from home. A returning learner sees session-only completion without any promise of saved progress.

The author library can reuse the new topic/lesson visual language, with author controls clearly separated from learner actions. The lesson itself should get a lighter visual polish and a clearer path through steps, but its mathematical diagrams, text, answers, hint order and interaction rules should not change in this visual phase. Content and publication rules remain as recorded in ADR-002/004.

### Desktop composition (concept, not finished artwork)

```text
┌ Aura Math                         Explore  Topics  [Author workspace] ┐
│                                                                      │
│  [Warm illustrated welcome: a few math shapes and counters]         │
│  “Math makes more sense when you can see it.”  [Start a lesson →]    │
│                                                                      │
│  Explore a topic                              [Find a lesson  🔎]     │
│  ┌ Place value ───┐ ┌ Equal groups ─┐ ┌ Fractions ────┐             │
│  │ blocks / 3     │ │ counters / 3  │ │ parts / 3     │             │
│  └───────────────┘ └───────────────┘ └───────────────┘             │
│  ┌ Comparing ────┐ ┌ Angles ───────┐ ┌ Picture graphs ┐             │
│  │ bars / 3      │ │ corner / 3    │ │ symbols / 3    │             │
│  └───────────────┘ └───────────────┘ └───────────────┘             │
│                                                                      │
│  Selected topic → three ordered lesson rows + skill names           │
└──────────────────────────────────────────────────────────────────────┘
```

At 390px, stack the hero copy above a small illustration, use two topic tiles per row if labels remain legible (otherwise one), and show one topic's lesson rows below. Search is a full-width control; level filters are compact pills. No horizontal scrolling or hover-only affordances. At tablet width use two or three topic columns according to measured fit, not a fixed sidebar.

### Interaction and visual specification

1. **Welcome:** compact hero approximately 250–320px tall desktop, 220–280px phone. One CTA opens a real starter lesson from the permitted catalogue; when the catalogue is empty, the CTA is absent. No generic “AI” imagery or confetti. Use original SVG/CSS mathematical shapes: bars, counters, a fraction strip, grid dots and an angle arc. Illustrations carry visible mathematical meaning and have a short text alternative or are decorative if redundant.
2. **Topic identity:** six accents within the existing cream/forest-green brand: comparison clay, angles blue-green, place value golden ochre, equal groups coral, fractions lilac, picture graphs teal. Apply accent to icon/illustration, edge and small surface area; keep body text contrast strong. Icons must be distinct by shape as well as colour. No emoji as primary graphics.
3. **Tile content:** human label, distinct one-sentence purpose from the digest-bound library index, level, exact permitted lesson count and a short title/skill preview. Tile activation selects the topic; the lesson rows are ordered by index sequence. Do not present the whole card as an inaccessible nested button; give one clear interactive target and visible focus.
4. **Focused catalogue:** default home shows the topic tiles and a short starting action, not all 18 full cards. Selecting a tile changes to a dedicated topic view at the top, moves focus to the heading and updates the URL hash. Search query or level filter switches to a result view across permitted lessons with count and clear/reset. Keep robust hostile-query handling and focus/scroll restoration. An “All lessons” control provides the exhaustive view without forcing it onto the first screen.
5. **Lesson row:** number/skill, title, concise objective, P2/P3 and duration, one “Start lesson” action, session completion if present. Prerequisites are plain and understandable; where a prerequisite lesson is available, link to it. Do not infer mastery or recommend from a performance model that does not exist.
6. **Motion and tactility:** subtle hover lift, surface shading and short transitions (120–220ms). Respect `prefers-reduced-motion`; all states are understandable without animation or hover. The visual should feel lively through illustration, hierarchy and direct manipulation rather than excessive motion.
7. **Lesson stage:** retain shared learner/author rendering and DOM contracts. Refine spacing, step rail prominence and topic accent around existing diagrams. The problem and answer controls remain the visual focus. Preserve text alternatives, keyboard focus and both learning modes.
8. **Author consistency:** use the same six topic identities in Starter lessons/New lesson while keeping My drafts and editing tools unmistakably author-only. Avoid importing author controls/data into the learner build. Mobile inspector remains modal; tablet inspector remains complementary.

## Implementation boundaries and acceptance

- First inspect/capture the current page at 390, 768, 1280px and use the retained hero/topic styles as a design reference. Implement a reviewable static home mock in repo-native HTML/CSS/SVG, with phone and desktop captures, before wiring it into the real library. The mock is design evidence, not another app route to maintain.
- Build the home/topic/result states through the existing permitted `LibraryRecord[]` input so a release with zero or some approved lessons shows only those topics, counts, links and illustrations. The empty learner build keeps its clear empty state. Index labels/descriptions remain digest-bound; no package/content changes are required.
- Preserve known hash routes, query bounds, filters, lesson open/return, session completion, next lesson, author entry and safe text rendering. If a new topic-focus route is added, invalid IDs fall back to home without leaking draft material. Prefer a state extension to a parallel router.
- Desktop first screen at 1280×800 shows the welcome and at least the first row of topic tiles. Phone first screen at 390×844 shows the welcome and the start of topic discovery. All six topics are visible with normal scrolling; any lesson remains reachable in at most two activations.
- Verify 390/768/1024/1280 widths, a 640 CSS-pixel reflow case, keyboard-only topic/search/lesson path, visible focus, no horizontal document overflow, reduced motion, long names, zero results and zero-approved release. Measure contrast and interactive target sizes; capture and inspect screenshots, including an author library. Automated tests supplement a human visual check.
- Run typecheck, lint, format, relevant unit/DOM/browser tests, both builds and release artifact scan. Check no author-only strings or draft packages enter `dist-learner`. Record a renderer/content-impact decision if any lesson presentation markup changes. Do not declare human content approval or production publication from visual checks.

## Review brief for Claude (one pass)

Review this plan against the user's complaint, the original styles in `src/styles.css`, current `src/main.ts` and `src/ui/library-view.ts`, current screenshots, ADR-002/004 and prior R-45–R-54 dispositions. Focus on whether the proposed home regains playfulness without obscuring lesson discovery, whether topic/result/empty states are coherent for approved subsets, and whether accessibility/responsive acceptance is concrete enough. Cite exact plan sections and code evidence; assign finding IDs from R-55. Suggest remedies but do not implement. Codex will independently accept, modify, reject or defer each finding and then implement. No automatic second review round.


## Assessed review amendments for implementation

Claude’s one-pass findings R-55–R-63 and Codex’s individual accept/modify decisions are recorded in `handover.md`. Build a desktop/390px static mock showing home, focused topic and empty learner states under `docs/design/`, inspect it, then wire the shared view. The user has already directed implementation, so the mock is an internal design checkpoint rather than an additional approval gate. Topic descriptions and 18 lesson blurbs should use short, friendly second-person language; index edits require a new manifest digest and human copy review before publication. Fixed topic illustrations may not reveal lesson task data. Use six distinct topic glyphs and a recurring math-spark motif, with accent tokens checked for contrast. Apply accents outside snapshotted lesson regions and preserve the shared runtime and accessible interactions.


## Delivery evidence

Implemented after Codex assessed R-55–R-63. Real application captures: `docs/screenshots/playful-home-{390,1280}.png`, `playful-topic-{390,1280}.png` and `playful-author-{390,1280}.png`. The static design study and six state captures remain under `docs/design/`, excluded from application builds. Final unit/DOM suite has 245 passing tests; browser suite has 25 checks. The lead inspected the real home/topic captures, corrected phone art clipping and reduced desktop row height, and verified keyboard topic/lesson/starter return and literal search. User visual feedback remains the judge of whether the result restores the desired character; no new implementation approval gate is introduced.
