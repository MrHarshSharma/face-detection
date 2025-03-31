"use client"

import { useState, useRef } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { ImageIcon, X } from "lucide-react"
import { ToastContainer, toast } from 'react-toastify'
import 'react-toastify/dist/ReactToastify.css'
import { supabase } from '@/lib/supabase'

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
          const fileExt = image.file.name.split('.').pop()
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
    <>
      <ToastContainer />
      <Card className="w-full shadow-md">
        <CardContent className="p-6">
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Image Upload Section */}
            <div className={`flex items-center justify-center w-full ${images.length > 0 ? 'bg-blue-50' : 'bg-gray-50'}`}>
              <label
                htmlFor="image-upload"
                className="flex flex-col items-center justify-center w-full h-40 border-2 border-gray-300 border-dashed rounded-lg cursor-pointer hover:bg-gray-100"
              >
                <div className="flex flex-col items-center justify-center pt-5 pb-6">
                  <ImageIcon className="w-10 h-10 mb-3 text-gray-400" />
                  <p className="text-sm text-gray-500">
                    <span className="font-semibold">Click to upload images</span>
                  </p>
                  <p className="text-xs text-gray-500">Upload multiple images</p>
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

            {/* Image Preview Grid */}
            {images.length > 0 && (
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {images.map((image, index) => (
                  <div key={index} className="relative group">
                    <img 
                      src={image.preview} 
                      alt={`Preview ${index + 1}`} 
                      className="w-full h-32 object-cover rounded-lg"
                    />
                    <button
                      type="button"
                      onClick={() => removeImage(index)}
                      className="absolute top-1 right-1 bg-red-500 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Form Fields */}
            <div className="space-y-4">
              <div>
                <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
                  Email
                </label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Enter person's email"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label htmlFor="date" className="block text-sm font-medium text-gray-700 mb-1">
                    Date
                  </label>
                  <Input
                    id="date"
                    type="date"
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    required
                  />
                </div>

                <div>
                  <label htmlFor="time" className="block text-sm font-medium text-gray-700 mb-1">
                    Time
                  </label>
                  <Input
                    id="time"
                    type="time"
                    value={time}
                    onChange={(e) => setTime(e.target.value)}
                    required
                  />
                </div>
              </div>
            </div>

            {/* Submit Button */}
            <div className="flex justify-center">
              <Button 
                type="submit"
                disabled={images.length === 0 || !email || !date || !time || isSubmitting}
                className="w-[70%]"
              >
                {isSubmitting ? (
                  <div className="flex items-center">
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"></div>
                    Uploading...
                  </div>
                ) : (
                  'Submit'
                )}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </>
  )
} 