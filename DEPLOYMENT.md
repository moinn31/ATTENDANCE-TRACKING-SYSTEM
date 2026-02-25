# 🚀 Deployment Guide

This guide covers deploying the Smart Attendance System to various platforms.

## 📑 Table of Contents

- [Vercel Deployment (Recommended)](#vercel-deployment)
- [Netlify Deployment](#netlify-deployment)
- [Docker Deployment](#docker-deployment)
- [Self-Hosted Deployment](#self-hosted-deployment)
- [Environment Variables](#environment-variables)

---

## ☁️ Vercel Deployment (Recommended)

Vercel is the recommended platform for Next.js applications.

### Prerequisites
- GitHub account
- Vercel account ([sign up free](https://vercel.com))
- Supabase project setup

### Deployment Steps

#### 1. Push to GitHub

```bash
git add .
git commit -m "Ready for deployment"
git push origin main
```

#### 2. Import to Vercel

1. Go to [vercel.com/new](https://vercel.com/new)
2. Click **"Import Git Repository"**
3. Select your repository: `moinn31/ATTENDANCE-TRACKING-SYSTEM`
4. Click **"Import"**

#### 3. Configure Environment Variables

In Vercel dashboard, add these environment variables:

| Variable | Value |
|----------|-------|
| `NEXT_PUBLIC_SUPABASE_URL` | Your Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Your Supabase anon key |

#### 4. Deploy

- Click **"Deploy"**
- Wait 2-3 minutes for build to complete
- Your app will be live at: `https://your-app.vercel.app`

#### 5. Configure Custom Domain (Optional)

1. Go to **Settings → Domains**
2. Add your custom domain
3. Follow DNS configuration instructions

### Automatic Deployments

Vercel automatically deploys:
- **Production**: When you push to `main` branch
- **Preview**: When you create a pull request

---

## 🌐 Netlify Deployment

### Prerequisites
- GitHub account
- Netlify account ([sign up free](https://netlify.com))

### Deployment Steps

#### 1. Connect to Netlify

1. Go to [app.netlify.com](https://app.netlify.com)
2. Click **"Add new site"** → **"Import an existing project"**
3. Connect to GitHub and select your repository

#### 2. Configure Build Settings

- **Build command**: `pnpm build`
- **Publish directory**: `.next`
- **Base directory**: Leave empty

#### 3. Environment Variables

Add in Netlify dashboard (Site settings → Environment variables):

```
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
```

#### 4. Deploy

- Click **"Deploy site"**
- Site will be live at: `https://random-name-123.netlify.app`

---

## 🐳 Docker Deployment

Deploy using Docker containers for maximum portability.

### Create Dockerfile

Create `Dockerfile` in project root:

```dockerfile
# Build stage
FROM node:18-alpine AS builder

WORKDIR /app

# Install pnpm
RUN npm install -g pnpm

# Copy package files
COPY package.json pnpm-lock.yaml ./

# Install dependencies
RUN pnpm install --frozen-lockfile

# Copy source code
COPY . .

# Build application
RUN pnpm build

# Production stage
FROM node:18-alpine AS runner

WORKDIR /app

# Copy built assets
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/public ./public

# Expose port
EXPOSE 3000

# Set environment to production
ENV NODE_ENV=production

# Start application
CMD ["npm", "start"]
```

### Create docker-compose.yml

```yaml
version: '3.8'

services:
  app:
    build: .
    ports:
      - "3000:3000"
    environment:
      - NEXT_PUBLIC_SUPABASE_URL=${NEXT_PUBLIC_SUPABASE_URL}
      - NEXT_PUBLIC_SUPABASE_ANON_KEY=${NEXT_PUBLIC_SUPABASE_ANON_KEY}
    restart: unless-stopped
```

### Build and Run

```bash
# Build image
docker build -t attendance-system .

# Run container
docker run -p 3000:3000 \
  -e NEXT_PUBLIC_SUPABASE_URL=your_url \
  -e NEXT_PUBLIC_SUPABASE_ANON_KEY=your_key \
  attendance-system

# Or use docker-compose
docker-compose up -d
```

---

## 🖥️ Self-Hosted Deployment

Deploy on your own server (Ubuntu/Debian).

### Prerequisites

- Server with Ubuntu 20.04+ or Debian 11+
- Domain name (optional)
- SSH access
- Root or sudo privileges

### Installation Steps

#### 1. Install Node.js and pnpm

```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install Node.js 18
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt install -y nodejs

# Install pnpm
npm install -g pnpm

# Verify installation
node --version
pnpm --version
```

#### 2. Clone Repository

```bash
# Create app directory
sudo mkdir -p /var/www/attendance-system
sudo chown $USER:$USER /var/www/attendance-system

# Clone repository
cd /var/www/attendance-system
git clone https://github.com/moinn31/ATTENDANCE-TRACKING-SYSTEM.git .
```

#### 3. Install Dependencies

```bash
pnpm install
```

#### 4. Configure Environment

```bash
# Create .env.local
nano .env.local

# Add your variables:
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
```

#### 5. Build Application

```bash
pnpm build
```

#### 6. Setup PM2 (Process Manager)

```bash
# Install PM2
npm install -g pm2

# Start application
pm2 start npm --name "attendance-system" -- start

# Enable startup on boot
pm2 startup
pm2 save
```

#### 7. Setup Nginx (Reverse Proxy)

```bash
# Install Nginx
sudo apt install -y nginx

# Create Nginx configuration
sudo nano /etc/nginx/sites-available/attendance-system
```

Add this configuration:

```nginx
server {
    listen 80;
    server_name your-domain.com;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

```bash
# Enable site
sudo ln -s /etc/nginx/sites-available/attendance-system /etc/nginx/sites-enabled/

# Test configuration
sudo nginx -t

# Restart Nginx
sudo systemctl restart nginx
```

#### 8. Setup SSL with Let's Encrypt (Optional)

```bash
# Install Certbot
sudo apt install -y certbot python3-certbot-nginx

# Get certificate
sudo certbot --nginx -d your-domain.com

# Auto-renewal
sudo certbot renew --dry-run
```

---

## 🔐 Environment Variables

### Required Variables

| Variable | Description | Where to Get |
|----------|-------------|--------------|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL | Supabase Dashboard → Settings → API |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anonymous key | Supabase Dashboard → Settings → API |

### Optional Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `HADOOP_HOST` | Hadoop cluster host | `localhost` |
| `HADOOP_PORT` | Hadoop cluster port | `9000` |
| `NODE_ENV` | Environment mode | `production` |

---

## ✅ Post-Deployment Checklist

- [ ] Application accessible at deployment URL
- [ ] Environment variables configured correctly
- [ ] Database connection working
- [ ] Face recognition models loading
- [ ] Camera access working (HTTPS required)
- [ ] Authentication flow working
- [ ] Test account created
- [ ] Analytics dashboard displaying data
- [ ] Mobile responsive design verified
- [ ] SSL certificate installed (production)

---

## 🔄 Update Deployment

### Vercel/Netlify
Simply push to GitHub - automatic deployment triggers

### Docker
```bash
git pull origin main
docker-compose down
docker-compose up -d --build
```

### Self-Hosted
```bash
cd /var/www/attendance-system
git pull origin main
pnpm install
pnpm build
pm2 restart attendance-system
```

---

## 🐛 Troubleshooting

### Build Failures

**Issue**: Build fails on deployment
```bash
# Check logs
vercel logs  # For Vercel
netlify deploy --build  # For Netlify
```

**Common causes**:
- Missing environment variables
- TypeScript errors
- Dependency issues

### Runtime Errors

**Issue**: App crashes after deployment
- Check environment variables are correct
- Verify Supabase credentials
- Check browser console for errors

### Camera Not Working

**Issue**: Face recognition not working
- Ensure HTTPS is enabled (required for camera)
- Check browser permissions
- Verify face-api.js models loading

---

## 📊 Monitoring

### Vercel Analytics
- Built-in analytics for page views and performance
- Enable in Vercel dashboard

### Custom Monitoring
Consider adding:
- Sentry for error tracking
- Google Analytics for user analytics
- Uptime monitoring (UptimeRobot, Pingdom)

---

## 💰 Cost Estimates

### Free Tier (Recommended for Testing)
- **Vercel**: Free (100GB bandwidth)
- **Supabase**: Free (500MB database, 2GB bandwidth)
- **Total**: $0/month

### Production (Small Scale)
- **Vercel Pro**: $20/month
- **Supabase Pro**: $25/month
- **Domain**: $12/year
- **Total**: ~$45/month

### Self-Hosted (VPS)
- **DigitalOcean Droplet**: $6-12/month
- **Domain**: $12/year
- **Total**: ~$10/month

---

## 📚 Additional Resources

- [Next.js Deployment](https://nextjs.org/docs/deployment)
- [Vercel Documentation](https://vercel.com/docs)
- [Docker Documentation](https://docs.docker.com/)
- [Nginx Documentation](https://nginx.org/en/docs/)

---

**Need Help?**  
Open an issue on [GitHub](https://github.com/moinn31/ATTENDANCE-TRACKING-SYSTEM/issues)
