import test from 'node:test';
import assert from 'node:assert/strict';
import {
 isNotionPage,notionPageId,notionSlugTitle,isNotionBoilerplate,parsePublicNotionRecordMap
} from '../lib/notion-public.ts';

const url=new URL('https://sunset-saxophone-cff.notion.site/7-ArtCraft-3f794e235c6281f0a091d48e0434d243?source=copy_link&fbclid=123');
const id='3f794e23-5c62-81f0-a091-d48e0434d243';

test('Notion link identifies a valid public-page id without query tracking',()=>{
 assert.equal(isNotionPage(url),true);
 assert.equal(notionPageId(url),id);
 assert.equal(notionSlugTitle(url),'7 ArtCraft');
 assert.equal(isNotionPage(new URL('https://evil-notion.site.evil.com/fake')),false);
 assert.equal(notionPageId(new URL('https://www.notion.so/home')),null);
});

test('boilerplate is never mistaken for page information',()=>{
 assert.equal(isNotionBoilerplate('Notion | Where teams and agents work together'),true);
 assert.equal(isNotionBoilerplate('Made in Notion, the connected workspace where AI agents and teams organize docs'),true);
 assert.equal(isNotionBoilerplate('7. ArtCraft'),false);
});

test('public block traversal uses genuine page title and document blocks only',()=>{
 const fixture={recordMap:{block:{
  [id]:{value:{id,type:'page',properties:{title:[['7. ArtCraft']]},content:['a','b','c','d']}},
  a:{value:{id:'a',type:'header',properties:{title:[['주요 특징']]},content:[]}},
  b:{value:{id:'b',type:'bulleted_list',properties:{title:[['실제 제공 기능']]},content:[]}},
  c:{value:{id:'c',type:'numbered_list',properties:{title:[['설치하기']]},content:[]}},
  d:{value:{id:'d',type:'page',properties:{title:[['별도 비공개 페이지']]},content:[]}}
 }}};
 const result=parsePublicNotionRecordMap(fixture,id);
 assert.equal(result?.title,'7. ArtCraft');
 assert.match(result?.content_text||'',/주요 특징/);
 assert.match(result?.content_text||'',/• 실제 제공 기능/);
 assert.match(result?.content_text||'',/1. 설치하기/);
 assert.ok(!result?.content_text.includes('별도 비공개 페이지'));
});

test('missing or nonpublic Notion blocks never produce fabricated content',()=>{
 assert.equal(parsePublicNotionRecordMap({recordMap:{block:{}}},id),null);
 assert.equal(parsePublicNotionRecordMap({recordMap:{block:{[id]:{value:{type:'page',properties:{title:[['Notion | Where teams and agents work together']]}}}}}},id),null);
});
