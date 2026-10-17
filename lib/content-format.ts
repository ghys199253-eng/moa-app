export type ContentEntry={
  type:'paragraph'|'bullet'|'step'|'subheading'|'gap';
  text:string;
  number?:number;
  nested?:boolean;
};
export type ContentSection={heading:string;entries:ContentEntry[];lines:string[];index:number;implicit:boolean};

const known=/^(?:영상 설명|핵심 내용|핵심 요약|요약|상세 내용|재료(?:[·／/][^\n]{1,22})?|준비물|재료 준비|만드는 방법|조리 방법|조리 순서|실행[·/\s]*방법|실행·방법|활용 방법|활용 사례|사용 방법|방법|정리|설명|특징|분량[·/\s]*팁|팁(?:[·/\s]*(?:주의|포인트))?|주의사항|확인 필요|중요 팁|핵심 팁|제품 정보|후기 요약|공부 방법|학습 방법|학습 계획|오답노트|시험 정보|합격 후기|준비 과정|추천 자료|Q&A|Q＆A|질문과 답변|자주 묻는 질문|생활비 절감|고정비 절감|여가·구독|기타|맛·매운 정도|덜 맵게 먹는 방법)(?:\s*\([^)\n]{1,36}\))?$/;
const marker=/^(?:[-•●✔✓+*]\s*)+/;
const numeric=/^(\d{1,2})[.)]\s+(.+)$/;
const circled=/^([➊➋➌➍➎➏➐➑➒➓①②③④⑤⑥⑦⑧⑨⑩])\s*(.+)$/;
const numeral='➊➋➌➍➎➏➐➑➒➓①②③④⑤⑥⑦⑧⑨⑩';

function headingOf(line:string,next:string,afterBlank:boolean,atStart:boolean){
 const bare=line.replace(marker,'').trim();
 if(!bare)return null;
 const markdown=bare.match(/^#{1,4}\s+(.{2,42})$/)||bare.match(/^\*\*(.{2,42})\*\*$/);
 if(markdown)return {title:markdown[1].trim(),sub:false};
 const square=bare.match(/^\[([^\[\]\n]{1,28})\]$/);
 if(square)return {title:square[1],sub:true};
 if(known.test(bare))return {title:bare,sub:false};
 const nextIsList=/^(?:[-•●✔✓+*]\s+\S|\d{1,2}[.)]\s+\S|[➊-➓①-⑩]\s*\S)/.test(next);
 const looksTitle=!marker.test(line)&&bare.length>=2&&bare.length<=32&&!/[.!?。]$/.test(bare)&&!/^[-•●✔✓+*\d]/.test(bare)&&!bare.includes('://')&&!bare.includes('>>')&&!/[,，;]/.test(bare)&&!/\s{2}/.test(bare);
 if(looksTitle&&(atStart||afterBlank)&&nextIsList)return {title:bare.replace(/[：:]$/,''),sub:false};
 return null;
}

function parseLine(raw:string):ContentEntry|null{
 const line=raw.trim();
 if(!line)return {type:'gap',text:''};
 if(/^[-•●✔✓+*]+$/.test(line))return null;
 const marked=marker.test(line);
 let text=marked?line.replace(marker,'').trim():line;
 if(!text)return null;
 const n=text.match(numeric)||text.match(circled);
 if(n){
  const num=/^\d+$/.test(n[1])?Number(n[1]):numeral.indexOf(n[1])%10+1;
  text=n[2].trim();
  const inner=text.match(numeric)||text.match(circled);
  if(inner){
   return {type:'step',text:inner[2].trim(),number:/^\d+$/.test(inner[1])?Number(inner[1]):numeral.indexOf(inner[1])%10+1,nested:true};
  }
  return {type:'step',text,number:num};
 }
 // Long transcribed speech is prose, not an actionable list item.
 return {type:marked&&text.length<=175?'bullet':'paragraph',text};
}

function normalizeSteps(entries:ContentEntry[]){
 const runs:{start:number;end:number;score:number}[]=[];
 for(let i=0;i<entries.length;i++){
  if(entries[i].type!=='step')continue;
  let j=i,prev=entries[i].number||0;
  while(j+1<entries.length&&entries[j+1].type==='step'&&entries[j+1].number===prev+1&&entries[j+1].text.length<=125){j++;prev++}
  if(j>i){
   const slice=entries.slice(i,j+1);
   const long=slice.filter(x=>x.text.length>125).length;
   if(!long)runs.push({start:i,end:j,score:(j-i+1)*10+(slice[0].number===1?3:0)+(slice.some(x=>x.nested)?100:0)});
  }
 }
 const best=runs.sort((a,b)=>b.score-a.score||b.start-a.start)[0];
 for(let i=0;i<entries.length;i++){
  const e=entries[i];
  if(e.type!=='step')continue;
  const genuine=!!best&&i>=best.start&&i<=best.end&&e.text.length<=125;
  if(!genuine){
   e.type='paragraph';
   // The raw prefix is retained in edit mode; long transcript fragments are shown as prose.
   delete e.number;
  }
 }
}

export function structureContent(raw:string,recipe=false):ContentSection[]{
 const lines=raw.replace(/\r\n?/g,'\n').replace(/\u00a0/g,' ').split('\n');
 const sections:ContentSection[]=[];
 let section:ContentSection={heading:recipe?'레시피 내용':'상세 내용',entries:[],lines:[],index:0,implicit:true};
 const flush=()=>{
  while(section.entries.at(-1)?.type==='gap')section.entries.pop();
  if(section.entries.some(x=>x.type!=='gap')){
   section.index=sections.length;
   normalizeSteps(section.entries);
   sections.push(section);
  }
 };
 let afterBlank=true;
 for(let i=0;i<lines.length;i++){
  const rawLine=lines[i].trim();
  if(!rawLine){
   if(section.entries.length&&section.entries.at(-1)?.type!=='gap')section.entries.push({type:'gap',text:''});
   afterBlank=true;continue;
  }
  const next=lines.slice(i+1).find(x=>x.trim())?.trim()||'';
  const previousType=section.entries.at(-1)?.type;
  const header=headingOf(rawLine,next,afterBlank||previousType==='bullet'||previousType==='step',section.entries.length===0&&sections.length===0);
  if(header){
   if(header.sub){
    section.entries.push({type:'subheading',text:header.title});
   }else{
    flush();
    section={heading:header.title,entries:[],lines:[],index:sections.length,implicit:false};
   }
   afterBlank=false;continue;
  }
  const parsed=parseLine(rawLine);
  if(parsed){
   section.entries.push(parsed);
   section.lines.push(rawLine);
  }
  afterBlank=false;
 }
 flush();
 return sections;
}
