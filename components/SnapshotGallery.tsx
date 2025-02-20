"use client"

import { useState } from "react"
import Image from "next/image"
import { Button } from "@/components/ui/button"
import { ChevronLeft, ChevronRight } from "lucide-react"

interface SnapshotGalleryProps {
  snapshots: string[]
}

export default function SnapshotGallery({ snapshots }: SnapshotGalleryProps) {
  const [currentPage, setCurrentPage] = useState(1)
  const snapshotsPerPage = 15
  const totalPages = Math.ceil(snapshots.length / snapshotsPerPage)

  const startIndex = (currentPage - 1) * snapshotsPerPage
  const endIndex = startIndex + snapshotsPerPage
  const currentSnapshots = snapshots.slice(startIndex, endIndex)

  return (
    <div className="mt-8">
      <h2 className="text-2xl font-semibold mb-4 text-gray-800">Yipee, {snapshots.length} images found!</h2>
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
        {currentSnapshots.map((snapshot, index) => (
          <div
            key={startIndex + index}
            className="relative aspect-video rounded-lg overflow-hidden shadow-md hover:shadow-lg transition-shadow duration-300"
          >
            <Image
              src={snapshot || "/placeholder.svg"}
              alt={`Snapshot ${startIndex + index + 1}`}
              layout="fill"
              objectFit="cover"
              className="rounded-lg"
            />
            <div className="absolute bottom-0 right-0 bg-black bg-opacity-50 text-white text-xs px-2 py-1 rounded-tl-lg">
              {startIndex + index + 1}
            </div>
          </div>
        ))}
      </div>
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
  )
}

