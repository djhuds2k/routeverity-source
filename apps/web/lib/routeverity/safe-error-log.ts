const errorNames = new Set([
  "Error", "TypeError", "RangeError", "ReferenceError", "SyntaxError",
  "URIError", "EvalError", "AggregateError", "PrismaClientKnownRequestError",
  "PrismaClientUnknownRequestError", "PrismaClientInitializationError",
  "PrismaClientValidationError", "PrismaClientRustPanicError",
]);

export function reportOperationalError(
  event: "routeverity.request.failed" | "routeverity.mutation.failed",
  error: unknown,
) {
  let errorType = "NonError";
  try {
    if (error instanceof Error) {
      const name = error.name;
      errorType = errorNames.has(name) ? name : "Error";
    }
  } catch {
    errorType = "UnknownError";
  }
  console.error(JSON.stringify({
    event,
    error_type: errorType,
    incident_id: globalThis.crypto.randomUUID(),
  }));
}
