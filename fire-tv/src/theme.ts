/** Colours from the web app's stylesheet (src/styles.css), so the TV keeps the Aura Math look. */
export const colors = {
  paper: '#fffdf8',
  ink: '#253f34',
  quiet: '#53665a',
  green: '#315c46',
  focus: '#9a4c10',
  surface: '#e9efe7',
  line: '#bad0bb',
  correct: '#2f6b4a',
  correctSurface: '#e0f1eb',
  incorrect: '#9c4e42',
  incorrectSurface: '#fae4de',
};

/** Sizes are tuned for a 1920x1080 landscape canvas viewed from a few feet away. */
export const type = {
  hero: 110,
  title: 64,
  prompt: 56,
  choice: 46,
  body: 34,
  meta: 28,
  footer: 26,
};

/** Keeps content inside the usual television overscan area. */
export const safe = {
  horizontal: 96,
  vertical: 64,
};
