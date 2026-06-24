import "dotenv/config";
import { SOURCES } from "../sources/config";
import { getAdapter } from "../sources/registry";
import { endDb, upsertNotices } from "../lib/db";
import { fetchHtml } from "../lib/http";
import { log } from "../lib/logger";
import type { FetchContext, SourceConfig } from "../lib/types";

// 사용법:
//   tsx src/scraper/scrape.ts --all            # enabled 인 모든 소스
//   tsx src/scraper/scrape.ts --source cse     # 특정 소스만
//   tsx src/scraper/scrape.ts --source cse --dry  # DB 미저장, 파싱 결과만 출력

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

function parseArgs(argv: string[]) {
  const out: { source?: string; all?: boolean; dry?: boolean } = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--source") out.source = argv[++i];
    else if (a === "--all") out.all = true;
    else if (a === "--dry") out.dry = true;
  }
  return out;
}

async function scrapeSource(source: SourceConfig, dry: boolean) {
  const delayMs = Number(source.options?.delayMs ?? 1500);
  const ctx: FetchContext = {
    fetchHtml: async (url) => {
      const html = await fetchHtml(url);
      await sleep(delayMs); // 정중한 크롤링: 요청 사이 지연
      return html;
    },
    delay: () => sleep(delayMs),
  };

  const adapter = getAdapter(source.platform);
  const items = await adapter.fetchList(source, ctx);

  // 모니터링: 0건이면 파서가 깨졌을 가능성 → 경고.
  if (items.length === 0) {
    log.warn(`[${source.id}] 0건 반환 — 파서 깨짐 의심 (HTML 구조 변경?)`);
    return { source: source.id, total: 0, inserted: 0, updated: 0 };
  }

  if (dry) {
    log.info(`[${source.id}] (dry) ${items.length}건 파싱됨. 상위 5건:`);
    for (const it of items.slice(0, 5)) {
      const flag = it.isFixed ? "📌" : "  ";
      const clip = it.hasAttachment ? "📎" : "";
      log.info(`   ${flag} ${it.publishedDate ?? "????-??-??"} [${it.category}] ${it.title} ${clip}`);
    }
    return { source: source.id, total: items.length, inserted: 0, updated: 0 };
  }

  const r = await upsertNotices(items);
  log.info(`[${source.id}] ${r.total}건 (신규 ${r.inserted} / 갱신 ${r.updated})`);
  return { source: source.id, ...r };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));

  let targets = SOURCES.filter((s) => s.enabled);
  if (args.source) targets = SOURCES.filter((s) => s.id === args.source);
  if (targets.length === 0) {
    log.error("대상 소스가 없습니다. (--source <id> 또는 config.ts 의 enabled 확인)");
    await endDb();
    return;
  }

  log.info(`수집 시작 — 대상 ${targets.length}개 소스${args.dry ? " (dry-run)" : ""}`);

  const results: Array<{ source: string; error?: string; inserted?: number }> = [];
  for (const s of targets) {
    try {
      results.push(await scrapeSource(s, !!args.dry));
    } catch (e) {
      // 소스별 에러 격리: 한 사이트가 깨져도 전체 파이프라인은 계속.
      const msg = e instanceof Error ? e.message : String(e);
      log.error(`[${s.id}] 수집 실패 — ${msg}`);
      results.push({ source: s.id, error: msg });
    }
    await sleep(800); // 소스 간 간격
  }

  const ok = results.filter((r) => !r.error);
  const totalNew = ok.reduce((a, r) => a + (r.inserted ?? 0), 0);
  log.info(`완료 — 성공 ${ok.length}/${results.length} 소스, 신규 ${totalNew}건`);
  if (ok.length < results.length) process.exitCode = 1;

  await endDb();
}

main().catch(async (e) => {
  log.error(e);
  await endDb().catch(() => {});
  process.exit(1);
});
