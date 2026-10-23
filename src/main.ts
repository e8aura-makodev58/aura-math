import {
  savedInstances,
  readExampleNumber,
  withExample,
  mountExamplePicker,
} from "./ui/example-picker";
import indexData from "../content/library.json";
import "./styles.css";
import "./p4.css";
import "./lesson.css";
import { fontNotices } from "./ui/font-notices";
import { packages } from "./content/lessons";
import { buildLibraryRecords, validateLibraryIndex } from "./library/catalogue";
import { adapters } from "./topics/registry";
import { loadLesson } from "./content/validation";
import { completionLabel } from "./core/runtime";
import { mountLessonView } from "./ui/lesson-view";
import { createVariantRun } from "./practice/generation";
import { createPracticeJournal } from "./practice/controller";
import { parseApprovedSets, type ApprovedSlotSet } from "./content/story-slots";
import {
  mountLibraryView,
  emptyLibraryState,
  libraryRoute,
  readLibraryRoute,
} from "./ui/library-view";
const app = document.querySelector<HTMLElement>("#app")!;
const index = validateLibraryIndex(indexData);
const collections = index.collections ?? [];
const records = buildLibraryRecords(packages, index);
let state = emptyLibraryState();
let library: ReturnType<typeof mountLibraryView> | undefined;
let view: ReturnType<typeof mountLessonView> | undefined;
const results = new Map<string, string>();
const journal = createPracticeJournal();
/**
 * Adult-approved story slot sets from the development server (Phase B3). Read-only, re-checked
 * here; on any failure the preview silently keeps the built-in story frames.
 */
let approvedStories: ApprovedSlotSet[] = [];
const approvedReady = fetch("/api/stories/approved", {
  cache: "no-store",
  credentials: "same-origin",
})
  .then((response) => (response.ok ? response.json() : null))
  .then((data) => {
    approvedStories = parseApprovedSets(data);
  })
  .catch(() => undefined);
void approvedReady;
const STORY_HELPER_NOTE =
  "Story words suggested by a computer helper and checked by a grown-up.";
function showStoryOrigin(root: HTMLElement) {
  const story = root.querySelector<HTMLElement>('[data-region="story"]');
  if (!story) return;
  let note = root.querySelector<HTMLElement>(".story-origin-note");
  const used = !!journal.getActive()?.variant?.approvedStoryId;
  if (!used) {
    note?.remove();
    return;
  }
  if (!note) {
    note = document.createElement("p");
    note.className = "story-origin-note";
    note.dataset.testid = "story-origin-note";
    note.textContent = STORY_HELPER_NOTE;
    // Styled inline so the shared (learner) stylesheets carry nothing for this preview-only note.
    note.style.cssText =
      "margin:6px 0 10px;font-size:14px;line-height:1.4;font-style:italic;color:#4f5d53";
    story.after(note);
  }
}

function captureCurrent(reason: "exit" | "next") {
  const attempt = view?.getSession();
  if (!attempt) return;
  const summary = journal.record(attempt, reason);
  if (summary?.completed && !summary.variant)
    results.set(summary.sourceId, completionLabel(attempt));
}

function showPracticeRecord(root: HTMLElement) {
  const summaries = journal.getSummaries();
  let panel = root.querySelector<HTMLDetailsElement>(".practice-record");
  if (!summaries.length) return;
  if (!panel) {
    panel = document.createElement("details");
    panel.className = "practice-record";
    root.append(panel);
  }
  const expanded = panel.open;
  panel.replaceChildren();
  const heading = document.createElement("summary");
  heading.textContent = `This practice session · ${summaries.length} recorded ${summaries.length === 1 ? "attempt" : "attempts"}`;
  const note = document.createElement("p");
  note.textContent =
    "Temporary record of your latest 20 attempts. Refresh clears it and returns to the original example. The app cannot observe help from another person.";
  const list = document.createElement("ol");
  for (const summary of summaries) {
    const item = document.createElement("li");
    const title = packages.find((p) => p.lesson.id === summary.sourceId)?.lesson
      .title;
    const exampleParent = index.lessons.find((p) =>
      p.examples?.includes(summary.sourceId),
    );
    const instanceLabel = summary.variant
      ? "Fresh preview variant"
      : exampleParent
        ? `Saved example ${exampleParent.examples!.indexOf(summary.sourceId) + 2}`
        : "Original example";
    item.textContent = `${title ?? "Practice"} · ${instanceLabel}${summary.repeatedExample ? " · repeated" : ""} · ${summary.completed ? summary.label : "Attempt ended before completion"} · ${summary.submissions} checked ${summary.submissions === 1 ? "answer" : "answers"}`;
    list.append(item);
  }
  panel.append(heading, note, list);
  panel.open = expanded;
}
function shell() {
  app.innerHTML =
    '<div class="app-layout"><header class="app-header"><a class="app-brand" href="#library">Aura Math<span>Small steps. Clear thinking.</span></a><a href="/author.html" class="author-entry">Author workspace →</a></header><p class="preview-notice">Development preview · draft content, not reviewed by a teacher. P4 lessons have 6 saved examples each: use “Next example” inside a lesson. Session completion is not saved.</p><main id="main" tabindex="-1"></main></div>';
  fontNotices(app);
  return app.querySelector<HTMLElement>("main")!;
}
function route(id?: string, example = 1) {
  history.replaceState(null, "", withExample(libraryRoute(state, id), example));
}
function home(restore = false) {
  if (library) state = library.getState();
  captureCurrent("exit");
  view?.destroy();
  view = undefined;
  const root = shell();
  const host = document.createElement("div");
  root.append(host);
  library = mountLibraryView(host, {
    records,
    collections,
    draft: true,
    state,
    results,
    onOpen: (r) => open(r.lesson.id),
    onStateChange: (s) => {
      state = s;
      route();
    },
  });
  if (restore) library.restore(state);
  route();
}
function open(id: string, example = 1) {
  const record = records.find((r) => r.lesson.id === id);
  if (!record) {
    home();
    return;
  }
  if (library) {
    state = library.getState();
    library = undefined;
  }
  const mode = view?.getSession()?.mode;
  captureCurrent("next");
  view?.destroy();
  const root = shell();
  const instances = savedInstances(index, id, packages);
  if (example < 1 || example > instances.length) example = 1;
  const source = instances[example - 1];
  const lesson = loadLesson(source.lesson, "preview");
  const seed = crypto.getRandomValues(new Uint32Array(1))[0];
  // Availability does not depend on approved stories; the run itself is made on the first
  // "Try another", with the approved snapshot known by then.
  const variantsAvailable = createVariantRun(source, seed) !== null;
  let run: ReturnType<typeof createVariantRun> = null;
  const variants = variantsAvailable
    ? {
        next: () =>
          (run ??= createVariantRun(source, seed, approvedStories))!.next(),
        restart: () =>
          (run ??= createVariantRun(source, seed, approvedStories))!.restart(),
      }
    : null;
  journal.begin({ sourceId: source.lesson.id, lessonId: lesson.id });
  const nextVariant = () => {
    if (!variants)
      return { error: "New examples are unavailable for this task." };
    const candidate = variants.next();
    if (candidate.status !== "ready") return { error: candidate.message };
    captureCurrent("next");
    journal.begin({
      sourceId: id,
      lessonId: candidate.package.lesson.id,
      variant: candidate.descriptor,
    });
    return { lesson: candidate.package.lesson };
  };
  const practiceIds = state.practice
    ? collections.find((c) => c.id === state.collection)?.practiceIds
    : undefined;
  const next = practiceIds
    ? practiceIds
        .map((id) => records.find((r) => r.lesson.id === id))
        .filter((r): r is typeof record => !!r)
    : records
        .filter((r) => r.topic === record.topic)
        .sort((a, b) => a.sequence - b.sequence);
  const later = next[next.findIndex((r) => r.lesson.id === id) + 1];
  root.dataset.topic = record.topic;
  view = mountLessonView(root, {
    lesson,
    adapter: adapters[lesson.topic],
    onTryAnother: variants ? nextVariant : undefined,
    onRestartVariants: variants
      ? () => {
          variants.restart();
          return nextVariant();
        }
      : undefined,
    onAttemptEnd: (attempt, reason) => {
      const summary = journal.record(attempt, reason);
      if (summary?.completed && !summary.variant)
        results.set(summary.sourceId, completionLabel(attempt));
      if (summary && (reason === "replay" || reason === "restart")) {
        const identity = journal.getActive();
        if (identity) journal.begin(identity, true);
      }
      showPracticeRecord(root);
    },
    onRender: () => {
      showPracticeRecord(root);
      showStoryOrigin(root);
      mountExamplePicker(root, {
        number: example,
        count: instances.length,
        temporary: !!journal.getActive()?.variant,
        onChange: (n) => open(id, n),
      });
    },
    onExit: () => {
      home(true);
    },
    nextLessonLabel: state.practice ? "Next mixed question →" : undefined,
    onNextLesson: later ? () => open(later.lesson.id) : undefined,
  });
  view.startTrial(lesson, mode);
  route(id, example);
}
function navigate() {
  library?.destroy();
  library = undefined;
  const parsed = readLibraryRoute(location.hash, records, collections);
  state = parsed.state;
  if (parsed.lessonId)
    open(
      parsed.lessonId,
      readExampleNumber(
        location.hash,
        savedInstances(index, parsed.lessonId, packages).length,
      ),
    );
  else home();
}
window.addEventListener("hashchange", navigate);
navigate();
