import * as cheerio from "cheerio";
import type { CheerioAPI } from "cheerio";
import type { AnyNode } from "domhandler";
import type { NoticeItem, SourceAdapter, SourceConfig } from "../../lib/types";
import { cleanText, isStandaloneDate, normDate, parseIntSafe, resolveUrl, toKstIso } from "../../lib/normalize";

// ── KOSAF 어댑터 ──────────────────────────────────────────────────
// 대상: 한국장학재단(kosaf). www.kosaf.go.kr/ko/notice.do
// 제목 a 의 href 안 seqNo 가 글 ID. 날짜 td.day(YYYY.MM.DD), 조회 td.search.

function setPage(listUrl: string, page: number): string {
  const u = new URL(listUrl);
  u.searchParams.set("page", String(page));
  return u.toString();
}

function parseRow($: CheerioAPI, tr: AnyNode, source: SourceConfig): NoticeItem | null {
  const $tr = $(tr);
  const $a = $tr.find('a[href*="seqNo="]').first();
  if ($a.length === 0) return null;
  const href = $a.attr("href") ?? "";
  const seqNo = /seqNo=(\d+)/.exec(href)?.[1];
  if (!seqNo) return null;
  const title = cleanText($a.text());
  if (!title) return null;

  let dateText = cleanText($tr.find("td.day").first().text());
  if (!isStandaloneDate(dateText)) {
    dateText = "";
    const titleCell = $a.closest("td").get(0);
    $tr.find("td").each((_, td) => {
      const t = cleanText($(td).text());
      if (!dateText && td !== titleCell && isStandaloneDate(t)) dateText = t;
    });
  }
  const views = parseIntSafe($tr.find("td.search").first().text());

  return {
    sourceId: source.id,
    sourceName: source.name,
    category: source.category,
    title,
    url: resolveUrl(href, source.listUrl),
    author: null,
    publishedAt: toKstIso(dateText),
    publishedDate: normDate(dateText),
    hasAttachment: false,
    isFixed: false,
    views,
    externalId: seqNo,
  };
}

export const kosafAdapter: SourceAdapter = {
  platform: "kosaf",
  async fetchList(source, ctx) {
    const pages = Number(source.options?.pages ?? 1);
    const items: NoticeItem[] = [];
    for (let page = 1; page <= pages; page++) {
      const html = await ctx.fetchHtml(setPage(source.listUrl, page));
      const $ = cheerio.load(html);
      $("table tbody tr").each((_, tr) => {
        const it = parseRow($, tr, source);
        if (it) items.push(it);
      });
      if (page < pages) await ctx.delay();
    }
    return items;
  },
};
