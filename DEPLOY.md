# Production Deployment Guide

## Server Setup (Hostinger / cPanel)

### 1. Database
- Host: localhost (on same server)
- Database: u863107307_CRMdb
- User: u863107307_RGcrMdb
- Already created on Hostinger

### 2. Backend Access
Since golwalacollege.edu.in is on shared hosting (Hostinger), the backend Node.js app
needs to run on a subdomain or port. Options:

**Option A: Subdomain (Recommended)**
- Create subdomain: `api.golwalacollege.edu.in`
- Point it to Node.js app via Hostinger Node.js manager
- Backend URL: `https://api.golwalacollege.edu.in`

**Option B: Same domain with path**
- Use Apache/Nginx reverse proxy
- Backend URL: `https://golwalacollege.edu.in/api`

### 3. Deploy Steps

```bash
# On server via SSH or Hostinger File Manager

# 1. Upload crm-backend folder
# 2. Create .env file (copy from .env.production, fill in values)
# 3. Install dependencies
npm install --production

# 4. Generate Prisma client
npx prisma generate

# 5. Run migrations
npx prisma migrate deploy
# OR if using db push:
npx prisma db push

# 6. Build TypeScript
npm run build

# 7. Start with PM2 (process manager)
npm install -g pm2
pm2 start dist/index.js --name "golwala-crm"
pm2 save
pm2 startup
```

### 4. Admin Panel (Frontend)
```bash
# In admin folder
# Set VITE_API_URL in .env
echo "VITE_API_URL=https://api.golwalacollege.edu.in/api" > .env

# Build
npm run build

# Upload dist/ folder to public_html/admin/ on Hostinger
```

### 5. Environment Variables (.env on server)
```
DATABASE_URL="mysql://u863107307_RGcrMdb:PASSWORD@localhost:3306/u863107307_CRMdb"
JWT_SECRET=<generate 64 char random string>
PORT=5000
NODE_ENV=production
FRONTEND_URL=https://golwalacollege.edu.in
ADMIN_URL=https://admin.golwalacollege.edu.in
```

### 6. Error Logs
- Location: `crm-backend/logs/error.log`
- Check: `tail -f logs/error.log`
- PM2 logs: `pm2 logs golwala-crm`

### 7. Health Check
Visit: `https://api.golwalacollege.edu.in/api/health`
Should return: `{"status":"ok","db":"connected"}`
