// Face API Model Caching Utility
interface ModelCache {
  name: string
  data: ArrayBuffer
  timestamp: number
  version: string
}

const DB_NAME = 'FaceApiModelsCache'
const DB_VERSION = 1
const STORE_NAME = 'models'
const CACHE_DURATION = 7 * 24 * 60 * 60 * 1000 // 7 days
const MODEL_VERSION = '0.22.2' // Face-api.js version

class FaceApiCache {
  private db: IDBDatabase | null = null

  async initDB(): Promise<void> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION)
      
      request.onerror = () => reject(request.error)
      request.onsuccess = () => {
        this.db = request.result
        resolve()
      }
      
      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME, { keyPath: 'name' })
        }
      }
    })
  }

  async getCachedModel(modelName: string): Promise<ArrayBuffer | null> {
    if (!this.db) await this.initDB()
    
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([STORE_NAME], 'readonly')
      const store = transaction.objectStore(STORE_NAME)
      const request = store.get(modelName)
      
      request.onerror = () => reject(request.error)
      request.onsuccess = () => {
        const result = request.result as ModelCache
        
        if (!result) {
          resolve(null)
          return
        }
        
        // Check if cache is expired or version mismatch
        const isExpired = Date.now() - result.timestamp > CACHE_DURATION
        const isVersionMismatch = result.version !== MODEL_VERSION
        
        if (isExpired || isVersionMismatch) {
          // Remove expired cache
          this.removeCachedModel(modelName)
          resolve(null)
          return
        }
        
        resolve(result.data)
      }
    })
  }

  async cacheModel(modelName: string, data: ArrayBuffer): Promise<void> {
    if (!this.db) await this.initDB()
    
    const modelCache: ModelCache = {
      name: modelName,
      data,
      timestamp: Date.now(),
      version: MODEL_VERSION
    }
    
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([STORE_NAME], 'readwrite')
      const store = transaction.objectStore(STORE_NAME)
      const request = store.put(modelCache)
      
      request.onerror = () => reject(request.error)
      request.onsuccess = () => resolve()
    })
  }

  async removeCachedModel(modelName: string): Promise<void> {
    if (!this.db) await this.initDB()
    
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([STORE_NAME], 'readwrite')
      const store = transaction.objectStore(STORE_NAME)
      const request = store.delete(modelName)
      
      request.onerror = () => reject(request.error)
      request.onsuccess = () => resolve()
    })
  }

  async clearCache(): Promise<void> {
    if (!this.db) await this.initDB()
    
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([STORE_NAME], 'readwrite')
      const store = transaction.objectStore(STORE_NAME)
      const request = store.clear()
      
      request.onerror = () => reject(request.error)
      request.onsuccess = () => resolve()
    })
  }

  async getCacheInfo(): Promise<{ modelName: string, size: number, timestamp: number }[]> {
    if (!this.db) await this.initDB()
    
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([STORE_NAME], 'readonly')
      const store = transaction.objectStore(STORE_NAME)
      const request = store.getAll()
      
      request.onerror = () => reject(request.error)
      request.onsuccess = () => {
        const results = request.result as ModelCache[]
        const info = results.map(result => ({
          modelName: result.name,
          size: result.data.byteLength,
          timestamp: result.timestamp
        }))
        resolve(info)
      }
    })
  }
}

// Model loading utility with caching
export class FaceApiModelLoader {
  private cache = new FaceApiCache()
  private modelUrls = {
    ssdMobilenetv1: '/models/ssd_mobilenetv1_model-weights_manifest.json',
    faceLandmark68Net: '/models/face_landmark_68_model-weights_manifest.json',
    faceRecognitionNet: '/models/face_recognition_model-weights_manifest.json'
  }

  async loadModelsWithCache(): Promise<void> {
    // Load face-api.js script first
    await this.loadFaceApiScript()
    
    // @ts-ignore
    const faceapi = window.faceapi
    
    if (!faceapi) {
      throw new Error('Face-api.js not loaded')
    }

    // Load models with caching
    await Promise.all([
      this.loadModelWithCache('ssdMobilenetv1', () => faceapi.nets.ssdMobilenetv1.loadFromUri('/models')),
      this.loadModelWithCache('faceLandmark68Net', () => faceapi.nets.faceLandmark68Net.loadFromUri('/models')),
      this.loadModelWithCache('faceRecognitionNet', () => faceapi.nets.faceRecognitionNet.loadFromUri('/models'))
    ])
  }

  private async loadFaceApiScript(): Promise<void> {
    // Check if already loaded
    // @ts-ignore
    if (window.faceapi) return

    return new Promise((resolve, reject) => {
      const script = document.createElement('script')
      script.src = 'https://cdn.jsdelivr.net/npm/face-api.js@0.22.2/dist/face-api.min.js'
      script.onload = () => resolve()
      script.onerror = () => reject(new Error('Failed to load face-api.js'))
      document.head.appendChild(script)
    })
  }

  private async loadModelWithCache(
    modelName: keyof typeof this.modelUrls,
    loadFunction: () => Promise<void>
  ): Promise<void> {
    try {
      // Check if model is cached
      const cachedModel = await this.cache.getCachedModel(modelName)
      
      if (cachedModel) {
        // Load from cache - face-api.js handles cached models automatically
        await loadFunction()
        return
      }

      
      // Download and cache the model
      await loadFunction()
      
      // Cache the model files for future use
      await this.cacheModelFiles(modelName)
      
      
    } catch (error) {
      console.error(`❌ Error loading ${modelName} model:`, error)
      throw error
    }
  }

  private async cacheModelFiles(modelName: keyof typeof this.modelUrls): Promise<void> {
    try {
      // Fetch the model manifest to get all related files
      const manifestUrl = this.modelUrls[modelName]
      const manifestResponse = await fetch(manifestUrl)
      const manifest = await manifestResponse.json()
      
      // Cache manifest
      await this.cache.cacheModel(`${modelName}_manifest`, await manifestResponse.arrayBuffer())
      
      // Cache weight files
      if (manifest.weightsManifest) {
        for (const weightManifest of manifest.weightsManifest) {
          for (const path of weightManifest.paths) {
            const weightUrl = `/models/${path}`
            const weightResponse = await fetch(weightUrl)
            const weightData = await weightResponse.arrayBuffer()
            await this.cache.cacheModel(`${modelName}_${path}`, weightData)
          }
        }
      }
      
    } catch (error) {
      console.warn(`Warning: Could not cache ${modelName} files:`, error)
    }
  }

  async getCacheInfo() {
    return await this.cache.getCacheInfo()
  }

  async clearCache() {
    await this.cache.clearCache()
  }
}

// Export singleton instance
export const faceApiModelLoader = new FaceApiModelLoader() 