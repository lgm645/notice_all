import * as cheerio from "cheerio";
import type { CheerioAPI } from "cheerio";
import type { AnyNode } from "domhandler";
import type { NoticeItem, SourceAdapter, SourceConfig } from "../../lib/types";
import { cleanText, normDate, parseIntSafe, toKstIso } from "../../lib/normalize";

// ── GNUBoard 어댑터 ───────────────────────────────────────────────
// 대상: 경북대 컴퓨터학부(cse), 창업지원단(startup) 등 bbs/board.php 게시판.
// 목록: board.php?bo_table=...&page=N  /  상세: ...&wr_id=[ID]  (wr_id = 안정 ID)
// 컬럼은 GNUBoard 기본 스킨 클래스(td_subject/bo_tit/td_datetime ...)로 매핑한다.

function withPage(listUrl: string, page: number): string {
  const u = new URL(listUrl);
  u.searchParams.set("page", String(page));
  return u.toString();
}

function parseWrId(href: string): string | null {
  return /[?&]wr_id=(\d+)/.exec(href)?.[1] ?? null;
}

function parseRow(
  $: CheerioAPI,
  tr: AnyNode,
  source: SourceConfig,
): NoticeItem | null {
  const $tr = $(tr);
  const $subject = $tr.find("td.td_subject");
  if ($subject.length === 0) return null;

  // 제목 링크: .bo_tit 안의 a 우선, 없으면 wr_id 를 가진 a.
  let $title = $subject.find(".bo_tit a").first();
  if ($title.length === 0) $title = $subject.find('a[href*="wr_id="]').first();
  const href = $title.attr("href") ?? "";
  const wrId = parseWrId(href);
  if (!wrId) return null;

  const title = cleanText($title.text());
  if (!title) return null;

  const url = new URL(href, source.listUrl).toString();
  const category =
    cleanText($subject.find("a.bo_cate_link").first().text()) || source.category;
  const author = cleanText($tr.find("td.td_name").first().text()) || null;
  const dateText = cleanText($tr.find("td.td_datetime").first().text());
  const views = parseIntSafe($tr.find("td.td_num").first().text());
  const hasAttachment = $subject.find("i.fa-download, .fa-download").length > 0;

  const numText = cleanText($tr.find("td.td_num2").first().text());
  const isFixed =
    /bo_notice|notice/i.test($tr.attr("class") ?? "") ||
    $tr.find("td.td_num2 img").length > 0 ||
    (numText !== "" && !/^\d+$/.test(numText)); // 번호 칸이 "공지" 등

  return {
    sourceId: source.id,
    sourceName: source.name,
    category,
    title,
    url,
    author,
    publishedAt: toKstIso(dateText),
    publishedDate: normDate(dateText),
    hasAttachment,
    isFixed,
    views,
    externalId: wrId,
  };
}

export const gnuboardAdapter: SourceAdapter = {
  platform: "gnuboard",
  async fetchList(source, ctx) {
    const pages = Number(source.options?.pages ?? 1);
    const items: NoticeItem[] = [];

    for (let page = 1; page <= pages; page++) {
      const html = await ctx.fetchHtml(withPage(source.listUrl, page));
      const $ = cheerio.load(html);
      $("table tbody tr").each((_, tr) => {
        const item = parseRow($, tr, source);
        if (item) items.push(item);
      });
      if (page < pages) await ctx.delay();
    }
    return items;
  },
};
