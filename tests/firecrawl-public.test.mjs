import test from 'node:test';
import assert from 'node:assert/strict';
import {parseFirecrawlPublicPage,readFirecrawlPublicPage,canSendPublicUrlToFirecrawl} from '../lib/firecrawl-public.ts';

const paragraph='개발자 브랜든 토머스는 누구나 무료로 이용할 수 있는 오픈소스 프로그램 일곱 가지를 공개했습니다. 실험적 버전이므로 중요한 파일을 열 때는 복사본을 준비하는 것이 좋습니다.';
const followup='윈도와 맥에서 각각 운영체제에 맞는 파일을 다운로드해서 설치할 수 있으며, 설치 전 공식 배포 페이지의 최신 안내를 반드시 확인해 주세요.';
const title='포토샵·프리미어 무료 대체 앱 7종 ArtCraft';
const valid={success:true,data:{
 markdown:['[Skip to content](https://example.com/#main)','# 포토샵·프리미어 무료 대체 앱 7종 ArtCraft','',paragraph,'',followup,'',
 '## 설치 방법','1. 컴퓨터에 맞는 설치 파일을 내려받습니다.','2. 다운로드된 파일을 실행하여 설치합니다.'].join('\n'),
 metadata:{title,description:'Made in Notion, the connected workspace where AI agents and teams organize docs'}
}};
test('public Notion page returns a real title, description and structured document body',()=>{
 const page=parseFirecrawlPublicPage(valid);
 assert.equal(page?.title,title);
 assert.match(page?.content_text||'',/설치 방법/);
 assert.match(page?.description||'',/브랜든 토머스/);
 assert.ok(!page?.content_text.includes('Skip to content'));
});
test('public blog and cafe articles are parsed without a Notion restriction',()=>{
 const blog=parseFirecrawlPublicPage({success:true,data:{
  markdown:['# 티스토리 회계 자료 정리',paragraph,followup].join('\n\n'),
  metadata:{title:'티스토리 회계 자료 정리',description:'재무자료와 공개 업무 정보를 정리한 글입니다. 이 글에서는 표와 설명을 확인할 수 있습니다.'}
 }});
 assert.equal(blog?.title,'티스토리 회계 자료 정리');
 assert.match(blog?.content_text||'',/오픈소스 프로그램/);
 const cafe=parseFirecrawlPublicPage({success:true,data:{
  markdown:['# 다음 카페에 공개된 이용 가이드',paragraph,followup].join('\n\n'),
  metadata:{title:'다음 카페에 공개된 이용 가이드'}
 }});
 assert.equal(cafe?.title,'다음 카페에 공개된 이용 가이드');
});
test('a public Instagram caption may be extracted when there is actual public text',()=>{
 const page=parseFirecrawlPublicPage({success:true,data:{
  markdown:['# 공개된 사진 설명',paragraph,followup].join('\n\n'),
  metadata:{title:'홍길동 on Instagram: 공개된 사진 설명'}
 }});
 assert.match(page?.content_text||'',/프로그램/);
});
test('login pages, generic landing screens, unsupported or empty results are incomplete',()=>{
 assert.equal(parseFirecrawlPublicPage({success:false,data:valid.data}),null);
 assert.equal(parseFirecrawlPublicPage({success:true,data:{markdown:'Page not found',metadata:{title:'Page not found'}}}),null);
 assert.equal(parseFirecrawlPublicPage({success:true,data:{
  markdown:['# Log in to Instagram','Log in to view photos and videos from friends and family.',
   'Continue with Facebook or create a new account to see private account photos.',
   paragraph,followup].join('\n\n'),metadata:{title:'Instagram'}
 }}),null);
 assert.equal(parseFirecrawlPublicPage({success:true,data:{
  markdown:[paragraph,followup].join('\n\n'),metadata:{title:'Notion | Where teams and agents work together'}
 }}),null);
 assert.equal(parseFirecrawlPublicPage({success:true,data:{markdown:'a',metadata:{title:'ArtCraft'}}}),null);
});
test('private, local and signed URLs never reach third-party Firecrawl',()=>{
 const urls=['http://localhost:3000','http://192.168.0.1','https://127.0.0.1',
  'http://[::1]/','https://files.example.com/?access_token=secret',
  'https://example.com/path?signature=signed','https://example.com/?password=123'];
 for(const value of urls)assert.equal(canSendPublicUrlToFirecrawl(new URL(value)),false,value);
 assert.equal(canSendPublicUrlToFirecrawl(new URL('https://cafe.daum.net/public/post?id=12')),true);
 assert.equal(canSendPublicUrlToFirecrawl(new URL('https://www.instagram.com/p/ABC123/')),true);
});
test('missing server API key skips the external request without side effects',async()=>{
 const previous=process.env.FIRECRAWL_API_KEY,oldFetch=globalThis.fetch;
 delete process.env.FIRECRAWL_API_KEY;
 globalThis.fetch=()=>{throw Error('should not call fetch')};
 try{assert.equal(await readFirecrawlPublicPage(new URL('https://demo.notion.site/test')),null)}
 finally{globalThis.fetch=oldFetch;if(previous!==undefined)process.env.FIRECRAWL_API_KEY=previous;}
});
test('public URLs use one secure API call, remove tracking and cache successful results',async()=>{
 const previous=process.env.FIRECRAWL_API_KEY,oldFetch=globalThis.fetch;
 process.env.FIRECRAWL_API_KEY='fc-local-test-key';
 let calls=0;
 globalThis.fetch=async(input,init)=>{
  calls++;
  assert.equal(input,'https://api.firecrawl.dev/v2/scrape');
  assert.equal(init.headers.Authorization,'Bearer fc-local-test-key');
  const body=JSON.parse(init.body);
  assert.deepEqual(body.formats,['markdown']);
  assert.equal(body.url,'https://cafe.daum.net/somepublicpost?post=1');
  return new Response(JSON.stringify(valid),{headers:{'Content-Type':'application/json'}});
 };
 try{
  assert.equal(await readFirecrawlPublicPage(new URL('https://example.com/?token=private')),null);
  const url=new URL('https://cafe.daum.net/somepublicpost?post=1&utm_source=share');
  const actual=await readFirecrawlPublicPage(url);
  assert.match(actual?.content_text||'',/설치 방법/);
  assert.equal(await readFirecrawlPublicPage(url),actual);
  assert.equal(calls,1);
 }finally{globalThis.fetch=oldFetch;if(previous===undefined)delete process.env.FIRECRAWL_API_KEY;else process.env.FIRECRAWL_API_KEY=previous;}
});
test('failed third-party HTTP responses do not claim success',async()=>{
 const previous=process.env.FIRECRAWL_API_KEY,oldFetch=globalThis.fetch;
 process.env.FIRECRAWL_API_KEY='fc-local-test-key';
 globalThis.fetch=async()=>new Response('rate limited',{status:429,headers:{'Content-Type':'text/plain'}});
 try{assert.equal(await readFirecrawlPublicPage(new URL('https://site.example.com/fresh-post')),null)}
 finally{globalThis.fetch=oldFetch;if(previous===undefined)delete process.env.FIRECRAWL_API_KEY;else process.env.FIRECRAWL_API_KEY=previous;}
});
