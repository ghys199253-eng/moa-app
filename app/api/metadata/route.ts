import {NextRequest,NextResponse} from 'next/server';
import {serverSupabase} from '@/lib/server';
import {isNotionBoilerplate,isNotionPage,notionSlugTitle,readPublicNotionPage} from '@/lib/notion-public';
import {canSendPublicUrlToFirecrawl,readFirecrawlPublicPage} from '@/lib/firecrawl-public';
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

  // First try the original website and its public Notion blocks. This only
  // reads previews and never creates or updates database rows.
  const [htmlResult,publicPage]=await Promise.all([
   readHtmlMetadata(target)
    .then(data=>({data,error:''}))
    .catch(e=>({data:null,error:e instanceof Error?e.message:'사이트에 접근할 수 없습니다'})),
   notion?readPublicNotionPage(target):Promise.resolve(null)
  ]);
  const html=htmlResult.data;
  const notionBody=publicPage?.content_text||'';

  // Non-Notion HTML previews have title/description but no verified body.
  // One on-demand Firecrawl request is permitted when the real body is absent.
  const firecrawlPage=notionBody?null:await readFirecrawlPublicPage(target);
  const content_text=firecrawlPage?.content_text||notionBody;
  const rawHtmlTitle=html?.title||'';
  const htmlTitle=notion&&isNotionBoilerplate(rawHtmlTitle)?'':rawHtmlTitle;
  const rawHtmlDescription=html?.description||'';
  const htmlDescription=notion&&isNotionBoilerplate(rawHtmlDescription)?'':rawHtmlDescription;
  const title=firecrawlPage?.title||publicPage?.title||htmlTitle||
   (notion?notionSlugTitle(target):'');
  const description=firecrawlPage?.description||htmlDescription;
  const thumbnail_url=firecrawlPage?.thumbnail_url||html?.thumbnail_url||'';
  const verifiedBody=Boolean(content_text.trim());
  const configured=Boolean(process.env.FIRECRAWL_API_KEY?.trim());
  const excluded=!canSendPublicUrlToFirecrawl(target);

  let warning='';
  if(verifiedBody){
   warning=firecrawlPage
    ?'Firecrawl로 공개 웹페이지 본문을 가져왔어요. 일부 표·이미지·댓글·하위 페이지는 빠질 수 있으니 저장 전에 원본과 비교해 주세요.'
    :'Notion 공개 문서 본문을 가져왔어요. 일부 표·이미지·하위 페이지는 빠질 수 있으니 저장 전에 원본과 비교해 주세요.';
  }else if(title||description){
   warning='제목·설명만 확인했어요. 실제 상세 본문은 아직 가져오지 못했습니다. 공개 글인지 확인하고 원본을 보며 입력해 주세요.';
  }else if(notion){
   warning='Notion 본문에 접근하지 못해 주소에서 임시 제목만 만들었어요. 저장 전 원본에서 정확한 제목과 내용을 확인해 주세요.';
  }else{
   warning='사이트에서 제목과 본문을 가져오지 못했어요. 공개 링크인지 확인하고 직접 입력해 주세요.';
  }
  if(!verifiedBody){
   if(excluded)warning+=' 개인 인증정보가 포함되었거나 제한된 주소여서 외부 추출 서비스에는 전달하지 않았어요.';
   else if(!configured)warning+=' Firecrawl 서버 API 키가 설정되면 추가 추출을 시도할 수 있어요.';
   else warning+=' 일부 사이트(인스타그램·회원 전용 카페 등)는 로그인이나 접근 제한으로 자동 추출이 불가능할 수 있어요.';
  }
  return NextResponse.json({
   title:title.slice(0,300),description:description.slice(0,1200),thumbnail_url,
   content_text,metadata_source:firecrawlPage?'firecrawl':notionBody?'notion_public':html?'page_metadata':notion?'url_guess':'none',
   extraction_status:verifiedBody?'success':'pending',
   warning
  });
 }catch(e){
  return NextResponse.json({
   error:e instanceof Error?e.message:'정보 추출 실패',extraction_status:'failed'
  },{status:422});
 }
}
