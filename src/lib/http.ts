import iconv from "iconv-lite";

const CONTACT = process.env.SCRAPER_CONTACT ? ` (+${process.env.SCRAPER_CONTACT})` : "";
export const DEFAULT_USER_AGENT = `KNU-Notice-Aggregator/0.1 (personal student project${CONTACT})`;

// 인코딩 자동 감지: Content-Type charset → <meta charset> → utf-8 기본값.
// 현재 대상은 전부 UTF-8 이지만, 한국 구형 사이트의 EUC-KR 대비 가드를 둔다.
function detectCharset(contentType: string | null, buf: Buffer): string {
  let cs = /charset=["']?([\w-]+)/i.exec(contentType ?? "")?.[1];
  if (!cs) {
    const head = buf.subarray(0, 4096).toString("latin1");
    cs = /charset=["']?([\w-]+)/i.exec(head)?.[1];
  }
  cs = (cs ?? "utf-8").toLowerCase();
  if (["ks_c_5601-1987", "ksc5601", "ksc_5601", "euckr", "cp949"].includes(cs)) cs = "euc-kr";
  if (!iconv.encodingExists(cs)) cs = "utf-8";
  return cs;
}

const RETRYABLE_STATUS = new Set([408, 425, 429, 500, 502, 503, 504]);
const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

function requestHost(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return url;
  }
}

class HttpStatusError extends Error {
  constructor(
    message: string,
    readonly retryable: boolean,
    readonly retryAfterMs: number | null,
  ) {
    super(message);
    this.name = "HttpStatusError";
  }
}

function parseRetryAfter(value: string | null): number | null {
  if (!value) return null;
  const seconds = Number(value);
  if (Number.isFinite(seconds) && seconds >= 0) return seconds * 1000;
  const at = Date.parse(value);
  return Number.isFinite(at) ? Math.max(0, at - Date.now()) : null;
}

export interface FetchHtmlOptions {
  ua?: string;
  timeoutMs?: number;
  retries?: number; // 최초 요청을 제외한 재시도 횟수
  retryBaseMs?: number;
}

export async function fetchHtml(
  url: string,
  opts: FetchHtmlOptions = {},
): Promise<string> {
  const retries = Math.max(0, Math.floor(opts.retries ?? 2));
  const retryBaseMs = Math.max(0, opts.retryBaseMs ?? 1500);

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const res = await fetch(url, {
        headers: {
          "User-Agent": opts.ua ?? DEFAULT_USER_AGENT,
          Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
          "Accept-Language": "ko,en;q=0.8",
        },
        redirect: "follow",
        signal: AbortSignal.timeout(opts.timeoutMs ?? 30_000),
      });
      if (!res.ok) {
        throw new HttpStatusError(
          `HTTP ${res.status} ${res.statusText} — ${url}`,
          RETRYABLE_STATUS.has(res.status),
          parseRetryAfter(res.headers.get("retry-after")),
        );
      }
      const buf = Buffer.from(await res.arrayBuffer());
      const charset = detectCharset(res.headers.get("content-type"), buf);
      return iconv.decode(buf, charset);
    } catch (error) {
      const retryable = !(error instanceof HttpStatusError) || error.retryable;
      if (!retryable || attempt >= retries) throw error;

      const retryAfterMs = error instanceof HttpStatusError ? error.retryAfterMs : null;
      // 서버가 긴 대기를 명시했다면 값을 무시해 일찍 재요청하지 않고 다음 정기 수집에 맡긴다.
      if (retryAfterMs != null && retryAfterMs > 60_000) throw error;

      const waitMs = retryAfterMs ?? Math.min(retryBaseMs * 2 ** attempt, 60_000);
      const reason = error instanceof Error ? error.message : String(error);
      console.warn(
        `[http] ${requestHost(url)} 요청 실패 (${reason}); ${waitMs}ms 후 재시도 ${attempt + 2}/${retries + 1}`,
      );
      await sleep(waitMs);
    }
  }

  throw new Error(`요청 재시도 소진 — ${url}`); // 반복문 구조상 도달하지 않음
}
