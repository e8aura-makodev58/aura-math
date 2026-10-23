declare module "virtual:approved-lessons" {
  const lessons: import("./released-content").ReleasedPackage[];
  export const releasedLibrary: import("./released-content").ReleasedLibrary;
  /** Shown on unreviewed content; empty when everything released was reviewed. */
  export const unreviewedLabel: string;
  export default lessons;
}
