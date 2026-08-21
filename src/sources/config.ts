import type { SourceConfig } from "../lib/types";

// ── 수집 대상 게시판 레지스트리 ──────────────────────────────────
// 소스 목록은 코드 로직이 아니라 "설정"이다. 새 게시판 추가 = 여기에 한 줄.
// (어댑터는 src/sources/registry.ts, 추가 방법은 README "새 게시판 추가" 참고)
//
// 11개 게시판이 5개 어댑터로 동작. 크누큐브(knucube)는 로그인 벽+robots Disallow:/ 라 보류.

const POLITE = 1500;
const HOME_KNU_DELAY = 2500; // home.knu.ac.kr 계열: robots Disallow:/H* → 더 정중하게

export const SOURCES: SourceConfig[] = [
  // ── gnuboard ──
  {
    id: "cse",
    name: "경북대 컴퓨터학부",
    category: "소식",
    platform: "gnuboard",
    // 2026-08 홈페이지 개편으로 기존 sub5_1 폐기 → 새 "학부 공지사항" 게시판.
    listUrl: "https://cse.knu.ac.kr/bbs/board.php?bo_table=sub6_1_a&lang=kor",
    enabled: true,
    options: { pages: 1, delayMs: POLITE },
  },
  {
    id: "startup",
    name: "경북대 창업지원단",
    category: "혜택",
    platform: "gnuboard",
    listUrl: "https://startup.knu.ac.kr/bbs/board.php?bo_table=noti2",
    enabled: true,
    options: { pages: 1, delayMs: POLITE },
  },

  // ── knu-wbbs (www.knu.ac.kr/wbbs) ──
  {
    id: "knu-main",
    name: "경북대학교 공지사항",
    category: "소식",
    platform: "knu-wbbs",
    listUrl: "https://www.knu.ac.kr/wbbs/wbbs/bbs/btin/list.action?bbs_cde=1&menu_idx=67",
    enabled: true,
    options: { pages: 1, delayMs: POLITE },
  },
  {
    id: "knu-haksa",
    name: "경북대학교 학사공지",
    category: "학사",
    platform: "knu-wbbs",
    listUrl: "https://www.knu.ac.kr/wbbs/wbbs/bbs/btin/stdList.action?menu_idx=42",
    enabled: true,
    // 학사공지는 글 ID(bltn_no)가 doRead() JS 인자라, 상세 URL 을 템플릿으로 구성.
    options: {
      pages: 1,
      delayMs: POLITE,
      detailTemplate: "/wbbs/wbbs/bbs/btin/stdViewBtin.action?bltn_no={id}&menu_idx=42",
    },
  },

  // ── see (전자공학부) ──
  {
    id: "see",
    name: "경북대 전자공학부",
    category: "소식",
    platform: "see",
    listUrl: "https://see.knu.ac.kr/content/board/notice.html",
    enabled: true,
    options: { pages: 1, delayMs: POLITE },
  },

  // ── home-knu-cms (home.knu.ac.kr/HOME/*) — robots Disallow:/H* (정중히 수집) ──
  {
    id: "seeai",
    name: "경북대 전자공학부 인공지능전공",
    category: "소식",
    platform: "home-knu-cms",
    listUrl: "https://home.knu.ac.kr/HOME/seeai/sub.htm?nav_code=see1667180581",
    enabled: true,
    options: { delayMs: HOME_KNU_DELAY },
  },
  {
    id: "volunteer",
    name: "경북대 자원봉사센터",
    category: "혜택",
    platform: "home-knu-cms",
    listUrl: "https://home.knu.ac.kr/HOME/volunteer/sub.htm?nav_code=vol1623744108",
    enabled: true,
    options: { delayMs: HOME_KNU_DELAY },
  },
  {
    id: "knussw",
    name: "경북대 장학복지제도",
    category: "혜택",
    platform: "home-knu-cms",
    listUrl: "https://home.knu.ac.kr/HOME/knussw/sub.htm?nav_code=knu1619416593",
    enabled: true,
    options: { delayMs: HOME_KNU_DELAY },
  },
  {
    id: "aic",
    name: "경북대 인공지능혁신융합대학사업단",
    category: "소식",
    platform: "home-knu-cms",
    listUrl: "https://home.knu.ac.kr/HOME/aic/sub.htm?nav_code=aic1635293208",
    enabled: true,
    options: { delayMs: HOME_KNU_DELAY },
  },
  {
    id: "library",
    name: "경북대 도서관",
    category: "소식",
    platform: "home-knu-cms", // kudos.knu.ac.kr — 같은 CMS, 호스트만 다름
    listUrl: "https://kudos.knu.ac.kr/pages/sub.htm?nav_code=kud1641347165",
    enabled: true,
    options: { delayMs: 2000 },
  },

  // ── kosaf ──
  {
    id: "kosaf",
    name: "한국장학재단",
    category: "혜택",
    platform: "kosaf",
    listUrl: "https://www.kosaf.go.kr/ko/notice.do?pg=PTKONotice_List&naviParam=DN,08,01,00",
    enabled: true,
    options: { pages: 1, delayMs: POLITE },
  },

  // ── 보류: 크누큐브(knucube) — 로그인 벽 + robots Disallow:/ (헤드리스+인증 필요) ──
];
