import type {Metadata,Viewport} from 'next';
import './style.css';

export const metadata:Metadata={
 title:'MOA | 나만의 정보 라이브러리',
 description:'저장한 링크와 상세 정보를 쉽게 검색하고 정리하는 개인 라이브러리',
 applicationName:'MOA',
 manifest:'/manifest.webmanifest',
 icons:{
  icon:[{url:'/icon.svg',type:'image/svg+xml'},{url:'/api/pwa-icon/192',sizes:'192x192',type:'image/png'}],
  apple:[{url:'/api/pwa-icon/180',sizes:'180x180',type:'image/png'}]
 },
 appleWebApp:{capable:true,statusBarStyle:'default',title:'MOA'},
};
export const viewport:Viewport={
 width:'device-width',
 initialScale:1,
 viewportFit:'cover',
 themeColor:[{media:'(prefers-color-scheme: light)',color:'#f7f8fa'},{media:'(prefers-color-scheme: dark)',color:'#11161d'}]
};
export default function RootLayout({children}:{children:React.ReactNode}){
 return <html lang="ko"><body>{children}</body></html>;
}
