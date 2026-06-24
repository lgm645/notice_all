// ── 공통 데이터 모델 ──────────────────────────────────────────────
// 어댑터가 출력하는 표준 공지 한 건.
export interface NoticeItem {
  sourceId: string;
  sourceName: string;
  category: string;
  title: string;
  url: string;
  author?: string | null;
  publishedAt?: string | null; // ISO (KST, +09:00)
  publishedDate?: string | null; // YYYY-MM-DD
  hasAttachment?: boolean;
  isFixed?: boolean; // 상단 고정/공지
  views?: number | null;
  summary?: string | null;
  externalId: string; // 출처 내에서 안정적인 글 ID → 중복 판단 키의 핵심
}

// ── 소스(게시판 하나) 설정 ────────────────────────────────────────
// 코드에 박지 않고 src/sources/config.ts 의 레지스트리에 등록한다.
export interface SourceConfig {
  id: string; // 고유 식별자 (중복키 네임스페이스로도 쓰임)
  name: string; // 표시명
  category: string; // 소식 | 행사 | 혜택 | 학사 ...
  platform: string; // 어떤 어댑터를 쓸지 (gnuboard, knu-wbbs, ...)
  listUrl: string; // 목록 페이지 URL
  enabled: boolean; // 수집 on/off (robots 정책·점검 등에 사용)
  options?: {
    pages?: number; // 한 번에 긁을 목록 페이지 수
    delayMs?: number; // 요청 사이 지연 (정중한 크롤링)
    [k: string]: unknown; // 플랫폼별 추가 옵션
  };
}

// 어댑터가 네트워크를 직접 만지지 않고 주입받는 컨텍스트.
export interface FetchContext {
  fetchHtml: (url: string) => Promise<string>;
  delay: () => Promise<void>;
}

// ── 소스 어댑터 인터페이스 ────────────────────────────────────────
// "새 게시판 추가 = 어댑터 1개 + 설정 1줄" 이 되게 하는 핵심 추상화.
export interface SourceAdapter {
  platform: string;
  fetchList: (source: SourceConfig, ctx: FetchContext) => Promise<NoticeItem[]>;
  // 필요할 때만 본문을 가져온다 (선택).
  fetchDetail?: (item: NoticeItem, ctx: FetchContext) => Promise<string | null>;
}
