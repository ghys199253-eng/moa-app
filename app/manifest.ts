import type {MetadataRoute} from 'next';
export default function manifest():MetadataRoute.Manifest{return {name:'MOA - 나만의 정보 라이브러리',short_name:'MOA',description:'링크를 모으고 다시 찾는 개인 정보 아카이브',start_url:'/',display:'standalone',background_color:'#faf9f6',theme_color:'#faf9f6',icons:[{src:'/icon.svg',sizes:'any',type:'image/svg+xml',purpose:'any'}]}}
