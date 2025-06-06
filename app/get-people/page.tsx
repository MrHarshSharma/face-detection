"use client"

import { useState, useEffect } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Search, Trash2, X, Download, Mail, Edit, Scan } from "lucide-react"
import { ToastContainer, toast } from 'react-toastify'
import 'react-toastify/dist/ReactToastify.css'
import { supabase } from '@/lib/supabase'
import JSZip from 'jszip'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"

interface Person {
  id: string
  email: string
  date: string
  time: string
  image_urls: string[]
  created_at: string
  completed: boolean
}

interface Filters {
  email: string
  date: string
  startTime: string
  endTime: string
  status: 'all' | 'completed' | 'pending'
}

interface EmailModalProps {
  isOpen: boolean
  onClose: () => void
  email: string
  onSubmit: (formData: FormData) => void
}

interface EditModalProps {
  isOpen: boolean
  onClose: () => void
  person: Person | null
  onSubmit: (id: string, data: { 
    email: string
    date: string
    time: string
    newImages: File[]
    deletedImageUrls: string[]
  }) => void
}

export default function GetPeople() {
  const [allPeople, setAllPeople] = useState<Person[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedPerson, setSelectedPerson] = useState<Person | null>(null)
  const [filters, setFilters] = useState<Filters>({
    email: "",
    date: "",
    startTime: "",
    endTime: "",
    status: 'all'
  })
  const [updatingId, setUpdatingId] = useState<string | null>(null)
  const [emailModal, setEmailModal] = useState<{ isOpen: boolean; email: string }>({
    isOpen: false,
    email: "",
  })
  const [editModal, setEditModal] = useState<{ isOpen: boolean; person: Person | null }>({
    isOpen: false,
    person: null,
  })

  // Computed filtered people based on current filters
  const people = allPeople.filter(person => {
    // Email filter
    if (filters.email.trim() && !person.email.toLowerCase().includes(filters.email.toLowerCase())) {
      return false
    }
    
    // Date filter
    if (filters.date && person.date !== filters.date) {
      return false
    }
    
    // Status filter
    if (filters.status !== 'all') {
      const isCompleted = filters.status === 'completed'
      if (person.completed !== isCompleted) {
        return false
      }
    }
    
    // Time range filter
    if (filters.startTime && person.time < filters.startTime) {
      return false
    }
    
    if (filters.endTime && person.time > filters.endTime) {
      return false
    }
    
    return true
  })

  useEffect(() => {
    fetchPeople()
   
  }, [])

  

  const fetchPeople = async () => {
    try {
      setLoading(true)
      const { data, error } = await supabase
        .from('ref_images')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(2000)

      if (error) throw error

      setAllPeople(data || [])
      toast.success(`Loaded ${data?.length || 0} records out of total available`)
    } catch (error) {
      console.error('Error fetching people:', error)
      toast.error('Error loading data')
    } finally {
      setLoading(false)
    }
  }

  const handleSearch = () => {
    // No need to fetch from database - filtering is done automatically via computed people array
    // This function can be removed or kept for future enhancements
  }

  const clearFilters = () => {
    setFilters({
      email: "",
      date: "",
      startTime: "",
      endTime: "",
      status: 'all'
    })
    // No need to fetch again - the computed people array will update automatically
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this record?')) return

    try {
      const person = allPeople.find(p => p.id === id)
      if (!person) return

      // Delete images from storage
      for (const url of person.image_urls) {
        const fileName = url.split('/').pop()
        if (fileName) {
          const { error: storageError } = await supabase.storage
            .from('images')
            .remove([fileName])
          
          if (storageError) throw storageError
        }
      }

      // Delete record from database
      const { error: dbError } = await supabase
        .from('ref_images')
        .delete()
        .eq('id', id)

      if (dbError) throw dbError

      toast.success('Record deleted successfully')
      setAllPeople(allPeople.filter(p => p.id !== id))
    } catch (error) {
      console.error('Error deleting record:', error)
      toast.error('Error deleting record')
    }
  }

  const toggleCompletion = async (id: string, currentStatus: boolean) => {
    try {
      setUpdatingId(id)

      const { error } = await supabase
        .from('ref_images')
        .update({ completed: !currentStatus })
        .eq('id', id)

      if (error) throw error

      // Update local state
      setAllPeople(allPeople.map(person => 
        person.id === id 
          ? { ...person, completed: !currentStatus }
          : person
      ))

      toast.success(
        !currentStatus 
          ? 'Marked as completed' 
          : 'Marked as incomplete'
      )
    } catch (error) {
      console.error('Error updating completion status:', error)
      toast.error('Error updating status')
    } finally {
      setUpdatingId(null)
    }
  }

  const handleDownload = async (person: Person) => {
    try {
      // Create a new instance of JSZip
      const zip = new JSZip()
      
      // Create a folder with the email name (remove special characters)
      const folderName = person.email.replace(/[^a-zA-Z0-9]/g, '_').concat('_images')
      const folder = zip.folder(folderName)
      
      if (!folder) {
        throw new Error('Could not create folder')
      }

      // Show loading toast
      // const toastId = toast.loading('Preparing download...')

      // Download all images and add them to the zip
      const imagePromises = person.image_urls.map(async (url, index) => {
        try {
          const response = await fetch(url)
          const blob = await response.blob()
          folder.file(`image_${index + 1}.jpg`, blob)
        } catch (error) {
          console.error(`Error downloading image ${index + 1}:`, error)
        }
      })

      await Promise.all(imagePromises)

      // Generate the zip file
      const content = await zip.generateAsync({ type: 'blob' })
      
      // Create download link
      const downloadUrl = URL.createObjectURL(content)
      const link = document.createElement('a')
      link.href = downloadUrl
      link.download = `${folderName}.zip`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)

      // Cleanup
      URL.revokeObjectURL(downloadUrl)
      
      // Update toast
      // toast.update(toastId, {
      //   render: 'Images downloaded successfully',
      //   type: 'success',
      //   isLoading: false,
      //   autoClose: 3000
      // })

    } catch (error) {
      console.error('Error downloading images:', error)
      toast.error('Error downloading images')
    }
  }

  const handleEmailSubmit = async (formData: FormData) => {
    try {
      const email = formData.get('email') as string
      const file = formData.get('file') as File

      if (!email || !file) {
        toast.error('Email and file are required')
        return
      }

      toast.info('Uploading file...')

      // Find the person to update
      const person = allPeople.find(p => p.email === email)
      if (!person) {
        throw new Error('Person not found')
      }

      // Upload to drive using existing endpoint
      const uploadFormData = new FormData()
      uploadFormData.append('file', file)
      uploadFormData.append('email', email)

      const uploadResponse = await fetch('/api/upload-to-drive', {
        method: 'POST',
        body: uploadFormData,
      })

      if (!uploadResponse.ok) {
        const errorData = await uploadResponse.json()
        throw new Error(errorData.error || 'Failed to upload file')
      }

      const { fileUrl } = await uploadResponse.json()

      // Open Gmail compose window
      const subject = encodeURIComponent('Your Moment with the Sacred Relic')
      const body = encodeURIComponent(`Dear Esteemed Visitor,

We sincerely thank you and deeply appreciate your patience and understanding.
Please find your special moment with the relic:
${fileUrl}

This link will be accessible through Google Drive and will expire in 7 days.

Wishing you blessings and joy,
The Photo Desk Team
`)

      const gmailUrl = `https://mail.google.com/mail/?view=cm&fs=1&to=${email}&su=${subject}&body=${body}`
      
      // Open as popup window with specific dimensions
      const width = 600
      const height = 700
      const left = (window.screen.width - width) / 2
      const top = (window.screen.height - height) / 2
      
      window.open(
        gmailUrl,
        'EmailPopup',
        `width=${width},height=${height},left=${left},top=${top},resizable=yes,scrollbars=yes,status=yes`
      )

      // Update the completion status in Supabase
      const { error: updateError } = await supabase
        .from('ref_images')
        .update({ completed: true })
        .eq('id', person.id)

      if (updateError) {
        throw updateError
      }

      // Update local state
      setAllPeople(allPeople.map(p => 
        p.id === person.id ? { ...p, completed: true } : p
      ))

      toast.success('File uploaded, email window opened, and status updated')
      setEmailModal({ isOpen: false, email: '' })
    } catch (error) {
      console.error('Error in upload process:', error)
      toast.error(error instanceof Error ? error.message : 'Failed to process request')
    }
  }

  const handleEditSubmit = async (id: string, data: { 
    email: string
    date: string
    time: string
    newImages: File[]
    deletedImageUrls: string[]
  }) => {
    try {
      // First handle image updates
      const person = allPeople.find(p => p.id === id)
      if (!person) throw new Error('Person not found')

      // Delete selected images from storage
      for (const url of data.deletedImageUrls) {
        const fileName = url.split('/').pop()
        if (fileName) {
          const { error: storageError } = await supabase.storage
            .from('images')
            .remove([fileName])
          if (storageError) throw storageError
        }
      }

      // Upload new images
      const newImageUrls: string[] = []
      for (const file of data.newImages) {
        const fileName = `${Date.now()}_${file.name}`
        const { error: uploadError, data: uploadData } = await supabase.storage
          .from('images')
          .upload(fileName, file)
        
        if (uploadError) throw uploadError

        const { data: { publicUrl } } = supabase.storage
          .from('images')
          .getPublicUrl(fileName)

        newImageUrls.push(publicUrl)
      }

      // Update database record
      const { error } = await supabase
        .from('ref_images')
        .update({
          email: data.email,
          date: data.date,
          time: data.time,
          image_urls: [
            ...person.image_urls.filter(url => !data.deletedImageUrls.includes(url)),
            ...newImageUrls
          ]
        })
        .eq('id', id)

      if (error) throw error

      // Update local state
      setAllPeople(allPeople.map(p => 
        p.id === id 
          ? {
              ...p,
              email: data.email,
              date: data.date,
              time: data.time,
              image_urls: [
                ...p.image_urls.filter(url => !data.deletedImageUrls.includes(url)),
                ...newImageUrls
              ]
            }
          : p
      ))

      toast.success('Record updated successfully')
      setEditModal({ isOpen: false, person: null })
    } catch (error) {
      console.error('Error updating record:', error)
      toast.error('Failed to update record')
    }
  }

  const handleFacialRecognition = async (person: Person) => {
    try {
      // Store the person's images for facial recognition
      const referenceData = {
        images: person.image_urls,
        email: person.email,
        timestamp: Date.now()
      }
      
      localStorage.setItem('facialRecognitionReference', JSON.stringify(referenceData))
      
      // Navigate to find-person page
      window.open('/find-person', '_blank')
      
      toast.success('Reference images prepared for facial recognition')
    } catch (error) {
      console.error('Error preparing facial recognition:', error)
      toast.error('Failed to prepare facial recognition')
    }
  }

  return (
    <>
      <ToastContainer />
      <Card className="w-full shadow-none border-none p-0">
        <CardContent className="p-6">
          <div className="space-y-6">
            {/* Filters Section - Make it sticky */}
            <div className="sticky top-16 bg-white z-40 -mx-6 px-6 py-4 border-b border-gray-200">
              <div className="flex items-center gap-2">
                <Input
                  type="email"
                  placeholder="Search by email"
                  value={filters.email}
                  onChange={(e) => setFilters(prev => ({ ...prev, email: e.target.value }))}
                  className="w-300"
                />
                <Input
                  type="date"
                  value={filters.date}
                  onChange={(e) => setFilters(prev => ({ ...prev, date: e.target.value }))}
                  className="w-40"
                />
                <select
                  value={filters.status}
                  onChange={(e) => setFilters(prev => ({ 
                    ...prev, 
                    status: e.target.value as 'all' | 'completed' | 'pending'
                  }))}
                  className="h-10 rounded-md border border-input bg-background px-3 py-2 w-300"
                >
                  <option value="all">All Status</option>
                  <option value="completed">Completed</option>
                  <option value="pending">Pending</option>
                </select>
                <div className="flex items-center gap-2 ml-auto">
                  <Button onClick={handleSearch} className="px-4">
                    <Search className="w-4 h-4 mr-2" />
                    Search
                  </Button>
                  <Button 
                    onClick={clearFilters}
                    variant="outline"
                    className="px-4"
                  >
                    <X className="w-4 h-4 mr-2" />
                    Clear
                  </Button>
                </div>
              </div>
            </div>

            {/* Results Section */}
            <div className="pt-4"> {/* Add padding top to prevent content from jumping */}
              {loading ? (
                <div className="text-center py-4">Loading...</div>
              ) : people.length === 0 ? (
                <div className="text-center py-4">No records found</div>
              ) : (
                <div className="grid grid-cols-4 gap-4">
                  {people.map((person) => (
                    <Card 
                      key={person.id} 
                      className={`p-4 w-full h-full ${
                        person.completed ? 'bg-green-50' : ''
                      }`}
                    >
                      <div className="flex justify-between items-start pb-2">
                        
                        <div className="flex gap-2 w-full pb-4 ">
                        {/* <div className="flex items-center gap-2">
                          <div className="relative">
                            <input
                              type="checkbox"
                              checked={person.completed}
                              onChange={() => toggleCompletion(person.id, person.completed)}
                              disabled={updatingId === person.id}
                              className="w-4 h-4 rounded border-gray-300 text-green-600 focus:ring-green-500"
                            />
                            {updatingId === person.id && (
                              <div className="absolute inset-0 flex items-center justify-center">
                                <div className="w-4 h-4 border-2 border-green-600 border-t-transparent rounded-full animate-spin"></div>
                              </div>
                            )}
                          </div>
                          <span className="text-sm text-gray-500">
                            {updatingId === person.id 
                              ? 'Updating...' 
                              : person.completed 
                                ? 'Completed' 
                                : 'Pending'
                            }
                          </span>
                        </div> */}
                        <div className="flex gap-2 ml-auto">
                          <TooltipProvider delayDuration={100}>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => handleFacialRecognition(person)}
                                  className="bg-indigo-50 hover:bg-indigo-100 border-indigo-200 h-7 w-7"
                                >
                                  <Scan className="w-4 h-4" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>
                                <p>Facial Recognition</p>
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                          <TooltipProvider delayDuration={100}>
                            <Tooltip>
                              <TooltipTrigger asChild>
                          <Button
                            variant="outline"
                            size="sm"
                                  onClick={() => setEditModal({ isOpen: true, person })}
                                  className="bg-yellow-50 hover:bg-yellow-100 border-yellow-200 h-7 w-7"
                          >
                                  <Edit className="w-4 h-4" />
                          </Button>
                              </TooltipTrigger>
                              <TooltipContent>
                                <p>Edit Record</p>
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                          <TooltipProvider delayDuration={100}>
                            <Tooltip>
                              <TooltipTrigger asChild>
                          <Button
                            variant="destructive"
                            size="sm"
                            onClick={() => handleDelete(person.id)}
                            className="h-7 w-7"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                              </TooltipTrigger>
                              <TooltipContent>
                                <p>Delete Record</p>
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                           </div>
                        </div>
                      </div>

                      <div className="flex justify-between items-start">
                        <div>
                          <h3 className="font-medium">{person.email}</h3>
                          <p className="text-sm text-gray-500">
                            Date: {new Date(person.date).toLocaleDateString()}
                          </p>
                          <p className="text-sm text-gray-500">
                            Time: {person.time}
                          </p>
                        </div>
                      </div>
                      
                      {/* Image Grid */}
                      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2 mt-4">
                        {person.image_urls.map((url, index) => (
                          <img
                            key={index}
                            src={url}
                            alt={`Reference ${index + 1}`}
                            className="w-10 h-10 object-cover rounded-lg cursor-pointer border border-gray-300"
                            onClick={() => setSelectedPerson(person)}
                          />
                        ))}
                      </div>
                    </Card>
                  ))}
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Image Modal */}
      {selectedPerson && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
          onClick={() => setSelectedPerson(null)}
        >
          <div className="bg-white rounded-lg p-4 max-w-4xl w-full" onClick={e => e.stopPropagation()}>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 overflow-y-auto max-h-[80vh]">
              {selectedPerson.image_urls.map((url, index) => (
                <img
                  key={index}
                  src={url}
                  alt={`Reference ${index + 1}`}
                  className="w-full rounded-lg"
                />
              ))}
            </div>
          </div>
        </div>
      )}

      <EmailModal
        isOpen={emailModal.isOpen}
        onClose={() => setEmailModal({ isOpen: false, email: '' })}
        email={emailModal.email}
        onSubmit={handleEmailSubmit}
      />

      <EditModal
        isOpen={editModal.isOpen}
        onClose={() => setEditModal({ isOpen: false, person: null })}
        person={editModal.person}
        onSubmit={handleEditSubmit}
      />
    </>
  )
}

const EmailModal = ({ isOpen, onClose, email, onSubmit }: EmailModalProps) => {
  return (
    <Dialog open={isOpen} onOpenChange={() => onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Send Images via Email</DialogTitle>
        </DialogHeader>
        <form onSubmit={(e) => {
          e.preventDefault()
          const formData = new FormData(e.currentTarget)
          onSubmit(formData)
        }}>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Email</label>
              <Input
                type="email"
                name="email"
                defaultValue={email}
                readOnly
                className="w-full"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Upload ZIP File</label>
              <Input
                type="file"
                name="file"
                accept=".zip"
                required
                className="w-full"
              />
              <p className="text-xs text-gray-500">
                Please upload a ZIP file containing the images
              </p>
            </div>
            <div className="flex justify-end gap-3">
              <Button type="button" variant="outline" onClick={onClose}>
                Cancel
              </Button>
              <Button type="submit">
                Send Email
              </Button>
            </div>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}

const EditModal = ({ isOpen, onClose, person, onSubmit }: EditModalProps) => {
  const [isLoading, setIsLoading] = useState(false)
  const [formData, setFormData] = useState({
    email: '',
    date: '',
    time: '',
    newImages: [] as File[],
    deletedImageUrls: [] as string[]
  })

  useEffect(() => {
    if (person) {
      setFormData({
        email: person.email,
        date: person.date,
        time: person.time,
        newImages: [],
        deletedImageUrls: []
      })
    }
  }, [person])

  const handleImageDelete = (imageUrl: string) => {
    setFormData(prev => ({
      ...prev,
      deletedImageUrls: [...prev.deletedImageUrls, imageUrl]
    }))
  }

  const handleNewImages = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || [])
    setFormData(prev => ({
      ...prev,
      newImages: [...prev.newImages, ...files]
    }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (person) {
      setIsLoading(true)
      try {
        await onSubmit(person.id, formData)
      } finally {
        setIsLoading(false)
      }
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={() => !isLoading && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Edit Record</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Email</label>
              <Input
                type="email"
                value={formData.email}
                onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                required
                className="w-full"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Date</label>
              <Input
                type="date"
                value={formData.date}
                onChange={(e) => setFormData(prev => ({ ...prev, date: e.target.value }))}
                required
                className="w-full"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Time</label>
              <Input
                type="time"
                value={formData.time}
                onChange={(e) => setFormData(prev => ({ ...prev, time: e.target.value }))}
                required
                className="w-full"
              />
            </div>

            {/* Current Images */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Current Images</label>
              <div className="grid grid-cols-4 gap-4">
                {person?.image_urls
                  .filter(url => !formData.deletedImageUrls.includes(url))
                  .map((url, index) => (
                    <div key={url} className="relative group">
                      <img
                        src={url}
                        alt={`Image ${index + 1}`}
                        className="w-full h-24 object-cover rounded-lg"
                      />
                      <button
                        type="button"
                        onClick={() => handleImageDelete(url)}
                        className="absolute top-1 right-1 bg-red-500 text-white p-1 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
              </div>
            </div>

            {/* New Images */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Add New Images</label>
              <Input
                type="file"
                accept="image/*"
                multiple
                onChange={handleNewImages}
                className="w-full"
              />
              {formData.newImages.length > 0 && (
                <div className="grid grid-cols-4 gap-4 mt-2">
                  {formData.newImages.map((file, index) => (
                    <div key={index} className="relative group">
                      <img
                        src={URL.createObjectURL(file)}
                        alt={`New Image ${index + 1}`}
                        className="w-full h-24 object-cover rounded-lg"
                      />
                      <button
                        type="button"
                        onClick={() => setFormData(prev => ({
                          ...prev,
                          newImages: prev.newImages.filter((_, i) => i !== index)
                        }))}
                        className="absolute top-1 right-1 bg-red-500 text-white p-1 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="flex justify-end gap-3">
              <Button 
                type="button" 
                variant="outline" 
                onClick={onClose}
                disabled={isLoading}
              >
                Cancel
              </Button>
              <Button 
                type="submit"
                disabled={isLoading}
                className="min-w-[100px]"
              >
                {isLoading ? (
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    <span>Saving...</span>
                  </div>
                ) : (
                  'Save Changes'
                )}
              </Button>
            </div>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
} 