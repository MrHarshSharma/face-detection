"use client"

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react'
import { supabase } from '@/lib/supabase'
import { toast } from 'react-toastify'

interface User {
  id: string
  email: string
  role?: string
}

interface AuthContextType {
  user: User | null
  isAuthenticated: boolean
  isLoading: boolean
  showLoginModal: boolean
  setShowLoginModal: (show: boolean) => void
  login: (email: string, password: string) => Promise<boolean>
  logout: () => void
  checkAuthStatus: () => void
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

interface AuthProviderProps {
  children: ReactNode
}

export function AuthProvider({ children }: AuthProviderProps) {
  const [user, setUser] = useState<User | null>(null)
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [showLoginModal, setShowLoginModal] = useState(false)

  // Check for saved credentials on mount
  useEffect(() => {
    checkAuthStatus()
  }, [])

  const checkAuthStatus = () => {
    try {
      const savedCredentials = localStorage.getItem('findPersonCredentials')
      if (savedCredentials) {
        const { email, password } = JSON.parse(savedCredentials)
        
        // Validate saved credentials
        if (email && password) {
          setUser({ id: '1', email })
          setIsAuthenticated(true)
          setShowLoginModal(false)
          toast.success('Automatically logged in with saved credentials')
        } else {
          // Clear invalid credentials
          localStorage.removeItem('findPersonCredentials')
        }
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
      // Get user from database
      const { data: userData, error } = await supabase
        .from('users')
        .select('*')
        .eq('email', email)
        .eq('password', password)
        .single()

      if (error || !userData) {
        throw new Error('Invalid credentials')
      }

      // Simulate API call delay
      await new Promise(resolve => setTimeout(resolve, 1000))

      // Set user data
      const user: User = {
        id: userData.id,
        email: userData.email,
        role: userData.role
      }

      setUser(user)
      setIsAuthenticated(true)
      setShowLoginModal(false)

      // Save credentials to localStorage
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

    // Clear saved credentials from localStorage
    localStorage.removeItem('findPersonCredentials')

    toast.info('Logged out successfully')
  }

  const value: AuthContextType = {
    user,
    isAuthenticated,
    isLoading,
    showLoginModal,
    setShowLoginModal,
    login,
    logout,
    checkAuthStatus
  }

  return (
    <AuthContext.Provider value={value}>
      {children}
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