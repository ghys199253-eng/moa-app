import test from 'node:test';
import assert from 'node:assert/strict';
import {recommendExistingCategory} from '../lib/category-suggest.ts';

const existing=[
 'AI·업무','건강','기타','메이크업','생활·정보','여행·장소',
 '요리','운동·스트레칭','인테리어','정리·수납','취업·회계',
 '패션·코디','헤어'
];

test('ArtCraft public Notion tutorial selects the existing AI·업무 category',()=>{
 const category=recommendExistingCategory({
  title:'포토샵·프리미어가 공짜? — 무료 오픈소스 어도비 대체 앱 7종(ArtCraft) 설치 가이드',
  description:'개발자가 Claude 도움을 받아 포토샵과 프리미어 프로를 대신할 무료 오픈소스 앱을 만들었어요.',
  content_text:'설치 방법: 오픈소스 프로그램 다운로드 후 이미지 편집을 시작할 수 있습니다.'
 },existing);
 assert.equal(category,'AI·업무');
});

test('existing categories only; never invents defaults such as AI 활용법 or 레시피',()=>{
 assert.equal(recommendExistingCategory({title:'포토샵 대체 오픈소스 앱 사용법'},['건강','요리']),null);
 assert.equal(recommendExistingCategory({title:'포토샵 대체 오픈소스 앱 사용법'},['AI 활용법']),'AI 활용법');
 assert.equal(recommendExistingCategory({title:'파스타 레시피 만드는 법'},['요리','기타']),'요리');
 assert.equal(recommendExistingCategory({title:'파스타 레시피 만드는 법'},[]),null);
});

test('concrete cooking, organizing, accounting and travel examples choose correct category',()=>{
 assert.equal(recommendExistingCategory({title:'에어프라이어 요리 레시피: 김치찌개 만드는 법'},existing),'요리');
 assert.equal(recommendExistingCategory({title:'옷장 정리 정돈과 수납함 활용 방법'},existing),'정리·수납');
 assert.equal(recommendExistingCategory({title:'법인세 및 부가세 신고를 위한 세무 회계 자료'},existing),'취업·회계');
 assert.equal(recommendExistingCategory({title:'강원도 여행 숙소 호텔과 관광 명소 추천'},existing),'여행·장소');
});

test('makeup, hair, workouts and household tips do not become generic AI·업무',()=>{
 assert.equal(recommendExistingCategory({title:'봄철 립스틱 파운데이션 메이크업과 눈 화장법'},existing),'메이크업');
 assert.equal(recommendExistingCategory({title:'레이어드 컷 앞머리 헤어 스타일 미용실 추천'},existing),'헤어');
 assert.equal(recommendExistingCategory({title:'하루 10분 스트레칭 홈트 근력 운동 루틴'},existing),'운동·스트레칭');
 assert.equal(recommendExistingCategory({title:'냉장고 청소 방법과 세탁 얼룩 제거 생활 꿀팁'},existing),'생활·정보');
});

test('ambiguous or insufficient content remains unselected',()=>{
 assert.equal(recommendExistingCategory({title:'오늘 본 재미있는 링크',description:'사진 몇 장이 있는 글입니다.'},existing),null);
 assert.equal(recommendExistingCategory({title:'강원도 여행 중 건강 관리',description:'누구나 알아두면 좋은 내용입니다.'},existing),null);
 assert.equal(recommendExistingCategory({title:'',description:'',content_text:''},existing),null);
 assert.equal(recommendExistingCategory({title:'AI 자동화 코딩 프로그램'},['기타']),null);
 assert.equal(recommendExistingCategory({title:'관련 내용 없음',content_text:'앱'},existing),null);
});

test('does not infer categories from source alone',()=>{
 assert.equal(recommendExistingCategory({title:'제목을 찾을 수 없음',description:'',content_text:''},existing),null);
 assert.equal(recommendExistingCategory({title:'',description:'공개 게시물이에요.'},existing),null);
});
