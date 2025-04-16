import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export async function POST(req: Request) {
  try {
    const { emails } = await req.json();

    if (!emails || !Array.isArray(emails)) {
      return NextResponse.json({ message: 'Invalid data' }, { status: 400 });
    }

    const csvContent = emails.join('\n');
    const filePath = path.join(process.cwd(), 'emails.csv');

    await new Promise((resolve, reject) => {
      fs.writeFile(filePath, csvContent, (err) => {
        if (err) {
          reject(err);
        } else {
          resolve(true);
        }
      });
    });

    return NextResponse.json({ message: 'File saved successfully' }, { status: 200 });
  } catch (error) {
    // Type assertion to any
    const errorMessage = (error as Error).message || 'Unknown error occurred';
    return NextResponse.json({ message: 'Error saving file', error: errorMessage }, { status: 500 });
  }
}
