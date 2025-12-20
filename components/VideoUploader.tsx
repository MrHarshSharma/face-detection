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
import { ToastContainer, toast } from 'react-toastify'
import 'react-toastify/dist/ReactToastify.css'
import JSZip from 'jszip'
import * as blazeface from '@tensorflow-models/blazeface'
import * as tf from '@tensorflow/tfjs'
import '@tensorflow/tfjs-backend-webgl'
// Optional fallback
import '@tensorflow/tfjs-backend-cpu'

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

      // Upload to Supabase storage using existing API route
      const formData = new FormData();
      const filename = `${email}.zip`;
      formData.append('file', zipContent, filename);
      formData.append('email', email);

      const response = await fetch('/api/upload-to-storage', {
        method: 'POST',
        body: formData,
      });

      const { fileUrl } = await response.json();

      // Open Gmail with Supabase storage link
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
      toast.error('Error uploading file to Supabase storage');
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
  const [captureFrequency, setCaptureFrequency] = useState(2) // Frames per second
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const imageRef = useRef<HTMLImageElement>(null)
  const [isEmailPopupOpen, setEmailPopupOpen] = useState(false)
  const [videoUrl, setVideoUrl] = useState<string | null>(null)
  const [progress, setProgress] = useState(0)
  
  const videoInputRef = useRef<HTMLInputElement>(null)
  const imageInputRef = useRef<HTMLInputElement>(null)

  // Remove model loading states
  const [isModelLoading, setIsModelLoading] = useState(true)
  const [faceModel, setFaceModel] = useState<any>(null)
  const [referenceImageData, setReferenceImageData] = useState<any>(null)

  // Add these state variables
  const [allFrames, setAllFrames] = useState<{url: string, timestamp: string}[]>([])
  const [processingStage, setProcessingStage] = useState<'idle' | 'capturing' | 'filtering'>('idle')

  const handleVideoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      try {
        const file = e.target.files[0];
        
        setSnapshots([]);
        const objectUrl = URL.createObjectURL(file);
        setVideo(file);
        setVideoUrl(objectUrl);
        
        toast.success(`Video uploaded: ${file.name}`);
      } catch (error) {
        console.error("Error handling video upload:", error);
        toast.error("Error uploading video");
      }
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

  // Update BlazeFace model loading with better settings
  useEffect(() => {
    const loadModels = async () => {
      try {
        setIsModelLoading(true)
        
        await tf.ready()
        await tf.setBackend('webgl')
        
        // Load BlazeFace with more permissive settings
        const model = await blazeface.load({
          maxFaces: 3,          // Detect more faces to find best angle
          scoreThreshold: 0.3   // Lower threshold to detect faces at angles
        })
        setFaceModel(model)
        
        setIsModelLoading(false)
        toast.success("Face detection model loaded")
      } catch (error) {
        console.error("Error loading models:", error)
        toast.error("Error loading face detection model")
        setIsModelLoading(false)
      }
    }
    
    loadModels()
  }, [])

  // Add reference image processing
  useEffect(() => {
    const processReferenceImage = async () => {
      if (!referenceImage || !imageRef.current || !faceModel) return
      
      try {
        // Load the reference image
        const img = imageRef.current
        img.src = URL.createObjectURL(referenceImage)
        await new Promise(resolve => { img.onload = () => resolve(null) })
        
        // Detect face in reference image
        const predictions = await faceModel.estimateFaces(img, false)
        
        if (predictions.length === 0) {
          toast.error("No face detected in reference image")
          return
        }
        
        // Store reference face data
        setReferenceImageData(predictions[0])
        toast.success("Reference face detected")
      } catch (error) {
        console.error("Error processing reference image:", error)
        toast.error("Error processing reference image")
      }
    }
    
    if (referenceImage && faceModel && !isModelLoading) {
      processReferenceImage()
    }
  }, [referenceImage, faceModel, isModelLoading])

  // Improve face similarity function to handle different angles
  const isSimilarFace = (face1: any, face2: any) => {
    // Basic validation
    if (!face1 || !face2) return false
    
    // Get face dimensions
    const face1Width = face1.bottomRight[0] - face1.topLeft[0]
    const face1Height = face1.bottomRight[1] - face1.topLeft[1]
    const face2Width = face2.bottomRight[0] - face2.topLeft[0]
    const face2Height = face2.bottomRight[1] - face2.topLeft[1]
    
    // Calculate face areas
    const face1Area = face1Width * face1Height
    const face2Area = face2Width * face2Height
    
    // More permissive size ratio check (allow more variation in size)
    const areaRatio = face1Area / face2Area
    if (areaRatio < 0.3 || areaRatio > 3.5) {
      return false
    }
    
    // Check face proportions (width/height ratio)
    const face1Ratio = face1Width / face1Height
    const face2Ratio = face2Width / face2Height
    const ratioTolerance = 0.4 // Allow 40% variation in face proportions
    
    if (Math.abs(face1Ratio - face2Ratio) > ratioTolerance) {
      return false
    }
    
    // If landmarks are available, use them for better comparison
    if (face1.landmarks && face2.landmarks) {
      try {
        // Get key landmarks (eyes, nose, mouth)
        const landmarks1 = face1.landmarks
        const landmarks2 = face2.landmarks
        
        // Calculate relative positions of landmarks
        const getLandmarkDistances = (landmarks: number[][]) => {
          const distances: number[] = []
          for (let i = 0; i < landmarks.length; i++) {
            for (let j = i + 1; j < landmarks.length; j++) {
              const dist = Math.sqrt(
                Math.pow(landmarks[i][0] - landmarks[j][0], 2) +
                Math.pow(landmarks[i][1] - landmarks[j][1], 2)
              )
              distances.push(dist)
            }
          }
          return distances
        }
        
        const distances1 = getLandmarkDistances(landmarks1)
        const distances2 = getLandmarkDistances(landmarks2)
        
        // Compare relative distances between landmarks
        // This is more robust to rotation and angle changes
        const maxRatioDiff = Math.max(
          ...distances1.map((d1, i) => Math.abs(d1 / distances2[i] - 1))
        )
        
        // Allow more variation in landmark positions
        if (maxRatioDiff > 0.5) { // 50% variation allowed
          return false
        }
        
      } catch (error) {
        console.log("Error comparing landmarks, falling back to basic checks")
      }
    }
    
    // Check confidence scores
    const score1 = face1.score || 0
    const score2 = face2.score || 0
    
    // More permissive score threshold
    if (score2 < 0.3) {
      return false
    }
    
    // If we passed all checks, consider the faces similar
    return true
  }

  // Update generateSnapshots to use two-step process
  const generateSnapshots = async () => {
    if (!video || !videoRef.current || !canvasRef.current || !faceModel) return
    
    setIsProcessing(true)
    setSnapshots([])
    setAllFrames([])
    setProcessingStage('capturing')
    
    try {
      // Step 1: Capture frames first
      const videoElement = videoRef.current
      videoElement.src = URL.createObjectURL(video)
      await new Promise(resolve => {
        videoElement.onloadedmetadata = () => resolve(null)
      })
      
      
      const canvas = canvasRef.current
      canvas.width = videoElement.videoWidth
      canvas.height = videoElement.videoHeight
      
      // Capture frames
      setProgress(0)
      const totalDuration = videoElement.duration
      const frameInterval = 1 / captureFrequency
      const totalFrames = Math.floor(totalDuration * captureFrequency)
      const tempFrames = []
      
      for (let i = 0; i < totalFrames; i++) {
        const timeInSeconds = i * frameInterval
        
        // Skip first and last seconds
        if (timeInSeconds < 1 || timeInSeconds > totalDuration - 1) {
          continue
        }
        
        videoElement.currentTime = timeInSeconds
        await new Promise(resolve => {
          videoElement.onseeked = () => resolve(null)
        })
        
        // Draw frame
        const ctx = canvas.getContext('2d')
        if (!ctx) continue
        
        ctx.drawImage(videoElement, 0, 0, canvas.width, canvas.height)
        
        // Add timestamp
        const timestamp = formatTime(timeInSeconds)
        
        // Save frame
        const dataUrl = canvas.toDataURL('image/jpeg', 0.85)
        tempFrames.push({ url: dataUrl, timestamp })
        
        // Update progress
        const currentProgress = Math.round((i / totalFrames) * 100)
        setProgress(currentProgress)
      }
      
      setAllFrames(tempFrames)
      
      // Step 2: Filter frames by comparing with reference face
      setProcessingStage('filtering')
      setProgress(0)
      
      if (!referenceImageData) {
        toast.error("No face detected in reference image")
        setIsProcessing(false)
        return
      }
      
      const matchedFrames = []
      
      for (let i = 0; i < tempFrames.length; i++) {
        const frame = tempFrames[i]
        
        // Create an image element for this frame
        const img = new Image()
        img.src = frame.url
        await new Promise(resolve => { img.onload = () => resolve(null) })
        
        // Detect faces in this frame
        const facePredictions = await faceModel.estimateFaces(img, false)
        
        if (facePredictions.length > 0) {
          // Check if any face is similar to reference
          for (const face of facePredictions) {
            if (isSimilarFace(referenceImageData, face)) {
              // Draw the face box on the image
              const tempCanvas = document.createElement('canvas')
              tempCanvas.width = img.width
              tempCanvas.height = img.height
              const ctx = tempCanvas.getContext('2d')
              
              if (ctx) {
                ctx.drawImage(img, 0, 0)
                
                // Highlight face
                ctx.strokeStyle = 'lime'
                ctx.lineWidth = 3
                ctx.strokeRect(
                  face.topLeft[0], 
                  face.topLeft[1], 
                  face.bottomRight[0] - face.topLeft[0], 
                  face.bottomRight[1] - face.topLeft[1]
                )
                
                // Add timestamp
                ctx.fillStyle = 'rgba(0, 0, 0, 0.5)'
                ctx.fillRect(10, tempCanvas.height - 40, 100, 30)
                ctx.font = '16px Arial'
                ctx.fillStyle = 'white'
                ctx.fillText(frame.timestamp, 20, tempCanvas.height - 20)
                
                // Create marked up image
                const markedUrl = tempCanvas.toDataURL('image/jpeg', 0.85)
                matchedFrames.push({ url: markedUrl, timestamp: frame.timestamp })
                break // Found a match, no need to check other faces
              }
            }
          }
        }
        
        // Update filtering progress
        const filterProgress = Math.round((i / tempFrames.length) * 100)
        setProgress(filterProgress)
      }
      
      // Set final results
      setSnapshots(matchedFrames)
      setProcessingStage('idle')
      setIsProcessing(false)
      
      // Show completion notification
      if (matchedFrames.length === 0) {
        toast.warning("No matching faces found in video")
      } else {
        toast.success(`Found ${matchedFrames.length} frames with matching faces`)
      }
      
    } catch (error) {
      console.error("Error processing video:", error)
      toast.error("Error processing video")
      setIsProcessing(false)
      setProcessingStage('idle')
    }
  }

  const handleReset = () => {
    setSnapshots([])
    setIsProcessing(false)
    setEmailPopupOpen(false)
  }

  // Clean up object URLs
  useEffect(() => {
    return () => {
      if (videoUrl) {
        URL.revokeObjectURL(videoUrl);
      }
    };
  }, [videoUrl]);

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
                    accept="video/*"
                    className="hidden" 
                    onChange={handleVideoChange}
                    disabled={snapshots.length > 0 || isProcessing}
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
              <label htmlFor="capture-frequency" className="text-sm font-medium text-gray-700">
                Capture Frequency: {captureFrequency} frames per second
              </label>
              <Slider
                id="capture-frequency"
                min={1}
                max={5}
                step={1}
                value={[captureFrequency]}
                onValueChange={(value) => setCaptureFrequency(value[0])}
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
                    ? processingStage === 'capturing'
                      ? `Capturing frames... ${progress}%`
                      : `Filtering faces... ${progress}%`
                    : "Find Matching Faces"
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
