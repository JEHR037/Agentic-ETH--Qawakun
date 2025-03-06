import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { getAuthToken } from '../utils/auth';
import { cookies } from 'next/headers';

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8080';

export async function GET(request: NextRequest) {
  try {
    const token = await getAuthToken();
    const wallet = request.headers.get('wallet');

    if (!wallet) {
      return NextResponse.json(
        { error: 'Wallet address required' },
        { status: 400 }
      );
    }

    console.log('Checking NFT for wallet:', wallet); // Debug log

    const response = await fetch(`${BACKEND_URL}/nft-claim`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'wallet': wallet,
        'Content-Type': 'application/json'
      }
    });

    console.log('Backend response status:', response.status); // Debug log

    if (response.status === 401) {
      const cookieStore = await cookies();
      cookieStore.delete('auth_token');
      return GET(request);
    }

    const responseText = await response.text();
    console.log('Backend response:', responseText); // Debug log

    if (!response.ok) {
      return NextResponse.json(
        { error: `Failed to check NFT status: ${responseText}` },
        { status: response.status }
      );
    }

    try {
      const data = JSON.parse(responseText);
      return NextResponse.json(data);
    } catch (e) {
      console.error('Error parsing response:', e);
      return NextResponse.json(
        { error: 'Invalid response format from server' },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error('Error in GET /nft-claim:', error);
    return NextResponse.json(
      { error: 'Internal Server Error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const token = await getAuthToken();
    const claimData = await request.json();

    console.log('Claiming NFT with data:', claimData); // Debug log

    const response = await fetch(`${BACKEND_URL}/nft-claim`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify(claimData),
    });

    console.log('Backend response status:', response.status); // Debug log

    const responseText = await response.text();
    console.log('Backend response:', responseText); // Debug log

    if (response.status === 401) {
      const cookieStore = await cookies();
      await cookieStore.delete('auth_token');
      return POST(request);
    }

    if (!response.ok) {
      return NextResponse.json({
        error: 'Claim failed',
        message: responseText || 'Unknown error'
      }, { status: response.status });
    }

    try {
      const data = JSON.parse(responseText);
      return NextResponse.json(data);
    } catch {
      // Si no podemos parsear la respuesta como JSON, la envolvemos en un objeto
      return NextResponse.json({ 
        success: true,
        message: responseText.replace(/^"|"$/g, '').trim()
      });
    }

  } catch (err) {
    console.error('Error in POST /nft-claim:', err);
    return NextResponse.json({
      error: 'Internal Server Error',
      message: err instanceof Error ? err.message : 'Unknown error'
    }, { status: 500 });
  }
} 