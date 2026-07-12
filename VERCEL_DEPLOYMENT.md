# Deployment Guide

This project uses:

- **Vercel** for the React/Vite frontend
- **Render** for the Express + Socket.IO backend
- **Neon** for PostgreSQL
- **Cloudinary** for uploaded files

The backend should remain on Render because it runs a persistent Express and Socket.IO server.

## 1. Push the project

```powershell
git add backend/.env.example backend/src frontend VERCEL_DEPLOYMENT.md
git commit -m "prepare application for production deployment"
git push origin main
```

## 2. Create the Neon database

1. Create a project at [Neon](https://neon.tech).
2. Choose a nearby region, preferably Singapore.
3. Copy its PostgreSQL connection string.
4. Run the production migrations:

```powershell
cd backend
$env:DATABASE_URL="YOUR_NEON_CONNECTION_STRING"
npx prisma migrate deploy
cd ..
```

## 3. Configure Cloudinary

1. Create an account at [Cloudinary](https://cloudinary.com).
2. Copy the Cloudinary URL from the dashboard:

```text
cloudinary://API_KEY:API_SECRET@CLOUD_NAME
```

## 4. Deploy the backend to Render

1. Open [Render](https://render.com) and sign in with GitHub.
2. Select **New > Blueprint**.
3. Connect this repository.
4. Render will detect the root `render.yaml` file.
5. Create the `kanban-backend` service.

Set these environment variables:

```text
DATABASE_URL=YOUR_NEON_CONNECTION_STRING
JWT_SECRET=YOUR_FIRST_RANDOM_SECRET
JWT_REFRESH_SECRET=YOUR_SECOND_RANDOM_SECRET
CLOUDINARY_URL=YOUR_CLOUDINARY_URL
FRONTEND_URL=https://YOUR-PROJECT.vercel.app
NODE_ENV=production
```

Generate each JWT secret separately with:

```powershell
[Convert]::ToBase64String(
  [Security.Cryptography.RandomNumberGenerator]::GetBytes(48)
)
```

If configuring Render manually, use:

```text
Root Directory: backend
Build Command: npm install && npm run build
Start Command: npm run start
Health Check Path: /health
```

Copy the resulting backend URL and verify:

```text
https://YOUR-BACKEND.onrender.com/health
```

Expected response:

```json
{"status":"ok"}
```

## 5. Deploy the frontend to Vercel

1. Open [Vercel](https://vercel.com).
2. Select **Add New > Project**.
3. Import this GitHub repository.
4. Set **Root Directory** to `frontend`.
5. Use these build settings:

```text
Framework Preset: Vite
Build Command: npm run build
Output Directory: dist
Install Command: npm install
```

Add this Vercel environment variable:

```text
VITE_API_URL=https://YOUR-BACKEND.onrender.com
```

Do not append `/api` or add a trailing slash. Apply the variable to Production and Preview, then deploy.

## 6. Connect the production domains

After Vercel provides the final frontend domain, update Render:

```text
FRONTEND_URL=https://YOUR-PROJECT.vercel.app
```

For multiple domains, use comma-separated values:

```text
https://YOUR-PROJECT.vercel.app,https://kanban.example.com
```

Save the variable and redeploy Render. Redeploy Vercel after changing any Vercel environment variables.

## 7. Production checklist

- [ ] `/health` returns `{"status":"ok"}`
- [ ] Registration and login work
- [ ] Login survives a browser refresh
- [ ] Boards, columns, and tasks can be created
- [ ] Drag and drop works
- [ ] Attachments upload and open correctly
- [ ] Realtime changes appear in two browser windows
- [ ] Custom domains are included in Render's `FRONTEND_URL`

