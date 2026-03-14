'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'
import { Button } from '@/components/ui/button'

export default function Home() {
  const [user, setUser] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    const getUser = async () => {
      try {
        const {
          data: { user },
          error,
        } = await supabase.auth.getUser()
        
        if (error) {
          console.error('Auth error:', error.message)
          // Clear invalid session
          await supabase.auth.signOut()
          setUser(null)
          setLoading(false)
          router.push('/auth/login')
          return
        }
        
        setUser(user)
        setLoading(false)

        if (!user) {
          router.push('/auth/login')
        }
      } catch (error) {
        console.error('Failed to get user:', error)
        // Clear any corrupted session data
        await supabase.auth.signOut()
        setUser(null)
        setLoading(false)
        router.push('/auth/login')
      }
    }

    getUser()
  }, [router, supabase.auth])

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push('/auth/login')
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p>Loading...</p>
      </div>
    )
  }

  if (!user) {
    return null
  }

  return (
    <main className="min-h-screen bg-background">
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="flex justify-between items-center mb-12">
          <div>
            <h1 className="text-4xl font-bold text-foreground mb-2">Smart Attendance System</h1>
            <p className="text-muted-foreground">Welcome back, {user.email}</p>
          </div>
          <Button onClick={handleLogout} variant="outline">
            Logout
          </Button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Attendance Scanner Card */}
          <Link href="/scanner" className="group">
            <div className="bg-card border border-border rounded-lg p-6 hover:shadow-lg transition-all group-hover:border-primary">
              <div className="mb-4 text-3xl">📸</div>
              <h2 className="text-xl font-semibold text-foreground mb-2">Attendance Scanner</h2>
              <p className="text-muted-foreground text-sm mb-4">
                Use face recognition to mark attendance
              </p>
              <span className="text-primary font-medium text-sm">Launch Scanner →</span>
            </div>
          </Link>

          {/* Students Management Card */}
          <Link href="/students" className="group">
            <div className="bg-card border border-border rounded-lg p-6 hover:shadow-lg transition-all group-hover:border-primary">
              <div className="mb-4 text-3xl">👥</div>
              <h2 className="text-xl font-semibold text-foreground mb-2">Students</h2>
              <p className="text-muted-foreground text-sm mb-4">
                Manage student list and face data
              </p>
              <span className="text-primary font-medium text-sm">Manage Students →</span>
            </div>
          </Link>

          {/* Analytics Card */}
          <Link href="/analytics" className="group">
            <div className="bg-card border border-border rounded-lg p-6 hover:shadow-lg transition-all group-hover:border-primary">
              <div className="mb-4 text-3xl">📊</div>
              <h2 className="text-xl font-semibold text-foreground mb-2">Analytics</h2>
              <p className="text-muted-foreground text-sm mb-4">
                View attendance trends and insights
              </p>
              <span className="text-primary font-medium text-sm">View Analytics →</span>
            </div>
          </Link>
        </div>

        <div className="mt-12 bg-card border border-border rounded-lg p-8">
          <h2 className="text-2xl font-semibold text-foreground mb-4">System Status</h2>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="p-4 bg-background rounded border border-border">
              <p className="text-muted-foreground text-sm mb-1">Database</p>
              <p className="text-lg font-semibold text-foreground">✓ Connected</p>
            </div>
            <div className="p-4 bg-background rounded border border-border">
              <p className="text-muted-foreground text-sm mb-1">Face Recognition</p>
              <p className="text-lg font-semibold text-foreground">✓ Ready</p>
            </div>
            <div className="p-4 bg-background rounded border border-border">
              <p className="text-muted-foreground text-sm mb-1">Authentication</p>
              <p className="text-lg font-semibold text-foreground">✓ Active</p>
            </div>
            <div className="p-4 bg-background rounded border border-border">
              <p className="text-muted-foreground text-sm mb-1">Analytics</p>
              <p className="text-lg font-semibold text-foreground">✓ Enabled</p>
            </div>
          </div>
        </div>
      </div>
    </main>
  )
}
