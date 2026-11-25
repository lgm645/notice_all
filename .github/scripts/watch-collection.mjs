import { execFileSync } from 'node:child_process';
import { appendFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { setTimeout as sleep } from 'node:timers/promises';

const STALE_ANNOTATION = '::warning::';
const RECOVERY_WAIT_MS = 18 * 60_000;
const RECOVERY_POLL_MS = 30_000;

export function classifyHealth(status, body) {
  if (body?.reason === 'database_unavailable') {
    return { kind: 'unavailable', detail: 'DB 체크포인트 조회 실패' };
  }
  if (!Array.isArray(body?.sources) || !body.sources.length || body.sources.some(
    source => typeof source?.id !== 'string' || !/^[a-z0-9-]+$/.test(source.id)
      || typeof source.stale !== 'boolean',
  )) {
    return { kind: 'unavailable', detail: `HTTP ${status}, 유효한 출처별 상태 없음` };
  }

  const stale = body.sources.filter(source => source.stale).map(source => source.id);
  if (status === 200 && body.healthy === true && !stale.length) {
    return { kind: 'healthy' };
  }
  if (status === 503 && body.healthy === false && stale.length) {
    return { kind: 'stale', detail: stale.join(', ') };
  }
  return { kind: 'unavailable', detail: `HTTP ${status}, 상태 코드와 출처별 결과가 일치하지 않음` };
}

async function readHealth(url) {
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(15_000), redirect: 'error' });
    const body = await response.json().catch(() => null);
    return classifyHealth(response.status, body);
  } catch {
    return { kind: 'unavailable', detail: '상태 API 연결 실패 또는 요청 시간 초과' };
  }
}

export async function watchCollection({ probe, activeScrape, dispatch, report, wait = sleep,
  now = Date.now, recoveryWaitMs = RECOVERY_WAIT_MS }) {
  let health;
  for (let attempt = 0; attempt < 3; attempt++) {
    if (attempt > 0) await wait(2_000);
    health = await probe();
    if (health.kind !== 'unavailable') break;
  }

  if (health.kind === 'healthy') {
    report('모든 출처의 수집 완료 시점이 정상 범위입니다.');
    return;
  }
  if (health.kind === 'unavailable') {
    throw new Error(`수집 상태를 확인할 수 없습니다 (${health.detail}).`);
  }

  report(`수집 지연 확인 — ${health.detail}`, STALE_ANNOTATION);
  if (activeScrape()) {
    report('대기 또는 실행 중인 공지 수집의 결과를 확인합니다.');
  } else {
    dispatch();
    report('공지 수집 복구를 한 번 요청했습니다.');
  }

  const deadline = now() + recoveryWaitMs;
  while (now() < deadline) {
    await wait(Math.min(RECOVERY_POLL_MS, deadline - now()));
    health = await probe();
    if (health.kind === 'healthy') {
      report('모든 출처의 수집 완료 시점이 정상 범위로 돌아왔습니다.');
      return;
    }
  }

  if (health.kind === 'unavailable') {
    throw new Error(`복구 요청 후 수집 상태를 확인할 수 없습니다 (${health.detail}).`);
  }
  throw new Error(`복구 대기 시간이 지난 뒤에도 수집 지연이 남아 있습니다 — ${health.detail}`);
}

function gh(args) {
  return execFileSync('gh', args, { encoding: 'utf8', timeout: 30_000 });
}

function report(message, annotation = '') {
  console.log(`${annotation}${message}`);
  if (process.env.GITHUB_STEP_SUMMARY) {
    appendFileSync(process.env.GITHUB_STEP_SUMMARY, `- ${message}\n`);
  }
}

async function main() {
  const { GITHUB_REPOSITORY: repo, HEALTH_URL: healthUrl } = process.env;
  if (!repo || !healthUrl) throw new Error('저장소와 상태 API 주소를 설정해 주세요.');
  const workflow = ['--repo', repo, '--workflow', 'scrape.yml', '--branch', 'main'];
  await watchCollection({
    probe: () => readHealth(healthUrl),
    activeScrape: () => {
      const runs = JSON.parse(gh(['run', 'list', ...workflow, '--limit', '20', '--json', 'status']));
      return runs.some(run => run.status !== 'completed');
    },
    dispatch: () => gh(['workflow', 'run', 'scrape.yml', '--repo', repo, '--ref', 'main']),
    report,
  });
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch(error => {
    report(error.message, '::error::');
    process.exitCode = 1;
  });
}
