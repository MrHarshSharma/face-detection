"use client"

import { useState, useRef } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { ImageIcon, X, Mail, Calendar, Clock, Upload, CheckCircle, Users } from "lucide-react"
import { ToastContainer, toast } from 'react-toastify'
import 'react-toastify/dist/ReactToastify.css'
import { supabase } from '@/lib/supabase'
import Footer from "@/components/Footer"

interface ImageInfo {
  file: File;
  preview: string;
}

export default function AddImage() {
  const [images, setImages] = useState<ImageInfo[]>([])
  const [email, setEmail] = useState("")
  const [date, setDate] = useState("")
  const [time, setTime] = useState("")
  const imageInputRef = useRef<HTMLInputElement>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const newFiles = Array.from(e.target.files).filter(file => file.type.startsWith('image/'))
      
      if (newFiles.length === 0) {
        toast.error('Please upload valid image files')
        return
      }

      const newImages: ImageInfo[] = newFiles.map(file => ({
        file,
        preview: URL.createObjectURL(file)
      }))

      setImages(prev => [...prev, ...newImages])
      toast.success(`${newFiles.length} images uploaded`)
    }
  }

  const removeImage = (index: number) => {
    setImages(prev => {
      const newImages = [...prev]
      URL.revokeObjectURL(newImages[index].preview)
      newImages.splice(index, 1)
      return newImages
    })
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (images.length === 0) {
      toast.error('Please upload at least one image')
      return
    }

    if (!email || !date || !time) {
      toast.error('Please fill in all fields')
      return
    }

    try {
      setIsSubmitting(true)
      
      // First check if email already exists
      const { data: existingUser, error: checkError } = await supabase
        .from('ref_images')
        .select('email')
        .eq('email', email)
        .eq('date', date)
        .single()

      if (checkError && checkError.code !== 'PGRST116') {
        console.error('Error checking email:', checkError)
        throw checkError
      }

      if (existingUser) {
        toast.warning('This user and date is already recorded. Please use a different email or date.')
        setIsSubmitting(false)
        return
      }

      toast.info('Uploading images...')
      
      // Upload images to Supabase storage
      const imageUrls = await Promise.all(
        images.map(async (image, index) => {
          // Safely extract file extension and ensure it's clean
          const fileExt = image.file.name.split('.').pop()?.toLowerCase() || 'jpg'
          // Generate clean filename with timestamp and index
          const fileName = `${Date.now()}-${index}.${fileExt}`
          const filePath = `${fileName}`

          const { data: uploadData, error: uploadError } = await supabase.storage
            .from('images')
            .upload(filePath, image.file, {
              cacheControl: '3600',
              upsert: false
            })

          if (uploadError) {
            console.error('Upload error:', uploadError)
            throw uploadError
          }

          const { data: { publicUrl } } = supabase.storage
            .from('images')
            .getPublicUrl(filePath)

          return publicUrl
        })
      )

      // Insert record into ref_images table
      const { data, error: insertError } = await supabase
        .from('ref_images')
        .insert([{
          email,
          date,
          time,
          image_urls: imageUrls,
          created_at: new Date().toISOString()
        }])
        .select()

      if (insertError) {
        console.error('Insert error:', insertError)
        throw insertError
      }

      toast.success('Images uploaded successfully')
      setImages([])
      setEmail("")
      setDate("")
      setTime("")

    } catch (error) {
      console.error('Error submitting form:', error)
      toast.error('Error uploading images. Please try again.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="min-h-[80vh]">
      <ToastContainer />
      {true ? (
        <div className="max-w-4xl mx-auto px-4 my-auto flex justify-center items-center h-screen">
        <span>This page is under maintenance. Please check back later.</span>
        </div>):(
        <div className="max-w-4xl mx-auto px-4">
        {/* Header Section */}
        

        <Card className="shadow-2xl border-0 bg-white/80 backdrop-blur-sm">
          <CardContent className="p-8">
            <form onSubmit={handleSubmit} className="space-y-8">
              
              {/* Image Upload Section */}
              <div className="space-y-4">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 bg-gradient-to-r from-emerald-500 to-teal-600 rounded-lg flex items-center justify-center">
                    <Upload className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <h3 className="text-xl font-semibold text-gray-900">Upload Images</h3>
                    <p className="text-sm text-gray-500">Add multiple photos for better recognition</p>
                  </div>
                </div>

                <div className={`relative transition-all duration-300 ${images.length > 0 ? 'bg-gradient-to-r from-emerald-50 to-teal-50' : 'bg-gradient-to-r from-gray-50 to-blue-50'}`}>
                  <label
                    htmlFor="image-upload"
                    className={`flex flex-col items-center justify-center w-full h-48 border-2 border-dashed rounded-xl cursor-pointer transition-all duration-300 ${
                      images.length > 0 
                        ? 'border-emerald-300 hover:border-emerald-400 hover:bg-emerald-100/50' 
                        : 'border-blue-300 hover:border-blue-400 hover:bg-blue-100/50'
                    }`}
                  >
                    <div className="flex flex-col items-center justify-center pt-5 pb-6">
                      <div className={`w-16 h-16 rounded-full flex items-center justify-center mb-4 ${
                        images.length > 0 
                          ? 'bg-gradient-to-r from-emerald-500 to-teal-600' 
                          : 'bg-gradient-to-r from-blue-500 to-indigo-600'
                      }`}>
                        <ImageIcon className="w-8 h-8 text-white" />
                      </div>
                      <p className="text-lg font-semibold text-gray-700 mb-2">
                        {images.length > 0 ? 'Add More Images' : 'Click to Upload Images'}
                      </p>
                      <p className="text-sm text-gray-500">PNG, JPG, JPEG up to 10MB each</p>
                      {images.length > 0 && (
                        <div className="mt-3 px-4 py-2 bg-emerald-100 rounded-full">
                          <span className="text-sm font-medium text-emerald-700">
                            {images.length} image{images.length > 1 ? 's' : ''} selected
                          </span>
                        </div>
                      )}
                    </div>
                    <Input 
                      ref={imageInputRef}
                      id="image-upload" 
                      type="file" 
                      accept="image/*" 
                      multiple
                      className="hidden" 
                      onChange={handleImageChange}
                    />
                  </label>
                </div>
              </div>

              {/* Image Preview Grid */}
              {images.length > 0 && (
                <div className="space-y-4">
                  <div className="flex items-center gap-2">
                    <CheckCircle className="w-5 h-5 text-emerald-500" />
                    <h4 className="text-lg font-semibold text-gray-900">Image Preview</h4>
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                    {images.map((image, index) => (
                      <div key={index} className="relative group">
                        <div className="relative overflow-hidden rounded-xl border-2 border-white shadow-lg hover:shadow-xl transition-all duration-300">
                          <img 
                            src={image.preview} 
                            alt={`Preview ${index + 1}`} 
                            className="w-full h-32 object-cover group-hover:scale-105 transition-transform duration-300"
                          />
                          <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                        </div>
                        <button
                          type="button"
                          onClick={() => removeImage(index)}
                          className="absolute -top-2 -right-2 bg-gradient-to-r from-red-500 to-pink-500 text-white rounded-full p-2 opacity-0 group-hover:opacity-100 transition-all duration-300 hover:scale-110 shadow-lg"
                        >
                          <X className="w-4 h-4" />
                        </button>
                        <div className="absolute bottom-2 left-2 bg-white/90 backdrop-blur-sm rounded-lg px-2 py-1">
                          <span className="text-xs font-medium text-gray-700">#{index + 1}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Form Fields */}
              <div className="space-y-6">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 bg-gradient-to-r from-blue-500 to-indigo-600 rounded-lg flex items-center justify-center">
                    <Mail className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <h3 className="text-xl font-semibold text-gray-900">Personal Information</h3>
                    <p className="text-sm text-gray-500">Enter the person's details</p>
                  </div>
                </div>

                <div className="grid gap-6">
                  <div className="space-y-2">
                    <label htmlFor="email" className="flex items-center gap-2 text-sm font-semibold text-gray-700">
                      <Mail className="w-4 h-4 text-blue-500" />
                      Email Address
                    </label>
                    <Input
                      id="email"
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="person@example.com"
                      required
                      className="h-12 text-lg border-2 border-gray-200 focus:border-blue-500 focus:ring-blue-500/20 transition-all duration-300"
                    />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <label htmlFor="date" className="flex items-center gap-2 text-sm font-semibold text-gray-700">
                        <Calendar className="w-4 h-4 text-purple-500" />
                        Date
                      </label>
                      <Input
                        id="date"
                        type="date"
                        value={date}
                        onChange={(e) => setDate(e.target.value)}
                        required
                        className="h-12 text-lg border-2 border-gray-200 focus:border-purple-500 focus:ring-purple-500/20 transition-all duration-300"
                      />
                    </div>

                    <div className="space-y-2">
                      <label htmlFor="time" className="flex items-center gap-2 text-sm font-semibold text-gray-700">
                        <Clock className="w-4 h-4 text-orange-500" />
                        Time
                      </label>
                      <Input
                        id="time"
                        type="time"
                        value={time}
                        onChange={(e) => setTime(e.target.value)}
                        required
                        className="h-12 text-lg border-2 border-gray-200 focus:border-orange-500 focus:ring-orange-500/20 transition-all duration-300"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Submit Button */}
              <div className="flex justify-center pt-4">
                <Button 
                  type="submit"
                  disabled={images.length === 0 || !email || !date || !time || isSubmitting}
                  className="w-full md:w-[60%] h-14 text-lg font-semibold bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-300 shadow-lg hover:shadow-xl"
                >
                  {isSubmitting ? (
                    <div className="flex items-center gap-3">
                      <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                      <span>Uploading Images...</span>
                    </div>
                  ) : (
                    <div className="flex items-center gap-3">
                      <Upload className="w-5 h-5" />
                      <span>Submit & Save</span>
                    </div>
                  )}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
      )}
      
      <Footer />
    </div>
  )
} 