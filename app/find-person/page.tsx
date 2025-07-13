"use client"

import { useState, useRef, useEffect } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Search, Upload, User, FolderOpen, AlertCircle, ChevronLeft, ChevronRight, X, Mail, Lock, Eye, EyeOff, Scan, CheckCircle2, Clock, ImageIcon, Users, Zap, Target } from "lucide-react"
import { ToastContainer, toast } from 'react-toastify'
import 'react-toastify/dist/ReactToastify.css'
import JSZip from 'jszip'
import { supabase } from '@/lib/supabase'
import Footer from "@/components/Footer"
import { useAuth } from '@/contexts/AuthContext'
import ProtectedRoute from '@/components/auth/ProtectedRoute'
import AuthHeader from '@/components/auth/AuthHeader'
import LoginModal from '@/components/auth/LoginModal'
import { faceApiModelLoader } from '@/lib/faceApiCache'

interface MatchResult {
  file: File
  imageUrl: string
  similarity: number
  fileName: string
}

export default function FindPerson() {
  const { isAuthenticated, user } = useAuth()

  const [referenceImages, setReferenceImages] = useState<File[]>([])
  const [referenceImageUrls, setReferenceImageUrls] = useState<string[]>([])
  const [referenceDate, setReferenceDate] = useState<string>("")
  const [referenceTime, setReferenceTime] = useState<string>("")
  const [referenceEmail, setReferenceEmail] = useState<string>("")
  const [folderImages, setFolderImages] = useState<File[]>([])
  const [folderName, setFolderName] = useState<string>("")
  const [loading, setLoading] = useState(false)
  const [matches, setMatches] = useState<MatchResult[]>([])
  const [selectedMatches, setSelectedMatches] = useState<Set<number>>(new Set())
  const [faceApiLoaded, setFaceApiLoaded] = useState(false)
  const [selectedMatch, setSelectedMatch] = useState<MatchResult | null>(null)
  const [processedCount, setProcessedCount] = useState(0)
  const [processingStarted, setProcessingStarted] = useState(false)
  const [currentImageIndex, setCurrentImageIndex] = useState(0)
  const [sendingEmail, setSendingEmail] = useState(false)
  
  // New state for directly uploaded images
  const [directImages, setDirectImages] = useState<File[]>([])
  const [directImageUrls, setDirectImageUrls] = useState<string[]>([])
  
  const canvasRef = useRef<HTMLCanvasElement>(null)

  // Natural sorting function for filenames with numbers
  const naturalSort = (a: string, b: string): number => {
    const reA = /[^a-zA-Z]/g
    const reN = /[^0-9]/g
    
    const aA = a.replace(reA, "")
    const bA = b.replace(reA, "")
    
    if (aA === bA) {
      const aN = parseInt(a.replace(reN, ""), 10)
      const bN = parseInt(b.replace(reN, ""), 10)
      return aN === bN ? 0 : aN > bN ? 1 : -1
    } else {
      return aA > bA ? 1 : -1
    }
  }

  // Enhanced natural sorting function
  const naturalSortFilenames = (a: MatchResult, b: MatchResult): number => {
    return a.fileName.localeCompare(b.fileName, undefined, {
      numeric: true,
      sensitivity: 'base'
    })
  }

  // Load face-api.js models with caching
  useEffect(() => {
    const loadModels = async () => {
      try {
        setFaceApiLoaded(false)
        console.log('🚀 Starting face-api.js model loading...')
        
        await faceApiModelLoader.loadModelsWithCache()
        
        setFaceApiLoaded(true)
        console.log('✅ All face recognition models loaded successfully')
        toast.success('Face recognition models loaded from cache', {
          toastId: 'models-loaded'
        })
        
        // Display cache info in console
        const cacheInfo = await faceApiModelLoader.getCacheInfo()
        if (cacheInfo.length > 0) {
          const totalSize = cacheInfo.reduce((sum, info) => sum + info.size, 0)
          console.log(`📊 Cache info: ${cacheInfo.length} models, ${(totalSize / 1024 / 1024).toFixed(2)}MB total`)
        }
        
      } catch (error) {
        console.error('❌ Error loading face-api models:', error)
        toast.error('Failed to load face recognition models. Please refresh the page.', {
          toastId: 'models-error'
        })
        setFaceApiLoaded(false)
      }
    }

    loadModels()
  }, [])

  // Load reference images from localStorage if available
  useEffect(() => {
    const loadReferenceImages = async () => {
      try {
        console.log('Checking for reference data...')
        const referenceData = localStorage.getItem('facialRecognitionReference')
        console.log('Raw reference data:', referenceData)
        
        if (referenceData) {
          const data = JSON.parse(referenceData)
          console.log('Parsed reference data:', data)
          
          // Check if data is not too old (within 1 hour)
          const isRecent = Date.now() - data.timestamp < 3600000
          console.log('Is data recent?', isRecent)
          
          if (isRecent && data.images && data.images.length > 0) {
            try {
              // Load all images as reference images
              const imageFiles: File[] = []
              const imageUrls: string[] = []
              
              for (let i = 0; i < data.images.length; i++) {
                const imageUrl = data.images[i]
                const response = await fetch(imageUrl)
                const blob = await response.blob()
                const file = new File([blob], `reference-${data.email}-${i + 1}.jpg`, { type: 'image/jpeg' })
                
                imageFiles.push(file)
                imageUrls.push(imageUrl)
              }
              
              console.log('Setting reference data:', {
                date: data.date,
                time: data.time,
                email: data.email,
                imageCount: imageFiles.length
              })
              
              setReferenceImages(imageFiles)
              setReferenceImageUrls(imageUrls)
              setReferenceDate(data.date || "")
              setReferenceTime(data.time || "")
              setReferenceEmail(data.email || "")
              
              toast.success(`${imageFiles.length} reference images loaded for ${data.email}`)
              
              // Clear the localStorage after use
              localStorage.removeItem('facialRecognitionReference')
            } catch (error) {
              console.error('Error loading reference images:', error)
              toast.error('Failed to load reference images')
            }
          } else {
            console.log('Data is too old or no images found:', {
              isRecent,
              hasImages: data.images?.length > 0
            })
          }
        } else {
          console.log('No reference data found in localStorage')
        }
      } catch (error) {
        console.error('Error parsing reference data:', error)
      }
    }

    loadReferenceImages()
  }, [])

  const handleReferenceImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || [])
    const imageFiles = files.filter(file => file.type.startsWith('image/'))
    
    if (imageFiles.length === 0) {
      toast.error('Please select valid image files')
      return
    }
    
    setReferenceImages(imageFiles)
    setReferenceImageUrls(imageFiles.map(file => URL.createObjectURL(file)))
    toast.success(`${imageFiles.length} reference images selected`)
  }

  const handleFolderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || [])
    const imageFiles = files.filter(file => file.type.startsWith('image/'))
    
    if (imageFiles.length === 0) {
      toast.error('No image files found in the selected folder')
      return
    }
    
    // Get folder name from the first file's path
    if (imageFiles[0].webkitRelativePath) {
      const folderPath = imageFiles[0].webkitRelativePath.split('/')
      setFolderName(folderPath[0])
    }
    
    setFolderImages(imageFiles)
    toast.success(`${imageFiles.length} images loaded from folder`)
  }

  const removeReferenceImage = (indexToRemove: number) => {
    const newReferenceImages = referenceImages.filter((_, index) => index !== indexToRemove)
    const newReferenceImageUrls = referenceImageUrls.filter((_, index) => index !== indexToRemove)
    
    // Revoke the URL to prevent memory leaks
    URL.revokeObjectURL(referenceImageUrls[indexToRemove])
    
    setReferenceImages(newReferenceImages)
    setReferenceImageUrls(newReferenceImageUrls)
    
    toast.success('Reference image removed')
  }

  const getImageElement = (file: File): Promise<HTMLImageElement> => {
    return new Promise((resolve, reject) => {
      const img = new Image()
      img.onload = () => resolve(img)
      img.onerror = reject
      img.src = URL.createObjectURL(file)
    })
  }

  const findMatches = async () => {
    if (referenceImages.length === 0 || folderImages.length === 0) {
      toast.error('Please select both reference images and folder')
      return
    }

    if (!faceApiLoaded) {
      toast.error('Face recognition models are still loading')
      return
    }

    setLoading(true)
    setMatches([])
    setProcessedCount(0)
    setProcessingStarted(true)

    try {
      // @ts-ignore
      const faceapi = window.faceapi
      
      // Get reference face descriptors from all reference images
      const referenceFaceDescriptors: Float32Array[] = []
      
      for (const refImage of referenceImages) {
        const referenceImg = await getImageElement(refImage)
        const referenceDetections = await faceapi
          .detectAllFaces(referenceImg)
          .withFaceLandmarks()
          .withFaceDescriptors()

        // Add all face descriptors from this reference image
        for (const detection of referenceDetections) {
          referenceFaceDescriptors.push(detection.descriptor)
        }
      }

      if (referenceFaceDescriptors.length === 0) {
        toast.error('No faces detected in reference images')
        setLoading(false)
        return
      }

      toast.info(`Found ${referenceFaceDescriptors.length} reference faces from ${referenceImages.length} images`)

      const foundMatches: MatchResult[] = []
      
      // Process images in parallel batches for faster results
      const batchSize = 5 // Process 5 images at once
      const batches = []
      
      for (let i = 0; i < folderImages.length; i += batchSize) {
        batches.push(folderImages.slice(i, i + batchSize))
      }

      let currentProcessedCount = 0

      // Process each batch
      for (const batch of batches) {
        const batchPromises = batch.map(async (file) => {
          try {
            const img = await getImageElement(file)
            
            // Use faster detection settings
            const detections = await faceapi
              .detectAllFaces(img, new faceapi.SsdMobilenetv1Options({ minConfidence: 0.5 }))
              .withFaceLandmarks()
              .withFaceDescriptors()

            // Check each face in the image against all reference faces
            for (const detection of detections) {
              let bestSimilarity = 0
              
              // Compare with each reference face descriptor
              for (const refDescriptor of referenceFaceDescriptors) {
                const distance = faceapi.euclideanDistance(refDescriptor, detection.descriptor)
                const similarity = Math.max(0, 1 - distance) * 100
                bestSimilarity = Math.max(bestSimilarity, similarity)
              }

              // Use the best similarity score
              if (bestSimilarity > 50) {
                return {
                  file,
                  imageUrl: URL.createObjectURL(file),
                  similarity: Math.round(bestSimilarity),
                  fileName: file.name
                }
              }
            }
          } catch (error) {
            console.error(`Error processing ${file.name}:`, error)
          }
          return null
        })

        // Wait for batch to complete
        const batchResults = await Promise.all(batchPromises)
        
        // Add valid results immediately
        const validResults = batchResults.filter(result => result !== null) as MatchResult[]
        if (validResults.length > 0) {
          foundMatches.push(...validResults)
          // Sort by image name with natural sorting
          foundMatches.sort(naturalSortFilenames)
          setMatches([...foundMatches])
        }

        // Update counts
        currentProcessedCount += batch.length
        setProcessedCount(currentProcessedCount)
        
        // Update progress more frequently with correct count
        toast.info(`Processed: ${currentProcessedCount}/${folderImages.length} - Found: ${foundMatches.length} matches`, {
          toastId: 'progress',
          autoClose: 1000
        })
      }

      if (foundMatches.length === 0) {
        toast.info('No matches found')
      } else {
        // Final sort by image name with natural sorting
        foundMatches.sort(naturalSortFilenames)
        setMatches(foundMatches)
        toast.success(`Found ${foundMatches.length} total matches`)
      }
    } catch (error) {
      console.error('Error finding matches:', error)
      toast.error('Error during face recognition')
    } finally {
      setLoading(false)
      setProcessingStarted(false)
    }
  }

  const clearAll = () => {
    setReferenceImages([])
    setReferenceImageUrls([])
    setReferenceDate("")
    setReferenceTime("")
    setReferenceEmail("")
    setFolderImages([])
    setFolderName("")
    setMatches([])
    setSelectedMatches(new Set())
    setSelectedMatch(null)
    setProcessedCount(0)
    setProcessingStarted(false)
    setCurrentImageIndex(0)
    // Don't clear direct images and email as they are independent
  }

  const filteredMatches = matches.filter(m => m.similarity >= 50)

  const handleMatchSelection = (index: number, checked: boolean) => {
    const newSelected = new Set(selectedMatches)
    if (checked) {
      newSelected.add(index)
    } else {
      newSelected.delete(index)
    }
    setSelectedMatches(newSelected)
  }

  const handleSelectAll = () => {
    if (selectedMatches.size === filteredMatches.length) {
      // Deselect all
      setSelectedMatches(new Set())
    } else {
      // Select all
      const allIndices = new Set(filteredMatches.map((_, index) => index))
      setSelectedMatches(allIndices)
    }
  }

  // Image compression utility function
  const compressImage = (file: File, quality: number = 0.7, maxWidth: number = 1920): Promise<Blob> => {
    return new Promise((resolve, reject) => {
      const canvas = document.createElement('canvas')
      const ctx = canvas.getContext('2d')
      const img = new Image()
      
      img.onload = () => {
        // Calculate new dimensions while maintaining aspect ratio
        let { width, height } = img
        if (width > maxWidth) {
          height = (height * maxWidth) / width
          width = maxWidth
        }
        
        canvas.width = width
        canvas.height = height
        
        // Draw and compress the image
        ctx?.drawImage(img, 0, 0, width, height)
        canvas.toBlob((blob) => {
          if (blob) {
            resolve(blob)
          } else {
            reject(new Error('Failed to compress image'))
          }
        }, 'image/jpeg', quality)
      }
      
      img.onerror = () => reject(new Error('Failed to load image'))
      img.src = URL.createObjectURL(file)
    })
  }

  // New function to handle direct image uploads
  const handleDirectImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || [])
    const imageFiles = files.filter(file => file.type.startsWith('image/'))
    
    if (imageFiles.length === 0) {
      toast.error('Please select valid image files')
      return
    }
    
    // Add to existing direct images
    const newImages = [...directImages, ...imageFiles]
    const newUrls = [...directImageUrls, ...imageFiles.map(file => URL.createObjectURL(file))]
    
    setDirectImages(newImages)
    setDirectImageUrls(newUrls)
    toast.success(`${imageFiles.length} images added for direct sending`)
  }

  // New function to remove a direct image
  const removeDirectImage = (indexToRemove: number) => {
    const newDirectImages = directImages.filter((_, index) => index !== indexToRemove)
    const newDirectImageUrls = directImageUrls.filter((_, index) => index !== indexToRemove)
    
    // Revoke the URL to prevent memory leaks
    URL.revokeObjectURL(directImageUrls[indexToRemove])
    
    setDirectImages(newDirectImages)
    setDirectImageUrls(newDirectImageUrls)
    
    toast.success('Image removed')
  }

  // New function to clear all direct images
  const clearDirectImages = () => {
    directImageUrls.forEach(url => URL.revokeObjectURL(url))
    setDirectImages([])
    setDirectImageUrls([])
    toast.success('All direct images cleared')
  }

  const handleSendEmail = async () => {
    const totalSelectedImages = selectedMatches.size + directImages.length
    
    if (totalSelectedImages === 0) {
      toast.warning('Please select matched images or add direct images to send via email')
      return
    }

    if (!referenceEmail) {
      toast.error('No email address found from reference data')
      return
    }

    setSendingEmail(true)

    try {
      toast.info('Creating optimized ZIP file with selected images...')

      // Create ZIP file with selected images
      const zip = new JSZip()
      const folderName = `facial_recognition_matches_${new Date().toISOString().split('T')[0]}`
      const folder = zip.folder(folderName)

      if (!folder) {
        throw new Error('Could not create folder in ZIP')
      }

      // Add selected match images to ZIP with compression
      const selectedImages = Array.from(selectedMatches).map(index => filteredMatches[index])
      let totalSize = 0
      const maxTotalSize = 50 * 1024 * 1024 // 50MB limit for ZIP
      
      toast.info(`Compressing ${totalSelectedImages} images (${selectedImages.length} matches + ${directImages.length} direct)...`)
      
      // Process matched images first
      for (let i = 0; i < selectedImages.length; i++) {
        const match = selectedImages[i]
        try {
          const response = await fetch(match.imageUrl)
          const blob = await response.blob()
          
          // Compress the image to reduce file size
          try {
            const compressedBlob = await compressImage(new File([blob], match.fileName), 0.7, 1920)
            
            const compressedSize = compressedBlob.size
            
            // Check if adding this image would exceed the limit
            if (totalSize + compressedSize > maxTotalSize) {
              toast.warning(`Skipping remaining images to keep ZIP under 50MB limit`)
              break
            }
            
            totalSize += compressedSize
            folder.file(`match_${i + 1}_${match.fileName}`, compressedBlob)
            
            // Update progress
            toast.info(`Processed ${i + 1}/${totalSelectedImages} images (${(totalSize / (1024 * 1024)).toFixed(1)}MB)`, {
              toastId: 'compression-progress'
            })
          } catch (compressionError) {
            console.error(`Failed to compress ${match.fileName}, using original:`, compressionError)
            // Fallback to original image if compression fails
            const originalSize = blob.size
            if (totalSize + originalSize <= maxTotalSize) {
              totalSize += originalSize
              folder.file(`match_${i + 1}_${match.fileName}`, blob)
            } else {
              toast.warning(`Skipping ${match.fileName} - too large`)
            }
          }
        } catch (error) {
          console.error(`Error processing image ${match.fileName}:`, error)
        }
      }

      // Process direct images
      for (let i = 0; i < directImages.length; i++) {
        const directImage = directImages[i]
        try {
          // Compress the direct image
          try {
            const compressedBlob = await compressImage(directImage, 0.7, 1920)
            
            const compressedSize = compressedBlob.size
            
            // Check if adding this image would exceed the limit
            if (totalSize + compressedSize > maxTotalSize) {
              toast.warning(`Skipping remaining images to keep ZIP under 50MB limit`)
              break
            }
            
            totalSize += compressedSize
            folder.file(`direct_${i + 1}_${directImage.name}`, compressedBlob)
            
            // Update progress
            const currentProgress = selectedImages.length + i + 1
            toast.info(`Processed ${currentProgress}/${totalSelectedImages} images (${(totalSize / (1024 * 1024)).toFixed(1)}MB)`, {
              toastId: 'compression-progress'
            })
          } catch (compressionError) {
            console.error(`Failed to compress ${directImage.name}, using original:`, compressionError)
            // Fallback to original image if compression fails
            const originalSize = directImage.size
            if (totalSize + originalSize <= maxTotalSize) {
              totalSize += originalSize
              folder.file(`direct_${i + 1}_${directImage.name}`, directImage)
            } else {
              toast.warning(`Skipping ${directImage.name} - too large`)
            }
          }
        } catch (error) {
          console.error(`Error processing direct image ${directImage.name}:`, error)
        }
      }

      toast.info('Generating ZIP file...')

      // Generate ZIP file with compression
      const zipBlob = await zip.generateAsync({ 
        type: 'blob',
        compression: 'DEFLATE',
        compressionOptions: {
          level: 6
        }
      })
      
      const finalZipSize = zipBlob.size
      console.log(`Final ZIP size: ${(finalZipSize / (1024 * 1024)).toFixed(2)}MB`)
      
      // Check final ZIP size
      if (finalZipSize > 80 * 1024 * 1024) { // 80MB limit
        toast.error('ZIP file is still too large. Please select fewer images.')
        setSendingEmail(false)
        return
      }
      
      const zipFile = new File([zipBlob], `${folderName}.zip`, { type: 'application/zip' })

      toast.info(`Uploading ${(finalZipSize / (1024 * 1024)).toFixed(1)}MB ZIP to Supabase storage...`)

      // Upload to Supabase storage using existing API route
      const uploadFormData = new FormData()
      uploadFormData.append('file', zipFile)
      uploadFormData.append('email', referenceEmail)
      
      const uploadResponse = await fetch('/api/upload-to-storage', {
        method: 'POST',
        body: uploadFormData,
      })

      if (!uploadResponse.ok) {
        const errorText = await uploadResponse.text()
        console.error('Upload failed:', {
          status: uploadResponse.status,
          statusText: uploadResponse.statusText,
          errorText: errorText
        })
        
        let errorData
        try {
          errorData = JSON.parse(errorText)
        } catch {
          errorData = { error: errorText }
        }
        
        throw new Error(errorData.error || 'Failed to upload file')
      }

      const { fileUrl } = await uploadResponse.json()

      // Update database record completion status
      if (referenceEmail) {
        try {
          const { error: updateError } = await supabase
            .from('ref_images')
            .update({ 
              completed: "TRUE", 
              supabaselink: fileUrl, 
              foldername: folderName, 
              user: JSON.parse(localStorage.getItem('findPersonCredentials') || '{}').email 
            })
            .eq('email', referenceEmail)

          if (updateError) {
            console.error('Error updating completion status:', updateError)
            toast.warning('File uploaded successfully, but failed to update completion status')
          } else {
            toast.success('Record marked as completed in database')
          }
        } catch (error) {
          console.error('Database update error:', error)
          toast.warning('File uploaded successfully, but database update failed')
        }
      }

      // Open Gmail compose window with Supabase storage link
      const subject = encodeURIComponent('Special moment with the relic')
      const body = encodeURIComponent(`Dear Esteemed Visitor,

We sincerely thank you and deeply appreciate your patience and understanding.

Please find your special moment with the relic. This secure link will be accessible and will expire in 7 days.

Visitor Details:
- Date: ${referenceDate ? new Date(referenceDate).toLocaleDateString() : 'Not available'}
- Time: ${referenceTime || 'Not available'}
- Total Images: ${totalSelectedImages}
- Download Link: ${fileUrl}

Wishing you blessings and joy,
The Photo Desk Team
`)

      const gmailUrl = `https://mail.google.com/mail/?view=cm&fs=1&to=${referenceEmail}&su=${subject}&body=${body}`
      
      // Open as popup window with small size
      const width = 600
      const height = 700
      const left = (window.screen.width - width) / 2
      const top = (window.screen.height - height) / 2
      
      window.open(
        gmailUrl,
        'EmailPopup',
        `width=${width},height=${height},left=${left},top=${top},resizable=yes,scrollbars=yes,status=yes`
      )

      toast.success(`ZIP file uploaded to Supabase storage and email window opened for ${totalSelectedImages} total images`)
      
    } catch (error) {
      console.error('Error sending email:', error)
      toast.error(error instanceof Error ? error.message : 'Failed to send email')
    } finally {
      setSendingEmail(false)
    }
  }

  const navigateToImage = (index: number) => {
    if (index >= 0 && index < filteredMatches.length) {
      setCurrentImageIndex(index)
      setSelectedMatch(filteredMatches[index])
    }
  }

  const goToPrevious = () => {
    navigateToImage(currentImageIndex - 1)
  }

  const goToNext = () => {
    navigateToImage(currentImageIndex + 1)
  }

  // Keyboard navigation
  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      if (selectedMatch) {
        if (e.key === 'ArrowLeft') {
          e.preventDefault()
          goToPrevious()
        } else if (e.key === 'ArrowRight') {
          e.preventDefault()
          goToNext()
        } else if (e.key === 'Escape') {
          e.preventDefault()
          setSelectedMatch(null)
        }
      }
    }

    window.addEventListener('keydown', handleKeyPress)
    return () => window.removeEventListener('keydown', handleKeyPress)
  }, [selectedMatch, currentImageIndex, filteredMatches.length])

  return (
    <ProtectedRoute>
      <div className="min-h-[80vh]">
        <ToastContainer />
        <canvas ref={canvasRef} style={{ display: 'none' }} />
        
        {/* Login Modal - Now handled globally */}
        <LoginModal />
        
        <div className="max-w-7xl mx-auto px-4 py-8">
          {/* Enhanced Status Indicator */}
          <AuthHeader 
            status={{
              isReady: faceApiLoaded,
              readyText: "AI Models Ready • Face Recognition Active",
              loadingText: "Loading AI Models..."
            }}
          />

          {/* Enhanced Upload Section */}
          <Card className="mb-8 shadow-2xl border-0 bg-white/80 backdrop-blur-sm">
            <CardContent className="p-8">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Enhanced Reference Image Section */}
                <div className="space-y-6">
                  <div className="flex items-center gap-3 mb-6">
                    <div className="w-10 h-10 bg-gradient-to-r from-blue-500 to-indigo-600 rounded-lg flex items-center justify-center">
                      <User className="w-5 h-5 text-white" />
                    </div>
                    <div>
                      <h3 className="text-xl font-semibold text-gray-900">Reference Images</h3>
                      <p className="text-sm text-gray-500">Upload clear photos of the person to find</p>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <Input
                      type="file"
                      accept="image/*"
                      onChange={handleReferenceImageChange}
                      className="w-full h-12 border-2 border-gray-200 focus:border-blue-500 focus:ring-blue-500/20 transition-all duration-300"
                      multiple
                    />
                    
                    {referenceImageUrls.length > 0 && (
                      <div className="space-y-4">
                        <div className="flex items-center gap-2">
                          <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                          <p className="text-sm font-medium text-gray-700">
                            {referenceImages.length} reference image{referenceImages.length > 1 ? 's' : ''} loaded
                          </p>
                        </div>
                        
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                          {referenceImageUrls.map((url, index) => (
                            <div key={index} className="relative group">
                              <div className="relative overflow-hidden rounded-xl border-2 border-white shadow-lg hover:shadow-xl transition-all duration-300">
                                <img
                                  src={url}
                                  alt={`Reference ${index + 1}`}
                                  className="w-full h-24 object-cover group-hover:scale-105 transition-transform duration-300"
                                />
                                <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                              </div>
                              <button
                                type="button"
                                onClick={() => removeReferenceImage(index)}
                                className="absolute -top-2 -right-2 bg-gradient-to-r from-red-500 to-pink-500 text-white p-1.5 rounded-full opacity-0 group-hover:opacity-100 transition-all duration-300 hover:scale-110 shadow-lg"
                                title="Remove image"
                              >
                                <X className="w-3 h-3" />
                              </button>
                              {referenceImages[index]?.name.includes('reference-') && (
                                <div className="absolute bottom-1 left-1 right-1">
                                  <div className="bg-gradient-to-r from-indigo-500 to-purple-600 text-white text-xs px-2 py-1 rounded-full text-center font-medium">
                                    ✨ Pre-loaded
                                  </div>
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                        
                        {(referenceDate || referenceTime || referenceEmail) && (
                          <div className="bg-gradient-to-r from-blue-50 to-indigo-50 p-4 rounded-xl border border-blue-200">
                            <div className="flex items-center gap-2 mb-3">
                              <Target className="w-4 h-4 text-blue-600" />
                              <span className="font-medium text-blue-900">Reference Information</span>
                            </div>
                            <div className="space-y-2 text-sm">
                              {referenceDate && (
                                <div className="flex items-center gap-2 text-blue-700">
                                  <span className="font-medium">Date:</span> 
                                  <span>{new Date(referenceDate).toLocaleDateString()}</span>
                                </div>
                              )}
                              {referenceTime && (
                                <div className="flex items-center gap-2 text-blue-700">
                                  <span className="font-medium">Time:</span> 
                                  <span>{referenceTime}</span>
                                </div>
                              )}
                              {referenceEmail && (
                                <div className="flex items-center gap-2 text-blue-700">
                                  <span className="font-medium">Email:</span> 
                                  <span>{referenceEmail}</span>
                                </div>
                              )}
                            </div>
                          </div>
                        )}
                        
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            referenceImageUrls.forEach(url => URL.revokeObjectURL(url))
                            setReferenceImages([])
                            setReferenceImageUrls([])
                            setReferenceDate("")
                            setReferenceTime("")
                            setReferenceEmail("")
                            toast.success('All reference images cleared')
                          }}
                          className="w-full h-10 text-red-600 hover:text-red-700 hover:bg-red-50 border-2 border-red-200 hover:border-red-300 transition-all duration-300"
                        >
                          <X className="w-4 h-4 mr-2" />
                          Clear All References
                        </Button>
                      </div>
                    )}
                  </div>
                </div>

                {/* Enhanced Folder Selection */}
                <div className="space-y-6">
                  <div className="flex items-center gap-3 mb-6">
                    <div className="w-10 h-10 bg-gradient-to-r from-emerald-500 to-teal-600 rounded-lg flex items-center justify-center">
                      <FolderOpen className="w-5 h-5 text-white" />
                    </div>
                    <div>
                      <h3 className="text-xl font-semibold text-gray-900">Search Folder</h3>
                      <p className="text-sm text-gray-500">Select folder containing images to scan</p>
                    </div>
                  </div>
                  
                  <div className="space-y-4">
                    <Input
                      type="file"
                      {...({ webkitdirectory: "" } as any)}
                      multiple
                      onChange={handleFolderChange}
                      className="w-full h-12 border-2 border-gray-200 focus:border-emerald-500 focus:ring-emerald-500/20 transition-all duration-300"
                    />
                    
                    {folderImages.length > 0 && (
                      <div className="bg-gradient-to-r from-emerald-50 to-teal-50 p-6 rounded-xl border border-emerald-200">
                        <div className="flex items-center gap-3 mb-3">
                          <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                          <span className="font-semibold text-emerald-900">Folder Selected</span>
                        </div>
                        <div className="space-y-2">
                          <p className="text-emerald-700">
                            <span className="font-bold text-lg">{folderImages.length}</span> images ready for scanning
                          </p>
                          {folderName && (
                            <p className="text-sm text-emerald-600">
                              <span className="font-medium">Folder:</span> {folderName}
                            </p>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Enhanced Action Buttons */}
              <div className="flex gap-4 justify-center mt-8 pt-6 border-t border-gray-200">
                <Button 
                  onClick={findMatches} 
                  disabled={!referenceImages.length || folderImages.length === 0 || loading || !faceApiLoaded}
                  className="px-8 h-12 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white shadow-lg hover:shadow-xl transition-all duration-300"
                >
                  {loading ? (
                    <div className="flex items-center gap-2">
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      <span>AI Processing...</span>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <Search className="w-4 h-4" />
                      <span>Start Facial Recognition</span>
                    </div>
                  )}
                </Button>
                
                <Button 
                  variant="outline" 
                  onClick={clearAll}
                  disabled={loading}
                  className="px-8 h-12 border-2 border-gray-300 hover:border-gray-400 hover:bg-gray-50 transition-all duration-300"
                >
                  <X className="w-4 h-4 mr-2" />
                  Clear All
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Enhanced Results Section */}
          {(matches.length > 0 || processingStarted) && (
            <div className="space-y-6">
              {/* Enhanced Processing Status */}
              {loading && (
                <Card className="shadow-lg border-0 bg-gradient-to-r from-blue-50 to-indigo-50">
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-3">
                        {/* <div className="w-6 h-6 border-5 border-blue-900  rounded-full animate-spin" /> */}
                        <div>
                          <span className="text-lg font-semibold text-blue-700">AI Processing Images...</span>
                          <p className="text-sm text-blue-600">Analyzing faces and calculating similarity scores</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-lg font-bold text-blue-600">
                          {processedCount}/{folderImages.length}
                        </div>
                        <div className="text-sm text-blue-500">
                          {filteredMatches.length} matches found
                        </div>
                      </div>
                    </div>
                    <div className="bg-blue-200 rounded-full h-3 overflow-hidden">
                      <div 
                        className="bg-gradient-to-r from-blue-600 to-indigo-600 h-3 rounded-full transition-all duration-300 shadow-sm"
                        style={{ width: `${(processedCount / folderImages.length) * 100}%` }}
                      />
                    </div>
                  </CardContent>
                </Card>
              )}
              
              {/* Enhanced Results Header */}
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 bg-gradient-to-r from-emerald-500 to-teal-600 rounded-lg flex items-center justify-center">
                  <Target className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h2 className="text-2xl font-bold text-gray-900">
                    Detection Results ({filteredMatches.length})
                  </h2>
                  {loading && <p className="text-sm text-gray-500">Live results • 50%+ similarity threshold</p>}
                </div>
              </div>
              
              {/* Enhanced Selection Controls */}
              {filteredMatches.length > 0 && !loading && (
                <div className="bg-gradient-to-r from-gray-50 to-blue-50 rounded-xl p-4 border border-blue-100">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handleSelectAll}
                        className="h-9 px-4 border-2 border-blue-300 hover:border-blue-400 text-blue-700 hover:bg-blue-50 transition-all duration-300"
                      >
                        <CheckCircle2 className="w-4 h-4 mr-2" />
                        {selectedMatches.size === filteredMatches.length ? 'Deselect All' : 'Select All'}
                      </Button>
                      <span className="text-sm font-medium text-blue-700">
                        {selectedMatches.size} of {filteredMatches.length} selected
                      </span>
                    </div>
                  </div>
                </div>
              )}
              
              {/* Enhanced Results Grid */}
              {filteredMatches.length === 0 ? (
                !loading && (
                  <Card className="shadow-lg border-0 bg-white/80 backdrop-blur-sm">
                    <CardContent className="p-12 text-center">
                      <div className="flex flex-col items-center">
                        <div className="w-20 h-20 bg-gradient-to-r from-gray-300 to-gray-400 rounded-full flex items-center justify-center mb-6">
                          <Search className="w-10 h-10 text-white" />
                        </div>
                        <h3 className="text-xl font-semibold text-gray-700 mb-2">No Matches Found</h3>
                        <p className="text-gray-500">No faces found with 50% or higher similarity</p>
                        <p className="text-sm text-gray-400 mt-2">Try using different reference images or check image quality</p>
                      </div>
                    </CardContent>
                  </Card>
                )
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-3 gap-6">
                  {filteredMatches.map((match, index) => (
                    <Card 
                      key={index} 
                      className={`group relative overflow-hidden shadow-lg hover:shadow-2xl transition-all duration-300 border-0 ${
                        selectedMatches.has(index) 
                          ? 'bg-gradient-to-br from-blue-50 to-indigo-50 ring-2 ring-blue-500' 
                          : 'bg-gradient-to-br from-white to-gray-50 hover:from-blue-50 hover:to-indigo-50'
                      }`}
                    >
                      <CardContent className="p-4">
                        <div className="space-y-3">
                          {/* Enhanced Checkbox and Badge */}
                          <div className="flex items-center justify-between">
                            <div className="relative">
                              <input
                                type="checkbox"
                                checked={selectedMatches.has(index)}
                                onChange={(e) => {
                                  e.stopPropagation()
                                  handleMatchSelection(index, e.target.checked)
                                }}
                                className="w-5 h-5 text-blue-600 bg-white border-2 border-gray-300 rounded focus:ring-blue-500 focus:ring-2 transition-all duration-300"
                              />
                            </div>
                            <div className={`px-3 py-1 rounded-full text-xs font-bold shadow-sm ${
                              match.similarity >= 80 
                                ? 'bg-gradient-to-r from-emerald-500 to-teal-600 text-white' 
                                : match.similarity >= 70
                                ? 'bg-gradient-to-r from-yellow-500 to-orange-500 text-white'
                                : 'bg-gradient-to-r from-blue-500 to-indigo-600 text-white'
                            }`}>
                              {match.similarity}% match
                            </div>
                          </div>
                          
                          {/* Enhanced Image */}
                          <div className="relative overflow-hidden rounded-xl border-2 border-white shadow-lg hover:shadow-xl transition-all duration-300 cursor-pointer"
                               onClick={() => {
                                 setCurrentImageIndex(index)
                                 setSelectedMatch(match)
                               }}>
                            <img
                              src={match.imageUrl}
                              alt={match.fileName}
                              className="w-full h-100 object-contain group-hover:scale-105 transition-transform duration-300"
                            />
                            <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                            <div className="absolute bottom-2 left-2 bg-white/90 backdrop-blur-sm rounded-lg px-2 py-1">
                              <span className="text-xs font-medium text-gray-700">#{index + 1}</span>
                            </div>
                          </div>
                          
                          {/* Enhanced Filename */}
                          <div className="space-y-1">
                            <p className="text-sm font-semibold text-gray-900 truncate" title={match.fileName}>
                              {match.fileName}
                            </p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Independent Direct Image Upload Section - Always Visible */}
          <Card className="mt-8 shadow-2xl border-0 bg-white/80 backdrop-blur-sm">
            <CardContent className="p-8">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 bg-gradient-to-r from-purple-500 to-pink-600 rounded-lg flex items-center justify-center">
                  <Upload className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h3 className="text-xl font-semibold text-gray-900">Additional Images</h3>
                  <p className="text-sm text-gray-500">Add extra images to include with the email</p>
                </div>
              </div>

              <div className="space-y-4">
                <Input
                  type="file"
                  accept="image/*"
                  onChange={handleDirectImageChange}
                  className="w-full h-12 border-2 border-gray-200 focus:border-purple-500 focus:ring-purple-500/20 transition-all duration-300"
                  multiple
                />
                
                {directImages.length > 0 && (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <CheckCircle2 className="w-5 h-5 text-purple-500" />
                        <p className="text-sm font-medium text-gray-700">
                          {directImages.length} additional image{directImages.length > 1 ? 's' : ''} added
                        </p>
                      </div>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={clearDirectImages}
                        className="h-8 px-3 text-red-600 hover:text-red-700 hover:bg-red-50 border-red-200 hover:border-red-300 transition-all duration-300"
                      >
                        <X className="w-3 h-3 mr-1" />
                        Clear All
                      </Button>
                    </div>
                    
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-3">
                      {directImageUrls.map((url, index) => (
                        <div key={index} className="relative group">
                          <div className="relative overflow-hidden rounded-xl border-2 border-white shadow-lg hover:shadow-xl transition-all duration-300">
                            <img
                              src={url}
                              alt={`Additional ${index + 1}`}
                              className="w-full h-20 object-cover group-hover:scale-105 transition-transform duration-300"
                            />
                            <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                          </div>
                          <button
                            type="button"
                            onClick={() => removeDirectImage(index)}
                            className="absolute -top-2 -right-2 bg-gradient-to-r from-red-500 to-pink-500 text-white p-1.5 rounded-full opacity-0 group-hover:opacity-100 transition-all duration-300 hover:scale-110 shadow-lg"
                            title="Remove image"
                          >
                            <X className="w-3 h-3" />
                          </button>
                          <div className="absolute bottom-1 left-1 right-1">
                            <div className="bg-gradient-to-r from-purple-500 to-pink-600 text-white text-xs px-2 py-1 rounded-full text-center font-medium">
                              +{index + 1}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Enhanced Send Email Button */}
          {(filteredMatches.length > 0 || directImages.length > 0) && !loading && (
            <div className="mt-8 flex justify-end">
              <Button
                onClick={handleSendEmail}
                disabled={(selectedMatches.size === 0 && directImages.length === 0) || sendingEmail}
                className="px-8 h-12 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white shadow-lg hover:shadow-xl transition-all duration-300"
              >
                {sendingEmail ? (
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    <span>Uploading...</span>
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <Mail className="w-4 h-4" />
                    <span>Send Email {(selectedMatches.size > 0 || directImages.length > 0) && `(${selectedMatches.size + directImages.length})`}</span>
                  </div>
                )}
              </Button>
            </div>
          )}

          {/* Enhanced Image Modal */}
          {selectedMatch && (
            <div 
              className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4"
              onClick={() => setSelectedMatch(null)}
            >
              <div className="bg-white/95 backdrop-blur-sm rounded-2xl p-6 max-w-5xl w-full max-h-[90vh] overflow-auto shadow-2xl border border-white/20" onClick={e => e.stopPropagation()}>
                {/* Enhanced Header */}
                <div className="flex justify-between items-center mb-6">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 bg-gradient-to-r from-indigo-500 to-purple-600 rounded-lg flex items-center justify-center">
                      <ImageIcon className="w-5 h-5 text-white" />
                    </div>
                    <div>
                      <h3 className="text-xl font-semibold text-gray-900">{selectedMatch.fileName}</h3>
                      <div className="flex items-center gap-4 text-sm text-gray-600">
                        <div className={`px-2 py-1 rounded-full text-xs font-medium ${
                          selectedMatch.similarity >= 80 
                            ? 'bg-emerald-100 text-emerald-700' 
                            : selectedMatch.similarity >= 70
                            ? 'bg-yellow-100 text-yellow-700'
                            : 'bg-blue-100 text-blue-700'
                        }`}>
                          {selectedMatch.similarity}% similarity
                        </div>
                        <span>{currentImageIndex + 1} of {filteredMatches.length}</span>
                      </div>
                    </div>
                    {/* Enhanced Checkbox */}
                    <div className="flex items-center gap-2 ml-auto">
                      <input
                        type="checkbox"
                        checked={selectedMatches.has(currentImageIndex)}
                        onChange={(e) => handleMatchSelection(currentImageIndex, e.target.checked)}
                        className="w-5 h-5 text-blue-600 bg-white border-2 border-gray-300 rounded focus:ring-blue-500 focus:ring-2"
                      />
                      <label className="text-sm font-medium text-gray-700">Select</label>
                    </div>
                  </div>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={() => setSelectedMatch(null)}
                    className="rounded-full"
                  >
                    <X className="w-4 h-4" />
                  </Button>
                </div>
                
                {/* Enhanced Image Container */}
                <div className="relative">
                  <div className="overflow-hidden rounded-xl border-2 border-white shadow-2xl">
                    <img
                      src={selectedMatch.imageUrl}
                      alt={selectedMatch.fileName}
                      className="w-full max-h-[60vh] object-contain bg-gray-100"
                    />
                  </div>
                  
                  {/* Enhanced Navigation */}
                  {filteredMatches.length > 1 && (
                    <>
                      <Button
                        variant="outline"
                        size="sm"
                        className="absolute left-4 top-1/2 transform -translate-y-1/2 bg-white/90 backdrop-blur-sm hover:bg-white shadow-lg border-2"
                        onClick={goToPrevious}
                        disabled={currentImageIndex === 0}
                      >
                        <ChevronLeft className="w-4 h-4" />
                      </Button>
                      
                      <Button
                        variant="outline"
                        size="sm"
                        className="absolute right-4 top-1/2 transform -translate-y-1/2 bg-white/90 backdrop-blur-sm hover:bg-white shadow-lg border-2"
                        onClick={goToNext}
                        disabled={currentImageIndex === filteredMatches.length - 1}
                      >
                        <ChevronRight className="w-4 h-4" />
                      </Button>
                    </>
                  )}
                </div>
                
                {/* Enhanced Footer */}
                {filteredMatches.length > 1 && (
                  <div className="mt-6 text-center">
                    <div className="bg-gray-50 rounded-lg p-3">
                      <p className="text-sm text-gray-600">
                        <span className="font-medium">Navigation:</span> Use arrow keys (← →) • Press Esc to close • Use checkbox to select/deselect
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Enhanced Info Section */}
          {/* <Card className="mt-8 shadow-lg border-0 bg-gradient-to-r from-blue-50 to-indigo-50">
            <CardContent className="p-8">
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 bg-gradient-to-r from-blue-500 to-indigo-600 rounded-xl flex items-center justify-center shrink-0">
                  <AlertCircle className="w-6 h-6 text-white" />
                </div>
                <div className="text-blue-800">
                  <h3 className="text-lg font-semibold mb-3">How Facial Recognition Works</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                    <ul className="space-y-2">
                      <li className="flex items-start gap-2">
                        <CheckCircle2 className="w-4 h-4 text-blue-600 mt-0.5 shrink-0" />
                        <span>Upload clear reference images containing the person's face</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <CheckCircle2 className="w-4 h-4 text-blue-600 mt-0.5 shrink-0" />
                        <span>Select a folder containing images to search through</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <CheckCircle2 className="w-4 h-4 text-blue-600 mt-0.5 shrink-0" />
                        <span>AI detects faces and compares them with references</span>
                      </li>
                    </ul>
                    <ul className="space-y-2">
                      <li className="flex items-start gap-2">
                        <CheckCircle2 className="w-4 h-4 text-blue-600 mt-0.5 shrink-0" />
                        <span>Results ranked by highest similarity percentage</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <CheckCircle2 className="w-4 h-4 text-blue-600 mt-0.5 shrink-0" />
                        <span>All processing happens locally in your browser</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <CheckCircle2 className="w-4 h-4 text-blue-600 mt-0.5 shrink-0" />
                        <span>Select matches and send via email for sharing</span>
                      </li>
                    </ul>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card> */}
        </div>
      </div>
      
      <Footer />
    </ProtectedRoute>
  )
} 