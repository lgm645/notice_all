import * as cheerio from "cheerio";
import type { CheerioAPI } from "cheerio";
import type { AnyNode } from "domhandler";
import type { NoticeItem, SourceAdapter, SourceConfig } from "../../lib/types";
import { cleanText, normDate, parseIntSafe, resolveUrl, toKstIso } from "../../lib/normalize";

// ── KNU-WBBS 어댑터 ───────────────────────────────────────────────
// 대상: 경북대 공지(knu-main), 학사공지(knu-haksa). www.knu.ac.kr/wbbs *.action
// 같은 표 구조(td.subject/td.date/td.writer/td.hit/td.num/td.file)지만 글 ID 추출이 다름:
//  - knu-main : 제목 a 의 href 안 btin.doc_no
//  - knu-haksa: 제목 a 의 onclick doRead(bbs_cde, note_div, bltn_no) 3번째 인자
//    (이 경우 상세 URL 은 options.detailTemplate 로 구성: {id} 치환)

function setPage(listUrl: string, page: number): string {
  const u = new URL(listUrl);
  u.searchParams.set("pageIndex", String(page));
  return u.toString();
}

function doReadArg(s: string, index: number): string | null {
  const m = /doRead\(([^)]*)\)/.exec(s);
  if (!m) return null;
  const args = m[1].split(",").map((a) => a.trim().replace(/^['"]|['"]$/g, ""));
  return args[index] ?? null;
}

function parseRow($: CheerioAPI, tr: AnyNode, source: SourceConfig): NoticeItem | null {
  const $tr = $(tr);
  const $a = $tr.find("td.subject a").first();
  if ($a.length === 0) return null;

  const href = $a.attr("href") ?? "";
  const onclick = $a.attr("onclick") ?? "";
  const title = cleanText($a.text());
  if (!title) return null;

  let externalId: string;
  let url: string;
  const docNo = /btin\.doc_no=(\d+)/.exec(href)?.[1];
  if (docNo) {
    // 경북대 공지(knu-main): viewBtin.action 상세는 세션이 있어야 GET 으로 열린다.
    // 우리 /go/knu-main 라우트가 클릭 순간 세션을 만들어 정확한 글로 302 리다이렉트한다
    // (세션 실패 시 목록 폴백). 중복키는 doc_no 유지.
    externalId = docNo;
    const noteDiv = /btin\.note_div=(top|row)/.exec(href)?.[1] ?? "row";
    url = `/go/knu-main?doc_no=${docNo}&note_div=${noteDiv}`;
  } else {
    // 학사공지(knu-haksa): stdViewBtin.action 상세는 GET 직링크가 정상 동작.
    // bltn_no 는 doRead() 3번째 인자에서 추출, 상세 URL 은 detailTemplate 로 구성.
    const bltn = doReadArg(onclick || href, 2);
    if (!bltn || !/^\d+$/.test(bltn)) return null;
    externalId = bltn;
    const tmpl = String(source.options?.detailTemplate ?? "");
    url = tmpl ? resolveUrl(tmpl.replace("{id}", bltn), source.listUrl) : source.listUrl;
  }

  const dateText = cleanText($tr.find("td.date").first().text());
  const author = cleanText($tr.find("td.writer").first().text()) || null;
  const views = parseIntSafe($tr.find("td.hit").first().text());
  const hasAttachment = $tr.find("td.file img, td.file a, td.file i").length > 0;
  const numClass = $tr.find("td.num").first().attr("class") ?? "";
  const isFixed = /notice/.test(numClass) || $tr.find("td.num .notice").length > 0;

  return {
    sourceId: source.id,
    sourceName: source.name,
    category: source.category,
    title,
    url,
    author,
    publishedAt: toKstIso(dateText),
    publishedDate: normDate(dateText),
    hasAttachment,
    isFixed,
    views,
    externalId,
  };
}

export const knuWbbsAdapter: SourceAdapter = {
  platform: "knu-wbbs",
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
