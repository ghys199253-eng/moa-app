/**
 * Optional, server-only Firecrawl fallback for public web pages.
 * Never saves a link, bypasses a login, or exposes the API key to the browser.
 */
export type FirecrawlPagePreview={
 title:string;
 description:string;
 content_text:string;
 thumbnail_url:string;
};

type FirecrawlDocument={markdown?:unknown;metadata?:Record<string,unknown>};
const cache=new Map<string,{expires:number;page:FirecrawlPagePreview}>();
const CACHE_MS=10*60*1000;
const SENSITIVE_PARAMS=/^(?:access_?token|auth(?:orization)?|bearer|code|id_?token|jwt|key|api_?key|oauth(?:_token)?|password|pass|secret|session(?:_id)?|sig(?:nature)?|token)$/i;
const GENERIC_TITLES=/^(?:(?:notion|instagram|facebook|daum\s*카페|naver|네이버|youtube|로그인|sign[\s-]?in|log[\s-]?in|login|access denied|403 forbidden)(?:\s*[|–—·•:-]\s*(?:home|login|sign[\s-]?in|log[\s-]?in|로그인|where teams.*|the connected workspace.*|welcome.*|.*photos and videos))?)$/i;
const LOGIN_WALL=/\b(?:log in to (?:view|see|continue|access)|sign in to (?:view|see|continue|access)|you must be logged in|members only|this content (?:isn't|is not) available|page not found|access denied|private account|sorry, this page isn't available)\b|(?:로그인(?:이|을)? (?:필요|해야)|회원(?:만|에게만) (?:공개|보여)|카페 회원만|비공개 (?:게시물|게시글|계정)|권한이 없습니다|접근할 수 없습니다|게시물을 볼 수 없습니다)/i;

function stringField(v:unknown){return typeof v==='string'?v.trim():''}
function genericTitle(value:string){
 const s=value.trim().replace(/\s+/g,' ');
 return !s||GENERIC_TITLES.test(s)||
  /^made in notion\b/i.test(s)||
  /(?:the connected workspace where ai agents|teams and agents work together|write, plan, share)/i.test(s);
}
function cleanMarkdown(raw:string){
 return raw.replace(/^\uFEFF/,'')
  .replace(/^\[Skip to content\]\([^\n]+\)\s*/i,'')
  .replace(/!\[[^\]\n]*\]\(<Base64-Image-Removed>\)/g,'')
  .replace(/\{\{\s*message\s*\}\}/gi,'')
  .replace(/\r\n?/g,'\n')
  .replace(/\n{3,}/g,'\n\n').trim();
}
/**
 * Empty or blocked pages are NOT successful extraction even when the HTTP
 * request succeeded. Excludes typical menus, placeholders, login walls.
 */
export function parseFirecrawlPublicPage(payload:unknown):FirecrawlPagePreview|null{
 if(!payload||typeof payload!=='object')return null;
 const envelope=payload as {success?:unknown;data?:unknown};
 if(envelope.success===false||!envelope.data||typeof envelope.data!=='object')return null;
 const doc=envelope.data as FirecrawlDocument;
 const metadata=doc.metadata&&typeof doc.metadata==='object'?doc.metadata:{};
 const markdown=cleanMarkdown(stringField(doc.markdown));
 if(markdown.length<110)return null;

 const metaTitle=stringField(metadata.title)||stringField(metadata.ogTitle);
 const heading=markdown.match(/^#\s+(.+)$/m)?.[1]?.trim()||'';
 const title=!genericTitle(metaTitle)?metaTitle:!genericTitle(heading)?heading:'';
 const contentLines=markdown.split('\n').map(s=>s.trim());
 const prose=contentLines.filter(s=>s.length>=55&&
  !/^(?:#|!|\[|\||<|-{3,}|\*{3,})/.test(s));
 const substantive=contentLines.map(s=>s.replace(/^(?:#+\s*|[-*•]\s+|\d+[.)]\s+|>\s*)/,'').trim())
  .filter(s=>s.length>=25&&!/^(!?\[|<|[-=]{3,})/.test(s));
 const total=substantive.reduce((n,s)=>n+Math.min(s.length,400),0);
 if(total<110||substantive.length<2)return null;
 if(prose.length===0&&substantive.length<4)return null;
 const opening=contentLines.slice(0,25).join(' ').slice(0,2200);
 if(LOGIN_WALL.test(opening))return null;
 // A screen made of login controls is not a post, even if its metadata has a title.
 const loginControls=/(?:forgot (?:your )?password|continue with (?:google|facebook)|create (?:an? )?account|비밀번호 찾기|아이디 찾기|회원가입하기)/i.test(opening);
 if(loginControls&&/(?:log[\s-]?in|sign[\s-]?in|로그인)/i.test(opening))return null;
 // Marketing/layout text with no real document title must not be misrepresented.
 if(!title&&genericTitle(metaTitle)&&/^(?:instagram|facebook|notion|daum\s*카페)/i.test(metaTitle))return null;

 const rawDesc=stringField(metadata.description)||stringField(metadata.ogDescription);
 const description=!genericTitle(rawDesc)&&rawDesc.length>24?
  rawDesc:(prose[0]||substantive[0]||'');
 const image=stringField(metadata.ogImage)||stringField(metadata.image);
 const thumbnail_url=/^https:\/\//i.test(image)?image.slice(0,1500):'';
 return {title:title.slice(0,300),description:description.slice(0,1200),
  content_text:markdown.slice(0,18000),thumbnail_url};
}

export function canSendPublicUrlToFirecrawl(url:URL){
 const host=url.hostname.toLowerCase().replace(/\.$/,'');
 if(!['http:','https:'].includes(url.protocol)||url.username||url.password||
  !host||host==='localhost'||host.endsWith('.localhost')||host.endsWith('.local')||
  host.endsWith('.internal')||host.includes(':')||/^\d+$/.test(host))return false;
 // Never submit local / literal-IP or signed/private URLs to a third-party API.
 if(/^\d+\.\d+\.\d+\.\d+$/.test(host))return false;
 if([...url.searchParams.keys()].some(key=>SENSITIVE_PARAMS.test(key)))return false;
 return true;
}
function publicRequestUrl(url:URL){
 const clean=new URL(url.toString());
 clean.hash='';
 for(const key of [...clean.searchParams.keys()]){
  if(/^utm_/i.test(key)||/^(?:fbclid|gclid|igshid)$/i.test(key)||
   (key==='source'&&clean.hostname.endsWith('.notion.site')&&clean.searchParams.get(key)==='copy_link')){
   clean.searchParams.delete(key);
  }
 }
 return clean.toString();
}

/** One on-demand scrape, bounded response and TTL. Never run on automatic page load. */
export async function readFirecrawlPublicPage(url:URL):Promise<FirecrawlPagePreview|null>{
 const key=process.env.FIRECRAWL_API_KEY?.trim();
 if(!key||!canSendPublicUrlToFirecrawl(url))return null;
 const requestUrl=publicRequestUrl(url);
 const cached=cache.get(requestUrl);
 if(cached&&cached.expires>Date.now())return cached.page;
 try{
  const res=await fetch('https://api.firecrawl.dev/v2/scrape',{
   method:'POST',redirect:'error',cache:'no-store',
   headers:{'Content-Type':'application/json',Authorization:'Bearer '+key},
   body:JSON.stringify({
    url:requestUrl,formats:['markdown'],onlyMainContent:true,
    removeBase64Images:true,maxAge:600000
   }),
   signal:AbortSignal.timeout(19000)
  });
  if(!res.ok||!(res.headers.get('content-type')||'').includes('application/json'))return null;
  if(Number(res.headers.get('content-length')||0)>1_000_000)return null;
  const reader=res.body?.getReader();
  if(!reader)return null;
  const decoder=new TextDecoder();
  let text='',bytes=0;
  while(true){
   const {done,value}=await reader.read();
   if(done)break;
   bytes+=value.length;
   if(bytes>1_000_000){await reader.cancel();return null}
   text+=decoder.decode(value,{stream:true});
  }
  text+=decoder.decode();
  const page=parseFirecrawlPublicPage(JSON.parse(text));
  if(page){
   if(cache.size>=64)cache.delete(cache.keys().next().value as string);
   cache.set(requestUrl,{expires:Date.now()+CACHE_MS,page});
  }
  return page;
 }catch{return null}
}
