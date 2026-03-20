# توثيق مشروع حُجّة - الدليل التقني الكامل

---

## 12. SECURITY — الأمان

### أ. Authentication Protection — حماية المصادقة

التطبيق يستخدم نظامين منفصلين للمصادقة:

**1. مصادقة المستخدمين (JWT)**

```python
# server.py - السطر 150
def create_token(payload: dict, expires_hours: int = 24) -> str:
    p = {**payload, "exp": datetime.now(timezone.utc) + timedelta(hours=24)}
    return jwt.encode(p, SECRET_KEY, algorithm="HS256")
```

- كل token يحتوي على: `sub` (user ID) + `role` + `email` + `exp` (انتهاء الصلاحية)
- الـ token ينتهي بعد **24 ساعة** تلقائياً
- يُخزَّن في `localStorage` على المتصفح
- كلمة المرور مشفرة بـ **bcrypt** قبل التخزين في قاعدة البيانات

```python
# server.py - السطر 144
pwd_ctx = CryptContext(schemes=["bcrypt"], deprecated="auto")

def hash_pw(pw: str) -> str:
    return pwd_ctx.hash(pw)  # bcrypt hash تلقائي

def verify_pw(pw: str, hashed: str) -> bool:
    return pwd_ctx.verify(pw, hashed)
```

**2. مصادقة الأدمن (JWT منفصل)**

```python
# server.py - السطر 154
async def get_admin(authorization: Optional[str] = Header(None)):
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(401, "غير مصرح")
    data = jwt.decode(token, SECRET_KEY, algorithms=["HS256"])
    if data.get("role") != "admin":
        raise HTTPException(403, "غير مصرح")
```

- الأدمن يسجل دخول بكلمة مرور واحدة (مخزنة في `.env`)
- الـ token يحمل `role: admin` وليس `role: user`
- لا يوجد حساب admin في قاعدة البيانات — الأمان عبر role مختلف فقط

---

### ب. API Protection — حماية نقاط الـ API

**الـ endpoints المحمية بـ `get_admin`:**
```
POST /api/admin/login
GET  /api/admin/users
PUT  /api/admin/users/{id}
GET  /api/admin/analytics
PUT  /api/settings
POST /api/upload
POST /api/categories
PUT  /api/categories/{id}
DELETE /api/categories/{id}
POST /api/questions
PUT  /api/questions/{id}
DELETE /api/questions/{id}
PATCH /api/questions/{id}/experimental
POST /api/ai/generate-questions
POST /api/ai/save-questions
POST /api/seed
```

**الـ endpoints المحمية بـ `require_user`:**
```
GET  /api/auth/me
PUT  /api/auth/me
POST /api/stripe/checkout
GET  /api/stripe/status/{session_id}
```

**الـ endpoints العامة (لا تحتاج token):**
```
POST /api/auth/register
POST /api/auth/login
GET  /api/categories
GET  /api/questions
GET  /api/free-categories
GET  /api/settings
POST /api/game/session
POST /api/game/session/{id}/question
PUT  /api/game/session/{id}
PUT  /api/game/session/{id}/score
```

---

### ج. Rate Limiting — تحديد معدل الطلبات

**الحالة الراهنة:** لا يوجد rate limiting مُطبَّق حالياً في الكود.

**التوصية للإنتاج:**

```python
# أضف هذا في server.py
from slowapi import Limiter
from slowapi.util import get_remote_address

limiter = Limiter(key_func=get_remote_address)
app.state.limiter = limiter

@api_router.post("/auth/login")
@limiter.limit("5/minute")  # 5 محاولات فقط كل دقيقة
async def login(request: Request, body: UserLogin):
    ...

@api_router.post("/ai/generate-questions")
@limiter.limit("10/hour")  # 10 طلبات كل ساعة
async def generate_questions(request: Request, ...):
    ...
```

---

### د. Input Validation — التحقق من المدخلات

يستخدم التطبيق **Pydantic** للتحقق التلقائي:

```python
# server.py - السطر 53
class UserCreate(BaseModel):
    email: str          # FastAPI يتحقق من النوع تلقائياً
    username: str
    password: str

# التحقق اليدوي الإضافي
@api_router.post("/auth/register")
async def register(body: UserCreate):
    if len(body.password) < 6:
        raise HTTPException(400, "كلمة المرور قصيرة")
    existing = await db.users.find_one({"email": body.email.lower()})
    if existing:
        raise HTTPException(409, "البريد مسجل مسبقاً")
```

**رفع الصور — التحقق من الملفات:**

```python
# server.py
ALLOWED_EXTS = {"png", "jpg", "jpeg", "webp"}

async def upload_image(file: UploadFile):
    ext = file.filename.rsplit(".", 1)[-1].lower()
    if ext not in ALLOWED_EXTS:
        raise HTTPException(400, "PNG/JPG/WEBP فقط")
    if file.size > 5 * 1024 * 1024:  # 5MB
        raise HTTPException(400, "الحجم الأقصى 5MB")
```

---

### هـ. XSS / CSRF Protection

**XSS (Cross-Site Scripting):**
- React يهرّب HTML تلقائياً عند استخدام `{variable}` في JSX
- لا يوجد استخدام لـ `dangerouslySetInnerHTML` في الكود
- الـ token مخزَّن في `localStorage` (وليس Cookies) مما يقلل هجمات CSRF

**CORS:**

```python
# server.py
app.add_middleware(
    CORSMiddleware,
    allow_origins=os.environ.get("CORS_ORIGINS", "*").split(","),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
```

**للإنتاج يجب تغيير `CORS_ORIGINS` من `*` إلى:**
```
CORS_ORIGINS=https://your-app.vercel.app
```

---

## 13. DEVOPS & DEPLOYMENT

### أ. معمارية النشر الكاملة

```
المستخدم (Browser)
       │
       ▼
  Vercel (CDN)
  React Frontend
  Build: craco build
       │
       │ HTTPS API calls to /api/*
       ▼
  Railway / Render
  FastAPI Backend
  Port: $PORT (dynamic)
  uvicorn server:app
       │
       ▼
  MongoDB Atlas
  Cloud Database
  M0 Free Tier
```

---

### ب. Frontend Hosting — الفرونت اند

**المزود:** Vercel

**ملف الإعداد** (`/frontend/vercel.json`):
```json
{
  "buildCommand": "yarn build",
  "outputDirectory": "build",
  "rewrites": [
    { "source": "/(.*)", "destination": "/index.html" }
  ]
}
```

**سبب الـ rewrite:** لأن التطبيق SPA (Single Page App) فكل الـ routes تُعاد لـ `index.html` وReact Router يتولى الباقي.

**متغيرات البيئة في Vercel:**
```
REACT_APP_BACKEND_URL = https://your-backend.up.railway.app
```

---

### ج. Backend Hosting — الباك اند

**المزود الأول:** Railway

**ملف الإعداد** (`/backend/railway.json`):
```json
{
  "build": { "builder": "NIXPACKS" },
  "deploy": {
    "startCommand": "uvicorn server:app --host 0.0.0.0 --port $PORT",
    "restartPolicyType": "ON_FAILURE",
    "restartPolicyMaxRetries": 5
  }
}
```

**ملف Procfile** (`/backend/Procfile`):
```
web: uvicorn server:app --host 0.0.0.0 --port $PORT
```

**المزود البديل:** Render  
**ملف الإعداد** (`/render.yaml`):
```yaml
services:
  - type: web
    name: hujjah-backend
    runtime: python
    rootDir: backend
    buildCommand: pip install -r requirements.txt
    startCommand: uvicorn server:app --host 0.0.0.0 --port $PORT
```

---

### د. Database Hosting — قاعدة البيانات

**المزود:** MongoDB Atlas (M0 Free)

**الـ Collections:**
```
hujjah_db
├── users           - حسابات المستخدمين
├── categories      - فئات اللعبة (10 فئات)
├── questions       - الأسئلة (450+)
├── game_sessions   - جلسات اللعب النشطة
├── payments        - سجل المدفوعات
└── settings        - إعدادات اللعبة (وثيقة واحدة)
```

---

### هـ. Environment Variables — متغيرات البيئة

**Backend (`/backend/.env`):**

| المتغير | الوصف | مثال |
|---------|-------|------|
| `MONGO_URL` | رابط MongoDB Atlas | `mongodb+srv://user:pass@cluster.mongodb.net/` |
| `DB_NAME` | اسم قاعدة البيانات | `hujjah_db` |
| `JWT_SECRET_KEY` | مفتاح تشفير الـ tokens | نص عشوائي طويل |
| `ADMIN_PASSWORD` | كلمة مرور لوحة الإدارة | `hujjah2024` |
| `CORS_ORIGINS` | الـ domains المسموحة | `https://app.vercel.app` |
| `STRIPE_API_KEY` | مفتاح Stripe للدفع | `sk_live_...` |
| `GEMINI_API_KEY` | مفتاح Google Gemini AI | `AIzaSy...` |

**Frontend (`/frontend/.env`):**

| المتغير | الوصف | مثال |
|---------|-------|------|
| `REACT_APP_BACKEND_URL` | رابط الباك اند | `https://backend.up.railway.app` |

---

### و. CI/CD Pipeline

**لا يوجد CI/CD تلقائي حالياً.**

**الطريقة اليدوية:**
1. عدّل الكود
2. ادفع إلى GitHub
3. Railway و Vercel يعيدان البناء تلقائياً عند كل push

**لإضافة CI/CD مستقبلاً (GitHub Actions):**

```yaml
# .github/workflows/deploy.yml
name: Deploy
on:
  push:
    branches: [main]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - name: Test Backend
        run: cd backend && pip install -r requirements.txt && pytest
  deploy:
    needs: test
    runs-on: ubuntu-latest
    steps:
      - name: Deploy to Railway
        run: railway up
```

---

### ز. النشر من الصفر (Deployment from Scratch)

```bash
# 1. استنسخ المشروع
git clone https://github.com/your-username/hujjah.git
cd hujjah

# 2. انشر الباك اند على Railway
npm install -g @railway/cli
railway login
cd backend
railway init --name hujjah-backend
railway variables set MONGO_URL="..." DB_NAME="hujjah_db" ...
railway up

# 3. انشر الفرونت اند على Vercel
cd ../frontend
npx vercel --prod --env REACT_APP_BACKEND_URL="https://your-backend.railway.app"

# 4. ابدأ قاعدة البيانات
# افتح https://your-backend.railway.app/api/seed في المتصفح
# أو عبر curl:
curl -X POST https://your-backend.railway.app/api/seed \
  -H "Content-Type: application/json" \
  -d '{"force": false}'
```

---

## 14. PROJECT FILE STRUCTURE — هيكل الملفات

```
hujjah/
│
├── backend/                          # FastAPI Backend
│   ├── server.py                     # الملف الرئيسي (1354 سطر)
│   │   ├── Models (Pydantic)         # السطور 50-139
│   │   ├── Auth Helpers              # السطور 140-181
│   │   ├── User Auth Routes          # السطور 182-245
│   │   ├── Admin Auth Routes         # السطور 246-290
│   │   ├── Categories CRUD           # السطور 291-340
│   │   ├── Free Categories           # السطور 341-370
│   │   ├── Questions CRUD            # السطور 371-430
│   │   ├── Game Session Routes       # السطور 430-560
│   │   ├── Score & Settings          # السطور 560-620
│   │   ├── Stripe Payment            # السطور 620-800
│   │   ├── Admin Dashboard APIs      # السطور 800-950
│   │   ├── Seed Data                 # السطور 950-1150
│   │   ├── Settings API              # السطور 1150-1200
│   │   ├── Upload API                # السطور 1200-1250
│   │   ├── AI Question Generator     # السطور 1250-1354
│   │   └── Startup/Shutdown          # السطور آخر الملف
│   │
│   ├── static/
│   │   └── uploads/                  # الصور المرفوعة
│   │
│   ├── .env                          # متغيرات البيئة (لا تُرفع لـ GitHub)
│   ├── .env.example                  # قالب المتغيرات
│   ├── requirements.txt              # مكتبات Python
│   ├── Procfile                      # أمر تشغيل Railway
│   ├── railway.json                  # إعدادات Railway
│   └── runtime.txt                   # نسخة Python (3.11)
│
├── frontend/                         # React Frontend
│   ├── src/
│   │   ├── pages/                    # صفحات التطبيق
│   │   │   ├── HomePage.jsx          # الصفحة الرئيسية
│   │   │   ├── TeamSetupPage.jsx     # إدخال أسماء الفرق
│   │   │   ├── CategorySelectPage.jsx # اختيار الفئات
│   │   │   ├── GameBoardPage.jsx     # لوحة اللعب الرئيسية
│   │   │   ├── QuestionPage.jsx      # شاشة السؤال
│   │   │   ├── SecretWordPage.jsx    # صفحة ولا كلمة (QR)
│   │   │   ├── LoginPage.jsx         # تسجيل الدخول
│   │   │   ├── SignupPage.jsx         # إنشاء حساب
│   │   │   ├── PricingPage.jsx       # صفحة الأسعار
│   │   │   ├── PaymentSuccessPage.jsx # بعد الدفع
│   │   │   ├── AdminLoginPage.jsx    # دخول الأدمن
│   │   │   └── AdminDashboard.jsx   # لوحة الإدارة
│   │   │
│   │   ├── context/
│   │   │   └── GameContext.js        # الـ state المشترك (session, user, turn, darkMode)
│   │   │
│   │   ├── components/
│   │   │   └── ui/                   # مكونات shadcn/ui
│   │   │       ├── button.jsx
│   │   │       ├── dialog.jsx
│   │   │       ├── sonner.jsx        # Toast notifications
│   │   │       └── ... (40+ مكون)
│   │   │
│   │   ├── hooks/
│   │   │   └── use-toast.js
│   │   │
│   │   ├── lib/
│   │   │   └── utils.js              # دوال مساعدة (cn, mergeClasses)
│   │   │
│   │   ├── App.js                    # Router + Routes تعريف كل الـ
│   │   ├── App.css                   # أنيميشن وتأثيرات
│   │   └── index.css                 # Tailwind directives + خطوط
│   │
│   ├── public/
│   │   └── index.html
│   │
│   ├── .env                          # REACT_APP_BACKEND_URL
│   ├── .env.example                  # قالب المتغيرات
│   ├── vercel.json                   # إعدادات Vercel
│   ├── package.json                  # dependencies
│   ├── tailwind.config.js            # Tailwind + custom colors
│   └── craco.config.js               # webpack overrides
│
├── deploy.sh                         # سكريبت النشر التلقائي
├── render.yaml                       # إعدادات Render.com
└── memory/
    └── PRD.md                        # وثيقة متطلبات المشروع
```

---

## 15. STEP-BY-STEP REBUILD GUIDE — دليل إعادة البناء من الصفر

### الخطوة 1 — تثبيت الأدوات

```bash
# Node.js (v18+)
# حمّله من: https://nodejs.org

# Python (3.11+)
# حمّله من: https://python.org

# تحقق من التثبيت
node --version    # v18.x.x
python3 --version # Python 3.11.x
npm --version     # 9.x.x

# أدوات إضافية
npm install -g yarn     # مدير حزم JavaScript
pip install uvicorn     # خادم Python
```

---

### الخطوة 2 — أنشئ المشروع

```bash
# استنسخ أو ابدأ من صفر
git clone https://github.com/your-username/hujjah.git
cd hujjah

# أو ابدأ من صفر:
mkdir hujjah && cd hujjah
mkdir backend frontend
```

---

### الخطوة 3 — إعداد قاعدة البيانات

```bash
# خيار 1: MongoDB محلي (للتطوير)
# حمّله من: https://www.mongodb.com/try/download/community
# شغّله:
mongod --dbpath ./data

# خيار 2: MongoDB Atlas (للإنتاج)
# 1. اذهب لـ mongodb.com/atlas
# 2. أنشئ Free Cluster
# 3. خذ Connection String
# الرابط يكون مثل:
# mongodb+srv://user:password@cluster.mongodb.net/hujjah_db
```

---

### الخطوة 4 — إعداد الباك اند

```bash
cd backend

# أنشئ البيئة الافتراضية
python3 -m venv venv
source venv/bin/activate   # Mac/Linux
venv\Scripts\activate       # Windows

# ثبّت المكتبات
pip install -r requirements.txt

# أنشئ ملف .env
cp .env.example .env
# عدّل .env بالقيم الصحيحة

# شغّل الباك اند
uvicorn server:app --host 0.0.0.0 --port 8001 --reload

# ابدأ قاعدة البيانات (مرة واحدة فقط)
curl -X POST http://localhost:8001/api/seed \
  -H "Content-Type: application/json" \
  -d '{"force": false}'
```

**محتوى `.env`:**
```env
MONGO_URL=mongodb://localhost:27017
DB_NAME=hujjah_db
JWT_SECRET_KEY=any_long_random_string_here
ADMIN_PASSWORD=hujjah2024
CORS_ORIGINS=http://localhost:3000
STRIPE_API_KEY=sk_test_...
GEMINI_API_KEY=AIzaSy...
```

---

### الخطوة 5 — إعداد الفرونت اند

```bash
cd frontend

# ثبّت المكتبات
yarn install

# أنشئ ملف .env
echo "REACT_APP_BACKEND_URL=http://localhost:8001" > .env

# شغّل الفرونت اند
yarn start
# يفتح تلقائياً على http://localhost:3000
```

---

### الخطوة 6 — بناء التطبيق للإنتاج

```bash
# بناء الفرونت اند
cd frontend
yarn build
# الـ build تُحفظ في مجلد /build

# اختبر الـ build محلياً
npx serve -s build -l 3000
```

---

### الخطوة 7 — النشر

```bash
# شغّل السكريبت التلقائي
chmod +x deploy.sh
./deploy.sh

# أو يدوياً:

# Backend → Railway
cd backend
npm install -g @railway/cli
railway login
railway init
railway variables set MONGO_URL="..." DB_NAME="hujjah_db" ...
railway up

# Frontend → Vercel
cd frontend
npx vercel --prod \
  --env REACT_APP_BACKEND_URL="https://your-backend.railway.app"

# ابدأ قاعدة البيانات في الإنتاج (مرة واحدة)
curl -X POST https://your-backend.railway.app/api/seed \
  -H "Content-Type: application/json" \
  -d '{"force": false}'
```

---

### الخطوة 8 — اختبار التطبيق

```bash
# اختبر الباك اند
curl https://your-backend.railway.app/api/categories

# اختبر تسجيل الدخول
curl -X POST https://your-backend.railway.app/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@test.com","password":"123456"}'

# اختبر الأدمن
curl -X POST https://your-backend.railway.app/api/admin/login \
  -H "Content-Type: application/json" \
  -d '{"password":"hujjah2024"}'
```

---

## 16. FUTURE SCALING — التوسع المستقبلي

### 10,000 مستخدم — الإعداد الحالي كافٍ

```
MongoDB Atlas M0 Free:
  - يتحمل حتى 100 اتصال متزامن
  - 512MB تخزين مجاني

Railway/Render Free Tier:
  - 512MB RAM
  - يكفي لـ 100-500 طلب/ثانية

تحسينات مطلوبة عند 10K مستخدم:
  ✅ ترقية MongoDB Atlas إلى M10 ($57/شهر)
  ✅ إضافة MongoDB indexes:
```

```python
# أضف في server.py عند startup
await db.users.create_index("email", unique=True)
await db.users.create_index("username", unique=True)
await db.questions.create_index([("category_id", 1), ("difficulty", 1)])
await db.game_sessions.create_index("id", unique=True)
await db.game_sessions.create_index("user_id")
```

---

### 100,000 مستخدم — يحتاج تحسينات

```
المشاكل المتوقعة:
  ❌ قاعدة البيانات تبطّأ بدون caching
  ❌ الباك اند لا يتحمل الطلبات الكثيرة

الحلول:

1. أضف Redis Caching:
```

```python
import redis.asyncio as redis

cache = redis.from_url("redis://your-redis-url")

@api_router.get("/categories")
async def get_categories():
    # جرب الـ cache أولاً
    cached = await cache.get("categories")
    if cached:
        return json.loads(cached)
    
    # من قاعدة البيانات
    cats = await db.categories.find({}, {"_id": 0}).to_list(100)
    
    # احفظ في الـ cache لمدة ساعة
    await cache.setex("categories", 3600, json.dumps(cats))
    return cats
```

```
2. أضف Load Balancer:
   Railway أو Render يدعمان auto-scaling تلقائياً

3. ترقية MongoDB:
   M10 → M20 ($57 → $189/شهر)
   أو MongoDB Serverless (ادفع فقط على الاستخدام)

4. فصل Static Files:
   الصور المرفوعة تنقل إلى AWS S3 أو Cloudflare R2
```

```python
# مثال: رفع الصور لـ AWS S3 بدل التخزين المحلي
import boto3

s3 = boto3.client('s3',
    aws_access_key_id=os.environ['AWS_ACCESS_KEY'],
    aws_secret_access_key=os.environ['AWS_SECRET_KEY']
)

async def upload_to_s3(file: UploadFile) -> str:
    content = await file.read()
    filename = f"{uuid.uuid4()}.{file.filename.split('.')[-1]}"
    s3.put_object(
        Bucket="hujjah-images",
        Key=filename,
        Body=content,
        ContentType=file.content_type
    )
    return f"https://hujjah-images.s3.amazonaws.com/{filename}"
```

---

### 1,000,000 مستخدم — معمارية Microservices

```
المعمارية المقترحة:

┌─────────────────────────────────────────────────────┐
│                    Cloudflare CDN                   │
│              (Static Assets + DDoS Protection)      │
└────────────────────────┬────────────────────────────┘
                         │
┌────────────────────────▼────────────────────────────┐
│                   Load Balancer                     │
│              (AWS ALB / Cloudflare)                 │
└───────┬────────────────┬────────────────┬───────────┘
        │                │                │
┌───────▼──────┐  ┌──────▼──────┐  ┌─────▼──────────┐
│  Auth Service│  │ Game Service│  │  AI Service     │
│  (FastAPI)   │  │  (FastAPI)  │  │  (FastAPI)      │
│  2-4 instances│  │ 4-8 instances│  │  1-2 instances │
└───────┬──────┘  └──────┬──────┘  └─────┬───────────┘
        │                │               │
┌───────▼────────────────▼───────────────▼───────────┐
│                   Redis Cluster                     │
│              (Sessions + Caching)                   │
└────────────────────────┬────────────────────────────┘
                         │
┌────────────────────────▼────────────────────────────┐
│              MongoDB Atlas M50+                     │
│         (Read Replicas + Sharding)                  │
└─────────────────────────────────────────────────────┘

التكلفة التقريرية عند 1M مستخدم:
  MongoDB Atlas M50:     ~$400/شهر
  AWS/GCP Compute:       ~$500/شهر
  Redis:                 ~$100/شهر
  CDN + Load Balancer:   ~$100/شهر
  المجموع:               ~$1,100/شهر
```

**تحسينات الكود عند المليون:**

```python
# 1. Database Connection Pool
client = AsyncIOMotorClient(
    mongo_url,
    maxPoolSize=50,        # 50 اتصال متزامن
    minPoolSize=10,
    serverSelectionTimeoutMS=5000
)

# 2. Pagination للقوائم الكبيرة
@api_router.get("/questions")
async def get_questions(page: int = 1, limit: int = 50):
    skip = (page - 1) * limit
    questions = await db.questions.find(
        {}, {"_id": 0}
    ).skip(skip).limit(limit).to_list(limit)
    total = await db.questions.count_documents({})
    return {"questions": questions, "total": total, "page": page}

# 3. Background Tasks للعمليات الثقيلة
@api_router.post("/ai/generate-questions")
async def generate_questions(body: dict, background_tasks: BackgroundTasks):
    task_id = str(uuid.uuid4())
    background_tasks.add_task(run_ai_generation, task_id, body)
    return {"task_id": task_id, "status": "processing"}

# 4. WebSockets للـ Real-time
from fastapi import WebSocket

@app.websocket("/ws/game/{session_id}")
async def game_websocket(websocket: WebSocket, session_id: str):
    await websocket.accept()
    # إرسال تحديثات النقاط في الوقت الفعلي
    while True:
        session = await db.game_sessions.find_one({"id": session_id})
        await websocket.send_json({
            "team1_score": session["team1_score"],
            "team2_score": session["team2_score"]
        })
        await asyncio.sleep(1)
```

---

## ملاحظات ختامية

### API Keys Summary

| المتغير | من أين تحصل عليه |
|---------|-----------------|
| `MONGO_URL` | mongodb.com/atlas → Connect → Drivers |
| `JWT_SECRET_KEY` | اكتب أي نص عشوائي طويل |
| `ADMIN_PASSWORD` | اختاره أنت |
| `STRIPE_API_KEY` | dashboard.stripe.com → Developers → API Keys |
| `GEMINI_API_KEY` | aistudio.google.com/app/apikey |

### Ports

| الخدمة | المنفذ المحلي | المنفذ في الإنتاج |
|--------|--------------|-----------------|
| Frontend | 3000 | Vercel (443 HTTPS) |
| Backend | 8001 | Railway ($PORT dynamic) |
| MongoDB | 27017 | Atlas Cloud |

### أوامر مفيدة

```bash
# تشغيل محلي
cd backend && uvicorn server:app --port 8001 --reload
cd frontend && yarn start

# بناء للإنتاج
cd frontend && yarn build

# اختبار الـ API
curl http://localhost:8001/api/categories | python3 -m json.tool

# إعادة ضبط قاعدة البيانات
curl -X POST http://localhost:8001/api/seed \
  -H "Content-Type: application/json" \
  -d '{"force": true}'

# نشر الباك اند
cd backend && railway up

# نشر الفرونت اند
cd frontend && vercel --prod
```
