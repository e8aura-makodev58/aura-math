# LLM novelty for P4 fresh examples: plan

**Status: written by a planning agent on 2026-10-11. Not approved; no Claude review yet, no Codex dispositions, no human review.** It implements user decision 23 in `handover.md`. Per AGENTS.md this plan goes to one Claude review, then Codex records accept, modify, reject or defer for each recommendation before any implementation. Nothing here changes human lesson-content approval or the publication gates.

Binding user decisions (not reopened here): (1) settings are locked by an admin token in the aura-health pattern, and keys are write-only, masked, stored server-side only and never returned to the browser; (2) the model may write wording **and** propose new specifications, every proposal must pass the topic's exact validator, and answers always come from the deterministic model; (3) the admin chooses provider and model, with at least Anthropic and OpenAI-compatible (OpenAI, OpenRouter). Model ids come from discovery or admin entry. `claude-opus-5-5` is the default suggestion for Anthropic.

## 0. Findings that shape the plan

1. **There is no server.** Aura Math is static. The only server code is the Vite dev-server plugin for the dormant annotation tool (`scripts/annotation-dev-plugin.ts`, `apply: "serve"`, loopback-only, header-guarded). `npm run dev` and `npm run preview` both listen on `0.0.0.0`, so the preview on 5178 is reachable from the LAN. That LAN preview is how the child uses the app.
2. **Generation exists only for eight canonical starters** (`src/practice/generation.ts`, `P4_GENERATOR_VERSION = "p4-bounded-v1"`, development preview only, already a learner sentinel). Each profile has a hand-written signature predicate (`matchesProfile`) and an enumerated domain. **For these profiles the domain already covers almost all of the predicate.** A model-proposed specification therefore adds little *mathematical* novelty inside today's bounds. The real novelty is **context**: who, what and where. Spec proposals are still built, as the user asked, but each is accepted only if it passes `validateSpec` plus the profile predicate, so it can never widen the pedagogical envelope.
3. **Today's generated wording is fixed templates** (for example `rewriteDecimalLesson` writes "Calculate with equal place units and check the result."). The builders have no slots for context. A small additive change is needed: an optional `context` argument that leaves today's output byte-identical when it is absent.
4. **`lesson-view.ts` writes regions with `innerHTML`.** I did not verify that every text path is escaped. Model text must be proven inert before it reaches the view (WP3 test).
5. **The choice-balance fix (decision 23, first half) is a parallel change.** This plan reuses its checker and does not define a second one. If that checker has not landed, WP3 is blocked on it.

## 1. Server and hosting

**Decision: one framework-free request handler, mounted by a Vite plugin in both `configureServer` (dev) and `configurePreviewServer` (preview). No separate Node server.** Reasons: it reuses the annotation pattern, needs no new process or port, and runs the same code for both ways the user serves the app. A standalone server would duplicate static serving and add deployment work that nobody has asked for.

- **Code location:** a new `server/novelty/` directory outside `src/`, so neither the learner graph nor the preview graph can import it by accident: `settings-store.ts`, `admin-auth.ts`, `handler.ts`, `providers/{catalogue,anthropic,openai-compatible}.ts`, `pipeline.ts`, `content-checks.ts`, `profiles.ts`, `cache.ts`. The plugin is `scripts/novelty-plugin.ts`, registered in `vite.config.ts` next to `annotationDevPlugin()`. Provider modules are loaded lazily with `import()` on the first call.
- **Learner build stays model-free:** `build-learner.mjs` builds `learner.html` only, and `learner.ts` never imports `src/practice/novelty-client.ts`. `check-learner-artifact.mjs` gains these sentinels: `__novelty`, `__admin/settings`, `x-aura-novelty`, `p4-novelty-v1`, `api.openai.com`, `openrouter.ai`, `@anthropic-ai`, `provider-credentials.json`, `admin.token`, `Unlock settings`. A second scan covers `dist/` (the preview build): no server module strings and no `sk-`/`sk-ant-` key patterns.
- **Data root, outside the repo:** `AURA_MATH_DATA_DIR`, defaulting to `${XDG_DATA_HOME:-~/.local/share}/aura-math/`. The directory is created with mode 0700 and every file is 0600:
  - `admin.token`: 32+ bytes from `crypto.randomBytes`, base64url, created exclusively (`wx`) on first start.
  - `provider-settings.json`: provider, per-provider model, enabled, allowLan, budgets, and a `revision` (random hex, replaced on every write).
  - `provider-credentials.json`: keys by provider. It is only ever read by the provider modules.
  - `novelty-cache.json`: accepted examples and blocked fingerprints.

  Every write goes to a temp file in the same directory (0600), then `fsync`, then `rename`, copying aura-health `_write`. The server refuses to start the feature, and logs why, if the root resolves inside the repository. `.gitignore` adds `.aura-data/` as a safeguard. A new `.env.example` (already allowed by `.gitignore`) documents `AURA_MATH_DATA_DIR=` with no value.
- **Origin and transport rules**, copied from aura-health `authorize`:
  - *Admin routes:* the Origin header must equal Host, and must be either `https:` or `http:` on `localhost`/`127.0.0.1`/`::1`. Plain-http LAN access to settings is refused (403, "Use this computer's browser or an SSH tunnel"). The Bearer token is compared with `crypto.timingSafeEqual` on equal-length buffers. There are 20 failed unlocks per minute, then 429. The request body must be JSON of 8 KB or less with an exact field set.
  - *Generation route:* it carries no token, because the child's device has none. It requires a same-origin Origin, the `x-aura-novelty: 1` header, and either a loopback peer or `allowLan === true`. `allowLan` defaults to **off**. When it is off, a phone or tablet on the LAN gets deterministic variants only (open question Q1).
- **Response headers:** every route sends `Cache-Control: no-store`, `X-Content-Type-Options: nosniff` and `Content-Type: application/json`. Errors are `{error:{code,message}}` and never echo request bodies, keys or provider error text.
- **Budgets:** calls are reserved before the request, as in aura-health `reserve()`. The defaults are 4 per minute, 30 per hour and 120 per day. The admin may change them up to hard ceilings of 10, 60 and 300. The daily counter is persisted in `provider-settings.json` so a restart does not reset it. One call may be in flight at a time. After three consecutive failures the breaker opens for 10 minutes. Model discovery counts against the minute limit only. The paid test counts against all limits.
- **Timeouts and limits:**
  - Anthropic: `new Anthropic({ apiKey, timeout: 25_000, maxRetries: 0 })`.
  - OpenAI-compatible: `fetch` with `AbortSignal.timeout(25_000)`, `redirect: "error"`, no proxy environment, and fixed endpoints only (the admin cannot type a base URL).
  - Response cap: 64 KB for generation and 1 MB for discovery, as in aura-health.
  - `max_tokens`: 4000 for generation.
  - **No retries.** Any failure returns `{status:"unavailable"}` and the browser keeps its deterministic variant (fail-closed).

## 2. Settings page

- **Where:** a new `admin.html` entry (`src/admin.ts`, `src/admin.css`), added to the `vite build` inputs beside `preview` and `author`, never to the learner build. It is linked from the author workspace header ("Model settings"). It is not linked from the child's home page.
- **Unlock:** at plugin start the server prints the **path** of the token file, never the token: `Aura Math settings token: ~/.local/share/aura-math/admin.token (owner-only)`. A new `npm run admin:token` script prints the token on the local terminal. The page asks for the token, keeps it only in a module variable (no storage), and sends it as `Authorization: Bearer`. A reload means unlocking again. A wrong token shows "That token did not match" and the 429 lockout message.
- **Controls**, using the compass `settings.js` layout with aura-health semantics:
  1. **Status card:** On or Off as text plus an icon, never colour alone. It also shows the provider, the model, "Used today: 14 of 120 calls", and the last failure reason in plain words.
  2. **Provider select:** Anthropic, OpenAI, OpenRouter.
  3. **Model select**, filled by **Refresh models** (Anthropic `client.models.list()`; OpenAI-compatible `GET /models` with the aura-health filter), cached per provider for this page session. A text field "Or enter a model ID" is checked against `^[A-Za-z0-9_.:/~@+-]{1,160}$`. The Anthropic model field is prefilled with `claude-opus-5-5`, and the admin still has to save it.
  4. **API key:** a password field with `autocomplete="off"`. The button reads "Save key" or "Replace key", and "Remove key" appears when a key is saved. Once saved, the page shows only "Key saved, ending ••••abcd. It is never sent back to the browser." The server returns `{configured:true,last4}` and nothing more.
  5. **Enable toggle:** disabled until a key and a model are saved. The server enforces the same rule (aura-health `update`).
  6. **"Allow devices on this network"** toggle, with a one-line warning that anyone on the network can spend up to the budget.
  7. **Budget fields:** per minute, hour and day, with the hard ceilings shown.
  8. **Paid connection test:** a checkbox "I understand this makes one small paid call" must be ticked, and the body must contain `confirm: "TEST_MAY_COST"`. The result is PASS, INVALID_OUTPUT or UNAVAILABLE. The test sends a fixed synthetic spec request through the full pipeline.
  9. **Recent AI examples:** the last 20 accepted examples (story text, profile, model, time), each with a **Block** button. Block removes the example from the cache and denylists its fingerprint.
- **Accessibility and phone:** every control has a visible `<label>`. Status changes are announced through `aria-live="polite"`. Targets are at least 44 px. The page is a single column at 390 px, with no horizontal scroll at 200% zoom. Focus moves to the first field after unlock. The key field is cleared after a save.

## 3. Generation pipeline

Exact routes and fields:

| Route | Auth | Body | Reply |
| --- | --- | --- | --- |
| `GET /__novelty/status` | origin and header | — | `{available: boolean}` only |
| `POST /__novelty/example` | origin, header, loopback or allowLan | `{sourceId, exclude: string[≤30]}` | `{status:"ready", package, descriptor}` or `{status:"unavailable"}` |
| `POST /__admin/settings/{read,save,credential,remove-key,models,test,examples,block}` | Bearer token, admin origin | exact fields per action | snapshot with no keys |

**Flow (server):**

1. **Choose a source.** `sourceId` must be a first-wave profile (section 3.4). The server reads the starter from its own `packages` import and never trusts a package sent by the browser.
2. **Serve from the cache if possible.** If the cache holds an accepted, unblocked example for this source whose fingerprint is not in `exclude`, the server returns it with no call. This cuts spend.
3. **Otherwise make one model call**, after budget, breaker and in-flight checks, asking for **three candidates** in one response. Anthropic uses `output_config: { effort: "low", format: { type: "json_schema", schema } }` with `fallbacks: "default"` (the same request shape as `src/annotation/anthropic-call.ts`). OpenAI uses `response_format: json_schema` with strict mode. OpenRouter uses `json_object`. Local validation is authoritative for every provider.
4. **Validate each candidate in order and keep the first that passes every gate:**
   1. `JSON.parse` succeeds, and the keys match the schema exactly, including nested ones. There are no extra keys.
   2. **Specification:** `topic.validateSpec(spec)` returns no errors, the profile predicate (`matchesProfile` logic moved into `profiles.ts` as shared code) holds, and the spec fingerprint is not that of any catalogue lesson in the same topic, not blocked, and not in `exclude`.
   3. **Wording slots** pass `content-checks.ts` (section 4).
   4. **Build** with the deterministic builder plus the context: `rewriteXLesson(lesson, context)` and then `deriveXLesson`. Answers come only from `topic.answer`.
   5. `validatePackage` passes on the result, and the `topic.answer(step)` recomputation equals each `step.answer`.
   6. **Leak check:** no numeral or number word in learner-facing text that the template did not insert. The unknown value is absent from story, prompt and hint rungs 1–2.
   7. **Choice balance:** the parallel checker passes on every choice step whose labels the model touched.
   8. **Dedup:** the canonical text of the story is not equal, after case and whitespace folding, to any cached or catalogue story.
5. **Accept or fall back.** If a candidate is accepted, cache it (at most 25 per source and 200 in total, evicting the oldest) and return it. If every candidate fails, return `unavailable` and log the gate names only. **There is no second call.**

### 3.1 What the model may write

**Specification:** the topic's own spec JSON. The JSON schema is generated from the same field list `validateSpec` checks (`a`, `b`, `factor`, and so on), so the model cannot invent fields.

**Context slots.** The model never writes a numeral, an answer, a hint or a worked step.

| Slot | Rule |
| --- | --- |
| `name` | One entry from a curated list of about 80 first names (Chinese, Malay, Indian and Eurasian Singapore names) in `profiles.ts` |
| `setting` | Free text, at most 60 characters, for example "at the hawker centre" |
| `itemSingular`, `itemPlural` | Free text, at most 24 characters each |
| `unit` | Per profile. Decimals use an allowlist: `kg`, `g`, `m`, `cm`, `km`, `L`, `mL`, `$` |
| `story` | At most 160 characters. Must contain each required placeholder (`{name}`, `{a}`, `{b}`, `{item}` as the profile requires) exactly once. No digits and no number words. The deterministic template fills the placeholders |
| `choiceLabels` | Only for verbal (non-numeric) choices in first-wave lessons, if any. Each at most 60 characters. Must pass the balance checker. Numeric choice labels stay deterministic |

### 3.2 Prompt and injection

- **The prompt holds only fixed text:** the profile description, the schema, the name list, the rules, and up to 30 excluded fingerprints, which are numbers only.
- **No learner data of any kind is sent:** no answers, attempts, timings, device information or names typed by anyone. The request has no `metadata.user_id`. OpenAI requests use `store: false`.
- **Model output is untrusted data.** It is never put into another prompt, never treated as instructions, and never rendered as HTML. Slot text is inserted with `textContent` or an escaping function, and WP3 adds a test that `<img src=x onerror=…>`, `{{`, backticks and `javascript:` in slots are rejected by the charset check (letters, spaces and `' - , . ! ?`) before any rendering.
- **Admin-entered model ids** are regex-bound and never placed in a URL path. Provider endpoints are constants.

### 3.3 Labelling, attempts and provenance

- **What the child sees:** a badge above the story, "New story from a computer helper. A grown-up has not checked it yet." It is shown as text plus an icon, and the adult worked-solution panel repeats it. Deterministic variants keep their current label.
- **Package fields:** `lesson.id = "novel-<12 hex of fingerprint>"`, `reviewStatus: "draft"`, version 1. The package is runtime-only, never saved, never exportable from the preview, and never sent to the release scripts.
- **Descriptor:** the runtime-only `VariantDescriptor` in `src/practice/` gains an optional `novelty` field, `{ origin: "model", provider, model, settingsRevision, promptVersion: "p4-novelty-v1", validatorVersion, checksPassed: [...] }`. It never carries keys, endpoints or raw model output.
- **Attempt journal:** an attempt is recorded as a variant attempt, so it never sets the source lesson's completion label (the existing `!summary.variant` rule). The temporary 20-attempt record shows "AI story" next to it. Nothing persists past reload.
- **Client defence in depth:** `novelty-client.ts` re-runs `validatePackage` and the answer recomputation in the browser before mounting. On any mismatch it discards the package.
- **Prefetch:** when a first-wave lesson opens and `status.available` is true, the client prefetches one example in the background. "Try another" uses the prefetched example if it is ready, and otherwise uses the deterministic variant at once. The child never waits on the model.

### 3.4 First wave

Three profiles: **`p4-fraction-of-quantity`** (sharing items is a natural story), **`p4-decimal-add-subtract`** (lengths, masses and money) and **`p4-decimal-multiply-divide`** (equal sharing of measures). These already have a generator, a profile predicate, a builder and independent oracles.

| Excluded for now | Why |
| --- | --- |
| `p4-decimal-places`, `p4-mixed-and-improper` | Context adds little |
| The two practice sets | Multi-step; wait until the first wave has been used |
| Charts, nets and geometry | Wording is tied to diagrams, and labels can reveal answers (the ADR-006 reasoning) |
| P2/P3 | Paused |

## 4. Child safety

- **Admin-only enablement:** off by default. The server checks the enable flag, key and model on every call.
- **Content checks**, deterministic and fail-closed, in `content-checks.ts`:
  - charset allowlist
  - per-slot length caps
  - no digits, no number words, no `@`, `#`, `/`, `:` or `www`, and no URL shapes
  - a word blocklist for profanity, violence, weapons, alcohol, smoking, gambling, dating, medical, religion, politics and brand names (a versioned list, `validatorVersion`)
  - names only from the curated list
  - **Singapore context:** currency is dollars and cents only, units are metric only, and a short list of foreign markers is rejected (`£`, `€`, `¥`, "miles", "pounds", "Thanksgiving", "snow day").

  **These checks cannot prove age-appropriateness or meaning.** That is why the label says unchecked, the admin can block an example, and open question Q2 exists.
- **Rate limits and budgets** are as in section 1. Generation also allows 10 requests per minute per remote address.
- **No external links.** Generated text cannot contain URL characters, and the package has no asset references from the model.
- **When the model is off or fails,** the child sees exactly today's deterministic "Try another" behaviour. No error text mentions AI. The admin sees the reason on the status card.

## 5. Tests

No real network in any automated test. Provider modules take an injected transport: a fake Anthropic client (`Pick<Anthropic, "beta" | "models">`, the annotation-test pattern) and a fake `fetch`.

**Unit (Vitest, `tests/novelty-*.test.ts`):**

- **Store:**
  - The token file is created at 0600, the directory at 0700, and a short or tampered token is refused.
  - Atomic write: a simulated crash before rename leaves the old file.
  - The data root inside the repo is refused.
  - The revision changes on every write.
  - The key never appears in `read` or any reply. The test serialises every reply and asserts the key substring is absent; only `last4` is present.
  - Remove key, then enable, is refused.
- **Auth:**
  - Missing or wrong Bearer token gives 401. The 21st failure in a minute gives 429.
  - Timing-safe compare with tokens of unequal length.
  - Cross-origin, LAN http and missing Origin give 403 on admin routes. Loopback http and same-origin https give 200.
  - Exact fields: an extra key, a missing key or a wrong type is rejected. A body over 8 KB gives 413.
- **Generation route:**
  - A missing header or cross-origin request gives 403.
  - With `allowLan` off, a LAN peer gives 403. With it on, the request is allowed.
  - Disabled gives `unavailable` with no transport call.
- **Budgets:**
  - The minute, hour and day limits hold, and the day count survives a restart.
  - The breaker opens after 3 failures and closes after 10 minutes on a fake clock.
  - One request in flight at a time.
- **Providers:**
  - Timeouts, oversize replies, redirects, non-JSON, `refusal` and `max_tokens` stop reasons all give `unavailable`.
  - No retry happens: the fake records one call.
  - Discovery filters ids. The paid test requires the confirm string.
- **Pipeline:**
  - For each first-wave profile, a valid candidate is accepted and its answers equal the oracle.
  - Each of these is rejected: wrong spec type, out-of-predicate spec, extra key, digit in story, number word, missing or duplicated placeholder, name off the list, blocked word, URL, foreign currency, overlong slot, unbalanced choice labels, duplicate of a catalogue story, excluded fingerprint.
  - A model "answer" field is rejected as an extra key.
  - All three candidates bad gives `unavailable` with exactly one transport call.
- **Injection:**
  - Output containing "ignore previous instructions", HTML, script, markdown links or prompt-like text is rejected by the charset and blocklist checks.
  - A DOM test mounts an accepted package and confirms no element was created from slot text.
- **Builders:** with no context, the output of all eight profiles is byte-identical to today (snapshot).
- **Learner and preview artifact scans:** the new sentinels are absent from `dist-learner/`. No `sk-` patterns appear and no server module strings appear in `dist/`.

**Browser (Playwright):**

- `admin` spec, with a fake provider injected through an env flag that only the test server sets:
  - lock screen, wrong token, unlock
  - save key, then the masked hint is shown and the key is absent from page HTML and from every network response
  - discovery list, enable
  - paid test with confirm
  - block an example
  - all of the above at 390 px and 1280 px, plus a keyboard-only pass
- `novelty-off` spec: with the feature disabled, a first-wave lesson's "Try another" still gives a deterministic variant and no request reaches `/__novelty/example`.
- `novelty-on` spec, fake provider: the badge appears, and the attempt record shows "AI story".

**Manual live smoke test (optional, clearly labelled as manual and paid):** the user saves their own key on localhost, runs the paid test, and generates one example per first-wave profile. Record the result and approximate cost in the handover. Agents must not run it without the user present. It is not a substitute for human content review.

## 6. Architecture, contracts and dependencies

- **New ADR-010, "Server-side model novelty for development-preview examples":** the plugin handler, data root, auth model, fail-closed pipeline and runtime-only output.
- **Contract impact: none.** Package schema 3 and application contract 3 are unchanged. Generated packages are runtime-only, like fresh variants. The release manifest, approval register and learner artifact are untouched. The only type change is an optional field on the preview-only `VariantDescriptor`.
- **Dependencies:**
  - **No new dependencies.** Reuse `@anthropic-ai/sdk` 0.131.0 (already a dev dependency) for Anthropic, and Node 22 `fetch` for OpenAI-compatible providers.
  - **Consequence:** the feature works under `npm run dev` and `npm run preview` (dev dependencies installed). It is not part of any production deployment.
  - The annotation tool keeps its own environment-credential path, and the two features do not share keys. Unifying them is deferred.
- **Provider catalogue** (constants, in the aura-health `PROVIDERS` shape):
  - `anthropic`: SDK default base URL.
  - `openai`: `https://api.openai.com/v1`.
  - `openrouter`: `https://openrouter.ai/api/v1`.

  More vendors (DeepSeek, Tencent) are deferred.
- **Cost (an estimate, not measured):** one call is about 2k input and about 1.5k output tokens at low effort. At the cached Opus 5.5 rates ($4 input, $20 output per million tokens) that is roughly US$0.04, so the default 120-call daily cap is under about US$5 a day. Caching accepted examples lowers spend further.

## 7. Work packages

| WP | Content | Exit gate |
| --- | --- | --- |
| **WP0** | ADR-010; confirm the choice-balance checker's API from the parallel fix; ownership rows in `handover.md` | ADR written; dependency confirmed or WP3 marked blocked |
| **WP1** | `settings-store`, `admin-auth`, `handler` (admin routes), plugin wiring for serve and preview, `admin:token` script, `.env.example`, `.gitignore` | Store, auth and route unit tests pass; manual curl on loopback and over the LAN shows 200 and 403 |
| **WP2** | Provider catalogue, Anthropic SDK and OpenAI-compatible transports, discovery, paid test, budgets, breaker | Provider and budget tests pass with fakes; no network in the test run (network disabled) |
| **WP3** | `profiles.ts` (predicates moved from `generation.ts` with no behaviour change), schemas, `content-checks`, builder `context` slots, pipeline, cache, block list | Pipeline, injection and builder-snapshot tests pass; the existing generator tests are unchanged |
| **WP4** | `novelty-client.ts`, prefetch, badge, descriptor provenance, journal label, learner and preview sentinels | `npm test`, both builds, `test:release` pass; DOM tests for the badge and fallback |
| **WP5** | `admin.html` UI | Playwright admin, novelty-off and novelty-on specs pass at 390 and 1280 px, or are recorded as blocked (sandbox EPERM) |
| **WP6** | README, `implementation-status.md`, handover work log; optional live smoke test with the user | Docs updated; the smoke test is either recorded or listed as not done |

**Cut order if time runs short** (cut first at the top):

1. the "allow LAN" toggle (stay loopback-only)
2. OpenAI-compatible discovery (manual model id only)
3. the recent-examples list (keep Block through the cache file)
4. spec proposals (wording-only novelty on deterministic specs)

**Never cut:** auth, write-only keys, budgets, exact validators, deterministic answers, content checks, labels, artifact sentinels.

## 8. Risks

- **A LAN peer can spend budget** when `allowLan` is on. This is bounded by the daily cap, off by default, and the admin is warned.
- **Deterministic filters cannot judge suitability or semantic fit.** A story can be valid and still odd ("shares 2.5 kg of pencils"). Mitigations are the profile-specific unit allowlists, the label, and Block.
- **Untested provider shapes:** no live call has been made by this project (the annotation tool was never run live either). OpenRouter's JSON support varies by model, and local validation catches it, at the cost of more `unavailable` results.
- **Model text in `innerHTML` regions:** mitigated by the charset gate and a DOM test, but `lesson-view.ts` escaping is not verified.
- **Vite plugin as server:** `configurePreviewServer` middleware ordering and `vite.config.ts` bundling of `server/` imports are assumed and need to be checked in WP1.
- **Shared timing:** moving the profile predicates must not change the generator. The existing generator tests and fingerprints are the guard.

## 9. Open questions for the user (product-level only)

1. **Q1. Network devices:** should the child's tablet or phone on the home network get model stories (the "allow devices on this network" toggle)? The plan defaults to **off**, meaning model stories only on the computer running the preview.
2. **Q2. Adult approval first:** should a model story be shown to the child **immediately** with the "not checked yet" label (the plan's default), or only after an adult has approved it on the settings page (safer, less novelty)?
3. **Q3. Spending caps:** are the default daily caps (120 calls, an estimated US$5 at most per day on Opus 5.5) acceptable?
4. **Q4. Child-facing label:** is the wording "New story from a computer helper. A grown-up has not checked it yet." right for your child?

## 10. Not verified

- **No live call:** no provider has been called, and acceptance of the request shapes, structured output, `fallbacks: "default"`, discovery responses and real latency is unobserved.
- **Cost:** the cost figures are estimates from cached list prices, not measurements.
- **Vite preview and serve wiring:** the behaviour of `configurePreviewServer` with this middleware and of config-time bundling of `server/` is assumed.
- **Escaping and the choice checker:** the escaping of every `lesson-view.ts` text path, and the existence and API of the parallel choice-balance checker.
- **Context fit:** whether the curated name list, unit allowlists and blocklist are adequate for a Singapore P4 child. They need human review. Age-appropriateness of model text is not established by any test.
- **Browser and devices:** browser behaviour, real phones and tablets, and assistive technology. Playwright may again be blocked by sandbox EPERM.
- **Reference implementations:** compass and aura-health were read, not run, and their behaviour is taken from source.
