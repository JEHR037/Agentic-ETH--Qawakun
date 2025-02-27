import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { getAuthToken } from '../utils/auth';
import { cookies } from 'next/headers';

const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:8080';

export async function GET(request: NextRequest) {
  try {
    const token = await getAuthToken();
    const response = await fetch(`${BACKEND_URL}/proposalssc`, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    console.log("🔄 Starting POST /proposalssc");
    
    let token;
    try {
      token = await getAuthToken();
      console.log("✅ Token obtained");
    } catch (error) {
      console.error("❌ Auth error:", error);
      return NextResponse.json(
        { 
          success: false,
          error: "Authentication failed",
          details: error instanceof Error ? error.message : 'Unknown auth error'
        },
        { status: 401 }
      );
    }
    
    const body = await request.json();
    
    // Convertir el timestamp a Unix timestamp (segundos)
    const unixTimestamp = Math.floor(Date.now() / 1000);
    
    // Formatear los datos según lo que espera la estructura Proposal en Rust
    const proposalData = {
      wallet: body.wallet.toLowerCase(),
      proposal_type: body.proposal_type,
      description: body.description,
      message_history: body.conversation ? [body.conversation] : [],
      contact: "",
      flexibility: 5,
      timestamp: new Date().toISOString(),
      status: 3  // En votación
    };
    
    console.log("📦 Proposal data:", proposalData);

    const response = await fetch(`${BACKEND_URL}/proposalssc`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      credentials: 'include',
      body: JSON.stringify(proposalData)
    });

    console.log("📥 Backend response status:", response.status);
    console.log("📥 Backend response headers:", Object.fromEntries(response.headers.entries()));
    
    const responseText = await response.text();
    console.log("📄 Raw response text:", responseText);
    
    if (!response.ok) {
      // Intentar obtener más información del error
      console.error("❌ Backend error details:", {
        status: response.status,
        statusText: response.statusText,
        headers: Object.fromEntries(response.headers.entries()),
        body: responseText
      });

      return NextResponse.json(
        { 
          success: false,
          error: responseText || 'Failed to elevate proposal',
          details: {
            status: response.status,
            statusText: response.statusText
          }
        },
        { status: response.status }
      );
    }
    
    let data;
    try {
      data = JSON.parse(responseText);
      console.log("✅ Parsed response data:", data);
    } catch (e) {
      console.error("❌ Error parsing response:", e);
      return NextResponse.json({
        success: true,
        message: responseText
      });
    }

    return NextResponse.json({
      success: true,
      ...data
    });
  } catch (error) {
    console.error('❌ Error in POST /proposalssc:', error);
    return NextResponse.json(
      { 
        success: false,
        error: error instanceof Error ? error.message : 'Internal Server Error',
        details: error
      },
      { status: 500 }
    );
  }
} 