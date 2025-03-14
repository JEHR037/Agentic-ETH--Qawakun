import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { getAuthToken } from '../utils/auth';

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8081';

// Get proposals from Redis
export async function GET() {
  try {
    const token = await getAuthToken();
    const response = await fetch(`${BACKEND_URL}/proposals`, {
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

export async function POST(request: NextRequest) {
  try {
    const token = await getAuthToken();
    const body = await request.json();
    
    // Validar que tenemos todos los campos necesarios
    const {
      wallet,
      fid,
      proposal_type,
      description,
      flexibility,
      contact,
      message_history,
      timestamp,
      status
    } = body;

    // Hacer la petición al backend incluyendo el token
    const response = await fetch(`${BACKEND_URL}/proposals`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        wallet,
        fid,
        proposal_type,
        description,
        flexibility,
        contact,
        message_history,
        timestamp,
        status
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      return new NextResponse(error, { status: response.status });
    }

    const data = await response.json();
    return NextResponse.json(data);

  } catch (error) {
    console.error('Error in proposal POST:', error);
    return new NextResponse(
      JSON.stringify({ error: 'Internal Server Error' }), 
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    const token = await getAuthToken();
    const data = await request.json();
    const { wallet, status } = data;

    if (!wallet || status === undefined) {
      return NextResponse.json(
        { error: 'Wallet and status are required' },
        { status: 400 }
      );
    }

    const response = await fetch(`${BACKEND_URL}/proposals`, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        wallet,
        update: {
          action: "status",
          status: status,
          timestamp: new Date().toISOString()
        }
      }),
    });

    // Manejo mejorado de errores
    if (!response.ok) {
      let errorMessage = 'Failed to update proposal';
      try {
        const errorData = await response.json();
        errorMessage = errorData.message || errorMessage;
      } catch {
        // Si no podemos parsear el JSON, usamos el mensaje por defecto
      }
      
      return NextResponse.json(
        { error: errorMessage },
        { status: response.status }
      );
    }

    const updatedProposal = await response.json();
    return NextResponse.json(updatedProposal);

  } catch (error) {
    console.error('Error updating proposal:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
} 