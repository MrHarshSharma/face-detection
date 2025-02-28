"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { ChevronLeft } from "lucide-react"

export default function Navbar() {
  const pathname = usePathname()
  
  return (
    <nav className="bg-white shadow-sm border-b">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16 items-center">
          <div className="flex items-center">
            {pathname !== "/" && (
              <Link href="/" className="flex items-center text-gray-500 hover:text-gray-700">
                <ChevronLeft className="w-5 h-5 mr-1" />
                Back
              </Link>
            )}
          </div>
          <div className="flex items-center space-x-4">
            <Link 
              href="/" 
              className={`px-3 py-2 rounded-md text-sm font-medium ${
                pathname === "/" 
                  ? "text-black" 
                  : "text-gray-500 hover:text-gray-700"
              }`}
            >
              Home
            </Link>
            <Link 
              href="/convert" 
              className={`px-3 py-2 rounded-md text-sm font-medium ${
                pathname === "/convert" 
                  ? "text-black" 
                  : "text-gray-500 hover:text-gray-700"
              }`}
            >
              Convert Here
            </Link>
          </div>
        </div>
      </div>
    </nav>
  )
} 