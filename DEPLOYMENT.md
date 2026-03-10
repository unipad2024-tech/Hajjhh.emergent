# حُجّة (Hujjah) – Deployment Guide

## Quick Deploy: Vercel + Railway

### Step 1 – Deploy Backend (Railway)

1. Go to [railway.app](https://railway.app) → New Project → Deploy from GitHub
2. Select your repo, set **Root Directory** to `backend`
3. Add these **Environment Variables**:
   ```
   MONGO_URL=mongodb+srv://USER:PASS@cluster.mongodb.net/hujjah
   DB_NAME=hujjah
   ADMIN_PASSWORD=your_secure_password
   JWT_SECRET_KEY=your_random_secret_64chars
   CORS_ORIGINS=https://hujjahgame.com,https://www.hujjahgame.com
   ```
4. Railway auto-detects Python → deploys FastAPI on port 8001
5. Copy your Railway URL: `https://hujjah-backend.up.railway.app`

### Step 2 – Deploy Frontend (Vercel)

1. Go to [vercel.com](https://vercel.com) → New Project → Import from GitHub
2. Set **Root Directory** to `frontend`
3. Add **Environment Variable**:
   ```
   REACT_APP_BACKEND_URL=https://hujjah-backend.up.railway.app
   ```
4. Deploy → Vercel gives you: `https://hujjahgame.vercel.app`

### Step 3 – Seed Initial Data

After both are deployed, run:
```bash
curl -X POST https://hujjah-backend.up.railway.app/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"password":"your_secure_password"}'
# Copy the token

curl -X POST https://hujjah-backend.up.railway.app/api/seed \
  -H "Authorization: Bearer YOUR_TOKEN"
```

---

## Custom Domain (hujjahgame.com)

### Vercel (Frontend)
1. Vercel Dashboard → Your Project → Settings → Domains
2. Add `hujjahgame.com` and `www.hujjahgame.com`
3. Add DNS records at your domain registrar:
   ```
   Type  Name    Value
   A     @       76.76.21.21
   CNAME www     cname.vercel-dns.com
   ```

### Railway (Backend)
1. Railway Dashboard → Your Service → Settings → Networking → Custom Domain
2. Add `api.hujjahgame.com`
3. Add DNS record:
   ```
   Type   Name   Value
   CNAME  api    your-service.railway.app
   ```
4. Update frontend env: `REACT_APP_BACKEND_URL=https://api.hujjahgame.com`

---

## Alternative: Netlify + Render

### Netlify (Frontend)
```bash
cd frontend
yarn build
# Drag the /build folder to netlify.com/drop
```
Or connect GitHub → set `Build command: yarn build` and `Publish dir: build`

### Render (Backend)
1. [render.com](https://render.com) → New Web Service
2. Root dir: `backend` | Build: `pip install -r requirements.txt` | Start: `uvicorn server:app --host 0.0.0.0 --port 10000`

---

## MongoDB Atlas (Free Tier)

1. [cloud.mongodb.com](https://cloud.mongodb.com) → Create Free Cluster
2. Database Access → Add user with password
3. Network Access → Allow 0.0.0.0/0 (all IPs)
4. Connect → Drivers → Copy connection string
5. Replace `<password>` and use as `MONGO_URL`

---

## Admin Panel

- URL: `https://hujjahgame.com/admin`
- Password: set via `ADMIN_PASSWORD` env variable (default: `hujjah2024`)
- **Change before going live!**

---

## Local Development

```bash
# Backend
cd backend
pip install -r requirements.txt
uvicorn server:app --reload --port 8001

# Frontend (new terminal)
cd frontend
yarn install
yarn start
```

---

## Checklist Before Launch

- [ ] Change `ADMIN_PASSWORD` from default
- [ ] Set strong `JWT_SECRET_KEY` (64+ random chars)
- [ ] Configure `CORS_ORIGINS` with your exact domain
- [ ] Seed database via `/api/seed`
- [ ] Test full game flow end-to-end
- [ ] Test on mobile (QR scan feature)
