# ADR 003: shared lesson canvas and author transactions

Accepted 2026-10-05 after Codex assessed Claude’s single review R-36–R-44.

Use the rich development lesson presentation as the canonical shared view for author, development and learner entries. Static regions are patched without replacing focused inspector controls or learner answer fields. Author Edit displays any step without creating a runtime session; Try creates a fresh frozen snapshot with normal progression and assessment.

Keep working input, last-valid package, original package and trial state separate. Topic model edits derive mathematical answers, fixtures and interpretation. Pending custom wording blocks Try/export until acknowledged by the author or coherently regenerated; unknown-position changes require the coherent transaction. Literal prose still requires independent human review. Reuse deterministic generator wording; do not substitute numbers blindly in custom text.

Store author drafts only in device-local storage. Continue an existing record only while holding an exclusive Web Lock; otherwise fork a copy visibly. Bound the collection to ten without eviction, preserve corrupt records, and report storage failure. Existing authors remain read-only and contributors use stable IDs whose actual identities must be verified by the maintainer. Reports contain digests, changed blocks and timestamped author assertions, never release approval.

This is a renderer-impact change. Compatibility fixtures cover six original lessons in both support modes, expected wording/choices/hints and runtime behavior. Ninety unit/DOM checks and both builds pass; browser/device/accessibility verification remains outstanding. The manifest records this decision and retains zero approved entries. Human mathematical and pedagogical review is still required before publication; no deployment or existing approval is inferred from compatibility tests.
