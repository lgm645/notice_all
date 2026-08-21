import { getAdapter } from "./registry";
import { SOURCES } from "./config";
import { repairFuturePublishedDates, touchLastRefresh, upsertNotices } from "../lib/db";
import { fetchHtml } from "../lib/http";
import type { FetchContext, NoticeItem, SourceConfig } from "../lib/types";

// 수집 코어 — CLI(스케줄)와 API(수동 새로고침)가 공유한다.
const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

export interface RunResult {
  source: string;
  total?: number;
  inserted?: number;
  updated?: number;
  rejectedFutureDates?: number;
  error?: string;
  samples?: NoticeItem[];
}

function todayKst(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Seoul" });
}

// 원본 사이트나 파서가 잘못된 값을 주더라도 미래 게시일은 DB에 넣지 않는다.
// 날짜를 비우면 조회 시 first_seen_at을 사용하므로 피드 정렬도 미래로 튀지 않는다.
export function rejectFuturePublishedDates(items: NoticeItem[], today = todayKst()) {
  let rejected = 0;
  const safeItems = items.map((item) => {
    const date = item.publishedDate ?? item.publishedAt?.slice(0, 10) ?? null;
    if (!date || date <= today) return item;
    rejected++;
    return { ...item, publishedAt: null, publishedDate: null };
  });
  return { items: safeItems, rejected };
}

async function scrapeOne(
  s: SourceConfig,
  delayOverride: number | undefined,
  dry: boolean,
): Promise<RunResult> {
  const delayMs = delayOverride ?? Number(s.options?.delayMs ?? 1500);
  const ctx: FetchContext = {
    fetchHtml: async (url) => {
      const html = await fetchHtml(url);
      if (delayMs) await sleep(delayMs); // 정중한 크롤링: 요청 사이 지연
      return html;
    },
    delay: () => sleep(delayMs),
  };
  try {
    const parsed = await getAdapter(s.platform).fetchList(s, ctx);
    const { items, rejected } = rejectFuturePublishedDates(parsed);
    if (items.length === 0) return { source: s.id, total: 0, inserted: 0, updated: 0 };
    if (dry) return { source: s.id, total: items.length, rejectedFutureDates: rejected, samples: items.slice(0, 5) };
    const r = await upsertNotices(items);
    return { source: s.id, rejectedFutureDates: rejected, ...r };
  } catch (e) {
    // 소스별 에러 격리: 한 사이트가 깨져도 나머지는 계속.
    return { source: s.id, error: e instanceof Error ? e.message : String(e) };
  }
}

export interface RunOpts {
  sourceId?: string;
  concurrent?: boolean; // true = 소스 동시 수집(수동 새로고침: 빠르게, 서버리스 시간제한 내)
  delayMs?: number; // 요청 사이 지연 강제(동시 수집 시 0 권장)
  dry?: boolean;
}

export async function runScrape(opts: RunOpts = {}, onResult?: (r: RunResult) => void) {
  let targets = SOURCES.filter((s) => s.enabled);
  if (opts.sourceId) targets = SOURCES.filter((s) => s.id === opts.sourceId);

  let results: RunResult[];
  if (opts.concurrent) {
    results = await Promise.all(
      targets.map((s) =>
        scrapeOne(s, opts.delayMs, !!opts.dry).then((r) => {
          onResult?.(r);
          return r;
        }),
      ),
    );
  } else {
    results = [];
    for (const s of targets) {
      const r = await scrapeOne(s, opts.delayMs, !!opts.dry);
      onResult?.(r);
      results.push(r);
      await sleep(800); // 소스 간 간격
    }
  }

  let repairedDates = 0;
  if (!opts.dry) {
    try {
      repairedDates = await repairFuturePublishedDates();
      await touchLastRefresh();
    } catch {
      /* 보조 복구/메타 갱신 실패가 소스별 수집 결과를 지우지는 않게 한다. */
    }
  }

  const totalNew = results.reduce((a, r) => a + (r.inserted ?? 0), 0);
  const rejectedFutureDates = results.reduce((a, r) => a + (r.rejectedFutureDates ?? 0), 0);
  return { results, totalNew, targets: targets.length, rejectedFutureDates, repairedDates };
}
