"use client"

import { useState, useEffect } from 'react'
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Trash2, HardDrive, Clock, Download } from "lucide-react"
import { faceApiModelLoader } from '@/lib/faceApiCache'
import { toast } from 'react-toastify'

interface CacheInfo {
  modelName: string
  size: number
  timestamp: number
}

export default function FaceApiCacheManager() {
  const [cacheInfo, setCacheInfo] = useState<CacheInfo[]>([])
  const [loading, setLoading] = useState(false)
  const [totalSize, setTotalSize] = useState(0)

  const loadCacheInfo = async () => {
    try {
      const info = await faceApiModelLoader.getCacheInfo()
      setCacheInfo(info)
      const total = info.reduce((sum, item) => sum + item.size, 0)
      setTotalSize(total)
    } catch (error) {
      console.error('Error loading cache info:', error)
      toast.error('Failed to load cache information')
    }
  }

  const clearCache = async () => {
    if (!window.confirm('Are you sure you want to clear the face recognition model cache? Models will need to be downloaded again.')) {
      return
    }

    setLoading(true)
    try {
      await faceApiModelLoader.clearCache()
      await loadCacheInfo()
      toast.success('Cache cleared successfully')
    } catch (error) {
      console.error('Error clearing cache:', error)
      toast.error('Failed to clear cache')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadCacheInfo()
  }, [])

  const formatSize = (bytes: number): string => {
    if (bytes === 0) return '0 B'
    const k = 1024
    const sizes = ['B', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }

  const formatDate = (timestamp: number): string => {
    return new Date(timestamp).toLocaleString()
  }

  return (
    <Card className="w-full max-w-2xl">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <HardDrive className="w-5 h-5" />
          Face Recognition Cache Manager
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Cache Summary */}
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-blue-50 p-4 rounded-lg">
            <div className="flex items-center gap-2 mb-1">
              <Download className="w-4 h-4 text-blue-600" />
              <span className="text-sm font-medium text-blue-800">Cached Models</span>
            </div>
            <div className="text-2xl font-bold text-blue-900">{cacheInfo.length}</div>
          </div>
          
          <div className="bg-green-50 p-4 rounded-lg">
            <div className="flex items-center gap-2 mb-1">
              <HardDrive className="w-4 h-4 text-green-600" />
              <span className="text-sm font-medium text-green-800">Total Size</span>
            </div>
            <div className="text-2xl font-bold text-green-900">{formatSize(totalSize)}</div>
          </div>
        </div>

        {/* Cache Details */}
        {cacheInfo.length > 0 ? (
          <div className="space-y-2">
            <h4 className="font-medium text-gray-900">Cached Models:</h4>
            {cacheInfo.map((item, index) => (
              <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <div>
                  <div className="font-medium text-sm">{item.modelName}</div>
                  <div className="text-xs text-gray-500 flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    {formatDate(item.timestamp)}
                  </div>
                </div>
                <div className="text-sm font-medium text-gray-700">
                  {formatSize(item.size)}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-8 text-gray-500">
            <HardDrive className="w-12 h-12 mx-auto mb-3 text-gray-300" />
            <p>No cached models found</p>
            <p className="text-sm">Models will be cached after first download</p>
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-2 pt-4 border-t">
          <Button 
            variant="outline" 
            onClick={loadCacheInfo}
            className="flex-1"
          >
            Refresh
          </Button>
          
          {cacheInfo.length > 0 && (
            <Button 
              variant="destructive" 
              onClick={clearCache}
              disabled={loading}
              className="flex items-center gap-2"
            >
              <Trash2 className="w-4 h-4" />
              {loading ? 'Clearing...' : 'Clear Cache'}
            </Button>
          )}
        </div>

        {/* Cache Benefits Info */}
        <div className="bg-indigo-50 p-4 rounded-lg border border-indigo-200">
          <h5 className="font-medium text-indigo-900 mb-2">Cache Benefits:</h5>
          <ul className="text-sm text-indigo-800 space-y-1">
            <li>• Models download only once and persist across sessions</li>
            <li>• Faster page loads after initial download</li>
            <li>• Works offline once models are cached</li>
            <li>• Automatic cache expiration after 7 days</li>
          </ul>
        </div>
      </CardContent>
    </Card>
  )
} 