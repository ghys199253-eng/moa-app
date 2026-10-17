import type {Metadata,Viewport} from 'next';import './style.css';
export const metadata:Metadata={title:'MOA | 나만의 정보 라이브러리',description:'흩어진 정보를 한곳에',applicationName:'MOA'};
export const viewport:Viewport={width:'device-width',initialScale:1,themeColor:'#faf9f6'};
export default function RootLayout({children}:{children:React.ReactNode}){return <html lang="ko"><body>{children}</body></html>}
