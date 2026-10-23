# LLM novelty and admin settings: dispositions of the review (binding on the coding agents)

**Status: written 2026-10-11 by Claude as lead.** Assessment of [llm-novelty-review.md](llm-novelty-review.md) (R-111 to R-127) of [llm-novelty-plan.md](llm-novelty-plan.md). The lead commissioned the plan, so this is **not** independent; Codex should re-check it. It approves no lesson content. Nothing is published.

**Precedence:** this document > review > plan.

## User answers (2026-10-11, decision 23 and follow-ups)

1. Settings locked by an **admin token** (aura-health pattern). Keys write-only, masked (last 4), never returned to the browser.
2. The LLM may write wording and propose specifications; answers always come from the deterministic model. (See R-111: spec proposals turn out to add nothing for current profiles.)
3. **Both phases**: extend the deterministic generator to more families (Phase A) **and** add LLM stories (Phase B).
4. Home-network devices: "allowed behind an admin switch". Superseded in practice by answer 5: the child's device only reads approved stories, so no spend-capable endpoint is exposed to it.
5. **Adult approves batches.** The adult presses Generate in the locked admin page and approves; the child only ever sees approved stories. This keeps SOW §6.2.
6. **Budget in dollars, not calls.** The user rejected a 120-call cap estimated at up to US$11/day. Spend is computed from the token counts each response reports times a per-model price table; default cap **US$1.00 per day**, editable in settings; month-to-date shown. Price table values are from the bundled API reference, marked unverified until checked against the live price page; unknown model → no live calls until the admin enters prices.

## Dispositions

| ID | Sev | Disposition | Decision |
| --- | --- | --- | --- |
| R-111 | High | **Accept** | Two phases. **Phase A (deterministic, no key):** widen the generator profiles and add variant support for more families (charts, nets, angles, symmetry, whole numbers), plus a human-reviewable **story-frame bank** (names, items, settings) used deterministically. **Phase B (LLM):** stories only, filling Phase A frames. Spec proposals are kept only as validated suggestions and are **first in the cut order**. |
| R-112 | High | **Accept** | Dev-server only, using the annotation plugin's pattern (`ssrLoadModule`); port 5178 runs `npm run dev`. No `vite preview` hosting. |
| R-113 | High | **Accept** | Fixed per-profile story frames with typed noun slots; the model fills slots only. No free-text story. Number words (half, pair, twice, dozen and similar) are blocked in slot values. |
| R-114 | High | **Accept** | Remove the `choiceLabels` slot. The model never writes options, hints, worked steps, numbers or answers. |
| R-115 | High | **Accept (user chose it)** | Adult approval queue in the admin page; the child route reads only the approved cache; no unauthenticated generation endpoint; the allowLan toggle is dropped. Approved stories are still labelled as development preview. |
| R-116 | Med | Accept | Rely on Vite's host validation; forbid `allowedHosts: true`; admin routes require a loopback peer address or same-origin HTTPS and the token. |
| R-117 | Med | **Accept with modification** | Dollar cap as above, counted from reported usage, reserved before the call at the worst case and settled after. Calls where no candidate passes count toward a circuit breaker. Usage in its own owner-only file. |
| R-118 | Med | Accept | Per-model capability table (fallbacks, effort, structured output); explicit `baseURL` and `authToken: null` for the SDK; `max_completion_tokens` for OpenAI-compatible. |
| R-119 | Med | Accept | Token and data root are created lazily on the first admin request, never during Vitest; tests use a temp data root. |
| R-120 | Med | Accept | Refuse a data root inside the repo or any `server.fs.allow` path, after resolving symlinks. |
| R-121 | Med | Accept | Choice-balance work (tests/choice-balance.test.ts, `choiceBalanceIssues`) is landing separately; with R-114 the model output does not depend on it, but Phase A variants must pass it. |
| R-122 | Low | Accept | Keep text paths on `textContent`; add a test that slot values with markup render inert. |
| R-123 | Low | Accept | Scan `dist-learner` for model code, endpoints and settings routes; key-pattern scan avoids bare `sk-` false positives. |
| R-124 | Low | Accept | Valid token works during lockout; credential format as aura-health. |
| R-125 | Low | Accept | Generated packages carry `{kind:"generated", generatorVersion, seed:uint32}` provenance. |
| R-126 | Low | Accept | Names only from the curated list; pronouns come from the frame. |
| R-127 | Low | Accept | Resolved by the user answers above. |

## Order of work

**Phase A first** (no key, no spend): A1 widen existing profiles and add variant families; A2 story-frame bank with deterministic selection; gates as before. **Phase B**: B0 server plugin, data root, token, settings API with fake transport tests; B1 settings UI (unlock, provider, model discovery, masked key, replace/remove, enable, dollar budget, paid connection test with confirmation); B2 generate-and-approve queue in the admin page; B3 child route reads approved cache; B4 lead integration, ADR-010, docs. Cut order: spec suggestions, OpenAI-compatible provider, model discovery. Never cut: token lock, write-only keys, dollar cap, approval queue, learner-build scans.

## Not verified

Live provider behaviour and prices; child suitability of frames, names and nouns (human review); real devices.
