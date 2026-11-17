import { getCollectionHealth } from '../../../lib/db';
import { SOURCES } from '../../../sources/config';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET() {
  try {
    const health = await getCollectionHealth(SOURCES.filter(s=>s.enabled).map(s=>s.id));
    return Response.json(health, { status:health.healthy ? 200 : 503, headers:{'Cache-Control':'no-store'} });
  } catch {
    return Response.json({ healthy:false, reason:'database_unavailable' }, {status:503});
  }
}
