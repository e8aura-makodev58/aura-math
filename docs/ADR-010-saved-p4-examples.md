# ADR-010: saved P4 example sets

2026-10-11. Implemented against Claude's user-requested SOW, with Codex's independent
dispositions in `p4-example-sets-sow.md` §14. Human content approval remains separate.

Each of the 46 P4 parents has five complete, original draft packages under
`content/examples/p4/`: 230 examples, 294 total packages, still 64 library tiles
across 16 families. Packages use schema 3, Codex authorship, generated provenance
`p4-examples-v1`, and an `example` tag. Parent payloads are not rewritten.

The optional library-index `examples` array links identities without adding tiles,
spotlight entries, search counts or mixed-set slots. Index schema 1 remains readable
without this field. Duplicate/self/cross-parent links and mismatched placements are
rejected. The library digest covers all links.

The deterministic builder enumerates validated finite specifications and spreads
selection over normalized numeric/categorical leaves of the specification. Numeric
features include operands, chart values and angle sizes; categorical features
include operations, shapes, nets, faces and orientations. Each successive selection
maximizes minimum distance from the starter and selected instances, with seeded
tie breaks. Previously unused mathematical answer sets are preferred. Existing
builders compute prompts, hints, answers and interpretations. No live LLM input is
used. Mathematical numeric options, category order and multi-select order are
preserved; unordered single-choice positions vary deterministically.

Example-only domains cover folding, collision, solid orientation, protractors,
mirror placement and shading. Static/folding catalogue nets and shape tasks accept
optional integer quarter turns (0–3), preserving exact polygon geometry and glue
identities. The square displays all four true axes. Collision nets remain subject
to the existing single-pair/missing-face validators; Watch uses a different shape,
and closing captions must not coincidentally quote the learner's answer label.
Fraction subtraction keeps related denominators and a result needing simplification.

Six different mathematical answer sets are impossible in several fixed conceptual
domains. Actual sets including the starter: line-graph practice 2; cube-net check 4;
solid identification 4; folding a solid 4; symmetry lines 5; symmetric-figure completion
2; symmetry practice 4; mirror-line placement 2. These still have five distinct task
specifications. Other parents have six distinct answer sets. Rotated nets/shapes,
changed data/patterns and alternative Watch solids provide instance variation;
answer counts are reported rather than claiming six different solids or rules.

The shared saved-example picker is a native-button navigation region, with 44 px
targets, wrapping layout, saved/temporary wording and 1-based deep links. Switching
starts a fresh attempt, clears hints and retains the selected learning mode.
Completion is recorded against the instance identity, not its parent. The preview's
Try another remains available only on canonical starters. Authors see read-only
example links beneath the parent inspector; the source selector retains parent tiles.

Each example needs its own exact-digest approvals. The release gate accepts an
example only when linked to an approved parent, and the released index prunes all
unapproved links. The learner bundle contains complete approved payloads only,
with no example builder, author capability, live model or runtime generator code.

`content:examples --check` reports reproducibility without writes. Generation plans
the whole batch before mutation; reviewed/conflicting payloads abort before writes.
`--force` replaces only unreviewed drafts, never reviewed digests. Shrinking an
existing set is refused rather than leaving orphan tiles. Successful writes rebind
the library digest automatically. Engine tests validate every package and accepted/
rejected fixture; independent arithmetic, rolling-cube and point-reflection oracles
check every saved example. These are engineering checks, not teaching approval.

Browser checks and screenshots require a host that permits Chromium. Real-device,
zoom and assistive-technology verification are separate outstanding checks.
