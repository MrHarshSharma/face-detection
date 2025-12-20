"use client"

import { AlertTriangle } from "lucide-react"
import { Button } from "@/components/ui/button"

interface SubscriptionExpiredProps {
  onRetry?: () => void
}

export default function SubscriptionExpired({ onRetry }: SubscriptionExpiredProps) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-6">
      <div className="max-w-lg w-full bg-white shadow-xl rounded-2xl p-8 border border-red-100 text-center">
        <div className="w-16 h-16 bg-red-50 text-red-600 rounded-full flex items-center justify-center mx-auto mb-4">
          <AlertTriangle className="w-8 h-8" />
        </div>
        <h1 className="text-2xl font-bold text-gray-900 mb-3">Subscription expired</h1>
        <p className="text-gray-600 mb-6">Subscription expired, Please contact the admin. Thank you.</p>
        {onRetry && (
          <Button 
            variant="outline" 
            className="border-red-200 text-red-600 hover:bg-red-50" 
            onClick={onRetry}
          >
            Retry check
          </Button>
        )}
      </div>
    </div>
  )
}

