import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export async function middleware(request: NextRequest) {
  // Rutas protegidas
  const protectedPaths = ['/context-manager', '/api/context'];
  
  const path = request.nextUrl.pathname;
  if (!protectedPaths.some(prefix => path.startsWith(prefix))) {
    return NextResponse.next();
  }

  // Verificar autenticación con Privy
  const privyToken = request.cookies.get('privy-token');
  if (!privyToken) {
    return new NextResponse(
      JSON.stringify({ error: 'Authentication required' }),
      { 
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      }
    );
  }

  // Verificar si es admin para context-manager
  if (path.startsWith('/context-manager')) {
    const adminWallets = process.env.NEXT_PUBLIC_ADMIN_WALLETS?.split(',') || [];
    const userWallet = request.cookies.get('user-wallet')?.value;

    if (!userWallet || !adminWallets.map(w => w.toLowerCase()).includes(userWallet.toLowerCase())) {
      return new NextResponse(
        JSON.stringify({ error: 'Admin access required '+userWallet}),
        { 
          status: 403,
          headers: { 'Content-Type': 'application/json' }
        }
      );
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    '/context-manager/:path*',
    '/api/context/:path*'
  ]
}; 