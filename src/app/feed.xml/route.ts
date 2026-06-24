import { getNoticesCached as getNotices } from "../../lib/queries";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// RSS 2.0 피드. 전체: /feed.xml · 출처별: /feed.xml?source=cse · 카테고리별: /feed.xml?category=혜택
// 자기 리더(예: Feedly)로 직접 구독하고 싶은 사람용.

function xmlEscape(s: unknown): string {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const source = url.searchParams.get("source") ?? undefined;
  const category = url.searchParams.get("category") ?? undefined;
  const q = url.searchParams.get("q") ?? undefined;

  const origin = url.origin;
  const self = `${origin}/feed.xml${url.search}`;
  const titleSuffix = source ? ` · ${source}` : category ? ` · ${category}` : "";

  let items: Record<string, any>[] = [];
  try {
    items = await getNotices({ source, category, q, limit: 100 });
  } catch {
    items = [];
  }

  const lastBuild = new Date(
    items.length ? Math.max(...items.map((n) => Number(n.pub_ms) || 0)) : Date.now(),
  ).toUTCString();

  const body =
    `<?xml version="1.0" encoding="UTF-8"?>\n` +
    `<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">\n` +
    `<channel>\n` +
    `<title>경북대 공지 통합 알리미${xmlEscape(titleSuffix)}</title>\n` +
    `<link>${xmlEscape(origin)}</link>\n` +
    `<description>경북대학교·한국장학재단 여러 게시판의 공지를 한 곳에서 최신순으로.</description>\n` +
    `<language>ko</language>\n` +
    `<lastBuildDate>${lastBuild}</lastBuildDate>\n` +
    `<atom:link href="${xmlEscape(self)}" rel="self" type="application/rss+xml"/>\n` +
    items
      .map((n) => {
        const pub = new Date(Number(n.pub_ms) || Date.now()).toUTCString();
        // 내부 리다이렉트 경로(/go/...)는 절대 URL 로 변환
        const link = typeof n.url === "string" && n.url.startsWith("/") ? origin + n.url : n.url;
        return (
          `<item>\n` +
          `<title>${xmlEscape(n.title)}</title>\n` +
          `<link>${xmlEscape(link)}</link>\n` +
          `<guid isPermaLink="false">${xmlEscape(n.id)}</guid>\n` +
          `<category>${xmlEscape(n.category)}</category>\n` +
          `<source url="${xmlEscape(origin)}">${xmlEscape(n.source_name)}</source>\n` +
          `<description>${xmlEscape(`[${n.source_name}] ${n.category}${n.author ? " · " + n.author : ""}`)}</description>\n` +
          `<pubDate>${pub}</pubDate>\n` +
          `</item>`
        );
      })
      .join("\n") +
    `\n</channel>\n</rss>\n`;

  return new Response(body, {
    headers: {
      "Content-Type": "application/rss+xml; charset=utf-8",
      "Cache-Control": "public, max-age=300, s-maxage=300",
    },
  });
}
