'use client';
import {useEffect,useMemo,useState} from 'react';
import Link from 'next/link';
import {supabase} from '@/lib/supabase';

type ArchiveRow={title:string;url:string;category:string;content_text:string;source_label?:string};
type ImportReport={added:number;skipped:number;failed:number;errors:string[]};
function normalizedUrl(raw:string){
 const u=new URL(raw.trim());
 if(!['http:','https:'].includes(u.protocol))throw Error('http/https URL이 아닙니다');
 u.hash='';
 for(const key of [...u.searchParams.keys()])if(/^utm_|^(fbclid|gclid|igshid)$/i.test(key))u.searchParams.delete(key);
 u.hostname=u.hostname.toLowerCase();
 if(u.pathname!=='/')u.pathname=u.pathname.replace(/\/$/,'');
 return u.toString();
}
function sourceType(raw:string){
 const h=new URL(raw).hostname.toLowerCase();
 if(h.includes('youtube.com')||h==='youtu.be')return 'YouTube';
 if(h.includes('daum.net'))return 'Daum Cafe';
 if(h.includes('instagram.com'))return 'Instagram';
 if(h.includes('naver.com'))return 'Naver';
 return 'Web';
}
export default function ImportPage(){
 const [userId,setUserId]=useState<string|null>(null);
 const [loading,setLoading]=useState(true);
 const [rows,setRows]=useState<ArchiveRow[]>([]);
 const [filename,setFilename]=useState('');
 const [problem,setProblem]=useState('');
 const [running,setRunning]=useState(false);
 const [progress,setProgress]=useState(0);
 const [report,setReport]=useState<ImportReport|null>(null);
 useEffect(()=>{
  let active=true;
  supabase.auth.getUser().then(({data,error})=>{if(active){setUserId(error?null:data.user?.id||null);setLoading(false)}});
  return()=>{active=false};
 },[]);
 const categories=useMemo(()=>[...new Set(rows.map(x=>x.category))], [rows]);
 async function pick(file?:File){
  setRows([]);setProblem('');setReport(null);setProgress(0);setFilename(file?.name||'');
  if(!file)return;
  try{
   if(file.size>10*1024*1024)throw Error('파일이 너무 큽니다 (최대 10MB)');
   const raw:unknown=JSON.parse(await file.text());
   if(!Array.isArray(raw)||raw.length===0)throw Error('자료 배열이 아닙니다');
   const parsed:ArchiveRow[]=[];const seen=new Set<string>();
   for(let i=0;i<raw.length;i++){
    const v=raw[i];
    if(!v||typeof v!=='object')throw Error(`${i+1}번째 항목 형식 오류`);
    const x=v as Record<string,unknown>;
    for(const field of ['title','url','category','content_text']){
     if(typeof x[field]!=='string'||!(x[field] as string).trim())throw Error(`${i+1}번째 항목의 ${field} 누락`);
    }
    const url=String(x.url).trim(),norm=normalizedUrl(url);
    if(url.length>4096)throw Error(`${i+1}번째 URL 길이 초과`);
    if(seen.has(norm))throw Error(`${i+1}번째 항목에 파일 내부 중복 URL이 있습니다`);
    seen.add(norm);
    parsed.push({title:String(x.title).trim(),url,category:String(x.category).trim(),content_text:String(x.content_text),source_label:typeof x.source_label==='string'?x.source_label:''});
   }
   setRows(parsed);
  }catch(e){setProblem(e instanceof Error?e.message:'파일 분석 실패')}
 }
 async function importRows(){
  if(!userId||!rows.length||running)return;
  if(!window.confirm(`${rows.length}개 자료를 현재 로그인 계정에 가져올까요? 기존 자료는 덮어쓰지 않습니다.`))return;
  setRunning(true);setProblem('');setReport(null);setProgress(0);
  const result:ImportReport={added:0,skipped:0,failed:0,errors:[]};
  try{
   // Resolve all categories without changing existing category rows.
   const categoryIds=new Map<string,string>();
   for(const name of categories){
    const {data,error}=await supabase.from('categories').upsert({user_id:userId,name},{onConflict:'user_id,name'}).select('id').single();
    if(error||!data?.id)throw Error(`카테고리 "${name}" 생성 실패: ${error?.message||'ID 없음'}`);
    categoryIds.set(name,data.id);
   }
   // One-row inserts make reruns safe; unique(user_id,normalized_url) protects against races.
   for(let i=0;i<rows.length;i++){
    const r=rows[i];const norm=normalizedUrl(r.url);
    const {data:existing,error:checkError}=await supabase.from('bookmarks').select('id').eq('user_id',userId).eq('normalized_url',norm).limit(1);
    if(checkError){result.failed++;result.errors.push(`${i+1}. 중복 확인 실패: ${checkError.message}`)}
    else if(existing&&existing.length){result.skipped++}
    else{
     const {error}=await supabase.from('bookmarks').insert({
      user_id:userId,url:r.url,normalized_url:norm,title:r.title,
      description:'',content_text:r.content_text,personal_memo:'',
      source_type:sourceType(r.url),category_id:categoryIds.get(r.category),
      extraction_status:'pending'
     });
     if(error){
      if(error.code==='23505')result.skipped++;
      else{result.failed++;result.errors.push(`${i+1}. ${r.title}: ${error.message}`)}
     }else result.added++;
    }
    setProgress(i+1);
   }
   setReport(result);
  }catch(e){setProblem(e instanceof Error?e.message:'가져오기 실패');setReport(result)}
  finally{setRunning(false)}
 }
 return <main style={{maxWidth:760,margin:'40px auto',padding:'0 20px',fontFamily:'sans-serif',lineHeight:1.65}}>
  <Link href="/">← MOA 홈으로</Link>
  <h1>정보아카이브 가져오기</h1>
  <p>기존 자료를 덮어쓰지 않고 새 항목만 저장합니다. 원본의 카테고리와 상세 내용을 보존하며 AI 자동 분류는 실행하지 않습니다.</p>
  {loading?<p>로그인 확인 중...</p>:!userId?<p>먼저 <Link href="/">MOA에 로그인</Link>해 주세요.</p>:<>
   <label style={{display:'block',padding:'20px',border:'1px solid #aaa',borderRadius:10}}>
    정보아카이브 JSON 파일 선택
    <input type="file" accept=".json,application/json" disabled={running} onChange={e=>void pick(e.target.files?.[0])} style={{display:'block',marginTop:12,maxWidth:'100%'}}/>
   </label>
   {filename&&<p>선택한 파일: {filename}</p>}
   {rows.length>0&&<section style={{padding:16,border:'1px solid #ddd',borderRadius:10,marginTop:16}}>
    <strong>검증 완료: {rows.length}개 항목 / {categories.length}개 카테고리</strong>
    <p>{categories.join(' · ')}</p>
    <p>파일 내 URL 중복 없음 · 필수 정보 확인 완료</p>
    <button type="button" disabled={running} onClick={()=>void importRows()} style={{padding:'12px 20px',cursor:running?'wait':'pointer'}}>
     {running?'가져오는 중...':'중복 건너뛰고 가져오기'}
    </button>
   </section>}
   {running&&<p role="status">처리 중: {progress} / {rows.length}</p>}
   {problem&&<p role="alert" style={{color:'#b42318'}}>오류: {problem}</p>}
   {report&&<section style={{marginTop:20}}>
    <h2>가져오기 결과</h2>
    <p>새로 저장 {report.added}개 · 기존 중복 건너뜀 {report.skipped}개 · 실패 {report.failed}개</p>
    {report.errors.length>0&&<details><summary>실패 내역 확인</summary><pre style={{whiteSpace:'pre-wrap'}}>{report.errors.join('\n')}</pre></details>}
    <p><Link href="/">MOA 홈에서 저장된 자료 확인하기</Link></p>
   </section>}
  </>}
 </main>;
}
