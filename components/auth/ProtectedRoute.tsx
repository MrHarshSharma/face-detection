"use client"

import { useEffect, ReactNode } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import LoginModal from './LoginModal'
import SubscriptionExpired from './SubscriptionExpired'

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
  const { isAuthenticated, setShowLoginModal, isPaid, isCheckingSubscription } = useAuth()

  useEffect(() => {
    if (!isAuthenticated && isPaid !== false && !isCheckingSubscription) {
      setShowLoginModal(true)
    }
  }, [isAuthenticated, isPaid, isCheckingSubscription, setShowLoginModal])

  if (isCheckingSubscription) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-gray-200 border-t-blue-500 rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-600">Checking subscription...</p>
        </div>
      </div>
    )
  }

  if (isPaid === false) {
    return <SubscriptionExpired />
  }

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

