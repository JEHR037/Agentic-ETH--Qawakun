import { cookies } from 'next/headers';

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8080';
const user = process.env.NEXT_PUBLIC_API_USER;
const password = process.env.NEXT_PUBLIC_API_PASSWORD;

export async function getAuthToken() {
  const cookieStore = await cookies();
  let token = cookieStore.get('auth_token')?.value;

  if (!token) {
    try {
      const loginBody = {
        user: user,
        password: password,
      };

      // Realiza una solicitud POST para obtener el token
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

      if (token) {
        const newCookieStore = await cookies();
        newCookieStore.set('auth_token', token, {
          httpOnly: true,
          secure: process.env.NODE_ENV === 'production',
          sameSite: 'strict',
          maxAge: 3600, // 1 hora
        });
      }
    } catch (error) {
      console.error('Error getting auth token:', error);
      throw error;
    }
  }

  return token;
} 