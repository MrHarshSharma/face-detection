import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import Link from "next/link"
import { UserPlus, Users } from "lucide-react"

export default function Home() {
  return (
    <div className="min-h-[80vh] flex items-center justify-center">
      <div className="max-w-4xl w-full space-y-8">
        <div className="text-center space-y-4">
          <h1 className="text-4xl font-bold tracking-tight">Face Recognition System</h1>
          <p className="text-xl text-gray-600">
            Manage and organize face recognition data efficiently
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-6 mt-12">
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
    </div>
  )
}

