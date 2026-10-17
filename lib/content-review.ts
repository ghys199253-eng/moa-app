import {structureContent} from './content-format';

export type ContentIssue={
  code:'duplicate'|'double-number'|'double-bullet'|'transcript'|'long-line'|'empty-marker'|'empty-content';
  label:string;
  detail:string;
  lines:number[];
};

function cleaned(line:string){
  return line.trim().replace(/^(?:[•●✓✔*+-]\s*)+/,'').replace(/^\d{1,2}[.)]\s*/,'').replace(/\s+/g,' ').trim();
}

export function auditContent(raw:string):ContentIssue[]{
  const lines=raw.replace(/\r\n?/g,'\n').split('\n');
  const issues:ContentIssue[]=[];
  if(!raw.trim())return [{code:'empty-content',label:'상세 내용 없음',detail:'링크만 저장하면 본문을 검색하거나 확인하기 어려워요.',lines:[]}];
  const seen=new Map<string,number>();
  const duplicates:number[]=[];
  lines.forEach((line,index)=>{
    const s=cleaned(line);
    if(s.length<25)return;
    const first=seen.get(s);
    if(first!==undefined){duplicates.push(first+1,index+1)}else seen.set(s,index);
  });
  if(duplicates.length)issues.push({code:'duplicate',label:'반복 문장',detail:'같은 문장이 여러 곳에 있어요. 강조·인용일 수 있으니 원문과 비교한 뒤 정리하세요.',lines:[...new Set(duplicates)].sort((a,b)=>a-b)});
  const doubles=lines.flatMap((s,i)=>/^\s*\d{1,2}[.)]\s+(?:\d{1,2}[.)]|[➊-➓①-⑩])\s*/.test(s)?[i+1]:[]);
  if(doubles.length)issues.push({code:'double-number',label:'중복된 순서 번호',detail:'단계 번호가 겹쳐 있어요. 표시 단계와 실제 원본 순서를 비교하세요.',lines:doubles});
  const bullets=lines.flatMap((s,i)=>/^\s*[•●✓✔*-]\s+[•●✓✔*-]\s*/.test(s)?[i+1]:[]);
  if(bullets.length)issues.push({code:'double-bullet',label:'겹친 글머리기호',detail:'중복된 글머리기호는 읽기 화면에서는 하나로 표시해요.',lines:bullets});
  const orphans=lines.flatMap((s,i)=>/^\s*[•●✓✔*+-]\s*$/.test(s)?[i+1]:[]);
  if(orphans.length)issues.push({code:'empty-marker',label:'빈 글머리기호',detail:'내용 없는 기호는 읽기 화면에서 표시하지 않아요.',lines:orphans});
  const invalid=lines.flatMap((s,i)=>/>>|unk>|ለ|￼|\[음악\]/.test(s)?[i+1]:[]);
  if(invalid.length)issues.push({code:'transcript',label:'음성·문자 변환 확인',detail:'자동 전사나 문자 인식 결과로 의심되는 부분이 있어요. 원본 없이 의미를 임의로 바꾸지 않아요.',lines:invalid});
  const long=lines.flatMap((s,i)=>s.trim().length>230?[i+1]:[]);
  if(long.length)issues.push({code:'long-line',label:'긴 문장',detail:'긴 음성 기록 또는 문단일 수 있어요. 원래 의미와 문단 구분을 확인하세요.',lines:long});
  return issues;
}

export function contentStructureSummary(raw:string,recipe=false){
 const blocks=structureContent(raw,recipe);
 return {sections:blocks.length,paragraphs:blocks.reduce((n,b)=>n+b.entries.filter(e=>e.type==='paragraph').length,0),bullets:blocks.reduce((n,b)=>n+b.entries.filter(e=>e.type==='bullet').length,0),steps:blocks.reduce((n,b)=>n+b.entries.filter(e=>e.type==='step').length,0)};
}
