# Supabase Connection Issues - Troubleshooting Guide

## Current Issue
Your application is experiencing `ENOTFOUND kdoxukaelfftuobiinwz.supabase.co` errors because the Supabase instance cannot be reached.

## Root Causes
1. **Supabase Project Paused**: Free-tier Supabase projects are automatically paused after 1 week of inactivity
2. **Supabase Project Deleted**: The project may have been deleted
3. **Network Issues**: DNS resolution or firewall blocking access
4. **Invalid Credentials**: The URL/key in .env.local may be incorrect

## Solutions

### Option 1: Resume/Check Your Supabase Project (Recommended)
1. Visit [Supabase Dashboard](https://supabase.com/dashboard)
2. Check if project `kdoxukaelfftuobiinwz` exists
3. If paused, click "Resume Project" 
4. Wait 2-3 minutes for the project to become active
5. Refresh your application

### Option 2: Create a New Supabase Project
1. Go to [Supabase Dashboard](https://supabase.com/dashboard)
2. Click "New Project"
3. Fill in project details:
   - Name: `attendance-tracker`
   - Database Password: (choose a strong password)
   - Region: (select closest to you)
4. Wait for project creation (~2 minutes)
5. Go to Project Settings → API
6. Copy the new credentials:
   - **Project URL**: `https://xxxxx.supabase.co`
   - **anon/public key**: `eyJhbG...`
7. Update `.env.local` with new credentials:
   ```env
   NEXT_PUBLIC_SUPABASE_URL=https://your-new-project.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your-new-anon-key
   ```
8. Restart the dev server (Ctrl+C, then `npm run dev`)

### Option 3: Run Without Supabase (Mock Mode)
The app has been configured to work without Supabase for testing:
1. The errors are now suppressed in the browser console
2. Authentication will redirect to login page
3. You can use mock data for development

## What We Fixed
✅ Added error handling to prevent console spam  
✅ Disabled auto-token refresh to prevent repeated failed requests  
✅ Server-side proxy now handles auth errors gracefully  
✅ Client pages catch auth failures and redirect properly  
✅ Created storage clearing utility at `/clear-storage.html`

## Clear Browser Storage
If you still see errors after fixing Supabase:
1. Visit: http://localhost:3000/clear-storage.html
2. Click "Clear All Storage"
3. Return to the app and try logging in again

## Next Steps
Choose one of the options above and:
1. Either fix your existing Supabase project
2. Or create a new one
3. Or continue development with mock data

The application will work properly once Supabase is accessible!
