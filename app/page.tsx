"use client"

import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import Link from "next/link"
import { UserPlus, Users, CheckCircle, XCircle, BarChart3, Calendar, TrendingUp } from "lucide-react"
import { useEffect, useState } from "react"
import { supabase } from "@/lib/supabase"
import { toast, ToastContainer } from "react-toastify"
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip, BarChart, Bar, XAxis, YAxis, CartesianGrid } from 'recharts'
import Footer from "@/components/Footer"

interface DailyStats {
  date: string;
  count: number;
}

interface PeriodStats {
  date: string;
  count: number;
  completed: number;
  formattedDate: string;
}

interface Analytics {
  totalRecords: number;
  completedRecords: number;
  pendingRecords: number;
  dailyStats: DailyStats[];
  periodStats: PeriodStats[];
}

export default function Home() {
  const [analytics, setAnalytics] = useState<Analytics>({
    totalRecords: 0,
    completedRecords: 0,
    pendingRecords: 0,
    dailyStats: [],
    periodStats: []
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

      // Get period statistics from 21/11/2024 to 4/01/2025 using the date column
      const startDate = '2024-11-21'
      const endDate = '2025-01-04'
      
      // Generate all dates in the range
      const periodDates: PeriodStats[] = []
      const start = new Date(startDate)
      const end = new Date(endDate)
      
      const currentDate = new Date(start)
      while (currentDate <= end) {
        const year = currentDate.getFullYear()
        const month = String(currentDate.getMonth() + 1).padStart(2, '0')
        const day = String(currentDate.getDate()).padStart(2, '0')
        const dateString = `${year}-${month}-${day}`
        
        periodDates.push({
          date: dateString,
          count: 0,
          completed: 0,
          formattedDate: currentDate.toLocaleDateString('en-US', { 
            month: 'short', 
            day: 'numeric' 
          })
        })
        
        currentDate.setDate(currentDate.getDate() + 1)
      }

      // Get actual counts for each date in the period
      let allPeriodData: any[] = []
      let from = 0
      const batchSize = 1000
      let hasMore = true

      // Fetch all records for the period in batches
      while (hasMore) {
        const { data: batchData, error: batchError } = await supabase
          .from('ref_images')
          .select('date, completed')
          .gte('date', startDate)
          .lte('date', endDate)
          .range(from, from + batchSize - 1)

        if (batchError) {
          console.error('Error fetching period batch:', batchError)
          break
        }

        if (batchData && batchData.length > 0) {
          allPeriodData = [...allPeriodData, ...batchData]
          from += batchSize
          hasMore = batchData.length === batchSize
        } else {
          hasMore = false
        }
      }

      console.log(`Fetched ${allPeriodData.length} records for period analysis`)

      if (allPeriodData.length > 0) {
        // Count occurrences of each date for total records
        const dateCounts: { [key: string]: number } = {}
        const completedDateCounts: { [key: string]: number } = {}
        
        allPeriodData.forEach(record => {
          if (record.date) {
            // Count total records
            dateCounts[record.date] = (dateCounts[record.date] || 0) + 1
            
            // Count completed records (completed = true or completed = "TRUE")
            if (record.completed === true || record.completed === "TRUE") {
              completedDateCounts[record.date] = (completedDateCounts[record.date] || 0) + 1
            }
          }
        })

        // Update periodDates with actual counts
        periodDates.forEach(dateEntry => {
          dateEntry.count = dateCounts[dateEntry.date] || 0
          dateEntry.completed = completedDateCounts[dateEntry.date] || 0
        })

        console.log('Sample data with completed counts:', periodDates.slice(0, 5))
      }

      console.log('Daily statistics:', sortedDays)
      console.log('Period statistics:', periodDates)

      setAnalytics({
        totalRecords: totalCount || 0,
        completedRecords: completedCount || 0,
        pendingRecords: pendingCount || 0,
        dailyStats: sortedDays,
        periodStats: periodDates
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
    <div className="min-h-[80vh]">
      <ToastContainer />
      
      <div className="max-w-7xl mx-auto px-4 py-8 space-y-8">
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

 {/* Period Chart - Full Width */}
      <Card className="p-6 bg-gradient-to-br from-indigo-50 to-purple-50 border-0 shadow-lg">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 bg-gradient-to-r from-indigo-500 to-purple-600 rounded-lg flex items-center justify-center">
            <TrendingUp className="w-5 h-5 text-white" />
          </div>
          <div>
            <h2 className="text-xl font-semibold text-gray-900">Records Timeline</h2>
            <p className="text-sm text-gray-500">21 Nov 2024 to 4 Jan 2025 • Total: {analytics.periodStats.reduce((sum, day) => sum + day.count, 0)} records • Completed: {analytics.periodStats.reduce((sum, day) => sum + day.completed, 0)} records</p>
            
            {/* Chart Legend */}
            <div className="flex items-center gap-6 mt-3">
              <div className="flex items-center gap-2">
                <div className="w-4 h-3 bg-gradient-to-b from-indigo-500 to-purple-600 rounded-sm"></div>
                <span className="text-xs font-medium text-gray-600">Total Records</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-4 h-3 bg-gradient-to-b from-green-500 to-green-600 rounded-sm"></div>
                <span className="text-xs font-medium text-gray-600">Completed Records</span>
              </div>
            </div>
          </div>
        </div>
        
        <div className="h-96 overflow-x-auto">
          {loading ? (
            <div className="flex items-center justify-center h-full">
              <div className="text-center">
                <div className="w-12 h-12 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin mx-auto mb-3" />
                <p className="text-sm text-gray-500 font-medium">Loading timeline data...</p>
              </div>
            </div>
          ) : (
            <div style={{ width: `${analytics.periodStats.length * 35}px`, minWidth: '100%' }}>
              <ResponsiveContainer width="100%" height={350}>
                <BarChart 
                  data={analytics.periodStats} 
                  margin={{ top: 20, right: 30, left: 20, bottom: 80 }}
                  barCategoryGap="20%"
                >
                  <defs>
                    <linearGradient id="totalBarGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#6366f1" />
                      <stop offset="100%" stopColor="#8b5cf6" />
                    </linearGradient>
                    <linearGradient id="completedBarGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#22c55e" />
                      <stop offset="100%" stopColor="#16a34a" />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis 
                    dataKey="formattedDate" 
                    tick={{ fontSize: 10 }}
                    angle={-90}
                    textAnchor="end"
                    height={100}
                    interval={0} // Show every date
                  />
                  <YAxis tick={{ fontSize: 12 }} />
                  <Tooltip 
                    contentStyle={{
                      backgroundColor: 'rgba(255, 255, 255, 0.95)',
                      border: 'none',
                      borderRadius: '12px',
                      boxShadow: '0 10px 25px rgba(0,0,0,0.1)',
                      fontSize: '14px',
                      fontWeight: '500'
                    }}
                    content={({ active, payload, label }) => {
                      if (active && payload && payload.length > 0) {
                        const data = payload[0].payload
                        return (
                          <div className="bg-white/95 border-none rounded-xl p-4 shadow-2xl">
                            <div className="text-sm font-medium text-gray-600 mb-2">
                              {new Date(data.date).toLocaleDateString('en-US', { 
                                weekday: 'short',
                                month: 'short', 
                                day: 'numeric',
                                year: 'numeric'
                              })}
                            </div>
                            <div className="space-y-1">
                              <div className="flex items-center gap-2">
                                <div className="w-3 h-3 bg-gradient-to-b from-indigo-500 to-purple-600 rounded-sm"></div>
                                <span style={{ color: '#6366f1' }} className="font-semibold">
                                  {data.count} Total Records
                                </span>
                              </div>
                              <div className="flex items-center gap-2">
                                <div className="w-3 h-3 bg-gradient-to-b from-green-500 to-green-600 rounded-sm"></div>
                                <span style={{ color: '#22c55e' }} className="font-semibold">
                                  {data.completed} Completed Records
                                </span>
                              </div>
                            </div>
                          </div>
                        )
                      }
                      return null
                    }}
                  />
                  <Legend 
                    wrapperStyle={{ paddingTop: '20px' }}
                    iconType="rect"
                    formatter={(value: string) => (
                      <span className="text-sm font-medium text-gray-700">{value}</span>
                    )}
                  />
                  <Bar 
                    dataKey="count" 
                    fill="url(#totalBarGradient)"
                    radius={[2, 2, 0, 0]}
                    stroke="#4f46e5"
                    strokeWidth={0.5}
                    name="Total Records"
                    maxBarSize={20}
                  />
                  <Bar 
                    dataKey="completed" 
                    fill="url(#completedBarGradient)"
                    radius={[2, 2, 0, 0]}
                    stroke="#15803d"
                    strokeWidth={1}
                    name="Completed Records"
                    maxBarSize={20}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      </Card>

      {/* Footer */}
      <Footer />  
      </div>
    </div>
  )
}

