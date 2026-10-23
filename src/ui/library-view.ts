import type {
  LibraryRecord,
  PreparationCollection,
} from "../library/catalogue";
import type { TopicId } from "../core/types";
import { heroArt, topicIcon } from "./visuals";
import { pickSpotlight } from "../library/spotlight";

export interface LibraryState {
  collection?: string;
  practice?: boolean;
  query: string;
  level: string;
  topic: string;
  all?: boolean;
  /** Home-page level tab. Unset means the default for the lessons on offer. */
  tab?: HomeTab;
  scroll?: number;
  homeScroll?: number;
  focusId?: string;
}
export type HomeTab = "p4" | "p23";
export const HOME_TABS: { id: HomeTab; label: string }[] = [
  { id: "p4", label: "Primary 4" },
  { id: "p23", label: "Primary 2–3" },
];
const tabOf = (record: LibraryRecord): HomeTab =>
  record.level === "P4" ? "p4" : "p23";
/** Topics appear in a teaching order, grouped under strands, so a level reads like a contents page. */
const STRANDS = ["Numbers and operations", "Measurement", "Geometry", "Data"];
const TOPIC_ORDER = [
  "whole-numbers",
  "decimals",
  "fraction-calculations",
  "area-perimeter",
  "angle-measure",
  "nets",
  "symmetry",
  "bar-charts",
  "line-graphs",
  "pie-charts",
  "place-value",
  "equal-groups",
  "fractions",
  "comparison",
  "angles",
  "picture-graphs",
];
const orderOf = (topic: string) => {
  const i = TOPIC_ORDER.indexOf(topic);
  return i < 0 ? TOPIC_ORDER.length : i;
};
export const emptyLibraryState = (): LibraryState => ({
  query: "",
  level: "all",
  topic: "all",
});

export function readLibraryRoute(
  hash: string,
  records: readonly LibraryRecord[],
  collections: readonly PreparationCollection[] = [],
) {
  const parts = hash.replace(/^#/, "").split("?");
  const params = new URLSearchParams(parts[1] ?? "");
  const state = emptyLibraryState();
  state.query = (params.get("q") ?? "").slice(0, 200);
  const level = params.get("level");
  if (level === "P2" || level === "P3" || level === "P4") state.level = level;
  state.all = params.get("all") === "1";
  const tab = params.get("tab");
  if (tab === "p4" || tab === "p23") state.tab = tab;
  if (collections.some((c) => c.id === params.get("collection")))
    state.collection = params.get("collection")!;
  state.practice = !!state.collection && params.get("practice") === "1";
  const knownTopics = new Set(records.map((r) => r.topic));
  let routeTopic = "";
  let requested = "";
  try {
    if (parts[0].startsWith("topic/"))
      routeTopic = decodeURIComponent(parts[0].slice(6));
    if (parts[0].startsWith("lesson/"))
      requested = decodeURIComponent(parts[0].slice(7));
  } catch {
    // An invalid route returns to the permitted home catalogue.
  }
  const topic = routeTopic || params.get("topic");
  if (topic && knownTopics.has(topic as TopicId)) state.topic = topic;
  if (parts[0].startsWith("topic/") && state.topic === "all")
    return { state: emptyLibraryState(), lessonId: null };
  if (
    parts[0] &&
    parts[0] !== "library" &&
    !parts[0].startsWith("topic/") &&
    !parts[0].startsWith("lesson/")
  )
    return { state: emptyLibraryState(), lessonId: null };
  const lessonRecord = records.find((r) => r.lesson.id === requested);
  if (
    lessonRecord &&
    state.topic === "all" &&
    !state.query &&
    !state.all &&
    !state.collection
  )
    state.topic = lessonRecord.topic;
  return {
    state,
    lessonId: lessonRecord ? requested : null,
  };
}

export function libraryRoute(state: LibraryState, lessonId?: string) {
  const params = new URLSearchParams();
  if (state.collection) params.set("collection", state.collection);
  if (state.practice) params.set("practice", "1");
  if (state.query) params.set("q", state.query.slice(0, 200));
  if (state.level !== "all") params.set("level", state.level);
  if (state.all) params.set("all", "1");
  if (state.tab) params.set("tab", state.tab);
  const focusedTopic =
    !lessonId &&
    !state.collection &&
    state.topic !== "all" &&
    !state.query &&
    state.level === "all" &&
    !state.all;
  if (state.topic !== "all" && !focusedTopic) params.set("topic", state.topic);
  const path = lessonId
    ? `lesson/${encodeURIComponent(lessonId)}`
    : focusedTopic
      ? `topic/${encodeURIComponent(state.topic)}`
      : "library";
  return `#${path}${params.size ? `?${params}` : ""}`;
}

const node = <K extends keyof HTMLElementTagNameMap>(tag: K, text?: string) => {
  const n = document.createElement(tag);
  if (text !== undefined) n.textContent = text;
  return n;
};

interface LibraryOptions {
  records: readonly LibraryRecord[];
  collections?: readonly PreparationCollection[];
  draft?: boolean;
  surface?: "learner" | "author";
  actionLabel?: string;
  state?: LibraryState;
  onOpen: (record: LibraryRecord) => void;
  onCopy?: (record: LibraryRecord) => void;
  onStateChange?: (state: LibraryState) => void;
  results?: ReadonlyMap<string, string>;
  onDelete?: (record: LibraryRecord) => void;
  captions?: ReadonlyMap<string, string>;
  /** Date used for today's spotlight; defaults to now. Injectable so the page is testable. */
  today?: Date;
}

export function mountLibraryView(root: HTMLElement, options: LibraryOptions) {
  let state = { ...emptyLibraryState(), ...options.state };
  const author = options.surface === "author";
  root.replaceChildren();
  root.classList.add("material-library");
  const records = options.records;
  const topicRecords = [...new Map(records.map((r) => [r.topic, r])).values()];

  const toolbar = node("div");
  toolbar.className = author
    ? "library-filters"
    : "library-toolbar library-filters";
  const searchLabel = node(
    "label",
    author ? "Find a lesson" : "Looking for something?",
  );
  const search = node("input");
  search.type = "search";
  search.maxLength = 200;
  search.placeholder = "Search lessons, topics or skills";
  search.value = state.query;
  searchLabel.append(search);
  const levelLabel = node("label", "Level");
  const levels = node("select");
  levels.setAttribute("aria-label", "Lesson level");
  for (const value of ["all", "P2", "P3", "P4"]) {
    const option = node("option", value === "all" ? "All levels" : value);
    option.value = value;
    levels.append(option);
  }
  levels.value = state.level;
  levelLabel.append(levels);
  const allButton = node("button", "All lessons");
  allButton.type = "button";
  allButton.className = "text-button library-all";
  const clear = node("button", author ? "Clear filters" : "See all topics");
  clear.type = "button";
  toolbar.append(searchLabel, levelLabel);
  if (!author) toolbar.append(allButton);
  toolbar.append(clear);

  const heroHost = node("div");
  heroHost.className = "library-hero-host";
  const topics = node("nav");
  topics.className = "library-topic-filters";
  topics.setAttribute("aria-label", "Topics");
  const summary = node("p");
  summary.className = "library-count";
  summary.setAttribute("role", "status");
  const content = node("div");
  content.className = "library-groups";
  root.append(heroHost, toolbar, topics, summary, content);

  function notify() {
    options.onStateChange?.({ ...state });
  }
  function scrollBack(top: number) {
    try {
      window.scrollTo(0, top);
    } catch {
      // Scroll restoration is optional in DOM-only test environments.
    }
  }
  function chooseTopic(topic: string) {
    state.collection = undefined;
    state.practice = false;
    state.homeScroll = window.scrollY;
    state.topic = topic;
    state.query = "";
    state.level = "all";
    state.all = false;
    search.value = "";
    levels.value = "all";
    render();
    notify();
    scrollBack(0);
    content
      .querySelector<HTMLElement>(".topic-detail h1")
      ?.focus({ preventScroll: true });
  }
  function allTopics() {
    state.collection = undefined;
    state.practice = false;
    const oldTopic = state.topic;
    state.topic = "all";
    state.query = "";
    state.level = "all";
    state.all = false;
    search.value = "";
    levels.value = "all";
    render();
    notify();
    if (oldTopic !== "all") {
      const tile = [
        ...content.querySelectorAll<HTMLButtonElement>(".topic-tile"),
      ].find((button) => button.dataset.topic === oldTopic);
      tile?.focus({ preventScroll: typeof state.homeScroll === "number" });
    }
    if (typeof state.homeScroll === "number") scrollBack(state.homeScroll);
  }
  function open(record: LibraryRecord) {
    state.focusId = record.lesson.id;
    state.scroll = window.scrollY;
    options.onOpen(record);
  }
  function lessonRows(
    visible: readonly LibraryRecord[],
    parent: HTMLElement,
    headingTag: "h2" | "h3" | "h4" = "h2",
  ) {
    for (const record of visible) {
      const row = node("article");
      row.className = author ? "material-card" : "lesson-row material-card";
      row.dataset.lessonId = record.lesson.id;
      row.dataset.topic = record.topic;
      const label = node(
        "p",
        `${record.skillLabel} · ${record.level} · ${record.lesson.minutes} min${options.draft ? " · Draft" : ""}`,
      );
      label.className = "lesson-row__meta";
      row.append(label, node(headingTag, record.lesson.title));
      row.append(node("p", record.blurb || record.lesson.objective));
      if (record.prerequisites.length) {
        const prereq = node("p");
        prereq.className = "library-prerequisites";
        prereq.append(document.createTextNode("Builds on: "));
        record.prerequisites.forEach((skillId, i) => {
          if (i) prereq.append(document.createTextNode(", "));
          const found = records.find(
            (candidate) => candidate.skillId === skillId,
          );
          if (found) {
            const button = node("button", found.skillLabel);
            button.type = "button";
            button.className = "text-button";
            button.onclick = () => open(found);
            prereq.append(button);
          } else {
            prereq.append(document.createTextNode(skillId.replace(/-/g, " ")));
          }
        });
        row.append(prereq);
      }
      const actions = node("div");
      actions.className = "material-actions";
      const start = node("button", options.actionLabel ?? "Start lesson →");
      start.type = "button";
      start.className = "primary-button lesson-card";
      start.dataset.testid = `lesson-card-${record.lesson.id}`;
      start.dataset.lesson = record.lesson.id;
      start.setAttribute(
        "aria-label",
        `${options.actionLabel ?? "Start lesson"}: ${record.lesson.title}`,
      );
      start.onclick = () => {
        state.practice = false;
        open(record);
      };
      actions.append(start);
      if (options.onCopy) {
        const copy = node("button", "Create a copy");
        copy.type = "button";
        copy.onclick = () => options.onCopy!(record);
        actions.append(copy);
      }
      if (options.captions?.has(record.lesson.id))
        row.append(node("p", options.captions.get(record.lesson.id)!));
      if (options.onDelete) {
        const del = node("button", "Delete");
        del.type = "button";
        del.onclick = () => options.onDelete!(record);
        actions.append(del);
      }
      if (options.results?.has(record.lesson.id))
        row.append(node("p", options.results.get(record.lesson.id)!));
      row.append(actions);
      parent.append(row);
    }
  }
  function render() {
    heroHost.replaceChildren();
    const query = state.query.trim().toLocaleLowerCase().replace(/\s+/g, " ");
    const filtered = records.filter(
      (r) =>
        (state.level === "all" || r.level === state.level) &&
        (author ? state.topic === "all" || r.topic === state.topic : true) &&
        [
          r.lesson.title,
          r.lesson.objective,
          r.blurb,
          r.topicLabel,
          r.topicDescription,
          r.skillLabel,
          ...r.tags,
        ]
          .join(" ")
          .toLocaleLowerCase()
          .replace(/\s+/g, " ")
          .includes(query),
    );
    const topicFocus =
      !author &&
      state.topic !== "all" &&
      !query &&
      state.level === "all" &&
      !state.all &&
      !state.collection;
    const resultsMode =
      author || !!query || state.level !== "all" || !!state.all;
    const activeCollection = options.collections?.find(
      (c) => c.id === state.collection,
    );
    const shownCount = activeCollection
      ? records.filter((r) => activeCollection.lessonIds.includes(r.lesson.id))
          .length
      : topicFocus
        ? records.filter((record) => record.topic === state.topic).length
        : resultsMode
          ? filtered.length
          : records.length;
    summary.textContent = `${shownCount} ${shownCount === 1 ? "lesson" : "lessons"}${options.draft ? " · not reviewed by a teacher · each P4 lesson has 6 saved examples inside" : ""}`;
    clear.disabled =
      !state.query &&
      state.level === "all" &&
      state.topic === "all" &&
      !state.all &&
      !state.collection;
    topics.replaceChildren();
    if (author) {
      for (const record of [null, ...topicRecords]) {
        const id = record?.topic ?? "all";
        const count = records.filter(
          (r) =>
            (id === "all" || r.topic === id) &&
            (state.level === "all" || r.level === state.level),
        ).length;
        const button = node(
          "button",
          `${record?.topicLabel ?? "All topics"} (${count})`,
        );
        button.type = "button";
        button.setAttribute("aria-pressed", String(state.topic === id));
        button.onclick = () => {
          state.topic = id;
          render();
          notify();
        };
        topics.append(button);
      }
    }
    content.replaceChildren();
    if (!records.length) {
      const empty = node("section");
      empty.className = "library-empty";
      empty.append(
        node(
          "h1",
          author ? "No lessons available yet" : "Your lessons are on their way",
        ),
        node(
          "p",
          author
            ? "Create a new lesson to get started."
            : "Approved lessons will appear here after review.",
        ),
      );
      content.append(empty);
      return;
    }
    if (author) {
      if (!filtered.length) return emptyResult();
      for (const topicRecord of topicRecords) {
        const byTopic = filtered
          .filter((r) => r.topic === topicRecord.topic)
          .sort((a, b) => a.sequence - b.sequence);
        if (!byTopic.length) continue;
        const group = node("section");
        group.className = "library-topic";
        group.dataset.topic = topicRecord.topic;
        const heading = node("div");
        heading.className = "library-group-heading";
        heading.append(
          node("p", topicRecord.strand),
          node("h2", topicRecord.topicLabel),
          node("span", `${byTopic.length} lessons`),
        );
        group.append(heading);
        for (const skillId of new Set(
          byTopic.map((record) => record.skillId),
        )) {
          const bySkill = byTopic.filter(
            (record) => record.skillId === skillId,
          );
          const skill = node("div");
          skill.className = "library-skill";
          skill.append(node("h3", bySkill[0].skillLabel));
          const cards = node("div");
          cards.className = "library-cards";
          lessonRows(bySkill, cards, "h4");
          skill.append(cards);
          group.append(skill);
        }
        content.append(group);
      }
      return;
    }
    const collection = options.collections?.find(
      (c) => c.id === state.collection,
    );
    if (collection) {
      const section = node("section");
      section.className = "topic-detail preparation";
      const back = node("button", "← All topics");
      back.type = "button";
      back.className = "text-button";
      back.onclick = () => clear.click();
      section.append(
        back,
        node("h1", collection.label),
        node("p", collection.description),
      );
      if (options.draft)
        section.append(
          node(
            "p",
            "Draft lessons: not yet checked by a teacher. Ask a learning partner to check the worked solutions.",
          ),
        );
      const practice = collection.practiceIds
        .map((id) => records.find((r) => r.lesson.id === id))
        .filter((r): r is LibraryRecord => !!r);
      if (practice.length) {
        const begin = node(
          "button",
          `Try ${practice.length} mixed ${practice.length === 1 ? "question" : "questions"} →`,
        );
        begin.type = "button";
        begin.className = "primary-button";
        begin.onclick = () => {
          state.practice = true;
          open(practice[0]);
        };
        section.append(
          begin,
          node(
            "p",
            "Untimed practice with hints and retries. This short set does not cover the whole syllabus.",
          ),
        );
      }
      for (const topic of topicRecords) {
        const members = collection.lessonIds
          .map((id) =>
            records.find((r) => r.lesson.id === id && r.topic === topic.topic),
          )
          .filter((r): r is LibraryRecord => !!r);
        if (!members.length) continue;
        const group = node("section");
        group.className = "library-topic";
        group.dataset.topic = topic.topic;
        group.append(node("h2", topic.topicLabel));
        lessonRows(members, group);
        section.append(group);
      }
      content.append(section);
      return;
    }
    if (topicFocus) {
      const byTopic = records
        .filter((r) => r.topic === state.topic)
        .sort((a, b) => a.sequence - b.sequence);
      if (!byTopic.length) {
        state.topic = "all";
        render();
        return;
      }
      const topic = byTopic[0];
      const detail = node("section");
      detail.className = "topic-detail";
      detail.dataset.topic = topic.topic;
      const back = node("button", "← All topics");
      back.type = "button";
      back.className = "text-button topic-detail__back";
      back.onclick = allTopics;
      const icon = node("span");
      icon.className = "topic-detail__icon";
      icon.setAttribute("aria-hidden", "true");
      icon.innerHTML = topicIcon(topic.topic);
      const heading = node("h1", topic.topicLabel);
      heading.tabIndex = -1;
      detail.append(
        back,
        icon,
        heading,
        node("p", topic.topicDescription || topic.strand),
        node(
          "p",
          `${byTopic.length} ${byTopic.length === 1 ? "lesson" : "lessons"} · ${[...new Set(byTopic.map((r) => r.level))].join(" / ")}`,
        ),
      );
      const rows = node("div");
      rows.className = "library-rows";
      lessonRows(byTopic, rows);
      detail.append(rows);
      content.append(detail);
      return;
    }
    if (resultsMode) {
      const section = node("section");
      section.className = "library-results";
      section.append(
        node("h1", query ? "Lessons you might mean" : "All lessons"),
      );
      if (!filtered.length) {
        const empty = node("div");
        empty.className = "library-empty";
        empty.append(
          node("h2", "No lessons match yet"),
          node("p", "Try a shorter search or see all topics."),
        );
        section.append(empty);
      } else {
        const ordered = [...filtered].sort(
          (a, b) =>
            a.topicLabel.localeCompare(b.topicLabel) || a.sequence - b.sequence,
        );
        lessonRows(ordered, section);
      }
      content.append(section);
      return;
    }
    const home = node("section");
    home.className = "library-home";
    // Which level's lessons the home page shows. One level at a time keeps the page short.
    const present = HOME_TABS.filter((t) =>
      records.some((r) => tabOf(r) === t.id),
    );
    const tab: HomeTab =
      state.tab && present.some((t) => t.id === state.tab)
        ? state.tab
        : (present[0]?.id ?? "p4");
    const shown = records.filter((r) => tabOf(r) === tab);
    const hero = node("div");
    hero.className = "library-hero";
    const copy = node("div");
    copy.className = "library-hero__copy";
    copy.append(
      node("p", "A little wonder in every answer"),
      node("h1", "See maths in a whole new way."),
      node("p", "Pick a topic, try a lesson, and see what clicks."),
    );
    // The gentlest first lesson on show: the first topic in teaching order, its first lesson.
    const firstTopic = [...new Set(shown.map((r) => r.topic))].sort(
      (a, b) => orderOf(a) - orderOf(b),
    )[0];
    const starter =
      shown
        .filter((r) => r.topic === firstTopic)
        .sort((a, b) => a.sequence - b.sequence)[0] ?? records[0];
    const start = node("button", "Start with a lesson →");
    start.type = "button";
    start.className = "primary-button library-start";
    start.setAttribute(
      "aria-label",
      `Start with a lesson: ${starter.lesson.title}`,
    );
    start.onclick = () => open(starter);
    copy.append(start);
    const art = node("div");
    art.className = "library-hero__art";
    art.innerHTML = heroArt();
    hero.append(copy, art);
    heroHost.append(hero);

    // Today's spotlight: a different topic every day, chosen only from what is on show.
    const pick = pickSpotlight(shown, options.today ?? new Date());
    if (pick) {
      const card = node("section");
      card.className = "spotlight";
      card.dataset.topic = pick.topic;
      card.dataset.testid = "spotlight";
      card.setAttribute("aria-labelledby", "spotlight-title");
      const icon = node("span");
      icon.className = "spotlight__icon";
      icon.setAttribute("aria-hidden", "true");
      icon.innerHTML = topicIcon(pick.topic);
      const body = node("div");
      body.className = "spotlight__body";
      const eyebrow = node("p", "Today’s spotlight");
      eyebrow.className = "spotlight__eyebrow";
      eyebrow.id = "spotlight-title";
      const title = node("h2", pick.lesson.title);
      const blurb = node(
        "p",
        `${pick.topicLabel} · ${pick.blurb || pick.lesson.objective}`,
      );
      const actions = node("div");
      actions.className = "spotlight__actions";
      const go = node("button", "Try it →");
      go.type = "button";
      go.className = "primary-button spotlight__go";
      go.dataset.testid = "spotlight-go";
      go.dataset.lesson = pick.lesson.id;
      go.setAttribute(
        "aria-label",
        `Try today’s spotlight: ${pick.lesson.title}`,
      );
      go.onclick = () => open(pick);
      const more = node("button", `More ${pick.topicLabel}`);
      more.type = "button";
      more.className = "text-button";
      more.onclick = () => chooseTopic(pick.topic);
      actions.append(go, more);
      body.append(eyebrow, title, blurb, actions);
      const note = node("p", "New every day");
      note.className = "spotlight__note";
      card.append(icon, body, note);
      home.append(card);
    }

    // Level switch, only when more than one level has lessons on offer.
    if (present.length > 1) {
      const group = node("div");
      group.className = "level-tabs";
      group.setAttribute("role", "group");
      group.setAttribute("aria-label", "Choose a level");
      for (const t of present) {
        const count = records.filter((r) => tabOf(r) === t.id);
        const topicCount = new Set(count.map((r) => r.topic)).size;
        const button = node("button");
        button.type = "button";
        button.dataset.tab = t.id;
        button.dataset.testid = `level-tab-${t.id}`;
        button.setAttribute("aria-pressed", String(t.id === tab));
        button.append(
          node("strong", t.label),
          node("span", `${topicCount} topics · ${count.length} lessons`),
        );
        button.onclick = () => {
          state.tab = t.id;
          render();
          notify();
          content
            .querySelector<HTMLElement>(`[data-tab="${t.id}"]`)
            ?.focus({ preventScroll: true });
        };
        group.append(button);
      }
      home.append(group);
    }

    for (const collection of options.collections ?? []) {
      const members = records.filter(
        (r) => collection.lessonIds.includes(r.lesson.id) && tabOf(r) === tab,
      );
      if (!members.length) continue;
      const banner = node("div");
      banner.className = "revision-banner";
      const text = node("div");
      const practice = collection.practiceIds.filter((id) =>
        records.some((r) => r.lesson.id === id),
      ).length;
      text.append(
        node("strong", collection.label),
        node(
          "span",
          `${members.length} lessons${practice ? ` · ${practice} mixed questions` : ""} · untimed, with hints`,
        ),
      );
      const entry = node("button", "Start the adventure →");
      entry.type = "button";
      entry.className = "primary-button preparation-entry";
      entry.onclick = () => {
        state = {
          ...emptyLibraryState(),
          collection: collection.id,
          tab: state.tab,
        };
        render();
        notify();
        const h = content.querySelector<HTMLElement>("h1");
        if (h) {
          h.tabIndex = -1;
          h.focus();
        }
      };
      banner.append(text, entry);
      home.append(banner);
    }

    const heading = node("h2", "Where will you explore?");
    heading.className = "explore-heading";
    home.append(heading);
    const inTab = [...new Map(shown.map((r) => [r.topic, r])).values()];
    const strands = [
      ...new Set([
        ...STRANDS.filter((x) => inTab.some((r) => r.strand === x)),
        ...inTab.map((r) => r.strand),
      ]),
    ];
    const strandHost = node("div");
    strandHost.className = "strand-groups";
    home.append(strandHost);
    for (const strand of strands) {
      const section = node("section");
      section.className = "strand-group";
      const inStrand = inTab
        .filter((r) => r.strand === strand)
        .sort((a, b) => orderOf(a.topic) - orderOf(b.topic));
      const title = node("h3", strand);
      title.className = "strand-group__title";
      // Small strands sit side by side instead of leaving empty rows.
      section.dataset.size = String(Math.min(inStrand.length, 3));
      const grid = node("div");
      grid.className = "topic-grid";
      for (const topic of inStrand) {
        const inTopic = shown
          .filter((r) => r.topic === topic.topic)
          .sort((a, b) => a.sequence - b.sequence);
        const tile = node("button");
        tile.type = "button";
        tile.className = "topic-tile";
        tile.dataset.topic = topic.topic;
        tile.dataset.testid = `topic-tile-${topic.topic}`;
        const icon = node("span");
        icon.className = "topic-tile__icon";
        icon.setAttribute("aria-hidden", "true");
        icon.innerHTML = topicIcon(topic.topic);
        const body = node("span");
        body.className = "topic-tile__text";
        const levels = [...new Set(inTopic.map((r) => r.level))].join(" / ");
        body.append(
          node("strong", topic.topicLabel),
          node("span", topic.topicDescription || topic.strand),
          node(
            "span",
            `${inTopic.length} ${inTopic.length === 1 ? "lesson" : "lessons"} · ${levels}`,
          ),
          node("span", `Try first: ${inTopic[0].lesson.title}`),
        );
        tile.append(icon, body);
        tile.setAttribute(
          "aria-label",
          `Explore ${topic.topicLabel}: ${inTopic.length} ${inTopic.length === 1 ? "lesson" : "lessons"}`,
        );
        tile.onclick = () => chooseTopic(topic.topic);
        grid.append(tile);
      }
      section.append(title, grid);
      strandHost.append(section);
    }
    content.append(home);
    return;

    function emptyResult() {
      const empty = node("section");
      empty.className = "library-empty";
      empty.append(
        node("h2", "No lessons match yet"),
        node("p", "Try a shorter search or clear your filters."),
      );
      content.append(empty);
    }
  }
  search.oninput = () => {
    state.collection = undefined;
    state.practice = false;
    state.query = search.value.slice(0, 200);
    if (!author) {
      state.topic = "all";
      state.all = false;
    }
    render();
    notify();
  };
  levels.onchange = () => {
    state.collection = undefined;
    state.practice = false;
    state.level = levels.value;
    if (!author) state.topic = "all";
    render();
    notify();
  };
  allButton.onclick = () => {
    state.collection = undefined;
    state.practice = false;
    state.topic = "all";
    state.query = "";
    state.level = "all";
    state.all = true;
    search.value = "";
    levels.value = "all";
    render();
    notify();
    content
      .querySelector<HTMLElement>(".library-results h1")
      ?.setAttribute("tabindex", "-1");
    content
      .querySelector<HTMLElement>(".library-results h1")
      ?.focus({ preventScroll: true });
  };
  clear.onclick = () => {
    state = emptyLibraryState();
    search.value = "";
    levels.value = "all";
    render();
    notify();
    if (author) search.focus();
    else {
      const heading = content.querySelector<HTMLElement>(".explore-heading");
      if (heading) {
        heading.tabIndex = -1;
        heading.focus({ preventScroll: true });
        scrollBack(0);
      }
    }
  };
  render();
  return {
    getState: () => ({ ...state }),
    restore(next: LibraryState) {
      state = { ...next };
      search.value = state.query;
      levels.value = state.level;
      render();
      const target = [
        ...content.querySelectorAll<HTMLButtonElement>("[data-lesson]"),
      ].find((b) => b.dataset.lesson === state.focusId);
      (
        target ??
        (state.focusId
          ? root.querySelector<HTMLButtonElement>(".library-start")
          : null)
      )?.focus({ preventScroll: true });
      if (typeof state.scroll === "number") scrollBack(state.scroll);
    },
    destroy() {
      root.replaceChildren();
      root.classList.remove("material-library");
    },
  };
}
