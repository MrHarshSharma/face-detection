"use client"

import { useState, useRef, useEffect } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Search, Upload, User, FolderOpen, AlertCircle } from "lucide-react"
import { ToastContainer, toast } from 'react-toastify'
import 'react-toastify/dist/ReactToastify.css'

interface MatchResult {
  file: File
  imageUrl: string
  similarity: number
  fileName: string
}

export default function FindPerson() {
  const [referenceImage, setReferenceImage] = useState<File | null>(null)
  const [referenceImageUrl, setReferenceImageUrl] = useState<string>("")
  const [folderImages, setFolderImages] = useState<File[]>([])
  const [loading, setLoading] = useState(false)
  const [matches, setMatches] = useState<MatchResult[]>([])
  const [faceApiLoaded, setFaceApiLoaded] = useState(false)
  const [selectedMatch, setSelectedMatch] = useState<MatchResult | null>(null)
  const [processedCount, setProcessedCount] = useState(0)
  const [processingStarted, setProcessingStarted] = useState(false)
  
  const canvasRef = useRef<HTMLCanvasElement>(null)

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

  const handleReferenceImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file && file.type.startsWith('image/')) {
      setReferenceImage(file)
      const url = URL.createObjectURL(file)
      setReferenceImageUrl(url)
      toast.success('Reference image selected')
    } else {
      toast.error('Please select a valid image file')
    }
  }

  const handleFolderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || [])
    const imageFiles = files.filter(file => file.type.startsWith('image/'))
    
    if (imageFiles.length === 0) {
      toast.error('No image files found in the selected folder')
      return
    }
    
    setFolderImages(imageFiles)
    toast.success(`${imageFiles.length} images loaded from folder`)
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
    if (!referenceImage || folderImages.length === 0) {
      toast.error('Please select both reference image and folder')
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
      
      // Get reference face descriptor
      const referenceImg = await getImageElement(referenceImage)
      const referenceDetection = await faceapi
        .detectSingleFace(referenceImg)
        .withFaceLandmarks()
        .withFaceDescriptor()

      if (!referenceDetection) {
        toast.error('No face detected in reference image')
        setLoading(false)
        return
      }

      const referenceFaceDescriptor = referenceDetection.descriptor
      const foundMatches: MatchResult[] = []
      
      // Process images in parallel batches for faster results
      const batchSize = 5 // Process 5 images at once
      const batches = []
      
      for (let i = 0; i < folderImages.length; i += batchSize) {
        batches.push(folderImages.slice(i, i + batchSize))
      }

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

            // Check each face in the image
            for (const detection of detections) {
              const distance = faceapi.euclideanDistance(referenceFaceDescriptor, detection.descriptor)
              const similarity = Math.max(0, 1 - distance) * 100

              // Lower threshold for quicker results
              if (similarity > 50) {
                return {
                  file,
                  imageUrl: URL.createObjectURL(file),
                  similarity: Math.round(similarity),
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

        setProcessedCount(prev => prev + batch.length)
        
        // Update progress more frequently
        toast.info(`Processed: ${processedCount + batch.length}/${folderImages.length} - Found: ${foundMatches.length} matches`, {
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
    setReferenceImage(null)
    setReferenceImageUrl("")
    setFolderImages([])
    setMatches([])
    setSelectedMatch(null)
    setProcessedCount(0)
    setProcessingStarted(false)
  }

  return (
    <>
      <ToastContainer />
      <canvas ref={canvasRef} style={{ display: 'none' }} />
      
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-6xl mx-auto">
          {/* Header */}
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold text-gray-900 mb-2">Find Person in Images</h1>
            <p className="text-gray-600">Upload a reference image and select a folder to find matching faces</p>
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
                    Reference Image
                  </label>
                  <Input
                    type="file"
                    accept="image/*"
                    onChange={handleReferenceImageChange}
                    className="w-full"
                  />
                  {referenceImageUrl && (
                    <div className="mt-4">
                      <img
                        src={referenceImageUrl}
                        alt="Reference"
                        className="w-full max-w-xs rounded-lg border"
                      />
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
                    <div className="mt-4 p-4 bg-blue-50 rounded-lg">
                      <p className="text-sm text-blue-700">
                        <strong>{folderImages.length}</strong> images selected from folder
                      </p>
                    </div>
                  )}
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex gap-4 justify-center mt-8">
                <Button 
                  onClick={findMatches} 
                  disabled={!referenceImage || folderImages.length === 0 || loading || !faceApiLoaded}
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
                        {processedCount}/{folderImages.length} processed • {matches.filter(m => m.similarity >= 60).length} high-quality matches found
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
                High-Quality Matches ({matches.filter(m => m.similarity >= 60).length})
                {loading && <span className="text-sm text-gray-500 ml-2">(Live Results - 60%+ similarity)</span>}
              </h2>
              
              {matches.filter(m => m.similarity >= 60).length === 0 ? (
                !loading && (
                  <Card>
                    <CardContent className="p-8 text-center">
                      <div className="text-gray-500">
                        <Search className="w-12 h-12 mx-auto mb-4 opacity-50" />
                        <p className="text-lg font-medium mb-2">No high-quality matches found</p>
                        <p>No matches found with 60% or higher similarity</p>
                        {matches.length > 0 && (
                          <p className="text-sm mt-2 text-blue-600">
                            Found {matches.length} lower-quality matches (50-59% similarity)
                          </p>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                )
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                  {matches.filter(m => m.similarity >= 60).map((match, index) => (
                    <Card 
                      key={index} 
                      className="hover:shadow-lg transition-all duration-300 cursor-pointer animate-in fade-in slide-in-from-bottom-4"
                      onClick={() => setSelectedMatch(match)}
                    >
                      <CardContent className="p-4">
                        <div className="space-y-3">
                          <img
                            src={match.imageUrl}
                            alt={match.fileName}
                            className="w-full h-48 object-cover rounded-lg"
                          />
                          <div>
                            <p className="text-sm font-medium truncate" title={match.fileName}>
                              {match.fileName}
                            </p>
                            <div className="flex items-center justify-between mt-2">
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
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Image Modal */}
          {selectedMatch && (
            <div 
              className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
              onClick={() => setSelectedMatch(null)}
            >
              <div className="bg-white rounded-lg p-4 max-w-4xl w-full max-h-[90vh] overflow-auto" onClick={e => e.stopPropagation()}>
                <div className="flex justify-between items-center mb-4">
                  <div>
                    <h3 className="text-lg font-medium">{selectedMatch.fileName}</h3>
                    <p className="text-sm text-gray-600">Similarity: {selectedMatch.similarity}%</p>
                  </div>
                  <Button variant="outline" size="sm" onClick={() => setSelectedMatch(null)}>
                    Close
                  </Button>
                </div>
                <img
                  src={selectedMatch.imageUrl}
                  alt={selectedMatch.fileName}
                  className="w-full rounded-lg"
                />
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
                    <li>Upload a clear reference image containing the person's face</li>
                    <li>Select a folder containing images to search through</li>
                    <li>The system will detect faces and compare them with the reference</li>
                    <li>Results are ranked by similarity percentage</li>
                    <li>All processing happens locally in your browser</li>
                  </ul>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  )
} 