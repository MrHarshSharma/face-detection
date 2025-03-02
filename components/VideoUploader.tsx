"use client"

import type React from "react"

import { useState, useRef, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent } from "@/components/ui/card"
import { Slider } from "@/components/ui/slider"
import { Film, ImageIcon, Send } from "lucide-react"
import SnapshotGallery from "./SnapshotGallery"
import DownloadButton from "./DownloadButton"
import * as faceapi from "face-api.js"
import { ToastContainer, toast } from 'react-toastify'
import 'react-toastify/dist/ReactToastify.css'
import JSZip from 'jszip'

interface EmailPopupProps {
  isOpen: boolean;
  onClose: () => void;
  videoName: string | undefined;
  imageName?: string;
  snapshots: string[];
}

// Popup component for sending email
const EmailPopup = ({ isOpen, onClose, videoName, imageName, snapshots }: EmailPopupProps) => {
  const [email, setEmail] = useState("");
  const [isUploading, setIsUploading] = useState(false);

  // Extract email from filename if present
  const extractEmail = (filename: string | undefined) => {
    if (!filename) return "";
    // Remove file extension
    const nameWithoutExtension = filename.replace(/\.[^/.]+$/, "");
    const emailRegex = /([a-zA-Z0-9._-]+@[a-zA-Z0-9._-]+\.[a-zA-Z0-9._-]+)/;
    const match = nameWithoutExtension.match(emailRegex);
    return match ? match[0] : "";
  };

  // Update email when popup opens or image changes
  useEffect(() => {
    if (isOpen) {
      const extractedEmail = extractEmail(imageName);
      setEmail(extractedEmail);
    }
  }, [isOpen, imageName]);

  const createAndUploadZip = async () => {
    try {
      setIsUploading(true);
      
      // Create zip file
      const zip = new JSZip();
      const promises = snapshots.map(async (snapshot, index) => {
        const response = await fetch(snapshot);
        const blob = await response.blob();
        zip.file(`snapshot_${index + 1}.jpg`, blob);
      });
      
      await Promise.all(promises);
      const zipContent = await zip.generateAsync({ type: 'blob' });

      // Upload to Google Drive API
      const formData = new FormData();
      const filename = `${email}.zip`;
      formData.append('file', zipContent);
      formData.append('filename', filename);

      const response = await fetch('/api/upload-to-drive', {
        method: 'POST',
        body: formData,
      });

      const { fileUrl } = await response.json();

      // Open Gmail with drive link
      const subject = "Your Images";
      const body = `This is an automated email. Do not reply to this email.\n\nPlease find your Images here: ${fileUrl}\n\nImages will be automatically vanished after 7 days.\n\nRegards,\nTeam FacialID`;
      const gmailUrl = `https://mail.google.com/mail/?view=cm&fs=1&to=${email}&su=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}&html=true`;
      
      const width = 800;
      const height = 600;
      const left = (window.innerWidth - width) / 2;
      const top = (window.innerHeight - height) / 2;
      
      const newWindow = window.open(
        gmailUrl,
        'Gmail',
        `width=${width},height=${height},left=${left},top=${top},popup=1`
      );

      if (newWindow === null) {
        // Popup was blocked
        toast.info('Please allow popups to open Gmail compose window');
        // Open in new tab as fallback
        window.open(gmailUrl, '_blank');
      }
      
      toast.success('File uploaded successfully!');
      onClose();
    } catch (error) {
      console.error('Error uploading file:', error);
      toast.error('Error uploading file to Google Drive');
    } finally {
      setIsUploading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-96 shadow-xl">
        <h2 className="text-xl font-semibold mb-4">Send Email</h2>
        <Input
          type="email"
          placeholder="Enter your email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="mb-4 w-full"
          required
        />
        <div className="flex gap-2 justify-end">
          <Button
            variant="outline"
            onClick={onClose}
            disabled={isUploading}
          >
            Cancel
          </Button>
          <Button
            onClick={createAndUploadZip}
            disabled={isUploading}
          >
            {isUploading ? 'Uploading...' : 'Send'}
          </Button>
        </div>
      </div>
    </div>
  );
};

// Add interface for snapshot info
interface SnapshotInfo {
  url: string;
  timestamp: string;
}

export default function VideoUploader() {
  const [video, setVideo] = useState<File | null>(null)
  const [referenceImage, setReferenceImage] = useState<File | null>(null)
  const [snapshots, setSnapshots] = useState<SnapshotInfo[]>([])
  const [isProcessing, setIsProcessing] = useState(false)
  const [similarityThreshold, setSimilarityThreshold] = useState(0.50)
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const imageRef = useRef<HTMLImageElement>(null)
  const [isEmailPopupOpen, setEmailPopupOpen] = useState(false)
  const [videoUrl, setVideoUrl] = useState<string | null>(null)
  const [progress, setProgress] = useState(0);

  // Add refs for the input elements
  const videoInputRef = useRef<HTMLInputElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);

  // Add state for model loading
  const [isModelLoading, setIsModelLoading] = useState(true);

  // Update useEffect for model loading
  useEffect(() => {
    const loadModels = async () => {
      try {
        setIsModelLoading(true);
        await Promise.all([
          faceapi.nets.ssdMobilenetv1.loadFromUri("/models"),
          faceapi.nets.faceLandmark68Net.loadFromUri("/models"),
          faceapi.nets.faceRecognitionNet.loadFromUri("/models")
        ]);
        setIsModelLoading(false);
      } catch (error) {
        console.error("Error loading models:", error);
        toast.error("Error loading face detection models");
      }
    };
    loadModels();
  }, []);

  const handleVideoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setVideo(file);
      setVideoUrl(URL.createObjectURL(file));
      setSnapshots([]);
    }
  }

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setReferenceImage(e.target.files[0])
    }
  }

  // Format timestamp function
  const formatTime = (seconds: number) => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = Math.floor(seconds % 60);
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

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
      toast.error("No faces detected in the video");
      setIsProcessing(false)
      return
    }

    const canvas = canvasRef.current
    canvas.width = videoElement.videoWidth
    canvas.height = videoElement.videoHeight

    setProgress(0);
    const totalFrames = Math.floor(videoElement.duration * 10)
    let interval = Math.floor(totalFrames / 30)
    
    const processedTimes = new Set()
    let faceDetected = false

    for (let i = 0; i < totalFrames; i += interval) {
      videoElement.currentTime = i / 30
      await new Promise((resolve) => {
        videoElement.onseeked = () => resolve(null)
      })

      // Draw the full frame
      const ctx = canvas.getContext("2d")
      if (ctx) {
        ctx.drawImage(videoElement, 0, 0, canvas.width, canvas.height)
      }

      // Detect faces
      const detections = await faceapi
        .detectAllFaces(videoElement)
        .withFaceLandmarks()
        .withFaceDescriptors()

      for (const detection of detections) {
        const distance = faceapi.euclideanDistance(referenceDescriptor, detection.descriptor)
        if (distance < similarityThreshold) {
          const timestamp = formatTime(i / 30)
          
          if (!processedTimes.has(timestamp)) {
            processedTimes.add(timestamp)
            
            // Add snapshot immediately to state
            setSnapshots(prev => [...prev, {
              url: canvas.toDataURL("image/jpeg", 0.8),
              timestamp: timestamp
            }])

            // If this is the first face detection, decrease interval
            if (!faceDetected) {
              faceDetected = true
              interval = Math.floor(interval / 3)
              i = Math.max(0, i - interval * 5)
            }
            
            break
          }
        }
      }

      const currentProgress = Math.round((i / totalFrames) * 100)
      setProgress(currentProgress)
    }

    setProgress(0)
    setIsProcessing(false)

    // Show completion notification
    if (processedTimes.size === 0) {
      toast.warning("No matching faces found in the video")
    } else {
      toast.success(`Found ${processedTimes.size} matching faces`)
    }
  }

  const getFaceDescriptor = async (imgElement: HTMLImageElement) => {
    const detection = await faceapi.detectSingleFace(imgElement).withFaceLandmarks().withFaceDescriptor()
    return detection?.descriptor
  }

  const handleReset = () => {
    // Only reset snapshots
    setSnapshots([])
    setIsProcessing(false)
    setEmailPopupOpen(false)
  }

  return (
    <>
      <ToastContainer />
      <Card className="w-full shadow-md">
        <CardContent className="p-6">
          <div className="space-y-4">
            <div className={`flex items-center justify-center w-full videocontainer ${video ? 'bg-blue-100' : 'bg-gray-50'}`}>
              {videoUrl ? (
                <div className="w-full">
                  <video 
                    src={videoUrl} 
                    controls 
                    className="w-full rounded-lg"
                    style={{ maxHeight: '300px' }}
                  />
                </div>
              ) : (
                <label
                  htmlFor="video-upload"
                  className={`flex flex-col items-center justify-center w-full h-32 border-2 border-gray-300 border-dashed rounded-lg ${snapshots.length > 0 ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
                >
                  <div className="flex flex-col items-center justify-center pt-5 pb-6 ">
                    <Film className="w-8 h-8 mb-2 text-gray-400" />
                    {video ? <p className="text-sm text-gray-600">Uploaded video: {video.name}</p> : <p className="text-sm text-gray-600">Click to upload video</p>}
                  </div>
                  <Input 
                    ref={videoInputRef}
                    id="video-upload" 
                    type="file" 
                    accept=".mp4, .mkv, .avi, .mov, .wmv, .flv, .mpg, .mpeg" 
                    className="hidden" 
                    onChange={handleVideoChange}
                    disabled={snapshots.length > 0}
                  />
                </label>
              )}
            </div>
            {/* {video && <p className="text-sm text-gray-600">Selected video: {video.name}</p>} */}

            <div className={`flex items-center justify-center w-full imagecontainer ${referenceImage ? 'bg-blue-100' : 'bg-gray-50'}`}>

              <label
                htmlFor="image-upload"
                className={`flex flex-col items-center justify-center w-full h-32 border-2 border-gray-300 border-dashed rounded-lg ${snapshots.length > 0 ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
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
                <Input 
                  ref={imageInputRef}
                  id="image-upload" 
                  type="file" 
                  accept="image/*" 
                  className="hidden" 
                  onChange={handleImageChange}
                  disabled={snapshots.length > 0}
                />
              </label>
            </div>

            <div className="space-y-2" >
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
                  <div className="flex justify-center">
            <Button 
              onClick={generateSnapshots} 
              disabled={!video || !referenceImage || isProcessing || snapshots.length > 0 || isModelLoading} 
              className={`w-[70%] ${snapshots.length > 0 || isModelLoading ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
                    
              {isModelLoading 
                ? "Loading models..."
                : isProcessing 
                  ? `Processing... ${progress}%`
                  : "Start Face Detection"
              }
            </Button>
                  </div>
          </div>
          <video ref={videoRef} className="hidden" />
          <canvas ref={canvasRef} className="hidden" />
          <img ref={imageRef} className="hidden" />
          
        </CardContent>
      </Card>

        {snapshots.length > 0 && (
      <Card className="w-full mt-5 shadow-md">
      <CardContent className="p-6">
            <>
              <SnapshotGallery 
                snapshots={snapshots} 
                onReset={handleReset}
              />
              <div className="flex flex-col sm:flex-row gap-4 mt-4">
                <DownloadButton 
                  snapshots={snapshots} 
                  videoName={video?.name || "video"} 
                  className="flex-1 w-full"
                />
                <Button 
                  onClick={() => setEmailPopupOpen(true)} 
                  className="border-2 border-black flex-1 md:mt-4 w-full sm:mt-2"
                >
                  <Send className="w-4 h-4 mr-2" />
                  <span className="sm:inline">Send on Email</span>
                  {/* <span className="inline sm:hidden">Email</span> */}
                </Button>
              </div>
            </>
        </CardContent>
      </Card>
          )}
      <EmailPopup 
        isOpen={isEmailPopupOpen} 
        onClose={() => setEmailPopupOpen(false)} 
        videoName={video?.name}
        imageName={referenceImage?.name}
        snapshots={snapshots.map(snapshot => snapshot.url)}
      />
    </>
  )
}
