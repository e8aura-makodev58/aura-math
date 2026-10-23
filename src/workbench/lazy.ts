import type { WorkbenchFactory, WorkbenchHandle, WorkbenchIO } from "./types";

/**
 * Wraps a workbench whose code lives in a lazily loaded chunk (`import()`), so only lessons with
 * a workbench pay for it. Notifications that arrive before the chunk has loaded are replayed in
 * order; a destroy before loading finishes means the real workbench is never created.
 */
export function lazyWorkbench(
  load: () => Promise<WorkbenchFactory>,
): WorkbenchFactory {
  return (host: HTMLElement, io: WorkbenchIO): WorkbenchHandle => {
    let real: WorkbenchHandle | null = null;
    let destroyed = false;
    let rung: number | null = null;
    let locked: boolean | null = null;
    const status = document.createElement("p");
    status.className = "bench-loading";
    status.textContent = "Getting the hands-on model ready…";
    host.append(status);
    const failed = () => {
      if (destroyed) return;
      status.textContent =
        "The hands-on model could not load. Use the list version of the answer below.";
      host
        .closest(".lesson-canvas")
        ?.querySelector<HTMLDetailsElement>(".bench-list")
        ?.setAttribute("open", "");
    };
    load().then((factory) => {
      if (destroyed) return;
      status.remove();
      try {
        real = factory(host, io);
      } catch (error) {
        host.replaceChildren(status);
        failed();
        console.error(error);
        return;
      }
      if (rung !== null) real.hint?.(rung);
      if (locked !== null) real.lock?.(locked);
    }, failed);
    return {
      hint(value) {
        if (real) real.hint?.(value);
        else rung = value;
      },
      lock(value) {
        if (real) real.lock?.(value);
        else locked = value;
      },
      answerChanged(value) {
        real?.answerChanged?.(value);
      },
      destroy() {
        if (destroyed) return;
        destroyed = true;
        real?.destroy();
        real = null;
        status.remove();
      },
    };
  };
}
