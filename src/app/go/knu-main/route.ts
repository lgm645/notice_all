export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// 경북대 공지(knu-main)의 정확한 글로 보내는 리다이렉트.
// viewBtin.action 상세는 세션이 있어야 GET 으로 열린다(세션ID는 URL 의 ;wbbssessionid= 로 전달 가능).
// 그래서 클릭 순간 목록을 한 번 fetch 해 세션을 만들고, 그 세션ID 를 붙여 정확한 글로 302.
// 세션을 못 얻으면 목록 페이지로 폴백(그래도 글이 상단에 보임).
const LIST = "https://www.knu.ac.kr/wbbs/wbbs/bbs/btin/list.action?bbs_cde=1&menu_idx=67";
const UA = "Mozilla/5.0 (compatible; KNU-Notice-Aggregator/0.1; +student personal project)";

function redirect(to: string): Response {
  return new Response(null, { status: 302, headers: { Location: to, "Cache-Control": "no-store" } });
}

export async function GET(req: Request): Promise<Response> {
  const u = new URL(req.url);
  const docNo = u.searchParams.get("doc_no") ?? "";
  const noteDiv = u.searchParams.get("note_div") === "top" ? "top" : "row";
  if (!/^\d+$/.test(docNo)) return redirect(LIST);

  let wsid = "";
  try {
    const res = await fetch(LIST, {
      headers: { "User-Agent": UA, Accept: "text/html" },
      redirect: "manual",
      signal: AbortSignal.timeout(8000),
    });
    const cookies = (res.headers.getSetCookie?.() ?? [res.headers.get("set-cookie") ?? ""]).join("\n");
    wsid = /WBBSSESSIONID=([^;\s]+)/.exec(cookies)?.[1] ?? "";
  } catch {
    /* 네트워크 실패 → 아래에서 목록 폴백 */
  }
  if (!wsid) return redirect(LIST);

  const target =
    `https://www.knu.ac.kr/wbbs/wbbs/bbs/btin/viewBtin.action;wbbssessionid=${wsid}` +
    `?bbs_cde=1&btin.bbs_cde=1&btin.doc_no=${docNo}&btin.appl_no=000000&btin.note_div=${noteDiv}&menu_idx=67`;
  return redirect(target);
}
