import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { getAuthToken } from '../utils/auth';
import { cookies } from 'next/headers';

const BACKEND_URL = 'http://localhost:8080';

export async function POST(request: NextRequest) {
  try {
    const token = await getAuthToken();
    const { data } = await request.json();

    const serverData = {
      post_type: "message",
      data: {
        content: data.content,
        author: data.author
      }
    };

    const response = await fetch(`${BACKEND_URL}/api`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify(serverData),
    });

    const responseText = await response.text();

    if (response.status === 401) {
      const cookieStore = await cookies();
      cookieStore.delete('auth_token');
      return POST(request);
    }

    if (!responseText.trim()) {
      return NextResponse.json({ 
        message: "Message sent successfully"
      });
    }

    const cleanMessage = responseText.replace(/^"|"$/g, '').trim();
    return NextResponse.json({ 
      message: cleanMessage
    });

  } catch (error) {
    console.error('❌ Error:', error);
    return NextResponse.json(
      { error: 'Internal Server Error', message: error.message },
      { status: 500 }
    );
  }
} 