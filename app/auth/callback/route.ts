import {NextRequest,NextResponse} from 'next/server';
import {serverSupabase} from '@/lib/server';
export async function GET(request:NextRequest){const code=request.nextUrl.searchParams.get('code');if(code){const sb=await serverSupabase();await sb.auth.exchangeCodeForSession(code)}return NextResponse.redirect(new URL('/',request.url))}
