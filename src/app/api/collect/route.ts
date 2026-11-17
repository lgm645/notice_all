import { revalidateTag } from 'next/cache';
import { redeemRemoteTicket } from '../../../lib/db';
import { runScrape, ScrapeBusyError } from '../../../sources/run';
import { SOURCES } from '../../../sources/config';

export const runtime='nodejs';
export const dynamic='force-dynamic';
export const maxDuration=300;

export async function POST(req: Request) {
  try {
    const token=/^Bearer ([a-f0-9]{64})$/.exec(req.headers.get('authorization') ?? '')?.[1];
    const ticket=token ? await redeemRemoteTicket(token) : null;
    if (!ticket) return Response.json({error:'unauthorized'},{status:401});
    if (!SOURCES.some(s=>s.enabled && s.id===ticket.sourceId)) return Response.json({error:'invalid_source'},{status:400});
    // 실행 범위는 요청 본문이 아닌 DB의 일회용 실행권으로만 결정한다.
    const result=await runScrape({sourceId:ticket.sourceId,since:ticket.since,maxPages:ticket.maxPages,budgetMs:240_000});
    revalidateTag('notices',{expire:0});
    return Response.json(result);
  } catch (error) {
    if (error instanceof ScrapeBusyError) return Response.json({error:'busy'},{status:409});
    console.error('서울 수집 실행 실패', error instanceof Error ? error.message : 'unknown');
    return Response.json({error:'collection_failed'},{status:500});
  }
}
