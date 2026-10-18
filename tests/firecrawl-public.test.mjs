import test from 'node:test';
import assert from 'node:assert/strict';
import {parseFirecrawlPublicPage,readFirecrawlPublicPage} from '../lib/firecrawl-public.ts';

const article='개발자 브랜든 토머스가 Claude의 도움을 받아 무료 오픈소스 대체 앱 7개를 만들었습니다. 이 문서는 실제 프로그램 정보입니다.';
const valid={success:true,data:{
 markdown:['[Skip to content](https://example.com/#main)',
 '# 포토샵·프리미어 무료 대체 앱 7종 ArtCraft','',article,'',
 '## 설치 방법','Windows에 맞는 파일을 받아 설치합니다.'].join('\n'),
 metadata:{title:'포토샵·프리미어 무료 대체 앱 7종 ArtCraft',description:'Made in Notion, the connected workspace where AI agents and teams organize docs'}
}};

test('extracts real Notion title, paragraph and installation body without generic description',()=>{
 const page=parseFirecrawlPublicPage(valid);
 assert.equal(page?.title,'포토샵·프리미어 무료 대체 앱 7종 ArtCraft');
 assert.match(page?.content_text||'',/설치 방법/);
 assert.match(page?.description||'',/브랜든 토머스/);
 assert.ok(!page?.content_text.includes('Skip to content'));
});
test('rejects boilerplate-only, missing, empty, or failed responses',()=>{
 assert.equal(parseFirecrawlPublicPage({success:false,data:valid.data}),null);
 assert.equal(parseFirecrawlPublicPage({success:true,data:{markdown:'not found',metadata:{title:'Notion | Where teams and agents work together'}}}),null);
 assert.equal(parseFirecrawlPublicPage({success:true,data:{markdown:article.repeat(2),metadata:{title:'Notion | Where teams and agents work together'}}}),null);
 assert.equal(parseFirecrawlPublicPage({success:true,data:{markdown:'a',metadata:{title:'ArtCraft'}}}),null);
});
test('without a server-side key, returns null without invoking the network',async()=>{
 const previous=process.env.FIRECRAWL_API_KEY;
 const oldFetch=globalThis.fetch;
 delete process.env.FIRECRAWL_API_KEY;
 globalThis.fetch=()=>{throw Error('should not call fetch')};
 try{assert.equal(await readFirecrawlPublicPage(new URL('https://demo.notion.site/test')),null)}
 finally{globalThis.fetch=oldFetch;if(previous!==undefined)process.env.FIRECRAWL_API_KEY=previous;}
});
test('a valid public page returns genuine content via Firecrawl API without exposing the key',async()=>{
 const previous=process.env.FIRECRAWL_API_KEY;
 const oldFetch=globalThis.fetch;
 process.env.FIRECRAWL_API_KEY='fc-local-test-key';
 let calls=0;
 globalThis.fetch=async(input,init)=>{
  calls++;
  assert.equal(input,'https://api.firecrawl.dev/v2/scrape');
  assert.equal(init.headers.Authorization,'Bearer fc-local-test-key');
  assert.equal(JSON.parse(init.body).formats[0],'markdown');
  return new Response(JSON.stringify(valid),{headers:{'Content-Type':'application/json'}});
 };
 try{
  assert.equal(await readFirecrawlPublicPage(new URL('https://example.com/notion')),null);
  const actual=await readFirecrawlPublicPage(new URL('https://demo.notion.site/7-ArtCraft-aabbccddeeff00112233445566778899'));
  assert.match(actual?.content_text||'',/설치 방법/);
  assert.equal(calls,1);
 }finally{globalThis.fetch=oldFetch;if(previous===undefined)delete process.env.FIRECRAWL_API_KEY;else process.env.FIRECRAWL_API_KEY=previous;}
});
