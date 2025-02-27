import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { getAuthToken } from '../utils/auth';

const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:8080';

export async function GET() {
  try {
    const token = await getAuthToken();
    const response = await fetch(`${BACKEND_URL}/proposalssc`, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });

    const data = await response.json();
    return NextResponse.json(data);
  } catch (err) {
    console.error('❌ Error in GET /proposalssc:', err);
    return NextResponse.json(
      { 
        success: false,
        error: 'Internal Server Error'
      },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const token = await getAuthToken();
    const body = await request.json();
    const timestamp = Math.floor(Date.now() / 1000);

    const response = await fetch(`${BACKEND_URL}/proposalssc`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ ...body, timestamp })
    });

    const data = await response.json();
    return NextResponse.json({
      success: true,
      ...data
    });
  } catch (err) {
    console.error('❌ Error in POST /proposalssc:', err);
    return NextResponse.json(
      { 
        success: false,
        error: err instanceof Error ? err.message : 'Internal Server Error'
      },
      { status: 500 }
    );
  }
} 