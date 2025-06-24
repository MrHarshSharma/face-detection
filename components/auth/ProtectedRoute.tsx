"use client"

import { useEffect, ReactNode } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import LoginModal from './LoginModal'

interface ProtectedRouteProps {
  children: ReactNode
  title?: string
  subtitle?: string
  fallback?: ReactNode
}

export default function ProtectedRoute({ 
  children, 
  title,
  subtitle,
  fallback 
}: ProtectedRouteProps) {
  const { isAuthenticated, setShowLoginModal } = useAuth()

  useEffect(() => {
    if (!isAuthenticated) {
      setShowLoginModal(true)
    }
  }, [isAuthenticated, setShowLoginModal])

  if (!isAuthenticated) {
    return (
      <>
        <LoginModal title={title} subtitle={subtitle} />
        {fallback || (
          <div className="min-h-screen flex items-center justify-center bg-gray-50">
            <div className="text-center">
              <div className="w-16 h-16 bg-gray-200 rounded-full mx-auto mb-4 flex items-center justify-center">
                <div className="w-8 h-8 border-2 border-gray-400 border-t-transparent rounded-full animate-spin" />
              </div>
              <h2 className="text-xl font-semibold text-gray-700 mb-2">Authentication Required</h2>
              <p className="text-gray-500">Please sign in to access this page</p>
            </div>
          </div>
        )}
      </>
    )
  }

  return <>{children}</>
} 