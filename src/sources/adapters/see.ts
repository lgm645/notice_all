import * as cheerio from "cheerio";
import type { CheerioAPI } from "cheerio";
import type { AnyNode } from "domhandler";
import type { NoticeItem, SourceAdapter, SourceConfig } from "../../lib/types";
import { cleanText, normDate, parseIntSafe, resolveUrl, toKstIso } from "../../lib/normalize";

// ── SEE 어댑터 ────────────────────────────────────────────────────
// 대상: 경북대 전자공학부 공지(see). see.knu.ac.kr/content/board/notice.html
// 위치 기반 표: [번호][제목(a, ?pg=vv&fidx=ID, 카테고리 span 포함)][작성자][작성일][조회].
// 날짜 칸을 정규식으로 찾아 그 좌우에서 작성자/조회를 잡는다(컬럼 위치 변동에 견고).

const DATE = /\d{4}[-./]\d{1,2}[-./]\d{1,2}/;

function setPage(listUrl: string, page: number): string {
  const u = new URL(listUrl);
  u.searchParams.set("page", String(page));
  return u.toString();
}

function parseRow($: CheerioAPI, tr: AnyNode, source: SourceConfig): NoticeItem | null {
  const $tr = $(tr);
  const $a = $tr.find('a[href*="fidx="]').first();
  if ($a.length === 0) return null;
  const href = $a.attr("href") ?? "";
  const fidx = /fidx=(\d+)/.exec(href)?.[1];
  if (!fidx) return null;

  const $title = $a.clone();
  const category = cleanText($title.find("span").first().text()) || source.category;
  $title.find("span, img").remove();
  const title = cleanText($title.text());
  if (!title) return null;

  const tds = $tr.find("td");
  let dateIdx = -1;
  tds.each((i, td) => {
    if (dateIdx < 0 && DATE.test(cleanText($(td).text()))) dateIdx = i;
  });
  const dateText = dateIdx >= 0 ? cleanText(tds.eq(dateIdx).text()) : "";
  const author = dateIdx > 1 ? cleanText(tds.eq(dateIdx - 1).text()) || null : null;
  const views = dateIdx >= 0 ? parseIntSafe(tds.eq(dateIdx + 1).text()) : null;
  const isFixed = $tr.find('img[src*="icon_notice"], span.notice').length > 0;

  return {
    sourceId: source.id,
    sourceName: source.name,
    category,
    title,
    url: resolveUrl(href, source.listUrl),
    author,
    publishedAt: toKstIso(dateText),
    publishedDate: normDate(dateText),
    hasAttachment: false,
    isFixed,
    views,
    externalId: fidx,
  };
}

export const seeAdapter: SourceAdapter = {
  platform: "see",
  async fetchList(source, ctx) {
    const pages = Number(source.options?.pages ?? 1);
    const items: NoticeItem[] = [];
    for (let page = 1; page <= pages; page++) {
      const html = await ctx.fetchHtml(setPage(source.listUrl, page));
      const $ = cheerio.load(html);
      $("table tr").each((_, tr) => {
        const it = parseRow($, tr, source);
        if (it) items.push(it);
      });
      if (page < pages) await ctx.delay();
    }
    return items;
  },
};
