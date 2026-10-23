/** Versioned schema entry point. Typed hand-written validators are authoritative. */
export const PACKAGE_SCHEMA_VERSION = 1 as const;
export {
  validatePackage,
  parsePackage,
  MAX_PACKAGE_BYTES,
} from "../package-validation";
export type {
  LessonPackage,
  ValidationIssue,
  PackageResult,
} from "../package-validation";
