import type { Lesson } from "../core/types";
import { validateLesson } from "./validation";
import { adapters, runtimeTopics } from "../topics/registry";
import { canonicalJson } from "../content-release";

export const MAX_PACKAGE_BYTES = 100_000;
export interface ValidationIssue {
  path: string;
  severity: "error" | "warning";
  message: string;
  repair: string;
}
export interface LessonPackage {
  schemaVersion: 1 | 2 | 3;
  library?: { level: "P2" | "P3" | "P4"; skillId: string; tags: string[] };
  locale: "en-SG";
  adapterVersion: 1;
  curriculum: {
    objectiveId: string;
    sources: string[];
    evidenceStatus: "candidate";
  };
  authors: string[];
  provenance: {
    kind: "authored" | "generated";
    generatorVersion?: string;
    seed?: number;
  };
  lesson: Lesson;
  fixtures?: {
    stepId: string;
    accepted: (string | number | string[])[];
    rejected: (string | number | string[])[];
  }[];
  interpretation?: {
    entities: string[];
    quantities: {
      entity: string;
      value: number | string;
      unit: string;
      state: string;
    }[];
    relationships: (
      | {
          kind: "operation";
          id: string;
          operation: "add" | "multiply" | "subtract" | "fraction-of";
          inputs: string[];
          output: string;
        }
      | {
          kind: "additive-comparison";
          larger: string;
          smaller: string;
          difference: number;
        }
      | {
          kind: "equal-groups";
          groups: number;
          perGroup: number;
          total: number;
          unit: string;
        }
    )[];
    unknown: string;
    sourceSpans: { start: number; end: number; text: string }[];
    assumptions: string[];
    ambiguities: string[];
  };
}
export interface PackageResult {
  package?: LessonPackage;
  issues: ValidationIssue[];
}

/** Bounded declarative input. This verifies structure/model consistency, never prose meaning. */
export function validatePackage(input: unknown): PackageResult {
  const issues: ValidationIssue[] = [];
  const error = (
    path: string,
    message: string,
    repair = "Correct this field and validate again.",
  ) => issues.push({ path, severity: "error", message, repair });
  let nodes = 0;
  const walk = (value: unknown, path: string, depth: number): void => {
    if (++nodes > 5000 || depth > 18) {
      if (nodes === 5001 || depth === 19)
        error(
          path,
          "Package exceeds depth or item limit",
          "Use at most 18 nested levels and 5000 values.",
        );
      return;
    }
    if (
      typeof value === "string" &&
      (value.length > 5000 ||
        /<\/?[a-z][^>]*>|javascript:|data:text\/html/i.test(value))
    )
      error(
        path,
        "Executable markup or oversized text is unsupported",
        "Use plain text of at most 5000 characters.",
      );
    if (typeof value === "number" && !Number.isFinite(value))
      error(path, "Expected a finite number");
    if (value && typeof value === "object")
      for (const [key, child] of Object.entries(value)) {
        if (["__proto__", "constructor", "prototype"].includes(key))
          error(`${path}.${key}`, "Unsafe object key", "Remove this key.");
        if (nodes > 5000) break;
        walk(child, `${path}.${key}`, depth + 1);
      }
  };
  walk(input, "$", 0);
  if (issues.length) return { issues };
  if (
    new TextEncoder().encode(JSON.stringify(input)).length > MAX_PACKAGE_BYTES
  ) {
    error("$", "Package exceeds 100000 bytes");
    return { issues };
  }
  const object = (
    value: unknown,
    path: string,
    keys: string[],
  ): Record<string, unknown> | undefined => {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
      error(path, "Expected an object");
      return;
    }
    const record = value as Record<string, unknown>;
    for (const key of Object.keys(record))
      if (!keys.includes(key))
        error(
          `${path}.${key}`,
          "Unknown field",
          "Remove this field or use the supported schema.",
        );
    return record;
  };
  const text = (value: unknown, path: string) => {
    if (typeof value !== "string" || !value.trim())
      error(path, "Expected non-empty text");
  };
  const texts = (value: unknown, path: string, min = 0) => {
    if (!Array.isArray(value) || value.length < min || value.length > 30) {
      error(path, `Expected ${min}–30 text entries`);
      return;
    }
    value.forEach((v, i) => text(v, `${path}[${i}]`));
    if (new Set(value).size !== value.length) error(path, "Duplicate entries");
  };
  const p = object(input, "$", [
    "schemaVersion",
    "locale",
    "adapterVersion",
    "curriculum",
    "authors",
    "provenance",
    "lesson",
    "fixtures",
    "interpretation",
    ...([2, 3].includes(
      Number((input as Record<string, unknown>)?.schemaVersion),
    )
      ? ["library"]
      : []),
  ]);
  if (!p) return { issues };
  if (![1, 2, 3].includes(p.schemaVersion as number))
    error("$.schemaVersion", "Only schema versions 1, 2 and 3 are supported");
  if (p.schemaVersion === 2 || p.schemaVersion === 3) {
    const library = object(p.library, "$.library", [
      "level",
      "skillId",
      "tags",
    ]);
    if (library) {
      if (
        !(p.schemaVersion === 3 ? ["P2", "P3", "P4"] : ["P2", "P3"]).includes(
          String(library.level),
        )
      )
        error("$.library.level", "Expected a supported level for this schema");
      if (
        typeof library.skillId !== "string" ||
        !/^[a-z][a-z0-9-]{1,63}$/.test(library.skillId)
      )
        error("$.library.skillId", "Expected stable skill ID");
      texts(library.tags, "$.library.tags");
      const lesson = (p.lesson ?? {}) as Record<string, unknown>;
      if (lesson.level !== `${library.level} candidate`)
        error(
          "$.lesson.level",
          "Display level must match authoritative library.level",
        );
    }
  } else if (
    p.lesson &&
    typeof p.lesson === "object" &&
    !["comparison", "angles"].includes(
      String((p.lesson as Record<string, unknown>).topic),
    )
  )
    error("$.lesson.topic", "New topics require schema version 2");
  const rawTopic = (p.lesson as Record<string, unknown> | undefined)?.topic;
  if (
    [
      "decimals",
      "fraction-calculations",
      "area-perimeter",
      "whole-numbers",
      "line-graphs",
      "symmetry",
      "nets",
      "pie-charts",
      "bar-charts",
      "angle-measure",
    ].includes(String(rawTopic)) &&
    p.schemaVersion !== 3
  )
    error("$.schemaVersion", "P4 capabilities require schema version3");
  if (
    p.schemaVersion !== 3 &&
    Array.isArray((p.lesson as Record<string, unknown> | undefined)?.steps) &&
    (
      (p.lesson as Record<string, unknown>).steps as Record<string, unknown>[]
    ).some((s) => s?.kind === "exact")
  )
    error("$.schemaVersion", "Exact responses require schema version3");
  if (p.adapterVersion !== 1)
    error("$.adapterVersion", "Only adapter version 1 is supported");
  if (p.locale !== "en-SG") error("$.locale", "Only en-SG is supported");
  const curriculum = object(p.curriculum, "$.curriculum", [
    "objectiveId",
    "sources",
    "evidenceStatus",
  ]);
  if (curriculum) {
    text(curriculum.objectiveId, "$.curriculum.objectiveId");
    texts(curriculum.sources, "$.curriculum.sources", 1);
    if (Array.isArray(curriculum.sources))
      curriculum.sources.forEach((s, i) => {
        if (typeof s === "string" && !/^https:\/\//.test(s))
          error(
            `$.curriculum.sources[${i}]`,
            "Expected an HTTPS evidence reference",
          );
      });
    if (curriculum.evidenceStatus !== "candidate")
      error(
        "$.curriculum.evidenceStatus",
        "Evidence remains candidate pending human review",
      );
  }
  texts(p.authors, "$.authors", 1);
  const provenance = object(p.provenance, "$.provenance", [
    "kind",
    "generatorVersion",
    "seed",
  ]);
  if (provenance) {
    if (!["authored", "generated"].includes(String(provenance.kind)))
      error("$.provenance.kind", "Expected authored or generated");
    if (provenance.generatorVersion !== undefined)
      text(provenance.generatorVersion, "$.provenance.generatorVersion");
    if (
      provenance.kind === "generated" &&
      (typeof provenance.seed !== "number" ||
        !Number.isSafeInteger(provenance.seed) ||
        provenance.seed < 0 ||
        provenance.seed > 4294967295)
    )
      error("$.provenance.seed", "Expected uint32 seed");
    if (
      provenance.kind === "generated" &&
      provenance.generatorVersion === undefined
    )
      error(
        "$.provenance.generatorVersion",
        "Generated packages require a generator version",
      );
  }
  const rawLesson = object(p.lesson, "$.lesson", [
    "id",
    "version",
    "topic",
    "title",
    "subtitle",
    "level",
    "minutes",
    "story",
    "objective",
    "specification",
    "steps",
    "reviewStatus",
  ]);
  if (rawLesson) {
    for (const key of [
      "id",
      "title",
      "subtitle",
      "level",
      "story",
      "objective",
    ])
      text(rawLesson[key], `$.lesson.${key}`);
    const spec = ["comparison", "angles"].includes(String(rawLesson.topic))
      ? object(
          rawLesson.specification,
          "$.lesson.specification",
          rawLesson.topic === "comparison"
            ? [
                "largerName",
                "smallerName",
                "larger",
                "smaller",
                "unknown",
                "unit",
              ]
            : ["task", "angles"],
        )
      : undefined;
    if (spec && rawLesson.topic === "comparison") {
      for (const key of ["largerName", "smallerName", "unit"])
        text(spec[key], `$.lesson.specification.${key}`);
      for (const key of ["larger", "smaller"])
        if (
          !Number.isSafeInteger(spec[key]) ||
          Number(spec[key]) < 1 ||
          Number(spec[key]) > 100
        )
          error(`$.lesson.specification.${key}`, "Expected integer 1–100");
    }
    if (Array.isArray(rawLesson.steps))
      rawLesson.steps.forEach((value, i) => {
        const step = object(value, `$.lesson.steps[${i}]`, [
          "id",
          "goal",
          "title",
          "prompt",
          "kind",
          "choices",
          "answer",
          "hints",
        ]);
        if (!step) return;
        for (const key of ["id", "goal", "title", "prompt"])
          text(step[key], `$.lesson.steps[${i}].${key}`);
        if (Array.isArray(step.hints))
          step.hints.forEach((hint, j) =>
            text(hint, `$.lesson.steps[${i}].hints[${j}]`),
          );
        if (Array.isArray(step.choices))
          step.choices.forEach((value, j) => {
            const c = object(value, `$.lesson.steps[${i}].choices[${j}]`, [
              "id",
              "label",
              "meaning",
            ]);
            if (c) {
              text(c.id, `$.lesson.steps[${i}].choices[${j}].id`);
              text(c.label, `$.lesson.steps[${i}].choices[${j}].label`);
              if (c.meaning !== undefined)
                text(c.meaning, `$.lesson.steps[${i}].choices[${j}].meaning`);
            }
          });
      });
  }
  let lesson: Lesson | undefined;
  try {
    lesson = validateLesson(p.lesson);
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    error(`$.lesson.${message.split(":")[0]}`, message);
  }
  if (lesson) {
    if (lesson.topic === "comparison") {
      const meanings = lesson.steps[0].choices?.map((c) => c.meaning);
      if (
        !meanings ||
        meanings.length !== 2 ||
        new Set(meanings).size !== 2 ||
        !meanings.includes("larger-is-smaller-plus-difference") ||
        !meanings.includes("smaller-is-larger-plus-difference")
      )
        error(
          "$.lesson.steps[0].choices",
          "Relation requires exactly one choice per supported meaning",
        );
    }
    for (const [i, step] of lesson.steps.entries())
      if (step.goal !== step.id)
        error(
          `$.lesson.steps[${i}].goal`,
          "Expected explicit supported step goal",
          `Set goal to ${step.id}.`,
        );
    if (p.fixtures !== undefined) {
      if (!Array.isArray(p.fixtures) || p.fixtures.length > 20)
        error("$.fixtures", "Expected at most 20 fixtures");
      else
        p.fixtures.forEach((value, i) => {
          const f = object(value, `$.fixtures[${i}]`, [
            "stepId",
            "accepted",
            "rejected",
          ]);
          if (!f) return;
          const step = lesson!.steps.find((s) => s.id === f.stepId);
          if (step)
            for (const key of ["accepted", "rejected"]) {
              const values = f[key];
              if (Array.isArray(values))
                for (const [j, value] of values.entries()) {
                  const adapter = adapters[lesson!.topic];
                  const evaluation = adapter.evaluate(
                    { ...adapter.initialState(lesson!), answer: value },
                    step,
                  );
                  const valid =
                    step.kind === "exact"
                      ? typeof value === "string" &&
                        evaluation?.outcome !== "unassessable"
                      : step.kind === "number"
                        ? typeof value === "number" &&
                          Number.isSafeInteger(value)
                        : step.kind === "multi"
                          ? Array.isArray(value) &&
                            value.every(
                              (v) =>
                                typeof v === "string" &&
                                step.choices?.some((c) => c.id === v),
                            ) &&
                            new Set(value).size === value.length
                          : typeof value === "string" &&
                            step.choices?.some((c) => c.id === value);
                  const equals = evaluation?.outcome === "correct";
                  if (!valid || equals !== (key === "accepted"))
                    error(
                      `$.fixtures[${i}].${key}[${j}]`,
                      "Response type or expected outcome contradicts the validated goal",
                    );
                }
            }

          if (!step) error(`$.fixtures[${i}].stepId`, "Unknown step reference");
          for (const key of ["accepted", "rejected"])
            if (!Array.isArray(f[key]) || (f[key] as unknown[]).length > 10)
              error(`$.fixtures[${i}].${key}`, "Expected at most 10 responses");
        });
    }
    if (
      ["comparison", "equal-groups"].includes(lesson.topic) &&
      p.interpretation === undefined
    )
      error(
        "$.interpretation",
        "Story packages require a source-linked interpretation",
      );
    const interpretationCapability =
      runtimeTopics[lesson.topic]?.interpretation;
    const expectedInterpretation = interpretationCapability?.(lesson);
    if (expectedInterpretation && p.interpretation === undefined)
      error(
        "$.interpretation",
        "This task requires a source-linked two-step interpretation",
      );
    if (p.interpretation !== undefined && interpretationCapability) {
      let matches = false;
      try {
        matches =
          !!expectedInterpretation &&
          canonicalJson(p.interpretation) ===
            canonicalJson(expectedInterpretation);
      } catch {
        /* malformed non-JSON values are validation errors */
      }
      if (!matches)
        error(
          "$.interpretation",
          "Interpretation quantities, units, states, operations or spans contradict the task model",
        );
    }
    if (p.interpretation !== undefined && !interpretationCapability) {
      const interpretation = object(p.interpretation, "$.interpretation", [
        "entities",
        "quantities",
        "relationships",
        "unknown",
        "sourceSpans",
        "assumptions",
        "ambiguities",
      ]);
      if (interpretation) {
        texts(interpretation.entities, "$.interpretation.entities", 2);
        if (lesson.topic === "comparison") {
          const spec = lesson.specification;
          if (interpretation.unknown !== spec.unknown)
            error("$.interpretation.unknown", "Unknown contradicts task model");
          const quantities = interpretation.quantities;
          if (
            Array.isArray(quantities) &&
            (quantities.length !== 2 ||
              new Set(
                quantities.map((q) =>
                  q && typeof q === "object"
                    ? (q as Record<string, unknown>).entity
                    : undefined,
                ),
              ).size !== 2)
          )
            error(
              "$.interpretation.quantities",
              "Expected one quantity for each named entity",
            );

          if (Array.isArray(quantities))
            for (const q of quantities)
              if (q && typeof q === "object") {
                const r = q as Record<string, unknown>;
                const expected =
                  r.entity === spec.largerName
                    ? spec.larger
                    : r.entity === spec.smallerName
                      ? spec.smaller
                      : undefined;
                if (r.value !== expected || r.unit !== spec.unit)
                  error(
                    "$.interpretation.quantities",
                    "Quantity contradicts task model",
                  );
              }
          const relationships = interpretation.relationships;
          if (Array.isArray(relationships))
            for (const q of relationships)
              if (q && typeof q === "object") {
                const r = q as Record<string, unknown>;
                if (
                  r.larger !== spec.largerName ||
                  r.smaller !== spec.smallerName ||
                  r.difference !== Number(spec.larger) - Number(spec.smaller)
                )
                  error(
                    "$.interpretation.relationships",
                    "Relationship contradicts task model",
                  );
              }
        }

        if (lesson.topic === "equal-groups") {
          const spec = lesson.specification;
          if (interpretation.unknown !== spec.task)
            error(
              "$.interpretation.unknown",
              "Unknown role contradicts groups model",
            );
          const rs = interpretation.relationships;
          if (!Array.isArray(rs) || rs.length !== 1)
            error(
              "$.interpretation.relationships",
              "Expected one equal-groups relationship",
            );
          else {
            const r = object(rs[0], "$.interpretation.relationships[0]", [
              "kind",
              "groups",
              "perGroup",
              "total",
              "unit",
            ]);
            if (
              r &&
              (r.kind !== "equal-groups" ||
                r.groups !== spec.groupCount ||
                r.perGroup !== spec.perGroup ||
                r.total !== Number(spec.groupCount) * Number(spec.perGroup) ||
                r.unit !== spec.unit)
            )
              error(
                "$.interpretation.relationships",
                "Relationship contradicts groups model",
              );
          }
          const qs = interpretation.quantities;
          if (
            !Array.isArray(qs) ||
            qs.length !== 2 ||
            new Set(qs.map((q) => q?.entity)).size !== 2 ||
            !qs.some((q) => q?.entity === "groups" && q.unit === "groups") ||
            !qs.some((q) => q?.entity === spec.unit && q.unit === spec.unit)
          )
            error(
              "$.interpretation.quantities",
              "Expected one groups quantity and one correctly unit-labelled total quantity",
            );
          if (Array.isArray(qs))
            for (const value of qs) {
              const q = value as Record<string, unknown>;
              const expectedState =
                q?.entity === "groups"
                  ? spec.task === "groups"
                    ? "derived"
                    : "given"
                  : spec.task === "total"
                    ? "derived"
                    : "given";
              if (q && q.state !== expectedState)
                error(
                  "$.interpretation.quantities",
                  "Given/derived state contradicts unknown role",
                );
              if (
                q &&
                (q.entity === "groups"
                  ? q.value !== spec.groupCount
                  : q.value !== Number(spec.groupCount) * Number(spec.perGroup))
              )
                error(
                  "$.interpretation.quantities",
                  "Quantity contradicts groups model",
                );
            }
        }
        texts(interpretation.assumptions, "$.interpretation.assumptions");
        texts(interpretation.ambiguities, "$.interpretation.ambiguities");
        text(interpretation.unknown, "$.interpretation.unknown");
        for (const key of ["quantities", "relationships", "sourceSpans"])
          if (
            !Array.isArray(interpretation[key]) ||
            (interpretation[key] as unknown[]).length > 20 ||
            (Array.isArray(interpretation[key]) &&
              (interpretation[key] as unknown[]).length <
                (key === "quantities" ? 2 : 1))
          )
            error(`$.interpretation.${key}`, "Expected at most 20 records");
        if (Array.isArray(interpretation.quantities))
          interpretation.quantities.forEach((q, i) => {
            const r = object(q, `$.interpretation.quantities[${i}]`, [
              "entity",
              "value",
              "unit",
              "state",
            ]);
            if (!r) return;
            for (const k of ["entity", "unit", "state"])
              text(r[k], `$.interpretation.quantities[${i}].${k}`);
            if (
              !Number.isSafeInteger(r.value) ||
              Number(r.value) < 1 ||
              Number(r.value) > 100
            )
              error(
                `$.interpretation.quantities[${i}].value`,
                "Expected integer 1–100",
              );
            if (
              Array.isArray(interpretation.entities) &&
              !interpretation.entities.includes(r.entity)
            )
              error(
                `$.interpretation.quantities[${i}].entity`,
                "Unknown entity",
              );
          });
        if (Array.isArray(interpretation.relationships))
          interpretation.relationships.forEach((q, i) => {
            if (lesson!.topic === "equal-groups") return;
            const r = object(q, `$.interpretation.relationships[${i}]`, [
              "kind",
              "larger",
              "smaller",
              "difference",
            ]);
            if (!r) return;
            if (r.kind !== "additive-comparison")
              error(
                `$.interpretation.relationships[${i}].kind`,
                "Unsupported relationship",
              );
            for (const k of ["larger", "smaller"])
              if (
                !Array.isArray(interpretation.entities) ||
                !interpretation.entities.includes(r[k])
              )
                error(
                  `$.interpretation.relationships[${i}].${k}`,
                  "Unknown entity",
                );
            if (
              !Number.isSafeInteger(r.difference) ||
              Number(r.difference) < 1 ||
              Number(r.difference) > 99
            )
              error(
                `$.interpretation.relationships[${i}].difference`,
                "Expected positive difference below 100",
              );
          });
        if (Array.isArray(interpretation.sourceSpans))
          interpretation.sourceSpans.forEach((span, i) => {
            const s = object(span, `$.interpretation.sourceSpans[${i}]`, [
              "start",
              "end",
              "text",
            ]);
            if (
              s &&
              (!Number.isSafeInteger(s.start) ||
                !Number.isSafeInteger(s.end) ||
                Number(s.start) < 0 ||
                Number(s.end) <= Number(s.start) ||
                lesson!.story.slice(Number(s.start), Number(s.end)) !== s.text)
            )
              error(
                `$.interpretation.sourceSpans[${i}]`,
                "Span does not resolve to exact task wording",
              );
          });
      }
    }
  }
  issues.push({
    path: "$.lesson.story",
    severity: "warning",
    message:
      "Task wording, hints, choice meanings and reflection are semantically unverified.",
    repair:
      "Obtain independent human mathematical and pedagogical review; record warning disposition before release.",
  });
  return issues.some((i) => i.severity === "error")
    ? { issues }
    : { package: structuredClone(input) as LessonPackage, issues };
}
export function parsePackage(text: string): PackageResult {
  if (new TextEncoder().encode(text).length > MAX_PACKAGE_BYTES)
    return {
      issues: [
        {
          path: "$",
          severity: "error",
          message: "Package exceeds 100000 bytes",
          repair: "Reduce package size.",
        },
      ],
    };
  try {
    const tokens =
      text.match(/"(?:\\.|[^"\\])*"|[{}[\]:,]|[^\s{}[\]:,]+/g) ?? [];
    const stack: { object: boolean; keys: Set<string> }[] = [];
    for (let i = 0; i < tokens.length; i++) {
      const token = tokens[i];
      if (token === "{" || token === "[")
        stack.push({ object: token === "{", keys: new Set() });
      else if (token === "}" || token === "]") stack.pop();
      else if (
        token.startsWith('"') &&
        tokens[i + 1] === ":" &&
        stack.at(-1)?.object
      ) {
        const key = JSON.parse(token) as string;
        const top = stack.at(-1)!;
        if (top.keys.has(key))
          return {
            issues: [
              {
                path: "$",
                severity: "error",
                message: `Duplicate JSON key: ${key}`,
                repair: "Keep each object key once.",
              },
            ],
          };
        top.keys.add(key);
      }
    }
    return validatePackage(JSON.parse(text));
  } catch {
    return {
      issues: [
        {
          path: "$",
          severity: "error",
          message: "Invalid JSON",
          repair: "Correct JSON syntax.",
        },
      ],
    };
  }
}
export function loadPackage(input: unknown): Lesson {
  const result = validatePackage(input);
  if (!result.package)
    throw new Error(
      result.issues
        .filter((i) => i.severity === "error")
        .map((i) => `${i.path}: ${i.message}`)
        .join("\n"),
    );
  return result.package.lesson;
}
