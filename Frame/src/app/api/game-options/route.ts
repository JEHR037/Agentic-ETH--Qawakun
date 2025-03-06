import { NextResponse } from 'next/server';
import { getAuthToken } from '../../utils/auth';

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://127.0.0.1:8080';

export async function GET() {
  try {
    const token = await getAuthToken();
    if (!token) {
      return NextResponse.json(
        { error: 'No autorizado - Token no encontrado' },
        { status: 401 }
      );
    }

    const response = await fetch(`${BACKEND_URL}/game-options`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      }
    });

    if (!response.ok) {
      throw new Error(`Error al obtener opciones de juego: ${response.status}`);
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error('Error fetching game options:', error);
    return NextResponse.json(
      { error: 'Error al obtener opciones de juego', details: error instanceof Error ? error.message : 'Error desconocido' },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const token = await getAuthToken();
    if (!token) {
      return NextResponse.json(
        { error: 'No autorizado - Token no encontrado' },
        { status: 401 }
      );
    }

    const data = await request.json();
    const response = await fetch(`${BACKEND_URL}/game-options`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify(data)
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Error del backend: ${response.status} - ${errorText}`);
    }

    const result = await response.json();
    return NextResponse.json(result);
  } catch (error) {
    console.error('Error updating game options:', error);
    return NextResponse.json(
      { error: 'Error al actualizar opciones de juego', details: error instanceof Error ? error.message : 'Error desconocido' },
      { status: 500 }
    );
  }
} 