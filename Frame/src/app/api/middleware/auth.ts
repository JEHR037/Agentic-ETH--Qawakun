import { NextRequest, NextResponse } from 'next/server';
import { getAuthToken } from '../utils/auth';

export async function withAuth(request: NextRequest, handler: Function) {
  try {
    console.log('🔒 Authenticating request...');
    const tokenResponse = await getAuthToken();
    
    if (!tokenResponse || typeof tokenResponse !== 'string') {
      console.error('❌ No valid token received');
      return NextResponse.json({ error: 'No valid token' }, { status: 401 });
    }

    // Crear nuevos headers manteniendo los esenciales del request original
    const headers = new Headers();
    headers.set('Authorization', `Bearer ${tokenResponse}`);
    headers.set('Content-Type', 'application/json');

    // Copiar otros headers importantes si existen
    ['accept', 'accept-language', 'user-agent'].forEach(header => {
      const value = request.headers.get(header);
      if (value) headers.set(header, value);
    });

    console.log('📨 Headers being sent:', {
      Authorization: `Bearer ${tokenResponse.substring(0, 20)}...`,
      'Content-Type': headers.get('Content-Type')
    });

    const authorizedRequest = new Request(request.url, {
      method: request.method,
      headers,
      body: request.body
    });

    console.log('🚀 Forwarding authenticated request to handler');
    const response = await handler(authorizedRequest);
    console.log('✅ Handler response received:', response.status);
    
    return response;
  } catch (error) {
    console.error('❌ Authentication error:', error);
    return NextResponse.json(
      { error: 'Unauthorized' },
      { status: 401 }
    );
  }
} 