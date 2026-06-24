import "dotenv/config";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { initSchema, endDb } from "../lib/db";
import { log } from "../lib/logger";

// db/schema.sql 을 적용한다. 여러 번 돌려도 안전(create ... if not exists).
async function main() {
  try {
    const schema = readFileSync(join(process.cwd(), "db", "schema.sql"), "utf8");
    await initSchema(schema);
    log.info("✔ 스키마 적용 완료 (notices 테이블 준비됨)");
  } catch (e) {
    log.error("스키마 적용 실패:", e instanceof Error ? e.message : e);
    process.exitCode = 1;
  } finally {
    await endDb();
  }
}

main();
