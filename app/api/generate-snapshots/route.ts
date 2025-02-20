import { type NextRequest, NextResponse } from "next/server"
import { get, put } from "@vercel/blob"
import { exec } from "child_process"
import { promisify } from "util"
import { writeFile, unlink, readFile } from "fs/promises"
import { join } from "path"

const execAsync = promisify(exec)

export async function POST(request: NextRequest) {
  const { fileName, snapshotCount } = await request.json()

  // Get the video file from Vercel Blob
  const blob = await get(fileName)
  if (!blob) {
    return NextResponse.json({ error: "Video not found" }, { status: 404 })
  }

  // Download the video to a temporary file
  const videoPath = join("/tmp", fileName)
  await writeFile(videoPath, Buffer.from(await blob.arrayBuffer()))

  // Generate snapshots using ffmpeg
  const snapshotPaths = []
  for (let i = 0; i < snapshotCount; i++) {
    const time = (i + 1) / (snapshotCount + 1)
    const snapshotPath = join("/tmp", `snapshot-${i + 1}.jpg`)
    await execAsync(`ffmpeg -i ${videoPath} -ss ${time} -vframes 1 ${snapshotPath}`)
    snapshotPaths.push(snapshotPath)
  }

  // Upload snapshots to Vercel Blob
  const snapshots = await Promise.all(
    snapshotPaths.map(async (path, index) => {
      const blob = await put(`${fileName}-snapshot-${index + 1}.jpg`, await readFile(path), {
        access: "public",
      })
      return blob.url
    }),
  )

  // Clean up temporary files
  await unlink(videoPath)
  await Promise.all(snapshotPaths.map((path) => unlink(path)))

  return NextResponse.json({ snapshots })
}

