# Visual lesson authoring

**Prepared:** 2026-10-05, Codex.  
**Status:** Implemented after the completed single Claude review and Codex dispositions R-36–R-44; browser/device verification and human content approval remain outstanding.  
**User direction:** JSON stays as the raw format. The author interface must display the lesson as a learner sees it and provide simple editing on that view.

## 1. Problem and outcome

The previous `author.html` exposed a large JSON textarea, raw metadata and a separate-page preview. It makes an author translate between data fields and teaching output. The previous C1–C4 phase established a useful content pipeline, but its JSON interface is not the requested author experience.

Replace that primary interface with an actual lesson canvas and contextual editing. An author opens a lesson, selects the question, a diagram element, an answer choice or a hint, and edits it through ordinary text/number/select controls. The canvas updates in place. **Try as learner** runs the same lesson in the same workspace, with normal answer checking, hints and guided mode. The author never needs to write JSON, know field paths, or navigate to another page to see a change.

JSON remains the package/import/export format. Optional file import is data exchange; raw JSON editing and raw metadata blocks leave the normal author interface. There is no approval button or change to the publication boundary.

## 2. Actual baseline

- `src/author.ts` builds the JSON editor, catalogue, file import, diagnostic list and exports. Preview uses session storage then navigates to `index.html`.
- `src/main.ts` owns a detailed learner-style lesson view and event handlers. `src/learner.ts` independently renders a simpler approved-lesson view. Both already use the shared runtime and `lessonVisual`.
- `src/ui/visuals.ts` draws the masked comparison model and rotated angle cards. The package validator checks models, interpretation, source spans and fixtures, but treats literal prose/reflection as semantically unverified.
- Original lessons and seeded drafts use the same version-1 package contract. Teaching sequences remain fixed for the six supported forms.
- Last verified baseline: 56 unit/DOM tests, typecheck, lint, formatting, both builds and Node release checks pass. Ten browser tests are discoverable; actual browser/device/accessibility execution remains unverified.

## 3. Author workflow and screen

Use a responsive workspace with a lesson canvas in the main area and a contextual inspector beside it. On smaller screens the inspector follows the selected canvas region. Keep the current visual language and mathematical representations.

| Region | Behaviour |
| --- | --- |
| Header | Draft selector, New lesson, Edit / Try as learner switch, Undo / Redo, Save draft, download and review report |
| Lesson canvas | Actual learner typography, question, diagram, step navigation, choices and hints; editing affordances appear only in Edit |
| Contextual inspector | Friendly label and small controls for the selected region; no field-path or JSON knowledge required |
| Lesson details | Collapsible title, level, objective, author identity and source-reference fields |
| Status | Unsaved / saved-on-this-device state, actionable field errors and content-review warnings |

Click or keyboard-activate **Edit question**, **Edit choice**, **Edit hint**, or the diagram's editing control. Select the block and focus its inspector input. Typing updates the working draft and, when structurally valid, the lesson view without a page reload or caret jump. Multi-line text uses a textarea; controls remain ordinary accessible inputs rather than unrestricted HTML `contenteditable`.

In Edit, an author may inspect any step or any of the four hints without solving earlier steps. A labelled author-only answer control shows/sets authored explanation keys where applicable. This does not award learner completion or create support events.

In Try as learner, remove editing overlays and author-only answers from the canvas. Use the actual runtime, four hint rungs, answer masking, guided/independent mode and completion rules. Freeze the attempted package. Return to Edit to change it; a changed lesson starts a fresh trial attempt, clearly labelled. Author step navigation never bypasses progression in Try.

Opening or creating a different draft while there are unsaved changes gives Save / Discard / Stay choices within the app. Imported invalid content keeps the existing working draft and preview. Import and export remain optional toolbar actions labelled for authors rather than requiring raw editing.

## 4. Editable regions and mathematical dependencies

| Content | Editor | Dependency treatment |
| --- | --- | --- |
| Title, objective, step title, question/instructions | Plain-text fields attached to their visible blocks | Validate text; update exact source spans when task wording changes; meaning remains unverified |
| Choices and reflection | Choice text fields, author-only correct-choice controls, reorder controls | Preserve stable IDs when labels/order change. Numeric/geometric answers remain model-derived. Reflection meaning still needs human review |
| Four hints | Four labelled rung selectors and a text editor | Show the selected hint as it appears to a learner; fourth rung explicitly marked as a reveal |
| Comparison model | Person/object names, unit, smaller amount, difference, and which amount is unknown | Derive larger amount and numeric answer from one model; enforce positive quantities with larger at most 100; keep unknown labels masked in Try |
| Angle cards | Select card, opening control and rotation control | Opening presets plus bounded integer degree input; rotation -180..180. Degree controls are author-only. Identification/selection must retain the required right-angle count |
| Sources/authorship | Ordinary fields under Lesson details | HTTPS source references remain evidence, not remotely loaded assets. Existing authors are retained; the editor contributor is recorded |

Support the six existing forms first. **New lesson** asks for comparison unknown position or angle task form and creates an editable original template. It does not expose arbitrary step graphs, new topic adapters or raw answer-key data.

A model edit is one dependency transaction: update the model, numeric/geometric goal answers, comparison interpretation and mathematical fixtures together. A name/card-label edit also updates structured references. Do not modify only a number while leaving inconsistent fixtures that make the draft unusable.

**Text is a separate dependency.** Never use global number/name replacement to rewrite arbitrary imported prose. Offer **Update wording from this task**: propose coherent template wording, prompts, calculation hints and relevant explanation choices from the new model, show exactly which blocks would be replaced, then apply the selected replacement group as one undoable operation. This is deterministic template rendering, not AI interpretation.

Custom wording is retained unless the author chooses that replacement. After a model/name/card-target change, flag the affected question, choices and hints with **Check wording after this change**. The author can edit them directly and acknowledge the affected blocks in the author checklist; acknowledgements do not grant human review or remove the package's semantic warning. Generated templates derive reveal card names and calculation text from the model. Do not assert that acknowledgement or syntactic spans prove meaning.

When custom task wording changes, the editor rebuilds its exact text span and retains the structured interpretation as a draft proposal requiring review. Original source wording is retained in the workspace origin snapshot. Span updates maintain literal linkage only.

Fixed mathematical relationship meanings remain constrained. Authors may edit explanatory labels and ordering, but cannot change a model-derived correct relationship into a different mathematical rule. Reflection keys remain authored and explicitly unverified. The first delivery permits existing card/choice counts and reordering; adding/removing steps/cards or arbitrary branches is deferred.

## 5. Shared rendering and state ownership

Extract a shared lesson-view module from the existing presentation code. Both the development lesson app and the approved learner entry use it, and the author canvas embeds it. Reuse markup, styles, visual renderer and runtime behaviour; do not build a third approximate preview that diverges from the delivered learner view.

The shared view receives a lesson, adapter, session and presentation/action callbacks. It imports neither the draft catalogue nor author storage/editor code. Neutral region identifiers allow the author layer to attach selection controls outside the shared learner view. Author overlays, inspector and editing actions live in author-only modules. The learner build retains manifest-only data imports and its integrity check.

Separate three states:

1. **Working draft:** current author edits, including temporarily invalid values and incomplete typing.
2. **Last valid preview:** the latest package accepted by `validatePackage`, with its revision marker.
3. **Trial attempt:** independent runtime session against a frozen valid package revision.

Invalid partial input stays editable; do not replace it with the last valid number or erase it. Field errors appear beside controls. If the canvas still shows the last valid revision, display **Preview waiting for valid changes** so it cannot be mistaken for the current draft. Disable Try, Save and candidate export while structural errors remain. Review reports can still include errors. Preserve selection, focus and input composition when only the canvas changes; avoid rebuilding the entire inspector on each keystroke.

Every edit passes through a typed command/controller, not DOM-to-object arbitrary paths. Clone before transactions and validate before updating the valid preview. Group continuous typing in one field into an undo transaction; a committed model/wording change is atomic. Bound history to 30 snapshots. Undo/redo restores the complete package and related author checklist, not just visible text. Trying a lesson does not write edit history.

## 6. Saving, versioning and provenance

Provide **Save draft** in the app, with a saved-drafts selector. Store only bounded validated author snapshots in local browser storage; learner identity, results and progress remain unstored. Incomplete/invalid edits stay in memory with a clear unsaved state and a navigation guard. Automatic background learner-progress persistence is not part of this phase.

Each opened editing workspace gets its own new storage ID. Loading an existing saved draft forks a workspace rather than allowing two tabs to overwrite the same saved record. Subsequent saves in that page update only its own record. Keep at most ten saved workspaces, each bounded to the package limit plus a bounded origin snapshot; when full, ask the author to delete an explicitly chosen saved draft or download the current one. Never silently evict drafts. Deletion is a user-invoked UI action.

Catch storage reads/writes, malformed records and quota errors. Keep editing and downloading usable in memory with **Draft could not be saved on this device**. Do not overwrite corrupt records. This is local device storage, not account sync or a durability guarantee; show where Save writes.

Keep the original package immutable. The first material edit creates a proposed next content version; repeated edits of that working revision do not keep increasing the number. A fully undone draft returns to its baseline. A newly created lesson gets a stable new ID and version 1. Changing source lessons never overwrites repository files from the browser.

Retain existing authors and record the contributor through a normal Author field. Manually edited generated packages become authored drafts; do not keep claiming that their old seed reproduces the edited package. Preserve the original generated provenance/package in the local origin snapshot and review report. No new human-review identity or approval is created by editing.

Saved editor metadata/history/checklists stay outside the exported version-1 lesson package. Export the exact valid package and report its new canonical digest; all payload edits continue to require exact-digest review. The review report distinguishes origin, working revision, unresolved warnings and trial state. Try completion is never review evidence.

## 7. Sequence and ownership

| Slice | Deliverable | Integration gate |
| --- | --- | --- |
| V1: Shared lesson canvas | Extract presentation and use it in preview, learner entry and author | Existing six lessons retain behaviour in both modes; author/learner views use the same renderer; no draft/author imports leak into learner artifact |
| V2: Contextual editing | Region selection, ordinary field controls, topic model transactions, deterministic wording proposals | Both topics can be created and edited without JSON; model/answers/fixtures agree; invalid values stay editable; input focus and unknown masking preserved |
| V3: Working draft lifecycle | Undo/redo, local save/load, provenance/version handling, imports/exports/reports | Full snapshot restoration; storage-failure and fork isolation checks; exact export/reimport/digest behaviour; invalid import keeps work intact |

Keep TypeScript/Vite/native DOM; do not add a CMS backend, rich text framework or a new topic. Review the completed plan once, disposition findings, then integrate V1 → V2 → V3. Do not seek a second routine Claude pass.

After review, Codex can delegate exclusive modules: shared view/refactor; editor model and topic transactions; author layout/inspector. Lead owns integration, draft storage, release regression checks and docs. Agree controller/view APIs and record ownership before edits; maximum four active agents including lead.

## 8. Verification

Required unit/DOM evidence:

- Edit the story/question, choice, each hint and diagram controls in both topics; changes reach the same shared view used by learner entries.
- New lesson and save/load work without any raw JSON editing.
- A numeric change updates derived answers, interpretation and fixtures atomically; custom text is retained and visibly flagged until checked. Wording replacement produces coherent dependent blocks and can be undone completely.
- Right-angle target/rotation edits update model, answer, choices and reveal names; degree controls/correct answers do not appear in Try.
- Invalid partial input, IME composition and focused text remain intact while a last-valid preview is labelled. Invalid import does not replace work.
- Undo/redo restores IDs, version, provenance, teaching text, fixtures, interpretation and pending author checklist.
- Storage denial/full/corruption preserves the in-memory draft and export. Loading a saved draft in two workspaces creates separate save targets; no learner records are written.
- Edited content has a new digest and cannot borrow its previous release entry/reviews. The separate learner artifact contains no author controls, storage, draft catalogue or source-file fallback.

Add browser scenarios for selecting/editing canvas regions, an immediate visual model update, undo, saving/reopening, Try mode and keyboard operation at desktop/tablet widths. Run typecheck/lint/format/tests and both builds plus release integrity/separation checks. Obtain screenshots if the browser runs. Keep browser results explicitly unverified if execution is still denied; Node/DOM tests cannot certify layout or accessibility.

Human mathematical/pedagogical review remains separate. The reviewer register and actual release manifest stay empty until real evidence exists. No deployment, learner persistence, live AI, new maths topics or arbitrary construction/editor graphs is authorised by this plan.

## 9. Single Claude review brief

Read this plan, handover, current author/main/learner/runtime/visual modules and package validation/generation before commenting. Focus on whether the UI actually removes JSON work, uses the delivered learner view, preserves temporary edits/focus, handles dependent text safely, keeps valid/trial/draft state separate, prevents local save loss/collisions and retains digest/build boundaries. Prefer concrete failure examples and minimal remedies over expanding the CMS scope.

Append one consolidated findings set in handover, starting at the next unused ID (currently R-36). Do not rewrite the plan or implement during review. Codex then records accept/modify/reject/defer with reasons and proceeds under the user's authoring request. This new visual-authoring phase does not reopen the completed C1–C4 engineering review.

## 10. Codex decisions after review

The rich development lesson presentation is canonical for both author and learner views. This is a renderer-impact change: use six lessons in both modes as compatibility fixtures and keep actual release entries empty pending human review. Edit navigation uses a view model without a runtime session; Try is a fresh frozen-package attempt.

Unknown-position changes require explicit coherent model/wording application. A naive numeral-leak rule would wrongly reject known numbers equal to an unknown; text lint is advisory and semantic review remains necessary. Pending wording checks block candidate export/Try. Invalid angle-count input stays editable but cannot replace the valid canvas. Correct target reveals follow model updates.

Existing authors remain read-only; contributor IDs use the reviewer namespace format but actual identity is still maintainer-verified. Same-ID exported files replace the original path; archive older versions outside content/lessons. Save continuation uses an exclusive Web Lock when supported; otherwise saving forks a separate record and tells the author. Reports enumerate origin/working digests, changed blocks and timestamped author-only assertions. Raw JSON editor and obsolete preview handoff are removed. See handover for individual dispositions.


## 11. Delivered implementation

The shared `src/ui/lesson-view.ts` now renders author, development and learner views. The author canvas exposes contextual controls for teaching text, choices, hint rungs and both topic models; Edit owns no runtime session and Try freezes a fresh package. `src/authoring/model.ts` provides grouped undo/redo, last-valid preview, derived answers/fixtures, wording transactions, contributor/version/provenance handling and review reports. `src/authoring/storage.ts` provides bounded local drafts with exclusive Web Lock continuation or explicit copy fallback. The raw JSON editor and separate preview handoff were removed.

Ninety unit/DOM tests pass, including six lessons in both modes, focus/caret retention, invalid input, IME handling, wording dependencies, storage failures and release boundaries. Typecheck, lint, formatting, preview and learner builds, content validation, release-gate tests and artifact separation pass. Eleven Playwright scenarios are authored; browser execution could not start the configured local web server in this restricted environment. No screenshot, tablet/accessibility pass or verified deployment is claimed. See ADR 003 for renderer impact. Actual release entries and human review records remain empty.
