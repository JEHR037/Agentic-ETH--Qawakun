import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export type MiddlewareFunction = (
  req: NextRequest,
  res: NextResponse
) => Promise<NextResponse | void>;

export async function withAuth(
  req: NextRequest,
  handler: MiddlewareFunction
): Promise<NextResponse> {
  try {
    const token = req.headers.get('Authorization')?.split(' ')[1];
    
    if (!token) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    return (await handler(req, NextResponse.next())) || NextResponse.next();
  } catch (err) {
    console.error('Auth middleware error:', err);
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 }
    );
  }
} 