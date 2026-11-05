import { ConversionError, parseUniqueJson } from "./conversion-policy";

export async function readConversionJson(request: Request) {
  if (
    request.headers.get("content-type")?.split(";")[0].trim().toLowerCase() !==
    "application/json"
  )
    throw new ConversionError(415, "JSON_CONTENT_TYPE_REQUIRED");
  const reader = request.body?.getReader();
  if (!reader) throw new ConversionError(400, "MISSING_BODY");
  let bytes = 0;
  const chunks: Uint8Array[] = [];
  try {
    let chunk = await reader.read();
    while (!chunk.done) {
      const { value } = chunk;
      bytes += value.byteLength;
      if (bytes > 16384) {
        await reader.cancel();
        throw new ConversionError(413, "CONVERSION_BODY_TOO_LARGE");
      }
      chunks.push(value);
      chunk = await reader.read();
    }
    try {
      return parseUniqueJson(
        new TextDecoder("utf-8", { fatal: true }).decode(Buffer.concat(chunks)),
      );
    } catch (error) {
      if (!(error instanceof SyntaxError || error instanceof TypeError))
        throw error;
      throw new ConversionError(400, "INVALID_JSON");
    }
  } finally {
    reader.releaseLock();
  }
}
