"use client"

import { useState } from "react"
import Image from "next/image"
import { Button } from "@/components/ui/button"
import { ChevronLeft, ChevronRight, RotateCcw, X } from "lucide-react"

interface SnapshotInfo {
  url: string;
  timestamp: string;
}

interface SnapshotGalleryProps {
  snapshots: SnapshotInfo[]
  onReset?: () => void
}

export default function SnapshotGallery({ snapshots, onReset }: SnapshotGalleryProps) {
  const [currentPage, setCurrentPage] = useState(1)
  const [selectedImageIndex, setSelectedImageIndex] = useState<number | null>(null)
  const snapshotsPerPage = 15
  const totalPages = Math.ceil(snapshots.length / snapshotsPerPage)

  const startIndex = (currentPage - 1) * snapshotsPerPage
  const endIndex = startIndex + snapshotsPerPage
  const currentSnapshots = snapshots.slice(startIndex, endIndex)

  const handleImageClick = (index: number) => {
    setSelectedImageIndex(startIndex + index);
  };

  const handlePrevImage = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (selectedImageIndex !== null) {
      setSelectedImageIndex(Math.max(0, selectedImageIndex - 1));
    }
  };

  const handleNextImage = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (selectedImageIndex !== null) {
      setSelectedImageIndex(Math.min(snapshots.length - 1, selectedImageIndex + 1));
    }
  };

  return (
    <>
      <div className="space-y-4">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-semibold">Detected Faces</h3>
          <Button
            onClick={onReset}
            variant="outline"
            className="scale-75 border-2 border-red-500 text-red-500 hover:bg-yellow-400 hover:text-black hover:border-yellow-400"
          >
            <RotateCcw className="w-4 h-4 mr-2" />
            Clear Results
          </Button>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
          {currentSnapshots.map((snapshot, index) => (
            <div
              key={startIndex + index}
              className="relative aspect-video rounded-lg overflow-hidden shadow-md hover:shadow-lg transition-shadow duration-300 cursor-pointer"
              onClick={() => handleImageClick(index)}
            >
              <Image
                src={snapshot.url || "/placeholder.svg"}
                alt={`Snapshot ${startIndex + index + 1}`}
                layout="fill"
                objectFit="cover"
                className="rounded-lg"
              />
              <div className="absolute bottom-0 left-0 right-0 flex justify-between bg-black bg-opacity-50 text-white text-xs px-2 py-1">
                <span>{snapshot.timestamp}</span>
                <span>#{startIndex + index + 1}</span>
              </div>
            </div>
          ))}
        </div>
        {/* Pagination controls */}
        {totalPages > 1 && (
          <div className="flex justify-center items-center mt-4 space-x-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage((prev) => Math.max(prev - 1, 1))}
              disabled={currentPage === 1}
            >
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <span className="text-sm">
              Page {currentPage} of {totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage((prev) => Math.min(prev + 1, totalPages))}
              disabled={currentPage === totalPages}
            >
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        )}
      </div>

      {/* Modal for enlarged image */}
      {selectedImageIndex !== null && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50"
          onClick={() => setSelectedImageIndex(null)}
        >
          <div className="relative max-w-4xl max-h-[90vh] w-full mx-4">
            <Button
              className="absolute top-4 right-4 bg-black bg-opacity-50 hover:bg-opacity-75"
              onClick={(e) => {
                e.stopPropagation();
                setSelectedImageIndex(null);
              }}
            >
              <X className="w-4 h-4" />
            </Button>

            {/* Left Navigation Button */}
            <Button
              className="absolute left-4 top-1/2 -translate-y-1/2 bg-black bg-opacity-50 hover:bg-opacity-75"
              onClick={handlePrevImage}
              disabled={selectedImageIndex === 0}
            >
              <ChevronLeft className="w-6 h-6" />
            </Button>

            {/* Right Navigation Button */}
            <Button
              className="absolute right-4 top-1/2 -translate-y-1/2 bg-black bg-opacity-50 hover:bg-opacity-75"
              onClick={handleNextImage}
              disabled={selectedImageIndex === snapshots.length - 1}
            >
              <ChevronRight className="w-6 h-6" />
            </Button>

            <img
              src={snapshots[selectedImageIndex].url}
              alt={`Enlarged snapshot ${selectedImageIndex + 1}`}
              className="w-full h-full object-contain rounded-lg"
              onClick={(e) => e.stopPropagation()}
            />

            {/* Image Counter */}
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-black bg-opacity-50 text-white px-3 py-1 rounded-full">
              {snapshots[selectedImageIndex].timestamp} - {selectedImageIndex + 1} / {snapshots.length}
            </div>
          </div>
        </div>
      )}
    </>
  )
}

