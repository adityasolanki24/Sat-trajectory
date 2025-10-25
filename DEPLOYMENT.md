# 🚀 Deployment Guide

Complete guide to deploying the Satellite Trajectory Monitor to production.

## Table of Contents
- [Prerequisites](#prerequisites)
- [Option 1: Vercel (Recommended)](#option-1-vercel-recommended)
- [Option 2: Railway](#option-2-railway)
- [Option 3: Docker](#option-3-docker)
- [Environment Variables](#environment-variables)
- [Post-Deployment](#post-deployment)
- [Continuous Development](#continuous-development)

---

## Prerequisites

Before deploying, ensure you have:

1. ✅ **Git repository** (GitHub, GitLab, or Bitbucket)
2. ✅ **Space-Track.org account** ([Register here](https://www.space-track.org/auth/createAccount))
3. ✅ **Node.js 18+** installed locally
4. ✅ **Tested locally** (`npm run dev:all`)

---

## Option 1: Vercel (Recommended)

### Why Vercel?
- Free tier includes everything you need
- Automatic deployments from Git
- Built-in preview deployments
- Easy environment variable management
- Great developer experience

### Step-by-Step Deployment

#### 1. Prepare Your Repository

```bash
# Initialize git if not already done
cd Sat-trajectory
git init

# Add all files
git add .

# Commit
git commit -m "Initial commit - ready for deployment"

# Create GitHub repository and push
git remote add origin https://github.com/YOUR_USERNAME/sat-trajectory.git
git branch -M main
git push -u origin main
```

#### 2. Install Vercel CLI (Optional but Recommended)

```bash
npm install -g vercel
```

#### 3. Deploy to Vercel

**Method A: Via Vercel Dashboard (Easiest)**

1. Go to [vercel.com](https://vercel.com)
2. Sign in with GitHub
3. Click "Add New Project"
4. Import your Git repository
5. Configure:
   - **Framework Preset**: Vite
   - **Root Directory**: `./`
   - **Build Command**: `npm run build`
   - **Output Directory**: `dist`
6. Add Environment Variables (see [Environment Variables](#environment-variables))
7. Click "Deploy"

**Method B: Via CLI**

```bash
cd Sat-trajectory
vercel

# Follow prompts:
# - Link to existing project? No
# - What's your project's name? sat-trajectory
# - In which directory is your code located? ./
# - Want to override settings? No

# Add environment variables
vercel env add SPACETRACK_USER production
vercel env add SPACETRACK_PASS production
vercel env add PORT production

# Deploy
vercel --prod
```

#### 4. Configure Build Settings

Update `package.json` to include production build script:

```json
{
  "scripts": {
    "dev": "vite",
    "dev:server": "cross-env PORT=5174 tsx watch backend/server.ts",
    "dev:all": "concurrently \"npm run dev:server\" \"npm run dev\"",
    "build": "tsc && vite build",
    "build:server": "tsc backend/server.ts --outDir dist-server",
    "preview": "vite preview",
    "vercel-build": "npm run build"
  }
}
```

---

## Option 2: Railway

### Why Railway?
- Better for backend-heavy apps
- Easy database integration if needed later
- $5 free credit per month
- Simple environment variable management

### Step-by-Step Deployment

#### 1. Install Railway CLI

```bash
npm install -g @railway/cli
```

#### 2. Login to Railway

```bash
railway login
```

#### 3. Initialize Project

```bash
cd Sat-trajectory
railway init

# Follow prompts to create new project
```

#### 4. Add Environment Variables

```bash
railway variables set SPACETRACK_USER=your_username
railway variables set SPACETRACK_PASS=your_password
railway variables set PORT=8080
railway variables set NODE_ENV=production
```

#### 5. Deploy

```bash
railway up
```

#### 6. Add Custom Domain (Optional)

```bash
railway domain
```

---

## Option 3: Docker

### Why Docker?
- Deploy anywhere (AWS, GCP, Azure, DigitalOcean)
- Consistent environment
- Easy scaling

### Dockerfile

Create `Sat-trajectory/Dockerfile`:

```dockerfile
FROM node:18-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production

# Copy source code
COPY . .

# Build frontend
RUN npm run build

# Expose port
EXPOSE 8080

# Start server
CMD ["node", "dist-server/server.js"]
```

### Build and Run

```bash
# Build image
docker build -t sat-trajectory .

# Run container
docker run -p 8080:8080 \
  -e SPACETRACK_USER=your_username \
  -e SPACETRACK_PASS=your_password \
  sat-trajectory
```

### Deploy to Cloud

**AWS ECS:**
```bash
# Push to ECR
aws ecr get-login-password --region us-east-1 | docker login --username AWS --password-stdin YOUR_ECR_URI
docker tag sat-trajectory:latest YOUR_ECR_URI:latest
docker push YOUR_ECR_URI:latest
```

**Google Cloud Run:**
```bash
gcloud builds submit --tag gcr.io/PROJECT_ID/sat-trajectory
gcloud run deploy --image gcr.io/PROJECT_ID/sat-trajectory --platform managed
```

---

## Environment Variables

### Required Variables

| Variable | Description | Example |
|----------|-------------|---------|
| `SPACETRACK_USER` | Space-Track.org username | `your_email@example.com` |
| `SPACETRACK_PASS` | Space-Track.org password | `your_password` |
| `PORT` | Server port (default: 5174) | `8080` |
| `NODE_ENV` | Environment | `production` |

### Setting Variables

**Vercel Dashboard:**
1. Go to Project Settings → Environment Variables
2. Add each variable
3. Select "Production" environment
4. Click "Save"

**Vercel CLI:**
```bash
vercel env add SPACETRACK_USER production
# Enter value when prompted

vercel env add SPACETRACK_PASS production
# Enter value when prompted
```

**Railway:**
```bash
railway variables set SPACETRACK_USER=your_username
railway variables set SPACETRACK_PASS=your_password
```

---

## Post-Deployment

### 1. Verify Deployment

Visit your deployed URL and check:
- ✅ Satellites load
- ✅ 3D visualization works
- ✅ Conjunction data appears
- ✅ Space weather loads
- ✅ Add satellite by NORAD ID works
- ✅ Console shows no errors

### 2. Test API Endpoints

```bash
# Health check
curl https://your-app.vercel.app/api/health

# TLE data
curl https://your-app.vercel.app/api/tle/satellite/25544

# Conjunctions
curl https://your-app.vercel.app/api/conjunctions?range=now-3
```

### 3. Monitor Performance

- Check Vercel Analytics dashboard
- Monitor API response times
- Watch for 500 errors
- Check Space-Track rate limits (30 req/min)

### 4. Set Up Custom Domain (Optional)

**Vercel:**
1. Go to Project Settings → Domains
2. Add your domain
3. Configure DNS records as shown
4. Wait for SSL certificate (automatic)

**Railway:**
```bash
railway domain add yourdomain.com
```

---

## Continuous Development

### Workflow After Deployment

1. **Make Changes Locally**
   ```bash
   git checkout -b feature/new-feature
   # Make your changes
   npm run dev:all  # Test locally
   ```

2. **Commit and Push**
   ```bash
   git add .
   git commit -m "Add new feature"
   git push origin feature/new-feature
   ```

3. **Create Pull Request**
   - Vercel automatically creates preview deployment
   - Test preview URL before merging
   - Preview URL: `https://sat-trajectory-git-feature-username.vercel.app`

4. **Merge to Main**
   ```bash
   git checkout main
   git merge feature/new-feature
   git push origin main
   ```

5. **Automatic Production Deployment**
   - Vercel automatically deploys to production
   - No manual intervention needed
   - Rollback available if needed

### Preview Deployments

Every PR gets its own preview URL:
- Test new features without affecting production
- Share with team for review
- Automatic cleanup when PR is closed

### Rollback Strategy

**Vercel:**
1. Go to Deployments
2. Find previous working deployment
3. Click "..." → "Promote to Production"

**Railway:**
```bash
railway rollback
```

---

## Troubleshooting

### Build Fails

**Error: "Module not found"**
```bash
# Solution: Clear cache and rebuild
rm -rf node_modules dist
npm install
npm run build
```

**Error: "TypeScript errors"**
```bash
# Solution: Fix linter errors locally first
npm run lint
```

### Runtime Errors

**Error: "You must be logged in" (Space-Track)**
- Check environment variables are set correctly
- Verify credentials work at space-track.org
- Check backend logs

**Error: "CORS errors"**
- Ensure API routes are proxied correctly
- Check `vite.config.ts` proxy settings
- Verify `vercel.json` routes

### Performance Issues

**Slow API responses:**
- Check Space-Track rate limits (30 req/min)
- Implement caching for TLE data
- Use Edge Functions for faster responses

**3D rendering slow:**
- Limit number of satellites shown (currently 10)
- Reduce orbit resolution (increase stepMinutes)
- Use 2D view for low-end devices

---

## CI/CD Pipeline (Advanced)

### GitHub Actions

Create `.github/workflows/deploy.yml`:

```yaml
name: Deploy to Vercel

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'
      
      - name: Install dependencies
        run: npm ci
      
      - name: Run tests
        run: npm test
      
      - name: Build
        run: npm run build
      
      - name: Deploy to Vercel
        uses: amondnet/vercel-action@v25
        with:
          vercel-token: ${{ secrets.VERCEL_TOKEN }}
          vercel-org-id: ${{ secrets.VERCEL_ORG_ID }}
          vercel-project-id: ${{ secrets.VERCEL_PROJECT_ID }}
```

---

## Monitoring & Analytics

### Recommended Tools

1. **Vercel Analytics** (Built-in)
   - Real User Monitoring
   - Core Web Vitals
   - Page load times

2. **Sentry** (Error Tracking)
   ```bash
   npm install @sentry/react
   ```

3. **LogRocket** (Session Replay)
   ```bash
   npm install logrocket
   ```

---

## Scaling Considerations

### When You Outgrow Free Tier

1. **Upgrade to Vercel Pro** ($20/month)
   - Unlimited bandwidth
   - Better performance
   - Priority support

2. **Add Caching Layer**
   - Redis for TLE data (24-hour cache)
   - Reduce Space-Track API calls

3. **Database for Analytics**
   - Track conjunction history
   - User preferences
   - Custom satellite lists

4. **CDN for Assets**
   - Faster Earth textures
   - Optimized images

---

## Security Best Practices

1. ✅ **Never commit `.env` files**
2. ✅ **Use environment variables for all secrets**
3. ✅ **Enable HTTPS only** (automatic with Vercel)
4. ✅ **Rate limit API endpoints**
5. ✅ **Validate all user inputs**
6. ✅ **Keep dependencies updated**

```bash
# Check for vulnerabilities
npm audit

# Fix automatically
npm audit fix
```

---

## Cost Estimates

### Free Tier (Sufficient for Most Cases)

| Service | Free Tier | Limits |
|---------|-----------|--------|
| **Vercel** | Free | 100 GB bandwidth/month |
| **Railway** | $5 credit | ~500 hours/month |
| **Netlify** | Free | 100 GB bandwidth/month |
| **Space-Track** | Free | 30 requests/minute |
| **NASA DONKI** | Free | Unlimited |

### Paid Tier (If Needed)

| Service | Cost | What You Get |
|---------|------|--------------|
| **Vercel Pro** | $20/month | Unlimited bandwidth, better perf |
| **Railway** | $0.000231/GB-hour | Usage-based |
| **Redis Cloud** | $5/month | 30 MB cache |

---

## Next Steps After Deployment

1. ✅ **Share your app!** Get feedback from users
2. ✅ **Add analytics** to understand usage
3. ✅ **Create issues** for bugs/features on GitHub
4. ✅ **Write tests** for critical functionality
5. ✅ **Document API** for other developers
6. ✅ **Add features:**
   - User accounts / saved satellites
   - Email alerts for conjunctions
   - Satellite comparison tool
   - Historical orbit playback
   - Custom alerts system

---

## Support & Resources

- **Vercel Docs**: https://vercel.com/docs
- **Railway Docs**: https://docs.railway.app
- **Space-Track API**: https://www.space-track.org/documentation
- **GitHub Issues**: Create issues for bugs/features

---

**Ready to deploy?** Start with Vercel - it's the easiest and most reliable option for this app! 🚀

