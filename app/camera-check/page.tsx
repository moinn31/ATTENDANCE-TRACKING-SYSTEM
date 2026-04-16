'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { CheckCircle, AlertCircle, Camera, Shield } from 'lucide-react'
import { DashboardShell } from '@/components/dashboard-shell'

export default function CameraCheckPage() {
  const [cameraSupported, setCameraSupported] = useState<boolean | null>(null)
  const [cameraPermission, setCameraPermission] = useState<'granted' | 'denied' | 'prompt' | 'unknown'>('unknown')
  const [deviceInfo, setDeviceInfo] = useState<string>('')
  const [isMobile, setIsMobile] = useState(false)
  const [testStream, setTestStream] = useState<MediaStream | null>(null)
  const [isTestingCamera, setIsTestingCamera] = useState(false)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
    
    // Check if mobile
    const mobile = /android|iphone|ipad|ipod|mobile|webos|blackberry|windows phone/i.test(
      navigator.userAgent
    )
    setIsMobile(mobile)

    // Get device info
    const info = `${navigator.userAgent}\nScreen: ${window.innerWidth}x${window.innerHeight}`
    setDeviceInfo(info)

    // Check camera support
    const supported = !!(
      navigator.mediaDevices && navigator.mediaDevices.getUserMedia
    )
    setCameraSupported(supported)

    // Check permission status if available
    if (navigator.permissions && navigator.permissions.query) {
      navigator.permissions
        .query({ name: 'camera' as any })
        .then((result: any) => {
          setCameraPermission(result.state || 'unknown')
        })
        .catch(() => {
          setCameraPermission('unknown')
        })
    }
  }, [])

  const testCamera = async () => {
    setIsTestingCamera(true)
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' },
        audio: false,
      })

      setTestStream(stream)
      setCameraPermission('granted')

      // Auto-stop after 3 seconds
      setTimeout(() => {
        stream.getTracks().forEach((track) => track.stop())
        setTestStream(null)
      }, 3000)
    } catch (error) {
      console.error('Camera test failed:', error)
      if ((error as any)?.name === 'NotAllowedError') {
        setCameraPermission('denied')
      }
    } finally {
      setIsTestingCamera(false)
    }
  }

  const stopTestCamera = () => {
    if (testStream) {
      testStream.getTracks().forEach((track) => track.stop())
      setTestStream(null)
    }
  }

  return (
    <DashboardShell>
      <div className="container mx-auto px-4 py-8 max-w-2xl">
        <div className="flex items-center gap-3 mb-6">
          <Camera className="w-8 h-8" />
          <h1 className="text-3xl font-bold">Camera Permission Checker</h1>
        </div>

        {/* Device Info */}
        <Alert className="mb-6">
          <Shield className="h-4 w-4" />
          <AlertDescription>
            <strong>Device Type:</strong> {isMobile ? '📱 Mobile' : '💻 Desktop'} <br />
            {mounted ? (
              <>
                <strong>User Agent:</strong> <code className="text-xs break-all">{navigator.userAgent}</code>
              </>
            ) : (
              <em className="text-gray-500">Loading device info...</em>
            )}
          </AlertDescription>
        </Alert>

        {/* Camera Support */}
        <div className="mb-6 p-4 border rounded-lg">
          <div className="flex items-center gap-2 mb-2">
            {cameraSupported ? (
              <CheckCircle className="w-5 h-5 text-green-500" />
            ) : (
              <AlertCircle className="w-5 h-5 text-red-500" />
            )}
            <h2 className="font-semibold">Camera Support</h2>
          </div>
          <p className="text-sm text-gray-600">
            {cameraSupported
              ? '✅ Your browser supports camera access'
              : '❌ Camera API not available in this browser'}
          </p>
        </div>

        {/* Camera Permission Status */}
        <div className="mb-6 p-4 border rounded-lg">
          <div className="flex items-center gap-2 mb-2">
            {cameraPermission === 'granted' ? (
              <CheckCircle className="w-5 h-5 text-green-500" />
            ) : cameraPermission === 'denied' ? (
              <AlertCircle className="w-5 h-5 text-red-500" />
            ) : (
              <AlertCircle className="w-5 h-5 text-yellow-500" />
            )}
            <h2 className="font-semibold">Permission Status</h2>
          </div>
          <p className="text-sm text-gray-600 mb-3">
            {cameraPermission === 'granted'
              ? '✅ Camera permission granted'
              : cameraPermission === 'denied'
                ? '❌ Camera permission denied. Check phone settings.'
                : '⚠️ Permission status unknown. Test camera below.'}
          </p>

          {cameraPermission === 'denied' && (
            <Alert className="bg-red-50 border-red-200 text-red-900 text-sm">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                <strong>To grant permission on mobile:</strong>
                <ul className="ml-4 mt-2">
                  <li>• <strong>iOS:</strong> Settings → [App Name] → Camera → Allow</li>
                  <li>• <strong>Android:</strong> Settings → Apps → [App Name] → Permissions → Camera → Allow</li>
                </ul>
              </AlertDescription>
            </Alert>
          )}
        </div>

        {/* Test Camera Button */}
        <div className="mb-6">
          {cameraSupported && (
            <>
              <Button
                onClick={testStream ? stopTestCamera : testCamera}
                disabled={isTestingCamera}
                className="w-full mb-3"
                variant={testStream ? 'destructive' : 'default'}
              >
                {isTestingCamera
                  ? '⏳ Testing Camera...'
                  : testStream
                    ? '🛑 Stop Camera Test'
                    : '🎥 Test Camera Access'}
              </Button>

              {testStream && (
                <div className="relative bg-black rounded-lg overflow-hidden mb-3">
                  <video
                    autoPlay
                    playsInline
                    muted
                    style={{
                      width: '100%',
                      height: 'auto',
                      transform: 'scaleX(-1)',
                    }}
                  />
                  <div className="absolute inset-0 flex items-center justify-center bg-black/20">
                    <div className="text-white text-center">
                      <div className="text-lg font-semibold">🎥 Camera Active</div>
                      <div className="text-sm">Will auto-stop in 3 seconds</div>
                    </div>
                  </div>
                </div>
              )}

              {testStream === null && cameraPermission === 'granted' && (
                <Alert className="bg-green-50 border-green-200 text-green-900 text-sm">
                  <CheckCircle className="h-4 w-4" />
                  <AlertDescription>
                    ✅ Camera test successful! You're ready to use the Scanner.
                  </AlertDescription>
                </Alert>
              )}
            </>
          )}
        </div>

        {/* Troubleshooting */}
        <div className="mb-6 p-4 border rounded-lg bg-blue-50">
          <h3 className="font-semibold mb-3">🔧 Troubleshooting</h3>
          <ul className="text-sm space-y-2 text-gray-700">
            <li>
              <strong>Not Working?</strong>
              <ul className="ml-4 mt-1">
                <li>• Check phone WiFi is connected</li>
                <li>• Refresh the page (Ctrl+R or ⌘+R)</li>
                <li>• Check app camera permissions in phone settings</li>
                <li>• Try a different browser (Chrome for Android, Safari for iOS)</li>
                <li>• Restart your phone</li>
              </ul>
            </li>
            <li>
              <strong>Still Not Working?</strong> Open browser console (F12) and check for error messages
            </li>
          </ul>
        </div>

        {/* Recommended Browsers */}
        <div className="mb-6 p-4 border rounded-lg bg-yellow-50">
          <h3 className="font-semibold mb-2">🌐 Recommended Browsers</h3>
          <div className="text-sm text-gray-700 space-y-1">
            <div><strong>Android:</strong> Google Chrome (Recommended), Firefox</div>
            <div><strong>iOS:</strong> Safari (Recommended), Chrome</div>
            <div><strong>Desktop:</strong> Chrome, Firefox, Safari, Edge</div>
          </div>
        </div>

        {/* Navigation */}
        <div className="flex gap-3">
          <Link href="/scanner" className="flex-1">
            <Button className="w-full">📱 Go to Scanner</Button>
          </Link>
          <Link href="/" className="flex-1">
            <Button variant="outline" className="w-full">
              ← Back to Home
            </Button>
          </Link>
        </div>
      </div>
    </DashboardShell>
  )
}
