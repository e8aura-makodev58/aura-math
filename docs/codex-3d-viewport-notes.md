# Codex notes on Claude's 3D viewport

Recorded 2026-10-10 at the user's request: understand the completed viewport and retain knowledge for later improvements or lessons. This is a source-reading record, not an implementation phase or a completed independent disposition of R-91–R-110. No application changes, deployment, test execution or content approval were requested or performed.

Subsequently, the user authorised implementation of the remaining 2D lessons; see [Codex's 2D scope and outcome](codex-2d-manipulatives-plan.md). The snapshot below records what was learned before that implementation.

## What is present

The library currently contains **60 draft lessons across 16 topics**, including three hands-on nets lessons: `p4-fold-a-cube-net`, `p4-fold-a-net-that-fails`, and `p4-fold-a-solid`. The last uses a square pyramid as the learner's example and a cuboid as its demonstration; the model also supports triangular prisms. Model support does not mean each solid already has its own saved hands-on lesson.

The earlier manipulatives plan proposed SVG and also protractor/symmetry workbenches. Its initial status and renderer discussion are historical. The later amendment in [Claude's dispositions](interactive-manipulatives-dispositions.md) records the user's three.js direction, superseding the SVG choice. Do not mistake planned protractor/symmetry packages for delivered features. Saved manipulation history was explicitly deferred by the user.

## Architecture to preserve

| Layer              | Code                                          | Responsibility                                                                                                        |
| ------------------ | --------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| Topic and content  | `src/topics/nets.ts`, `src/authoring/nets.ts` | Validate task specifications, derive assessed answers, build teaching steps and author forms.                         |
| Pure folding model | `src/topics/nets-bench.ts`                    | Construct a stable hinge tree, apply bounded fold actions, supply deterministic demonstration keyframes.              |
| Scene              | `src/topics/nets-scene.ts`                    | Build nested face/pivot groups, textures and outlines; read back corners for tests; distinguish coincident faces.     |
| Viewport           | `src/topics/nets-viewport.ts`                 | Render with three.js/WebGL, frame the shape with an orthographic camera, tween turns, resize and handle context loss. |
| Lesson workbench   | `src/topics/nets-workbench.ts`                | Connect fold/view buttons, optional pointer rotation, Undo, hint reveal and answer selection.                         |
| Shared host        | `src/workbench/`, `src/ui/lesson-view.ts`     | Watch/Your turn chrome, player, lazy loading, answer bridge and mount/destroy lifecycle.                              |

The assessment does **not** depend on pixels or animation. Fold state is a bitmask: each crease is unfolded or folded to its model-defined angle. Cube quarter-turn endpoint geometry can be calculated exactly with integer matrices; other solids have their catalogue geometry and hinge angles. Intermediate floating-point angles are presentation data. Folding is deterministic and requires no LLM.

The scene uses a depth buffer rather than SVG painter ordering. This matters for non-cube solids and mid-fold views. Overlapping faces get a small drawing offset, dashed outlines and separated letters; that offset is a visual aid, not a change to the mathematical net.

The camera has custom yaw/pitch controls, not OrbitControls. Yaw wraps; pitch is bounded from 0 to 85 degrees. Framing follows the currently drawn corners. Rendering is requested on changes rather than running an idle continuous loop; device pixel ratio is capped at 2. The workbench is dynamically imported by the topic so unrelated lessons do not load its 3D code.

## Interaction and lifecycle

Watch operates on a separate authored demonstration. Your turn has its own fold state and answer chips. The existing answer controls remain available through a List version disclosure; Check still goes through the existing runtime. Manipulation alone is not recorded evidence that the learner understands the answer, and the list route does not require folding first.

Crease and camera buttons provide a keyboard route; dragging the canvas turns the view. Hint rung 4 switches to the learner's net and folds all creases, while the host records the hint as support. Reduced motion uses endpoint stills and disables automatic Watch playback.

The host keeps the workbench outside the visual region replaced by `innerHTML`. Trial restart, replay, replacement lesson, step change and completion destroy the old instance. Mode changes and wrong answers preserve it. Author wording edits preserve it; specification/step/choice changes rebuild it. A correct check locks it. Future changes must preserve these rules and release frames, timers, listeners, geometries, materials, textures and the renderer on destruction.

## How to add lessons later

For another lesson within current capabilities, use the nets author form/builders rather than hand-editing JSON. The hands-on task types are `fold`, `collide` and `fold-solid`. Cube tasks supply labelled learner/demo nets and floor faces; fold tasks also specify the face used for the opposite-face question. Validation constrains their geometry and demonstration relationship. Solid tasks select a supported catalogue solid and a different demonstration solid.

Rebuild the complete package so answers, choices, hints, worked steps and fixtures stay consistent. Add its library record, run `node scripts/bind-library.mjs`, and retain draft status until independent human content approval. Test the picture, mathematical answer and an independent oracle together, plus a complete browser interaction. A new solid needs validated catalogue geometry and hinge angles, not merely a new three.js mesh.

A future Try another feature for nets needs its own bounded generator profile and skill signature. The existing decimal/fraction generator does not automatically cover these new lessons. Rotation or relabelling alone should not be claimed as a distinct geometric problem.

## Candidate improvements, not implementation commitments

- Add dedicated cuboid and triangular-prism hands-on drafts using the existing model, then vary cube floor/opposite-face questions and valid/invalid nets. Keep school assessment coverage unclaimed until supplied.
- Reduce phone scrolling between the model, answer selection and Check. The inspected saved phone capture shows a long lesson with Check below the viewport and controls; test any consolidation at narrow widths and with large text before changing it.
- Examine camera framing during a fold: recomputing bounds each frame can make the shape's apparent scale change. A stable framing option may make comparisons easier.
- Verify recovery when WebGL is lost before a cached still exists and while folds continue. Current code retains buttons and fold state, but a cached picture can be absent or stale; a flat net is used when initial WebGL creation fails. Avoid claiming equivalent visual learning in fallback mode.
- Clarify that arbitrary crease sequences are a geometric demonstration, not a physical paper/collision simulator. Coincident endpoint marking does not establish collision-free motion through every intermediate state.

## Evidence and outstanding checks

Read the plan, review/dispositions including the three.js amendment, the modules above, author builders and unit/browser test source. Inspected the saved `p4-fold-a-solid-try-folded-page.png` screenshot; this is prior capture evidence, not a live browser check. The tests include pure reducers, independent axis-angle oracles, scene matrix read-back, solid closure, lifecycle, keyboard completion, reduced motion, touch emulation and WebGL fallback. Their presence is not a claim that Codex ran them today.

Claude's amendment reports successful scene/oracle comparisons and headless screenshots. Current handover/status summaries still largely describe the earlier 57-lesson phase, so they should not be used as a fresh consolidated viewport validation report. Bundle size and complete current suite results were not independently measured here. Real-device performance, Safari, native zoom, assistive technology, captions and pedagogical suitability remain to be checked. Formal independent assessment of Claude's review dispositions remains open; these learning notes do not silently close it.
