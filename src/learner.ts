import {
  savedInstances,
  readExampleNumber,
  withExample,
  mountExamplePicker,
} from "./ui/example-picker";
import "./styles.css";
import "./p4.css";
import "./lesson.css";
import { fontNotices } from "./ui/font-notices";
import approved, {
  releasedLibrary,
  unreviewedLabel,
} from "virtual:approved-lessons";
import { mountLessonView } from "./ui/lesson-view";
import {
  mountLibraryView,
  emptyLibraryState,
  readLibraryRoute,
  libraryRoute,
} from "./ui/library-view";
import { buildLibraryRecords } from "./library/catalogue";
import { adapters } from "./topics/registry";
import { loadReleasedContent, verifyReleasedLibrary } from "./released-content";
const root = document.querySelector<HTMLElement>("#app")!;
async function start() {
  await loadReleasedContent(approved);
  await verifyReleasedLibrary(releasedLibrary, approved);
  const records = buildLibraryRecords(
    approved.map((e) => e.payload),
    releasedLibrary.index,
  );
  const collections = releasedLibrary.index.collections ?? [];
  let state = emptyLibraryState();
  let library: ReturnType<typeof mountLibraryView> | undefined;
  let view: ReturnType<typeof mountLessonView> | undefined;
  // Lessons published without teacher review carry the publisher's label (decision 25).
  const unreviewed = new Set(
    approved.filter((e) => e.reviewed !== true).map((e) => e.id),
  );
  const label = unreviewedLabel.trim() || "Not reviewed by a teacher.";
  function shell(note?: "home" | "lesson") {
    root.innerHTML =
      '<div class="app-layout"><header class="app-header"><a class="app-brand" href="#library">Aura Math<span>Small steps. Clear thinking.</span></a></header><main id="main" tabindex="-1"></main></div>';
    if (note) {
      const p = document.createElement("p");
      p.className = "review-note";
      p.dataset.reviewNote = note;
      p.setAttribute("role", "note");
      p.textContent = label;
      root.querySelector(".app-header")!.after(p);
    }
    fontNotices(root);
    return root.querySelector<HTMLElement>("main")!;
  }
  function home(restore = false) {
    if (library) state = library.getState();
    view?.destroy();
    view = undefined;
    const host = shell(unreviewed.size ? "home" : undefined);
    const content = document.createElement("div");
    host.append(content);
    library = mountLibraryView(content, {
      records,
      collections,
      state,
      onOpen: (r) => open(r.lesson.id),
      onStateChange: (s) => {
        state = s;
        history.replaceState(null, "", libraryRoute(state));
      },
    });
    if (restore) library.restore(state);
    history.replaceState(null, "", libraryRoute(state));
  }
  function open(id: string, example = 1) {
    const r = records.find((r) => r.lesson.id === id);
    if (!r) {
      home();
      return;
    }
    if (library) {
      state = library.getState();
      library = undefined;
    }
    const mode = view?.getSession()?.mode;
    view?.destroy();
    const instances = savedInstances(
      releasedLibrary.index,
      id,
      approved.map((e) => e.payload),
    );
    if (example < 1 || example > instances.length) example = 1;
    const selected = instances[example - 1].lesson;
    const practiceIds = state.practice
      ? collections.find((c) => c.id === state.collection)?.practiceIds
      : undefined;
    const next = practiceIds
      ? practiceIds
          .map((id) => records.find((x) => x.lesson.id === id))
          .filter((x): x is typeof r => !!x)
      : records
          .filter((x) => x.topic === r.topic)
          .sort((a, b) => a.sequence - b.sequence);
    const later = next[next.findIndex((x) => x.lesson.id === id) + 1];
    const host = shell(unreviewed.has(selected.id) ? "lesson" : undefined);
    host.dataset.topic = r.topic;
    view = mountLessonView(host, {
      lesson: selected,
      onRender: () =>
        mountExamplePicker(host, {
          number: example,
          count: instances.length,
          onChange: (n) => open(id, n),
        }),
      adapter: adapters[r.lesson.topic],
      onExit: () => home(true),
      nextLessonLabel: state.practice ? "Next mixed question →" : undefined,
      onNextLesson: later ? () => open(later.lesson.id) : undefined,
    });
    view.startTrial(selected, mode);
    history.replaceState(
      null,
      "",
      withExample(libraryRoute(state, id), example),
    );
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
          savedInstances(
            releasedLibrary.index,
            parsed.lessonId,
            approved.map((e) => e.payload),
          ).length,
        ),
      );
    else home();
  }
  window.addEventListener("hashchange", navigate);
  navigate();
}
root.textContent = "Loading lessons…";
void start().catch(() => {
  root.textContent =
    "Approved lesson data could not be verified. Please reload or contact the lesson publisher.";
});
