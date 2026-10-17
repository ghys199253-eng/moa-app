import {NextRequest,NextResponse} from 'next/server';
import {serverSupabase} from '@/lib/server';
export async function POST(req:NextRequest){
 const sb=await serverSupabase();const {data:{user}}=await sb.auth.getUser();if(!user)return NextResponse.json({error:'로그인이 필요합니다'},{status:401});
 if(!process.env.OPENAI_API_KEY)return NextResponse.json({error:'AI 요약을 사용하려면 Vercel에 OPENAI_API_KEY 설정이 필요합니다.'},{status:503});
 try{const {id,mode}=await req.json();if(!['classify','summarize'].includes(mode)||typeof id!=='string')throw Error('요청 오류');
 const {data:b,error}=await sb.from('bookmarks').select('*').eq('id',id).eq('user_id',user.id).single();if(error||!b)return NextResponse.json({error:'저장 정보를 찾을 수 없습니다'},{status:404});
 const content=[b.title,b.description,b.personal_memo,b.content_text].filter(Boolean).join('\n').slice(0,8000);
 if(!content.trim())return NextResponse.json({error:'분석할 텍스트가 없습니다'},{status:422});
 const prompt=mode==='classify'?'Return ONLY JSON: {"category":"one of 레시피,AI 활용법,생활정보,여행,쇼핑,업무,기타","tags":["up to 4 Korean short tags"]}. Categorize only the supplied text.':'Return ONLY JSON: {"summary":"A concise Korean summary based strictly on supplied text. Clearly state when only title/description/memo are available; never pretend to have read the linked page or watched the video."}';
 const res=await fetch('https://api.openai.com/v1/chat/completions',{method:'POST',headers:{'Authorization':`Bearer ${process.env.OPENAI_API_KEY}`,'Content-Type':'application/json'},body:JSON.stringify({model:process.env.OPENAI_MODEL||'gpt-4.1-mini',temperature:0.2,response_format:{type:'json_object'},messages:[{role:'system',content:prompt},{role:'user',content:content}]})});if(!res.ok){const err=await res.json().catch(()=>null);const code=err?.error?.code;throw Error(res.status===401?'OpenAI API 키가 유효하지 않습니다':res.status===429?'OpenAI API 사용량 한도 또는 결제 설정을 확인해 주세요':`AI 서비스 오류 (HTTP ${res.status}${code?`, ${code}`:''})`)}const j=await res.json();const parsed=JSON.parse(j.choices?.[0]?.message?.content||'{}');
 if(mode==='summarize'){const summary=String(parsed.summary||'').slice(0,2000);if(!summary.trim())throw Error('AI 요약 결과가 비어 있습니다');const {error:saveError}=await sb.from('bookmarks').update({ai_summary:summary}).eq('id',id).eq('user_id',user.id);if(saveError)throw Error('요약 저장 실패: '+saveError.message);return NextResponse.json({summary})}
 const allowed=['레시피','AI 활용법','생활정보','여행','쇼핑','업무','기타'];const category=allowed.includes(parsed.category)?parsed.category:'기타';const tags=Array.isArray(parsed.tags)?parsed.tags.filter((t:unknown)=>typeof t==='string').slice(0,4).map((t:string)=>t.slice(0,30)):[];
 const {data:existing}=await sb.from('categories').select('id').eq('user_id',user.id).eq('name',category).maybeSingle();let categoryId=existing?.id;if(!categoryId){const {data:newCat}=await sb.from('categories').upsert({user_id:user.id,name:category},{onConflict:'user_id,name'}).select('id').single();categoryId=newCat?.id}if(categoryId)await sb.from('bookmarks').update({category_id:categoryId}).eq('id',id).eq('user_id',user.id);
 for(const tag of tags){const {data:t}=await sb.from('tags').upsert({user_id:user.id,name:tag},{onConflict:'user_id,name'}).select('id').single();if(t)await sb.from('bookmark_tags').upsert({user_id:user.id,bookmark_id:id,tag_id:t.id},{onConflict:'bookmark_id,tag_id'})}
 return NextResponse.json({category,tags});
 }catch(e){return NextResponse.json({error:e instanceof Error?e.message:'AI 처리 실패'},{status:500})}
}
