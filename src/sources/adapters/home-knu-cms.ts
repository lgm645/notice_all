import * as cheerio from "cheerio";
import type { CheerioAPI } from "cheerio";
import type { AnyNode } from "domhandler";
import type { FetchContext, NoticeItem, SourceAdapter, SourceConfig } from "../../lib/types";
import { cleanText, isStandaloneDate, normDate, parseIntSafe, resolveUrl, toKstIso } from "../../lib/normalize";

// ── home-knu CMS 어댑터 ───────────────────────────────────────────
// 대상: AI전공(seeai)·자원봉사(volunteer)·장학복지(knussw)·AIC(aic) [home.knu.ac.kr]
//       + 도서관(library) [kudos.knu.ac.kr] — 같은 CMS, 호스트만 다름.
// 글 ID(idx)는 제목 a 의 href 안 base64 mv_data 를 디코드해 추출(library 는 끝의 || 제거).
// 컬럼이 클래스/위치 두 형태가 있어, 독립된 날짜 칸을 찾고 좌우에서 작성자/조회를 잡는다.

function idxFromMvData(href: string): string | null {
  const m = /mv_data=([^&"'\s]+)/.exec(href);
  if (!m) return null;
  let v = m[1].replace(/\|+$/g, ""); // library 의 '||' 접미사 제거
  if (v.includes("%")) {
    try {
      v = decodeURIComponent(v);
    } catch {
      /* keep raw */
    }
  }
  let decoded = "";
  try {
    decoded = Buffer.from(v, "base64").toString("utf8");
  } catch {
    return null;
  }
  return /idx=(\d+)/.exec(decoded)?.[1] ?? null;
}

function parseRow($: CheerioAPI, tr: AnyNode, source: SourceConfig): NoticeItem | null {
  const $tr = $(tr);
  const $a = $tr.find('a[href*="mv_data="]').first();
  if ($a.length === 0) return null;
  const href = $a.attr("href") ?? "";
  const idx = idxFromMvData(href);
  if (!idx) return null;

  const $title = $a.clone();
  $title.find("span, img").remove();
  const title = cleanText($title.text()) || cleanText($a.text());
  if (!title) return null;

  const tds = $tr.find("td");
  const titleCell = $a.closest("td").get(0);
  let dateIdx = -1;
  tds.each((i, td) => {
    if (dateIdx < 0 && td !== titleCell && isStandaloneDate($(td).text())) dateIdx = i;
  });
  const semanticDate = cleanText($tr.find("td.date").first().text());
  const dateText = dateIdx >= 0
    ? cleanText(tds.eq(dateIdx).text())
    : isStandaloneDate(semanticDate) ? semanticDate : "";

  let author = cleanText($tr.find("td.writer").first().text()) || null;
  if (!author && dateIdx > 0) {
    const prev = cleanText(tds.eq(dateIdx - 1).text());
    if (prev && !/^[\d,]+$/.test(prev) && prev !== title) author = prev;
  }

  let views = parseIntSafe($tr.find("td.hit").first().text());
  if (views == null) {
    const nums: number[] = [];
    tds.each((_, td) => {
      const t = cleanText($(td).text());
      if (/^[\d,]+$/.test(t)) {
        const n = parseIntSafe(t);
        if (n != null) nums.push(n);
      }
    });
    if (nums.length) views = nums[nums.length - 1];
  }

  const hasAttachment =
    $tr.find("i.fa-floppy-o, i.fa-files-o, .fa-download, td.file a, td.attach .clip, td.attach a").length > 0;
  const isFixed = $tr.find(".notice, .ico-notice").length > 0 || /tr-notice/.test($tr.attr("class") ?? "");

  return {
    sourceId: source.id,
    sourceName: source.name,
    category: source.category,
    title,
    // home.knu CMS 상세(sub.htm?mode=view&mv_data=...) 직링크 정상 동작.
    url: resolveUrl(href, source.listUrl),
    author,
    publishedAt: toKstIso(dateText),
    publishedDate: normDate(dateText),
    hasAttachment,
    isFixed,
    views,
    externalId: idx,
  };
}

// 실제 페이지 링크에서 code/table/nav_code와 페이지 크기를 얻는다.
const pagination = new WeakMap<FetchContext, { url: URL; params: URLSearchParams; size: number } | null>();

function rememberPagination(html: string, source: SourceConfig, ctx: FetchContext) {
  const $ = cheerio.load(html);
  let template: { url: URL; params: URLSearchParams; size: number } | null = null;
  $('a[href*="mv_data="]').each((_, a) => {
    if (template || cleanText($(a).text()) !== '2') return;
    const url = new URL($(a).attr('href')!, source.listUrl);
    const encoded = url.searchParams.get('mv_data')?.replace(/\|+$/, '');
    if (!encoded) return;
    const params = new URLSearchParams(Buffer.from(encoded, 'base64').toString('utf8'));
    const size = Number(params.get('startPage'));
    if (Number.isInteger(size) && size > 0) template = { url, params, size };
  });
  pagination.set(ctx, template);
}

export const homeKnuCmsAdapter: SourceAdapter = {
  platform: "home-knu-cms",
  async fetchList(source, ctx) {
    const items: NoticeItem[] = [];
    const start = Number(source.options?.startPage ?? 1);
    const pages = Number(source.options?.pages ?? 1);
    for (let page = start; page < start + pages; page++) {
      let url = source.listUrl;
      if (page > 1) {
        if (!pagination.has(ctx)) rememberPagination(await ctx.fetchHtml(source.listUrl), source, ctx);
        const template = pagination.get(ctx);
        if (!template) break;
        const params = new URLSearchParams(template.params);
        params.set('startPage', String((page - 1) * template.size));
        const target = new URL(template.url);
        target.searchParams.set('mv_data', Buffer.from(params.toString()).toString('base64') + '||');
        url = target.toString();
      }
      const html = await ctx.fetchHtml(url);
      if (page === 1) rememberPagination(html, source, ctx);
      const $ = cheerio.load(html);
      $("table tr").each((_, tr) => {
        const it = parseRow($, tr, source);
        if (it) items.push(it);
      });
    }
    return items;
  },
};
