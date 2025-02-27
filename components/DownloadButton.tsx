"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Download } from "lucide-react"
import JSZip from "jszip"

interface DownloadButtonProps {
  snapshots: string[]
  videoName: string
  className?: string
}

export default function DownloadButton({ snapshots, videoName, className }: DownloadButtonProps) {
  const [isDownloading, setIsDownloading] = useState(false)

  const downloadImages = async () => {
    setIsDownloading(true)
    const zip = new JSZip()

    snapshots.forEach((snapshot, index) => {
      const imgData = snapshot.split("base64,")[1]
      zip.file(`face-snapshot-${index + 1}.jpg`, imgData, { base64: true })
    })

    try {
      const content = await zip.generateAsync({ type: "blob" })
      const link = document.createElement("a")
      link.href = URL.createObjectURL(content)
      link.download = `${videoName.split(".")[0]}-face-snapshots.zip`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
    } catch (error) {
      console.error("Error creating zip file:", error)
    }

    setIsDownloading(false)
  }

  return (
    <Button 
      onClick={downloadImages} 
      className={`mt-4 ${className} border-2 text-black border-black bg-white hover:bg-black hover:text-white w-full`} 
      disabled={isDownloading}
    >
      <Download className="w-4 h-4 mr-2" />
      <span className="sm:inline">Download Images</span>
      {/* <span className="inline sm:hidden">Download</span> */}
    </Button>
  )
}

