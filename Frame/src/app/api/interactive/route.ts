import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const token = process.env.NEXT_PUBLIC_BEARER_TOKEN;
    
    console.log('Request body:', body);
    console.log('Using Bearer Token:', token ? `${token.substring(0, 6)}...` : 'No token found');

    // Enviar a la API externa
    const response = await fetch('http://localhost:8080/api', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify({
        post_type: "message",
        data: body.data
      }),
    });

    const responseData = await response.text();
    console.log('API Response:', responseData);
    

    console.log('Transaction Summary:', {
      timestamp: new Date().toISOString(),
      author: body.data.author,
      content: body.data.content,
      responseStatus: response.status,
      responseData
    });

    return NextResponse.json({ message: responseData });
  } catch (error) {
    console.error('Error details:', {
      name: error.name,
      message: error.message,
      stack: error.stack
    });
    
    return NextResponse.json(
      { error: 'Internal Server Error', details: error.message },
      { status: 500 }
    );
  }
} 