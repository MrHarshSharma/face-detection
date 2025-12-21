"use client"

import { useEffect, useState } from 'react'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { supabase } from '@/lib/supabase'
import { toast } from 'react-toastify'

export default function SubscriptionPage() {
  const envSecret = process.env.NEXT_PUBLIC_SUBSCRIPTION_ACCESS
  const [password, setPassword] = useState('')
  const [accessAllowed, setAccessAllowed] = useState(false)
  const [isPaid, setIsPaid] = useState<boolean | null>(null)
  const [recordId, setRecordId] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isUpdating, setIsUpdating] = useState(false)

  useEffect(() => {
    const fetchStatus = async () => {
      try {
        const { data, error } = await supabase
          .from('auth')
          .select('id, isPaid')
          .limit(1)
          .maybeSingle()

        if (error) throw error

        if (!data) {
          setIsPaid(false)
          setRecordId(null)
          toast.error('No subscription record found in auth table')
        } else {
          setIsPaid(!!data.isPaid)
          setRecordId(data.id)
        }
      } catch (error) {
        console.error('Error fetching subscription status:', error)
        toast.error('Unable to load subscription status')
      } finally {
        setIsLoading(false)
      }
    }

    if (accessAllowed) {
      fetchStatus()
    } else {
      setIsLoading(false)
    }
  }, [accessAllowed])

  const handleToggle = async (checked: boolean) => {
    if (!recordId) {
      toast.error('No subscription record to update')
      return
    }

    setIsUpdating(true)
    try {
      const { error } = await supabase
        .from('auth')
        .update({ isPaid: checked })
        .eq('id', recordId)
        .select('id')
        .maybeSingle()

      if (error) throw error

      setIsPaid(checked)
      toast.success(`Subscription set to ${checked ? 'Paid' : 'Unpaid'}`)
    } catch (error) {
      console.error('Error updating subscription:', error)
      toast.error('Failed to update subscription status')
    } finally {
      setIsUpdating(false)
    }
  }

  const handleUnlock = (e: React.FormEvent) => {
    e.preventDefault()
    if (!envSecret) {
      toast.error('Access secret is not configured')
      return
    }
    if (password === envSecret) {
      setAccessAllowed(true)
      toast.success('Access granted')
    } else {
      toast.error('Incorrect password')
    }
  }

  if (!envSecret) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center space-y-3">
          <h1 className="text-2xl font-semibold text-gray-800">Access not configured</h1>
          <p className="text-gray-500 text-sm">Set NEXT_PUBLIC_SUBSCRIPTION_ACCESS in your environment.</p>
        </div>
      </div>
    )
  }

  if (!accessAllowed) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-6">
        <div className="bg-white shadow-lg rounded-2xl p-8 w-full max-w-md border border-gray-100 text-center space-y-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Enter Access Password</h1>
            <p className="text-gray-500 text-sm mt-1">Authorized personnel only.</p>
          </div>
          <form className="space-y-4" onSubmit={handleUnlock}>
            <Input
              type="password"
              placeholder="Enter password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
            <Button type="submit" className="w-full" disabled={!password.trim()}>
              Unlock
            </Button>
          </form>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-6">
      <div className="bg-white shadow-lg rounded-2xl p-8 w-full max-w-md border border-gray-100 text-center space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Subscription Control</h1>
          <p className="text-gray-500 text-sm mt-1">Toggle paid status</p>
        </div>

        <div className="flex items-center justify-center gap-3 py-4">
          <Label className="text-gray-700">{isPaid ? 'Paid' : 'Unpaid'}</Label>
          <Switch
            checked={!!isPaid}
            disabled={isLoading || isUpdating}
            onCheckedChange={handleToggle}
          />
        </div>

        {(isLoading || isUpdating) && (
          <p className="text-sm text-gray-500">{isLoading ? 'Loading status…' : 'Updating…'}</p>
        )}

        {!isLoading && recordId === null && (
          <p className="text-sm text-red-500">No record found to update.</p>
        )}
      </div>
    </div>
  )
}

