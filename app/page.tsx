"use client"

import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import Link from "next/link"
import { UserPlus, Users, CheckCircle, XCircle, BarChart3 } from "lucide-react"
import { useEffect, useState } from "react"
import { supabase } from "@/lib/supabase"
import { toast, ToastContainer } from "react-toastify"
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from 'recharts'
import Footer from "@/components/Footer"

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
    <div className="min-h-[80vh] space-y-4">
      <ToastContainer />
      
      {/* Header Section */}
      <div className="flex flex-col pb-5 mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Dashboard Overview</h1>
        <p className="text-gray-600">Facial Recognition System Analytics</p>
      </div>

      {/* Main Analytics Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Left Column - Completion Status */}
        <div className="lg:col-span-1">
          <Card className="p-6 bg-gradient-to-br from-purple-50 to-blue-50 border-0 shadow-lg h-full">
            <div className="flex flex-col h-full">
              <div className="text-center mb-6">
                <h3 className="text-lg font-semibold text-gray-800 mb-1">Completion Overview</h3>
                <p className="text-sm text-gray-500">Status Distribution</p>
              </div>
              
              <div className="flex-1 flex items-center justify-center relative">
                {loading ? (
                  <div className="text-center">
                    <div className="w-12 h-12 border-4 border-purple-200 border-t-purple-600 rounded-full animate-spin mx-auto mb-3" />
                    <p className="text-sm text-gray-500 font-medium">Loading analytics...</p>
                  </div>
                ) : (
                  <>
                    <ResponsiveContainer width="100%" height={200}>
                      <PieChart>
                        <defs>
                          <linearGradient id="completedGradient" x1="0" y1="0" x2="1" y2="1">
                            <stop offset="0%" stopColor="#22c55e" />
                            <stop offset="50%" stopColor="#16a34a" />
                            <stop offset="100%" stopColor="#15803d" />
                          </linearGradient>
                          <linearGradient id="pendingGradient" x1="0" y1="0" x2="1" y2="1">
                            <stop offset="0%" stopColor="#f59e0b" />
                            <stop offset="100%" stopColor="#d97706" />
                          </linearGradient>
                          <filter id="shadow" x="-50%" y="-50%" width="200%" height="200%">
                            <feDropShadow dx="2" dy="2" stdDeviation="3" floodColor="#000" floodOpacity="0.1"/>
                          </filter>
                        </defs>
                        <Pie
                          data={[
                            {
                              name: 'Completed',
                              value: analytics.completedRecords,
                              percentage: analytics.totalRecords > 0 
                                ? Number(((analytics.completedRecords / analytics.totalRecords) * 100).toFixed(1))
                                : 0,
                              count: analytics.completedRecords
                            },
                            {
                              name: 'Pending',
                              value: analytics.pendingRecords,
                              percentage: analytics.totalRecords > 0 
                                ? Number(((analytics.pendingRecords / analytics.totalRecords) * 100).toFixed(1))
                                : 0,
                              count: analytics.pendingRecords
                            }
                          ].filter(item => item.value > 0)} // Only show segments with data
                          cx="50%"
                          cy="50%"
                          innerRadius={70}
                          outerRadius={100}
                          paddingAngle={analytics.totalRecords > 0 ? 3 : 0}
                          dataKey="value"
                          startAngle={90}
                          endAngle={450}
                          animationBegin={0}
                          animationDuration={1200}
                          filter="url(#shadow)"
                        >
                          <Cell fill="url(#completedGradient)" stroke="#fff" strokeWidth={1} />
                          <Cell fill="url(#pendingGradient)" stroke="#fff" strokeWidth={1} />
                        </Pie>
                        <Tooltip 
                          contentStyle={{
                            backgroundColor: 'rgba(255, 255, 255, 0.95)',
                            border: 'none',
                            borderRadius: '12px',
                            boxShadow: '0 10px 25px rgba(0,0,0,0.1)',
                            fontSize: '14px',
                            fontWeight: '500'
                          }}
                          formatter={(value: number, name: string, props: any) => [
                            <span key="value" className="font-semibold">
                              {value} records ({props.payload.percentage}%)
                            </span>,
                            <span key="name" className="text-gray-600">{name}</span>
                          ]}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                    
                    {/* Center Label */}
                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                      <div className="text-center">
                        <div className="text-2xl font-bold text-gray-800">
                          {analytics.totalRecords}
                        </div>
                        <div className="text-xs text-gray-500 font-medium">
                          Total Records
                        </div>
                      </div>
                    </div>
                  </>
                )}
              </div>
              
              {!loading && analytics.totalRecords > 0 && (
                <div className="mt-6 space-y-3">
                  <div className="flex items-center justify-between p-3 bg-white/70 rounded-lg backdrop-blur-sm">
                    <div className="flex items-center gap-3">
                      <div className="w-4 h-4 bg-gradient-to-r from-green-500 to-green-600 rounded-full shadow-sm"></div>
                      <span className="text-sm font-medium text-gray-700">Completed</span>
                    </div>
                    <div className="text-right">
                      <div className="text-lg font-bold text-green-600">
                        {analytics.completedRecords}
                      </div>
                      <div className="text-xs text-gray-500">
                        {analytics.totalRecords > 0 
                          ? ((analytics.completedRecords / analytics.totalRecords) * 100).toFixed(1)
                          : 0}%
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex items-center justify-between p-3 bg-white/70 rounded-lg backdrop-blur-sm">
                    <div className="flex items-center gap-3">
                      <div className="w-4 h-4 bg-gradient-to-r from-amber-500 to-amber-600 rounded-full shadow-sm"></div>
                      <span className="text-sm font-medium text-gray-700">Pending</span>
                    </div>
                    <div className="text-right">
                      <div className="text-lg font-bold text-amber-600">
                        {analytics.pendingRecords}
                      </div>
                      <div className="text-xs text-gray-500">
                        {analytics.totalRecords > 0 
                          ? ((analytics.pendingRecords / analytics.totalRecords) * 100).toFixed(1)
                          : 0}%
                      </div>
                    </div>
                  </div>
                </div>
              )}
              
              {!loading && analytics.totalRecords === 0 && (
                <div className="text-center py-8">
                  <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-3">
                    <BarChart3 className="w-8 h-8 text-gray-400" />
                  </div>
                  <p className="text-gray-500 font-medium">No data available</p>
                  <p className="text-xs text-gray-400 mt-1">Add some records to see analytics</p>
                </div>
              )}
            </div>
          </Card>
        </div>

        {/* Right Column - Daily Statistics */}
        <div className="lg:col-span-2 space-y-6">
          {/* Daily Statistics */}
          <Card className="p-6 bg-white shadow-lg">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
                <BarChart3 className="w-5 h-5 text-purple-600" />
              </div>
              <div>
                <h2 className="text-xl font-semibold text-gray-900">Weekly Activity</h2>
                <p className="text-sm text-gray-500">Last 7 days performance</p>
              </div>
            </div>
            <div className="space-y-4">
              {loading ? (
                <div className="flex justify-center py-8">
                  <div className="w-8 h-8 border-2 border-purple-600 border-t-transparent rounded-full animate-spin" />
                </div>
              ) : (
                analytics.dailyStats.map((stat) => (
                  <div key={stat.date} className="group">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium text-gray-700">
                        {new Date(stat.date).toLocaleDateString('en-US', { 
                          weekday: 'short', 
                          month: 'short', 
                          day: 'numeric' 
                        })}
                      </span>
                      <span className="text-sm font-bold text-gray-900">{stat.count}</span>
                    </div>
                    <div className="h-3 bg-gray-100 rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-gradient-to-r from-purple-500 to-blue-500 rounded-full transition-all duration-500 group-hover:from-purple-600 group-hover:to-blue-600"
                        style={{ 
                          width: `${Math.max(5, (stat.count / Math.max(...analytics.dailyStats.map(s => s.count), 1)) * 100)}%` 
                        }}
                      />
                    </div>
                  </div>
                ))
              )}
            </div>
          </Card>
        </div>
      </div>

      {/* Action Cards Section */}
      {/* <div className="mt-12">
        <div className="text-center mb-8">
          <h2 className="text-2xl font-semibold text-gray-900 mb-2">Quick Actions</h2>
          <p className="text-gray-600">Manage your facial recognition system</p>
        </div>
        
        <div className="grid md:grid-cols-2 gap-8 max-w-4xl mx-auto">
          <Link href="/add-image" className="block group">
            <Card className="p-8 hover:shadow-xl transition-all duration-300 cursor-pointer h-full border-2 border-transparent group-hover:border-blue-200 group-hover:bg-blue-50/50">
              <div className="space-y-6">
                <div className="w-16 h-16 bg-blue-100 rounded-2xl flex items-center justify-center group-hover:bg-blue-200 transition-colors duration-300">
                  <UserPlus className="w-8 h-8 text-blue-600" />
                </div>
                <div>
                  <h3 className="text-2xl font-semibold text-gray-900 mb-3 group-hover:text-blue-900 transition-colors">Add New Person</h3>
                  <p className="text-gray-600 leading-relaxed">
                    Upload images and information for new face recognition entries. Start building your database with high-quality reference photos.
                  </p>
                </div>
                <Button className="w-full bg-blue-600 hover:bg-blue-700 text-white py-3 text-lg font-medium">
                  Add Images
                </Button>
              </div>
            </Card>
          </Link>

          <Link href="/get-people" className="block group">
            <Card className="p-8 hover:shadow-xl transition-all duration-300 cursor-pointer h-full border-2 border-transparent group-hover:border-green-200 group-hover:bg-green-50/50">
              <div className="space-y-6">
                <div className="w-16 h-16 bg-green-100 rounded-2xl flex items-center justify-center group-hover:bg-green-200 transition-colors duration-300">
                  <Users className="w-8 h-8 text-green-600" />
                </div>
                <div>
                  <h3 className="text-2xl font-semibold text-gray-900 mb-3 group-hover:text-green-900 transition-colors">View Records</h3>
                  <p className="text-gray-600 leading-relaxed">
                    Browse, search, and manage existing face recognition records. Edit information, update status, and organize your data.
                  </p>
                </div>
                <Button className="w-full bg-green-600 hover:bg-green-700 text-white py-3 text-lg font-medium">
                  View Records
                </Button>
              </div>
            </Card>
          </Link>
        </div>
      </div> */}

      {/* Footer */}
      <Footer />  
    </div>
  )
}

