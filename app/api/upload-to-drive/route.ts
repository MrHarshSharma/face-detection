import { google } from 'googleapis';
import { NextResponse } from 'next/server';
import { Readable } from 'stream';

// Convert Blob to Readable Stream
function bufferToStream(buffer: Buffer) {
  const readable = new Readable();
  readable.push(buffer);
  readable.push(null);
  return readable;
}

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as Blob;
    const filename = formData.get('filename') as string;

    // Debug log to check credentials
    console.log('Client Email:', process.env.GOOGLE_CLIENT_EMAIL);
    console.log('Private Key exists:', !!process.env.GOOGLE_PRIVATE_KEY);

    // Initialize Google Drive API client
    const auth = new google.auth.GoogleAuth({
      credentials: {
        client_email: process.env.GOOGLE_CLIENT_EMAIL,
        private_key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
      },
      scopes: ['https://www.googleapis.com/auth/drive.file'],
    });

    const drive = google.drive({ version: 'v3', auth });

    // Convert blob to buffer then to stream
    const buffer = Buffer.from(await file.arrayBuffer());
    const stream = bufferToStream(buffer);

    // Upload file to Drive
    const response = await drive.files.create({
      requestBody: {
        name: filename || 'snapshots.zip',
        mimeType: 'application/zip',
      },
      media: {
        mimeType: 'application/zip',
        body: stream,
      },
    });

    // Set file to be publicly accessible
    await drive.permissions.create({
      fileId: response.data.id!,
      requestBody: {
        role: 'reader',
        type: 'anyone',
      },
    });

    const fileUrl = `https://drive.google.com/file/d/${response.data.id}/view?usp=sharing`;

    return NextResponse.json({ fileUrl });
  } catch (error) {
    // More detailed error logging
    console.error('Detailed error:', error);
    return NextResponse.json(
      { message: 'Error uploading file', error: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
} 