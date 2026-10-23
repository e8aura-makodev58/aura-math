/** Pure integer pose model. Dial directions increase anticlockwise from east. */
export interface DialPose {
  x: number;
  y: number;
  rot: number;
}
export interface AngleFigure {
  x: number;
  y: number;
  first: number;
  turn: number;
}
export const wrap = (d: number) => ((d % 360) + 360) % 360;
export const angleDistance = (a: number, b: number) =>
  Math.min(wrap(a - b), wrap(b - a));
export function alignment(
  f: AngleFigure,
  p: DialPose,
): { arm: "first" | "second"; scale: "outer" | "inner" } | null {
  if (p.x !== f.x || p.y !== f.y) return null;
  const second = wrap(f.first + f.turn);
  for (const [arm, angle, other] of [
    ["first", f.first, second],
    ["second", second, f.first],
  ] as const) {
    const at = wrap(angle - p.rot),
      rest = wrap(other - p.rot);
    if ((at === 0 || at === 180) && rest <= 180)
      return { arm, scale: at === 0 ? "outer" : "inner" };
  }
  return null;
}
export function alignedPose(
  f: AngleFigure,
  arm: "first" | "second" = "first",
): DialPose {
  const at = arm === "first" ? f.first : wrap(f.first + f.turn);
  const other = arm === "first" ? wrap(f.first + f.turn) : f.first;
  return { x: f.x, y: f.y, rot: wrap(at + (wrap(other - at) > 180 ? 180 : 0)) };
}
export function moveDial(
  p: DialPose,
  dx: number,
  dy: number,
  dr = 0,
): DialPose {
  return {
    x: Math.max(35, Math.min(365, Math.round(p.x + dx))),
    y: Math.max(70, Math.min(330, Math.round(p.y + dy))),
    rot: wrap(Math.round(p.rot + dr)),
  };
}
