import "dotenv/config";
import { appendFile } from "node:fs/promises";
import { runScrape, type RunResult } from "../sources/run";
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

function workflowEscape(s: string): string {
  return s.replace(/%/g, "%25").replace(/\r/g, "%0D").replace(/\n/g, "%0A");
}

function markdownCell(s: string): string {
  return s.replace(/\|/g, "\\|").replace(/[\r\n]+/g, " ");
}

async function writeGithubSummary(results: RunResult[], totalNew: number): Promise<void> {
  const path = process.env.GITHUB_STEP_SUMMARY;
  if (!path) return;
  const failed = results.filter((r) => r.error);
  const rows = results.map((r) =>
    `| ${r.source} | ${r.error ? `❌ ${markdownCell(r.error)}` : "✅ 성공"} | ${r.total ?? "-"} | ${r.inserted ?? 0} |`,
  );
  const body = [
    "# 공지 자동 수집 결과",
    "",
    `- 전체: **${results.length}개 소스**`,
    `- 성공: **${results.length - failed.length}개** / 실패: **${failed.length}개**`,
    `- 신규 공지: **${totalNew}건**`,
    "",
    "| 출처 | 상태 | 수집 건수 | 신규 |",
    "|---|---|---:|---:|",
    ...rows,
    "",
  ].join("\n");
  await appendFile(path, body, "utf8");
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  log.info(`수집 시작${args.dry ? " (dry-run)" : ""}`);

  const { results, totalNew, rejectedFutureDates, repairedDates } = await runScrape(
    { sourceId: args.source, dry: args.dry }, // 순차(정중) 모드
    (r) => {
      if (r.error) {
        log.error(`[${r.source}] 수집 실패 — ${r.error}`);
        if (process.env.GITHUB_ACTIONS === "true") {
          console.error(`::error title=공지 수집 실패 · ${r.source}::${workflowEscape(r.error)}`);
        }
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
      if (r.rejectedFutureDates) {
        log.warn(`[${r.source}] 미래 게시일 ${r.rejectedFutureDates}건 차단`);
      }
    },
  );

  const ok = results.filter((r) => !r.error).length;
  log.info(`완료 — 성공 ${ok}/${results.length} 소스, 신규 ${totalNew}건`);
  if (rejectedFutureDates || repairedDates) {
    log.warn(`날짜 보호 — 유입 차단 ${rejectedFutureDates}건 / 기존 데이터 복구 ${repairedDates}건`);
  }
  try {
    await writeGithubSummary(results, totalNew);
  } catch (e) {
    log.warn(`GitHub 실행 요약 작성 실패 — ${e instanceof Error ? e.message : String(e)}`);
  }
  if (ok < results.length) process.exitCode = 1;

  await endDb();
}

main().catch(async (e) => {
  log.error(e);
  await endDb().catch(() => {});
  process.exit(1);
});
