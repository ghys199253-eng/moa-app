import test from 'node:test';
import assert from 'node:assert/strict';
import {structureContent} from '../lib/content-format.ts';

test('recipe headings, nested headings, lists and tips are distinct',()=>{
 const raw=['재료·준비물 (밥 2공기 기준)','[밥]','• 밥 2공기','• 참치 1캔','','[겉면 양념]','• 간장 1T','','만드는 방법','1. 재료를 섞는다.','2. 주먹밥을 굽는다.','','분량·팁','• 밥 2공기 기준 약 5개.','• 아침에 2개 먹는다.'].join('\n');
 const sections=structureContent(raw,true);
 assert.deepEqual(sections.map(x=>x.heading),['재료·준비물 (밥 2공기 기준)','만드는 방법','분량·팁']);
 assert.deepEqual(sections[0].entries.filter(x=>x.type==='subheading').map(x=>x.text),['밥','겉면 양념']);
 assert.equal(sections[1].entries.filter(x=>x.type==='step').length,2);
 assert.equal(sections[2].entries.filter(x=>x.type==='bullet').length,2);
});
test('double markers and orphan markers never create empty bullets',()=>{
 const sections=structureContent('핵심 내용\n• • 첫 번째\n•\n• 두 번째');
 assert.deepEqual(sections[0].entries.filter(x=>x.type==='bullet').map(x=>x.text),['첫 번째','두 번째']);
});
test('genuine nested cooking sequence beats numbered promo copy',()=>{
 const raw='만드는 방법\n1. 맛있어서 또 만들었어요.\n2. 꼭 저장하세요.\n3. ➊ 파를 볶아요.\n4. ➋ 물을 넣어요.';
 const section=structureContent(raw,true)[0];
 assert.deepEqual(section.entries.filter(x=>x.type==='step').map(x=>x.text),['파를 볶아요.','물을 넣어요.']);
 assert.deepEqual(section.entries.filter(x=>x.type==='paragraph').map(x=>x.text),['맛있어서 또 만들었어요.','꼭 저장하세요.']);
});
test('long transcript chunks are not mislabeled as numbered instructions',()=>{
 const speech='영상 음성 인식 기록이 길게 이어지는 상황을 나타내는 문장입니다. '.repeat(6);
 const section=structureContent('실행·방법\n1. '+speech+'\n2. '+speech+'\n3. '+speech)[0];
 assert.equal(section.entries.filter(x=>x.type==='step').length,0);
 assert.equal(section.entries.filter(x=>x.type==='paragraph').length,3);
});
test('plain text and original paragraph breaks are preserved',()=>{
 const section=structureContent('상세 내용\n첫 번째 문단입니다.\n\n두 번째 문단입니다.')[0];
 assert.deepEqual(section.entries.map(x=>x.type),['paragraph','gap','paragraph']);
});

test('unlisted heading names are sections even without blank lines',()=>{
 const raw='부동산 검색 사이트\n• 네이버 부동산\n• 직방\n집 보러 갈 때 필수 체크사항\n• 전입신고 가능 여부\n• 보증보험 확인';
 const sections=structureContent(raw);
 assert.deepEqual(sections.map(x=>x.heading),['부동산 검색 사이트','집 보러 갈 때 필수 체크사항']);
 assert.equal(sections[0].entries.filter(x=>x.type==='bullet').length,2);
 assert.equal(sections[1].entries.filter(x=>x.type==='bullet').length,2);
});
