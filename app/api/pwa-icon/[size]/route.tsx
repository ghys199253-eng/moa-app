import {ImageResponse} from 'next/og';
export const runtime='nodejs';
export async function GET(_request:Request,{params}:{params:Promise<{size:string}>}){
 const {size:rawSize}=await params;
 const size=Number(rawSize);
 if(![180,192,512].includes(size))return new Response('지원하지 않는 아이콘 크기입니다.',{status:404});
 return new ImageResponse(
 <div style={{display:'flex',width:'100%',height:'100%',alignItems:'center',justifyContent:'center',background:'#263d37',borderRadius:Math.round(size*.19),color:'#fff',fontFamily:'Arial,sans-serif',fontWeight:800,fontSize:Math.round(size*.27),letterSpacing:'-0.07em'}}>
  <span>moa.</span>
 </div>,
 {width:size,height:size}
 );
}
