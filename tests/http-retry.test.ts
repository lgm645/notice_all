import assert from "node:assert/strict";
import test from "node:test";
import { fetchHtml } from "../src/lib/http";

async function withMockFetch(
  mock: typeof fetch,
  run: () => Promise<void>,
): Promise<void> {
  const originalFetch = globalThis.fetch;
  const originalWarn = console.warn;
  globalThis.fetch = mock;
  console.warn = () => {};
  try {
    await run();
  } finally {
    globalThis.fetch = originalFetch;
    console.warn = originalWarn;
  }
}

test("fetchHtml은 일시적 장애만 재시도하고 영구 HTTP 오류는 즉시 반환한다", async () => {
  let calls = 0;
  await withMockFetch(
    (async () => {
      calls++;
      if (calls < 3) throw new TypeError("fetch failed");
      return new Response("<p>정상</p>", { headers: { "content-type": "text/html; charset=utf-8" } });
    }) as typeof fetch,
    async () => {
      assert.equal(
        await fetchHtml("https://example.com/transient", { retries: 2, retryBaseMs: 0 }),
        "<p>정상</p>",
      );
    },
  );
  assert.equal(calls, 3);

  calls = 0;
  await withMockFetch(
    (async () => {
      calls++;
      if (calls === 1) {
        return new Response("잠시 후", {
          status: 503,
          statusText: "Service Unavailable",
          headers: { "retry-after": "0" },
        });
      }
      return new Response("복구", { headers: { "content-type": "text/html; charset=utf-8" } });
    }) as typeof fetch,
    async () => {
      assert.equal(await fetchHtml("https://example.com/503", { retries: 1, retryBaseMs: 0 }), "복구");
    },
  );
  assert.equal(calls, 2);

  calls = 0;
  await withMockFetch(
    (async () => {
      calls++;
      return new Response("없음", { status: 404, statusText: "Not Found" });
    }) as typeof fetch,
    async () => {
      await assert.rejects(
        fetchHtml("https://example.com/404", { retries: 2, retryBaseMs: 0 }),
        /HTTP 404 Not Found/,
      );
    },
  );
  assert.equal(calls, 1);

  calls = 0;
  await withMockFetch(
    (async () => {
      calls++;
      return new Response("천천히", {
        status: 429,
        statusText: "Too Many Requests",
        headers: { "retry-after": "120" },
      });
    }) as typeof fetch,
    async () => {
      await assert.rejects(
        fetchHtml("https://example.com/rate-limit", { retries: 2, retryBaseMs: 0 }),
        /HTTP 429 Too Many Requests/,
      );
    },
  );
  assert.equal(calls, 1, "긴 Retry-After를 무시하고 조기 재요청하지 않는다");
});
