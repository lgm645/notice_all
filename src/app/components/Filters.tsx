// 서버 컴포넌트: JS 없이도 동작하는 GET 폼 필터 (SSR 친화적).

interface Facet {
  source_id?: string;
  source_name?: string;
  category?: string;
  count?: number;
}

export default function Filters({
  facets,
  current,
}: {
  facets: { sources: Facet[]; categories: Facet[] };
  current: { source?: string; category?: string; q?: string };
}) {
  return (
    <form className="filters" method="get">
      <input
        type="search"
        name="q"
        placeholder="키워드 검색…"
        defaultValue={current.q ?? ""}
        aria-label="키워드 검색"
      />
      <select name="source" defaultValue={current.source ?? ""} aria-label="출처">
        <option value="">전체 출처</option>
        {facets.sources.map((s) => (
          <option key={s.source_id} value={s.source_id}>
            {s.source_name} ({s.count})
          </option>
        ))}
      </select>
      <select name="category" defaultValue={current.category ?? ""} aria-label="카테고리">
        <option value="">전체 카테고리</option>
        {facets.categories.map((c) => (
          <option key={c.category} value={c.category}>
            {c.category} ({c.count})
          </option>
        ))}
      </select>
      <button type="submit">적용</button>
      <a className="reset" href="/">
        초기화
      </a>
    </form>
  );
}
