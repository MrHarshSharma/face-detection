import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Create Supabase client for server-side operations
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export async function POST(request: any) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;
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

    // Create a filename using email and timestamp
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const fileName = `${email.split('@')[0]}_${timestamp}.zip`;


    // Upload file to Supabase storage 'zips' bucket
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('zips')
      .upload(fileName, file, {
        cacheControl: '3600',
        upsert: true // Allow overwriting if file exists
      });

    if (uploadError) {
      console.error('Upload error:', uploadError);
      throw new Error(`Failed to upload file: ${uploadError.message}`);
    }


    // Get the public URL for the uploaded file
    const { data: { publicUrl } } = supabase.storage
      .from('zips')
      .getPublicUrl(fileName);


    return NextResponse.json({ 
      fileUrl: publicUrl,
      fileName: fileName,
      message: 'File uploaded successfully to Supabase storage'
    });

  } catch (error) {
    console.error('Detailed error:', error);
    
    // Handle specific error types
    if (error instanceof Error) {
      if (error.message.includes('Request entity too large')) {
        return NextResponse.json(
          { error: 'File is too large for upload. Please reduce the number of images or compress them.' },
          { status: 413 }
        );
      }
      
      if (error.message.includes('storage')) {
        return NextResponse.json(
          { error: 'Storage error occurred. Please try again.' },
          { status: 500 }
        );
      }
    }
    
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to upload file' },
      { status: 500 }
    );
  }
} 