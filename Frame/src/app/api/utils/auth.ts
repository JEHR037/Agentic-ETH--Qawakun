import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

const BACKEND_URL = 'http://localhost:8080';

export async function getAuthToken() {
  const cookieStore = await cookies();
  let token = cookieStore.get('auth_token')?.value;

  if (!token) {
    try {
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

      const responseText = await response.text();

      if (!response.ok) {
        throw new Error(`Authentication failed: ${response.status} - ${responseText}`);
      }

      const data = JSON.parse(responseText);
      token = data.token;
      
      const newCookieStore = await cookies();
      newCookieStore.set('auth_token', token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        maxAge: 3600
      });
    } catch (error) {
      throw error;
    }
  }

  return token;
} 