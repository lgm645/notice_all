import { getAdapter } from './registry';
import { SOURCES } from './config';
import { claimScrapeLease, getMetaTime, releaseScrapeLease, repairFuturePublishedDates, setMetaTime, touchLastRefresh, upsertNotices } from '../lib/db';
import { fetchHtml } from '../lib/http';
import type { FetchContext, NoticeItem, SourceConfig } from '../lib/types';
import { coverageFloor, pageCoversFloor } from './coverage';

const sleep = (ms: number) => new Promise<void>(r => setTimeout(r, ms));
export interface RunResult {
  source: string;
  total?: number;
  inserted?: number;
  updated?: number;
  pages?: number;
  pending?: boolean;
  rejectedFutureDates?: number;
  error?: string;
  samples?: NoticeItem[];
}

export class ScrapeBusyError extends Error {
  constructor() { super('다른 수집이 진행 중입니다'); }
}

export function rejectFuturePublishedDates(items: NoticeItem[], today = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Seoul' })) {
  let rejected = 0;
  const safe = items.map(item => {
    const date = item.publishedDate ?? item.publishedAt?.slice(0,10);
    if (!date || date <= today) return item;
    rejected++;
    return { ...item, publishedAt: null, publishedDate: null };
  });
  return { items: safe, rejected };
}

export interface RunOpts {
  sourceId?: string;
  concurrent?: boolean;
  dry?: boolean;
  since?: string;
  maxPages?: number;
  budgetMs?: number;
  quick?: boolean;
}

export async function runScrape(opts: RunOpts = {}, onResult?: (r: RunResult) => void) {
  const started = Date.now();
  const deadline = started + (opts.budgetMs ?? 12*60_000);
  const maxPages = Math.min(200, Math.max(1, Math.floor(opts.maxPages ?? 100)));
  const targets = SOURCES.filter(s => s.enabled && (!opts.sourceId || s.id === opts.sourceId));
  if (!targets.length) throw new Error('수집 대상이 없습니다');
  if (opts.since) coverageFloor(started, null, opts.since);
  const lease = opts.dry ? null : await claimScrapeLease();
  if (!opts.dry && !lease) throw new ScrapeBusyError();

  // 동일 호스트는 직렬화하여 수동 수집에서도 요청 사이 지연을 지킨다.
  const hostQueues = new Map<string, Promise<unknown>>();
  function context(s: SourceConfig): FetchContext {
    const delay = Math.max(1500, Number(s.options?.delayMs ?? 1500));
    return {
      fetchHtml: async url => {
        const host = new URL(url).host;
        const prior = hostQueues.get(host) ?? Promise.resolve();
        const work = prior.catch(() => {}).then(async () => {
          const remaining = deadline-Date.now();
          if (remaining < 2000) throw new Error('수집 시간 한도 — 다음 실행에서 보충을 계속합니다');
          return fetchHtml(url, { timeoutMs: Math.min(opts.quick ? 6000 : 20_000, remaining-1000), retries: opts.quick ? 0 : 2 });
        });
        hostQueues.set(host, work.catch(() => {}).then(() => sleep(delay)));
        return work;
      },
      delay: () => sleep(delay),
    };
  }

  async function scrapeOne(s: SourceConfig): Promise<RunResult> {
    const r: RunResult = { source:s.id, total:0, inserted:0, updated:0, pages:0, rejectedFutureDates:0, samples:[] };
    try {
      const checkpoint = opts.dry ? null : await getMetaTime(`source_success:${s.id}`);
      const floor = coverageFloor(started, checkpoint, opts.since);
      const ctx = context(s);
      const seen = new Set<string>();
      let complete = false;
      for (let page = 1; page <= maxPages; page++) {
        const parsed = await getAdapter(s.platform).fetchList({ ...s, options:{ ...s.options, pages:1, startPage:page } }, ctx);
        r.pages = page;
        if (!parsed.length) {
          if (page === 1) throw new Error('0건 반환 — 게시판 주소/HTML 구조 확인 필요');
          complete = true;
          break;
        }
        const safe = rejectFuturePublishedDates(parsed);
        r.rejectedFutureDates! += safe.rejected;
        const items = safe.items.filter(item => {
          if (seen.has(item.externalId)) return false;
          seen.add(item.externalId);
          return true;
        });
        if (!items.length) {
          if (parsed.every(item => item.isFixed)) { complete = true; break; }
          throw new Error('페이지 이동 후 같은 글만 반환 — 페이지 파서 확인 필요');
        }
        if (opts.dry) r.total! += items.length;
        else {
          const saved = await upsertNotices(items);
          r.total! += saved.total;
          r.inserted! += saved.inserted;
          r.updated! += saved.updated;
        }
        if (r.samples!.length < 5) r.samples!.push(...items.slice(0,5-r.samples!.length));
        if (page >= 2 && pageCoversFloor(safe.items, floor)) { complete = true; break; }
      }
      r.pending = !complete;
      if (complete && !opts.dry) await setMetaTime(`source_success:${s.id}`, started);
    } catch (e) {
      r.error = e instanceof Error ? e.message : String(e);
      r.pending = true;
    }
    onResult?.(r);
    return r;
  }

  try {
    const results: RunResult[] = [];
    if (opts.concurrent) results.push(...await Promise.all(targets.map(scrapeOne)));
    else for (const source of targets) results.push(await scrapeOne(source));
    let repairedDates = 0;
    if (!opts.dry) {
      repairedDates = await repairFuturePublishedDates();
      if (results.some(r => (r.total ?? 0) > 0)) await touchLastRefresh();
      if (targets.length === SOURCES.filter(s=>s.enabled).length && results.every(r => !r.error && !r.pending)) await setMetaTime('last_full_refresh', started);
    }
    return { results, totalNew:results.reduce((n,r)=>n+(r.inserted??0),0), targets:targets.length,
      rejectedFutureDates:results.reduce((n,r)=>n+(r.rejectedFutureDates??0),0), repairedDates };
  } finally {
    if (lease) await releaseScrapeLease(lease);
  }
}
