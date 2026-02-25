'use client'

import Link from 'next/link'
import { Button } from '@/components/ui/button'

export default function SignupSuccessPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="w-full max-w-md">
        <div className="bg-card border border-border rounded-lg p-8 text-center">
          <div className="mb-6 text-5xl">✓</div>
          <h1 className="text-3xl font-bold text-foreground mb-2">Account Created</h1>
          <p className="text-muted-foreground mb-4">
            Please check your email to verify your account before logging in.
          </p>
          <p className="text-muted-foreground text-sm mb-6">
            If you don't see the email, check your spam folder.
          </p>
          
          <Link href="/auth/login">
            <Button className="w-full">Back to Login</Button>
          </Link>
        </div>
      </div>
    </div>
  )
}
