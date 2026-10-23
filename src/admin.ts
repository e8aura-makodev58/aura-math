/**
 * Admin model settings page (author side only; never part of the learner build). Talks to the
 * development-server routes in `src/admin-server/handler.ts`. The admin token is kept in
 * sessionStorage only and is cleared on Lock. Keys are write-only: the page sends a key once and
 * afterwards only ever receives a `••••last4` hint. All text is set with textContent.
 */
import "./styles.css";
import "./admin.css";
import {
  MODEL_SLOTS,
  PROFILE_LABELS,
  STORY_SLOT_PROFILES,
} from "./content/story-slots";

type ProviderId = "anthropic" | "openai" | "openrouter" | "deepseek";

interface ProviderSummary {
  id: ProviderId;
  label: string;
  credentialConfigured: boolean;
  credentialHint: string | null;
  model: string;
  defaultModel: string;
}
interface PriceRow {
  provider: ProviderId;
  model: string;
  inputUsdPerMTok: number;
  outputUsdPerMTok: number;
  source: "bundled-unverified" | "admin";
}
interface Snapshot {
  provider: ProviderId;
  model: string;
  enabled: boolean;
  liveReady: boolean;
  providers: ProviderSummary[];
  capabilities: { effort: boolean; fallbacks: boolean; known: boolean };
  dailyCapUsd: number;
  spend: { todayUsd: number; monthUsd: number; callsToday: number };
  breaker: { open: boolean; reopensAt: string | null };
  prices: PriceRow[];
  transport: "live" | "fake";
}

interface StoryRow {
  id: string;
  profile: keyof typeof PROFILE_LABELS;
  slots: Record<string, string>;
  example: string;
  provenance: {
    provider: string;
    model: string;
    servedModel: string | null;
    promptVersion: string;
    createdAt: string;
  };
  approvedAt?: string;
}
interface StoryList {
  pending: StoryRow[];
  approved: StoryRow[];
  limits: { pending: number; approved: number };
}

const API = "/api/admin/settings/";
const TOKEN_KEY = "aura-admin-token";
const CONFIRM = "TEST_MAY_COST";

class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

function readToken(): string | null {
  try {
    return sessionStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}
function writeToken(value: string | null) {
  try {
    if (value) sessionStorage.setItem(TOKEN_KEY, value);
    else sessionStorage.removeItem(TOKEN_KEY);
  } catch {
    // Without storage the token lives only in this page's memory.
  }
}

let token: string | null = null;
let snapshot: Snapshot | null = null;
let selected: ProviderId = "anthropic";
let priceDirty = false;
const discovered: Partial<Record<ProviderId, string[]>> = {};

async function call<T>(action: string, body: object, auth = true): Promise<T> {
  const headers: Record<string, string> = {
    "content-type": "application/json",
  };
  if (auth && token) headers.authorization = `Bearer ${token}`;
  const response = await fetch(API + action, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
    cache: "no-store",
    credentials: "same-origin",
  });
  let data: unknown = null;
  try {
    data = await response.json();
  } catch {
    // Non-JSON replies are reported generically below.
  }
  if (!response.ok) {
    const message = (data as { error?: { message?: unknown } } | null)?.error
      ?.message;
    throw new ApiError(
      response.status,
      typeof message === "string"
        ? message
        : `Request failed (HTTP ${response.status}).`,
    );
  }
  return data as T;
}

function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  props: Record<string, string> = {},
  ...children: (Node | string)[]
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  for (const [name, value] of Object.entries(props)) {
    if (name === "text") node.textContent = value;
    else node.setAttribute(name, value);
  }
  for (const child of children)
    node.append(
      typeof child === "string" ? document.createTextNode(child) : child,
    );
  return node;
}

function field(label: string, control: HTMLElement, hint?: HTMLElement) {
  const id = control.id;
  return el(
    "div",
    { class: "admin-field" },
    el("label", { for: id, text: label }),
    control,
    ...(hint ? [hint] : []),
  );
}

const money = (value: number, places = 4) => `US$${value.toFixed(places)}`;

// ---- Layout -------------------------------------------------------------------------------

const root = document.querySelector<HTMLDivElement>("#admin-app")!;
const status = el("p", {
  class: "admin-status",
  role: "status",
  "aria-live": "polite",
  "data-testid": "admin-status",
});

const tokenInput = el("input", {
  id: "admin-token",
  type: "password",
  autocomplete: "off",
  spellcheck: "false",
});
const unlockButton = el("button", {
  type: "submit",
  class: "admin-primary",
  text: "Unlock settings",
});
const lockForm = el(
  "form",
  { class: "admin-card", "data-testid": "admin-lock" },
  el("h2", { text: "Locked" }),
  el("p", {
    class: "admin-note",
    text: "Enter the admin token. The development server prints it once in its terminal when it is first created, and keeps it owner-only in admin.token in the settings data folder.",
  }),
  field("Admin token", tokenInput),
  unlockButton,
);

const lockButton = el("button", {
  type: "button",
  class: "admin-secondary",
  text: "Lock",
});
const inlineMessage = (name: string) =>
  el("p", { class: "admin-inline", "data-testid": `admin-inline-${name}` });
const modelMessage = inlineMessage("model");
const keyMessage = inlineMessage("key");
const saveMessage = inlineMessage("save");
const testMessage = inlineMessage("test");
const generateMessage = inlineMessage("generate");
const pendingMessage = inlineMessage("pending");
const approvedMessage = inlineMessage("approved");
const inlineMessages = [
  modelMessage,
  keyMessage,
  saveMessage,
  testMessage,
  generateMessage,
  pendingMessage,
  approvedMessage,
];
const transportBanner = el("p", { class: "admin-banner", hidden: "" });

const providerSelect = el("select", { id: "admin-provider" });
const modelList = el("select", { id: "admin-model-list" });
const refreshButton = el("button", {
  type: "button",
  class: "admin-secondary",
  text: "Refresh models",
});
const modelInput = el("input", {
  id: "admin-model",
  type: "text",
  autocomplete: "off",
  spellcheck: "false",
  maxlength: "160",
});
const capabilityNote = el("p", {
  class: "admin-note",
  "data-testid": "admin-capabilities",
});

const keyStatus = el("p", {
  class: "admin-key-status",
  "data-testid": "admin-key-status",
});
const keyInput = el("input", {
  id: "admin-key",
  type: "password",
  autocomplete: "off",
  spellcheck: "false",
  maxlength: "1000",
});
const saveKeyButton = el("button", {
  type: "button",
  class: "admin-secondary",
  text: "Save key",
});
const removeKeyButton = el("button", {
  type: "button",
  class: "admin-danger",
  text: "Remove key",
});

const priceInput = el("input", {
  id: "admin-price-input",
  type: "number",
  inputmode: "decimal",
  min: "0",
  step: "0.0001",
});
const priceOutput = el("input", {
  id: "admin-price-output",
  type: "number",
  inputmode: "decimal",
  min: "0",
  step: "0.0001",
});
const priceNote = el("p", {
  class: "admin-note",
  "data-testid": "admin-price-note",
});

const capInput = el("input", {
  id: "admin-cap",
  type: "number",
  inputmode: "decimal",
  min: "0.01",
  max: "100",
  step: "0.01",
});
const spendText = el("p", {
  class: "admin-spend",
  "data-testid": "admin-spend",
});
const breakerText = el("p", { class: "admin-note", hidden: "" });

const enabledBox = el("input", { id: "admin-enabled", type: "checkbox" });
const liveText = el("p", { class: "admin-note", "data-testid": "admin-live" });
const saveButton = el("button", {
  type: "button",
  class: "admin-primary",
  text: "Save settings",
});

const confirmBox = el("input", { id: "admin-confirm", type: "checkbox" });
const testButton = el("button", {
  type: "button",
  class: "admin-secondary",
  text: "Run paid connection test",
  disabled: "",
});
const testResult = el("p", {
  class: "admin-test-result",
  "data-testid": "admin-test-result",
});

const storyProfile = el("select", { id: "admin-story-profile" });
storyProfile.replaceChildren(
  ...STORY_SLOT_PROFILES.map((id) =>
    el("option", { value: id, text: PROFILE_LABELS[id] }),
  ),
);
const storyCount = el("input", {
  id: "admin-story-count",
  type: "number",
  inputmode: "numeric",
  min: "1",
  max: "10",
  step: "1",
  value: "3",
});
const generateButton = el("button", {
  type: "button",
  class: "admin-primary",
  text: "Generate stories",
});
const pendingList = el("ul", {
  class: "admin-story-list",
  "data-testid": "admin-pending-stories",
});
const approvedList = el("ul", {
  class: "admin-story-list",
  "data-testid": "admin-approved-stories",
});
const pendingHeading = el("h3", {
  class: "admin-subhead",
  tabindex: "-1",
  text: "Waiting for you",
});
const approvedHeading = el("h3", {
  class: "admin-subhead",
  tabindex: "-1",
  text: "Approved",
});

const settingsPanel = el(
  "div",
  { class: "admin-settings", hidden: "", "data-testid": "admin-settings" },
  transportBanner,
  el(
    "fieldset",
    { class: "admin-card" },
    el("legend", { text: "Provider and model" }),
    field("Provider", providerSelect),
    field("Discovered models", modelList),
    refreshButton,
    modelMessage,
    field(
      "Model ID",
      modelInput,
      el("p", {
        class: "admin-note",
        text: "Pick a discovered model or type the exact ID from your provider console.",
      }),
    ),
    capabilityNote,
  ),
  el(
    "fieldset",
    { class: "admin-card" },
    el("legend", { text: "API key" }),
    keyStatus,
    field("New API key", keyInput),
    el("div", { class: "admin-row" }, saveKeyButton, removeKeyButton),
    keyMessage,
  ),
  el(
    "fieldset",
    { class: "admin-card" },
    el("legend", { text: "Prices for this model" }),
    field("Input price (US$ per million tokens)", priceInput),
    field("Output price (US$ per million tokens)", priceOutput),
    priceNote,
  ),
  el(
    "fieldset",
    { class: "admin-card" },
    el("legend", { text: "Budget" }),
    field("Daily spending cap (US$)", capInput),
    spendText,
    breakerText,
  ),
  el(
    "fieldset",
    { class: "admin-card" },
    el("legend", { text: "Live calls" }),
    el(
      "div",
      { class: "admin-check" },
      enabledBox,
      el("label", { for: "admin-enabled", text: "Allow live model calls" }),
    ),
    liveText,
    saveButton,
    saveMessage,
  ),
  el(
    "fieldset",
    { class: "admin-card" },
    el("legend", { text: "Connection test" }),
    el("p", {
      class: "admin-note",
      text: "Sends one tiny request to the saved provider and model. It is counted against today's cap.",
    }),
    el(
      "div",
      { class: "admin-check" },
      confirmBox,
      el("label", {
        for: "admin-confirm",
        text: "I understand this makes one small paid call",
      }),
    ),
    testButton,
    testResult,
    testMessage,
  ),
  el(
    "fieldset",
    { class: "admin-card", "data-testid": "admin-stories" },
    el("legend", { text: "Stories for Try another" }),
    el("p", {
      class: "admin-note",
      text: "One paid call asks the model for names, items and places to fill the existing story sentences. Numbers, questions, hints and answers never come from the model. Read each example; only stories you approve are shown to a child, labelled as checked by a grown-up.",
    }),
    field("Story type", storyProfile),
    field("How many (1 to 10)", storyCount),
    generateButton,
    generateMessage,
    pendingHeading,
    pendingMessage,
    pendingList,
    approvedHeading,
    approvedMessage,
    approvedList,
  ),
);

root.append(
  el(
    "main",
    { class: "admin-page" },
    el(
      "header",
      { class: "admin-header" },
      el(
        "div",
        {},
        el("p", { class: "admin-kicker", text: "AURA MATH · AUTHOR TOOL" }),
        el("h1", { text: "Model settings" }),
        el("p", {
          class: "admin-note",
          text: "For the adult running the development server. Children never see this page.",
        }),
      ),
      lockButton,
    ),
    status,
    lockForm,
    settingsPanel,
  ),
);

// ---- Rendering ----------------------------------------------------------------------------

// The page is long on a phone, so the outcome of an action is also written next to the button
// that was pressed; the status line at the top stays the screen-reader live region.
let inline: HTMLElement | null = null;
const say = (text: string) => {
  status.textContent = text;
  if (inline) inline.textContent = text;
};
const providerOf = (id: ProviderId) =>
  snapshot?.providers.find((entry) => entry.id === id);
const priceOf = (id: ProviderId, model: string) =>
  snapshot?.prices.find(
    (entry) => entry.provider === id && entry.model === model,
  );

function renderModels() {
  const models = discovered[selected] ?? [];
  modelList.replaceChildren(
    el("option", {
      value: "",
      text: models.length
        ? "Choose a discovered model"
        : "No list yet: refresh, or type an ID",
    }),
    ...models.map((id) => el("option", { value: id, text: id })),
  );
  modelList.value = models.includes(modelInput.value) ? modelInput.value : "";
}

function renderPrice() {
  if (priceDirty) return;
  const row = priceOf(selected, modelInput.value.trim());
  priceInput.value = row ? String(row.inputUsdPerMTok) : "";
  priceOutput.value = row ? String(row.outputUsdPerMTok) : "";
  priceNote.textContent = !row
    ? "No price yet. Live calls for this model are refused until you enter both prices."
    : row.source === "bundled-unverified"
      ? "From the bundled reference, not verified. Check the provider's price page, then save."
      : "Entered by the admin.";
}

function renderKey() {
  const entry = providerOf(selected);
  const label = entry?.label ?? selected;
  keyStatus.textContent = entry?.credentialConfigured
    ? `Key saved for ${label}, ending ${entry.credentialHint}. It is never sent back to the browser.`
    : `No key saved for ${label}.`;
  saveKeyButton.textContent = entry?.credentialConfigured
    ? "Replace key"
    : "Save key";
  removeKeyButton.hidden = !entry?.credentialConfigured;
}

function renderCapabilities() {
  if (!snapshot) return;
  const saved =
    snapshot.provider === selected &&
    snapshot.model === modelInput.value.trim();
  capabilityNote.textContent = !saved
    ? "Save to check this model's request options."
    : snapshot.capabilities.known
      ? `Known model: effort ${snapshot.capabilities.effort ? "supported" : "not sent"}; fallbacks ${snapshot.capabilities.fallbacks ? "supported" : "not sent"}.`
      : "Model not in the capability table: the most basic request shape is used.";
}

function renderProviderFields() {
  const entry = providerOf(selected);
  modelInput.value = entry?.model || entry?.defaultModel || "";
  priceDirty = false;
  renderModels();
  renderKey();
  renderPrice();
  renderCapabilities();
}

function render(next: Snapshot, keepSelection = false) {
  snapshot = next;
  if (!keepSelection) selected = next.provider;
  providerSelect.replaceChildren(
    ...next.providers.map((entry) =>
      el("option", { value: entry.id, text: entry.label }),
    ),
  );
  providerSelect.value = selected;
  renderProviderFields();
  capInput.value = next.dailyCapUsd.toFixed(2);
  spendText.textContent = `Spent today: ${money(next.spend.todayUsd)} of ${money(next.dailyCapUsd, 2)} · This month: ${money(next.spend.monthUsd)} · Paid calls today: ${next.spend.callsToday}`;
  breakerText.hidden = !next.breaker.open;
  breakerText.textContent = next.breaker.reopensAt
    ? `Live calls are paused after repeated failures until ${new Date(next.breaker.reopensAt).toLocaleTimeString()}.`
    : "";
  enabledBox.checked = next.enabled;
  const active = providerOf(next.provider);
  liveText.textContent = next.liveReady
    ? `On: ${active?.label} · ${next.model}`
    : `Off${next.enabled ? " (missing key or price)" : ""}: no live calls are made.`;
  transportBanner.hidden = next.transport !== "fake";
  transportBanner.textContent =
    next.transport === "fake"
      ? "Test transport: this server never contacts a provider."
      : "";
}

const when = (iso: string) => {
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? "" : date.toLocaleString();
};

function storyItem(row: StoryRow, approved: boolean) {
  const slots = MODEL_SLOTS[row.profile]
    .map((slot) => `${slot}: ${row.slots[slot] ?? ""}`)
    .join(" · ");
  const actions = approved
    ? [
        el("button", {
          type: "button",
          class: "admin-danger",
          "data-story-action": "remove",
          "data-id": row.id,
          "aria-label": `Remove approved story: ${slots}`,
          text: "Remove",
        }),
      ]
    : [
        el("button", {
          type: "button",
          class: "admin-primary",
          "data-story-action": "approve",
          "data-id": row.id,
          "aria-label": `Approve story: ${slots}`,
          text: "Approve",
        }),
        el("button", {
          type: "button",
          class: "admin-secondary",
          "data-story-action": "reject",
          "data-id": row.id,
          "aria-label": `Reject story: ${slots}`,
          text: "Reject",
        }),
      ];
  return el(
    "li",
    { class: "admin-story", "data-testid": "admin-story" },
    el("p", { class: "admin-story-example", text: row.example }),
    el("p", {
      class: "admin-note",
      text: `${PROFILE_LABELS[row.profile]} · ${slots}`,
    }),
    el("p", {
      class: "admin-note",
      text: `Suggested by ${row.provenance.provider} · ${row.provenance.servedModel ?? row.provenance.model} · ${row.provenance.promptVersion} · ${when(row.provenance.createdAt)}${row.approvedAt ? ` · approved ${when(row.approvedAt)}` : ""}`,
    }),
    el("div", { class: "admin-row" }, ...actions),
  );
}

function renderStories(list: StoryList) {
  pendingHeading.textContent = `Waiting for you (${list.pending.length} of ${list.limits.pending})`;
  approvedHeading.textContent = `Approved (${list.approved.length} of ${list.limits.approved})`;
  pendingList.replaceChildren(
    ...(list.pending.length
      ? list.pending.map((row) => storyItem(row, false))
      : [el("li", { class: "admin-note", text: "Nothing waiting." })]),
  );
  approvedList.replaceChildren(
    ...(list.approved.length
      ? list.approved.map((row) => storyItem(row, true))
      : [
          el("li", {
            class: "admin-note",
            text: "No approved stories yet. Try another uses the built-in story words.",
          }),
        ]),
  );
}

function showLocked(message?: string) {
  token = null;
  snapshot = null;
  writeToken(null);
  for (const input of [
    tokenInput,
    keyInput,
    modelInput,
    priceInput,
    priceOutput,
    capInput,
  ])
    input.value = "";
  confirmBox.checked = false;
  testButton.disabled = true;
  testResult.textContent = "";
  pendingList.replaceChildren();
  approvedList.replaceChildren();
  settingsPanel.hidden = true;
  lockButton.hidden = true;
  lockForm.hidden = false;
  if (message !== undefined) say(message);
  tokenInput.focus();
}

function showUnlocked() {
  lockForm.hidden = true;
  settingsPanel.hidden = false;
  lockButton.hidden = false;
}

async function guarded(task: () => Promise<void>, near?: HTMLElement) {
  for (const message of inlineMessages) message.textContent = "";
  inline = near ?? null;
  try {
    await task();
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) {
      showLocked("The admin token did not match. Unlock again.");
      return;
    }
    say(error instanceof Error ? error.message : "Something went wrong.");
  }
}

// ---- Events -------------------------------------------------------------------------------

lockForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const candidate = tokenInput.value.trim();
  if (!candidate) {
    say("Enter the admin token.");
    return;
  }
  token = candidate;
  void (async () => {
    try {
      const next = await call<Snapshot>("read", {});
      writeToken(candidate);
      tokenInput.value = "";
      showUnlocked();
      render(next);
      await loadStories();
      say("Unlocked.");
      providerSelect.focus();
    } catch (error) {
      token = null;
      say(
        error instanceof ApiError && error.status === 401
          ? "That token did not match."
          : error instanceof Error
            ? error.message
            : "Unlock failed.",
      );
    }
  })();
});

lockButton.addEventListener("click", () =>
  showLocked("Locked. The token was removed from this tab."),
);

providerSelect.addEventListener("change", () => {
  selected = providerSelect.value as ProviderId;
  renderProviderFields();
  say(
    `Showing ${providerOf(selected)?.label ?? selected}. Save settings to make it active.`,
  );
});

modelList.addEventListener("change", () => {
  if (!modelList.value) return;
  modelInput.value = modelList.value;
  priceDirty = false;
  renderPrice();
  renderCapabilities();
});

modelInput.addEventListener("input", () => {
  priceDirty = false;
  renderPrice();
  renderCapabilities();
});

for (const input of [priceInput, priceOutput])
  input.addEventListener("input", () => {
    priceDirty = true;
    priceNote.textContent = "New prices are saved with Save settings.";
  });

refreshButton.addEventListener("click", () =>
  guarded(async () => {
    say("Refreshing models…");
    const result = await call<{
      status: string;
      models: string[];
      message?: string;
    }>("models", { provider: selected });
    if (result.status === "READY") {
      discovered[selected] = result.models;
      renderModels();
      say(`${result.models.length} models found.`);
    } else {
      say(
        result.message ?? "Model discovery is unavailable. Enter the model ID.",
      );
      modelInput.focus();
    }
  }, modelMessage),
);

saveKeyButton.addEventListener("click", () =>
  guarded(async () => {
    const apiKey = keyInput.value.trim();
    if (!apiKey) {
      say("Paste a key first.");
      keyInput.focus();
      return;
    }
    const next = await call<Snapshot>("credential", {
      provider: selected,
      apiKey,
    });
    keyInput.value = "";
    render(next, true);
    say(
      `Key saved for ${providerOf(selected)?.label}. Only its last four characters are shown.`,
    );
  }, keyMessage),
);

removeKeyButton.addEventListener("click", () =>
  guarded(async () => {
    const next = await call<Snapshot>("remove-key", { provider: selected });
    delete discovered[selected];
    render(next, true);
    say(`Key removed for ${providerOf(selected)?.label}.`);
  }, keyMessage),
);

saveButton.addEventListener("click", () =>
  guarded(async () => {
    const model = modelInput.value.trim();
    const cap = Number(capInput.value);
    if (!model) {
      say("Enter a model ID.");
      modelInput.focus();
      return;
    }
    if (!capInput.value || !Number.isFinite(cap)) {
      say("Enter a daily cap in dollars.");
      capInput.focus();
      return;
    }
    let price: { inputUsdPerMTok: number; outputUsdPerMTok: number } | null =
      null;
    if (priceDirty) {
      if (!priceInput.value || !priceOutput.value) {
        say("Enter both prices, or neither.");
        priceInput.focus();
        return;
      }
      price = {
        inputUsdPerMTok: Number(priceInput.value),
        outputUsdPerMTok: Number(priceOutput.value),
      };
    }
    const next = await call<Snapshot>("save", {
      provider: selected,
      model,
      enabled: enabledBox.checked,
      dailyCapUsd: cap,
      price,
    });
    priceDirty = false;
    render(next);
    say("Settings saved.");
  }, saveMessage),
);

confirmBox.addEventListener("change", () => {
  testButton.disabled = !confirmBox.checked;
});

testButton.addEventListener("click", () =>
  guarded(async () => {
    if (!confirmBox.checked) return;
    testButton.disabled = true;
    testResult.textContent = "Testing…";
    try {
      const result = await call<{
        status: string;
        message?: string;
        servedModel?: string | null;
        costUsd: number;
        snapshot: Snapshot;
      }>("test", { confirm: CONFIRM });
      render(result.snapshot);
      testResult.textContent =
        result.status === "PASS"
          ? `PASS: the provider answered${result.servedModel ? ` (model ${result.servedModel})` : ""}. Counted cost ${money(result.costUsd, 6)}.`
          : `UNAVAILABLE: ${result.message ?? "the call failed."} Counted cost ${money(result.costUsd, 6)}.`;
      say(`Connection test: ${result.status}.`);
    } catch (error) {
      testResult.textContent = "";
      throw error;
    } finally {
      confirmBox.checked = false;
      testButton.disabled = true;
    }
  }, testMessage),
);

generateButton.addEventListener("click", () =>
  guarded(async () => {
    const count = Number(storyCount.value);
    if (!Number.isInteger(count) || count < 1 || count > 10) {
      say("Ask for 1 to 10 stories.");
      storyCount.focus();
      return;
    }
    generateButton.disabled = true;
    say("Asking the model…");
    try {
      const result = await call<{
        status: string;
        message?: string;
        costUsd: number;
        kept: number;
        dropped: number;
        reasons: Record<string, number>;
        snapshot: Snapshot;
        stories: StoryList;
      }>("stories-generate", { profile: storyProfile.value, count });
      render(result.snapshot, true);
      renderStories(result.stories);
      const reasons = Object.entries(result.reasons)
        .map(([reason, n]) => `${reason} (${n})`)
        .join("; ");
      say(
        result.status === "UNAVAILABLE"
          ? `No stories: ${result.message ?? "the call failed."} Counted cost ${money(result.costUsd, 6)}.`
          : `Kept ${result.kept}, dropped ${result.dropped}${reasons ? `: ${reasons}` : ""}. Counted cost ${money(result.costUsd, 6)}.`,
      );
    } finally {
      generateButton.disabled = false;
    }
  }, generateMessage),
);

for (const list of [pendingList, approvedList])
  list.addEventListener("click", (event) => {
    const button = (event.target as HTMLElement).closest<HTMLButtonElement>(
      "button[data-story-action]",
    );
    if (!button) return;
    const action = button.dataset.storyAction!;
    const id = button.dataset.id!;
    void guarded(
      async () => {
        const next = await call<StoryList>(`stories-${action}`, { id });
        renderStories(next);
        say(
          action === "approve"
            ? "Approved. Try another may now use this story."
            : action === "reject"
              ? "Rejected and removed."
              : "Removed from the approved list.",
        );
        (action === "remove" ? approvedHeading : pendingHeading).focus();
      },
      action === "remove" ? approvedMessage : pendingMessage,
    );
  });

async function loadStories() {
  renderStories(await call<StoryList>("stories-list", {}));
}

// ---- Start --------------------------------------------------------------------------------

const savedToken = readToken();
showLocked();
void (async () => {
  if (!savedToken) {
    try {
      // Every route needs the token. This tokenless read is refused, but it makes the server
      // create the data folder and token on first use; the token appears only in its terminal.
      await call("read", {}, false);
    } catch (error) {
      if (!(error instanceof ApiError && error.status === 401))
        say(
          error instanceof Error ? error.message : "Settings are unavailable.",
        );
    }
    return;
  }
  token = savedToken;
  writeToken(savedToken);
  await guarded(async () => {
    const next = await call<Snapshot>("read", {});
    showUnlocked();
    render(next);
    await loadStories();
    say("Unlocked for this tab.");
  });
})();
