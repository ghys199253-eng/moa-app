import {NextRequest,NextResponse} from 'next/server';
import {serverSupabase} from '@/lib/server';
import {isNotionBoilerplate,isNotionPage,notionSlugTitle,readPublicNotionPage} from '@/lib/notion-public';
import {readFirecrawlPublicPage} from '@/lib/firecrawl-public';
export const runtime='nodejs';

function privateIp(host:string){
 const h=host.toLowerCase().replace(/\.$/,'');
 return h==='localhost'||h.endsWith('.localhost')||h.endsWith('.local')||
 h.endsWith('.internal')||h==='0.0.0.0'||h==='::1'||h.startsWith('127.')||
 h.startsWith('10.')||h.startsWith('192.168.')||h.startsWith('169.254.')||
 h.startsWith('172.')&&Number(h.split('.')[1])>=16&&Number(h.split('.')[1])<=31||
 h.startsWith('100.')||h.startsWith('198.18.')||h.startsWith('198.19.')||
 h.startsWith('224.')||h.startsWith('240.')||h.startsWith('[')||/^\d+$/.test(h);
}
function safeUrl(raw:string){
 const u=new URL(raw);
 if(!['https:','http:'].includes(u.protocol)||u.username||u.password||
 privateIp(u.hostname)||u.hostname.includes(':')||
 /^\d+\.\d+\.\d+\.\d+$/.test(u.hostname)&&privateIp(u.hostname)){
  throw Error('허용되지 않는 주소');
 }
 return u;
}
function decode(s:string){
 return s.replace(/&amp;/g,'&').replace(/&quot;/g,'"')
  .replace(/&#39;|&#x27;/g,"'").replace(/&lt;/g,'<').replace(/&gt;/g,'>');
}
function meta(html:string,key:string){
 const tags=html.match(/<meta\b[^>]*>/gi)||[];
 for(const t of tags){
  const attrs=Object.fromEntries([...t.matchAll(/([\w:-]+)\s*=\s*(["'])(.*?)\2/g)]
   .map(m=>[m[1].toLowerCase(),m[3]]));
  if(attrs.property===key||attrs.name===key)return decode(attrs.content||'');
 }
 return '';
}
async function readHtmlMetadata(target:URL){
 let current=target;
 let response:Response|undefined;
 for(let i=0;i<4;i++){
  response=await fetch(current.toString(),{
   redirect:'manual',
   headers:{'User-Agent':'MOA-LinkPreview/1.0','Accept':'text/html'},
   signal:AbortSignal.timeout(6500),cache:'no-store'
  });
  if([301,302,303,307,308].includes(response.status)){
   const dest=response.headers.get('location');
   if(!dest)throw Error('이동할 주소가 없습니다');
   current=safeUrl(new URL(dest,current).toString());continue;
  }
  break;
 }
 if(!response||!response.ok)throw Error('원본 사이트에서 정보 제공을 제한했습니다');
 if(!(response.headers.get('content-type')||'').includes('text/html'))throw Error('HTML 문서가 아닙니다');
 if(Number(response.headers.get('content-length')||0)>1_500_000)throw Error('페이지가 너무 큽니다');
 const reader=response.body?.getReader();
 let html='',size=0;
 if(reader){
  const decoder=new TextDecoder();
  while(true){
   const {done,value}=await reader.read();
   if(done)break;
   size+=value.length;
   if(size>1_500_000){await reader.cancel();throw Error('페이지가 너무 큽니다')}
   html+=decoder.decode(value,{stream:true});
  }
  html+=decoder.decode();
 }
 const title=meta(html,'og:title')||decode(html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1]?.trim()||'');
 const description=meta(html,'og:description')||meta(html,'description');
 const rawImage=meta(html,'og:image');
 let thumbnail_url='';
 try{if(rawImage)thumbnail_url=new URL(rawImage,current).toString()}catch{}
 return {title:title.slice(0,300),description:description.slice(0,1200),thumbnail_url};
}

export async function POST(req:NextRequest){
 const sb=await serverSupabase();
 if(!(await sb.auth.getUser()).data.user){
  return NextResponse.json({error:'로그인이 필요합니다'},{status:401});
 }
 try{
  const {url}=await req.json();
  if(typeof url!=='string'||!url.trim()||url.length>4096)throw Error('URL을 확인해 주세요');
  const target=safeUrl(url);
  const notion=isNotionPage(target);
  // Read metadata and Notion's public blocks in parallel to keep the preview responsive.
  const [htmlResult,publicPage]=await Promise.all([
   readHtmlMetadata(target)
    .then(data=>({data,error:''}))
    .catch(e=>({data:null,error:e instanceof Error?e.message:'페이지를 열 수 없습니다'})),
   notion?readPublicNotionPage(target):Promise.resolve(null)
  ]);
  const html=htmlResult.data;
  if(!notion){
   if(!html)throw Error(htmlResult.error||'정보 추출 실패');
   return NextResponse.json({...html,extraction_status:'success',content_text:''});
  }

  // Only a real Notion document body counts as extracted data. Firecrawl is an
  // optional, server-only fallback; lack of a key does not block manual entry.
  const firecrawlPage=publicPage?.content_text?null:await readFirecrawlPublicPage(target);
  const pageTitle=html?.title&&!isNotionBoilerplate(html.title)?html.title:'';
  const actualTitle=firecrawlPage?.title||publicPage?.title||pageTitle;
  const title=actualTitle||notionSlugTitle(target);
  const description=firecrawlPage?.description||
    (html?.description&&!isNotionBoilerplate(html.description)?html.description:'');
  const content_text=firecrawlPage?.content_text||publicPage?.content_text||'';
  const verified=Boolean(actualTitle);
  const needsServerKey=!process.env.FIRECRAWL_API_KEY?.trim();
  const warning=firecrawlPage?.content_text
   ?'Firecrawl로 공개 Notion 문서의 실제 내용을 가져왔어요. 표·이미지·하위 페이지 일부는 빠질 수 있으니 저장 전에 원본과 비교해 주세요.'
   :content_text
    ?'Notion 공개 문서 내용을 가져왔어요. 표·이미지·하위 페이지 등 일부는 빠질 수 있으니 저장 전에 원본과 비교해 주세요.'
    :!verified
     ?'Notion 문서 본문에 접근하지 못해 주소에서 임시 제목을 만들었어요. 정확한 제목·내용은 원본에서 확인해 주세요.'+
      (needsServerKey?' Firecrawl 서버 API 키를 설정하면 다시 시도할 수 있어요.':' Firecrawl에서도 본문을 확인하지 못했어요.')
     :'제목은 확인했지만 Notion 상세 본문을 가져오지 못했어요. 원본을 보고 직접 입력해 주세요.';
  return NextResponse.json({
   title,description,thumbnail_url:firecrawlPage?.thumbnail_url||html?.thumbnail_url||'',
   content_text,
   metadata_source:firecrawlPage?'firecrawl':publicPage?'notion_public':verified?'page_metadata':'url_guess',
   extraction_status:content_text?'success':'pending',
   warning
  });
 }catch(e){
  return NextResponse.json({error:e instanceof Error?e.message:'정보 추출 실패',extraction_status:'failed'},{status:422});
 }
}
