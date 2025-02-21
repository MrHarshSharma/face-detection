"use client"

import type React from "react"

import { useState, useRef, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent } from "@/components/ui/card"
import { Slider } from "@/components/ui/slider"
import { Film, ImageIcon } from "lucide-react"
import SnapshotGallery from "./SnapshotGallery"
import DownloadButton from "./DownloadButton"
import * as faceapi from "face-api.js"



export default function VideoUploader() {
  const [video, setVideo] = useState<File | null>(null)
  const [referenceImage, setReferenceImage] = useState<File | null>(null)
  const [snapshots, setSnapshots] = useState<string[]>([])
  const [isProcessing, setIsProcessing] = useState(false)
  const [similarityThreshold, setSimilarityThreshold] = useState(0.65)
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const imageRef = useRef<HTMLImageElement>(null)

  useEffect(() => {
    loadFaceApiModels()
  }, [])

  const loadFaceApiModels = async () => {
    await faceapi.nets.ssdMobilenetv1.loadFromUri("/models")
    await faceapi.nets.faceLandmark68Net.loadFromUri("/models")
    await faceapi.nets.faceRecognitionNet.loadFromUri("/models")
  }

  const handleVideoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setVideo(e.target.files[0])
      setSnapshots([])
    }
  }

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setReferenceImage(e.target.files[0])
    }
  }

  const generateSnapshots = async () => {
    if (!video || !videoRef.current || !referenceImage || !imageRef.current || !canvasRef.current) return

    setIsProcessing(true)
    setSnapshots([])

    const videoElement = videoRef.current
    videoElement.src = URL.createObjectURL(video)
    await new Promise((resolve) => {
      videoElement.onloadedmetadata = () => resolve(null)
    })

    const imageElement = imageRef.current
    imageElement.src = URL.createObjectURL(referenceImage)
    await new Promise((resolve) => {
      imageElement.onload = () => resolve(null)
    })

    const referenceDescriptor = await getFaceDescriptor(imageElement)
    if (!referenceDescriptor) {
      alert("No face detected in the reference image")
      setIsProcessing(false)
      return
    }

    const canvas = canvasRef.current
    canvas.width = videoElement.videoWidth
    canvas.height = videoElement.videoHeight

    const totalFrames = Math.floor(videoElement.duration * 30) // Assume 30 fps
    const interval = Math.floor(totalFrames / 100) // Check 100 frames throughout the video

    for (let i = 0; i < totalFrames; i += interval) {
      videoElement.currentTime = i / 30
      await new Promise((resolve) => {
        videoElement.onseeked = () => resolve(null)
      })

      const detections = await faceapi.detectAllFaces(videoElement).withFaceLandmarks().withFaceDescriptors()

      for (const detection of detections) {
        const distance = faceapi.euclideanDistance(referenceDescriptor, detection.descriptor)
        if (distance < similarityThreshold) {
          canvas.getContext("2d")?.drawImage(videoElement, 0, 0)
          const snapshot = canvas.toDataURL("image/jpeg")
          setSnapshots((prev) => [...prev, snapshot])
          break // Only take one snapshot per frame, even if multiple faces match
        }
      }
    }

    setIsProcessing(false)
  }

  const getFaceDescriptor = async (imgElement: HTMLImageElement) => {
    const detection = await faceapi.detectSingleFace(imgElement).withFaceLandmarks().withFaceDescriptor()
    return detection?.descriptor
  }

  return (
    <Card className="w-full">
      <CardContent className="p-6">
        <div className="space-y-4">
          <div className={`flex items-center justify-center w-full videocontainer ${video ? 'bg-blue-100' : 'bg-gray-50'}`}>
            <label
              htmlFor="video-upload"
              className="flex flex-col items-center justify-center w-full h-32 border-2 border-gray-300 border-dashed rounded-lg cursor-pointer"
            >
              <div className="flex flex-col items-center justify-center pt-5 pb-6">
                <Film className="w-8 h-8 mb-2 text-gray-400" />
                {video ? <p className="text-sm text-gray-600">Uploaded video: {video.name}</p> : <p className="text-sm text-gray-600">Click to upload video</p>}
              </div>
              <Input id="video-upload" type="file" accept=".mp4, .mkv, .avi, .mov, .wmv, .flv, .mpg, .mpeg" className="hidden" onChange={handleVideoChange} />
            </label>
          </div>
          {/* {video && <p className="text-sm text-gray-600">Selected video: {video.name}</p>} */}

          <div className={`flex items-center justify-center w-full imagecontainer ${referenceImage ? 'bg-blue-100' : 'bg-gray-50'}`}>

            <label
              htmlFor="image-upload"
              className="flex flex-col items-center justify-center w-full h-32 border-2 border-gray-300 border-dashed rounded-lg cursor-pointer"
              >
              <div className="flex flex-col items-center justify-center pt-5 pb-6">
                {referenceImage ? (
                  <img src={URL.createObjectURL(referenceImage)} alt="Selected Image" className="rounded-lg" height={'100px'} width={'100px'} />
                  
                ) : (
                  <>
                  <ImageIcon className="w-8 h-8 mb-2 text-gray-400" />
                  <p className="text-sm text-gray-500">
                    <span className="font-semibold">Click to upload reference image</span>
                  </p>
                  </>
                )}
              </div>
              <Input id="image-upload" type="file" accept="image/*" className="hidden" onChange={handleImageChange} />
            </label>
          </div>

          <div className="space-y-2" style={{display:'none'}}>
            <label htmlFor="similarity-threshold" className="text-sm font-medium text-gray-700">
              Similarity Threshold: {similarityThreshold.toFixed(2)}
            </label>
            <Slider
              id="similarity-threshold"
              min={0}
              max={1}
              step={0.01}
              value={[similarityThreshold]}
              onValueChange={(value) => setSimilarityThreshold(value[0])}
            />
          </div>

          <Button onClick={generateSnapshots} disabled={!video || !referenceImage || isProcessing} className="w-full">
            {isProcessing ? "Processing..." : "Start Face Detection"}
          </Button>
        </div>
        <video ref={videoRef} className="hidden" />
        <canvas ref={canvasRef} className="hidden" />
        <img ref={imageRef} className="hidden" />
        {snapshots.length > 0 && (
          <>
            <SnapshotGallery snapshots={snapshots} />
            <DownloadButton snapshots={snapshots} videoName={video?.name || "video"} />
          </>
        )}
      </CardContent>
    </Card>
  )
}
