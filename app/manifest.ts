import type {MetadataRoute} from 'next';
export default function manifest():MetadataRoute.Manifest{
 return {
  name:'MOA · 나만의 정보 라이브러리',
  short_name:'MOA',
  description:'정보와 링크를 모아 검색하고 정리하는 나만의 라이브러리',
  id:'/',
  start_url:'/',
  scope:'/',
  display:'standalone',
  background_color:'#f7f8fa',
  theme_color:'#263d37',
  lang:'ko-KR',
  icons:[
   {src:'/api/pwa-icon/192',sizes:'192x192',type:'image/png',purpose:'any'},
   {src:'/api/pwa-icon/512',sizes:'512x512',type:'image/png',purpose:'maskable'}
  ]
 };
}
