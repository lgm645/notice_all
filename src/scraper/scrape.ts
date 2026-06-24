import "dotenv/config";
import { runScrape } from "../sources/run";
import { endDb } from "../lib/db";
import { log } from "../lib/logger";

// 사용법:
//   tsx src/scraper/scrape.ts --all            # enabled 인 모든 소스(순차, 정중)
//   tsx src/scraper/scrape.ts --source cse     # 특정 소스만
//   tsx src/scraper/scrape.ts --source cse --dry  # DB 저장 없이 파싱 결과만 출력

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

async function main() {
  const args = parseArgs(process.argv.slice(2));
  log.info(`수집 시작${args.dry ? " (dry-run)" : ""}`);

  const { results, totalNew } = await runScrape(
    { sourceId: args.source, dry: args.dry }, // 순차(정중) 모드
    (r) => {
      if (r.error) {
        log.error(`[${r.source}] 수집 실패 — ${r.error}`);
      } else if ((r.total ?? 0) === 0) {
        log.warn(`[${r.source}] 0건 반환 — 파서 깨짐 의심 (HTML 구조 변경?)`);
      } else if (args.dry) {
        log.info(`[${r.source}] (dry) ${r.total}건 파싱됨. 상위:`);
        for (const it of r.samples ?? []) {
          const flag = it.isFixed ? "📌" : "  ";
          const clip = it.hasAttachment ? "📎" : "";
          log.info(`   ${flag} ${it.publishedDate ?? "????-??-??"} [${it.category}] ${it.title} ${clip}`);
        }
      } else {
        log.info(`[${r.source}] ${r.total}건 (신규 ${r.inserted} / 갱신 ${r.updated})`);
      }
    },
  );

  const ok = results.filter((r) => !r.error).length;
  log.info(`완료 — 성공 ${ok}/${results.length} 소스, 신규 ${totalNew}건`);
  if (ok < results.length) process.exitCode = 1;

  await endDb();
}

main().catch(async (e) => {
  log.error(e);
  await endDb().catch(() => {});
  process.exit(1);
});
