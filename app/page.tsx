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

      // Get records for other analytics (limited to 2000 for performance)
      const { data: records, error } = await supabase
        .from('ref_images')
        .select('*')
        .order('date', { ascending: false })
        .limit(2000);

      if (error) throw error;

      // Calculate statistics from fetched records
      const completedRecords = records?.filter(r => r.completed).length || 0;
      const pendingRecords = (records?.length || 0) - completedRecords;

      // Calculate daily statistics
      const dailyStats = records?.reduce((acc: { [key: string]: number }, record) => {
        const date = record.date;
        acc[date] = (acc[date] || 0) + 1;
        return acc;
      }, {});

      const formattedDailyStats = Object.entries(dailyStats || {})
        .map(([date, count]) => ({ date, count }))
        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
        .slice(0, 7); // Last 7 days

      setAnalytics({
        totalRecords: totalCount || 0, // Use exact count from database
        completedRecords,
        pendingRecords,
        dailyStats: formattedDailyStats
      });

      // Show total count in console and toast
      console.log(`Total records in database: ${totalCount}`)
      if (totalCount !== null) {
        toast.info(`Total records in database: ${totalCount}`)
      }

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
                {loading ? '...' : analytics.dailyStats[0]?.count || 0}
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

