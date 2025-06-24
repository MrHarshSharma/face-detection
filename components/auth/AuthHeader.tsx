"use client"

import { Button } from "@/components/ui/button"
import { Zap, Clock, User, LogOut } from "lucide-react"
import { useAuth } from '@/contexts/AuthContext'

interface AuthHeaderProps {
  status?: {
    isReady: boolean
    readyText: string
    loadingText: string
  }
}

export default function AuthHeader({ status }: AuthHeaderProps) {
  const { isAuthenticated, user, logout, setShowLoginModal } = useAuth()

  return (
    <div className="flex justify-between mb-8 items-center">
      {/* Status Indicator */}
      {status && (
        <div className={`flex items-center gap-3 px-6 py-3 rounded-xl shadow-lg border-2 transition-all duration-300 ${
          status.isReady 
            ? 'bg-gradient-to-r from-emerald-50 to-teal-50 text-emerald-700 border-emerald-200' 
            : 'bg-gradient-to-r from-yellow-50 to-orange-50 text-yellow-700 border-yellow-200'
        }`}>
          {status.isReady ? (
            <>
              <div className="w-3 h-3 bg-emerald-500 rounded-full shadow-lg"></div>
              <Zap className="w-5 h-5 text-emerald-600" />
              <span className="font-semibold">{status.readyText}</span>
            </>
          ) : (
            <>
              <div className="w-3 h-3 bg-yellow-500 rounded-full animate-pulse shadow-lg"></div>
              <Clock className="w-5 h-5 text-yellow-600" />
              <span className="font-semibold">{status.loadingText}</span>
            </>
          )}
        </div>
      )}

      {/* Auth Controls */}
      <div className="flex items-center gap-4">
        {isAuthenticated ? (
          <>
            {user && (
              <div className="flex items-center gap-2 px-4 py-2 bg-blue-50 rounded-lg border border-blue-200">
                <User className="w-4 h-4 text-blue-600" />
                <span className="text-sm font-medium text-blue-800">{user.email}</span>
              </div>
            )}
            <Button
              variant="outline"
              onClick={logout}
              className="h-11 px-6 text-red-600 hover:text-red-700 hover:bg-red-50 border-2 border-red-200 hover:border-red-300 transition-all duration-300"
            >
              <LogOut className="w-4 h-4 mr-2" />
              Logout
            </Button>
          </>
        ) : (
          <Button
            onClick={() => setShowLoginModal(true)}
            className="h-11 px-6 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white shadow-lg hover:shadow-xl transition-all duration-300"
          >
            <User className="w-4 h-4 mr-2" />
            Sign In
          </Button>
        )}
      </div>
    </div>
  )
} 