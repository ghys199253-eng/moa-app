/**
 * Read public Notion pages via Firecrawl when Notion's unauthenticated block API
 * does not return actual document text. The key is server-only (never NEXT_PUBLIC).
 * This does not save anything to the MOA database.
 */
export type FirecrawlPagePreview={
 title:string;
 description:string;
 content_text:string;
 thumbnail_url:string;
};

type FirecrawlDocument={
 markdown?:unknown;
 metadata?:Record<string,unknown>;
};
function stringField(value:unknown):string{
 return typeof value==='string'?value.trim():'';
}
function genericNotion(value:string):boolean{
 const s=value.toLowerCase().replace(/\s+/g,' ');
 return /^notion(?:\s*[|–-]\s*.*)?$/.test(s)||
  /^made in notion\b/.test(s)||
  /(?:the connected workspace where ai agents|teams and agents work together|write, plan, share)/.test(s);
}

/** Returns null rather than treating generic Notion marketing copy as page content. */
export function parseFirecrawlPublicPage(payload:unknown):FirecrawlPagePreview|null{
 if(!payload||typeof payload!=='object')return null;
 const envelope=payload as {success?:unknown;data?:unknown};
 if(envelope.success===false||!envelope.data||typeof envelope.data!=='object')return null;
 const doc=envelope.data as FirecrawlDocument;
 const metadata=doc.metadata||{};
 const markdown=stringField(doc.markdown)
  .replace(/^\[Skip to content\]\([^\n]+\)\s*/i,'')
  .replace(/!\[[^\]\n]*\]\(<Base64-Image-Removed>\)/g,'')
  .replace(/\n{3,}/g,'\n\n')
  .trim();
 if(markdown.length<100)return null;
 const metaTitle=stringField(metadata.title)||stringField(metadata.ogTitle);
 const heading=markdown.match(/^#{1,2}\s+(.+)$/m)?.[1]?.trim()||'';
 const title=metaTitle&&!genericNotion(metaTitle)?metaTitle:heading&&!genericNotion(heading)?heading:'';
 if(!title||genericNotion(title))return null;
 const hasPageText=markdown.split('\n').some(line=>line.trim().length>=55&&
  !/^(?:\[|!|#|\||\*|-{3,})/.test(line.trim()));
 if(!hasPageText)return null;
 const fromMetadata=stringField(metadata.description)||stringField(metadata.ogDescription);
 const firstParagraph=markdown.split('\n').find(line=>line.trim().length>=55&&
  !/^(?:\[|!|#|\||\*|-{3,})/.test(line.trim()))?.trim()||'';
 const description=fromMetadata&&!genericNotion(fromMetadata)?fromMetadata:firstParagraph;
 const image=stringField(metadata.ogImage)||stringField(metadata.image);
 const thumbnail_url=/^https:\/\//i.test(image)?image.slice(0,1500):'';
 return {title:title.slice(0,300),description:description.slice(0,1200),
  content_text:markdown.slice(0,18000),thumbnail_url};
}

export async function readFirecrawlPublicPage(url:URL):Promise<FirecrawlPagePreview|null>{
 const key=process.env.FIRECRAWL_API_KEY?.trim();
 if(!key)return null;
 const host=url.hostname.toLowerCase();
 // The fallback intentionally only requests Notion public pages for now.
 if(!(host==='notion.so'||host==='www.notion.so'||host==='notion.site'||host.endsWith('.notion.site')))return null;
 try{
  const res=await fetch('https://api.firecrawl.dev/v2/scrape',{
   method:'POST',redirect:'error',cache:'no-store',
   headers:{'Content-Type':'application/json',Authorization:'Bearer '+key},
   body:JSON.stringify({url:url.toString(),formats:['markdown'],onlyMainContent:true,removeBase64Images:true}),
   signal:AbortSignal.timeout(19000)
  });
  if(!res.ok||!(res.headers.get('content-type')||'').includes('application/json'))return null;
  if(Number(res.headers.get('content-length')||0)>1_000_000)return null;
  // Firecrawl normally returns a small JSON document, but bound its size too.
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
  return parseFirecrawlPublicPage(JSON.parse(text));
 }catch{return null}
}
