"use client"

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react'
import { supabase } from '@/lib/supabase'
import { toast } from 'react-toastify'
import SubscriptionExpired from '@/components/auth/SubscriptionExpired'

interface User {
  id: string
  email: string
  role?: string
}

interface AuthContextType {
  user: User | null
  isAuthenticated: boolean
  isLoading: boolean
  isPaid: boolean | null
  isCheckingSubscription: boolean
  showLoginModal: boolean
  setShowLoginModal: (show: boolean) => void
  login: (email: string, password: string) => Promise<boolean>
  logout: () => void
  checkAuthStatus: () => Promise<void>
  checkIsPaidStatus: () => Promise<boolean>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

interface AuthProviderProps {
  children: ReactNode
}

export function AuthProvider({ children }: AuthProviderProps) {
  const [user, setUser] = useState<User | null>(null)
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [isPaid, setIsPaid] = useState<boolean | null>(null)
  const [isCheckingSubscription, setIsCheckingSubscription] = useState(true)
  const [showLoginModal, setShowLoginModal] = useState(false)

  const checkIsPaidStatus = async (): Promise<boolean> => {
    try {
      setIsCheckingSubscription(true)

      const { data, error } = await supabase
        .from('auth')
        .select('isPaid')
        .limit(1)
        .maybeSingle()

      if (error) {
        throw error
      }

      const paidStatus = data?.isPaid ?? false
      setIsPaid(paidStatus)
      return paidStatus
    } catch (error) {
      console.error('Error checking subscription status:', error)
      toast.error('Unable to verify subscription status')
      setIsPaid(false)
      return false
    } finally {
      setIsCheckingSubscription(false)
    }
  }

  useEffect(() => {
    const bootstrapAuth = async () => {
      await checkAuthStatus()
    }

    bootstrapAuth()
  }, [])

  const checkAuthStatus = async () => {
    try {
      const savedCredentials = localStorage.getItem('findPersonCredentials')
      if (savedCredentials) {
        const { email, password } = JSON.parse(savedCredentials)

        const isPaidStatus = await checkIsPaidStatus()
        if (!isPaidStatus) {
          setUser(null)
          setIsAuthenticated(false)
          setShowLoginModal(false)
          toast.error('Subscription expired, please contact the admin.')
          return
        }

        if (email && password) {
          setUser({ id: '1', email })
          setIsAuthenticated(true)
          setShowLoginModal(false)
          toast.success('Automatically logged in with saved credentials')
        } else {
          localStorage.removeItem('findPersonCredentials')
        }
      } else {
        await checkIsPaidStatus()
      }
    } catch (error) {
      console.error('Error checking saved credentials:', error)
      localStorage.removeItem('findPersonCredentials')
    }
  }

  const login = async (email: string, password: string): Promise<boolean> => {
    if (!email.trim() || !password.trim()) {
      toast.error('Please enter both email and password')
      return false
    }

    setIsLoading(true)

    try {
      const { data: userData, error } = await supabase
        .from('users')
        .select('*')
        .eq('email', email)
        .eq('password', password)
        .single()

      if (error || !userData) {
        throw new Error('Invalid credentials')
      }

      const paid = await checkIsPaidStatus()
      if (!paid) {
        toast.error('Subscription expired, please contact the admin.')
        setUser(null)
        setIsAuthenticated(false)
        setShowLoginModal(false)
        return false
      }

      await new Promise(resolve => setTimeout(resolve, 1000))

      const user: User = {
        id: userData.id,
        email: userData.email,
        role: userData.role
      }

      setUser(user)
      setIsAuthenticated(true)
      setShowLoginModal(false)

      const credentials = { email, password }
      localStorage.setItem('findPersonCredentials', JSON.stringify(credentials))

      toast.success('Successfully authenticated!')
      return true

    } catch (error) {
      console.error('Login error:', error)
      toast.error('Authentication failed. Please try again.')
      return false
    } finally {
      setIsLoading(false)
    }
  }

  const logout = () => {
    setUser(null)
    setIsAuthenticated(false)
    setShowLoginModal(false)

    localStorage.removeItem('findPersonCredentials')

    toast.info('Logged out successfully')
  }

  const value: AuthContextType = {
    user,
    isAuthenticated,
    isLoading,
    isPaid,
    isCheckingSubscription,
    showLoginModal,
    setShowLoginModal,
    login,
    logout,
    checkAuthStatus,
    checkIsPaidStatus
  }

  const shouldShowExpired = !isCheckingSubscription && isPaid === false

  return (
    <AuthContext.Provider value={value}>
      {isCheckingSubscription ? (
        <div className="min-h-screen flex items-center justify-center bg-gray-50">
          <div className="text-center">
            <div className="w-16 h-16 border-4 border-gray-200 border-t-blue-500 rounded-full animate-spin mx-auto mb-4" />
            <p className="text-gray-600">Checking subscription status...</p>
          </div>
        </div>
      ) : shouldShowExpired ? (
        <SubscriptionExpired onRetry={() => checkIsPaidStatus()} />
      ) : (
        children
      )}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}

