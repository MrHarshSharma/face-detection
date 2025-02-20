import VideoUploader from "@/components/VideoUploader"

export default function Home() {
  return (
    <main className="min-h-screen bg-gradient-to-b from-gray-100 to-gray-200 p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-4xl font-bold text-center mb-8 text-gray-800">Facial Recognition App</h1>
        <VideoUploader />
      </div>
    </main>
  )
}

