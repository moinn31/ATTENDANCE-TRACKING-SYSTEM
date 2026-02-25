# Smart Attendance System - Quick Start Guide

## 1. Initial Setup (First Time)

### Prerequisites
- Node.js 18+ installed
- Supabase account (free tier available)
- Modern web browser with webcam access

### Installation
```bash
# Clone or download the project
cd smart-attendance-system

# Install dependencies
npm install

# Set up environment variables
# Copy .env.example to .env.local (or create it)
# Add your Supabase credentials:
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
```

### Start Development Server
```bash
npm run dev
```
Navigate to `http://localhost:3000`

## 2. First Time Configuration

### A. Set Up Database (One-time)
1. Log in to your Supabase project dashboard
2. Go to SQL Editor
3. Copy and paste the contents of `scripts/01-init-schema.sql`
4. Click "Run" to execute the migration
5. Verify all tables are created

### B. Create Test User
1. Go to `http://localhost:3000/auth/signup`
2. Create account with:
   - Email: `teacher@example.com`
   - Password: `TestPassword123!`
   - Role: `Teacher`
3. Verify email (check spam folder)
4. Log in with your credentials

## 3. Using the Application

### Access the Dashboard
- URL: `http://localhost:3000`
- Login with your credentials
- You should see 3 main sections: Scanner, Students, Analytics

### Test Attendance Scanner
1. Click "Attendance Scanner" on homepage
2. Allow camera access when prompted
3. Click "Start Camera"
4. Models will load automatically (~2-3 seconds)
5. Face-api.js will detect faces in the video
6. Click "Mark Attendance" on detected students

### Manage Students
1. Click "Students" on homepage
2. Click "+ Add Student" to add new students
3. Fill in:
   - Full Name
   - Email
   - Enrollment Number
4. Click "Add Student"
5. Students appear in the table below
6. Mark enrollment status with "Enroll Face" button

### View Analytics
1. Click "Analytics" on homepage
2. See dashboard with:
   - Attendance rate metrics
   - Daily attendance trends (bar chart)
   - Face recognition confidence distribution (pie chart)
   - Individual student performance
   - System health metrics

## 4. Configuration Options

### Environment Variables
```env
# Required (from Supabase dashboard)
NEXT_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGc...

# Optional (defaults provided)
NEXT_PUBLIC_DEV_SUPABASE_REDIRECT_URL=http://localhost:3000/auth/callback
```

### Customize Application
- **Colors**: Edit `app/globals.css` design tokens
- **Logo/Title**: Edit `app/layout.tsx` metadata
- **Default Role**: Edit `app/auth/signup/page.tsx` default role

## 5. Troubleshooting

### Camera Not Working
- [ ] Check browser permissions (Settings > Privacy & Security > Camera)
- [ ] Ensure using HTTPS in production
- [ ] Try a different browser (Chrome/Firefox recommended)
- [ ] Check face-api.js models loaded successfully

### Can't Login
- [ ] Verify email is confirmed in Supabase
- [ ] Check password is correct
- [ ] Ensure NEXT_PUBLIC_SUPABASE_URL is set correctly
- [ ] Check browser console for errors

### Database Errors
- [ ] Run `scripts/01-init-schema.sql` again
- [ ] Verify all tables exist in Supabase SQL Editor
- [ ] Check RLS policies are enabled
- [ ] Verify user is authenticated

### Face Detection Not Working
- [ ] Models loading from CDN (check network tab)
- [ ] Face needs to be clearly visible in frame
- [ ] Good lighting required
- [ ] Try from different angle

## 6. Production Deployment

### Deploy to Vercel (Recommended)
```bash
# Push to GitHub
git add .
git commit -m "Initial commit"
git push origin main

# Deploy via Vercel dashboard
# 1. Go to vercel.com
# 2. Import your GitHub repo
# 3. Add environment variables
# 4. Deploy!
```

### Set Production Environment
1. Go to Supabase project settings
2. Update allowed redirect URLs:
   - Add your production domain
   - Add `https://yourdomain.com/auth/callback`

### Security Checklist
- [ ] Environment variables are private (not in git)
- [ ] Email verification is enabled
- [ ] HTTPS is enforced
- [ ] Database RLS policies are active
- [ ] User roles are properly validated
- [ ] Rate limiting is configured

## 7. Advanced: Hadoop Integration

For big data analysis, follow `HADOOP_GUIDE.md`:

```bash
# Export data for analysis
node scripts/data-export.ts

# Run Hadoop analytics
bash scripts/hadoop-setup.sh
python scripts/hadoop-analytics.py
```

## 8. API Reference

### Get Students
```bash
curl http://localhost:3000/api/students \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### Mark Attendance
```bash
curl -X POST http://localhost:3000/api/attendance \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "student_id": "uuid",
    "status": "present",
    "confidence": 95.5,
    "date": "2024-02-23"
  }'
```

### Get Analytics
```bash
curl http://localhost:3000/api/analytics \
  -H "Authorization: Bearer YOUR_TOKEN"
```

## 9. Support & Documentation

- **Full Setup Guide**: See `SETUP_GUIDE.md`
- **Implementation Status**: See `IMPLEMENTATION_STATUS.md`
- **Hadoop Integration**: See `HADOOP_GUIDE.md`
- **Main README**: See `README.md`

## 10. Next Steps

1. ✓ Install and run locally
2. ✓ Set up database
3. ✓ Create test user
4. ✓ Test face scanner
5. ⏳ Deploy to production
6. ⏳ Integrate real data
7. ⏳ Fine-tune ML models

Happy attendance tracking! 🎉
