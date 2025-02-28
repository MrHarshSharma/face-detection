"use client"

import { useState, useRef } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Film, Download } from "lucide-react"
import { ToastContainer, toast } from 'react-toastify'
import 'react-toastify/dist/ReactToastify.css'
import { FFmpeg } from '@ffmpeg/ffmpeg';
import { fetchFile, toBlobURL } from '@ffmpeg/util';

declare global {
  interface HTMLVideoElement {
    captureStream(): MediaStream;
  }
}

export default function ConvertPage() {
  const [video, setVideo] = useState<File | null>(null)
  const [isConverting, setIsConverting] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const videoRef = useRef<HTMLVideoElement>(null)
  const [progress, setProgress] = useState(0)

  const handleVideoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0]
      if (file.type.includes('mts') || file.type.includes('avi') || file.name.toLowerCase().endsWith('.mts')) {
        setVideo(file)
      } else {
        toast.error('Please select an MTS or AVI video file')
      }
    }
  }

  const convertVideo = async () => {
    if (!video) return

    try {
      setIsConverting(true)
      setProgress(0)

      const ffmpeg = new FFmpeg()
      await ffmpeg.load({
        coreURL: await toBlobURL(
          'https://unpkg.com/@ffmpeg/core@0.12.4/dist/umd/ffmpeg-core.js',
          'text/javascript'
        ),
        wasmURL: await toBlobURL(
          'https://unpkg.com/@ffmpeg/core@0.12.4/dist/umd/ffmpeg-core.wasm',
          'application/wasm'
        )
      })

      ffmpeg.on('progress', ({ progress }) => {
        setProgress(Math.round(progress * 100))
      })

      // Write file with simple approach
      const inputName = 'input.' + video.name.split('.').pop()
      await ffmpeg.writeFile(inputName, await fetchFile(video))

      // Convert with optimized settings
      await ffmpeg.exec([
        '-i', inputName,
        '-c:v', 'copy',           // Stream copy
        '-an',                    // Remove audio
        '-fflags', '+genpts',     // Generate timestamps
        '-movflags', 'faststart', // Web optimization
        '-f', 'mp4',             // Force MP4 format
        'output.mp4'
      ])

      const outputData = await ffmpeg.readFile('output.mp4')
      if (!(outputData instanceof Uint8Array)) {
        throw new Error('Expected Uint8Array')
      }

      const blob = new Blob([outputData], { type: 'video/mp4' })
      const url = URL.createObjectURL(blob)

      const a = document.createElement('a')
      a.href = url
      a.download = video.name.replace(/\.[^/.]+$/, '') + '_converted.mp4'
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)

      URL.revokeObjectURL(url)
      if (inputRef.current) inputRef.current.value = ''
      setVideo(null)
      toast.success('Video converted successfully!')

    } catch (error) {
      console.error('Error:', error)
      toast.error('Error converting video. Please try again.')
    } finally {
      setIsConverting(false)
    }
  }

  return (
    <div className="container mx-auto py-8">
      <ToastContainer />
      <Card className="w-full shadow-md">
        <CardContent className="p-6">
          <h1 className="text-2xl font-bold mb-6">Convert Videos </h1>
          
          <div className="space-y-4">
            <div className={`flex items-center justify-center w-full ${video ? 'bg-blue-50' : 'bg-gray-50'}`}>
              <label
                htmlFor="video-upload"
                className="flex flex-col items-center justify-center w-full h-32 border-2 border-gray-300 border-dashed rounded-lg cursor-pointer hover:bg-gray-100"
              >
                <div className="flex flex-col items-center justify-center pt-5 pb-6">
                  <Film className="w-8 h-8 mb-2 text-gray-400" />
                  {video ? (
                    <p className="text-sm text-gray-600">Selected: {video.name}</p>
                  ) : (
                    <p className="text-sm text-gray-600">Upload MTS or AVI video</p>
                  )}
                </div>
                <Input
                  ref={inputRef}
                  id="video-upload"
                  type="file"
                  accept=".mts,.avi"
                  className="hidden"
                  onChange={handleVideoChange}
                  disabled={isConverting}
                />
              </label>
            </div>

            {video && (
              <div className="space-y-4">
                <div className="flex justify-center ">
                  <Button
                    onClick={convertVideo}
                    disabled={isConverting}
                    className="w-[70%] relative border-black border-2 overflow-hidden"
                  >
                    <Download className="w-4 h-4 mr-2" />
                    {isConverting ? `Converting... ${progress}%` : "Convert to MP4"}
                    {isConverting && (
                  <div className="w-full bg-white rounded-full h-2.5 bottom-[-7px] absolute "  style={{ width: `${progress}%` }}>
                    <div 
                      className="bg-white h-2.5 rounded-full transition-all duration-300" 
                      // style={{ width: `${progress}%` }}
                    />
                  </div>
                )}
                  </Button>
                </div>
                
              </div>
            )}
          </div>

          <video ref={videoRef} className="hidden" muted />
        </CardContent>
      </Card>
    </div>
  )
} 