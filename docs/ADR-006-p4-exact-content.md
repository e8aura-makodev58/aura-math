# ADR-006: P4 exact content and preparation collections

Accepted 2026-10-05 by Codex after the single Claude review R-64–R-74 and independent dispositions. This records engineering decisions, not human content approval.

P4 adds three separate runtime/author capabilities: decimals, fraction calculations, and area/perimeter. Twelve original draft packages use schema 3. The shared runtime receives registered adapters; exact answer parsing and mathematical checks remain topic-specific. Decimal arithmetic uses integer coefficients/scales, fractions use bounded integer rationals, and measurement uses semantic rectangle/corner-cut dimensions. Syntax failures preserve typed input and produce no assessed submission. Equivalent rational/decimal values are accepted; a simplest-form goal additionally checks the representation.

Package schema 3 makes new exact responses and operation-chain interpretations explicitly incompatible with older readers. Application contract 3 is required by the release gate, while the manifest envelope stays schema 2 and canonical hashing stays version 1. Original v1/v2 packages remain byte-identical and readable. A first edit promotes either directly to v3 with original provenance and one lesson-version increment; undo restores the source. New templates use v3. There is no chained migration or automatic storage rewrite.

The separately hashed schema-1 library index gains optional validated collections: ID, label, description, P4 level, ordered unique lesson IDs and practice IDs drawn from that membership. The approved build prunes both member lists and drops empty collections. P4 release entries require explicit matching placement. Unknown legacy levels are rejected rather than guessed as P2. Local author drafts can use intrinsic metadata outside a published collection.

The preparation collection offers skill lessons and three untimed mixed questions. Navigation persists collection/practice context in the hash; next-question links use only permitted records. This is a small revision set, not a school-paper replica, complete P4 coverage, mastery score or durable learner history. Existing draft status remains visible. The adult worked-solution control reveals authored worked hints and records support, including after completion.

Both area methods and both corner-cut perimeter methods are valid. Fixture regeneration asks the registered adapter which choices are correct, retaining alternate method evidence after author edits. Corner-cut perimeter equivalence is explicitly taught for that bounded family; notches/arbitrary polygons remain out of scope. Original wording and worked hints still require independent mathematical/pedagogical review before publication.

Typography uses locally bundled Outfit and Atkinson Hyperlegible Next with recorded binary hashes, redistribution notices and symbol fallbacks. The existing palette and playful navigation remain. Fonts are application assets, not lesson-package assets; CSS/renderer changes trigger compatibility and visual checks rather than silently granting package approval.

Verification and limits are recorded in `implementation-status.md` and `../handover.md`. School-specific topic/date information remains unavailable; general revision is labelled accordingly.
