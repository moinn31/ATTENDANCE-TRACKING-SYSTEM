# Smart Attendance System - Setup Guide

## Overview

The Smart Attendance System is an AI-powered attendance tracking solution that combines:
- **Face Recognition**: Real-time student detection using face-api.js
- **Real-time Analytics**: Instant attendance insights and trends
- **Big Data Processing**: Hadoop-based analytics pipeline for historical data
- **Role-based Access**: Teacher/Admin authentication and authorization

## Quick Start

### 1. Prerequisites

- Node.js 18+ and pnpm
- Supabase account (free tier available)
- Modern web browser with camera access
- (Optional) Hadoop cluster for big data analytics

### 2. Installation

```bash
# Clone or download the project
cd smart-attendance-system

# Install dependencies
pnpm install

# Set up environment variables
# Create a .env.local file with:
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
```

### 3. Database Setup

#### Option A: Manual SQL Execution (Recommended for First Time)

1. Go to your Supabase dashboard
2. Navigate to SQL Editor
3. Run the SQL from `scripts/01-init-schema.sql` to create tables and policies

#### Option B: Application Auto-setup

The system will guide you through table creation on first launch.

### 4. Run the Application

```bash
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000)

### 5. Initial Setup

1. **Create Account**: Sign up as a Teacher or Admin
2. **Add Students**: Go to Students page and add your class roster
3. **Enroll Faces**: Have each student capture their face for recognition
4. **Start Scanning**: Use the Attendance Scanner during class

## Features

### Attendance Scanner
- Real-time face detection using face-api.js
- Confidence scoring for each detection
- Manual or automatic attendance marking
- Live video preview with face detection overlay

### Student Management
- Add/remove students from roster
- Track face enrollment status
- Manage student information

### Analytics Dashboard
- Daily attendance summaries
- Student performance metrics
- Face recognition confidence analysis
- Data quality metrics
- Historical trend visualization

### Role-based Access
- **Teacher**: Can manage their class, scan attendance, view analytics
- **Admin**: Full system access, user management, global analytics

## Hadoop Integration (Optional)

For organizations processing large amounts of historical data:

### Setup Hadoop Cluster

```bash
# Make setup script executable
chmod +x scripts/hadoop-setup.sh

# Run setup (requires sudo)
sudo ./scripts/hadoop-setup.sh
```

### Run Analytics Pipeline

```bash
# Process local data
python scripts/hadoop-analytics.py \
  --mode local \
  --input attendance_data.csv \
  --output analytics_report.json

# Process with Hadoop cluster
python scripts/hadoop-analytics.py \
  --mode hdfs \
  --input attendance_data.csv \
  --output analytics_report.json \
  --hdfs-host hadoop.example.com \
  --hdfs-port 9000
```

## Database Schema

### Tables

#### `students`
- `id`: UUID (Primary Key)
- `name`: TEXT
- `email`: TEXT
- `enrollment_number`: TEXT (Unique)
- `class_id`: UUID
- `created_at`: TIMESTAMP
- `updated_at`: TIMESTAMP

#### `attendance_records`
- `id`: UUID (Primary Key)
- `student_id`: UUID (Foreign Key)
- `date`: DATE
- `status`: ENUM ('present', 'absent', 'late')
- `confidence`: NUMERIC (0-100)
- `marked_by`: UUID (Foreign Key to user)
- `created_at`: TIMESTAMP

#### `face_embeddings`
- `id`: UUID (Primary Key)
- `student_id`: UUID (Foreign Key)
- `embedding`: VECTOR (128-dim)
- `created_at`: TIMESTAMP
- `model_version`: TEXT

#### `analytics_daily`
- `id`: UUID (Primary Key)
- `date`: DATE
- `total_students`: INTEGER
- `present_count`: INTEGER
- `absent_count`: INTEGER
- `late_count`: INTEGER
- `avg_confidence`: NUMERIC
- `created_at`: TIMESTAMP

#### `face_recognition_metrics`
- `id`: UUID (Primary Key)
- `date`: DATE
- `total_detections`: INTEGER
- `successful_matches`: INTEGER
- `false_positives`: INTEGER
- `avg_confidence`: NUMERIC
- `model_version`: TEXT
- `created_at`: TIMESTAMP

## Security Considerations

1. **Row-Level Security (RLS)**: All tables have RLS enabled
   - Teachers can only see their own class data
   - Admins have full access
   - Students can view their own attendance records

2. **Authentication**: Supabase Auth with email/password
   - Passwords are hashed with bcrypt
   - Email confirmation required for new accounts
   - Session tokens expire after 1 hour

3. **Face Data**: Encrypted at rest
   - Raw face images are not stored
   - Only embeddings are retained
   - Can be deleted upon request

## Troubleshooting

### Camera Not Working
- Check browser permissions for camera access
- Ensure HTTPS is used (camera requires secure context)
- Test camera in browser settings

### Face Recognition Not Detecting
- Ensure adequate lighting
- Face should occupy ~10-30% of video frame
- Check that models loaded successfully in browser console

### Supabase Connection Issues
- Verify API URL and keys in .env.local
- Check network connectivity
- Review Supabase dashboard status

### Hadoop Integration Issues
- Verify HDFS is running: `hdfs dfsadmin -report`
- Check YARN status: `yarn application -list`
- Monitor logs: `tail -f $HADOOP_HOME/logs/*.log`

## API Reference

### Authentication Endpoints
- `POST /api/auth/signup` - Create new account
- `POST /api/auth/login` - Sign in
- `POST /api/auth/logout` - Sign out

### Student Management
- `GET /api/students` - List all students
- `POST /api/students` - Create new student
- `PUT /api/students/:id` - Update student
- `DELETE /api/students/:id` - Delete student

### Attendance
- `POST /api/attendance` - Mark attendance
- `GET /api/attendance/:date` - Get attendance for date
- `GET /api/attendance/student/:id` - Get student's attendance history

### Analytics
- `GET /api/analytics/daily` - Daily summary
- `GET /api/analytics/student/:id` - Student performance
- `GET /api/analytics/trends` - Trend analysis

## Performance Optimization

1. **Caching**: Supabase auto-caches frequently accessed data
2. **Batch Operations**: Mark multiple attendances in one request
3. **Pagination**: API returns paginated results (100 items per page)
4. **Indexing**: Database indexes optimized for common queries

## Future Enhancements

- [ ] Multi-class support
- [ ] Mobile app (React Native)
- [ ] Real-time notifications
- [ ] Advanced face recognition (liveness detection)
- [ ] Biometric integration (fingerprint, iris)
- [ ] Attendance API for third-party systems

## Support

For issues and feature requests:
1. Check this guide's troubleshooting section
2. Review application logs in browser console
3. Contact system administrator
4. Check Supabase dashboard status

## License

MIT - See LICENSE file for details

## Changelog

### Version 1.0.0 (Initial Release)
- Face recognition attendance marking
- Student management
- Analytics dashboard
- Hadoop big data pipeline
- Role-based access control
