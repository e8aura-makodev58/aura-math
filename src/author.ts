import { annotationTopics } from "./annotation/topics";
import type { AnnotationPlan } from "./annotation/plan";
import { createDimensionPanel } from "./authoring/dimension-panel";
import indexData from "../content/library.json";
import "./styles.css";
import "./p4.css";
import { fontNotices } from "./ui/font-notices";
import "./author.css";
import "./lesson.css";
import { packages } from "./content/lessons";
import {
  MAX_PACKAGE_BYTES,
  parsePackage,
  type LessonPackage,
} from "./content/package-validation";
import {
  createAuthorModel,
  createTemplate,
  type AuthorCommand,
} from "./authoring/model";
import {
  listDrafts,
  loadDraft,
  saveDraft,
  deleteDraft,
  claimDraft,
} from "./authoring/storage";
import { mountLessonView } from "./ui/lesson-view";
import { adapters } from "./topics/registry";
import { allTopicForms, topicFields } from "./authoring/registry";
import { buildLibraryRecords, validateLibraryIndex } from "./library/catalogue";
import { mountLibraryView, emptyLibraryState } from "./ui/library-view";

function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  text?: string,
): HTMLElementTagNameMap[K] {
  const value = document.createElement(tag);
  if (text !== undefined) value.textContent = text;
  return value;
}
function button(label: string, action: string, run: () => void) {
  const value = el("button", label);
  value.type = "button";
  value.dataset.action = action;
  value.addEventListener("click", run);
  return value;
}
function download(text: string, filename: string) {
  const url = URL.createObjectURL(
    new Blob([text], { type: "application/json" }),
  );
  const link = el("a");
  link.href = url;
  link.download = filename;
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}
const newId = () =>
  `draft-${globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`}`;
const friendly = (path: string) =>
  path.includes("hints")
    ? "Hint wording"
    : path.includes("choice")
      ? "Answer choices"
      : path.includes("story")
        ? "Task wording"
        : path.includes("specification") || path.includes("interpretation")
          ? "Diagram and quantities"
          : path.includes("prompt")
            ? "Question"
            : path.includes("source")
              ? "Source evidence"
              : path.includes("title")
                ? "Title"
                : "Lesson details";

export function mountAuthor(root: HTMLElement) {
  root.replaceChildren();
  root.className = "author-workspace";
  let model = createAuthorModel(packages[0]);
  let origin = structuredClone(packages[0]);
  let savedSnapshot = JSON.stringify(model.working);
  let recordId: string | undefined;
  let releaseClaim: (() => void) | null = null;
  let stepIndex = 0,
    hintRung = 1,
    selected = "story",
    trying = false,
    fileBusy = false;
  let saving = false;
  let savedOnDevice = false;
  let browsing = true;
  let libraryTab = "starters";
  let libraryState = emptyLibraryState();
  let libraryView: ReturnType<typeof mountLibraryView> | undefined;
  let inspectorOpen = false;
  let inspectorOpener: HTMLElement | null = null;
  let contributorInvalid = false;
  let view: ReturnType<typeof mountLessonView> | undefined;
  let suspendedSwitch: (() => void) | undefined;
  const head = el("header");
  head.className = "author-header";
  const heading = el("div");
  heading.append(
    el("p", "AURA MATH · AUTHOR STUDIO"),
    el("h1", "Author library"),
  );
  const intro = el(
    "p",
    "Draft workspace · human mathematical and teaching review still required.",
  );
  const toolbar = el("div");
  toolbar.className = "author-toolbar";
  const source = el("select");
  source.id = "draft-catalogue";
  source.setAttribute("aria-label", "Source lesson");
  packages
    .filter((p) => indexData.lessons.some((l) => l.lessonId === p.lesson.id))
    .forEach((p) => {
      const o = el("option", p.lesson.title);
      o.value = p.lesson.id;
      source.append(o);
    });
  const forms = el("select");
  forms.setAttribute("aria-label", "New lesson form");
  forms.id = "new-form";
  const formDefinitions = allTopicForms();
  formDefinitions.forEach((form) => {
    const option = el("option", form.label);
    option.value = ["comparison", "angles"].includes(form.topic)
      ? form.id
      : `${form.topic}:${form.id}`;
    forms.append(option);
  });
  const saved = el("select");
  saved.id = "saved-drafts";
  saved.setAttribute("aria-label", "Saved on this device");
  const status = el("p");
  status.className = "author-status";
  status.setAttribute("role", "status");
  status.dataset.testid = "author-status";
  const live = el("p");
  live.setAttribute("aria-live", "polite");
  live.className = "author-message";
  const issues = el("ul");
  issues.className = "author-issues";
  issues.dataset.testid = "author-issues";
  const guard = el("section");
  guard.className = "author-guard";
  guard.hidden = true;
  guard.setAttribute("role", "dialog");
  guard.setAttribute("aria-label", "Unsaved changes");
  guard.tabIndex = -1;
  const guardMessage = el(
    "p",
    "You have unsaved changes. Save this draft before switching?",
  );
  const guardSave = button("Save and switch", "guard-save", () => {
    void save().then((ok) => {
      if (ok && !unsaved()) {
        const go = suspendedSwitch;
        suspendedSwitch = undefined;
        guard.hidden = true;
        go?.();
      }
    });
  });
  guard.append(
    guardMessage,
    guardSave,
    button("Discard and switch", "guard-discard", () => {
      const go = suspendedSwitch;
      suspendedSwitch = undefined;
      guard.hidden = true;
      go?.();
    }),
    button("Stay here", "guard-stay", () => {
      suspendedSwitch = undefined;
      guard.hidden = true;
    }),
  );
  const workspace = el("div");
  workspace.className = "author-columns";
  const canvasColumn = el("section");
  canvasColumn.className = "author-canvas-column";
  const nav = el("div");
  nav.className = "author-step-nav";
  const stepSelect = el("select");
  stepSelect.id = "author-step";
  stepSelect.setAttribute("aria-label", "Inspect lesson step");
  nav.append(el("span", "Inspect step"), stepSelect);
  const canvasNotice = el("p");
  canvasNotice.className = "author-canvas-notice";
  const canvas = el("div");
  canvas.className = "author-canvas";
  canvas.dataset.testid = "author-canvas";
  canvasColumn.append(nav, canvasNotice, canvas);
  const inspector = el("aside");
  inspector.className = "author-inspector";
  inspector.setAttribute("aria-label", "Lesson editor");
  const inspectorBody = el("div");
  const fieldIssues = el("p");
  fieldIssues.className = "author-field-error";
  fieldIssues.setAttribute("role", "status");
  const checklist = el("section");
  checklist.className = "author-checklist";
  const wording = el("section");
  wording.className = "author-wording";
  wording.hidden = true;
  const inspectorClose = button(
    "Done editing",
    "close-inspector",
    closeInspector,
  );
  const inspectorContext = el("p");
  inspectorContext.className = "inspector-context";
  inspector.append(
    inspectorClose,
    inspectorContext,
    inspectorBody,
    fieldIssues,
    checklist,
    wording,
  );
  inspector.addEventListener("keydown", inspectorKeys);

  workspace.append(canvasColumn, inspector);
  const controls = new Map<string, HTMLButtonElement>();
  const add = (label: string, id: string, run: () => void) => {
    const b = button(label, id, run);
    toolbar.append(b);
    controls.set(id, b);
    return b;
  };
  toolbar.append(source);
  add("Open source", "open-source", () =>
    requestSwitch(() =>
      open(packages.find((p) => p.lesson.id === source.value)!),
    ),
  );
  toolbar.append(forms);
  add("New lesson", "new", showChooser);
  add("Edit", "edit", () => {
    trying = false;
    view?.showEdit({ stepIndex, hintRung });
    refresh();
    renderInspector();
  });
  add("Try as learner", "try", () => {
    if (!ready()) return;
    closeInspector();
    trying = true;
    view?.startTrial(model.lastValid.lesson);
    live.textContent =
      "A fresh trial is running. Return to Edit to change this lesson.";
    refresh(false);
    renderInspector();
  });
  add("Undo", "undo", () => {
    model.endEdit();
    model.undo();
    refresh();
    renderInspector();
  });
  add("Redo", "redo", () => {
    model.endEdit();
    model.redo();
    refresh();
    renderInspector();
  });
  add("Checks", "inspect-checks", () => {
    selected = "visual";
    revealInspector(controls.get("inspect-checks")!);
    checklist.scrollIntoView?.({ block: "nearest" });
  });
  add("Save draft", "save", () => {
    void save();
  });
  add("Save as copy", "save-copy", () => {
    void save(true);
  });
  add("Download lesson", "download", () => {
    if (ready()) download(exportJson(), `${model.working.lesson.id}.json`);
  });
  add("Review report", "report", () => {
    void model
      .report()
      .then((report) =>
        download(
          JSON.stringify(
            { ...report, trial: view?.getSession() ?? null },
            null,
            2,
          ),
          "aura-review-report.json",
        ),
      )
      .catch(showError);
  });
  const file = el("input");
  file.type = "file";
  file.accept = ".json,application/json";
  file.id = "draft-file";
  file.setAttribute("aria-label", "Import lesson file");
  const imports = el("details");
  imports.className = "author-device";
  imports.append(el("summary", "Files and saved drafts"));
  const importLabel = el("label", "Import a lesson file");
  importLabel.htmlFor = "draft-file";
  imports.append(
    importLabel,
    file,
    saved,
    button("Open saved draft", "open-saved", () =>
      requestSwitch(() => {
        void openSaved();
      }),
    ),
    button("Delete selected saved draft", "delete-saved", () => {
      if (!saved.value) return;
      const id = saved.value;
      const confirm = el("div");
      confirm.append(
        el("p", "Delete this saved copy from this device?"),
        button("Delete this copy", "confirm-delete", () => {
          void (async () => {
            let temporaryClaim: (() => void) | null = null;
            try {
              if (id !== recordId) temporaryClaim = await claimDraft(id);
              deleteDraft(id);
              if (id === recordId) {
                releaseClaim?.();
                releaseClaim = null;
                recordId = undefined;
                savedSnapshot = "";
                refresh(false);
              }
              refreshSaved();
              if (browsing) showLibrary();
              live.textContent =
                "Saved copy deleted. Your open lesson remains in memory.";
            } catch (e) {
              showError(e);
            } finally {
              temporaryClaim?.();
            }
            confirm.remove();
          })();
        }),
        button("Keep copy", "cancel-delete", () => confirm.remove()),
      );
      imports.append(confirm);
    }),
    el(
      "p",
      "Saved only on this browser/device. No account sync or guaranteed backup. Download a copy to keep it.",
    ),
  );
  const more = el("details");
  more.className = "author-more";
  more.append(el("summary", "More"));
  const moreBody = el("div");
  moreBody.className = "author-more-body";
  more.append(moreBody);
  moreBody.append(
    source,
    controls.get("open-source")!,
    controls.get("save-copy")!,
    controls.get("download")!,
    controls.get("report")!,
    imports,
  );
  forms.hidden = true;
  controls.get("new")!.hidden = true;
  moreBody.append(forms, controls.get("new")!);
  toolbar.prepend(
    button("← Library", "library", () => requestSwitch(() => showLibrary())),
  );
  toolbar.append(more);
  const authorLibrary = el("section");
  authorLibrary.className = "author-library";
  const libraryTabs = el("div");
  libraryTabs.className = "author-library-tabs";
  libraryTabs.setAttribute("role", "group");
  libraryTabs.setAttribute("aria-label", "Author materials");
  const starterTab = button("Starter lessons", "starters", () => {
    libraryTab = "starters";
    showLibrary();
  });
  const draftTab = button("My drafts", "drafts", () => {
    libraryTab = "drafts";
    showLibrary();
  });
  const newButton = button("New lesson", "choose-new", showChooser);
  newButton.className = "primary-button";
  libraryTabs.append(starterTab, draftTab, newButton);
  const libraryContent = el("div");
  authorLibrary.append(libraryTabs, libraryContent);
  const chooser = el("section");
  chooser.className = "author-chooser";
  chooser.hidden = true;
  chooser.setAttribute("aria-label", "New lesson chooser");
  const chooserDescription = el("p");
  const chooserPreview = el("div");
  chooserPreview.className = "chooser-preview";
  const chooserSelect = el("select");
  chooserSelect.setAttribute("aria-label", "New topic and task");
  for (const option of forms.options)
    chooserSelect.append(option.cloneNode(true));
  let chooserView: ReturnType<typeof mountLessonView> | undefined;
  chooser.append(
    el("h2", "Start with a task"),
    el(
      "p",
      "Choose a supported model. You can change the wording and values after creating it.",
    ),
    chooserSelect,
    chooserDescription,
    chooserPreview,
    button("Create lesson", "create-lesson", () =>
      requestSwitch(() => {
        const definition = definitionFor(chooserSelect.value);
        if (!definition) return;
        const template = createTemplate(
          definition.topic,
          definition.id,
          newId(),
        );
        chooser.hidden = true;
        chooserView?.destroy();
        open(template, true);
      }),
    ),
    button("Back to library", "close-chooser", () => {
      chooser.hidden = true;
      chooserView?.destroy();
      showLibrary();
    }),
  );
  head.append(heading, intro, toolbar, status, live, guard, issues);
  root.append(head, authorLibrary, chooser, workspace);
  function definitionFor(value: string) {
    return formDefinitions.find(
      (f) =>
        (["comparison", "angles"].includes(f.topic)
          ? f.id
          : `${f.topic}:${f.id}`) === value,
    );
  }
  function previewForm() {
    const definition = definitionFor(chooserSelect.value);
    if (!definition) return;
    chooserDescription.textContent = definition.description;
    chooserView?.destroy();
    const p = createTemplate(
      definition.topic,
      definition.id,
      "new-task-preview",
    );
    chooserView = mountLessonView(chooserPreview, {
      lesson: p.lesson,
      adapter: adapters[p.lesson.topic],
    });
  }
  chooserSelect.addEventListener("change", previewForm);
  function showChooser() {
    requestSwitch(() => {
      browsing = true;
      toolbar.hidden = true;
      workspace.hidden = true;
      authorLibrary.hidden = true;
      chooser.hidden = false;
      chooserSelect.value = forms.value;
      previewForm();
      chooserSelect.focus();
    });
  }
  function showLibrary() {
    browsing = true;
    trying = false;
    view?.showEdit({ stepIndex, hintRung });
    closeInspector();
    workspace.hidden = true;
    toolbar.hidden = true;
    status.hidden = true;
    issues.hidden = true;
    chooser.hidden = true;
    authorLibrary.hidden = false;
    heading.querySelector("h1")!.textContent = "Author library";
    starterTab.setAttribute("aria-pressed", String(libraryTab === "starters"));
    draftTab.setAttribute("aria-pressed", String(libraryTab === "drafts"));
    if (libraryView) libraryState = libraryView.getState();
    libraryView?.destroy();
    if (libraryTab === "starters") {
      libraryView = mountLibraryView(libraryContent, {
        surface: "author",
        records: buildLibraryRecords(packages, validateLibraryIndex(indexData)),
        draft: true,
        actionLabel: "Open",
        state: libraryState,
        onOpen: (r) =>
          requestSwitch(() =>
            open(packages.find((p) => p.lesson.id === r.lesson.id)!),
          ),
        onCopy: (r) =>
          requestSwitch(() => {
            const sourcePackage = packages.find(
              (p) => p.lesson.id === r.lesson.id,
            )!;
            const copy = structuredClone(sourcePackage);
            copy.lesson.id = newId();
            copy.lesson.version = 1;
            copy.provenance = { kind: "authored" };
            open(copy, true, sourcePackage);
          }),
      });
    } else {
      libraryContent.replaceChildren();
      try {
        const drafts = listDrafts();
        const draftHost = el("div");
        libraryContent.append(
          el(
            "p",
            `Saved on this browser/device only · ${drafts.length} of 10 slots used. Download copies for backup.`,
          ),
          draftHost,
        );
        const captions = new Map(
          drafts.map((d) => [
            d.payload.lesson.id,
            `Version ${d.payload.lesson.version} · saved ${new Date(d.savedAt).toLocaleString()}`,
          ]),
        );
        // Saved copies may share the package ID; give cards a view-only ID so each stored record stays selectable.
        const viewPackages = drafts.map((d) => {
          const p = structuredClone(d.payload);
          p.lesson.id = d.id;
          return p;
        });
        libraryView = mountLibraryView(draftHost, {
          surface: "author",
          records: buildLibraryRecords(
            viewPackages,
            validateLibraryIndex(indexData),
          ),
          draft: true,
          actionLabel: "Continue",
          state: libraryState,
          captions: new Map(
            drafts.map((d) => [d.id, captions.get(d.payload.lesson.id)!]),
          ),
          onOpen: (r) =>
            requestSwitch(() => {
              saved.value = r.lesson.id;
              void openSaved();
            }),
          onDelete: (r) => {
            saved.value = r.lesson.id;
            imports.open = true;
            imports.hidden = false;
            libraryContent.append(imports);
            imports
              .querySelector<HTMLButtonElement>('[data-action="delete-saved"]')
              ?.click();
          },
        });
        if (!drafts.length)
          draftHost.querySelector(".library-empty p")!.textContent =
            "Open a starter or create a lesson, then Save draft. Your drafts stay on this device.";
      } catch (error) {
        showError(error);
      }
    }
  }
  function closeInspector() {
    inspectorOpen = false;
    head.inert = false;
    canvasColumn.inert = false;
    inspector.classList.remove("is-open");
    inspector.removeAttribute("aria-modal");
    inspector.setAttribute("role", "complementary");
    const currentOpener = inspectorOpener?.isConnected
      ? inspectorOpener
      : [...canvas.querySelectorAll<HTMLElement>("[data-action]")].find(
          (n) => n.dataset.action === inspectorOpener?.dataset.action,
        );
    currentOpener?.focus({ preventScroll: true });
  }
  function inspectorKeys(event: KeyboardEvent) {
    if (event.key === "Escape" && inspectorOpen) {
      event.preventDefault();
      event.stopPropagation();
      closeInspector();
    }
    if (event.key === "Tab" && inspectorOpen && window.innerWidth < 768) {
      const nodes = [
        ...inspector.querySelectorAll<HTMLElement>(
          "button:not(:disabled),input,textarea,select,summary",
        ),
      ].filter(
        (n) =>
          !n.closest("[hidden]") &&
          (!n.closest("details") ||
            n.closest("details")!.open ||
            n.tagName === "SUMMARY"),
      );
      const first = nodes[0],
        last = nodes[nodes.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last?.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first?.focus();
      }
    }
  }
  function revealInspector(opener: HTMLElement) {
    inspectorOpener = opener;
    inspectorOpen = true;
    inspector.classList.add("is-open");
    const phone = window.innerWidth < 768;
    head.inert = phone;
    canvasColumn.inert = phone;
    inspector.setAttribute("role", phone ? "dialog" : "complementary");
    if (phone) inspector.setAttribute("aria-modal", "true");
    const region = opener.parentElement;
    // Prefer the region's accessible description: raw textContent of a diagram runs words and numbers together.
    inspectorContext.textContent = (
      region
        ?.querySelector("[role='img'][aria-label]")
        ?.getAttribute("aria-label") ??
      region?.textContent?.replace(opener.textContent ?? "", "") ??
      ""
    ).slice(0, 220);
    opener.parentElement?.scrollIntoView?.({
      block: "nearest",
      behavior: "auto",
    });
    renderInspector();
    inspectorBody.querySelector<HTMLElement>("input,textarea,select")?.focus();
  }

  function unsaved() {
    return (
      contributorInvalid || JSON.stringify(model.working) !== savedSnapshot
    );
  }
  function valid() {
    return (
      !contributorInvalid && !model.issues.some((i) => i.severity === "error")
    );
  }
  function ready() {
    return valid() && !model.pending.some((flag) => !flag.acknowledgedAt);
  }
  function showError(error: unknown) {
    live.textContent =
      error instanceof Error
        ? error.message
        : "Draft could not be saved on this device. Keep working in memory or download a copy.";
  }
  function requestSwitch(go: () => void) {
    if (saving) {
      live.textContent =
        "Wait for the current save to finish before switching lessons.";
      return;
    }
    model.endEdit();
    if (unsaved()) {
      suspendedSwitch = go;
      guard.hidden = false;
      guardSave.disabled = !ready();
      guard.focus();
    } else go();
  }
  function refreshSaved() {
    const previous = saved.value;
    saved.replaceChildren();
    const placeholder = el("option", "Saved on this device");
    placeholder.value = "";
    saved.append(placeholder);
    try {
      for (const draft of listDrafts()) {
        const o = el("option", draft.payload.lesson.title);
        o.value = draft.id;
        saved.append(o);
      }
      saved.value = previous;
    } catch (e) {
      showError(e);
    }
  }
  async function save(copy = false) {
    if (saving) return false;
    if (!ready()) {
      live.textContent =
        "Resolve field errors and wording checks before saving. Your changes remain in memory.";
      return false;
    }
    saving = true;
    try {
      const snapshot = structuredClone(model.working);
      const result = await saveDraft(
        snapshot,
        origin,
        copy ? undefined : recordId,
      );
      if (copy || result.id !== recordId) {
        releaseClaim?.();
        releaseClaim = await claimDraft(result.id);
      }
      recordId = releaseClaim ? result.id : undefined;
      savedSnapshot = JSON.stringify(snapshot);
      savedOnDevice = true;
      refreshSaved();
      saved.value = result.id;
      live.textContent = result.message;
      refresh(false);
      return true;
    } catch (e) {
      showError(e);
      return false;
    } finally {
      saving = false;
    }
  }
  async function openSaved() {
    try {
      const draft = loadDraft(saved.value);
      if (!draft) return;
      saving = true;
      const continuingOwnDraft = draft.id === recordId && releaseClaim !== null;
      const claim = continuingOwnDraft
        ? releaseClaim
        : await claimDraft(draft.id);
      if (continuingOwnDraft) releaseClaim = null;
      open(draft.payload, false, draft.origin);
      releaseClaim = claim;
      recordId = releaseClaim ? draft.id : undefined;
      savedOnDevice = true;
      live.textContent = releaseClaim
        ? "Continuing this saved draft with an exclusive editing lock."
        : "This draft will save as a new copy because an exclusive editing lock is unavailable.";
    } catch (e) {
      showError(e);
    } finally {
      saving = false;
    }
  }
  function open(p: LessonPackage, isNew = false, sourceOrigin = p) {
    moreBody.append(imports);
    browsing = false;
    authorLibrary.hidden = true;
    chooser.hidden = true;
    workspace.hidden = false;
    toolbar.hidden = false;
    status.hidden = false;
    issues.hidden = false;
    heading.querySelector("h1")!.textContent = p.lesson.title;
    closeInspector();
    releaseClaim?.();
    releaseClaim = null;
    recordId = undefined;
    savedOnDevice = false;
    origin = structuredClone(sourceOrigin);
    model = createAuthorModel(p, origin, { isNew });
    savedSnapshot = isNew ? "" : JSON.stringify(model.working);
    stepIndex = 0;
    hintRung = 1;
    selected = "story";
    trying = false;
    contributorInvalid = false;
    view?.destroy();
    view = mountLessonView(canvas, {
      lesson: model.lastValid.lesson,
      adapter: adapters[p.lesson.topic],
      onRender: attachOverlays,
    });
    refresh();
    renderInspector();
  }
  function attachOverlays() {
    if (trying) {
      canvas
        .querySelectorAll(".author-edit-region")
        .forEach((control) => control.remove());
      return;
    }
    const currentStep = Number(canvas.dataset.stepIndex ?? stepIndex);
    const currentHint = Number(canvas.dataset.hintRung ?? hintRung);
    if (currentStep !== stepIndex || currentHint !== hintRung) {
      stepIndex = currentStep;
      hintRung = Math.max(1, currentHint);
      stepSelect.value = String(stepIndex);
      renderInspector();
    }
    canvas.querySelectorAll<HTMLElement>("[data-region]").forEach((region) => {
      if (region.querySelector(":scope > .author-edit-region")) return;
      const name = region.dataset.region!;
      const label = name.startsWith("choice:")
        ? "choice"
        : name === "visual"
          ? "diagram"
          : name === "step-title"
            ? "step title"
            : name;
      const edit = button(`Edit ${label}`, `region-${name}`, () => {
        selected = name;
        revealInspector(edit);
        markSelected();
      });
      edit.className = "author-edit-region";
      region.append(edit);
      markSelected();
    });
  }
  function markSelected() {
    canvas
      .querySelectorAll<HTMLElement>("[data-region]")
      .forEach((region) =>
        region.classList.toggle(
          "author-selected",
          region.dataset.region === selected,
        ),
      );
  }
  function refresh(updateView = true) {
    if (!browsing)
      heading.querySelector("h1")!.textContent = model.working.lesson.title;
    const structural = valid();
    status.textContent = `${unsaved() ? "Unsaved changes" : savedOnDevice ? "Saved on this device" : "Source draft · no local changes"} · version ${model.working.lesson.version} · draft, not approved`;
    canvasNotice.textContent = !structural
      ? "Preview waiting for valid changes. The canvas shows the last valid revision."
      : trying
        ? "Try as learner · frozen lesson revision. No learner progress is saved."
        : "Edit view · choose a block to edit. Correct answers here are author controls only.";
    controls.get("inspect-checks")!.textContent =
      `Checks (${model.pending.filter((f) => !f.acknowledgedAt).length})`;
    controls.get("inspect-checks")!.hidden = trying;
    controls.get("undo")!.disabled = trying || !model.canUndo;
    controls.get("redo")!.disabled = trying || !model.canRedo;
    controls.get("try")!.disabled = trying || !ready();
    controls.get("edit")!.disabled = !trying;
    controls.get("edit")!.hidden = !trying;
    controls.get("save")!.disabled = !ready();
    controls.get("save-copy")!.disabled = !ready();
    controls.get("download")!.disabled = !ready();
    controls.get("try")!.setAttribute("aria-pressed", String(trying));
    controls.get("edit")!.setAttribute("aria-pressed", String(!trying));
    stepSelect.disabled = trying;
    nav.hidden = trying;
    inspector.hidden = trying;
    stepSelect.replaceChildren();
    model.working.lesson.steps.forEach((step, i) => {
      const o = el("option", `${i + 1}. ${step.title}`);
      o.value = String(i);
      stepSelect.append(o);
    });
    stepSelect.value = String(stepIndex);
    issues.replaceChildren();
    for (const issue of model.issues)
      issues.append(
        el("li", `${friendly(issue.path)}: ${issue.message} ${issue.repair}`),
      );
    fieldIssues.textContent = model.issues
      .filter((i) => i.severity === "error")
      .map((i) => `${friendly(i.path)}: ${i.message}`)
      .join(" ");
    checklist.replaceChildren();
    const pending = model.pending.filter((flag) => !flag.acknowledgedAt);
    if (pending.length) {
      checklist.append(
        el("h3", "Check wording after this change"),
        el(
          "p",
          "Try and download wait until wording is resolved. Author checks do not grant human approval.",
        ),
      );
      for (const flag of pending) {
        const row = el("div");
        row.append(el("p", flag.message));
        if (!flag.required)
          row.append(
            button(
              `I checked ${friendly(flag.path).toLowerCase()}`,
              "acknowledge",
              () => {
                try {
                  model.acknowledge(flag.path);
                  refresh();
                } catch (e) {
                  showError(e);
                }
              },
            ),
          );
        checklist.append(row);
      }
      checklist.append(
        button("Update wording from this task", "propose-wording", showWording),
      );
    }
    if (updateView && !trying)
      view?.update(model.lastValid.lesson, { stepIndex, hintRung });
    if (!trying) attachOverlays();
  }
  function patch(command: AuthorCommand) {
    try {
      model.patch(command);
      refresh();
    } catch (e) {
      showError(e);
    }
  }
  function field(
    label: string,
    value: unknown,
    onChange: (value: string) => void,
    multiline = false,
  ) {
    const wrap = el("label", label);
    wrap.className = "author-field";
    const input = multiline ? el("textarea") : el("input");
    input.value = String(value ?? "");
    input.dataset.field = label;
    if (input instanceof HTMLTextAreaElement) input.rows = 4;
    let composing = false;
    input.addEventListener("focus", () => model.beginEdit(label));
    input.addEventListener("blur", () => model.endEdit());
    input.addEventListener("compositionstart", () => {
      composing = true;
    });
    input.addEventListener("compositionend", () => {
      composing = false;
      onChange(input.value);
    });
    input.addEventListener("input", () => {
      if (!composing) onChange(input.value);
    });
    wrap.append(input);
    inspectorBody.append(wrap);
    return input;
  }
  function selectField(
    label: string,
    value: string,
    options: [string, string][],
    onChange: (value: string) => void,
  ) {
    const wrap = el("label", label);
    wrap.className = "author-field";
    const select = el("select");
    select.dataset.field = label;
    for (const [id, text] of options) {
      const o = el("option", text);
      o.value = id;
      select.append(o);
    }
    select.value = value;
    select.addEventListener("change", () => {
      model.endEdit();
      onChange(select.value);
    });
    wrap.append(select);
    inspectorBody.append(wrap);
    return select;
  }
  function renderInspector() {
    inspectorBody.replaceChildren();
    wording.hidden = true;
    if (trying) {
      inspectorBody.append(
        el("h2", "Try it as a learner"),
        el(
          "p",
          "Use the lesson controls to answer, ask for hints, or switch learning mode. Return to Edit to change the frozen draft.",
        ),
      );
      return;
    }
    const lesson = model.working.lesson;
    const placement = validateLibraryIndex(indexData).lessons.find(
      (l) => l.lessonId === lesson.id,
    );
    if (placement?.examples?.length) {
      const panel = el("details");
      panel.append(
        el(
          "summary",
          `${placement.examples.length} saved examples · read-only`,
        ),
      );
      const list = el("ol");
      placement.examples.forEach((id, i) => {
        const item = el("li"),
          link = el(
            "a",
            `Example ${i + 2}: ${packages.find((p) => p.lesson.id === id)?.lesson.title ?? id}`,
          );
        link.href = `/#lesson/${lesson.id}?example=${i + 2}`;
        link.target = "_blank";
        link.rel = "noopener";
        item.append(link);
        list.append(item);
      });
      panel.append(list);
      inspectorBody.append(panel);
    }
    const step = lesson.steps[stepIndex];
    inspectorBody.append(
      el("p", "SELECTED BLOCK"),
      el(
        "h2",
        selected === "visual"
          ? "Diagram and model"
          : selected.startsWith("choice:")
            ? "Answer choice"
            : selected === "hint"
              ? "Hint ladder"
              : selected === "details"
                ? "Lesson details"
                : selected.replace("-", " "),
      ),
    );
    const textCommand = (
      fieldName:
        | "title"
        | "objective"
        | "story"
        | "stepTitle"
        | "prompt"
        | "hint"
        | "choice",
      value: string,
      extra: Partial<AuthorCommand> = {},
    ) =>
      patch({
        kind: "text",
        field: fieldName,
        value,
        stepIndex,
        ...extra,
      } as AuthorCommand);
    if (["title", "objective", "story"].includes(selected))
      field(
        selected === "story"
          ? "Task wording"
          : selected === "title"
            ? "Lesson title"
            : "Learning objective",
        lesson[selected as "title" | "objective" | "story"],
        (value) =>
          textCommand(selected as "title" | "objective" | "story", value),
        selected !== "title",
      );
    else if (selected === "step-title" || selected === "prompt")
      field(
        selected === "prompt" ? "Question" : "Step title",
        selected === "prompt" ? step.prompt : step.title,
        (value) =>
          textCommand(selected === "prompt" ? "prompt" : "stepTitle", value),
        selected === "prompt",
      );
    else if (selected.startsWith("choice:")) {
      const id = selected.slice(7),
        choice = step.choices?.find((c) => c.id === id);
      if (choice) {
        field("Choice wording", choice.label, (value) =>
          textCommand("choice", value, { choiceId: id }),
        );
        inspectorBody.append(
          button("Move choice earlier", "move-earlier", () => {
            patch({ kind: "reorder", stepIndex, choiceId: id, direction: -1 });
            renderInspector();
          }),
          button("Move choice later", "move-later", () => {
            patch({ kind: "reorder", stepIndex, choiceId: id, direction: 1 });
            renderInspector();
          }),
        );
        if (step.id === "reflection")
          selectField(
            "Correct explanation (author only)",
            String(step.answer),
            (step.choices ?? []).map((c) => [c.id, c.label]),
            (value) => patch({ kind: "reflectionAnswer", choiceId: value }),
          );
        else
          inspectorBody.append(
            el(
              "p",
              "The mathematical answer is derived from the model. Changing words does not change that rule.",
            ),
          );
      }
    } else if (selected === "hint") {
      selectField(
        "Hint rung",
        String(hintRung),
        [
          ["1", "1 · Attention cue"],
          ["2", "2 · Relationship cue"],
          ["3", "3 · Partial demonstration"],
          ["4", "4 · Answer reveal"],
        ],
        (value) => {
          hintRung = Number(value);
          refresh();
          renderInspector();
        },
      );
      field(
        "Hint wording",
        step.hints[hintRung - 1],
        (value) => textCommand("hint", value, { hintIndex: hintRung - 1 }),
        true,
      );
    } else if (selected === "visual") {
      const spec = lesson.specification;
      if (lesson.topic === "comparison") {
        for (const [key, label] of [
          ["largerName", "Larger group name"],
          ["smallerName", "Smaller group name"],
          ["unit", "Objects or unit"],
          ["smaller", "Smaller amount"],
          ["difference", "Difference"],
        ] as const) {
          const value =
            key === "difference" ? model.comparisonDifference : spec[key];
          const input = field(label, value, (value) =>
            patch({ kind: "comparison", field: key, value }),
          );
          if (key === "smaller" || key === "difference")
            input.inputMode = "numeric";
        }
        selectField(
          "Find the missing amount",
          String(spec.unknown),
          [
            ["larger", "Larger amount"],
            ["smaller", "Smaller amount"],
            ["difference", "Difference"],
          ],
          (value) => patch({ kind: "comparison", field: "unknown", value }),
        );
        inspectorBody.append(
          el(
            "p",
            "Changing the missing amount requires applying coherent wording before Try or download.",
          ),
        );
      } else if (lesson.topic === "angles") {
        const cards = spec.angles as {
          id: string;
          label: string;
          degrees: number | string;
          rotation: number | string;
        }[];
        for (const card of cards) {
          inspectorBody.append(el("h3", `Card ${card.label}`));
          field(`Card ${card.id} label`, card.label, (value) =>
            patch({ kind: "angle", cardId: card.id, field: "label", value }),
          );
          const role = el(
            "p",
            `Computed role: ${Number(card.degrees) === 90 ? "right angle" : Number(card.degrees) < 90 ? "smaller than a right angle" : "larger than a right angle"}`,
          );
          role.dataset.roleCard = card.id;
          inspectorBody.append(role);
          field(`Card ${card.id} opening`, card.degrees, (value) => {
            patch({ kind: "angle", cardId: card.id, field: "degrees", value });
            role.textContent = `Computed role: ${Number(value) === 90 ? "right angle" : Number(value) > 0 && Number(value) < 90 ? "smaller than a right angle" : Number(value) > 90 && Number(value) < 180 ? "larger than a right angle" : "invalid opening"}`;
          }).inputMode = "numeric";
          field(`Card ${card.id} rotation`, card.rotation, (value) =>
            patch({ kind: "angle", cardId: card.id, field: "rotation", value }),
          ).inputMode = "numeric";
        }
        inspectorBody.append(
          el(
            "p",
            "Opening is in degrees for authors only. Keep the required right-angle count; invalid cards remain editable.",
          ),
        );
      } else {
        for (const definition of topicFields(lesson)) {
          if (definition.options)
            selectField(
              definition.label,
              String(definition.value),
              definition.options.map((o) => [o.value, o.label]),
              (value) => patch({ kind: "topic", key: definition.key, value }),
            );
          else {
            const input = field(definition.label, definition.value, (value) =>
              patch({ kind: "topic", key: definition.key, value }),
            );
            if (definition.type === "number") input.inputMode = "numeric";
          }
        }
        inspectorBody.append(
          el(
            "p",
            "Model changes update the task together. Check the proposed wording before trying or downloading.",
          ),
        );
        const annotationTopic = annotationTopics[lesson.topic];
        if (annotationTopic)
          inspectorBody.append(
            createDimensionPanel({
              topic: annotationTopic,
              specification: lesson.specification,
              current: lesson.specification.annotations as
                AnnotationPlan | undefined,
              apply: (value) =>
                patch({ kind: "topic", key: "annotations", value }),
            }),
          );
      }
    }
    inspectorBody.append(
      button("Edit hints", "inspect-hints", () => {
        selected = "hint";
        renderInspector();
        refresh();
      }),
    );
    const details = el("details");
    details.className = "author-details";
    details.append(el("summary", "Lesson details and sources"));
    const savedBody = inspectorBody;
    const detailsFields = el("div");
    details.append(detailsFields);
    inspectorBody.append(details);
    // Reuse stable field builders, then move only the newly created controls into the details panel.
    const addDetail = (
      label: string,
      value: unknown,
      run: (value: string) => void,
    ) => {
      field(label, value, run);
      detailsFields.append(savedBody.lastElementChild!);
    };
    addDetail("Lesson title", lesson.title, (value) =>
      patch({ kind: "text", field: "title", value }),
    );
    addDetail("Learning objective", lesson.objective, (value) =>
      patch({ kind: "text", field: "objective", value }),
    );
    addDetail("Candidate level", lesson.level, (value) =>
      patch({ kind: "details", field: "level", value }),
    );
    addDetail(
      "Source reference",
      model.working.curriculum.sources[0],
      (value) => patch({ kind: "details", field: "source", value }),
    );
    detailsFields.append(
      el("p", `Existing authors (read-only): ${origin.authors.join(", ")}`),
    );
    addDetail("Contributor ID", model.contributor, (value) => {
      try {
        model.setContributor(value);
        contributorInvalid = false;
        refresh();
      } catch (e) {
        contributorInvalid = true;
        refresh(false);
        showError(e);
      }
    });
    detailsFields.append(
      el(
        "p",
        "Use a stable lowercase ID, such as author-lee. Identity is verified by the release maintainer.",
      ),
    );
  }
  function showWording() {
    wording.replaceChildren(
      el("h3", "Proposed wording replacement"),
      el(
        "p",
        "These blocks will replace your custom wording together. You can undo the complete change.",
      ),
    );
    for (const change of model.proposeWording()) {
      const block = el("div");
      block.append(
        el("h4", friendly(change.path)),
        el("p", `Current: ${change.before}`),
        el("p", `Proposed: ${change.after}`),
      );
      wording.append(block);
    }
    wording.append(
      button("Apply proposed wording", "apply-wording", () => {
        try {
          model.applyWording();
          wording.hidden = true;
          refresh();
          renderInspector();
        } catch (e) {
          showError(e);
        }
      }),
      button("Keep current wording", "cancel-wording", () => {
        wording.hidden = true;
      }),
    );
    wording.hidden = false;
  }
  function importText(text: string): boolean {
    const result = parsePackage(text);
    if (!result.package) {
      live.textContent = "Import rejected. The active draft is unchanged.";
      issues.replaceChildren(
        ...result.issues.map((i) =>
          el("li", `${friendly(i.path)}: ${i.message} ${i.repair}`),
        ),
      );
      return false;
    }
    const next = result.package;
    requestSwitch(() => open(next));
    return true;
  }
  async function importFile(incoming: File) {
    if (fileBusy) return false;
    if (incoming.size > MAX_PACKAGE_BYTES) {
      live.textContent =
        "Import rejected: file exceeds the size limit. The active draft is unchanged.";
      return false;
    }
    fileBusy = true;
    file.disabled = true;
    try {
      return importText(await incoming.text());
    } catch {
      live.textContent =
        "The local file could not be read. Your current draft is unchanged.";
      return false;
    } finally {
      fileBusy = false;
      file.disabled = false;
    }
  }
  function exportJson() {
    if (!ready())
      throw new Error(
        "Resolve field errors and wording checks before downloading.",
      );
    return JSON.stringify(model.working, null, 2) + "\n";
  }
  const beforeUnload = (event: BeforeUnloadEvent) => {
    if (unsaved()) {
      event.preventDefault();
      event.returnValue = "";
    }
  };
  window.addEventListener("beforeunload", beforeUnload);
  stepSelect.addEventListener("change", () => {
    model.endEdit();
    stepIndex = Number(stepSelect.value);
    selected = "prompt";
    refresh();
    renderInspector();
  });
  file.addEventListener("change", () => {
    if (file.files?.[0]) void importFile(file.files[0]);
  });
  refreshSaved();
  open(packages[0]);
  showLibrary();
  return {
    importText,
    importFile,
    exportJson,
    exportReport: () => model.report(),
    getActive: () => structuredClone(model.working),
    getSession: () => view?.getSession(),
    destroy: () => {
      releaseClaim?.();
      view?.destroy();
      chooserView?.destroy();
      libraryView?.destroy();
      inspector.removeEventListener("keydown", inspectorKeys);
      window.removeEventListener("beforeunload", beforeUnload);
    },
  };
}
const authorRoot = document.querySelector<HTMLElement>("#author-app");
if (authorRoot) mountAuthor(authorRoot);

fontNotices(document.body);
