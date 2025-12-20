"use client"

import { useState, useEffect } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Search, Trash2, X, Download, Mail, Edit, Scan, ChevronLeft, ChevronRight, Users, Filter, Clock, Calendar, CheckCircle2, AlertCircle, ImageIcon, Eye } from "lucide-react"
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
import Footer from "@/components/Footer"

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
  const [people, setPeople] = useState<Person[]>([])
  const [totalCount, setTotalCount] = useState(0)
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
  
  // Pagination state
  const [currentPage, setCurrentPage] = useState(1)
  const recordsPerPage = 100

  // Pagination calculations
  const totalPages = Math.ceil(totalCount / recordsPerPage)
  const startIndex = (currentPage - 1) * recordsPerPage + 1
  const endIndex = Math.min(startIndex + recordsPerPage - 1, totalCount)

  useEffect(() => {
    fetchPeople()
  }, [currentPage, filters]) // Fetch when page or filters change

  const fetchPeople = async () => {
    try {
      setLoading(true)
      
      // Calculate range for current page
      const from = (currentPage - 1) * recordsPerPage
      const to = from + recordsPerPage - 1

      // Build query with filters
      let query = supabase
        .from('ref_images')
        .select('id, email, date, time, completed, created_at, image_urls', { count: 'exact' })
        .order('created_at', { ascending: false })
        .range(from, to)

      // Apply filters
      if (filters.email.trim()) {
        query = query.ilike('email', `%${filters.email}%`)
      }

      if (filters.date) {
        query = query.eq('date', filters.date)
      }

      if (filters.status !== 'all') {
        query = query.eq('completed', filters.status === 'completed')
      }

      if (filters.startTime && filters.endTime) {
        query = query
          .gte('time', filters.startTime)
          .lte('time', filters.endTime)
      } else if (filters.startTime) {
        query = query.gte('time', filters.startTime)
      } else if (filters.endTime) {
        query = query.lte('time', filters.endTime)
      }

      const { data, error, count } = await query

      if (error) throw error

      setPeople(data || [])
      setTotalCount(count || 0)
      
    } catch (error) {
      console.error('Error fetching people:', error)
      toast.error('Error loading data')
    } finally {
      setLoading(false)
    }
  }

  const handleSearch = () => {
    setCurrentPage(1) // Reset to first page when searching
    fetchPeople() // Explicitly trigger fetch with current filters
  }

  const clearFilters = () => {
    setFilters({
      email: "",
      date: "",
      startTime: "",
      endTime: "",
      status: 'all'
    })
    setCurrentPage(1) // Reset to first page when clearing filters
    // Trigger fetch after clearing filters
    setTimeout(() => {
      fetchPeople()
    }, 0)
  }

  // Add a function to handle Enter key press in search fields
  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      handleSearch()
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this record?')) return

    try {
      const person = people.find(p => p.id === id)
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
      
      // Refresh the current page data
      await fetchPeople()
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

      toast.success(
        !currentStatus 
          ? 'Marked as completed' 
          : 'Marked as incomplete'
      )
      
      // Refresh the current page data
      await fetchPeople()
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
      const person = people.find(p => p.email === email)
      if (!person) {
        throw new Error('Person not found')
      }

      // Upload to drive using existing endpoint
      const uploadFormData = new FormData()
      uploadFormData.append('file', file)
      uploadFormData.append('email', email)

      const uploadResponse = await fetch('/api/upload-to-storage', {
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

This secure link will be accessible and will expire in 7 days.

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
      setPeople(people.map(p => 
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
      const person = people.find(p => p.id === id)
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
        // Sanitize filename - remove spaces and special characters, keep only alphanumeric, dots, and hyphens
        const sanitizedFileName = file.name
          .replace(/[^a-zA-Z0-9.-]/g, '_') // Replace invalid characters with underscore
          .replace(/_{2,}/g, '_') // Replace multiple underscores with single underscore
          .replace(/^_+|_+$/g, '') // Remove leading/trailing underscores
        
        const fileName = `${Date.now()}_${sanitizedFileName}`
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
      setPeople(people.map(p => 
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
        date: person.date,
        time: person.time,
        timestamp: Date.now()
      }
      
      localStorage.setItem('facialRecognitionReference', JSON.stringify(referenceData))
      
      // Verify the data was stored correctly
      const storedData = localStorage.getItem('facialRecognitionReference')
      
      // Navigate to find-person page
      window.open('/find-person', '_blank')
      
      toast.success('Reference images prepared for facial recognition')
    } catch (error) {
      console.error('Error preparing facial recognition:', error)
      toast.error('Failed to prepare facial recognition')
    }
  }

  return (
    <div className="min-h-[80vh] ">
      <ToastContainer />
      
      <div className="max-w-7xl mx-auto ">
        

        <Card className="shadow-2xl border-0 bg-white/80 backdrop-blur-sm">
          <CardContent className="">
            <div className="space-y-8">
              {/* Filters Section */}
              <div className="bg-gradient-to-r from-gray-50 to-blue-50 rounded-xl p-6 border border-blue-100">
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-10 h-10 bg-gradient-to-r from-blue-500 to-indigo-600 rounded-lg flex items-center justify-center">
                    <Filter className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <h3 className="text-xl font-semibold text-gray-900">Search & Filter</h3>
                    <p className="text-sm text-gray-500">Find specific records using various filters</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
                  <div className="space-y-2">
                    <label className="flex items-center gap-2 text-sm font-semibold text-gray-700">
                      <Mail className="w-4 h-4 text-blue-500" />
                      Email Address
                    </label>
                    <Input
                      type="email"
                      placeholder="Search by email"
                      value={filters.email}
                      onChange={(e) => setFilters({ ...filters, email: e.target.value })}
                      className="h-11 border-2 border-gray-200 focus:border-blue-500 focus:ring-blue-500/20 transition-all duration-300"
                      onKeyDown={handleKeyPress}
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="flex items-center gap-2 text-sm font-semibold text-gray-700">
                      <Calendar className="w-4 h-4 text-purple-500" />
                      Date
                    </label>
                    <Input
                      type="date"
                      value={filters.date}
                      onChange={(e) => setFilters({ ...filters, date: e.target.value })}
                      className="h-11 border-2 border-gray-200 focus:border-purple-500 focus:ring-purple-500/20 transition-all duration-300"
                      onKeyDown={handleKeyPress}
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="flex items-center gap-2 text-sm font-semibold text-gray-700">
                      <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                      Status
                    </label>
                    <select
                      value={filters.status}
                      onChange={(e) => setFilters({ ...filters, status: e.target.value as 'all' | 'completed' | 'pending' })}
                      className="h-11 rounded-md border-2 border-gray-200 bg-white px-3 py-2 text-sm focus:border-emerald-500 focus:ring-emerald-500/20 transition-all duration-300"
                      onKeyDown={handleKeyPress}
                    >
                      <option value="all">All Status</option>
                      <option value="completed">Completed</option>
                      <option value="pending">Pending</option>
                    </select>
                  </div>

                  
                  <div className="flex items-end gap-2 ml-auto ">
                    <Button 
                      onClick={handleSearch} 
                      className="h-11 px-6 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white shadow-lg hover:shadow-xl transition-all duration-300"
                    >
                      <Search className="w-4 h-4 mr-2" />
                      Search
                    </Button>
                    <Button 
                      onClick={clearFilters}
                      variant="outline"
                      className="h-11 px-6 border-2 border-gray-300 hover:border-gray-400 hover:bg-gray-50 transition-all duration-300"
                    >
                      <X className="w-4 h-4 mr-2" />
                      Clear
                    </Button>
                  </div>

                 
                </div>
              </div>

              {/* Results Section */}
              <div className="space-y-6">
                {loading ? (
                  <div className="flex flex-col items-center justify-center py-16">
                    <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mb-4"></div>
                    <p className="text-lg font-medium text-gray-600">Loading records...</p>
                  </div>
                ) : people.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-16">
                    <div className="w-20 h-20 bg-gradient-to-r from-gray-300 to-gray-400 rounded-full flex items-center justify-center mb-4">
                      <Users className="w-10 h-10 text-white" />
                    </div>
                    <h3 className="text-xl font-semibold text-gray-700 mb-2">No records found</h3>
                    <p className="text-gray-500">Try adjusting your search filters</p>
                  </div>
                ) : (
                  <>
                    {/* Stats Bar */}
                    <div className="bg-gradient-to-r from-emerald-50 to-teal-50 rounded-xl p-6 mb-8 border border-emerald-100">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 bg-gradient-to-r from-emerald-500 to-teal-600 rounded-lg flex items-center justify-center">
                            <CheckCircle2 className="w-5 h-5 text-white" />
                          </div>
                          <div>
                            <p className="text-sm text-gray-600">
                              Showing <span className="font-semibold text-emerald-700">{startIndex}</span> to <span className="font-semibold text-emerald-700">{endIndex}</span> of <span className="font-semibold text-emerald-700">{totalCount}</span> records
                            </p>
                          </div>
                        </div>
                        <PaginationControls 
                          currentPage={currentPage}
                          totalPages={totalPages}
                          onPageChange={setCurrentPage}
                        />
                      </div>
                    </div>

                    {/* Cards Grid */}
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                      {people.map((person) => (
                        <Card 
                          key={person.id} 
                          className={`group relative overflow-hidden shadow-lg hover:shadow-2xl transition-all duration-300 border-0 ${
                            person.completed 
                              ? 'bg-gradient-to-br from-emerald-50 to-teal-50 border-2 border-emerald-200' 
                              : 'bg-gradient-to-br from-white to-gray-50 border-2 border-gray-200 hover:border-blue-300'
                          }`}
                        >
                          <CardContent className="p-6">
                            {/* Status Badge */}
                            <div className="absolute top-4 right-4">
                              {person.completed ? (
                                <div className="flex items-center gap-1 bg-emerald-100 text-emerald-700 px-3 py-1 rounded-full text-xs font-semibold">
                                  <CheckCircle2 className="w-3 h-3" />
                                  Completed
                                </div>
                              ) : (
                                <div className="flex items-center gap-1 bg-orange-100 text-orange-700 px-3 py-1 rounded-full text-xs font-semibold">
                                  <Clock className="w-3 h-3" />
                                  Pending
                                </div>
                              )}
                            </div>

                            {/* Person Info */}
                            <div className="mb-4 pt-8">
                              <div className="flex items-center gap-2 mb-2">
                                <Mail className="w-4 h-4 text-blue-500" />
                                <h3 className="font-semibold text-gray-900 truncate">{person.email}</h3>
                              </div>
                              <div className="space-y-1">
                                <div className="flex items-center gap-2 text-sm text-gray-600">
                                  <Calendar className="w-3 h-3 text-purple-500" />
                                  {new Date(person.date).toLocaleDateString()}
                                </div>
                                <div className="flex items-center gap-2 text-sm text-gray-600">
                                  <Clock className="w-3 h-3 text-orange-500" />
                                  {person.time}
                                </div>
                              </div>
                            </div>
                            
                            {/* Image Preview */}
                            <div className="mb-4">
                              <div className="flex items-center gap-2 mb-3">
                                <ImageIcon className="w-4 h-4 text-indigo-500" />
                                <span className="text-sm font-medium text-gray-700">
                                  {person.image_urls.length} image{person.image_urls.length > 1 ? 's' : ''}
                                </span>
                              </div>
                              <div className="grid grid-cols-4 gap-2">
                                {person.image_urls.slice(0, 4).map((url, index) => (
                                  <div key={index} className="relative group/img">
                                    <img
                                      src={url}
                                      alt={`Reference ${index + 1}`}
                                      className="w-full h-12 object-cover rounded-lg cursor-pointer border-2 border-white shadow-sm hover:shadow-md transition-all duration-300 group-hover/img:scale-105"
                                      onClick={() => setSelectedPerson(person)}
                                    />
                                    {index === 3 && person.image_urls.length > 4 && (
                                      <div 
                                        className="absolute inset-0 bg-black/60 rounded-lg flex items-center justify-center cursor-pointer"
                                        onClick={() => setSelectedPerson(person)}
                                      >
                                        <span className="text-white text-xs font-bold">+{person.image_urls.length - 4}</span>
                                      </div>
                                    )}
                                  </div>
                                ))}
                              </div>
                            </div>

                            {/* Action Buttons */}
                            <div className="gap-2 flex justify-end items-center">
                                {!person.completed && <TooltipProvider delayDuration={100}>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      onClick={() => handleFacialRecognition(person)}
                                      className="h-9 bg-gradient-to-r from-indigo-50 to-purple-50 hover:from-indigo-100 hover:to-purple-100 border-indigo-200 text-indigo-700 hover:text-indigo-800 transition-all duration-300"
                                    >
                                      <Scan className="w-4 h-4" />
                                    </Button>
                                  </TooltipTrigger>
                                  <TooltipContent>
                                    <p>Facial Recognition</p>
                                  </TooltipContent>
                                </Tooltip>
                              </TooltipProvider>}
                              

                              <TooltipProvider delayDuration={100}>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      onClick={() => setEditModal({ isOpen: true, person })}
                                      className="h-9 bg-gradient-to-r from-yellow-50 to-orange-50 hover:from-yellow-100 hover:to-orange-100 border-yellow-200 text-yellow-700 hover:text-yellow-800 transition-all duration-300"
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
                                      variant="outline"
                                      size="sm"
                                      onClick={() => handleDelete(person.id)}
                                      className="h-9 bg-gradient-to-r from-red-50 to-pink-50 hover:from-red-100 hover:to-pink-100 border-red-200 text-red-700 hover:text-red-800 transition-all duration-300"
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
                          </CardContent>
                        </Card>
                      ))}
                    </div>

                    {/* Bottom Pagination */}
                    {totalPages > 1 && (
                      <div className="flex justify-end mt-8 pt-8">
                        <div className="bg-white/80 backdrop-blur-sm rounded-xl p-4 shadow-lg border border-gray-200">
                          <PaginationControls 
                            currentPage={currentPage}
                            totalPages={totalPages}
                            onPageChange={setCurrentPage}
                          />
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Enhanced Image Modal */}
      {selectedPerson && (
        <div 
          className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4"
          onClick={() => setSelectedPerson(null)}
        >
          <div className="bg-white/95 backdrop-blur-sm rounded-2xl p-6 max-w-7xl w-full max-h-[95vh] overflow-auto shadow-2xl border border-white/20" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-gradient-to-r from-blue-500 to-purple-600 rounded-lg flex items-center justify-center">
                  <Eye className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h3 className="text-xl font-semibold text-gray-900">{selectedPerson.email}</h3>
                  <p className="text-sm text-gray-500">{selectedPerson.image_urls.length} images</p>
                </div>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setSelectedPerson(null)}
                className="rounded-full"
              >
                <X className="w-4 h-4" />
              </Button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {selectedPerson.image_urls.map((url, index) => (
                <div key={index} className="relative group">
                  <img
                    src={url}
                    alt={`Reference ${index + 1}`}
                    className="w-full h-auto object-contain rounded-xl border-2 border-white shadow-lg group-hover:shadow-xl transition-all duration-300 max-h-none"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 rounded-xl" />
                  <div className="absolute bottom-2 left-2 bg-white/90 backdrop-blur-sm rounded-lg px-2 py-1">
                    <span className="text-xs font-medium text-gray-700">#{index + 1}</span>
                  </div>
                </div>
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

      <Footer />
    </div>
  )
}

const EmailModal = ({ isOpen, onClose, email, onSubmit }: EmailModalProps) => {
  return (
    <Dialog open={isOpen} onOpenChange={() => onClose()}>
      <DialogContent className="bg-white/95 backdrop-blur-sm border-0 shadow-2xl">
        <DialogHeader>
          <DialogTitle className="text-xl font-semibold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
            Send Images via Email
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={(e) => {
          e.preventDefault()
          const formData = new FormData(e.currentTarget)
          onSubmit(formData)
        }}>
          <div className="space-y-6 py-4">
            <div className="space-y-2">
              <label className="flex items-center gap-2 text-sm font-semibold text-gray-700">
                <Mail className="w-4 h-4 text-blue-500" />
                Email Address
              </label>
              <Input
                type="email"
                name="email"
                defaultValue={email}
                readOnly
                className="w-full h-11 border-2 border-gray-200 bg-gray-50"
              />
            </div>
            <div className="space-y-2">
              <label className="flex items-center gap-2 text-sm font-semibold text-gray-700">
                <Download className="w-4 h-4 text-emerald-500" />
                Upload ZIP File
              </label>
              <Input
                type="file"
                name="file"
                accept=".zip"
                required
                className="w-full h-11 border-2 border-gray-200 focus:border-emerald-500 focus:ring-emerald-500/20 transition-all duration-300"
              />
              <p className="text-xs text-gray-500 flex items-center gap-1">
                <AlertCircle className="w-3 h-3" />
                Please upload a ZIP file containing the images
              </p>
            </div>
            <div className="flex justify-end gap-3 pt-4">
              <Button 
                type="button" 
                variant="outline" 
                onClick={onClose}
                className="px-6 border-2 border-gray-300 hover:border-gray-400"
              >
                Cancel
              </Button>
              <Button 
                type="submit"
                className="px-6 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white shadow-lg hover:shadow-xl transition-all duration-300"
              >
                <Mail className="w-4 h-4 mr-2" />
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
      <DialogContent className="max-w-3xl bg-white/95 backdrop-blur-sm border-0 shadow-2xl">
        <DialogHeader>
          <DialogTitle className="text-xl font-semibold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
            Edit Record
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <div className="space-y-6 py-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <label className="flex items-center gap-2 text-sm font-semibold text-gray-700">
                  <Mail className="w-4 h-4 text-blue-500" />
                  Email Address
                </label>
                <Input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                  required
                  className="w-full h-11 border-2 border-gray-200 focus:border-blue-500 focus:ring-blue-500/20 transition-all duration-300"
                />
              </div>
              <div className="space-y-2">
                <label className="flex items-center gap-2 text-sm font-semibold text-gray-700">
                  <Calendar className="w-4 h-4 text-purple-500" />
                  Date
                </label>
                <Input
                  type="date"
                  value={formData.date}
                  onChange={(e) => setFormData(prev => ({ ...prev, date: e.target.value }))}
                  required
                  className="w-full h-11 border-2 border-gray-200 focus:border-purple-500 focus:ring-purple-500/20 transition-all duration-300"
                />
              </div>
              <div className="space-y-2">
                <label className="flex items-center gap-2 text-sm font-semibold text-gray-700">
                  <Clock className="w-4 h-4 text-orange-500" />
                  Time
                </label>
                <Input
                  type="time"
                  value={formData.time}
                  onChange={(e) => setFormData(prev => ({ ...prev, time: e.target.value }))}
                  required
                  className="w-full h-11 border-2 border-gray-200 focus:border-orange-500 focus:ring-orange-500/20 transition-all duration-300"
                />
              </div>
            </div>

            {/* Current Images */}
            <div className="space-y-3">
              <label className="flex items-center gap-2 text-sm font-semibold text-gray-700">
                <ImageIcon className="w-4 h-4 text-emerald-500" />
                Current Images
              </label>
              <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
                {person?.image_urls
                  .filter(url => !formData.deletedImageUrls.includes(url))
                  .map((url, index) => (
                    <div key={url} className="relative group">
                      <img
                        src={url}
                        alt={`Image ${index + 1}`}
                        className="w-full h-20 object-cover rounded-lg border-2 border-white shadow-md group-hover:shadow-lg transition-all duration-300"
                      />
                      <button
                        type="button"
                        onClick={() => handleImageDelete(url)}
                        className="absolute -top-2 -right-2 bg-gradient-to-r from-red-500 to-pink-500 text-white p-1.5 rounded-full opacity-0 group-hover:opacity-100 transition-all duration-300 hover:scale-110 shadow-lg"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
              </div>
            </div>

            {/* New Images */}
            <div className="space-y-3">
              <label className="flex items-center gap-2 text-sm font-semibold text-gray-700">
                <ImageIcon className="w-4 h-4 text-indigo-500" />
                Add New Images
              </label>
              <Input
                type="file"
                accept="image/*"
                multiple
                onChange={handleNewImages}
                className="w-full h-11 border-2 border-gray-200 focus:border-indigo-500 focus:ring-indigo-500/20 transition-all duration-300"
              />
              {formData.newImages.length > 0 && (
                <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3 mt-3">
                  {formData.newImages.map((file, index) => (
                    <div key={index} className="relative group">
                      <img
                        src={URL.createObjectURL(file)}
                        alt={`New Image ${index + 1}`}
                        className="w-full h-20 object-cover rounded-lg border-2 border-emerald-200 shadow-md group-hover:shadow-lg transition-all duration-300"
                      />
                      <button
                        type="button"
                        onClick={() => setFormData(prev => ({
                          ...prev,
                          newImages: prev.newImages.filter((_, i) => i !== index)
                        }))}
                        className="absolute -top-2 -right-2 bg-gradient-to-r from-red-500 to-pink-500 text-white p-1.5 rounded-full opacity-0 group-hover:opacity-100 transition-all duration-300 hover:scale-110 shadow-lg"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="flex justify-end gap-3 pt-6 border-t border-gray-200">
              <Button 
                type="button" 
                variant="outline" 
                onClick={onClose}
                disabled={isLoading}
                className="px-6 border-2 border-gray-300 hover:border-gray-400"
              >
                Cancel
              </Button>
              <Button 
                type="submit"
                disabled={isLoading}
                className="px-6 min-w-[120px] bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white shadow-lg hover:shadow-xl transition-all duration-300"
              >
                {isLoading ? (
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    <span>Saving...</span>
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Save Changes</span>
                  </div>
                )}
              </Button>
            </div>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}

// Pagination Controls Component
interface PaginationControlsProps {
  currentPage: number
  totalPages: number
  onPageChange: (page: number) => void
}

const PaginationControls = ({ currentPage, totalPages, onPageChange }: PaginationControlsProps) => {
  const getVisiblePages = () => {
    const visiblePages: (number | string)[] = []
    
    if (totalPages <= 7) {
      // Show all pages if 7 or fewer
      for (let i = 1; i <= totalPages; i++) {
        visiblePages.push(i)
      }
    } else {
      // Always show first page
      visiblePages.push(1)
      
      if (currentPage > 4) {
        visiblePages.push('...')
      }
      
      // Show pages around current page
      const start = Math.max(2, currentPage - 1)
      const end = Math.min(totalPages - 1, currentPage + 1)
      
      for (let i = start; i <= end; i++) {
        visiblePages.push(i)
      }
      
      if (currentPage < totalPages - 3) {
        visiblePages.push('...')
      }
      
      // Always show last page
      if (totalPages > 1) {
        visiblePages.push(totalPages)
      }
    }
    
    return visiblePages
  }

  return (
    <div className="flex items-center gap-2">
      <Button
        variant="outline"
        size="sm"
        onClick={() => onPageChange(currentPage - 1)}
        disabled={currentPage === 1}
        className="h-9 px-3 bg-white/80 backdrop-blur-sm hover:bg-white border-gray-300 hover:border-gray-400 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-300"
      >
        <ChevronLeft className="w-4 h-4" />
      </Button>
      
      {getVisiblePages().map((page, index) => (
        <div key={index}>
          {page === '...' ? (
            <span className="px-3 py-2 text-gray-500">...</span>
          ) : (
            <Button
              variant={currentPage === page ? "default" : "outline"}
              size="sm"
              onClick={() => onPageChange(page as number)}
              className={`h-9 px-3 transition-all duration-300 ${
                currentPage === page
                  ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-md hover:shadow-lg border-0'
                  : 'bg-white/80 backdrop-blur-sm hover:bg-white border-gray-300 hover:border-blue-400 hover:text-blue-600'
              }`}
            >
              {page}
            </Button>
          )}
        </div>
      ))}
      
      <Button
        variant="outline"
        size="sm"
        onClick={() => onPageChange(currentPage + 1)}
        disabled={currentPage === totalPages}
        className="h-9 px-3 bg-white/80 backdrop-blur-sm hover:bg-white border-gray-300 hover:border-gray-400 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-300"
      >
        <ChevronRight className="w-4 h-4" />
      </Button>
    </div>
  )
} 