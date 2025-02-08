import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const token = process.env.NEXT_PUBLIC_BEARER_TOKEN;
    
    console.log('NFT Claim Request:', body);

    const response = await fetch('http://localhost:8080/nft-claim', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify(body),
    });

    const responseData = await response.text();
    console.log('NFT Claim Response:', responseData);

    return NextResponse.json({ message: responseData });
  } catch (error) {
    console.error('NFT Claim Error:', error);
    return NextResponse.json(
      { error: 'Internal Server Error', details: error.message },
      { status: 500 }
    );
  }
}

export async function GET() {
  try {
    const token = process.env.NEXT_PUBLIC_BEARER_TOKEN;
    
    const response = await fetch('http://localhost:8080/nft-claims', {
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error('Get Claims Error:', error);
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 }
    );
  }
} 