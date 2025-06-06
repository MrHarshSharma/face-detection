"use client"

import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import Link from "next/link"
import { UserPlus, Users, CheckCircle, XCircle, BarChart3 } from "lucide-react"
import { useEffect, useState } from "react"
import { supabase } from "@/lib/supabase"
import { toast, ToastContainer } from "react-toastify"

interface DailyStats {
  date: string;
  count: number;
}

interface Analytics {
  totalRecords: number;
  completedRecords: number;
  pendingRecords: number;
  dailyStats: DailyStats[];
}

export default function Home() {
  const [analytics, setAnalytics] = useState<Analytics>({
    totalRecords: 0,
    completedRecords: 0,
    pendingRecords: 0,
    dailyStats: []
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchAnalytics();
    getTotalRecordsCount();
  }, []);
  const getTotalRecordsCount = async () => {
    try {
      const { count, error } = await supabase
        .from('ref_images')
        .select('*', { count: 'exact', head: true })

      if (error) throw error

      // console.log(`Total records in database: ${count}`)
      // if (count !== null) {
      //   toast.info(`Total records in database: ${count}`)
      // }
    } catch (error) {
      console.error('Error getting total count:', error)
      toast.error('Error getting total record count')
    }
  }

  const fetchAnalytics = async () => {
    try {
      setLoading(true);

      // Get exact total count from database
      const { count: totalCount, error: countError } = await supabase
        .from('ref_images')
        .select('*', { count: 'exact', head: true })

      if (countError) throw countError;

      // Get completed records count
      const { count: completedCount, error: completedError } = await supabase
        .from('ref_images')
        .select('*', { count: 'exact', head: true })
        .eq('completed', true)

      if (completedError) throw completedError;

      // Get pending records count  
      const { count: pendingCount, error: pendingError } = await supabase
        .from('ref_images')
        .select('*', { count: 'exact', head: true })
        .eq('completed', false)

      if (pendingError) throw pendingError;

      // Get today's date for today's records count
      const today = new Date().toISOString().split('T')[0]
      const { count: todayCount, error: todayError } = await supabase
        .from('ref_images')
        .select('*', { count: 'exact', head: true })
        .gte('created_at', `${today}T00:00:00.000Z`)
        .lt('created_at', `${today}T23:59:59.999Z`)

      if (todayError) throw todayError;

      // Get daily statistics for last 7 days using aggregation
      const last7Days = []
      
      // Create promises for all 7 days to run in parallel
      const dayPromises = []
      for (let i = 0; i < 7; i++) {
        const date = new Date()
        date.setDate(date.getDate() - i)
        // Use local date to match what users would enter in date inputs
        const year = date.getFullYear()
        const month = String(date.getMonth() + 1).padStart(2, '0')
        const day = String(date.getDate()).padStart(2, '0')
        const dateString = `${year}-${month}-${day}`
        
        dayPromises.push(
          supabase
            .from('ref_images')
            .select('*', { count: 'exact', head: true })
            .gte('created_at', `${dateString}T00:00:00.000Z`)
            .lt('created_at', `${dateString}T23:59:59.999Z`)
            .then(({ count, error }) => {
              if (error) {
                console.error(`Error fetching count for ${dateString}:`, error)
              }
              return {
                date: dateString,
                count: error ? 0 : (count || 0),
                dayIndex: i
              }
            })
        )
      }

      // Wait for all day queries to complete
      const dayResults = await Promise.all(dayPromises)
      
      // Sort by date (most recent first) and ensure we have all 7 days
      const sortedDays = dayResults
        .sort((a, b) => a.dayIndex - b.dayIndex) // Sort by day index (0 = today, 6 = 6 days ago)
        .map(({ date, count }) => ({ date, count }))

      console.log('Daily statistics:', sortedDays)
      console.log('Today date string:', sortedDays[0]?.date)

      setAnalytics({
        totalRecords: totalCount || 0,
        completedRecords: completedCount || 0,
        pendingRecords: pendingCount || 0,
        dailyStats: sortedDays
      });

      // Show total count in console
      console.log(`Total records in database: ${totalCount}`)
      console.log(`Completed: ${completedCount}, Pending: ${pendingCount}`)

    } catch (error) {
      console.error('Error fetching analytics:', error);
      toast.error('Error loading analytics data');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-[80vh] space-y-8 py-8">
      {/* Analytics Section */}
      <ToastContainer />
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
        <Card className="p-6 bg-white">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
              <Users className="w-6 h-6 text-blue-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">Total Records</p>
              <p className="text-2xl font-bold">{loading ? '...' : analytics.totalRecords}</p>
            </div>
          </div>
        </Card>

        <Card className="p-6 bg-white">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center">
              <CheckCircle className="w-6 h-6 text-green-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">Completed</p>
              <p className="text-2xl font-bold">{loading ? '...' : analytics.completedRecords}</p>
            </div>
          </div>
        </Card>

        <Card className="p-6 bg-white">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center">
              <XCircle className="w-6 h-6 text-red-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">Pending</p>
              <p className="text-2xl font-bold">{loading ? '...' : analytics.pendingRecords}</p>
            </div>
          </div>
        </Card>

        <Card className="p-6 bg-white">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-purple-100 rounded-full flex items-center justify-center">
              <BarChart3 className="w-6 h-6 text-purple-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">Today's Records</p>
              <p className="text-2xl font-bold">
                {loading ? '...' : analytics.dailyStats.find(stat => {
                  const today = new Date().toISOString().split('T')[0]
                  return stat.date === today
                })?.count || 0}
              </p>
            </div>
          </div>
        </Card>
      </div>

      {/* Daily Statistics */}
      <Card className="p-6 bg-white">
        <h2 className="text-lg font-semibold mb-4">Last 7 Days Statistics</h2>
        <div className="space-y-4">
          {loading ? (
            <p>Loading statistics...</p>
          ) : (
            analytics.dailyStats.map((stat) => (
              <div key={stat.date} className="flex items-center gap-4">
                <div className="w-32">
                  <p className="text-sm text-gray-600">
                    {new Date(stat.date).toLocaleDateString()}
                  </p>
                </div>
                <div className="flex-1 h-4 bg-gray-100 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-blue-500 rounded-full"
                    style={{ 
                      width: `${(stat.count / Math.max(...analytics.dailyStats.map(s => s.count))) * 100}%` 
                    }}
                  />
                </div>
                <div className="w-12 text-right">
                  <p className="text-sm font-medium">{stat.count}</p>
                </div>
              </div>
            ))
          )}
        </div>
      </Card>

      {/* Action Cards */}
      <div className="grid md:grid-cols-2 gap-6">
        <Link href="/add-image" className="block">
          <Card className="p-6 hover:shadow-lg transition-shadow cursor-pointer h-full">
            <div className="space-y-4">
              <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
                <UserPlus className="w-6 h-6 text-blue-600" />
              </div>
              <h2 className="text-2xl font-semibold">Add New Person</h2>
              <p className="text-gray-600">
                Upload images and information for new face recognition entries
              </p>
              <Button className="w-full">
                Add Images
              </Button>
            </div>
          </Card>
        </Link>

        <Link href="/get-people" className="block">
          <Card className="p-6 hover:shadow-lg transition-shadow cursor-pointer h-full">
            <div className="space-y-4">
              <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center">
                <Users className="w-6 h-6 text-green-600" />
              </div>
              <h2 className="text-2xl font-semibold">View Records</h2>
              <p className="text-gray-600">
                Browse, search, and manage existing face recognition records
              </p>
              <Button className="w-full">
                View Records
              </Button>
            </div>
          </Card>
        </Link>
      </div>

      <div className="text-center mt-12">
        <p className="text-sm text-gray-500">
          Face Recognition System • Version 1.0
        </p>
      </div>
    </div>
  )
}

