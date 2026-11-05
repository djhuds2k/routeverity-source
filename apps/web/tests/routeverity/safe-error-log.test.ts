import { afterEach, describe, expect, it, vi } from "vitest";
import { reportOperationalError } from "../../lib/routeverity/safe-error-log";
import { onRequestError } from "../../instrumentation";

describe("bounded operational exception telemetry", () => {
  afterEach(() => vi.restoreAllMocks());
  const sentinel = "SYNTHETIC_SECRET_MUST_NOT_APPEAR";
  function capture() {
    return vi.spyOn(console, "error").mockImplementation(() => undefined);
  }
  it("drops raw errors, stack, cause and arbitrary name", () => {
    const output = capture();
    const error = new Error(sentinel, { cause: { token: sentinel } });
    error.name = sentinel;
    reportOperationalError("routeverity.mutation.failed", error);
    const serialized = JSON.stringify(output.mock.calls);
    expect(serialized).not.toContain(sentinel);
    expect(JSON.parse(String(output.mock.calls[0][0]))).toEqual({
      event: "routeverity.mutation.failed", error_type: "Error",
      incident_id: expect.stringMatching(/^[a-f0-9-]{36}$/),
    });
  });
  it("ignores the complete framework request for Error and non-Error throws", () => {
    const output = capture();
    const request = {
      method: "GET", path: "/click?rv_token=" + sentinel + "&gclid=" + sentinel,
      headers: { authorization: sentinel, cookie: sentinel },
    };
    const context = {
      routerKind: "App Router", routeType: "route", routePath: "/click",
    } as Parameters<typeof onRequestError>[2];
    onRequestError(new Error(sentinel), request, context);
    onRequestError(
      { credential: sentinel } as unknown as Parameters<typeof onRequestError>[0],
      request,
      context,
    );
    expect(output).toHaveBeenCalledTimes(2);
    expect(JSON.stringify(output.mock.calls)).not.toContain(sentinel);
    expect(JSON.stringify(output.mock.calls)).not.toContain("/click");
  });
  it("handles a hostile Error name getter without logging its payload", () => {
    const output = capture();
    const error = new Error(sentinel);
    Object.defineProperty(error, "name", { get() { throw new Error(sentinel); } });
    expect(() => reportOperationalError("routeverity.request.failed", error)).not.toThrow();
    expect(JSON.parse(String(output.mock.calls[0][0])).error_type).toBe("UnknownError");
    expect(JSON.stringify(output.mock.calls)).not.toContain(sentinel);
  });
  it("reads an accessor-backed error name only once", () => {
    const output = capture();
    const error = new Error(sentinel);
    let reads = 0;
    Object.defineProperty(error, "name", {
      get() { return ++reads === 1 ? "TypeError" : sentinel; },
    });
    reportOperationalError("routeverity.request.failed", error);
    expect(reads).toBe(1);
    expect(JSON.parse(String(output.mock.calls[0][0])).error_type).toBe("TypeError");
    expect(JSON.stringify(output.mock.calls)).not.toContain(sentinel);
  });
});
