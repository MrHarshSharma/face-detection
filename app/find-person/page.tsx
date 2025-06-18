"use client"

import { useState, useRef, useEffect } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Search, Upload, User, FolderOpen, AlertCircle, ChevronLeft, ChevronRight, X, Mail, Lock, Eye, EyeOff } from "lucide-react"
import { ToastContainer, toast } from 'react-toastify'
import 'react-toastify/dist/ReactToastify.css'
import JSZip from 'jszip'

interface MatchResult {
  file: File
  imageUrl: string
  similarity: number
  fileName: string
}

// JWT creation for Google Service Account authentication
const AdminEmail = process.env.ADMIN_EMAIL
const AdminPassword = process.env.ADMIN_PASSWORD

export default function FindPerson() {
  // Authentication states
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [showLoginModal, setShowLoginModal] = useState(true)
  const [loginEmail, setLoginEmail] = useState("")
  const [loginPassword, setLoginPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [loginLoading, setLoginLoading] = useState(false)

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
  
  const canvasRef = useRef<HTMLCanvasElement>(null)

  // Check for saved credentials on component mount
  useEffect(() => {
    const checkSavedCredentials = () => {
      try {
        const savedCredentials = localStorage.getItem('findPersonCredentials')
        if (savedCredentials) {
          const { email, password } = JSON.parse(savedCredentials)
          if (email === "exposition@gmail.com" && password === "exposition") {
            setLoginEmail(email)
            setLoginPassword(password)
            setIsAuthenticated(true)
            setShowLoginModal(false)
            toast.success('Automatically logged in with saved credentials')
          } else {
            // Clear invalid credentials
            localStorage.removeItem('findPersonCredentials')
          }
        }
      } catch (error) {
        console.error('Error checking saved credentials:', error)
        localStorage.removeItem('findPersonCredentials')
      }
    }

    checkSavedCredentials()
  }, [])

  // Load face-api.js models
  useEffect(() => {
    const loadModels = async () => {
      try {
        // Load face-api.js from CDN
        const script = document.createElement('script')
        script.src = 'https://cdn.jsdelivr.net/npm/face-api.js@0.22.2/dist/face-api.min.js'
        script.onload = async () => {
          // @ts-ignore
          const faceapi = window.faceapi
          
          await Promise.all([
            faceapi.nets.ssdMobilenetv1.loadFromUri('/models'),
            faceapi.nets.faceLandmark68Net.loadFromUri('/models'),
            faceapi.nets.faceRecognitionNet.loadFromUri('/models'),
          ])
          
          setFaceApiLoaded(true)
          toast.success('Face recognition models loaded')
        }
        script.onerror = () => {
          toast.error('Failed to load face recognition models')
        }
        document.head.appendChild(script)
      } catch (error) {
        console.error('Error loading face-api models:', error)
        toast.error('Failed to initialize face recognition')
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
          // Sort and update matches immediately
          foundMatches.sort((a, b) => b.similarity - a.similarity)
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

  const handleSendEmail = async () => {
    if (selectedMatches.size === 0) {
      toast.warning('Please select at least one image to send via email')
      return
    }

    if (!referenceEmail) {
      toast.error('No email address found from reference data')
      return
    }

    setSendingEmail(true)

    try {
      // toast.info('Creating ZIP file with selected images...')

      // Create ZIP file with selected images
      const zip = new JSZip()
      const folderName = `facial_recognition_matches_${new Date().toISOString().split('T')[0]}`
      const folder = zip.folder(folderName)

      if (!folder) {
        throw new Error('Could not create folder in ZIP')
      }

      // Add selected images to ZIP
      const selectedImages = Array.from(selectedMatches).map(index => filteredMatches[index])
      
      for (let i = 0; i < selectedImages.length; i++) {
        const match = selectedImages[i]
        try {
          const response = await fetch(match.imageUrl)
          const blob = await response.blob()
          folder.file(`image_${i + 1}_${match.fileName}`, blob)
        } catch (error) {
          console.error(`Error adding image ${match.fileName} to ZIP:`, error)
        }
      }

      // Generate ZIP file
      const zipBlob = await zip.generateAsync({ type: 'blob' })
      const zipFile = new File([zipBlob], `${folderName}.zip`, { type: 'application/zip' })

      toast.info('Uploading to Google Drive...')

      // Upload to Google Drive using existing API route
      const uploadFormData = new FormData()
      uploadFormData.append('file', zipFile)
      uploadFormData.append('email', referenceEmail)
      
      const uploadResponse = await fetch('/api/upload-to-drive', {
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

      // Open Gmail compose window with drive link
      const subject = encodeURIComponent('Special moment with the relic')
      const body = encodeURIComponent(`Dear Esteemed Visitor,

We sincerely thank you and deeply appreciate your patience and understanding.

Please find your special moment with the relic. This link will be accessible through Google Drive and will expire in 7 days.

Visitor Details:
- Date: ${referenceDate ? new Date(referenceDate).toLocaleDateString() : 'Not available'}
- Time: ${referenceTime || 'Not available'}
- Images: ${selectedMatches.size}
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

      toast.success(`ZIP file uploaded to Google Drive and email window opened for ${selectedMatches.size} selected images`)
      
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

  // Authentication handler
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!loginEmail.trim() || !loginPassword.trim()) {
      toast.error('Please enter both email and password')
      return
    }

    setLoginLoading(true)

    try {
      // Simulate authentication - replace with your actual authentication logic
      if(loginEmail === "exposition@gmail.com" && loginPassword === "exposition") {
        
      await new Promise(resolve => setTimeout(resolve, 1000)) // Simulate API call
      
      // For demo purposes, accept any email/password combination
      // In production, you'd validate against your authentication system
      setIsAuthenticated(true)
      setShowLoginModal(false)
      
      // Save credentials to localStorage
      const credentials = {
        email: loginEmail,
        password: loginPassword
      }
      localStorage.setItem('findPersonCredentials', JSON.stringify(credentials))
      
      toast.success('Successfully authenticated!')
    }else{
      await new Promise(resolve => setTimeout(resolve, 1000)) // Simulate API call

      toast.error('Invalid email or password')
    }
    } catch (error) {
      toast.error('Authentication failed. Please try again.')
    } finally {
      setLoginLoading(false)
    }
  }

  const handleLogout = () => {
    setIsAuthenticated(false)
    setShowLoginModal(true)
    setLoginEmail("")
    setLoginPassword("")
    
    // Clear saved credentials from localStorage
    localStorage.removeItem('findPersonCredentials')
    
    // Clear all data when logging out
    clearAll()
    
    toast.info('Logged out successfully')
  }

  return (
    <>
      <ToastContainer />
      <canvas ref={canvasRef} style={{ display: 'none' }} />
      
      {/* Login Modal */}
      {showLoginModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg p-8 max-w-md w-full">
            <div className="text-center mb-6">
              <div className="flex justify-center mb-4">
                <div className="bg-blue-100 p-3 rounded-full">
                  <Lock className="w-8 h-8 text-blue-600" />
                </div>
              </div>
              <h2 className="text-2xl font-bold text-gray-900 mb-2">Authentication Required</h2>
              <p className="text-gray-600">Please enter your credentials to access the facial recognition system</p>
            </div>
            
            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Email Address</label>
                <Input
                  type="email"
                  value={loginEmail}
                  onChange={(e) => setLoginEmail(e.target.value)}
                  placeholder="Enter your email"
                  className="w-full"
                  required
                  disabled={loginLoading}
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Password</label>
                <div className="relative">
                  <Input
                    type={showPassword ? "text" : "password"}
                    value={loginPassword}
                    onChange={(e) => setLoginPassword(e.target.value)}
                    placeholder="Enter your password"
                    className="w-full pr-10"
                    required
                    disabled={loginLoading}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                    disabled={loginLoading}
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
              
              <Button
                type="submit"
                disabled={loginLoading}
                className="w-full"
              >
                {loginLoading ? (
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    <span>Authenticating...</span>
                  </div>
                ) : (
                  <>
                    <Lock className="w-4 h-4 mr-2" />
                    Sign In
                  </>
                )}
              </Button>
            </form>
            
            <div className="mt-4 text-center text-sm text-gray-500">
              For demo purposes, any email and password combination will work
            </div>
          </div>
        </div>
      )}

      {/* Main Content - Only show when authenticated */}
      {isAuthenticated && (
        <div className="container mx-auto px-4 py-8">
          <div className="max-w-6xl mx-auto">
            {/* Header */}
            <div className="text-center mb-8">
              <div className="flex justify-between items-start mb-4">
                <div className="flex-1">
                  <h1 className="text-3xl font-bold text-gray-900 mb-2">Find Person in Images</h1>
                  <p className="text-gray-600">Upload reference images and select a folder to find matching faces</p>
                </div>
                <Button
                  variant="outline"
                  onClick={handleLogout}
                  className="text-red-600 hover:text-red-700 hover:bg-red-50 border-red-200"
                >
                  <X className="w-4 h-4 mr-1" />
                  Logout
                </Button>
              </div>
            </div>

            {/* Status Indicator */}
            <div className="flex justify-center mb-6">
              <div className={`flex items-center gap-2 px-4 py-2 rounded-full ${
                faceApiLoaded ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'
              }`}>
                {faceApiLoaded ? (
                  <>
                    <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                    <span>Face Recognition Ready</span>
                  </>
                ) : (
                  <>
                    <div className="w-3 h-3 bg-yellow-500 rounded-full animate-pulse"></div>
                    <span>Loading Face Recognition Models...</span>
                  </>
                )}
              </div>
            </div>

            {/* Upload Section */}
            <Card className="mb-8">
              <CardContent className="p-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Reference Image */}
                  <div className="space-y-4">
                    <label className="text-sm font-medium flex items-center gap-2">
                      <User className="w-4 h-4" />
                      Reference Images
                    </label>
                    
                    {/* Date and Time Information */}
                   

                    <Input
                      type="file"
                      accept="image/*"
                      onChange={handleReferenceImageChange}
                      className="w-full"
                      multiple
                    />
                    {referenceImageUrls.length > 0 && (
                      <div className="mt-4">
                        <p className="text-sm text-gray-600 mb-2">
                          {referenceImages.length} reference image{referenceImages.length > 1 ? 's' : ''} selected
                        </p>
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                          {referenceImageUrls.map((url, index) => (
                            <div key={index} className="relative group">
                              <img
                                src={url}
                                alt={`Reference ${index + 1}`}
                                className="w-full h-32 object-cover rounded-lg border"
                              />
                              {/* Remove button */}
                              <button
                                type="button"
                                onClick={() => removeReferenceImage(index)}
                                className="absolute top-1 right-1 bg-red-500 hover:bg-red-600 text-white p-1 rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-200 shadow-lg"
                                title="Remove image"
                              >
                                <X className="w-3 h-3" />
                              </button>
                              {referenceImages[index]?.name.includes('reference-') && (
                                <div className="absolute bottom-1 left-1 right-1">
                                  <p className="text-xs text-white bg-indigo-600 bg-opacity-80 px-2 py-1 rounded text-center">
                                    ✨ Pre-loaded
                                  </p>
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                        {referenceImages.length > 0 && (
                          <div className="mt-3">
                            {(referenceDate || referenceTime) && (
                              <div className="bg-gray-50 p-3 rounded-lg space-y-1">
                                <div className="flex items-center gap-2">
                                  <p className="text-sm text-gray-600">
                                    <span className="font-medium">Date:</span> {referenceDate ? new Date(referenceDate).toLocaleDateString() : 'Not available'}
                                  </p>
                                </div>
                                <div className="flex items-center gap-2">
                                  <p className="text-sm text-gray-600">
                                    <span className="font-medium">Time:</span> {referenceTime || 'Not available'}
                                  </p>
                                </div>
                                {referenceEmail && (
                                  <div className="flex items-center gap-2">
                                    <p className="text-sm text-gray-600">
                                      <span className="font-medium">Email:</span> {referenceEmail}
                                    </p>
                                  </div>
                                )}
                              </div>
                            )}
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                // Revoke all URLs to prevent memory leaks
                                referenceImageUrls.forEach(url => URL.revokeObjectURL(url))
                                setReferenceImages([])
                                setReferenceImageUrls([])
                                setReferenceDate("")
                                setReferenceTime("")
                                setReferenceEmail("")
                                toast.success('All reference images cleared')
                              }}
                              className="text-red-600 mt-5 hover:text-red-700 hover:bg-red-50 border-red-200"
                            >
                              <X className="w-4 h-4 mr-1" />
                              Clear All References
                            </Button>
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Folder Selection */}
                  <div className="space-y-4">
                    <label className="text-sm font-medium flex items-center gap-2">
                      <FolderOpen className="w-4 h-4" />
                      Image Folder
                    </label>
                    <Input
                      type="file"
                      {...({ webkitdirectory: "" } as any)}
                      multiple
                      onChange={handleFolderChange}
                      className="w-full"
                    />
                    {folderImages.length > 0 && (
                      <div className="mt-4 p-4 bg-blue-50 rounded-lg space-y-2">
                        <p className="text-sm text-blue-700">
                          <strong>{folderImages.length}</strong> images selected from folder
                        </p>
                        {folderName && (
                          <p className="text-sm text-blue-700">
                            <span className="font-medium">Folder:</span> {folderName}
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="flex gap-4 justify-end mt-8">
                  <Button 
                    onClick={findMatches} 
                    disabled={!referenceImages.length || folderImages.length === 0 || loading || !faceApiLoaded}
                    className="px-8"
                  >
                    {loading ? (
                      <div className="flex items-center gap-2">
                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        <span>Finding Matches...</span>
                      </div>
                    ) : (
                      <>
                        <Search className="w-4 h-4 mr-2" />
                        Find Matches
                      </>
                    )}
                  </Button>
                  
                  <Button 
                    variant="outline" 
                    onClick={clearAll}
                    disabled={loading}
                    className="px-8"
                  >
                    Clear All
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Results Section */}
            {(matches.length > 0 || processingStarted) && (
              <div className="space-y-4">
                {/* Processing Status */}
                {loading && (
                  <Card className="bg-blue-50">
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
                          <span className="text-blue-700 font-medium">Processing Images...</span>
                        </div>
                        <div className="text-blue-600">
                          {processedCount}/{folderImages.length} processed • {filteredMatches.length} matches found
                        </div>
                      </div>
                      <div className="mt-2 bg-blue-200 rounded-full h-2">
                        <div 
                          className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                          style={{ width: `${(processedCount / folderImages.length) * 100}%` }}
                        />
                      </div>
                    </CardContent>
                  </Card>
                )}
                
                <h2 className="text-xl font-semibold">
                  Found Matches ({filteredMatches.length})
                  {loading && <span className="text-sm text-gray-500 ml-2">(Live Results - 50%+ similarity)</span>}
                </h2>
                
                {/* Selection Controls */}
                {filteredMatches.length > 0 && !loading && (
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-4">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handleSelectAll}
                        className="px-4"
                      >
                        {selectedMatches.size === filteredMatches.length ? 'Deselect All' : 'Select All'}
                      </Button>
                      <span className="text-sm text-gray-600">
                        {selectedMatches.size} of {filteredMatches.length} selected
                      </span>
                    </div>
                  </div>
                )}
                
                {filteredMatches.length === 0 ? (
                  !loading && (
                    <Card>
                      <CardContent className="p-8 text-center">
                        <div className="text-gray-500">
                          <Search className="w-12 h-12 mx-auto mb-4 opacity-50" />
                          <p className="text-lg font-medium mb-2">No matches found</p>
                          <p>No matches found with 50% or higher similarity</p>
                        </div>
                      </CardContent>
                    </Card>
                  )
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                    {filteredMatches.map((match, index) => (
                      <Card 
                        key={index} 
                        className={`hover:shadow-lg transition-all duration-300 cursor-pointer animate-in fade-in slide-in-from-bottom-4 ${
                          selectedMatches.has(index) ? 'ring-2 ring-blue-500 bg-blue-50' : ''
                        }`}
                      >
                        <CardContent className="p-4">
                          <div className="space-y-3">
                            {/* Checkbox */}
                            <div className="flex items-center justify-between">
                              <input
                                type="checkbox"
                                checked={selectedMatches.has(index)}
                                onChange={(e) => {
                                  e.stopPropagation()
                                  handleMatchSelection(index, e.target.checked)
                                }}
                                className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500 focus:ring-2"
                              />
                              <div className={`px-2 py-1 rounded-full text-xs font-medium ${
                                match.similarity >= 80 
                                  ? 'bg-green-100 text-green-700' 
                                  : match.similarity >= 70
                                  ? 'bg-yellow-100 text-yellow-700'
                                  : 'bg-blue-100 text-blue-700'
                              }`}>
                                {match.similarity}% match
                              </div>
                            </div>
                            
                            <img
                              src={match.imageUrl}
                              alt={match.fileName}
                              className="w-full h-48 object-cover rounded-lg"
                              onClick={() => {
                                setCurrentImageIndex(index)
                                setSelectedMatch(match)
                              }}
                            />
                            <div>
                              <p className="text-sm font-medium truncate" title={match.fileName}>
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

            {/* Send Email Button */}
            {filteredMatches.length > 0 && !loading && (
              <div className="mt-6 flex justify-end">
                <Button
                  onClick={handleSendEmail}
                  disabled={selectedMatches.size === 0 || sendingEmail}
                  className="px-6 py-2"
                >
                  {sendingEmail ? (
                    <div className="flex items-center gap-2">
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      <span>Uploading...</span>
                    </div>
                  ) : (
                    <>
                      <Mail className="w-4 h-4 mr-2" />
                      Send Email {selectedMatches.size > 0 && `(${selectedMatches.size})`}
                    </>
                  )}
                </Button>
              </div>
            )}

            {/* Image Modal */}
            {selectedMatch && (
              <div 
                className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
                onClick={() => setSelectedMatch(null)}
              >
                <div className="bg-white rounded-lg p-4 max-w-4xl w-full max-h-[90vh] overflow-auto relative" onClick={e => e.stopPropagation()}>
                  {/* Header with navigation info */}
                  <div className="flex justify-between items-center mb-4">
                    <div className="flex items-center gap-4">
                      <div>
                        <h3 className="text-lg font-medium">{selectedMatch.fileName}</h3>
                        <div className="flex items-center gap-4 text-sm text-gray-600">
                          <span>Similarity: {selectedMatch.similarity}%</span>
                          <span>{currentImageIndex + 1} of {filteredMatches.length}</span>
                        </div>
                      </div>
                      {/* Checkbox in modal */}
                      <div className="flex items-center gap-2 ml-5">
                        <input
                          type="checkbox"
                          checked={selectedMatches.has(currentImageIndex)}
                          onChange={(e) => handleMatchSelection(currentImageIndex, e.target.checked)}
                          className="w-5 h-5 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500 focus:ring-2"
                        />
                        <label className="text-sm text-gray-600">Select</label>
                      </div>
                    </div>
                    <Button variant="outline" size="sm" onClick={() => setSelectedMatch(null)}>
                      Close
                    </Button>
                  </div>
                  
                  {/* Image container with navigation */}
                  <div className="relative">
                    <img
                      src={selectedMatch.imageUrl}
                      alt={selectedMatch.fileName}
                      className="w-full rounded-lg"
                    />
                    
                    {/* Navigation buttons */}
                    {filteredMatches.length > 1 && (
                      <>
                        <Button
                          variant="outline"
                          size="sm"
                          className="absolute left-2 top-1/2 transform -translate-y-1/2 bg-white/80 hover:bg-white"
                          onClick={goToPrevious}
                          disabled={currentImageIndex === 0}
                        >
                          <ChevronLeft className="w-4 h-4" />
                        </Button>
                        
                        <Button
                          variant="outline"
                          size="sm"
                          className="absolute right-2 top-1/2 transform -translate-y-1/2 bg-white/80 hover:bg-white"
                          onClick={goToNext}
                          disabled={currentImageIndex === filteredMatches.length - 1}
                        >
                          <ChevronRight className="w-4 h-4" />
                        </Button>
                      </>
                    )}
                  </div>
                  
                  {/* Keyboard shortcuts info */}
                  {filteredMatches.length > 1 && (
                    <div className="mt-4 text-center text-sm text-gray-500">
                      Use arrow keys (← →) to navigate • Press Esc to close • Use checkbox to select/deselect
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Info Section */}
            <Card className="mt-8 bg-blue-50">
              <CardContent className="p-6">
                <div className="flex items-start gap-3">
                  <AlertCircle className="w-5 h-5 text-blue-600 mt-0.5" />
                  <div className="text-sm text-blue-800">
                    <p className="font-medium mb-2">How it works:</p>
                    <ul className="list-disc list-inside space-y-1">
                      <li>Upload clear reference images containing the person's face</li>
                      <li>Select a folder containing images to search through</li>
                      <li>The system will detect faces and compare them with all reference faces</li>
                      <li>Results are ranked by the best similarity percentage from any reference</li>
                      <li>All processing happens locally in your browser</li>
                    </ul>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      )}
    </>
  )
} 