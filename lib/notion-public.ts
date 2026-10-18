/**
 * Read only blocks explicitly returned by Notion's unauthenticated public-page
 * endpoint. This endpoint is unofficial and may stop working; failures must be
 * treated as unavailable content, never as proof that a page is empty.
 */
type NotionBlock={
 id?:string;
 type?:string;
 properties?:Record<string,unknown>;
 content?:string[];
};
type NotionEnvelope={recordMap?:{block?:Record<string,{value?:NotionBlock}>}};
export type NotionPagePreview={title:string;content_text:string};

export function isNotionPage(url:URL){
 const host=url.hostname.toLowerCase();
 return host==='notion.so'||host==='www.notion.so'||host==='notion.site'||host.endsWith('.notion.site');
}

export function notionPageId(url:URL):string|null{
 if(!isNotionPage(url))return null;
 const m=url.pathname.match(/([a-f0-9]{32}|[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12})\/?$/i);
 if(!m)return null;
 const compact=m[1].replace(/-/g,'').toLowerCase();
 return compact.replace(/^(.{8})(.{4})(.{4})(.{4})(.{12})$/,'$1-$2-$3-$4-$5');
}

export function notionSlugTitle(url:URL):string{
 if(!isNotionPage(url))return '';
 const part=url.pathname.split('/').filter(Boolean).at(-1)||'';
 let name:string;
 try{name=decodeURIComponent(part)}catch{name=part}
 name=name.replace(/-?(?:[a-f0-9]{32}|[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12})$/i,'');
 return name.replace(/[-_]+/g,' ').replace(/\s+/g,' ').trim().slice(0,180);
}

export function isNotionBoilerplate(value:string){
 const s=value.trim().replace(/\s+/g,' ').toLowerCase();
 return /^notion(?:\s*[|–-]\s*.*)?$/.test(s)||
   /^made in notion\b/.test(s)||
   /(?:the connected workspace where ai agents|teams and agents work together|write, plan, share)/.test(s);
}

function richText(value:unknown):string{
 if(!Array.isArray(value))return '';
 return value.filter(Array.isArray).map(x=>typeof x[0]==='string'?x[0]:'').join('').trim();
}
function blockText(block:NotionBlock):string{
 const props=block.properties||{};
 return richText(props.title)||richText(props.caption);
}

export function parsePublicNotionRecordMap(data:unknown,pageId:string):NotionPagePreview|null{
 if(!data||typeof data!=='object')return null;
 const map=(data as NotionEnvelope).recordMap?.block;
 if(!map||typeof map!=='object')return null;
 const root=map[pageId]?.value;
 if(!root||root.type!=='page')return null;
 const title=blockText(root);
 if(!title||isNotionBoilerplate(title))return null;
 const result:string[]=[];
 let numbered=0;
 const seen=new Set<string>();
 const visit=(id:string,depth:number)=>{
  if(result.length>=180||depth>7||seen.has(id))return;
  seen.add(id);
  const block=map[id]?.value;
  if(!block)return;
  if(block.type==='page'&&id!==pageId)return; // Avoid following subpages.
  const t=blockText(block);
  switch(block.type){
   case 'header': case 'heading_1': if(t){result.push('\n# '+t);numbered=0}break;
   case 'sub_header': case 'heading_2': if(t){result.push('\n## '+t);numbered=0}break;
   case 'sub_sub_header': case 'heading_3': if(t){result.push('\n### '+t);numbered=0}break;
   case 'bulleted_list': if(t)result.push('• '+t);numbered=0;break;
   case 'numbered_list': if(t)result.push((++numbered)+'. '+t);break;
   case 'to_do': if(t)result.push('• '+t);numbered=0;break;
   case 'quote': if(t)result.push(t);numbered=0;break;
   case 'text': case 'paragraph': if(t)result.push(t);numbered=0;break;
   case 'code': if(t)result.push(t);numbered=0;break;
   case 'divider':result.push('');numbered=0;break;
   default:numbered=0;
  }
  for(const child of block.content||[])if(typeof child==='string')visit(child,depth+1);
 };
 for(const child of root.content||[])if(typeof child==='string')visit(child,0);
 const content_text=result.join('\n').replace(/\n{3,}/g,'\n\n').trim().slice(0,18000);
 return {title:title.slice(0,300),content_text};
}

export async function readPublicNotionPage(url:URL):Promise<NotionPagePreview|null>{
 const pageId=notionPageId(url);
 if(!pageId)return null;
 try{
  // Only the fixed Notion host is contacted; user-provided URLs cannot redirect this request.
  const res=await fetch('https://www.notion.so/api/v3/loadPageChunk',{
   method:'POST',
   headers:{'Content-Type':'application/json','Accept':'application/json'},
   body:JSON.stringify({pageId,limit:100,cursor:{stack:[]},chunkNumber:0,verticalColumns:false}),
   redirect:'error',cache:'no-store',signal:AbortSignal.timeout(4500)
  });
  if(!res.ok||!(res.headers.get('content-type')||'').includes('json'))return null;
  const length=Number(res.headers.get('content-length')||0);
  if(length>1_500_000)return null;
  const text=await res.text();
  if(text.length>1_500_000)return null;
  return parsePublicNotionRecordMap(JSON.parse(text),pageId);
 }catch{return null}
}
