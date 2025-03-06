import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { getAuthToken } from '../utils/auth';
import { cookies } from 'next/headers';
import { isAdmin } from '~/lib/auth';

const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:8080';

export async function GET(request: NextRequest) {
  try {
    const token = await getAuthToken();

    const response = await fetch(`${BACKEND_URL}/context`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });

    if (response.status === 401) {
      const cookieStore = await cookies();
      cookieStore.delete('auth_token');
      return GET(request);
    }

    const responseText = await response.text();

    if (!response.ok) {
      return NextResponse.json(
        { error: `Failed to get context: ${responseText}` },
        { status: response.status }
      );
    }

    try {
      const data = JSON.parse(responseText);
      return NextResponse.json(data);
    } catch (e) {
      return NextResponse.json(
        { error: 'Invalid response format from server', details: e },
        { status: 500 }
      );
    }
  } catch (error) {
    return NextResponse.json(
      { error: 'Internal Server Error', details: error },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    // Verificar si el usuario es administrador
    const adminCheck = await isAdmin(request);
    
    if (!adminCheck.isAdmin) {
      return NextResponse.json(
        { error: `Admin access required ${adminCheck.wallet}` },
        { status: 403 }
      );
    }
    
    const token = await getAuthToken();
    const contextData = await request.json();

    const response = await fetch(`${BACKEND_URL}/context`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify(contextData),
    });

    if (response.status === 401) {
      const cookieStore = await cookies();
      await cookieStore.delete('auth_token');
      return POST(request);
    }

    const responseText = await response.text();

    if (!response.ok) {
      return NextResponse.json({
        error: 'Update failed',
        message: responseText
      }, { status: response.status });
    }

    try {
      const data = JSON.parse(responseText);
      return NextResponse.json(data);
    } catch {
      return NextResponse.json({ 
        success: true,
        message: responseText
      });
    }
  } catch (error) {
    console.error('Error updating context:', error);
    return NextResponse.json(
      { error: 'Failed to update context' },
      { status: 500 }
    );
  }
} 