import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { endDb, getNotices, initSchema, repairFuturePublishedDates, upsertNotices } from "../src/lib/db";
import { isStandaloneDate, normDate, toKstIso } from "../src/lib/normalize";
import type { FetchContext, NoticeItem, SourceConfig } from "../src/lib/types";
import { rejectFuturePublishedDates } from "../src/sources/run";
import { homeKnuCmsAdapter } from "../src/sources/adapters/home-knu-cms";
import { kosafAdapter } from "../src/sources/adapters/kosaf";
import { seeAdapter } from "../src/sources/adapters/see";

function source(id: string, platform: string): SourceConfig {
  return {
    id,
    name: id,
    category: "소식",
    platform,
    listUrl: `https://example.com/${id}/list`,
    enabled: true,
    options: { pages: 1 },
  };
}

function context(html: string): FetchContext {
  return {
    fetchHtml: async () => html,
    delay: async () => {},
  };
}

test("공통 날짜 파서는 셀 전체가 날짜인 경우만 허용한다", () => {
  const title = "인재원(2026.9.1.~ 10.31.) 학생동 단체이용 신청 안내";
  assert.equal(isStandaloneDate(title), false);
  assert.equal(normDate(title), null);
  assert.equal(toKstIso(title), null);

  assert.equal(normDate("2026-08-05"), "2026-08-05");
  assert.equal(normDate("작성일 2026. 8. 5.(수) 14:30"), "2026-08-05");
  assert.equal(toKstIso("2026. 8. 5.(수) 14:30"), "2026-08-05T14:30:00+09:00");
  assert.equal(normDate("2026-02-30"), null);
});

test("SEE 파서는 제목의 행사일이 아니라 작성일 열을 사용한다", async () => {
  const html = `
    <table><tr>
      <td>7187</td>
      <td><a href="?pg=vv&amp;fidx=105465&amp;gtid=notice"><span>기타</span> 인재원(2026.9.1.~ 10.31.) 학생동 단체이용 신청 안내</a></td>
      <td>박현미</td><td>2026-08-05</td><td>623</td>
    </tr></table>`;
  const [item] = await seeAdapter.fetchList(source("see", "see"), context(html));

  assert.equal(item.publishedDate, "2026-08-05");
  assert.equal(item.author, "박현미");
  assert.equal(item.views, 623);
  assert.equal(item.category, "기타");
});

test("home-knu CMS 파서도 제목의 행사일을 건너뛴다", async () => {
  const mvData = Buffer.from("idx=217", "utf8").toString("base64");
  const html = `
    <table><tr>
      <td>217</td>
      <td><a href="/HOME/seeai/sub.htm?mode=view&amp;mv_data=${mvData}">인재원(2026.9.1.~ 10.31.) 학생동 단체이용 신청 안내</a></td>
      <td class="writer">IT대학 전자공학부 인공지능전공</td>
      <td class="date">2026-08-05</td><td class="hit">27</td>
    </tr></table>`;
  const [item] = await homeKnuCmsAdapter.fetchList(source("seeai", "home-knu-cms"), context(html));

  assert.equal(item.publishedDate, "2026-08-05");
  assert.equal(item.author, "IT대학 전자공학부 인공지능전공");
  assert.equal(item.views, 27);
});

test("KOSAF의 클래스 없는 대체 날짜 탐색도 제목 셀을 제외한다", async () => {
  const html = `
    <table><tbody><tr>
      <td>1</td>
      <td><a href="/ko/notice.do?seqNo=123">2026.9.1 장학 프로그램 안내</a></td>
      <td>2026.08.05</td><td class="search">41</td>
    </tr></tbody></table>`;
  const [item] = await kosafAdapter.fetchList(source("kosaf", "kosaf"), context(html));

  assert.equal(item.publishedDate, "2026-08-05");
  assert.equal(item.views, 41);
});

test("DB 유입 직전 미래 게시일을 방어적으로 제거한다", () => {
  const item: NoticeItem = {
    sourceId: "see",
    sourceName: "경북대 전자공학부",
    category: "소식",
    title: "테스트",
    url: "https://example.com/1",
    publishedAt: "2026-09-01T00:00:00+09:00",
    publishedDate: "2026-09-01",
    externalId: "1",
  };
  const result = rejectFuturePublishedDates([item], "2026-08-21");

  assert.equal(result.rejected, 1);
  assert.equal(result.items[0].publishedDate, null);
  assert.equal(result.items[0].publishedAt, null);
});

test("이미 저장된 미래 게시일도 first_seen_at의 KST 날짜로 복구한다", async () => {
  process.env.DB_DRIVER = "pglite";
  process.env.PGLITE_DATA = "memory://";
  const schema = await readFile("db/schema.sql", "utf8");

  try {
    await initSchema(schema);
    await upsertNotices([{
      sourceId: "seeai",
      sourceName: "경북대 전자공학부 인공지능전공",
      category: "소식",
      title: "DB 날짜 복구 테스트",
      url: "https://example.com/repair",
      publishedAt: "2099-09-01T00:00:00+09:00",
      publishedDate: "2099-09-01",
      externalId: "repair-1",
    }]);

    assert.equal(await repairFuturePublishedDates(), 1);
    const [row] = await getNotices({ q: "DB 날짜 복구 테스트" });
    assert.notEqual(row.display_date, "2099-09-01");
  } finally {
    await endDb();
  }
});
