// import { type NextRequest, NextResponse } from "next/server"
// import { put } from "@vercel/blob"
// import { join } from "path"
// import { writeFile, readFile, unlink } from "fs/promises"

// export async function POST(request: NextRequest) {
//   const formData = await request.formData()
//   const file = formData.get("file") as File
//   const chunkIndex = Number.parseInt(formData.get("chunkIndex") as string)
//   const totalChunks = Number.parseInt(formData.get("totalChunks") as string)
//   const fileName = formData.get("fileName") as string

//   if (!file) {
//     return NextResponse.json({ error: "No file uploaded" }, { status: 400 })
//   }

//   const bytes = await file.arrayBuffer()
//   const buffer = Buffer.from(bytes)

//   // Save chunk to temporary file
//   const tempDir = "/tmp/video-uploads"
//   const chunkPath = join(tempDir, `${fileName}.part${chunkIndex}`)
//   await writeFile(chunkPath, buffer)

//   // If this is the last chunk, combine all chunks and upload to Vercel Blob
//   if (chunkIndex === totalChunks - 1) {
//     const combinedBuffer = Buffer.concat(
//       await Promise.all(Array.from({ length: totalChunks }, (_, i) => readFile(join(tempDir, `${fileName}.part${i}`)))),
//     )

//     // Upload combined file to Vercel Blob
//     const blob = await put(fileName, combinedBuffer, {
//       access: "public",
//     })

//     // Clean up temporary files
//     await Promise.all(Array.from({ length: totalChunks }, (_, i) => unlink(join(tempDir, `${fileName}.part${i}`))))

//     return NextResponse.json({ success: true, url: blob.url })
//   }

//   return NextResponse.json({ success: true, chunkIndex })
// }

// export const runtime = 'edge';
