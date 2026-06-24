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

export async function fetchHtml(
  url: string,
  opts: { ua?: string; timeoutMs?: number } = {},
): Promise<string> {
  const res = await fetch(url, {
    headers: {
      "User-Agent": opts.ua ?? DEFAULT_USER_AGENT,
      Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      "Accept-Language": "ko,en;q=0.8",
    },
    redirect: "follow",
    signal: AbortSignal.timeout(opts.timeoutMs ?? 30_000),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText} — ${url}`);
  const buf = Buffer.from(await res.arrayBuffer());
  const charset = detectCharset(res.headers.get("content-type"), buf);
  return iconv.decode(buf, charset);
}
