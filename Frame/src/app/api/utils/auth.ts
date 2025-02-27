import { cookies } from 'next/headers';

const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:8080';

export async function getAuthToken() {
  const cookieStore = await cookies();
  let token = cookieStore.get('auth_token')?.value;

  if (!token) {
    try {
      if (!process.env.API_USER || !process.env.API_PASSWORD) {
        throw new Error('API credentials not configured');
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
        const errorText = await response.text();
        throw new Error(`Authentication failed: ${response.status} - ${errorText}`);
      }

      const data = await response.json();
      token = data.token;
      
      if (!token) {
        throw new Error('No token received from login');
      }

      const newCookieStore = await cookies();
      newCookieStore.set('auth_token', token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        maxAge: 3600
      });

      console.log("✅ New token generated and stored");
    } catch (err) {
      console.error("❌ Auth error:", err);
      throw err;
    }
  } else {
    console.log("✅ Using existing token");
  }

  if (!token) {
    throw new Error('No valid token available');
  }

  return token;
} 