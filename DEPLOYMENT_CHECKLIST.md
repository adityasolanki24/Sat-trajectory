# ✅ Pre-Deployment Checklist

Use this checklist before deploying to production.

## 📋 Must-Do Before Deployment

### 1. Test Locally
```bash
cd Sat-trajectory
npm install
npm run dev:all
```

- [ ] App loads without errors
- [ ] Satellites appear on 3D globe
- [ ] Conjunction data loads
- [ ] Space weather displays
- [ ] Add satellite by NORAD ID works
- [ ] Time simulation works
- [ ] Console has no red errors

### 2. Environment Variables
- [ ] Have Space-Track.org account
- [ ] Know your Space-Track username
- [ ] Know your Space-Track password
- [ ] Tested credentials at space-track.org

### 3. Git Repository
```bash
# Check git status
git status

# Ensure .env is NOT tracked
git check-ignore .env
# Should output: .env
```

- [ ] Code is committed
- [ ] `.env` is in `.gitignore`
- [ ] Pushed to GitHub/GitLab/Bitbucket
- [ ] Repository is accessible

### 4. Build Test
```bash
npm run build
```

- [ ] Build completes without errors
- [ ] No TypeScript errors
- [ ] `dist/` directory created

---

## 🚀 Deployment Steps (Vercel)

### Method 1: Vercel Dashboard (Easiest)

1. **Go to Vercel**
   - [ ] Visit [vercel.com](https://vercel.com)
   - [ ] Sign in with GitHub

2. **Import Project**
   - [ ] Click "Add New Project"
   - [ ] Select your repository
   - [ ] Click "Import"

3. **Configure Project**
   - [ ] Framework Preset: Vite
   - [ ] Root Directory: `./`
   - [ ] Build Command: `npm run build`
   - [ ] Output Directory: `dist`

4. **Add Environment Variables**
   - [ ] Add `SPACETRACK_USER` (production)
   - [ ] Add `SPACETRACK_PASS` (production)
   - [ ] Add `PORT` = `8080` (production)
   - [ ] Add `NODE_ENV` = `production` (production)

5. **Deploy**
   - [ ] Click "Deploy"
   - [ ] Wait for build to complete (~2-3 minutes)
   - [ ] Visit deployed URL

### Method 2: Vercel CLI

```bash
# Install Vercel CLI
npm install -g vercel

# Login
vercel login

# Deploy to preview
cd Sat-trajectory
vercel

# Add environment variables
vercel env add SPACETRACK_USER production
vercel env add SPACETRACK_PASS production
vercel env add PORT production
vercel env add NODE_ENV production

# Deploy to production
vercel --prod
```

- [ ] CLI installed
- [ ] Logged in
- [ ] Environment variables added
- [ ] Deployed to production

---

## ✅ Post-Deployment Verification

### 1. Functional Testing

Visit your deployment URL (e.g., `https://sat-trajectory.vercel.app`)

- [ ] Homepage loads
- [ ] 3D globe renders
- [ ] Satellites appear
- [ ] Can add satellite by NORAD ID (try 25544 - ISS)
- [ ] Conjunction table populates
- [ ] Space weather data loads
- [ ] Time slider works
- [ ] 3D Map tab works
- [ ] 2D Map tab works

### 2. API Testing

```bash
# Replace YOUR_URL with your deployment URL

# Health check
curl https://YOUR_URL/api/health

# TLE data
curl https://YOUR_URL/api/tle/satellite/25544

# Conjunctions
curl https://YOUR_URL/api/conjunctions?range=now-3
```

- [ ] `/api/health` returns 200
- [ ] `/api/tle/satellite/25544` returns TLE data
- [ ] `/api/conjunctions` returns conjunction data
- [ ] No authentication errors

### 3. Browser Console Check

Open DevTools (F12) → Console tab

- [ ] No red errors
- [ ] Orbit generation logs appear
- [ ] API calls succeed
- [ ] WebGL initialized successfully

### 4. Mobile Testing (Optional)

- [ ] Open on mobile device
- [ ] 3D view loads (or 2D fallback)
- [ ] Touch controls work
- [ ] Responsive layout

---

## 🔧 Troubleshooting

### Build Fails

**Error: Module not found**
```bash
rm -rf node_modules dist
npm install
npm run build
```

**Error: TypeScript errors**
```bash
npm run lint
# Fix reported errors
```

### Deployment Succeeds but App Doesn't Work

**Blank screen:**
- Check browser console for errors
- Verify all environment variables are set
- Check Vercel deployment logs

**"You must be logged in" error:**
- Verify Space-Track credentials
- Check environment variables spelling
- Test credentials at space-track.org

**3D globe doesn't render:**
- Check if WebGL is supported (try 2D view)
- Check browser console for Three.js errors
- Try different browser

### API Errors

**CORS errors:**
- Check `vercel.json` routes configuration
- Ensure backend is properly proxied

**Rate limit errors:**
- Space-Track allows 30 requests/minute
- Implement caching for TLE data
- Reduce polling frequency

---

## 🎯 Success Criteria

Your deployment is successful when:

✅ App loads without errors  
✅ Satellites render on 3D globe  
✅ Conjunction data displays in table  
✅ Can click conjunction to visualize  
✅ Can add custom satellite by NORAD ID  
✅ Time simulation works smoothly  
✅ Space weather data loads  
✅ No console errors  
✅ Mobile-friendly (bonus)

---

## 🔄 Continuous Deployment Workflow

After successful deployment:

### Making Changes

1. **Create Feature Branch**
   ```bash
   git checkout -b feature/improve-ui
   ```

2. **Make Changes & Test Locally**
   ```bash
   npm run dev:all
   # Test your changes
   ```

3. **Commit & Push**
   ```bash
   git add .
   git commit -m "Improve UI design"
   git push origin feature/improve-ui
   ```

4. **Create Pull Request**
   - GitHub creates PR
   - Vercel automatically deploys preview
   - Preview URL: `sat-trajectory-git-feature-username.vercel.app`
   - Test preview before merging

5. **Merge to Main**
   ```bash
   git checkout main
   git merge feature/improve-ui
   git push origin main
   ```

6. **Automatic Production Deploy**
   - Vercel detects push to main
   - Builds and deploys automatically
   - Production updated in ~2 minutes

### Quick Hotfix

```bash
# Make urgent fix
git checkout -b hotfix/critical-bug
# Fix bug
git commit -am "Fix critical bug"
git push origin hotfix/critical-bug

# Merge directly to main (skip PR for emergencies)
git checkout main
git merge hotfix/critical-bug
git push origin main

# Auto-deploys to production
```

---

## 📊 Monitoring Your Deployment

### Vercel Dashboard

Check daily:
- [ ] Deployment status (green = good)
- [ ] Bandwidth usage (free tier: 100GB/month)
- [ ] Build times (should be 2-3 minutes)
- [ ] Error logs (if any)

### Space-Track Usage

Monitor:
- [ ] API request count (max 30/minute)
- [ ] Account status
- [ ] Any service notifications

### User Feedback

Track:
- [ ] Load times
- [ ] Error reports
- [ ] Feature requests
- [ ] Browser compatibility issues

---

## 🎉 You're Done!

Congratulations! Your satellite tracking app is now live.

**Share your deployment:**
- Tweet about it
- Post on Reddit r/space
- Share in Discord communities
- Add to your portfolio

**Next steps:**
- Add custom domain (optional)
- Set up analytics
- Implement user feedback
- Add new features
- Create documentation

**Need help?**
- Check [DEPLOYMENT.md](./DEPLOYMENT.md) for detailed guides
- Open GitHub issue for bugs
- Check Vercel docs for platform questions

---

**Deployment URL:** ___________________________

**Deployed on:** ___________________________

**Environment Variables Added:** [ ] Yes [ ] No

**Post-Deployment Tests Passed:** [ ] Yes [ ] No

**Ready for Production:** [ ] Yes [ ] No

