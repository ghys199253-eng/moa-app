import test from 'node:test';
import assert from 'node:assert/strict';
import {auditContent} from '../lib/content-review.ts';
import {structureContent} from '../lib/content-format.ts';
function contentStructureSummary(raw,recipe=false){const sections=structureContent(raw,recipe);return {sections:sections.length,paragraphs:sections.flatMap(s=>s.entries).filter(e=>e.type==='paragraph').length,bullets:sections.flatMap(s=>s.entries).filter(e=>e.type==='bullet').length,steps:sections.flatMap(s=>s.entries).filter(e=>e.type==='step').length};}

test('reading checks are non-destructive and identify concrete problematic lines',()=>{
 const raw=['핵심 내용','• 같은 문장을 반복해서 보관했는데 원본을 확인해야 합니다.',
 '• 같은 문장을 반복해서 보관했는데 원본을 확인해야 합니다.','','만드는 방법',
 '6. 1. 첫 번째 조리 과정','7. 2. 두 번째 조리 과정','• • 두 개의 기호','•',
 '>> 인식 오류'].join('\n');
 const copy=raw;
 const codes=auditContent(raw).map(x=>x.code);
 assert.deepEqual(codes,['duplicate','double-number','double-bullet','empty-marker','transcript']);
 assert.equal(raw,copy);
});

test('all seven archive categories use safe display rules',()=>{
 const cases=[
  ['인테리어','핵심 내용\n• 공간 구획\n\n실행·방법\n1. 가구 위치를 정한다.\n2. 동선을 확인한다.'],
  ['정리·수납','영상 설명\n• 정리 습관\n\n핵심 내용\n• 서랍 정리'],
  ['요리','재료·준비물\n• 쌀\n• 물\n\n만드는 방법\n1. 재료를 준비한다.\n2. 조리한다.'],
  ['헤어','핵심 내용\n• 모발 관리\n\n실행·방법\n1. 머리를 말린다.\n2. 가볍게 정리한다.'],
  ['AI·업무','영상 설명\n내용을 설명한다.\n\n핵심 내용\n• 첫 번째 주제'],
  ['생활·정보','부동산 검색 사이트\n• 예시 사이트\n\n집 보러 갈 때 필수 체크사항\n• 항목 확인'],
  ['메이크업','핵심 내용\n• 화장 도구\n\n팁·포인트\n• 적당량 사용']
 ];
 for(const [category,raw] of cases){
  const r=contentStructureSummary(raw,category==='요리');
  assert.ok(r.sections>=2,category+' section');
  assert.ok(r.bullets>=1,category+' bullets');
  assert.equal(auditContent(raw).length,0,category+' warnings');
 }
});

test('plain paragraph breaks are retained and list-only decorations are removed',()=>{
 const raw='상세 내용\n첫 문단입니다.\n\n둘째 문단입니다.\n•\n• 항목';
 const summary=contentStructureSummary(raw);
 assert.equal(summary.paragraphs,2);
 assert.equal(summary.bullets,1);
 assert.deepEqual(auditContent(raw).map(x=>x.code),['empty-marker']);
});
