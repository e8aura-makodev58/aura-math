/**
 * Scale and layout arithmetic shared by bar charts: the gridline step, the readable grain, the
 * number of rows and exact whole-pixel bar heights. Pure integer arithmetic, no drawing.
 */

/** The gridline steps a chart may use. */
export const SCALE_STEPS = [2, 5, 10, 20];
export const MIN_ROWS = 4;
export const MAX_ROWS = 10;

/**
 * Smallest unit every value must be a multiple of, so a bar can be read exactly: half a step when
 * a half step is a whole number of items, otherwise one whole step.
 */
export const grainFor = (step: number): number =>
  ({ 2: 1, 5: 5, 10: 5, 20: 10 })[step] ?? 0;

/** Rows (gaps between gridlines) for the largest value: at least 4 and at most 10 in a valid chart. */
export const rowsFor = (maxValue: number, step: number): number =>
  Math.max(MIN_ROWS, Math.ceil(maxValue / step));
/** Top of the axis. The largest value a chart can hold is `MAX_ROWS * step`. */
export const axisTop = (rows: number, step: number): number => rows * step;
export const maxValueFor = (step: number): number => MAX_ROWS * step;
/** Pixels per row: always even, so half a step is a whole number of pixels. */
export const rowPixels = (rows: number): number => 2 * Math.floor(100 / rows);
/** Exact pixel height of a value; an integer for every grain multiple. */
export const barPixels = (value: number, step: number, rows: number): number =>
  (value * rowPixels(rows)) / step;

/** Plot width available to the bars, in viewBox units. */
export const PLOT_WIDTH = 340;
/** Whole-unit width of one category slot (so every bar position is an integer). */
export const slotWidth = (categories: number): number =>
  Math.floor(PLOT_WIDTH / categories);
/** Conservative width of one bold capital in em, wider than real text so the estimate errs safe. */
export const CAP_EM = 0.65;
export const estimatedWidth = (chars: number, size: number): number =>
  chars * CAP_EM * size;
/** Longest label that fits under its slot (with 4 units of air). */
export const maxLabelChars = (categories: number, size: number): number =>
  Math.floor((slotWidth(categories) - 4) / (CAP_EM * size));
