import { describe, expect, it, vi } from "vitest";
import {
  buildRequest,
  describeCatalogueForModel,
  proposalSchema,
  proposeAnnotations,
  type ModelCall,
  type ModelRequest,
} from "../src/annotation/proposer";
import { validatePlan, type AnnotationPlan } from "../src/annotation/plan";
import { annotationTopics } from "../src/annotation/topics";
import {
  createAnthropicCall,
  FALLBACK_BETA,
  ModelFailure,
} from "../src/annotation/anthropic-call";
import {
  handleAnnotationRequest,
  newHandlerState,
  MAX_BODY_BYTES,
  PROPOSE_PATH,
  STATUS_PATH,
  type AnnotationRequest,
  type HandlerDeps,
} from "../src/annotation/handler";
import {
  annotationCatalogue,
  defaultAnnotationPlan,
  type FigureSpec,
} from "../src/topics/area-perimeter-figure";

// The server validates the full lesson specification, which also carries requestedMeasure.
const spec: FigureSpec & { requestedMeasure: string } = {
  task: "composite-perimeter",
  corner: "top-right",
  width: 12,
  height: 8,
  cutWidth: 4,
  cutHeight: 3,
  unknownSide: "width",
  knownMeasure: "area",
  requestedMeasure: "area",
  unit: "cm",
};
const catalogue = annotationCatalogue(spec);
const defaults = defaultAnnotationPlan(spec);
const ctx = {
  topicLabel: "Area and perimeter",
  taskDescription: "An L-shape.",
  catalogue,
};
const json = (plan: unknown) => JSON.stringify(plan);

describe("what the model is told", () => {
  it("never contains a numeric value from the figure, so hidden values cannot leak", () => {
    const text = JSON.stringify(buildRequest(ctx));
    for (const feature of catalogue.features)
      expect(text).not.toContain(`"value":${feature.value}`);
    // The only digits allowed are the generic limits and the date-free prompt numbers.
    const stripped = describeCatalogueForModel(ctx)
      .replace(/"maxDimensions": \d+/, "")
      .replace(/"maxNotes": \d+/, "");
    expect(stripped).not.toMatch(/\d/);
  });
  it("builds a schema that names only real features, sides and shows", () => {
    const schema = proposalSchema(catalogue) as {
      properties: {
        dimensions: {
          items: { properties: Record<string, { enum: string[] }> };
        };
      };
    };
    const props = schema.properties.dimensions.items.properties;
    expect(props.feature.enum).toEqual(catalogue.features.map((f) => f.id));
    expect(props.side.enum).toEqual(["top", "bottom", "left", "right"]);
    expect(props.show.enum).toEqual(["value", "unknown"]);
    expect(JSON.stringify(schema)).not.toMatch(
      /"type":"number"|"type":"integer"/,
    );
  });
});

describe("propose, check, repair", () => {
  it("accepts a valid plan on the first round", async () => {
    const call = vi.fn<ModelCall>(async () => json(defaults));
    const result = await proposeAnnotations(call, ctx, defaults);
    expect(result.source).toBe("model");
    expect(result.rounds).toBe(1);
    expect(call).toHaveBeenCalledTimes(1);
  });

  it("feeds checker errors back and accepts the repaired plan", async () => {
    const leaking = structuredClone(defaults);
    leaking.dimensions.find((d) => d.feature === "remaining-width")!.show =
      "value";
    const requests: ModelRequest[] = [];
    const call: ModelCall = async (request) => {
      requests.push(request);
      return json(requests.length === 1 ? leaking : defaults);
    };
    const result = await proposeAnnotations(call, ctx, defaults);
    expect(result.source).toBe("model");
    expect(result.rounds).toBe(2);
    expect(result.attempts[0].errors.join(" ")).toMatch(/must stay hidden/);
    // The repair request carries the rejected reply and the checker's reasons.
    expect(requests[1].messages.map((m) => m.role)).toEqual([
      "user",
      "assistant",
      "user",
    ]);
    expect(requests[1].messages[2].content).toMatch(/must stay hidden/);
  });

  it("falls back to the deterministic default when no round is acceptable", async () => {
    const leaking = structuredClone(defaults);
    leaking.dimensions[0].show = "unknown"; // hides a given value
    const call = vi.fn<ModelCall>(async () => json(leaking));
    const result = await proposeAnnotations(call, ctx, defaults, {
      maxRounds: 3,
    });
    expect(result.source).toBe("default");
    expect(result.plan).toEqual(defaults);
    expect(call).toHaveBeenCalledTimes(3);
    expect(validatePlan(result.plan, catalogue)).toEqual([]);
  });

  it("treats malformed or non-JSON replies as failed rounds, not crashes", async () => {
    const replies = ["not json", "```json\n" + json(defaults) + "\n```"];
    const call: ModelCall = async () => replies.shift()!;
    const result = await proposeAnnotations(call, ctx, defaults);
    expect(result.attempts[0].errors).toEqual([
      "The reply was not valid JSON.",
    ]);
    expect(result.source).toBe("model");
  });

  it("returns the default and a reason when the call itself fails", async () => {
    const call: ModelCall = async () => {
      throw new ModelFailure("The model declined this request (cyber).");
    };
    const result = await proposeAnnotations(call, ctx, defaults);
    expect(result.source).toBe("default");
    expect(result.failure).toMatch(/declined/);
    expect(result.plan).toEqual(defaults);
  });

  it("rejects invented numbers, text and coordinates smuggled into a plan", async () => {
    const smuggled = structuredClone(defaults) as AnnotationPlan & {
      dimensions: Record<string, unknown>[];
    };
    smuggled.dimensions[0].label = "99 cm";
    smuggled.dimensions[0].x = 5;
    const call: ModelCall = async () => json(smuggled);
    const result = await proposeAnnotations(call, ctx, defaults, {
      maxRounds: 1,
    });
    expect(result.source).toBe("default");
    expect(result.attempts[0].errors.join(" ")).toMatch(/only/);
  });
});

describe("Anthropic call adapter", () => {
  const request: ModelRequest = {
    system: "s",
    messages: [{ role: "user", content: "u" }],
    schema: { type: "object" },
  };
  const fakeClient = (reply: Record<string, unknown>) => {
    const create = vi.fn(async () => reply);
    return {
      create,
      client: { beta: { messages: { create } } } as never,
    };
  };

  it("sends a structured-output request with fallbacks and no forbidden parameters", async () => {
    const { create, client } = fakeClient({
      stop_reason: "end_turn",
      content: [{ type: "text", text: '{"dimensions":[],"notes":[]}' }],
    });
    const text = await createAnthropicCall({ client })(request);
    expect(text).toBe('{"dimensions":[],"notes":[]}');
    const body = (create.mock.calls[0] as unknown[])[0] as Record<
      string,
      unknown
    >;
    expect(body.model).toBe("claude-opus-5-5");
    expect(body.betas).toEqual([FALLBACK_BETA]);
    expect(body.fallbacks).toBe("default");
    expect(body.output_config).toEqual({
      effort: "low",
      format: { type: "json_schema", schema: { type: "object" } },
    });
    // Forced tool use, prefill, sampling overrides and a thinking override are rejected by this model.
    for (const key of [
      "tool_choice",
      "temperature",
      "top_p",
      "top_k",
      "thinking",
    ])
      expect(body).not.toHaveProperty(key);
    expect(body.messages).toEqual(request.messages);
  });

  it("turns refusals, truncation and empty replies into explained failures", async () => {
    await expect(
      createAnthropicCall({
        client: fakeClient({
          stop_reason: "refusal",
          stop_details: { category: "cyber" },
          content: [],
        }).client,
      })(request),
    ).rejects.toThrow(/declined.*cyber/);
    await expect(
      createAnthropicCall({
        client: fakeClient({ stop_reason: "max_tokens", content: [] }).client,
      })(request),
    ).rejects.toThrow(/cut off/);
    await expect(
      createAnthropicCall({
        client: fakeClient({ stop_reason: "end_turn", content: [] }).client,
      })(request),
    ).rejects.toThrow(/no text/);
  });

  it("honours an explicit model override", async () => {
    const { create, client } = fakeClient({
      stop_reason: "end_turn",
      content: [{ type: "text", text: "{}" }],
    });
    await createAnthropicCall({ client, model: "claude-sonnet-5-5" })(request);
    expect(
      ((create.mock.calls[0] as unknown[])[0] as { model: string }).model,
    ).toBe("claude-sonnet-5-5");
  });
});

describe("development endpoint", () => {
  const goodBody = JSON.stringify({
    topic: "area-perimeter",
    specification: spec,
  });
  const base = (over: Partial<AnnotationRequest> = {}): AnnotationRequest => ({
    method: "POST",
    path: PROPOSE_PATH,
    remoteAddress: "127.0.0.1",
    headers: { "x-aura-annotation": "1", host: "localhost:5178" },
    body: goodBody,
    ...over,
  });
  const deps = (over: Partial<HandlerDeps> = {}): HandlerDeps => ({
    configured: () => true,
    model: () => "claude-opus-5-5",
    call: () => async () => json(defaults),
    ...over,
  });

  it("ignores unrelated paths", async () => {
    expect(
      await handleAnnotationRequest(
        base({ path: "/x" }),
        deps(),
        newHandlerState(),
      ),
    ).toBeUndefined();
  });
  it("accepts loopback requests with the header and returns a validated proposal", async () => {
    const response = await handleAnnotationRequest(
      base(),
      deps(),
      newHandlerState(),
    );
    expect(response?.status).toBe(200);
    expect((response?.body as { source: string }).source).toBe("model");
  });
  it("refuses remote clients, missing header and cross-origin requests", async () => {
    const state = newHandlerState();
    expect(
      (
        await handleAnnotationRequest(
          base({ remoteAddress: "192.168.1.5" }),
          deps(),
          state,
        )
      )?.status,
    ).toBe(403);
    expect(
      (
        await handleAnnotationRequest(
          base({ headers: { host: "localhost:5178" } }),
          deps(),
          state,
        )
      )?.status,
    ).toBe(403);
    expect(
      (
        await handleAnnotationRequest(
          base({
            headers: {
              "x-aura-annotation": "1",
              host: "localhost:5178",
              origin: "http://evil.example",
            },
          }),
          deps(),
          state,
        )
      )?.status,
    ).toBe(403);
  });
  it("reports status without calling the model", async () => {
    const call = vi.fn();
    const response = await handleAnnotationRequest(
      base({ method: "GET", path: STATUS_PATH, body: "" }),
      deps({ call: () => call as never, configured: () => false }),
      newHandlerState(),
    );
    expect(response?.body).toMatchObject({ configured: false });
    expect(call).not.toHaveBeenCalled();
  });
  it("returns 503 without credentials and never calls the model", async () => {
    const call = vi.fn();
    const response = await handleAnnotationRequest(
      base(),
      deps({ configured: () => false, call: () => call as never }),
      newHandlerState(),
    );
    expect(response?.status).toBe(503);
    expect(call).not.toHaveBeenCalled();
  });
  it("rejects oversized, malformed and invalid-model requests", async () => {
    const state = newHandlerState();
    expect(
      (
        await handleAnnotationRequest(
          base({ body: "x".repeat(MAX_BODY_BYTES + 1) }),
          deps(),
          state,
        )
      )?.status,
    ).toBe(413);
    expect(
      (await handleAnnotationRequest(base({ body: "{" }), deps(), state))
        ?.status,
    ).toBe(400);
    expect(
      (
        await handleAnnotationRequest(
          base({
            body: JSON.stringify({ topic: "angles", specification: {} }),
          }),
          deps(),
          state,
        )
      )?.status,
    ).toBe(400);
    const bad = await handleAnnotationRequest(
      base({
        body: JSON.stringify({
          topic: "area-perimeter",
          specification: { ...spec, cutWidth: 99 },
        }),
      }),
      deps(),
      state,
    );
    expect(bad?.status).toBe(400);
  });
  it("allows one proposal at a time and limits the rate", async () => {
    const state = newHandlerState();
    let release!: () => void;
    const slow = deps({
      call: () => async () => {
        await new Promise<void>((resolve) => (release = resolve));
        return json(defaults);
      },
    });
    const first = handleAnnotationRequest(base(), slow, state);
    await Promise.resolve();
    await new Promise((r) => setTimeout(r, 0));
    expect((await handleAnnotationRequest(base(), deps(), state))?.status).toBe(
      429,
    );
    release();
    expect((await first)?.status).toBe(200);
    let now = 0;
    const timed = deps({ now: () => now });
    for (let i = 0; i < 11; i++)
      await handleAnnotationRequest(base(), timed, state);
    expect((await handleAnnotationRequest(base(), timed, state))?.status).toBe(
      429,
    );
    now += 61_000;
    expect((await handleAnnotationRequest(base(), timed, state))?.status).toBe(
      200,
    );
  });
  it("ignores a stored plan in the request and the topic registry knows area-perimeter", async () => {
    expect(Object.keys(annotationTopics)).toEqual(["area-perimeter"]);
    const response = await handleAnnotationRequest(
      base({
        body: JSON.stringify({
          topic: "area-perimeter",
          specification: { ...spec, annotations: { nonsense: true } },
        }),
      }),
      deps(),
      newHandlerState(),
    );
    expect(response?.status).toBe(200);
  });
});
