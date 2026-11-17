import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import { coverageFloor, pageCoversFloor } from '../src/sources/coverage';
import { SOURCES } from '../src/sources/config';
import { ADAPTERS } from '../src/sources/registry';
import { runScrape } from '../src/sources/run';
import { endDb, getMetaTime, getNotices, initSchema, upsertNotices } from '../src/lib/db';
import type { NoticeItem } from '../src/lib/types';
import { homeKnuCmsAdapter } from '../src/sources/adapters/home-knu-cms';

test('고정 공지에 속지 않고 뒤로 밀린 누락 복구·중단 재개·멱등성을 보장한다', async () => {
  process.env.DB_DRIVER='pglite';
  process.env.PGLITE_DATA='memory://';
  const originalSources=SOURCES.slice();
  const item=(id:string,date:string,fixed=false):NoticeItem=>({sourceId:'coverage-test',sourceName:'테스트',category:'소식',title:id,url:'https://example.com/'+id,externalId:id,publishedDate:date,publishedAt:date+'T00:00:00+09:00',isFixed:fixed});
  const pinned=item('pinned','2020-01-01',true);
  const known=item('known','2026-11-01');
  const missing=item('missing','2026-10-25');
  const old=item('old','2026-10-10');
  const pages=[[pinned,known],[pinned,missing],[pinned,old]];
  try {
    await initSchema(await readFile('db/schema.sql','utf8'));
    SOURCES.splice(0,SOURCES.length,{id:'coverage-test',name:'테스트',category:'소식',platform:'coverage-test',listUrl:'https://example.com',enabled:true});
    ADAPTERS['coverage-test']={platform:'coverage-test',fetchList:async source=>pages[Number(source.options?.startPage??1)-1]??[]};
    await upsertNotices([pinned,known]);
    assert.equal(pageCoversFloor([pinned,known],'2026-10-20'),false);
    assert.equal(pageCoversFloor([pinned,old],'2026-10-20'),true);
    assert.equal(coverageFloor(Date.parse('2026-11-17T00:00:00Z'),Date.parse('2026-10-20T00:00:00Z')),'2026-10-13');
    const partial=await runScrape({since:'2026-10-20',maxPages:1});
    assert.equal(partial.results[0].pending,true);
    assert.equal(await getMetaTime('source_success:coverage-test'),null);
    const complete=await runScrape({since:'2026-10-20',maxPages:5});
    assert.equal(complete.results[0].pages,3);
    assert.equal(complete.results[0].pending,false);
    assert.equal(complete.totalNew,2);
    assert.ok(await getMetaTime('source_success:coverage-test'));
    assert.equal((await getNotices({q:'missing'})).length,1);
    assert.equal((await runScrape({since:'2026-10-20'})).totalNew,0);
  } finally {
    SOURCES.splice(0,SOURCES.length,...originalSources);
    delete ADAPTERS['coverage-test'];
    await endDb();
  }
});

test('home-knu CMS는 실제 링크의 Base64 페이지 정보를 유지하며 다음 페이지를 읽는다', async () => {
  const pageData=Buffer.from('startPage=10&code=board-code&nav_code=nav&table=notices').toString('base64');
  const row=(id:number)=>`<table><tr><td><a href="?mode=view&mv_data=${Buffer.from(`idx=${id}`).toString('base64')}">공지 ${id}</a></td><td class="date">2026-11-01</td></tr></table>`;
  const first=`<a href="?mv_data=${pageData}||">2</a>${row(1)}`;
  let calls=0;
  const source={id:'cms-test',name:'테스트',category:'소식',platform:'home-knu-cms',listUrl:'https://example.com/list?nav_code=nav',enabled:true,options:{pages:2}};
  const items=await homeKnuCmsAdapter.fetchList(source,{delay:async()=>{},fetchHtml:async url=>{
    calls++;
    if (calls===1) return first;
    const encoded=new URL(url).searchParams.get('mv_data')!.replace(/\|+$/,'');
    const params=new URLSearchParams(Buffer.from(encoded,'base64').toString());
    assert.equal(params.get('startPage'),'10');
    assert.equal(params.get('code'),'board-code');
    assert.equal(params.get('table'),'notices');
    return row(2);
  }});
  assert.deepEqual(items.map(i=>i.externalId),['1','2']);
  assert.equal(calls,2);
});
