import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  // Obtener la URL y el origen de la solicitud
  const url = request.nextUrl.clone();
  const { pathname } = url;
  
  // Verificar si es una ruta de API (excepto las específicamente permitidas para acceso externo)
  if (pathname.startsWith('/api/') && 
      !pathname.startsWith('/api/webhook') && 
      !pathname.startsWith('/api/interactive') &&
      !pathname.startsWith('/api/proposal/vote')) {
    
    // Verificar el origen (referrer)
    const referer = request.headers.get('referer') || '';
    const host = request.headers.get('host') || '';
    
    // Lista de orígenes permitidos
    const allowedOrigins = [
      `https://${host}`,
      `http://${host}`,
      'http://localhost:3000',
      process.env.NEXT_PUBLIC_URL,
    ].filter(Boolean);
    
    // Verificar si el referrer es de un origen permitido
    const isFromAllowedOrigin = allowedOrigins.some(origin => 
      referer.startsWith(origin as string)
    );
    
    // Si no hay referer o no es de un origen permitido, verificar token de API
    if (!isFromAllowedOrigin) {
      // Verificar token de API en la cabecera
      const apiToken = request.headers.get('x-api-token');
      
      // Token desde variable de entorno
      const validToken = process.env.API_ACCESS_TOKEN;
      
      // Si no hay token o no coincide, denegar el acceso
      if (!apiToken || apiToken !== validToken) {
        console.log('Acceso no autorizado a API desde:', referer);
        
        return NextResponse.json(
          { error: 'Acceso no autorizado' },
          { status: 403 }
        );
      }
    }
  }
  
  // Permitir la solicitud si pasa todas las verificaciones
  return NextResponse.next();
}

// Configurar en qué rutas se aplicará este middleware
export const config = {
  matcher: ['/api/:path*'],
}; 