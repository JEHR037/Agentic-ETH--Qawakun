import { NextResponse } from 'next/server';
import { getAuthToken } from '../utils/auth';

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8080';

export async function GET() {
  try {
    const token = await getAuthToken();
    const response = await fetch(`${BACKEND_URL}/proposalsw`, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    return NextResponse.json(
      { error: 'Internal Server Error', details: error },
      { status: 500 }
    );
  }
} 