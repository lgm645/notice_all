import type { NoticeItem } from '../lib/types';

export function coverageFloor(startedMs: number, checkpointMs: number | null, since?: string): string {
  if (since) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(since) || !Number.isFinite(Date.parse(since)) || new Date(since).toISOString().slice(0,10) !== since) {
      throw new Error('since는 유효한 YYYY-MM-DD여야 합니다');
    }
    if (since > new Date(startedMs).toLocaleDateString('en-CA', {timeZone:'Asia/Seoul'})) throw new Error('미래 날짜부터 수집할 수 없습니다');
    return since;
  }
  // 정상 운용도 7일을 겹쳐 읽고 최초 실행은 최근 90일을 복구한다.
  const ms = checkpointMs ? Math.min(startedMs, checkpointMs) - 7*86_400_000 : startedMs - 90*86_400_000;
  return new Date(ms).toLocaleDateString('en-CA', { timeZone: 'Asia/Seoul' });
}

export function pageCoversFloor(items: NoticeItem[], floor: string): boolean {
  const ordinary = items.filter(item => !item.isFixed);
  return ordinary.length > 0 && ordinary.every(item => !!item.publishedDate && item.publishedDate < floor);
}
