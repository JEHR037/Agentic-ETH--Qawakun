import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { getAuthToken } from '../utils/auth';
import { cookies } from 'next/headers';

const BACKEND_URL = 'http://localhost:8080';

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

    const response = await fetch(`${BACKEND_URL}/nft-claim`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'wallet': wallet
      }
    });

    if (response.status === 401) {
      const cookieStore = await cookies();
      cookieStore.delete('auth_token');
      return GET(request);
    }

    const data = await response.text();

    if (!response.ok) {
      return NextResponse.json(
        { error: 'Failed to check NFT status' },
        { status: response.status }
      );
    }

    return NextResponse.json(JSON.parse(data));
  } catch {
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const token = await getAuthToken();
    const claimData = await request.json();

    const response = await fetch(`${BACKEND_URL}/nft-claim`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify(claimData),
    });

    const responseText = await response.text();

    if (response.status === 401) {
      const cookieStore = await cookies();
      cookieStore.delete('auth_token');
      return POST(request);
    }

    if (!response.ok) {
      return NextResponse.json(
        { error: 'Claim failed', message: responseText },
        { status: response.status }
      );
    }

    try {
      const data = JSON.parse(responseText);
      return NextResponse.json(data);
    } catch {
      return NextResponse.json({ 
        message: responseText.replace(/^"|"$/g, '').trim()
      });
    }

  } catch (err) {
    return NextResponse.json(
      { error: 'Internal Server Error', message: err instanceof Error ? err.message : 'Unknown error' },
      { status: 500 }
    );
  }
} 