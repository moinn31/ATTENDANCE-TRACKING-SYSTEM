'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

export default function SignupPage() {
  const [fullName, setFullName] = useState('')
  const [adminId, setAdminId] = useState('')
  const [department, setDepartment] = useState('')
  const [photoUrl, setPhotoUrl] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [role, setRole] = useState('admin')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [mounted, setMounted] = useState(false)
  const router = useRouter()
  const [supabase] = useState(() => createClient())

  useEffect(() => {
    setMounted(true)
  }, [])

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    if (!fullName.trim() || !adminId.trim()) {
      setError('Name and Admin ID are required')
      return
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match')
      return
    }

    setLoading(true)

    try {
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: `${window.location.origin}/auth/callback`,
          data: {
            role,
            full_name: fullName.trim(),
            admin_id: adminId.trim(),
            department: department.trim() || null,
            photo_url: photoUrl.trim() || null,
          },
        },
      })

      if (error) {
        setError(error.message)
        return
      }

      router.push('/auth/signup-success')
    } catch (err) {
      setError('An unexpected error occurred')
    } finally {
      setLoading(false)
    }
  }

  if (!mounted) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="w-full max-w-md">
          <div className="bg-card border border-border rounded-lg p-8">
            <div className="h-96 animate-pulse bg-muted rounded"></div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="w-full max-w-md">
        <div className="bg-card border border-border rounded-lg p-8">
          <h1 className="text-3xl font-bold text-foreground mb-2">Create Account</h1>
          <p className="text-muted-foreground mb-6">Register Admin account for Smart Attendance</p>

          <form onSubmit={handleSignup} className="space-y-4">
            <div>
              <label htmlFor="fullName" className="block text-sm font-medium text-foreground mb-2">
                Full Name
              </label>
              <Input
                id="fullName"
                type="text"
                placeholder="Admin full name"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                required
                disabled={loading}
              />
            </div>

            <div>
              <label htmlFor="adminId" className="block text-sm font-medium text-foreground mb-2">
                Admin ID
              </label>
              <Input
                id="adminId"
                type="text"
                placeholder="ADM-001"
                value={adminId}
                onChange={(e) => setAdminId(e.target.value)}
                required
                disabled={loading}
              />
            </div>

            <div>
              <label htmlFor="department" className="block text-sm font-medium text-foreground mb-2">
                Department (optional)
              </label>
              <Input
                id="department"
                type="text"
                placeholder="Faculty / Administration"
                value={department}
                onChange={(e) => setDepartment(e.target.value)}
                disabled={loading}
              />
            </div>

            <div>
              <label htmlFor="photoUrl" className="block text-sm font-medium text-foreground mb-2">
                Photo URL (optional)
              </label>
              <Input
                id="photoUrl"
                type="url"
                placeholder="https://example.com/admin-photo.jpg"
                value={photoUrl}
                onChange={(e) => setPhotoUrl(e.target.value)}
                disabled={loading}
              />
            </div>

            <div>
              <label htmlFor="email" className="block text-sm font-medium text-foreground mb-2">
                Email
              </label>
              <Input
                id="email"
                type="email"
                placeholder="your@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                disabled={loading}
              />
            </div>

            <div>
              <label htmlFor="role" className="block text-sm font-medium text-foreground mb-2">
                Role
              </label>
              <select
                id="role"
                value={role}
                onChange={(e) => setRole(e.target.value)}
                disabled={loading}
                className="w-full px-3 py-2 bg-background border border-input rounded-md text-foreground"
              >
                <option value="admin">Admin</option>
              </select>
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-foreground mb-2">
                Password
              </label>
              <Input
                id="password"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                disabled={loading}
              />
            </div>

            <div>
              <label htmlFor="confirmPassword" className="block text-sm font-medium text-foreground mb-2">
                Confirm Password
              </label>
              <Input
                id="confirmPassword"
                type="password"
                placeholder="••••••••"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                disabled={loading}
              />
            </div>

            {error && (
              <div className="p-3 bg-destructive/10 border border-destructive/20 rounded text-destructive text-sm">
                {error}
              </div>
            )}

            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? 'Creating account...' : 'Sign Up'}
            </Button>
          </form>

          <div className="mt-6 text-center">
            <p className="text-muted-foreground text-sm">
              Already have an account?{' '}
              <Link href="/auth/login" className="text-primary font-medium hover:underline">
                Sign in
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
