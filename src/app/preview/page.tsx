export const dynamic = "force-dynamic";

const DESIGNS = [
  {
    id: "broadsheet",
    name: "Broadsheet",
    ko: "신문 브로드시트",
    concept: "세리프 마스트헤드 + 다단 신문 지면. KNU 레드 1색으로 절제.",
    swatch: ["#f4efe4", "#1a1714", "#c8102e"],
    tags: ["세리프", "다단", "밀도 높음", "자동 다크"],
  },
  {
    id: "terminal",
    name: "Terminal",
    ko: "CLI / 콘솔",
    concept: "모노스페이스 콘솔. tail -f 처럼 흐르는 로그 라인 + 점멸 커서.",
    swatch: ["#07090a", "#3bf08a", "#ffb84d"],
    tags: ["모노스페이스", "다크 우선", "행 기반", "고밀도"],
  },
  {
    id: "bento",
    name: "Bento",
    ko: "벤토 대시보드",
    concept: "둥근 타일 벤토 그리드 + 상단 통계 스트립. 다크 토글 포함.",
    swatch: ["#eef0f6", "#6d5ef0", "#1b1d29"],
    tags: ["타일 그리드", "인디고", "다크 토글", "통계"],
  },
  {
    id: "brutalist",
    name: "Brutalist",
    ko: "브루탈리스트 / 스위스",
    concept: "두꺼운 검정 보더 + 하드 오프셋 섀도 + 일렉트릭 옐로. 라운드 0.",
    swatch: ["#f4f4f0", "#0a0a0a", "#e8ff00"],
    tags: ["대형 타입", "비대칭", "하드 섀도", "자동 다크"],
  },
  {
    id: "datatable",
    name: "Data Terminal",
    ko: "블룸버그풍 표",
    concept: "고밀도 데이터 표 + 고정 헤더 + 모노 숫자 + 색상 코딩. 극한 밀도.",
    swatch: ["#06090c", "#35e0e0", "#ffc04d"],
    tags: ["표 레이아웃", "고정 헤더", "극한 밀도", "시안/앰버"],
  },
];

export default function Gallery() {
  return (
    <main data-design="gallery" className="gl">
      <header className="gl-head">
        <h1>공지 알리미 · 디자인 시안</h1>
        <p>
          같은 데이터·기능에 시각 디자인만 다르게 한 <b>5가지 방향</b>. 카드를 눌러 실제
          데이터로 비교하세요. 마음에 드는 방향을 그대로 <code>/</code> 로 승격할 수 있습니다.
        </p>
        <a className="gl-current" href="/">
          ← 현재 운영 중인 기본 디자인 보기
        </a>
      </header>

      <ul className="gl-grid">
        {DESIGNS.map((d, i) => (
          <li key={d.id} className="gl-card">
            <a href={`/preview/${d.id}`} className="gl-link">
              <div className="gl-swatch" aria-hidden="true">
                {d.swatch.map((c, j) => (
                  <span key={j} style={{ background: c }} />
                ))}
                <span className="gl-num">{String(i + 1).padStart(2, "0")}</span>
              </div>
              <div className="gl-body">
                <div className="gl-name">
                  <strong>{d.name}</strong>
                  <span>{d.ko}</span>
                </div>
                <p className="gl-concept">{d.concept}</p>
                <div className="gl-tags">
                  {d.tags.map((t) => (
                    <span key={t}>{t}</span>
                  ))}
                </div>
                <span className="gl-open">열어보기 →</span>
              </div>
            </a>
          </li>
        ))}
      </ul>

      <footer className="gl-foot">
        <p>각 시안은 새 글 표시 · 필터/검색 · 페이지네이션 · 새로고침 · RSS 기능을 모두 유지합니다.</p>
      </footer>
    </main>
  );
}
