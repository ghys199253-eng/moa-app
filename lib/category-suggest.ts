/**
 * Offline, no-cost category suggestions based on the text the user previewed.
 * This function never creates categories or writes to Supabase.
 * Only values already present in the user's categories are eligible.
 */
export type CategoryPreview={
 title?:string|null;
 description?:string|null;
 content_text?:string|null;
};
type CategoryRule={names:readonly string[]; patterns:readonly RegExp[]};
const rules:readonly CategoryRule[]=[
 {names:['AI·업무','AI 활용법','업무'],patterns:[
  /\b(?:ai|chatgpt|gpt|claude|gemini|copilot)\b|인공지능|생성형\s*AI/i,
  /포토샵|프리미어\s*프로?|일러스트레이터|어도비|애프터\s*이펙트|라이트룸|아크로뱃|artcraft/i,
  /오픈\s*소스|open[\s-]?source|소프트웨어|프로그램|앱\s*(?:추천|소개|설치|활용|개발|제작)|웹\s*앱|웹앱/i,
  /코딩|프로그래밍|개발\s*(?:도구|방법|가이드|환경)|웹\s*개발|자동화|업무\s*효율|생산성\s*도구/i,
  /노션|notion|엑셀|스프레드시트|피그마|figma|canva|캔바|github|깃허브/i,
  /프롬프트|prompt|챗봇|ai\s*툴|디지털\s*도구/i
 ]},
 {names:['요리','레시피'],patterns:[
  /레시피|요리\s*(?:법|방법|팁|과정)|조리\s*(?:법|법칙|방법|순서)|만드는\s*법/i,
  /재료\s*(?:준비|손질|분량)|양념장|소스\s*만들기|간장\s*\d|고춧가루/i,
  /볶음밥|김치찌개|된장찌개|파스타|국물\s*요리|반찬\s*만들기|밑반찬|베이킹/i,
  /에어프라이어\s*(?:조리|요리)|오븐\s*(?:요리|조리)|쿠킹/i
 ]},
 {names:['정리·수납'],patterns:[
  /정리\s*정돈|정돈\s*방법|수납\s*(?:법|아이디어|노하우|방법)|공간\s*정리/i,
  /옷장\s*정리|서랍\s*정리|주방\s*정리|냉장고\s*정리|집\s*정리|방\s*정리/i,
  /정리함|수납장|수납함|행거\s*정리|선반\s*정리|물건\s*버리기|미니멀\s*라이프/i,
  /이불\s*정리|침구\s*정리|신발장\s*정리|책상\s*정리/i
 ]},
 {names:['헤어'],patterns:[
  /헤어\s*스타일|머리\s*스타일|헤어\s*컷|헤어\s*컬러|미용실/i,
  /앞머리|단발\s*(?:컷|머리|펌|스타일)|숏컷|레이어드\s*컷|염색\s*(?:약|방법|컬러)/i,
  /펌\s*(?:스타일|종류)|매직\s*스트레이트|헤어\s*드라이|두피\s*관리|모발\s*관리/i,
  /고데기|샴푸\s*추천|트리트먼트|헤어\s*에센스/i
 ]},
 {names:['메이크업'],patterns:[
  /메이크업|화장법|아이\s*메이크업|눈\s*화장|데일리\s*화장/i,
  /파운데이션|립스틱|립\s*틴트|쿠션\s*팩트|아이섀도|아이라이너|마스카라/i,
  /블러셔|컨실러|베이스\s*화장|음영\s*화장|톤업\s*크림/i
 ]},
 {names:['패션·코디'],patterns:[
  /패션|코디|스타일링\s*(?:팁|방법)|착장|ootd/i,
  /옷\s*추천|옷\s*입는\s*법|체형별\s*(?:코디|옷)|룩북|데일리\s*룩/i,
  /가디건|재킷\s*코디|청바지\s*코디|원피스\s*코디|신발\s*코디/i
 ]},
 {names:['건강'],patterns:[
  /건강\s*(?:관리|정보|검진|팁)|질병|증상|질환|병원\s*진료/i,
  /비염|알레르기|감기\s*증상|두통|피부염|습진|불면증|면역력/i,
  /혈압|혈당|콜레스테롤|의약품|영양제|복용\s*방법|약\s*부작용/i,
  /피부\s*건강|수면\s*(?:건강|개선)|건강\s*식단/i
 ]},
 {names:['운동·스트레칭'],patterns:[
  /스트레칭|홈트|근력\s*운동|유산소\s*운동|웨이트\s*트레이닝/i,
  /필라테스|요가\s*(?:동작|자세|수련)|헬스장|러닝|조깅/i,
  /스쿼트|데드리프트|플랭크|운동\s*(?:루틴|자세|방법|프로그램)/i,
  /근육\s*(?:강화|단련)|운동\s*처방|폼롤러/i
 ]},
 {names:['여행·장소','여행'],patterns:[
  /여행|관광|여행지|여행\s*코스|데이트\s*코스|가볼\s*만한\s*곳/i,
  /숙소|호텔|리조트|펜션|캠핑장|글램핑|카라반|온천\s*(?:여행|추천)/i,
  /항공권|기차\s*여행|해외\s*여행|국내\s*여행|여행\s*일정/i,
  /맛집\s*(?:추천|투어)|카페\s*(?:투어|추천)|명소|놀이공원/i
 ]},
 {names:['인테리어'],patterns:[
  /인테리어|리모델링|시공\s*(?:사례|방법|견적)|홈\s*스타일링/i,
  /벽지|바닥재|마루\s*시공|가구\s*배치|조명\s*인테리어/i,
  /공간\s*디자인|거실\s*꾸미기|침실\s*꾸미기|셀프\s*시공/i
 ]},
 {names:['취업·회계'],patterns:[
  /취업|이직|구직|채용|입사\s*준비|면접\s*(?:질문|후기|준비)/i,
  /자기소개서|이력서|포트폴리오\s*(?:작성|준비)|직무\s*역량/i,
  /회계|세무|법인세|부가세|소득세|전표\s*입력|세금\s*계산서/i,
  /재무\s*제표|결산|전산\s*세무|전산\s*회계|원천\s*세/i
 ]},
 {names:['생활·정보','생활정보'],patterns:[
  /생활\s*(?:꿀팁|정보|팁)|집안일|생활\s*상식/i,
  /청소\s*(?:방법|법|팁)|세탁\s*(?:방법|법|팁)|얼룩\s*제거/i,
  /가전\s*(?:사용법|관리법)|가습기\s*(?:관리|청소)|냉장고\s*(?:청소|관리)/i,
  /민원\s*신청|교통\s*정보|지원금\s*신청|생활\s*비용/i
 ]},
 {names:['쇼핑'],patterns:[
  /구매\s*(?:후기|리뷰|추천)|제품\s*(?:추천|리뷰|비교)|쇼핑\s*(?:팁|정보|리스트)/i,
  /할인\s*정보|할인\s*쿠폰|가격\s*비교|가성비\s*제품/i
 ]}
];

function cleaned(value:unknown,max:number){
 return typeof value==='string'?value.toLowerCase().slice(0,max):'';
}

/**
 * Conservative match: strong topical signals + a clear lead over runners-up.
 * If a category is not confidently identifiable, return null.
 */
export function recommendExistingCategory(
 preview:CategoryPreview, existingNames:readonly string[]
):string|null{
 const available=new Map<string,string>();
 for(const name of existingNames){
  if(typeof name==='string'&&name.trim())available.set(name.trim().toLowerCase(),name);
 }
 if(!available.size)return null;
 const fields=[
  {text:cleaned(preview.title,350),weight:4},
  {text:cleaned(preview.description,1800),weight:2},
  {text:cleaned(preview.content_text,9000),weight:1}
 ];
 if(!fields.some(f=>f.text.trim()))return null;
 const scores:{name:string;score:number;titleMatches:number}[]=[];
 for(const rule of rules){
  const name=rule.names.map(n=>available.get(n.toLowerCase())).find(Boolean);
  if(!name)continue;
  let score=0,titleMatches=0;
  for(const pattern of rule.patterns){
   for(let i=0;i<fields.length;i++){
    if(pattern.test(fields[i].text)){
     score+=fields[i].weight;
     if(i===0)titleMatches++;
    }
   }
  }
  if(score>0)scores.push({name,score,titleMatches});
 }
 scores.sort((a,b)=>b.score-a.score||b.titleMatches-a.titleMatches);
 if(!scores.length)return null;
 const top=scores[0],runner=scores[1];
 // A repeated word only in a long page body is not sufficient.
 if(top.score<7)return null;
 if(!top.titleMatches&&top.score<10)return null;
 if(runner&&top.score-runner.score<Math.max(4,Math.ceil(top.score*.25)))return null;
 return top.name;
}
