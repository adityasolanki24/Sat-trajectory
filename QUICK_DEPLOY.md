# ⚡ Quick Deploy Reference

Super fast deployment commands for when you're in a hurry.

## 🚀 First-Time Deploy (5 minutes)

### Option 1: Vercel Dashboard (No CLI needed)

1. Push to GitHub:
   ```bash
   git add .
   git commit -m "Ready for deployment"
   git push origin main
   ```

2. Go to [vercel.com](https://vercel.com) → Import project → Add env vars → Deploy

**Environment Variables to Add:**
- `SPACETRACK_USER` = your Space-Track username
- `SPACETRACK_PASS` = your Space-Track password
- `PORT` = `8080`
- `NODE_ENV` = `production`

---

### Option 2: Vercel CLI (Fastest)

```bash
# One-time setup
npm install -g vercel
vercel login

# Deploy
cd Sat-trajectory
vercel

# Add environment variables (one-time)
vercel env add SPACETRACK_USER production
# Enter your username when prompted

vercel env add SPACETRACK_PASS production  
# Enter your password when prompted

vercel env add PORT production
# Enter: 8080

vercel env add NODE_ENV production
# Enter: production

# Deploy to production
vercel --prod
```

**Done!** Visit the URL shown in terminal.

---

## 🔄 Update Deployed App

### After Making Changes:

```bash
# Commit your changes
git add .
git commit -m "Your change description"
git push origin main
```

**That's it!** Vercel auto-deploys in ~2 minutes.

---

## 🔥 Emergency Rollback

```bash
# Via CLI
vercel rollback

# Or via Dashboard:
# 1. Go to vercel.com → Your Project → Deployments
# 2. Find previous working deployment
# 3. Click "..." → "Promote to Production"
```

---

## 📊 Check Deployment Status

```bash
# View deployments
vercel ls

# View logs
vercel logs

# Check domains
vercel domains ls
```

---

## 🛠️ Common Commands

```bash
# Preview deployment (not production)
vercel

# Production deployment
vercel --prod

# Add environment variable
vercel env add VAR_NAME production

# List environment variables
vercel env ls

# Remove project (careful!)
vercel remove sat-trajectory

# View project info
vercel inspect
```

---

## 🔍 Verify Deployment

**Quick Health Check:**
```bash
# Replace YOUR_URL with your Vercel URL
curl https://YOUR_URL/api/health
```

**Should return:**
```json
{"status":"ok","timestamp":"..."}
```

---

## 🐛 Quick Fixes

### App doesn't load
```bash
# Check build logs
vercel logs

# Common fix: Rebuild
git commit --allow-empty -m "Trigger rebuild"
git push origin main
```

### Environment variables not working
```bash
# List current vars
vercel env ls

# Remove and re-add
vercel env rm SPACETRACK_USER production
vercel env add SPACETRACK_USER production
```

### Build fails
```bash
# Test build locally first
npm run build

# If it fails locally, fix errors then:
git add .
git commit -m "Fix build errors"
git push origin main
```

---

## 💡 Pro Tips

1. **Preview before production:**
   ```bash
   vercel        # Creates preview URL
   # Test it
   vercel --prod # Promote to production
   ```

2. **Custom domain:**
   ```bash
   vercel domains add yourdomain.com
   ```

3. **Alias deployment:**
   ```bash
   vercel alias set DEPLOYMENT_URL yourdomain.com
   ```

4. **Pull environment variables:**
   ```bash
   vercel env pull
   ```

---

## ⏱️ Deployment Times

| Step | Time |
|------|------|
| Build | 2-3 min |
| Deploy | 30 sec |
| DNS propagation | 1-5 min |
| **Total** | **~5 min** |

---

## 📱 Mobile Deploy Check

Quick mobile test:
1. Open deployed URL on phone
2. Check 3D rendering works
3. Try adding satellite
4. Check conjunction visualization

---

## 🎯 Deployment Checklist (30 seconds)

Before deploying:
- [ ] Code tested locally (`npm run dev:all`)
- [ ] No console errors
- [ ] Build succeeds (`npm run build`)
- [ ] `.env` not committed
- [ ] Environment variables ready

After deploying:
- [ ] URL loads
- [ ] Satellites render
- [ ] API responds
- [ ] No console errors

---

## 🆘 Need Help?

- **Detailed guide:** [DEPLOYMENT.md](./DEPLOYMENT.md)
- **Step-by-step checklist:** [DEPLOYMENT_CHECKLIST.md](./DEPLOYMENT_CHECKLIST.md)
- **Architecture docs:** [ARCHITECTURE.md](./ARCHITECTURE.md)
- **Vercel docs:** https://vercel.com/docs
- **GitHub issues:** Open an issue if stuck

---

## ✨ You're Ready!

**Your deployment URL will be:**
`https://sat-trajectory-USERNAME.vercel.app`

Or custom domain:
`https://yourdomain.com`

**Go deploy!** 🚀

