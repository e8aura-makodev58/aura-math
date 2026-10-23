import { runtimeTopics } from "../topics/registry";
import type { Lesson, TopicId } from "../core/types";

export const escapeHtml = (value: unknown): string =>
  String(value).replace(
    /[&<>"']/g,
    (char) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        char
      ]!,
  );

export function topicIcon(topic: TopicId): string {
  const shape: Record<TopicId, string> = {
    decimals:
      '<rect x="4" y="7" width="30" height="26" rx="4" fill="none" stroke="currentColor" stroke-width="2"/><path d="M14 7v26M24 7v26" stroke="currentColor" stroke-width="2"/><circle cx="14" cy="29" r="3" fill="currentColor"/>',
    "fraction-calculations":
      '<circle cx="20" cy="20" r="15" fill="none" stroke="currentColor" stroke-width="2"/><path d="M20 5v30M5 20h30" stroke="currentColor" stroke-width="2"/><path d="M20 20V5a15 15 0 0 1 15 15Z" fill="currentColor"/>',
    "angle-measure":
      '<path d="M6 32h30" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"/><path d="M6 32L30 12" stroke="currentColor" stroke-width="3" stroke-linecap="round"/><path d="M20 32a14 14 0 0 0-5-10.5" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"/><circle cx="6" cy="32" r="2.5" fill="currentColor"/>',
    nets: '<g fill="currentColor" fill-opacity=".18" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><rect x="4" y="16" width="8" height="8"/><rect x="12" y="16" width="8" height="8" fill-opacity=".5"/><rect x="20" y="16" width="8" height="8"/><rect x="28" y="16" width="8" height="8"/><rect x="12" y="8" width="8" height="8"/><rect x="12" y="24" width="8" height="8"/></g>',
    "bar-charts":
      '<path d="M8 5v29h28" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/><path d="M3 11h5M3 18h5M3 25h5" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><rect x="13" y="21" width="7" height="13" fill="currentColor"/><rect x="23" y="13" width="7" height="21" fill="currentColor" opacity=".6"/><rect x="29" y="4" width="6" height="6" rx="1" fill="currentColor"/><path d="M31 15h4" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>',
    "pie-charts":
      '<path d="M18 22h14a14 14 0 1 1-14-14Z" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linejoin="round"/><path d="M18 22v14M18 22L4.7 26.3" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><path d="M22 18h14A14 14 0 0 0 22 4Z" fill="currentColor"/>',
    symmetry:
      '<path d="M20 4v32" stroke="currentColor" stroke-width="2" stroke-dasharray="3 3"/><path d="M17 8L6 20l11 12z" fill="currentColor" opacity=".55"/><path d="M23 8l11 12-11 12z" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linejoin="round"/>',
    "line-graphs":
      '<path d="M5 6v28h30" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/><path d="M9 26l7-8 6 5 9-13" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/><circle cx="16" cy="18" r="2.5" fill="currentColor"/><circle cx="22" cy="23" r="2.5" fill="currentColor"/><circle cx="31" cy="10" r="2.5" fill="currentColor"/>',
    "whole-numbers":
      '<rect x="4" y="22" width="9" height="12" rx="2" fill="currentColor"/><rect x="15.5" y="14" width="9" height="20" rx="2" fill="currentColor" opacity=".7"/><rect x="27" y="6" width="9" height="28" rx="2" fill="currentColor" opacity=".45"/>',
    "area-perimeter":
      '<path d="M5 5h30v14H20v16H5Z" fill="currentColor" opacity=".25"/><path d="M5 5h30v14H20v16H5Z" fill="none" stroke="currentColor" stroke-width="3"/>',
    comparison:
      '<rect x="5" y="8" width="31" height="9" rx="3" fill="currentColor"/><rect x="5" y="23" width="20" height="9" rx="3" fill="currentColor" opacity=".65"/><path d="M29 27h7m-3.5-3.5v7" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>',
    angles:
      '<path d="M7 6v27h27M7 22h11v11" fill="none" stroke="currentColor" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"/><path d="M25 33a18 18 0 0 0-18-18" fill="none" stroke="currentColor" stroke-width="2" opacity=".65"/>',
    "place-value":
      '<rect x="4" y="7" width="20" height="20" rx="2" fill="none" stroke="currentColor" stroke-width="2"/><path d="M10.7 7v20M17.3 7v20M4 13.7h20M4 20.3h20" stroke="currentColor" stroke-width="1.3" opacity=".68"/><path d="M29 7v20" stroke="currentColor" stroke-width="5" stroke-linecap="round"/><circle cx="34" cy="33" r="3" fill="currentColor"/>',
    "equal-groups":
      '<rect x="4" y="8" width="13" height="24" rx="6" fill="none" stroke="currentColor" stroke-width="2"/><rect x="23" y="8" width="13" height="24" rx="6" fill="none" stroke="currentColor" stroke-width="2"/><circle cx="10.5" cy="15" r="2.5" fill="currentColor"/><circle cx="10.5" cy="25" r="2.5" fill="currentColor"/><circle cx="29.5" cy="15" r="2.5" fill="currentColor"/><circle cx="29.5" cy="25" r="2.5" fill="currentColor"/>',
    fractions:
      '<rect x="5" y="10" width="30" height="20" rx="10" fill="none" stroke="currentColor" stroke-width="2.5"/><path d="M20 10v20" stroke="currentColor" stroke-width="2.5"/><path d="M10 14a8 8 0 0 0 0 12h10V14Z" fill="currentColor" opacity=".72"/>',
    "picture-graphs":
      '<path d="M6 33h29" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"/><circle cx="12" cy="26" r="3" fill="currentColor"/><circle cx="12" cy="18" r="3" fill="currentColor"/><circle cx="23" cy="26" r="3" fill="currentColor"/><circle cx="23" cy="18" r="3" fill="currentColor"/><circle cx="23" cy="10" r="3" fill="currentColor"/><circle cx="34" cy="26" r="3" fill="currentColor"/>',
  };
  return `<svg viewBox="0 0 40 40" aria-hidden="true" focusable="false">${shape[topic]}</svg>`;
}

export function heroArt(): string {
  return `<svg class="hero-art" viewBox="0 0 420 260" aria-hidden="true" focusable="false"><defs><filter id="hero-shadow" x="-20%" y="-30%" width="150%" height="160%"><feDropShadow dx="0" dy="7" stdDeviation="8" flood-color="#355a49" flood-opacity=".12"/></filter></defs><path d="M46 216c59-31 145-45 226-29 48 10 92 6 121-13" fill="none" stroke="#c5d7bc" stroke-width="3" stroke-linecap="round" stroke-dasharray="2 10"/><g filter="url(#hero-shadow)"><rect x="61" y="88" width="113" height="104" rx="19" fill="#fff8e9" transform="rotate(-8 118 140)"/><rect x="80" y="111" width="18" height="62" rx="5" fill="#d8876b"/><rect x="103" y="134" width="18" height="39" rx="5" fill="#f1ba60"/><rect x="126" y="100" width="18" height="73" rx="5" fill="#648e7d"/><rect x="186" y="42" width="116" height="120" rx="22" fill="#f1bc65" transform="rotate(8 244 102)"/><rect x="209" y="74" width="70" height="20" rx="10" fill="#fff8e9"/><rect x="209" y="99" width="70" height="20" rx="10" fill="#e5a95a" stroke="#fff8e9" stroke-width="3"/><path d="M244 74v45" stroke="#fff8e9" stroke-width="3"/><rect x="290" y="122" width="80" height="80" rx="19" fill="#c8dcce" transform="rotate(-9 330 162)"/><path d="M310 181v-43h43" fill="none" stroke="#315c46" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/><path d="M310 164a17 17 0 0 1 17 17" fill="none" stroke="#315c46" stroke-width="3"/></g><g fill="#315c46"><circle cx="44" cy="59" r="5"/><circle cx="60" cy="59" r="5"/><circle cx="76" cy="59" r="5"/><circle cx="52" cy="75" r="5"/><circle cx="68" cy="75" r="5"/><circle cx="84" cy="75" r="5"/></g><path d="M347 51v11m-5.5-5.5h11M135 37v11m-5.5-5.5h11M385 97v8m-4-4h8" stroke="#c47b52" stroke-width="3" stroke-linecap="round"/><circle cx="176" cy="219" r="5" fill="#ebaa59"/><circle cx="200" cy="225" r="5" fill="#ebaa59"/><circle cx="224" cy="219" r="5" fill="#ebaa59"/></svg>`;
}

export function lessonVisual(lesson: Lesson): string {
  const registered = runtimeTopics[lesson.topic];
  if (registered) return registered.render(lesson);
  if (lesson.topic === "comparison") {
    const spec = lesson.specification;
    const larger = spec.unknown === "larger" ? "?" : escapeHtml(spec.larger);
    const smaller = spec.unknown === "smaller" ? "?" : escapeHtml(spec.smaller);
    const difference =
      spec.unknown === "difference"
        ? "?"
        : String(Number(spec.larger) - Number(spec.smaller));
    return `<div class="bar-model" role="img" aria-label="Comparison model, not to scale. ${escapeHtml(spec.largerName)} has ${larger} ${escapeHtml(spec.unit)}. ${escapeHtml(spec.smallerName)} has ${smaller} ${escapeHtml(spec.unit)}. Difference: ${difference}."><div class="model-row"><span>${escapeHtml(spec.largerName)}</span><div class="bar large">${larger} <small>${escapeHtml(spec.unit)}</small></div></div><div class="model-row"><span>${escapeHtml(spec.smallerName)}</span><div class="bar-parts"><div class="bar small">${smaller}</div><div class="difference">${difference}<small>more</small></div></div></div><p class="diagram-note">A comparison model · not to scale</p></div>`;
  }
  const angles = lesson.specification.angles as {
    id: string;
    degrees: number;
    rotation: number;
    label: string;
  }[];
  return `<div class="angle-reference"><svg viewBox="0 0 74 74" role="img" aria-label="Reference right angle: one arm points straight up and the other to the right, like the corner of a square."><path d="M18 10v45h45M18 43h12v12" fill="none" stroke="#315c46" stroke-width="3" stroke-linecap="round"/></svg><div><strong>Your reference corner</strong><p>This is a right angle, like the corner of a square.</p></div></div><div class="angle-grid">${angles
    .map((angle) => {
      const radians = (degrees: number) => (degrees * Math.PI) / 180;
      const point = (degrees: number, length: number) =>
        `${(80 + Math.cos(radians(degrees)) * length).toFixed(2)},${(85 + Math.sin(radians(degrees)) * length).toFixed(2)}`;
      const clock = (degrees: number) => {
        const hours = ((((degrees + 90) / 30) % 12) + 12) % 12;
        return Math.round(hours * 10) / 10 || 12;
      };
      return `<div class="angle-card"><svg viewBox="0 0 160 160" role="img" aria-label="Angle ${escapeHtml(angle.id)}. From the vertex, one arm points towards ${clock(angle.rotation)} o'clock and the other towards ${clock(angle.rotation - angle.degrees)} o'clock."><path d="M${point(angle.rotation, 60)} L80,85 L${point(angle.rotation - angle.degrees, 52)}" fill="none" stroke="#315c46" stroke-width="5" stroke-linecap="round"/><circle cx="80" cy="85" r="4" fill="#c47b35"/></svg><strong>${escapeHtml(angle.label || angle.id)}</strong></div>`;
    })
    .join(
      "",
    )}</div><p class="diagram-note">Look at the opening between the two arms.</p>`;
}
