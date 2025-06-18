import { google } from 'googleapis';
import { NextResponse } from 'next/server';
import { Readable } from 'stream';

// Configure Google Drive API
    const auth = new google.auth.GoogleAuth({
      credentials: {
        client_email: process.env.GOOGLE_CLIENT_EMAIL,
        private_key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
      },
      scopes: ['https://www.googleapis.com/auth/drive.file'],
    });

    const drive = google.drive({ version: 'v3', auth });

export async function POST(request: any) {
  console.log("request",request)
  try {
    const formData = await request.formData();
    console.log('Received form data keys:', Array.from(formData.keys()));
    const file = formData.get('file') as File;
    console.log('File info:', {
      name: file?.name,
      type: file?.type,
      size: file?.size,
    });
    const email = formData.get('email') as string;

    if (!file) {
      return NextResponse.json(
        { error: 'File is required' },
        { status: 400 }
      );
    }

    // Convert File to Buffer
    const buffer = Buffer.from(await file.arrayBuffer());
    const stream = Readable.from(buffer);

    // Create a filename using email and timestamp
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const fileName = `${email.split('@')[0]}_${timestamp}.zip`;

    // Upload file to Google Drive
    const response = await drive.files.create({
      requestBody: {
        name: fileName,
        mimeType: 'application/zip',
      },
      media: {
        mimeType: 'application/zip',
        body: stream,
      },
    });

    if (!response.data.id) {
      throw new Error('Failed to get file ID from Google Drive');
    }

    // Create sharing link
    await drive.permissions.create({
      fileId: response.data.id,
      requestBody: {
        role: 'reader',
        type: 'anyone',
      },
    });

    // Get the sharing URL
    const fileUrl = `https://drive.google.com/file/d/${response.data.id}/view`;

    return NextResponse.json({ fileUrl });
  } catch (error) {
    console.error('Detailed error:', error);
    console.error('Error uploading to drive:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to upload file' },
      { status: 500 }
    );
  }
} 