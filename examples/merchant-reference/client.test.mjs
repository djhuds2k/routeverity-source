import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { createServer } from "node:http";
import { test } from "node:test";
import {
  captureMerchantGclid,
  MerchantReferenceError,
  prepareMerchantConversion,
  submitMerchantConversion,
} from "./client.mjs";

const order = {
  campaign_id: "cmp_reference_123",
  event: "purchase",
  order_id: "REFERENCE-1",
  revenue: "99.99",
  currency: "GBP",
  timestamp: "2026-10-17T12:00:00Z",
};
const context = captureMerchantGclid("?gclid=Case_Sensitive-123", "granted");
const envelope = prepareMerchantConversion(order, context, "granted");
const conversionKey = `rvcv_${"a".repeat(43)}`;
const result = {
  submission_id: "mcv_12345678-1234-1234-1234-123456789abc",
  status: "PENDING",
  reason: "NO_RECORDED_MATCH",
  conversion_id: null,
  duplicate: false,
  attribution_policy: "merchant-gclid-recorded-request-30d-v1",
  reconcile_until: "2026-10-18T12:00:00Z",
};

async function fixture(t, handler) {
  const requests = [];
  const server = createServer(async (req, res) => {
    const chunks = [];
    for await (const chunk of req) chunks.push(chunk);
    requests.push({
      path: req.url,
      method: req.method,
      headers: req.headers,
      body: Buffer.concat(chunks).toString("utf8"),
    });
    handler(res, requests);
  });
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  t.after(
    () =>
      new Promise((resolve, reject) => {
        server.close((error) => (error ? reject(error) : resolve()));
        server.closeAllConnections();
      }),
  );
  return {
    requests,
    options: {
      origin: `http://127.0.0.1:${server.address().port}`,
      conversionKey,
      envelope,
      currentConsent: "granted",
      allowLoopbackHttp: true,
    },
  };
}

function json(res, status, data) {
  res.writeHead(status, { "Content-Type": "application/json" });
  res.end(JSON.stringify(data));
}

test("capture hashes exact case-sensitive UTF-8 without returning raw identifier", () => {
  assert.deepEqual(context, {
    status: "READY",
    gclidHash: createHash("sha256").update("Case_Sensitive-123").digest("hex"),
  });
  assert.ok(!JSON.stringify(context).includes("Case_Sensitive-123"));
  assert.notEqual(
    context.gclidHash,
    captureMerchantGclid("?gclid=case_sensitive-123", "granted").gclidHash,
  );
});

for (const consent of ["denied", "unknown"]) {
  test(`${consent} consent skips capture, preparation and delivery before inspecting inputs`, async () => {
    assert.deepEqual(captureMerchantGclid(null, consent), {
      status: "CONSENT_NOT_GRANTED",
    });
    assert.deepEqual(prepareMerchantConversion(null, null, consent), {
      status: "CONSENT_NOT_GRANTED",
    });
    assert.deepEqual(
      await submitMerchantConversion({ currentConsent: consent }),
      { status: "CONSENT_NOT_GRANTED" },
    );
  });
}

test("invalid consent, malformed and repeated identifiers fail explicitly", () => {
  assert.throws(
    () => captureMerchantGclid("", true),
    /INVALID_MEASUREMENT_CONSENT/,
  );
  for (const query of ["?gclid=%ZZ", "?gclid=a+b", `?gclid=${"a".repeat(513)}`])
    assert.throws(
      () => captureMerchantGclid(query, "granted"),
      /INVALID_MERCHANT_IDENTIFIER/,
    );
  assert.throws(
    () => captureMerchantGclid("a".repeat(16385), "granted"),
    /INVALID_MERCHANT_QUERY/,
  );
  for (const query of [
    "?gclid=a&gclid=a",
    "?gclid=a&%67clid=b",
    "?gclid=&gclid=a",
  ]) {
    const ambiguous = captureMerchantGclid(query, "granted");
    assert.equal(ambiguous.status, "AMBIGUOUS_IDENTIFIER");
    assert.throws(
      () => prepareMerchantConversion(order, ambiguous, "granted"),
      /INVALID_MERCHANT_CONTEXT/,
    );
  }
});

test("missing/unsupported identifier is omitted rather than fabricated", () => {
  for (const query of ["", "?gclid=", "?gbraid=braid", "?wbraid=braid"]) {
    const missing = captureMerchantGclid(query, "granted");
    assert.equal(missing.status, "MISSING_IDENTIFIER");
    assert.ok(
      !Object.hasOwn(
        JSON.parse(prepareMerchantConversion(order, missing, "granted").body),
        "gclid_hash",
      ),
    );
  }
});

test("capture enforces exact query and identifier length boundaries", () => {
  assert.equal(
    captureMerchantGclid(`?ignored=${"a".repeat(16375)}`, "granted").status,
    "MISSING_IDENTIFIER",
  );
  assert.throws(
    () => captureMerchantGclid(`?ignored=${"a".repeat(16376)}`, "granted"),
    /INVALID_MERCHANT_QUERY/,
  );
  assert.equal(
    captureMerchantGclid(`?gclid=${"a".repeat(512)}`, "granted").status,
    "READY",
  );
});

test("envelope preserves decimal text/timestamp and excludes raw IDs/metadata", () => {
  assert.ok(Object.isFrozen(envelope));
  assert.deepEqual(JSON.parse(envelope.body), {
    ...order,
    measurement_consent: "granted",
    gclid_hash: context.gclidHash,
  });
  for (const extra of [
    "gclid",
    "metadata",
    "customer_reference",
    "measurement_consent",
  ])
    assert.throws(
      () =>
        prepareMerchantConversion(
          { ...order, [extra]: "private" },
          context,
          "granted",
        ),
      /INVALID_REFERENCE_ORDER/,
    );
  for (const change of [
    { revenue: 99.99 },
    { revenue: "1e2" },
    { revenue: "1000000000000" },
    { timestamp: "2026-02-30T12:00:00Z" },
    { timestamp: "2100-01-01T12:00:00Z" },
    { order_id: "order\n1" },
  ])
    assert.throws(
      () =>
        prepareMerchantConversion({ ...order, ...change }, context, "granted"),
      /INVALID_REFERENCE_PAYLOAD/,
    );
});

test("real loopback POST and explicit retry preserve identical body and idempotency", async (t) => {
  const { options, requests } = await fixture(t, (res, seen) =>
    json(res, seen.length === 1 ? 201 : 200, {
      ...result,
      duplicate: seen.length > 1,
    }),
  );
  assert.equal((await submitMerchantConversion(options)).status, "PENDING");
  assert.equal(
    (await submitMerchantConversion({ ...options, timeoutMs: 30000 }))
      .duplicate,
    true,
  );
  assert.equal(requests.length, 2);
  for (const request of requests) {
    assert.equal(request.path, "/api/v1/merchant-conversions");
    assert.equal(request.method, "POST");
    assert.equal(request.body, envelope.body);
    assert.equal(request.headers.authorization, `Bearer ${conversionKey}`);
    assert.equal(request.headers["idempotency-key"], envelope.idempotencyKey);
    assert.ok(!request.body.includes("Case_Sensitive-123"));
  }
});

test("origin/credential/envelope guards fail before any network request", async (t) => {
  const { options, requests } = await fixture(t, (res) =>
    json(res, 201, result),
  );
  for (const change of [
    { allowLoopbackHttp: false },
    { origin: "http://merchant.example.com", allowLoopbackHttp: true },
    { origin: "https://app.example.com/path" },
    { origin: "https://app.example.com?key=private" },
    { origin: "https://user:password@app.example.com" },
    { origin: "https://app.example.com#fragment" },
    { origin: "not a URL with private detail" },
    { conversionKey: "tracking-token" },
    { timeoutMs: 0 },
    { timeoutMs: 30001 },
    { envelope: { ...envelope, idempotencyKey: "bad\nkey" } },
    { envelope: { ...envelope, body: "{private invalid JSON" } },
    {
      envelope: {
        ...envelope,
        body: envelope.body.replace(
          '{"campaign_id":',
          '{"gclid_hash":"raw_private_identifier","campaign_id":',
        ),
      },
    },
    {
      envelope: {
        ...envelope,
        body: JSON.stringify({
          ...JSON.parse(envelope.body),
          gclid: "private",
        }),
      },
    },
  ])
    await assert.rejects(
      submitMerchantConversion({ ...options, ...change }),
      (error) =>
        error instanceof MerchantReferenceError &&
        !error.retryable &&
        !String(error).includes("private"),
    );
  assert.equal(requests.length, 0);
});

test("withdrawal before dispatch suppresses an already prepared envelope", async (t) => {
  const { options, requests } = await fixture(t, (res) =>
    json(res, 201, result),
  );
  assert.deepEqual(
    await submitMerchantConversion({ ...options, currentConsent: "denied" }),
    { status: "CONSENT_NOT_GRANTED" },
  );
  assert.equal(requests.length, 0);
});

test("success response accepts exactly 4096 bytes and rejects 4097", async (t) => {
  const { options } = await fixture(t, (res, requests) => {
    res.writeHead(201, { "Content-Type": "application/json" });
    res.end(JSON.stringify(result).padEnd(requests.length === 1 ? 4096 : 4097));
  });
  assert.equal((await submitMerchantConversion(options)).status, "PENDING");
  await assert.rejects(
    submitMerchantConversion(options),
    (error) =>
      error instanceof MerchantReferenceError &&
      error.code === "INVALID_MERCHANT_RESPONSE" &&
      error.retryable,
  );
});

for (const status of [301, 401, 403, 409, 429, 503]) {
  test(`HTTP ${status} is explicit, not retried or followed`, async (t) => {
    const { options, requests } = await fixture(t, (res) => {
      res.writeHead(status, {
        Location: "http://127.0.0.1:1/should-not-follow",
        "Retry-After": "60",
      });
      res.end("private error detail");
    });
    await assert.rejects(submitMerchantConversion(options), (error) => {
      assert.ok(error instanceof MerchantReferenceError);
      assert.equal(error.code, "MERCHANT_HTTP_REJECTED");
      assert.equal(error.httpStatus, status);
      assert.equal(error.retryable, status === 429 || status === 503);
      assert.equal(error.retryAfterSeconds, 60);
      assert.ok(!String(error).includes("private"));
      return true;
    });
    assert.equal(requests.length, 1);
  });
}

for (const data of [
  {},
  { ...result, submission_id: `mcv_${"-".repeat(36)}` },
  { ...result, status: "ATTRIBUTED", reason: "MATCHED_RECORDED_REQUEST" },
  { ...result, reason: "AMBIGUOUS_IDENTIFIER" },
  { ...result, duplicate: true },
  { ...result, attribution_policy: "unique-google-click" },
  { ...result, reconcile_until: "invalid" },
]) {
  test(`rejects malformed success ${JSON.stringify(data)}`, async (t) => {
    const { options } = await fixture(t, (res) => json(res, 201, data));
    await assert.rejects(
      submitMerchantConversion(options),
      (error) => error instanceof MerchantReferenceError && error.retryable,
    );
  });
}

test("attributed and terminal outcomes retain their distinct meaning", async (t) => {
  const outcomes = [
    {
      ...result,
      status: "ATTRIBUTED",
      reason: "MATCHED_RECORDED_REQUEST",
      conversion_id: "cnv_12345678-1234-1234-1234-123456789abc",
    },
    { ...result, status: "UNATTRIBUTED", reason: "AMBIGUOUS_IDENTIFIER" },
  ];
  const { options } = await fixture(t, (res, requests) =>
    json(res, 201, outcomes[requests.length - 1]),
  );
  assert.equal((await submitMerchantConversion(options)).status, "ATTRIBUTED");
  assert.equal(
    (await submitMerchantConversion(options)).status,
    "UNATTRIBUTED",
  );
});

test("oversized/invalid responses and lost connections surface uncertain outcomes", async (t) => {
  const { options, requests } = await fixture(t, (res, seen) => {
    if (seen.length === 1) {
      res.writeHead(201, { "Content-Type": "application/json" });
      res.end("x".repeat(4097));
    } else if (seen.length === 2) {
      res.writeHead(201, { "Content-Type": "application/json" });
      res.end("{invalid");
    } else {
      res.destroy();
    }
  });
  for (let index = 0; index < 3; index++)
    await assert.rejects(
      submitMerchantConversion(options),
      (error) => error instanceof MerchantReferenceError && error.retryable,
    );
  assert.equal(requests.length, 3);
});

test("timeout is bounded and never triggers an automatic retry", async (t) => {
  const { options, requests } = await fixture(t, () => {});
  await assert.rejects(
    submitMerchantConversion({ ...options, timeoutMs: 100 }),
    (error) => error instanceof MerchantReferenceError && error.retryable,
  );
  assert.equal(requests.length, 1);
});
