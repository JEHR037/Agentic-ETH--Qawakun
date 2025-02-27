import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

const BACKEND_URL = 'http://localhost:8080';

export async function GET() {
  try {
    const cookieStore = await cookies();
    let token = await cookieStore.get('auth_token')?.value;

    if (!token) {
      if (!process.env.API_USER || !process.env.API_PASSWORD) {
        return NextResponse.json(
          { error: 'API credentials not configured' },
          { status: 500 }
        );
      }

      const loginBody = {
        user: process.env.API_USER,
        password: process.env.API_PASSWORD,
      };

      const response = await fetch(`${BACKEND_URL}/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(loginBody),
      });

      if (!response.ok) {
        const responseText = await response.text();
        throw new Error(`Authentication failed: ${response.status} - ${responseText}`);
      }

      const data = await response.json();
      token = data.token;
      
      if (token) {
        await cookieStore.set('auth_token', token, {
          httpOnly: true,
          secure: process.env.NODE_ENV === 'production',
          sameSite: 'strict',
          maxAge: 3600
        });
      }
    }

    return NextResponse.json({ token });
  } catch (error) {
    console.error('Error in token route:', error);
    return NextResponse.json(
      { error: 'Authentication failed' },
      { status: 401 }
    );
  }
} 