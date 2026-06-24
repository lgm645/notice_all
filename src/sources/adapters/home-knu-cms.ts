import * as cheerio from "cheerio";
import type { CheerioAPI } from "cheerio";
import type { AnyNode } from "domhandler";
import type { NoticeItem, SourceAdapter, SourceConfig } from "../../lib/types";
import { cleanText, normDate, parseIntSafe, toKstIso } from "../../lib/normalize";

// ── home-knu CMS 어댑터 ───────────────────────────────────────────
// 대상: AI전공(seeai)·자원봉사(volunteer)·장학복지(knussw)·AIC(aic) [home.knu.ac.kr]
//       + 도서관(library) [kudos.knu.ac.kr] — 같은 CMS, 호스트만 다름.
// 글 ID(idx)는 제목 a 의 href 안 base64 mv_data 를 디코드해 추출(library 는 끝의 || 제거).
// 컬럼이 클래스/위치 두 형태가 있어, 날짜를 정규식으로 찾고 좌우에서 작성자/조회를 잡는다.

const DATE = /\d{4}[-./]\d{1,2}[-./]\d{1,2}/;

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
  let dateIdx = -1;
  tds.each((i, td) => {
    if (dateIdx < 0 && DATE.test(cleanText($(td).text()))) dateIdx = i;
  });
  let dateText = dateIdx >= 0 ? cleanText(tds.eq(dateIdx).text()) : cleanText($tr.find("td.date").first().text());

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
    // 상세 URL(mv_data)에 만료되는 세션 토큰이 있어 콜드 클릭 시 '잘못된 접근'.
    // 콜드로도 열리는 목록 페이지로 연결한다(수집 대상이 최신글이라 상단에 보임).
    url: source.listUrl,
    author,
    publishedAt: toKstIso(dateText),
    publishedDate: normDate(dateText),
    hasAttachment,
    isFixed,
    views,
    externalId: idx,
  };
}

export const homeKnuCmsAdapter: SourceAdapter = {
  platform: "home-knu-cms",
  // 목록 1페이지만 수집(최신). 다음 페이지는 base64 mv_data 안 startPage 를 만들어야 해 추후 확장.
  async fetchList(source, ctx) {
    const html = await ctx.fetchHtml(source.listUrl);
    const $ = cheerio.load(html);
    const items: NoticeItem[] = [];
    $("table tr").each((_, tr) => {
      const it = parseRow($, tr, source);
      if (it) items.push(it);
    });
    return items;
  },
};
