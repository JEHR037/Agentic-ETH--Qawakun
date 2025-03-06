import { NextResponse } from 'next/server';
import { getAuthToken } from '../../utils/auth';

const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:8080';

export async function POST(request: Request) {
  try {
    const authToken = await getAuthToken();
    if (!authToken) {
      return NextResponse.json(
        { error: 'No autorizado - Token no encontrado' },
        { status: 401 }
      );
    }

    const data = await request.json();
    const { proposalWallet, voterWallet } = data;

    if (!proposalWallet || !voterWallet) {
      return NextResponse.json(
        { error: 'Faltan datos requeridos' },
        { status: 400 }
      );
    }

    // Modificar el formato para que coincida con UpdateData
    const updateData = {
      wallet: proposalWallet,
      update: {
        action: 'vote',
        voter_wallet: voterWallet,
        timestamp: Math.floor(Date.now() / 1000).toString()
      }
    };

    console.log('Enviando datos al backend:', updateData);

    // Usar la ruta /proposals con método PUT
    const response = await fetch(`${BACKEND_URL}/proposals`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authToken}`
      },
      body: JSON.stringify(updateData)
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Error del backend: ${response.status} - ${errorText}`);
    }

    const result = await response.json();
    return NextResponse.json(result);

  } catch (error) {
    console.error('Error al procesar el voto:', error);
    return NextResponse.json(
      { error: 'Error al procesar el voto', details: error instanceof Error ? error.message : 'Error desconocido' },
      { status: 500 }
    );
  }
} 