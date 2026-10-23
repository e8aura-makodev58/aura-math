/**
 * Author-only "Dimension lines" panel. Never imported by the learner entry.
 *
 * The model's suggestion is requested from the development server (the key stays server-side),
 * previewed with the same deterministic renderer the learner sees, and applied only when the author
 * chooses it. Applying goes through the normal undoable model command.
 */
import type { AnnotationPlan } from "../annotation/plan";
import type { ProposalResult } from "../annotation/proposer";
import type { AnnotationTopic } from "../annotation/topics";

const HEADER = { "x-aura-annotation": "1" };
const SIDE_WORDS: Record<string, string> = {
  top: "above",
  bottom: "below",
  left: "on the left",
  right: "on the right",
};

export interface DimensionPanelOptions {
  topic: AnnotationTopic;
  specification: Record<string, unknown>;
  /** The plan stored in the lesson, or undefined for the automatic layout. */
  current: AnnotationPlan | undefined;
  /** Stores a validated plan (as JSON text) through the model; "" returns to automatic. */
  apply(planJson: string): void;
  fetchImpl?: typeof fetch;
}

const node = <K extends keyof HTMLElementTagNameMap>(
  tag: K,
  text?: string,
  className?: string,
) => {
  const n = document.createElement(tag);
  if (text !== undefined) n.textContent = text;
  if (className) n.className = className;
  return n;
};

function summary(
  topic: AnnotationTopic,
  specification: Record<string, unknown>,
  plan: AnnotationPlan,
): HTMLElement {
  const catalogue = topic.catalogue(specification);
  const list = node("ul", undefined, "dimension-summary");
  for (const d of plan.dimensions) {
    const feature = catalogue.features.find((f) => f.id === d.feature);
    list.append(
      node(
        "li",
        `${feature?.description ?? d.feature}: ${SIDE_WORDS[d.side] ?? d.side}${d.show === "unknown" ? " (shown as ?)" : ""}`,
      ),
    );
  }
  for (const n of plan.notes) {
    const note = catalogue.notes.find((x) => x.kind === n.kind);
    list.append(
      node("li", `${note?.description ?? n.kind}: ${SIDE_WORDS[n.placement]}`),
    );
  }
  return list;
}

export function createDimensionPanel(
  options: DimensionPanelOptions,
): HTMLElement {
  const doFetch = options.fetchImpl ?? ((...a) => fetch(...a));
  const root = node("section", undefined, "dimension-panel");
  const headingId = "dimension-panel-heading";
  root.setAttribute("aria-labelledby", headingId);
  const heading = node("h3", "Dimension lines");
  heading.id = headingId;
  const mode = node("p", undefined, "dimension-mode");
  mode.textContent = options.current
    ? "Layout: custom, chosen from a suggestion. Ask for a new one, or reset to automatic."
    : "Layout: automatic. Every given length is shown; unknown lengths show a question mark.";
  const note = node(
    "p",
    "Lines, arrows and labels are drawn by a checked algorithm. A suggestion only chooses which labels to show and on which side, and can never reveal a hidden value.",
    "dimension-note",
  );
  const suggest = node("button", "Suggest a layout");
  suggest.type = "button";
  suggest.disabled = true;
  suggest.dataset.action = "suggest-dimensions";
  const reset = node("button", "Reset to automatic");
  reset.type = "button";
  reset.dataset.action = "reset-dimensions";
  reset.hidden = !options.current;
  const message = node("p", "Checking whether suggestions are available…");
  message.setAttribute("role", "status");
  message.setAttribute("aria-live", "polite");
  message.className = "dimension-message";
  const proposal = node("div", undefined, "dimension-proposal");
  proposal.hidden = true;
  root.append(heading, mode, note, suggest, reset, message, proposal);

  const fingerprint = () => JSON.stringify(options.specification);
  const started = fingerprint();
  let pending: ProposalResult | undefined;

  void (async () => {
    try {
      const response = await doFetch("/__annotation/status", {
        headers: HEADER,
      });
      if (!response.ok) throw new Error("unavailable");
      const status = (await response.json()) as { configured?: boolean };
      if (status.configured) {
        suggest.disabled = false;
        message.textContent = "Suggestions are available.";
      } else
        message.textContent =
          "No API credentials found. Set ANTHROPIC_API_KEY and restart the development server to enable suggestions.";
    } catch {
      message.textContent =
        "Suggestions are available only when the author workspace runs on the development server.";
    }
  })();

  suggest.addEventListener("click", async () => {
    suggest.disabled = true;
    proposal.hidden = true;
    proposal.replaceChildren();
    message.textContent = "Asking the model…";
    try {
      const response = await doFetch("/__annotation/propose", {
        method: "POST",
        headers: { ...HEADER, "content-type": "application/json" },
        body: JSON.stringify({
          topic: options.topic.id,
          specification: options.specification,
        }),
      });
      const body = (await response.json()) as ProposalResult & {
        error?: string;
        details?: string[];
      };
      if (fingerprint() !== started) return; // the lesson changed meanwhile
      if (!response.ok) {
        message.textContent =
          body.error ?? "The suggestion could not be created.";
        return;
      }
      pending = body;
      showProposal(body);
    } catch {
      message.textContent = "The suggestion could not be created.";
    } finally {
      suggest.disabled = false;
    }
  });

  function showProposal(result: ProposalResult) {
    proposal.replaceChildren();
    const fromModel = result.source === "model";
    message.textContent = fromModel
      ? `Suggested by the model; the checker accepted it${result.rounds > 1 ? ` after ${result.rounds} rounds` : ""}.`
      : `The model did not produce an acceptable layout${result.failure ? ` (${result.failure})` : ""}. The automatic layout is shown instead.`;
    const preview = node("div", undefined, "dimension-preview");
    // Markup comes from the deterministic renderer, which escapes every label.
    preview.innerHTML = options.topic.render(
      options.specification,
      result.plan,
    );
    const use = node("button", "Use this layout");
    use.type = "button";
    use.dataset.action = "use-dimensions";
    use.disabled = !fromModel;
    use.addEventListener("click", () => {
      if (pending) options.apply(JSON.stringify(pending.plan));
    });
    const discard = node("button", "Discard");
    discard.type = "button";
    discard.addEventListener("click", () => {
      proposal.hidden = true;
      proposal.replaceChildren();
      pending = undefined;
      message.textContent = "Suggestion discarded.";
    });
    proposal.append(
      preview,
      summary(options.topic, options.specification, result.plan),
      use,
      discard,
    );
    proposal.hidden = false;
  }

  reset.addEventListener("click", () => options.apply(""));
  return root;
}
