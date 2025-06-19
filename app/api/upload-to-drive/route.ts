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
  console.log("request received")
  try {
    const formData = await request.formData();
    console.log('Received form data keys:', Array.from(formData.keys()));
    const file = formData.get('file') as File;
    console.log('File info:', {
      name: file?.name,
      type: file?.type,
      size: file?.size,
      sizeMB: file?.size ? (file.size / (1024 * 1024)).toFixed(2) : 'unknown'
    });
    const email = formData.get('email') as string;

    if (!file) {
      return NextResponse.json(
        { error: 'File is required' },
        { status: 400 }
      );
    }

    // Check file size - limit to 100MB
    const maxSize = 100 * 1024 * 1024; // 100MB
    if (file.size > maxSize) {
      return NextResponse.json(
        { error: `File too large. Maximum size is 100MB, your file is ${(file.size / (1024 * 1024)).toFixed(2)}MB` },
        { status: 413 }
      );
    }

    // Convert File to Buffer
    const buffer = Buffer.from(await file.arrayBuffer());
    const stream = Readable.from(buffer);

    // Create a filename using email and timestamp
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const fileName = `${email.split('@')[0]}_${timestamp}.zip`;

    console.log(`Uploading file: ${fileName} (${(file.size / (1024 * 1024)).toFixed(2)}MB)`);

    // Upload file to Google Drive with resumable upload for large files
    const response = await drive.files.create({
      requestBody: {
        name: fileName,
        mimeType: 'application/zip',
      },
      media: {
        mimeType: 'application/zip',
        body: stream,
      },
      // Use resumable upload for files larger than 5MB
      uploadType: file.size > 5 * 1024 * 1024 ? 'resumable' : 'media',
    });

    if (!response.data.id) {
      throw new Error('Failed to get file ID from Google Drive');
    }

    console.log(`File uploaded successfully with ID: ${response.data.id}`);

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
    
    // Handle specific error types
    if (error instanceof Error) {
      if (error.message.includes('Request entity too large')) {
        return NextResponse.json(
          { error: 'File is too large for upload. Please reduce the number of images or compress them.' },
          { status: 413 }
        );
      }
      if (error.message.includes('quota')) {
        return NextResponse.json(
          { error: 'Google Drive quota exceeded. Please try again later.' },
          { status: 429 }
        );
      }
    }
    
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to upload file' },
      { status: 500 }
    );
  }
} 