# ADR 001: Local-first development preview

Accepted for implementation 2026-10-04 following the user's request to start development and delegate work.

Use TypeScript, Vite, browser-native DOM and SVG, and Vitest. This small lesson interface does not yet need a UI framework or backend. Keep runtime independent of concrete adapters; register comparison and angle adapters at the composition boundary. Use original authored fixtures, no model calls, remote fonts, analytics, or learner identity.

Initial delivery is a development preview. Original content is unreviewed; no human approvals are fabricated. Production learner publication is disabled until the approval tooling and independent human reviews required in the SOW are complete. Session state is in memory; preview does not persist learner progress. Browser storage may hold only interface preferences if introduced.

This development authorisation supersedes waiting for M0 completion before coding. It does not mark M0, M1b, or publication checks complete. Full canonical package approval, durable progress, automatic fading and observed pilot are subsequent work; report implemented behaviour separately.
