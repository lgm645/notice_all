import { mintRemoteTicket } from '../lib/db';
import { coverageFloor } from '../sources/coverage';
import { ScrapeBusyError, type RunResult } from '../sources/run';
import { retryScrapeBusy } from './retry-busy';

export async function collectInSeoul(origin: string, sourceId: string, since?: string, maxPages=100): Promise<RunResult> {
  if (since) coverageFloor(Date.now(),null,since);
  const base=new URL(origin);
  if (base.protocol!=='https:' || base.username || base.password || base.search || base.hash || base.pathname!=='/') throw new Error('잘못된 서울 수집 서버 주소');
  return retryScrapeBusy(async () => {
    const ticket=await mintRemoteTicket(sourceId,since,maxPages);
    const response=await fetch(new URL('/api/collect',base),{
      method:'POST',headers:{Authorization:`Bearer ${ticket}`},signal:AbortSignal.timeout(285_000),redirect:'error',
    });
    if (response.status === 409) {
      const body = await response.json().catch(() => null);
      if (body?.error === 'busy') throw new ScrapeBusyError();
    }
    if (!response.ok) throw new Error(`서울 수집 서버 HTTP ${response.status}`);
    const body=await response.json();
    const result=body.results?.find((r:RunResult)=>r.source===sourceId);
    if (!result) throw new Error('서울 수집 응답에 출처 결과가 없습니다');
    return result;
  });
}
