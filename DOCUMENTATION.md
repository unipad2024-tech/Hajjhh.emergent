# حُجّة (Hujjah) — التوثيق التقني الشامل
**نسخة:** 2.0 | **تاريخ:** فبراير 2026
**المعمارية المستهدفة:** Vercel (Frontend) + Railway (Backend) + Supabase/PostgreSQL (Database)

---

> هذا الملف يعمل كـ "موسوعة المشروع" — كافٍ لأي مطور لإعادة بناء حُجّة من الصفر.

---

## الفهرس

| # | القسم | الوصف |
|---|-------|-------|
| 1 | [نظرة عامة](#1-نظرة-عامة-project-overview) | ما هو المشروع وأهدافه |
| 2 | [تصميم UI/UX](#2-تصميم-uiux) | الألوان والخطوط والتخطيط |
| 3 | [معمارية الفرونت اند](#3-معمارية-الفرونت-اند) | React، الصفحات، المكونات |
| 4 | [معمارية الباك اند](#4-معمارية-الباك-اند) | FastAPI، الـ Models، المنطق |
| 5 | [قاعدة البيانات — Supabase](#5-قاعدة-البيانات--supabase-postgresql) | مخطط PostgreSQL الكامل |
| 6 | [نقاط الـ API](#6-نقاط-الـ-api-endpoints) | كل endpoint مع Request/Response |
| 7 | [نظام المصادقة](#7-نظام-المصادقة-authentication) | JWT، المستخدمون، الأدمن |
| 8 | [نظام الدفع](#8-نظام-الدفع-stripe) | Stripe، الخطط، Webhooks |
| 9 | [تكامل الذكاء الاصطناعي](#9-تكامل-الذكاء-الاصطناعي-gemini) | Google Gemini، توليد الأسئلة |
| 10 | [منطق اللعبة](#10-منطق-اللعبة-game-logic) | تدفق اللعبة الكامل |
| 11 | [إدارة الحالة](#11-إدارة-الحالة-state-management) | GameContext، localStorage |
| 12 | [الأمان](#12-الأمان-security) | الحماية، Rate Limiting، CORS |
| 13 | [DevOps والنشر](#13-devops-والنشر-deployment) | Vercel + Railway + Supabase |
| 14 | [هيكل الملفات](#14-هيكل-الملفات-file-structure) | شجرة المشروع الكاملة |
| 15 | [دليل إعادة البناء](#15-دليل-إعادة-البناء-rebuild-guide) | من الصفر خطوة بخطوة |
| 16 | [التوسع المستقبلي](#16-التوسع-المستقبلي-future-scaling) | 10K → 1M مستخدم |

---

## 1. نظرة عامة (Project Overview)

### ما هو حُجّة؟

**حُجّة** لعبة ترفيهية تنافسية على شكل مسابقة معلومات (Trivia)، مستوحاة من لعبة Jeopardy! الأمريكية، مصممة خصيصاً للتجمعات السعودية والعربية. تُلعب على شاشة تلفزيون أمام جمهور، بين فريقين في مواجهة مباشرة.

### الهدف من المشروع

| الهدف | التفصيل |
|-------|---------|
| **الترفيه** | تجربة لعب ممتعة تناسب التجمعات العائلية والاجتماعية |
| **SaaS** | منصة اشتراك: مجانية + مدفوعة (Premium) |
| **سهولة الاستخدام** | واجهة عربية بسيطة، RTL، خط Cairo |
| **التلفزيون** | مصممة للعرض على شاشة كبيرة |

### المستخدمون المستهدفون

```
┌─────────────────────────────────────────────────────────┐
│  ضيف (Guest)         │ يلعب مجاناً، قد تتكرر الأسئلة   │
│  مستخدم مجاني (Free) │ حساب مسجل، يتتبع عدد الألعاب    │
│  مستخدم مدفوع (Prem.)│ أسئلة لا تتكرر عالمياً          │
│  الأدمن (Admin)      │ CRUD كامل عبر لوحة تحكم          │
└─────────────────────────────────────────────────────────┘
```

### الحالة الراهنة

- **الفرونت اند:** مكتمل (React + Tailwind، RTL، 11 صفحة)
- **الباك اند:** مكتمل (FastAPI، 40+ endpoint)
- **قاعدة البيانات الحالية:** MongoDB (مرشحة للهجرة إلى Supabase)
- **البيانات:** 10 فئات + 450 سؤال
- **Stripe:** مفعّل (test keys)
- **Gemini AI:** مفعّل لتوليد الأسئلة

### المكدس التقني الحالي vs المستهدف

| المكون | الحالي | المستهدف |
|--------|--------|----------|
| Frontend | React (Emergent) | Vercel |
| Backend | FastAPI (Emergent) | Railway |
| Database | MongoDB | **Supabase (PostgreSQL)** |
| ORM | Motor (async MongoDB) | SQLAlchemy + asyncpg |

---

## 2. تصميم UI/UX

### أ. نظام الألوان

```css
/* المتغيرات الأساسية */
--color-primary:   #5B0E14;  /* بورغندي غامق — العلامة التجارية */
--color-secondary: #F1E194;  /* رمل ذهبي — التمييز والتفاصيل */
--color-dark-bg:   #0D1B0A;  /* أخضر داكن — الثيم الداكن */
--color-light-bg:  #F3EBD3;  /* بيج دافئ — الثيم الفاتح */
--color-score:     #F1E194;  /* لون النقاط */
--color-team1:     #1565C0;  /* أزرق الفريق الأول */
--color-team2:     #B71C1C;  /* أحمر الفريق الثاني */

/* ألوان درجات الصعوبة */
--diff-300: linear-gradient(145deg, #B8860B, #E8C026);  /* ذهبي */
--diff-600: linear-gradient(145deg, #8B4513, #CD7B3A);  /* برتقالي */
--diff-900: linear-gradient(145deg, #5B0E14, #9A1E28);  /* أحمر بورغندي */
```

### ب. الخطوط

```css
/* الخط الأساسي — Cairo */
@import url('https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;900&display=swap');

font-family: 'Cairo', sans-serif;
```

**سبب الاختيار:** Cairo مصمم خصيصاً للعربية، يدعم RTL، وله ثقل بصري قوي للعناوين الكبيرة على التلفزيون.

### ج. التخطيط (Layout)

```
الاتجاه: RTL (يمين إلى يسار)
التطبيق كله يستخدم: dir="rtl" على العنصر الجذر
```

**لوحة اللعب الرئيسية:**
```
┌─────────────────────────────────────────────────────────────┐
│           شريط النقاط (فريق 1 | الدور | فريق 2)           │
├────────┬────────┬────────┬────────┬────────┬────────────────┤
│ فئة 1  │ فئة 2  │ فئة 3  │ فئة 4  │ فئة 5  │   فئة 6       │
├────────┼────────┼────────┼────────┼────────┼────────────────┤
│  300   │  300   │  300   │  300   │  300   │   300          │
├────────┼────────┼────────┼────────┼────────┼────────────────┤
│  600   │  600   │  600   │  600   │  600   │   600          │
├────────┼────────┼────────┼────────┼────────┼────────────────┤
│  900   │  900   │  900   │  900   │  900   │   900          │
└────────┴────────┴────────┴────────┴────────┴────────────────┘
```

### د. الثيمات (Dark/Light Mode)

| الثيم | خلفية اللوحة | بطاقات الأسئلة | النص |
|-------|-------------|---------------|------|
| **فاتح** | تدرج بيج دافئ (#F3EBD3 → #B5C592) | أبيض شفاف | أخضر داكن |
| **داكن** | تدرج أخضر غامق (#1A2B18 → #172715) | أخضر داكن شفاف | أخضر فاتح |

### هـ. تصميم شاشة السؤال

```
┌─────────────────────────────────────────────────────┐
│  فريق 1: 1200     [الدور: فريق 1]     فريق 2: 900  │
│─────────────────────────────────────────────────────│
│                                                     │
│         ← نص السؤال كبير وواضح →                   │
│                 [صورة إذا كانت موجودة]              │
│                                                     │
│              ████ 01:05 ████                        │
│            (عداد تنازلي دائري)                      │
│                                                     │
│  [الإجابة]   [+300 فريق 1]  [+300 فريق 2]  [تخطي] │
└─────────────────────────────────────────────────────┘
```

---

## 3. معمارية الفرونت اند

### أ. التقنيات المستخدمة

| التقنية | الإصدار | الغرض |
|---------|---------|-------|
| React | 19.0 | مكتبة الواجهة |
| react-router-dom | 7.5 | التنقل بين الصفحات |
| Tailwind CSS | 3.4 | التصميم |
| axios | 1.8 | طلبات HTTP |
| lucide-react | 0.507 | الأيقونات |
| framer-motion | 12.35 | الأنيميشن |
| qrcode.react | 4.2 | QR Code للكلمة السرية |
| sonner | 2.0 | Toast notifications |
| recharts | 3.6 | رسوم بيانية (Analytics) |
| CRACO | 7.1 | webpack config override |

### ب. الصفحات والمسارات (Routes)

```javascript
// App.js
<Routes>
  <Route path="/"                  element={<HomePage />}          />
  <Route path="/login"             element={<LoginPage />}         />
  <Route path="/signup"            element={<SignupPage />}        />
  <Route path="/pricing"           element={<PricingPage />}       />
  <Route path="/payment/success"   element={<PaymentSuccessPage />}/>
  <Route path="/setup"             element={<TeamSetupPage />}     />
  <Route path="/categories"        element={<CategorySelectPage />}/>
  <Route path="/game"              element={<GameBoardPage />}     />
  <Route path="/question"          element={<QuestionPage />}      />
  <Route path="/secret/:questionId"element={<SecretWordPage />}    />
  <Route path="/admin"             element={<AdminLoginPage />}    />
  <Route path="/admin/dashboard"   element={<AdminDashboard />}   />
</Routes>
```

### ج. وصف كل صفحة

| الصفحة | المسار | الوصف | المكونات الرئيسية |
|--------|--------|-------|-----------------|
| `HomePage` | `/` | الشاشة الرئيسية، شرح اللعبة، CTA | بطاقة الترحيب، شريط المستخدم |
| `LoginPage` | `/login` | تسجيل الدخول بالإيميل والباسوورد | نموذج، لينك للتسجيل |
| `SignupPage` | `/signup` | إنشاء حساب جديد | نموذج، تحقق من كلمة المرور |
| `PricingPage` | `/pricing` | مقارنة خطط الاشتراك | 3 بطاقات (ضيف/مجاني/مدفوع) |
| `PaymentSuccessPage` | `/payment/success` | ما بعد الدفع، polling حتى يُؤكَّد | Spinner، نتيجة الحالة |
| `TeamSetupPage` | `/setup` | إدخال أسماء الفريقين | حقلان نصيان، زر المتابعة |
| `CategorySelectPage` | `/categories` | كل فريق يختار 3 فئات | شبكة الفئات، مؤشر التحديد |
| `GameBoardPage` | `/game` | لوحة Jeopardy الرئيسية | شريط النقاط، شبكة 6×3 |
| `QuestionPage` | `/question` | شاشة السؤال والعداد | عداد دائري، أزرار النقاط |
| `SecretWordPage` | `/secret/:id` | صفحة الكلمة السرية للموبايل (QR) | عرض الكلمة بالحجم الكبير |
| `AdminLoginPage` | `/admin` | دخول لوحة الإدارة بكلمة مرور | حقل كلمة المرور |
| `AdminDashboard` | `/admin/dashboard` | لوحة الإدارة الكاملة | 4 تبويبات رئيسية |

### د. تبويبات لوحة الإدارة

```
AdminDashboard
├── تبويب 1: الأسئلة    — CRUD كامل، فلترة بالفئة والصعوبة
├── تبويب 2: المستخدمون — قائمة المستخدمين، تعديل الاشتراك
├── تبويب 3: التحليلات  — إحصائيات المستخدمين، الإيرادات، الجلسات
├── تبويب 4: الإعدادات  — المؤقتات، وضع التجربة، الفئات المجانية
└── تبويب 5: مولّد AI   — توليد أسئلة بـ Gemini، معاينة قبل الحفظ
```

### هـ. إعداد CRACO (webpack override)

```javascript
// craco.config.js
const path = require("path");
module.exports = {
  webpack: {
    alias: {
      "@": path.resolve(__dirname, "src"),
    },
  },
};
```

**لماذا CRACO؟** لدعم `@/` كاختصار لـ `src/`، بدلاً من المسارات النسبية الطويلة.

---

## 4. معمارية الباك اند

### أ. التقنيات المستخدمة

| التقنية | الإصدار | الغرض |
|---------|---------|-------|
| FastAPI | 0.110.1 | إطار الـ API |
| Uvicorn | 0.25.0 | ASGI Server |
| Pydantic | 2.6+ | التحقق من البيانات |
| python-jose | 3.5 | JWT |
| passlib + bcrypt | 1.7 + 4.1 | تشفير كلمات المرور |
| httpx | — | طلبات HTTP (Gemini) |
| emergentintegrations | 0.1 | Stripe integration |
| python-multipart | 0.0.9 | رفع الملفات |
| Pillow | 12.1 | معالجة الصور |

**للهجرة إلى Supabase يُضاف:**

| التقنية | الغرض |
|---------|-------|
| SQLAlchemy[asyncio] | ORM غير متزامن |
| asyncpg | درايفر PostgreSQL |
| alembic | migrations |

### ب. هيكل server.py الحالي

```
server.py (1354 سطر)
│
├── [1-50]   Imports + Config + DB Connection
├── [50-140] Pydantic Models
│             ├── UserCreate, UserLogin, UserUpdate
│             ├── AdminLogin, AdminUserUpdate
│             ├── Category, CategoryCreate
│             ├── Question, QuestionCreate
│             ├── GameSessionCreate, GameSessionUpdate
│             ├── ScoreUpdate, CheckoutCreate, MarkAnswered
│
├── [140-182] Auth Helpers
│             ├── hash_pw(), verify_pw()
│             ├── create_token()
│             ├── get_admin() — Depends
│             ├── get_current_user() — Optional
│             └── require_user() — Depends
│
├── [182-270] User Auth Routes
│             ├── POST /api/auth/register
│             ├── POST /api/auth/login
│             ├── GET  /api/auth/me
│             └── PUT  /api/auth/me
│
├── [270-345] Admin Auth + Users + Analytics
│             ├── POST /api/admin/login
│             ├── GET  /api/admin/verify
│             ├── GET  /api/admin/users
│             ├── PUT  /api/admin/users/{id}
│             ├── DELETE /api/admin/users/{id}
│             ├── GET  /api/admin/analytics
│             ├── GET  /api/admin/sessions
│             └── GET  /api/admin/payments
│
├── [345-440] Categories CRUD
│             ├── GET    /api/categories
│             ├── GET    /api/free-categories
│             ├── POST   /api/categories
│             ├── PUT    /api/categories/{id}
│             └── DELETE /api/categories/{id}
│
├── [440-570] Questions CRUD
│             ├── GET    /api/questions
│             ├── GET    /api/questions/count
│             ├── GET    /api/questions/{id}
│             ├── POST   /api/questions
│             ├── PUT    /api/questions/{id}
│             ├── DELETE /api/questions/{id}
│             └── PATCH  /api/questions/{id}/experimental
│
├── [570-670] Game Session
│             ├── POST /api/game/session
│             ├── GET  /api/game/session/{id}
│             ├── PUT  /api/game/session/{id}
│             ├── POST /api/game/session/{id}/question
│             └── POST /api/game/session/{id}/score
│
├── [670-675] Secret Word
│             └── GET /api/secret/{question_id}
│
├── [675-675] Stripe Subscriptions
│             ├── GET  /api/subscription/plans
│             ├── POST /api/subscription/checkout
│             ├── GET  /api/subscription/status/{stripe_session_id}
│             └── POST /api/webhook/stripe
│
├── [675-1185] Seed Data (10 Categories + 450 Questions)
│
├── [1185-1225] Settings API
│             ├── GET /api/settings
│             └── PUT /api/settings
│
├── [1225-1250] Image Upload
│             └── POST /api/upload
│
└── [1250-1354] AI Question Generator
              ├── POST /api/ai/generate-questions
              └── POST /api/ai/save-questions
```

### ج. الـ Pydantic Models المهمة

```python
class UserCreate(BaseModel):
    email: str
    username: str
    password: str

class Category(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    description: str = ""
    icon: str = ""
    image_url: str = ""
    is_special: bool = False
    color: str = "#5B0E14"
    order: int = 0
    created_at: str = Field(default_factory=...)

class Question(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    category_id: str
    difficulty: int          # 300, 600, أو 900
    text: str
    answer: str
    image_url: str = ""
    answer_image_url: str = ""
    question_type: str = "text"   # "text" أو "secret_word"
    is_experimental: bool = False
    created_at: str = Field(default_factory=...)

class GameSessionCreate(BaseModel):
    team1_name: str
    team2_name: str
    user_id: Optional[str] = None
```

### د. الإعدادات الافتراضية (DEFAULT_SETTINGS)

```python
DEFAULT_SETTINGS = {
    "key": "game_settings",
    "default_timer": 65,                    # ثانية
    "word_timers": {
        "300": 80,                          # ولا كلمة سهل
        "600": 60,                          # ولا كلمة متوسط
        "900": 45                           # ولا كلمة صعب
    },
    "free_categories": ["cat_word", "cat_islamic", "cat_music",
                        "cat_flags", "cat_easy", "cat_science"],
    "trial_enabled": True,
    "trial_team1_categories": ["cat_flags", "cat_easy", "cat_word"],
    "trial_team2_categories": ["cat_islamic", "cat_science", "cat_music"],
    "trial_questions_only": False,
}
```

---

## 5. قاعدة البيانات — Supabase (PostgreSQL)

### أ. لماذا Supabase؟

| الميزة | MongoDB | Supabase |
|--------|---------|----------|
| النوع | NoSQL | SQL (PostgreSQL) |
| العلاقات | يدوية | Foreign Keys حقيقية |
| الاستعلامات | محدودة التعقيد | SQL كامل القوة |
| المصادقة المدمجة | لا | نعم (اختياري) |
| الـ Real-time | محدودة | مدمجة |
| الـ Row Level Security | لا | نعم |
| السعر | Atlas M0 مجاني | 500MB مجاني |
| الـ Storage | منفصل | مدمج |

---

### ب. مخطط قاعدة البيانات (Schema)

#### جدول `users`

```sql
CREATE TABLE users (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email                   TEXT UNIQUE NOT NULL,
    username                TEXT UNIQUE NOT NULL,
    password_hash           TEXT NOT NULL,
    subscription_type       TEXT NOT NULL DEFAULT 'free'
                            CHECK (subscription_type IN ('free', 'premium')),
    subscription_expires_at TIMESTAMPTZ,
    answered_question_ids   UUID[] DEFAULT '{}',
    game_count              INTEGER DEFAULT 0,
    created_at              TIMESTAMPTZ DEFAULT NOW(),
    last_active             TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_users_email    ON users(email);
CREATE INDEX idx_users_sub_type ON users(subscription_type);
```

#### جدول `categories`

```sql
CREATE TABLE categories (
    id          TEXT PRIMARY KEY,   -- مثال: 'cat_flags', 'cat_easy'
    name        TEXT NOT NULL,
    description TEXT DEFAULT '',
    icon        TEXT DEFAULT '',
    image_url   TEXT DEFAULT '',
    is_special  BOOLEAN DEFAULT FALSE,
    color       TEXT DEFAULT '#5B0E14',
    "order"     INTEGER DEFAULT 0,
    created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_categories_order ON categories("order");
```

#### جدول `questions`

```sql
CREATE TABLE questions (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    category_id      TEXT REFERENCES categories(id) ON DELETE CASCADE,
    difficulty       INTEGER NOT NULL
                     CHECK (difficulty IN (300, 600, 900)),
    text             TEXT NOT NULL,
    answer           TEXT NOT NULL,
    image_url        TEXT DEFAULT '',
    answer_image_url TEXT DEFAULT '',
    question_type    TEXT DEFAULT 'text'
                     CHECK (question_type IN ('text', 'secret_word')),
    is_experimental  BOOLEAN DEFAULT FALSE,
    created_at       TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_questions_category   ON questions(category_id);
CREATE INDEX idx_questions_difficulty ON questions(difficulty);
CREATE INDEX idx_questions_cat_diff   ON questions(category_id, difficulty);
CREATE INDEX idx_questions_experimental ON questions(is_experimental) WHERE is_experimental = TRUE;
```

#### جدول `game_sessions`

```sql
CREATE TABLE game_sessions (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    team1_name        TEXT NOT NULL,
    team2_name        TEXT NOT NULL,
    team1_score       INTEGER DEFAULT 0,
    team2_score       INTEGER DEFAULT 0,
    team1_categories  TEXT[] DEFAULT '{}',
    team2_categories  TEXT[] DEFAULT '{}',
    used_questions    UUID[] DEFAULT '{}',
    user_id           UUID REFERENCES users(id) ON DELETE SET NULL,
    is_trial          BOOLEAN DEFAULT TRUE,
    status            TEXT DEFAULT 'setup'
                      CHECK (status IN ('setup', 'playing', 'finished')),
    created_at        TIMESTAMPTZ DEFAULT NOW(),
    updated_at        TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_sessions_user_id   ON game_sessions(user_id);
CREATE INDEX idx_sessions_status    ON game_sessions(status);
CREATE INDEX idx_sessions_created   ON game_sessions(created_at DESC);
```

#### جدول `payment_transactions`

```sql
CREATE TABLE payment_transactions (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id      TEXT UNIQUE,            -- Stripe checkout session ID
    user_id         UUID REFERENCES users(id) ON DELETE SET NULL,
    email           TEXT,
    plan_id         TEXT,                   -- 'monthly' أو 'annual'
    amount          NUMERIC(10, 2),
    currency        TEXT DEFAULT 'sar',
    payment_status  TEXT DEFAULT 'pending',
    status          TEXT DEFAULT 'initiated',
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_payments_user_id   ON payment_transactions(user_id);
CREATE INDEX idx_payments_status    ON payment_transactions(payment_status);
```

#### جدول `settings` (صف واحد دائماً)

```sql
CREATE TABLE settings (
    id                      INTEGER PRIMARY KEY DEFAULT 1,
    default_timer           INTEGER DEFAULT 65,
    word_timers             JSONB DEFAULT '{"300": 80, "600": 60, "900": 45}',
    free_categories         TEXT[] DEFAULT ARRAY[
        'cat_word', 'cat_islamic', 'cat_music',
        'cat_flags', 'cat_easy', 'cat_science'
    ],
    trial_enabled           BOOLEAN DEFAULT TRUE,
    trial_team1_categories  TEXT[] DEFAULT ARRAY['cat_flags', 'cat_easy', 'cat_word'],
    trial_team2_categories  TEXT[] DEFAULT ARRAY['cat_islamic', 'cat_science', 'cat_music'],
    trial_questions_only    BOOLEAN DEFAULT FALSE,
    updated_at              TIMESTAMPTZ DEFAULT NOW(),

    CONSTRAINT single_settings_row CHECK (id = 1)
);

-- أدخل الصف الافتراضي مرة واحدة:
INSERT INTO settings (id) VALUES (1) ON CONFLICT DO NOTHING;
```

---

### ج. مقارنة MongoDB vs PostgreSQL في الكود

#### مثال 1: جلب السؤال التالي

**MongoDB (الحالي):**
```python
base_q = {"category_id": cat_id, "difficulty": diff, "id": {"$nin": exclude_ids}}
available = await db.questions.find(base_q, {"_id": 0}).to_list(1000)
question = random.choice(available)
```

**PostgreSQL (الجديد):**
```python
# باستخدام SQLAlchemy
result = await db.execute(
    select(Question)
    .where(
        Question.category_id == cat_id,
        Question.difficulty == diff,
        Question.id.notin_(exclude_ids)
    )
    .order_by(func.random())
    .limit(1)
)
question = result.scalar_one_or_none()
```

#### مثال 2: تحديث النقاط

**MongoDB:**
```python
await db.game_sessions.update_one(
    {"id": session_id},
    {"$set": {field: new_score}}
)
```

**PostgreSQL:**
```python
await db.execute(
    update(GameSession)
    .where(GameSession.id == session_id)
    .values(**{field: new_score, "updated_at": datetime.now(timezone.utc)})
)
await db.commit()
```

---

### د. الاتصال بـ Supabase

**متغير البيئة المطلوب:**

```env
# backend/.env
DATABASE_URL=postgresql+asyncpg://postgres.[project-ref]:[password]@aws-0-[region].pooler.supabase.com:5432/postgres
```

**كود الاتصال:**

```python
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker

engine = create_async_engine(
    os.environ["DATABASE_URL"],
    pool_pre_ping=True,
    pool_size=10,
    max_overflow=20
)

AsyncSessionLocal = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

async def get_db():
    async with AsyncSessionLocal() as session:
        yield session
```

---

### هـ. الهجرة من MongoDB إلى Supabase (خطوات عملية)

```bash
# 1. صدّر بيانات MongoDB
mongoexport --uri="$MONGO_URL" --db=hujjah_db \
  --collection=categories --out=categories.json
mongoexport ... --collection=questions --out=questions.json
mongoexport ... --collection=users --out=users.json

# 2. أنشئ مشروع Supabase على supabase.com
# 3. نفّذ ملف schema.sql في Supabase SQL Editor
# 4. اكتب سكريبت Python لتحويل JSON إلى PostgreSQL

# migration.py
import json, asyncpg, asyncio

async def migrate():
    conn = await asyncpg.connect(DATABASE_URL)
    
    with open("categories.json") as f:
        for line in f:
            doc = json.loads(line)
            await conn.execute("""
                INSERT INTO categories (id, name, description, icon, image_url,
                    is_special, color, "order", created_at)
                VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
                ON CONFLICT (id) DO NOTHING
            """, doc["id"], doc["name"], doc.get("description",""),
                doc.get("icon",""), doc.get("image_url",""),
                doc.get("is_special",False), doc.get("color","#5B0E14"),
                doc.get("order",0), doc.get("created_at"))
    
    # نفس الشيء للـ questions و users
    print("Migration complete!")

asyncio.run(migrate())
```

---

## 6. نقاط الـ API (Endpoints)

جميع الـ endpoints مسبوقة بـ `/api`

### أ. المصادقة

#### `POST /api/auth/register`

```json
// Request Body
{
  "email": "user@example.com",
  "username": "ahmed123",
  "password": "mypassword123"
}

// Response 200
{
  "token": "eyJhbGc...",
  "user": {
    "id": "uuid",
    "email": "user@example.com",
    "username": "ahmed123",
    "subscription_type": "free",
    "game_count": 0,
    "created_at": "2026-02-01T..."
  }
}

// Errors
// 400: كلمة المرور قصيرة (أقل من 6 أحرف)
// 409: البريد أو اسم المستخدم موجود
```

#### `POST /api/auth/login`

```json
// Request Body
{ "email": "user@example.com", "password": "mypassword123" }

// Response 200
{ "token": "eyJhbGc...", "user": { ...same as register... } }

// Errors
// 401: البريد أو كلمة المرور غلط
```

#### `GET /api/auth/me`

```
// Headers: Authorization: Bearer <token>

// Response 200
{
  "id": "uuid",
  "email": "user@example.com",
  "username": "ahmed123",
  "subscription_type": "free",  // أو "premium"
  "subscription_expires_at": null,
  "answered_count": 42,
  "game_count": 15,
  "created_at": "...",
  "last_active": "..."
}
```

---

### ب. الأدمن

#### `POST /api/admin/login`

```json
// Request Body
{ "password": "hujjah2024" }

// Response 200
{ "token": "eyJhbGc..." }   // صالح 48 ساعة

// Error 401: كلمة المرور غلط
```

#### `GET /api/admin/analytics`

```json
// Headers: Authorization: Bearer <admin_token>

// Response 200
{
  "users": {
    "total": 250,
    "premium": 30,
    "free": 220,
    "recent_7d": 12
  },
  "questions": {
    "total": 450,
    "by_category": [
      { "id": "cat_flags", "name": "اعلام دول", "count": 45 },
      ...
    ]
  },
  "sessions": {
    "total": 1500,
    "active_24h": 8
  },
  "revenue": {
    "total": 450.00,
    "currency": "USD",
    "recent_transactions": [...]
  }
}
```

---

### ج. الفئات

#### `GET /api/categories`

```json
// Response 200 — مرتبة حسب "order"
[
  {
    "id": "cat_flags",
    "name": "اعلام دول",
    "icon": "🏳️",
    "image_url": "https://...",
    "is_special": false,
    "color": "#166534",
    "order": 1
  },
  ...
]
```

#### `GET /api/free-categories`

```json
// Response 200
{
  "trial_enabled": true,
  "trial_team1_categories": ["cat_flags", "cat_easy", "cat_word"],
  "trial_team2_categories": ["cat_islamic", "cat_science", "cat_music"],
  "team1_categories": [ { ...category objects... } ],
  "team2_categories": [ { ...category objects... } ],
  "category_ids": ["cat_flags", "cat_easy", "cat_word", "cat_islamic", "cat_science", "cat_music"],
  "categories": [ { ...all category objects... } ]
}
```

#### `POST /api/categories` (أدمن فقط)

```json
// Request Body
{
  "name": "تاريخ",
  "description": "أسئلة تاريخية",
  "icon": "📜",
  "image_url": "https://...",
  "is_special": false,
  "color": "#1E3A5F",
  "order": 11
}

// Response 200 — الفئة المنشأة مع الـ id
```

---

### د. الأسئلة

#### `GET /api/questions`

```
// Query params (اختيارية):
// ?category_id=cat_flags
// ?difficulty=300

// Response 200 — مصفوفة الأسئلة
[
  {
    "id": "uuid",
    "category_id": "cat_flags",
    "difficulty": 300,
    "text": "علم أي دولة هذا؟",
    "answer": "اليابان",
    "image_url": "https://flagcdn.com/w320/jp.png",
    "answer_image_url": "",
    "question_type": "text",
    "is_experimental": false,
    "created_at": "..."
  },
  ...
]
```

#### `PATCH /api/questions/{id}/experimental` (أدمن فقط)

```json
// Request Body
{ "is_experimental": true }

// Response 200
{ "id": "uuid", "is_experimental": true }
```

---

### هـ. جلسة اللعب

#### `POST /api/game/session`

```json
// Request Body
{
  "team1_name": "الفريق الأحمر",
  "team2_name": "الفريق الأزرق",
  "user_id": "uuid-or-null"    // اختياري
}
// Headers (اختياري): Authorization: Bearer <token>

// Response 200
{
  "id": "session-uuid",
  "team1_name": "الفريق الأحمر",
  "team2_name": "الفريق الأزرق",
  "team1_score": 0,
  "team2_score": 0,
  "team1_categories": [],
  "team2_categories": [],
  "used_questions": [],
  "is_trial": true,    // false للـ premium فقط
  "status": "setup",
  "created_at": "..."
}
```

#### `POST /api/game/session/{id}/question`

```
// Query params:
// ?category_id=cat_flags&difficulty=300
// Headers (اختياري): Authorization: Bearer <token>

// Response 200 — سؤال عشوائي
{
  "id": "question-uuid",
  "category_id": "cat_flags",
  "difficulty": 300,
  "text": "علم أي دولة هذا؟",
  "answer": "اليابان",
  "image_url": "https://flagcdn.com/w320/jp.png",
  "question_type": "text"
}

// Error 404: لا توجد أسئلة لهذه الفئة/الصعوبة
```

#### `POST /api/game/session/{id}/score`

```json
// Request Body
{
  "team": 1,       // 1 أو 2
  "points": 300    // يمكن أن تكون سالبة (خصم نقاط)
}

// Response 200
{
  "team1_score": 600,
  "team2_score": 300
}
```

---

### و. الاشتراكات (Stripe)

#### `GET /api/subscription/plans`

```json
// Response 200
[
  {
    "id": "monthly",
    "name": "Premium شهري",
    "amount": 29.99,
    "currency": "sar",
    "days": 30
  },
  {
    "id": "annual",
    "name": "Premium سنوي",
    "amount": 239.99,
    "currency": "sar",
    "days": 365
  }
]
```

#### `POST /api/subscription/checkout`

```json
// Headers: Authorization: Bearer <user_token>
// Request Body
{
  "plan_id": "monthly",
  "origin_url": "https://yourapp.vercel.app"
}

// Response 200
{
  "url": "https://checkout.stripe.com/pay/cs_...",
  "session_id": "cs_test_..."
}
```

---

### ز. الإعدادات

#### `GET /api/settings`

```json
// Response 200
{
  "default_timer": 65,
  "word_timers": { "300": 80, "600": 60, "900": 45 },
  "trial_enabled": true,
  "trial_team1_categories": ["cat_flags", "cat_easy", "cat_word"],
  "trial_team2_categories": ["cat_islamic", "cat_science", "cat_music"],
  "trial_questions_only": false
}
```

#### `PUT /api/settings` (أدمن فقط)

```json
// Request Body (أرسل فقط ما تريد تغييره)
{
  "default_timer": 75,
  "trial_enabled": false
}
```

---

### ح. رفع الصور

#### `POST /api/upload` (أدمن فقط)

```
// Content-Type: multipart/form-data
// Field: file (PNG, JPG, WEBP — حد أقصى 5MB)

// Response 200
{
  "url": "https://backend.railway.app/api/static/uploads/uuid.png",
  "filename": "uuid.png"
}
```

---

### ط. الذكاء الاصطناعي

#### `POST /api/ai/generate-questions` (أدمن فقط)

```json
// Request Body
{
  "category_id": "cat_saudi",
  "difficulty": 600,       // أو "medium" أو "متوسط"
  "count": 10              // حد أقصى 20
}

// Response 200
{
  "questions": [
    {
      "id": "uuid",
      "category_id": "cat_saudi",
      "difficulty": 600,
      "text": "ما اسم مشروع المدينة المستقبلية في السعودية؟",
      "answer": "نيوم",
      "is_experimental": true
    },
    ...
  ],
  "count": 10
}
```

#### `POST /api/ai/save-questions` (أدمن فقط)

```json
// Request Body
{ "questions": [ { ...question objects from generate... } ] }

// Response 200
{ "message": "تم حفظ 10 سؤال", "count": 10 }
```

---

## 7. نظام المصادقة (Authentication)

### أ. نظرة عامة

التطبيق يستخدم **نظامين مستقلين** من JWT:

```
┌──────────────────────────────────────────────────────┐
│  المستخدم العادي                                     │
│  POST /api/auth/login → JWT (role: "user", 24h)     │
│  يُرسل في Header: Authorization: Bearer <token>      │
├──────────────────────────────────────────────────────┤
│  الأدمن                                              │
│  POST /api/admin/login → JWT (role: "admin", 48h)   │
│  يُرسل في Header: Authorization: Bearer <token>      │
└──────────────────────────────────────────────────────┘
```

### ب. بنية JWT Token

```python
# للمستخدم العادي
{
  "sub":  "user-uuid",
  "role": "user",
  "email": "user@example.com",
  "exp":  1735689600   # timestamp الانتهاء
}

# للأدمن
{
  "sub":  "admin",
  "role": "admin",
  "exp":  1735776000
}
```

### ج. كود المصادقة

```python
SECRET_KEY = os.environ.get('JWT_SECRET_KEY')
ALGORITHM  = "HS256"

def create_token(payload: dict, expires_hours: int = 24) -> str:
    p = {**payload, "exp": datetime.now(timezone.utc) + timedelta(hours=expires_hours)}
    return jwt.encode(p, SECRET_KEY, algorithm=ALGORITHM)

# Dependency للأدمن
async def get_admin(authorization: Optional[str] = Header(None)):
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(401, "غير مصرح")
    data = jwt.decode(authorization.split(" ")[1], SECRET_KEY, algorithms=[ALGORITHM])
    if data.get("role") != "admin":
        raise HTTPException(403, "غير مصرح")
    return True

# Dependency للمستخدم (لا يرفع إذا لم يكن مسجلاً)
async def get_current_user(authorization: Optional[str] = Header(None)):
    if not authorization: return None
    data = jwt.decode(...)
    user = await db.users.find_one({"id": data["sub"]})
    return user   # أو None

# Dependency للمستخدم (يرفع إذا لم يكن مسجلاً)
async def require_user(authorization: Optional[str] = Header(None)):
    user = await get_current_user(authorization)
    if not user:
        raise HTTPException(401, "يجب تسجيل الدخول")
    return user
```

### د. تخزين الـ Token في الفرونت اند

```javascript
// GameContext.js
const loginUser = async (email, password) => {
  const { data } = await axios.post(`${API}/auth/login`, { email, password });
  setCurrentUser(data.user);
  setUserToken(data.token);
  localStorage.setItem("hujjah_user", JSON.stringify(data.user));
  localStorage.setItem("hujjah_user_token", data.token);
};
```

**مفاتيح localStorage:**

| المفتاح | القيمة | الغرض |
|---------|--------|-------|
| `hujjah_user` | JSON للمستخدم | بيانات المستخدم الحالي |
| `hujjah_user_token` | JWT string | token المصادقة |
| `hujjah_session` | JSON للجلسة | جلسة اللعبة الحالية |
| `hujjah_turn` | "1" أو "2" | دور اللعب الحالي |
| `hujjah_dark` | "true"/"false" | حالة الثيم |

### هـ. تشفير كلمة المرور

```python
from passlib.context import CryptContext
pwd_ctx = CryptContext(schemes=["bcrypt"], deprecated="auto")

# تشفير (عند التسجيل)
hashed = pwd_ctx.hash(plain_password)   # bcrypt تلقائياً

# تحقق (عند الدخول)
is_valid = pwd_ctx.verify(plain_password, hashed_from_db)
```

---

## 8. نظام الدفع (Stripe)

### أ. خطط الاشتراك

```python
SUBSCRIPTION_PLANS = {
    "monthly": {
        "name":     "Premium شهري",
        "amount":   29.99,
        "currency": "sar",
        "days":     30
    },
    "annual": {
        "name":     "Premium سنوي",
        "amount":   239.99,
        "currency": "sar",
        "days":     365
    },
}
```

### ب. تدفق الدفع الكامل

```
┌─────────────────────────────────────────────────────────────────┐
│                                                                 │
│  1. المستخدم يضغط "اشتراك" في /pricing                       │
│           ↓                                                     │
│  2. POST /api/subscription/checkout                            │
│     → ينشئ Stripe Checkout Session                             │
│     → يحفظ txn في قاعدة البيانات (status: pending)            │
│     → يُرجع { url: "https://checkout.stripe.com/..." }        │
│           ↓                                                     │
│  3. Frontend: window.location.href = url                       │
│     → المستخدم يملأ بياناته على Stripe                        │
│           ↓                                                     │
│  4. Stripe يُعيد التوجيه إلى:                                 │
│     /payment/success?session_id=cs_test_...                    │
│           ↓                                                     │
│  5. PaymentSuccessPage: polling كل 3 ثواني                    │
│     GET /api/subscription/status/{session_id}                  │
│     → يتحقق من Stripe API                                      │
│     → إذا "paid": يُحدّث المستخدم إلى premium                 │
│           ↓                                                     │
│  6. كذلك: POST /api/webhook/stripe (real-time)                │
│     → Stripe يُرسل event مباشرة                               │
│     → يُحدّث قاعدة البيانات فوراً                              │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### ج. Webhook Stripe

```python
@api_router.post("/webhook/stripe")
async def stripe_webhook(request: Request):
    body = await request.body()
    sig  = request.headers.get("Stripe-Signature", "")
    stripe = StripeCheckout(api_key=STRIPE_API_KEY, webhook_url="")
    
    event = await stripe.handle_webhook(body, sig)
    
    if event.payment_status == "paid":
        # ابحث عن الـ transaction
        txn = await db.payment_transactions.find_one(
            {"session_id": event.session_id}
        )
        if txn:
            # حدّث المستخدم إلى premium
            expires = (datetime.now(timezone.utc) + timedelta(days=30)).isoformat()
            await db.users.update_one(
                {"id": txn["user_id"]},
                {"$set": {"subscription_type": "premium",
                          "subscription_expires_at": expires}}
            )
```

### د. متغيرات Stripe البيئية

```env
STRIPE_API_KEY=sk_test_...    # اختبار
# للإنتاج: STRIPE_API_KEY=sk_live_...
```

**للحصول على مفتاح Stripe:**
1. اذهب لـ https://dashboard.stripe.com
2. Developers → API Keys
3. انسخ "Secret key"

---

## 9. تكامل الذكاء الاصطناعي (Gemini)

### أ. النموذج المستخدم

```
gemini-flash-lite-latest
```

**لماذا هذا النموذج؟**
- سريع جداً ومناسب لتوليد النصوص
- مجاني ضمن حد معين
- يفهم العربية بشكل ممتاز

### ب. كود التوليد

```python
async def _gemini_generate(prompt: str) -> str:
    api_key = os.environ.get("GEMINI_API_KEY", "")
    url = f"https://generativelanguage.googleapis.com/v1beta/" \
          f"models/gemini-flash-lite-latest:generateContent?key={api_key}"
    payload = {"contents": [{"parts": [{"text": prompt}]}]}
    
    async with httpx.AsyncClient(timeout=60) as client:
        r = await client.post(url, json=payload)
    
    return r.json()["candidates"][0]["content"]["parts"][0]["text"]
```

### ج. الـ Prompt المستخدم

```python
prompt = f"""أنشئ بالضبط {count} سؤال ترفيهي لفئة "{cat_name}" بمستوى ({diff_label}).

شروط أساسية:
- اكتب باللغة العربية الفصيحة أو العامية السعودية
- الأسئلة حماسية، متنوعة، وغير متكررة
- الإجابة قصيرة جداً: كلمة أو كلمتان فقط
- لا تُضِف أي شرح أو ترقيم خارج الـ JSON

أرجع JSON array فقط بالشكل التالي:
[{{"text":"نص السؤال؟","answer":"الإجابة"}}]"""
```

### د. تدفق توليد الأسئلة

```
1. الأدمن يختار: فئة + صعوبة + عدد الأسئلة
2. POST /api/ai/generate-questions
3. Gemini يُنشئ الأسئلة
4. الـ API يُرجعها للأدمن للمعاينة (is_experimental: true)
5. الأدمن يراجع ويعدّل إذا لزم
6. POST /api/ai/save-questions → تُحفظ في قاعدة البيانات
```

### هـ. الحصول على مفتاح Gemini

1. اذهب لـ https://aistudio.google.com/app/apikey
2. اضغط "Create API Key"
3. انسخ المفتاح وضعه في `backend/.env`:
   ```env
   GEMINI_API_KEY=AIzaSy...
   ```

---

## 10. منطق اللعبة (Game Logic)

### أ. تدفق اللعبة الكاملة

```
الشاشة الرئيسية (/)
        ↓ "ابدأ اللعب"
إعداد الفريقين (/setup)
  ← أدخل اسم الفريق 1 واسم الفريق 2
        ↓
اختيار الفئات (/categories)
  ← الفريق 1 يختار 3 فئات
  ← الفريق 2 يختار 3 فئات
  ← يُحدَّث session بـ team1_categories + team2_categories
        ↓
لوحة اللعب (/game)
  ← شبكة 6 أعمدة × 3 صفوف (300/600/900)
  ← شريط النقاط + مؤشر الدور
  ← الفريق الحالي يختار بطاقة
        ↓
شاشة السؤال (/question?cat=...&diff=...)
  ← POST /api/game/session/{id}/question
  ← عداد تنازلي
  ← عند الإجابة: أزرار إعطاء النقاط
  ← POST /api/game/session/{id}/score
        ↓
العودة للوحة اللعب
  ← البطاقة تُعلَّم كـ "مستخدمة"
  ← يتبادل الدور
        ↓
عند انتهاء كل البطاقات:
  ← إعلان الفائز + confetti
```

### ب. نظام الدور (Turn System)

```javascript
// GameContext.js
const [currentTurn, setCurrentTurn] = useState(1);  // 1 أو 2

const switchTurn = () => {
    const next = currentTurn === 1 ? 2 : 1;
    setCurrentTurn(next);
    localStorage.setItem("hujjah_turn", String(next));
};
```

### ج. فئة "ولا كلمة" (Secret Word)

```
بطاقة "ولا كلمة" → تفتح شاشة السؤال
        ↓
question_type === "secret_word"
        ↓
الفريق الوصف (Describing Team) يرى:
  ← "وصّف الكلمة لفريقك بدون ما تقول الكلمة!"
  ← كود QR → يوجه لـ /secret/{question_id}
        ↓
الفريق الآخر يفتح QR بالجوال:
  ← يرى الكلمة بحجم كبير
  ← عداد خاص (80/60/45 ثانية حسب الصعوبة)
```

### د. نظام الأسئلة للمستخدمين المدفوعين

```python
# عند جلب السؤال
user = await get_current_user(authorization)
is_premium = user and user.get("subscription_type") == "premium"

if is_premium:
    # اخرج كل الأسئلة التي أجاب عليها هذا المستخدم من قبل
    exclude_ids += user.get("answered_question_ids", [])
    
    # سجّل هذا السؤال كـ "مُجاب عليه"
    await db.users.update_one(
        {"id": user["id"]},
        {"$addToSet": {"answered_question_ids": question["id"]}}
    )
```

### هـ. نظام التجربة (Trial Mode)

```
المستخدم غير المدفوع (is_trial: true):
  ← يلعب فقط بالفئات المحددة من الأدمن
  ← إذا trial_questions_only=true: يرى فقط الأسئلة المعلّمة بـ is_experimental=true
  ← إذا trial_questions_only=false: يرى كل الأسئلة
```

---

## 11. إدارة الحالة (State Management)

### أ. GameContext

```javascript
// context/GameContext.js — الـ state المشترك
const GameProvider = ({ children }) => {
  const [session, setSession]           = useState(null);    // جلسة اللعبة
  const [loading, setLoading]           = useState(false);   // حالة التحميل
  const [currentUser, setCurrentUser]   = useState(null);    // المستخدم المسجّل
  const [userToken, setUserToken]       = useState(null);    // JWT token
  const [darkMode, setDarkMode]         = useState(false);   // الثيم
  const [gameSettings, setGameSettings] = useState({...});   // إعدادات اللعبة
  const [currentTurn, setCurrentTurn]   = useState(1);       // الدور الحالي
```

### ب. الدوال المصدَّرة من GameContext

| الدالة | الوصف |
|--------|-------|
| `createSession(t1, t2)` | إنشاء جلسة لعبة جديدة |
| `updateSession(updates)` | تحديث بيانات الجلسة |
| `getNextQuestion(cat, diff)` | جلب سؤال عشوائي |
| `updateScore(team, points)` | تحديث نقاط فريق |
| `resetGame()` | إعادة ضبط اللعبة |
| `loginUser(email, pass)` | تسجيل الدخول |
| `registerUser(email, user, pass)` | إنشاء حساب |
| `logoutUser()` | تسجيل الخروج |
| `refreshUser()` | تحديث بيانات المستخدم |
| `toggleDarkMode()` | تبديل الثيم |
| `switchTurn()` | تبديل الدور |
| `resetTurn()` | إعادة ضبط الدور |

### ج. استخدام GameContext في الصفحات

```javascript
// في أي صفحة
import { useGame } from "@/context/GameContext";

function GameBoardPage() {
  const {
    session,
    currentUser,
    currentTurn,
    darkMode,
    gameSettings,
    getNextQuestion,
    updateScore,
    switchTurn
  } = useGame();
  
  // ...
}
```

---

## 12. الأمان (Security)

### أ. حماية نقاط الـ API

**الـ endpoints المحمية بـ `get_admin` (أدمن فقط):**
```
POST   /api/admin/login
GET    /api/admin/users
PUT    /api/admin/users/{id}
DELETE /api/admin/users/{id}
GET    /api/admin/analytics
PUT    /api/settings
POST   /api/upload
POST   /api/categories
PUT    /api/categories/{id}
DELETE /api/categories/{id}
POST   /api/questions
PUT    /api/questions/{id}
DELETE /api/questions/{id}
PATCH  /api/questions/{id}/experimental
POST   /api/ai/generate-questions
POST   /api/ai/save-questions
POST   /api/seed
```

**الـ endpoints المحمية بـ `require_user` (مستخدم مسجّل):**
```
GET  /api/auth/me
PUT  /api/auth/me
POST /api/subscription/checkout
GET  /api/subscription/status/{id}
```

**الـ endpoints العامة:**
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
POST /api/game/session/{id}/score
GET  /api/secret/{question_id}
```

### ب. CORS Configuration

```python
app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)
```

**للإنتاج — غيّر `CORS_ORIGINS` إلى:**
```env
CORS_ORIGINS=https://your-hujjah.vercel.app
```

### ج. التحقق من صحة المدخلات

```python
# Pydantic يتحقق تلقائياً من الأنواع
class UserCreate(BaseModel):
    email: str
    username: str
    password: str   # يتم التحقق من الطول يدوياً

@api_router.post("/auth/register")
async def register(body: UserCreate):
    if len(body.password) < 6:
        raise HTTPException(400, "كلمة المرور قصيرة")
    if len(body.username) < 2:
        raise HTTPException(400, "اسم المستخدم قصير")
```

**التحقق من الصور:**
```python
ALLOWED_EXTS = {"jpg", "jpeg", "png", "webp"}

if ext not in ALLOWED_EXTS:
    raise HTTPException(400, "PNG/JPG/WEBP فقط")
if file.size > 5 * 1024 * 1024:   # 5MB
    raise HTTPException(400, "الحجم الأقصى 5MB")
```

### د. Rate Limiting (توصية للإنتاج)

```python
# أضف في server.py
from slowapi import Limiter
from slowapi.util import get_remote_address

limiter = Limiter(key_func=get_remote_address)
app.state.limiter = limiter

@api_router.post("/auth/login")
@limiter.limit("5/minute")    # 5 محاولات كل دقيقة
async def login(request: Request, body: UserLogin):
    ...

@api_router.post("/ai/generate-questions")
@limiter.limit("10/hour")     # 10 طلبات كل ساعة
async def generate_questions(request: Request, body: dict, ...):
    ...
```

### هـ. حماية XSS/CSRF

- **XSS:** React يهرّب HTML تلقائياً في JSX، لا استخدام لـ `dangerouslySetInnerHTML`
- **CSRF:** الـ token في `localStorage` وليس Cookie → أقل عرضة لـ CSRF
- **SQL Injection:** استخدام ORM (SQLAlchemy) بدلاً من استعلامات خام
- **Secrets:** كل المفاتيح في `.env` ولا تُرفع لـ GitHub

---

## 13. DevOps والنشر (Deployment)

### أ. معمارية النشر المستهدفة

```
المستخدم (متصفح)
       │
       ▼
  ┌─────────────┐
  │   Vercel    │  CDN عالمي
  │  (Frontend) │  React Build
  │  HTTPS :443 │
  └──────┬──────┘
         │ API calls إلى /api/*
         ▼
  ┌─────────────┐
  │   Railway   │  Cloud Backend
  │  (Backend)  │  FastAPI / uvicorn
  │  PORT: $PORT│
  └──────┬──────┘
         │
         ▼
  ┌─────────────┐
  │  Supabase   │  PostgreSQL مُدار
  │ (Database)  │  AWS us-east-1
  │   :5432     │
  └─────────────┘
```

---

### ب. نشر Supabase (قاعدة البيانات)

**الخطوات:**

1. **أنشئ حساباً** على https://supabase.com

2. **أنشئ مشروعاً جديداً:**
   - اضغط "New Project"
   - اختر اسم المشروع: `hujjah-db`
   - اختر كلمة مرور قوية للـ database
   - اختر region: `Southeast Asia (Singapore)` أو `West EU (Ireland)`
   - انتظر ~2 دقيقة

3. **نفّذ Schema:**
   - اذهب لـ SQL Editor في Supabase
   - انسخ والصق كل جداول القسم 5 هنا
   - اضغط "Run"

4. **احصل على Connection String:**
   - اذهب لـ Settings → Database
   - انسخ "Connection String" → نوع **"URI"**
   - اضغط "Transaction Pooler" للـ production
   - الرابط يبدو هكذا:
     ```
     postgresql://postgres.[ref]:[password]@aws-0-[region].pooler.supabase.com:5432/postgres
     ```
   - للـ asyncpg أضف `+asyncpg` بعد `postgresql`:
     ```
     postgresql+asyncpg://postgres.[ref]:[password]@...
     ```

5. **أضف البيانات الابتدائية:**
   ```bash
   # بعد رفع الباك اند على Railway:
   curl -X POST https://your-backend.up.railway.app/api/seed \
     -H "Authorization: Bearer <admin_token>"
   ```

---

### ج. نشر الباك اند على Railway

**الخطوات:**

1. **أنشئ حساباً** على https://railway.app

2. **أنشئ مشروعاً جديداً:**
   - "New Project" → "Deploy from GitHub repo"
   - اختر الـ repository

3. **حدّد الـ Root Directory:**
   - في إعدادات الـ service: اضبط `Root Directory` إلى `backend`

4. **اضبط متغيرات البيئة** (Variables → Add Variable):
   ```env
   DATABASE_URL     = postgresql+asyncpg://postgres.[ref]:[pass]@...
   JWT_SECRET_KEY   = [نص عشوائي طويل مثل: hujjah_super_secret_2026_xyz]
   ADMIN_PASSWORD   = [اختر كلمة مرور قوية]
   CORS_ORIGINS     = https://your-hujjah.vercel.app
   STRIPE_API_KEY   = sk_test_...
   GEMINI_API_KEY   = AIzaSy...
   ```

5. **تحقق من ملف `railway.json`:**
   ```json
   {
     "build":  { "builder": "NIXPACKS" },
     "deploy": {
       "startCommand": "uvicorn server:app --host 0.0.0.0 --port $PORT",
       "restartPolicyType": "ON_FAILURE",
       "restartPolicyMaxRetries": 5
     }
   }
   ```

6. **وتحقق من `Procfile`:**
   ```
   web: uvicorn server:app --host 0.0.0.0 --port $PORT
   ```

7. **احصل على الرابط:**
   - بعد النشر الناجح، Railway يُعطيك رابطاً مثل:
     `https://hujjah-backend-production.up.railway.app`

---

### د. نشر الفرونت اند على Vercel

**الخطوات:**

1. **أنشئ حساباً** على https://vercel.com

2. **استورد المشروع:**
   - "New Project" → "Import Git Repository"
   - اختر الـ repository

3. **اضبط الإعدادات:**
   - **Framework Preset:** Create React App
   - **Root Directory:** `frontend`
   - **Build Command:** `yarn build`
   - **Output Directory:** `build`

4. **أضف متغير البيئة:**
   ```
   REACT_APP_BACKEND_URL = https://your-backend.up.railway.app
   ```

5. **اضغط Deploy**

6. **تحقق من `vercel.json`:**
   ```json
   {
     "buildCommand": "yarn build",
     "outputDirectory": "build",
     "rewrites": [
       { "source": "/(.*)", "destination": "/index.html" }
     ]
   }
   ```
   > الـ `rewrites` ضروري لأن التطبيق SPA — كل الـ routes ترجع لـ `index.html`

---

### هـ. متغيرات البيئة الكاملة

#### Backend (`/backend/.env`):

| المتغير | الوصف | مثال |
|---------|-------|------|
| `DATABASE_URL` | 🆕 رابط Supabase PostgreSQL | `postgresql+asyncpg://...` |
| `JWT_SECRET_KEY` | مفتاح تشفير JWT | نص عشوائي طويل ≥ 32 حرف |
| `ADMIN_PASSWORD` | كلمة مرور لوحة الإدارة | `hujjah@Admin#2026` |
| `CORS_ORIGINS` | الـ domains المسموحة | `https://hujjah.vercel.app` |
| `STRIPE_API_KEY` | مفتاح Stripe | `sk_live_...` |
| `GEMINI_API_KEY` | مفتاح Google Gemini | `AIzaSy...` |

#### Frontend (`/frontend/.env`):

| المتغير | الوصف | مثال |
|---------|-------|------|
| `REACT_APP_BACKEND_URL` | رابط الباك اند على Railway | `https://hujjah-backend.up.railway.app` |

---

### و. CI/CD تلقائي

**كيف يعمل بعد الإعداد:**
```
أنت تعدّل الكود محلياً
       ↓
git push origin main
       ↓
┌──────────────┬─────────────────────┐
│   Railway    │       Vercel        │
│ يُعيد بناء  │    يُعيد بناء       │
│ الباك اند   │    الفرونت اند      │
│  تلقائياً   │      تلقائياً       │
└──────────────┴─────────────────────┘
       ↓
التحديث مباشر في الإنتاج!
```

---

## 14. هيكل الملفات (File Structure)

```
hujjah/
│
├── backend/                          # FastAPI Backend
│   ├── server.py                     # كل الكود (1354 سطر)
│   │
│   ├── static/
│   │   └── uploads/                  # الصور المرفوعة من الأدمن
│   │
│   ├── tests/                        # اختبارات pytest
│   │   ├── test_hujjah.py
│   │   ├── test_hujjah_v3.py
│   │   └── test_hujjah_v4.py
│   │
│   ├── .env                          # متغيرات البيئة (لا تُرفع لـ GitHub!)
│   ├── .env.example                  # قالب المتغيرات للمطورين الجدد
│   ├── requirements.txt              # مكتبات Python
│   ├── Procfile                      # أمر تشغيل Railway
│   ├── railway.json                  # إعدادات Railway
│   └── runtime.txt                   # python-3.11.x
│
├── frontend/                         # React Frontend
│   ├── src/
│   │   ├── pages/                    # الصفحات (11 صفحة)
│   │   │   ├── HomePage.jsx          # الشاشة الرئيسية
│   │   │   ├── TeamSetupPage.jsx     # إعداد الفرق
│   │   │   ├── CategorySelectPage.jsx# اختيار الفئات
│   │   │   ├── GameBoardPage.jsx     # لوحة اللعب (535 سطر)
│   │   │   ├── QuestionPage.jsx      # شاشة السؤال
│   │   │   ├── SecretWordPage.jsx    # صفحة ولا كلمة
│   │   │   ├── LoginPage.jsx         # تسجيل الدخول
│   │   │   ├── SignupPage.jsx        # إنشاء حساب
│   │   │   ├── PricingPage.jsx       # الأسعار والاشتراك
│   │   │   ├── PaymentSuccessPage.jsx# تأكيد الدفع
│   │   │   ├── AdminLoginPage.jsx    # دخول الأدمن
│   │   │   └── AdminDashboard.jsx   # لوحة الإدارة (الأكبر)
│   │   │
│   │   ├── context/
│   │   │   └── GameContext.js        # Global State (157 سطر)
│   │   │
│   │   ├── components/
│   │   │   └── ui/                   # مكونات shadcn/ui (40+ مكون)
│   │   │       ├── button.jsx
│   │   │       ├── dialog.jsx
│   │   │       ├── input.jsx
│   │   │       ├── tabs.jsx
│   │   │       ├── sonner.tsx        # Toast notifications
│   │   │       └── ... (المزيد)
│   │   │
│   │   ├── hooks/
│   │   │   └── use-toast.js
│   │   │
│   │   ├── lib/
│   │   │   └── utils.js              # cn() helper
│   │   │
│   │   ├── App.js                    # Router + Routes
│   │   ├── App.css                   # أنيميشن و keyframes
│   │   └── index.css                 # Tailwind + Cairo font
│   │
│   ├── public/
│   │   └── index.html
│   │
│   ├── .env                          # REACT_APP_BACKEND_URL
│   ├── .env.example
│   ├── vercel.json                   # إعدادات Vercel
│   ├── package.json                  # dependencies
│   ├── tailwind.config.js            # ألوان مخصصة
│   ├── craco.config.js               # alias @ → src/
│   └── jsconfig.json                 # paths للـ IDE
│
├── memory/
│   └── PRD.md                        # وثيقة متطلبات المشروع
│
├── DOCUMENTATION.md                  # هذا الملف
├── deploy.sh                         # سكريبت نشر سريع
├── render.yaml                       # إعدادات Render (بديل Railway)
└── .gitignore                        # يتجاهل .env و node_modules
```

---

## 15. دليل إعادة البناء (Rebuild Guide)

### الخطوة 1 — المتطلبات

```bash
# Node.js 18+
https://nodejs.org

# Python 3.11+
https://python.org

# تحقق من التثبيت
node --version    # v18.x.x أو أحدث
python3 --version # Python 3.11.x
npm --version

# أدوات إضافية
npm install -g yarn   # مدير حزم الـ frontend
```

---

### الخطوة 2 — إعداد الحسابات والخدمات الخارجية

**قبل أي كود، احصل على هذه المفاتيح:**

| الخدمة | الرابط | ما تحتاجه |
|--------|--------|----------|
| Supabase | https://supabase.com | Connection String |
| Railway | https://railway.app | حساب فقط |
| Vercel | https://vercel.com | حساب فقط |
| Stripe | https://dashboard.stripe.com | Secret API Key |
| Google Gemini | https://aistudio.google.com/app/apikey | API Key |

---

### الخطوة 3 — إنشاء قاعدة البيانات في Supabase

```bash
# 1. أنشئ مشروع Supabase (انظر القسم 13-ب)
# 2. افتح SQL Editor في Supabase
# 3. انسخ جميع جداول القسم 5 ونفّذها
# 4. انسخ CONNECTION STRING
```

---

### الخطوة 4 — إعداد الباك اند

```bash
# انسخ المشروع
git clone https://github.com/your-username/hujjah.git
cd hujjah/backend

# أنشئ بيئة افتراضية
python3 -m venv venv
source venv/bin/activate    # Mac/Linux
# أو: venv\Scripts\activate  (Windows)

# ثبّت المكتبات الحالية (MongoDB)
pip install -r requirements.txt

# (للهجرة إلى Supabase — أضف هذه المكتبات)
pip install sqlalchemy[asyncio] asyncpg alembic
pip freeze > requirements.txt

# أنشئ .env
cp .env.example .env
```

**عدّل `.env`:**
```env
DATABASE_URL=postgresql+asyncpg://postgres.[ref]:[pass]@aws-0-[region].pooler.supabase.com:5432/postgres
JWT_SECRET_KEY=hujjah_super_secret_random_string_2026_xyz_abc
ADMIN_PASSWORD=hujjah@Admin#2026
CORS_ORIGINS=http://localhost:3000
STRIPE_API_KEY=sk_test_51...
GEMINI_API_KEY=AIzaSy...
```

```bash
# شغّل الباك اند محلياً
uvicorn server:app --host 0.0.0.0 --port 8001 --reload

# تحقق أنه يعمل
curl http://localhost:8001/api/
# → {"message": "Hujjah API v2 – حُجّة"}
```

---

### الخطوة 5 — إضافة البيانات الابتدائية (Seed)

```bash
# احصل على admin token أولاً
TOKEN=$(curl -s -X POST http://localhost:8001/api/admin/login \
  -H "Content-Type: application/json" \
  -d '{"password":"hujjah@Admin#2026"}' | python3 -c "import sys,json;print(json.load(sys.stdin)['token'])")

# ابدأ البيانات
curl -X POST http://localhost:8001/api/seed \
  -H "Authorization: Bearer $TOKEN"

# النتيجة المتوقعة:
# {"message": "تم إضافة 10 فئة و 450 سؤال"}
```

---

### الخطوة 6 — إعداد الفرونت اند

```bash
cd ../frontend

# ثبّت المكتبات
yarn install

# أنشئ ملف .env
echo "REACT_APP_BACKEND_URL=http://localhost:8001" > .env

# شغّل الفرونت اند
yarn start
# يفتح تلقائياً على http://localhost:3000
```

---

### الخطوة 7 — اختبار محلي كامل

```bash
# 1. اختبر API
curl http://localhost:8001/api/categories | python3 -m json.tool

# 2. اختبر المصادقة
curl -X POST http://localhost:8001/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"test@test.com","username":"testuser","password":"123456"}'

# 3. اختبر الأدمن
curl -X POST http://localhost:8001/api/admin/login \
  -H "Content-Type: application/json" \
  -d '{"password":"hujjah@Admin#2026"}'

# 4. افتح http://localhost:3000 في المتصفح
# 5. تأكد من ظهور الصفحة الرئيسية بدون أخطاء
```

---

### الخطوة 8 — النشر على الإنتاج

```bash
# ادفع الكود لـ GitHub
git add .
git commit -m "initial setup"
git push origin main

# Supabase: تم (الخطوة 3)

# Railway:
# 1. اذهب لـ railway.app
# 2. New Project → Deploy from GitHub
# 3. اختر repo → اضبط Root Directory: backend
# 4. أضف متغيرات البيئة (انظر القسم 13-هـ)
# 5. انتظر حتى يُكتمل البناء
# احصل على الرابط: https://hujjah-backend.up.railway.app

# Vercel:
# 1. اذهب لـ vercel.com
# 2. New Project → Import repo
# 3. Root Directory: frontend
# 4. أضف: REACT_APP_BACKEND_URL=https://hujjah-backend.up.railway.app
# 5. Deploy
# احصل على الرابط: https://hujjah.vercel.app

# أضف في Railway:
# CORS_ORIGINS=https://hujjah.vercel.app

# ابدأ البيانات في الإنتاج:
TOKEN=$(curl -s -X POST https://hujjah-backend.up.railway.app/api/admin/login \
  -H "Content-Type: application/json" \
  -d '{"password":"hujjah@Admin#2026"}' | python3 -c "import sys,json;print(json.load(sys.stdin)['token'])")

curl -X POST https://hujjah-backend.up.railway.app/api/seed \
  -H "Authorization: Bearer $TOKEN"
```

---

### الخطوة 9 — التحقق النهائي

```bash
# اختبر الـ API في الإنتاج
curl https://hujjah-backend.up.railway.app/api/categories

# افتح التطبيق في المتصفح
# https://hujjah.vercel.app

# افتح لوحة الأدمن
# https://hujjah.vercel.app/admin
# كلمة المرور: hujjah@Admin#2026

# اختبر تدفق اللعبة الكامل:
# 1. الصفحة الرئيسية → ابدأ اللعب
# 2. إدخال أسماء الفرق
# 3. اختيار الفئات
# 4. اللعبة الرئيسية
# 5. فتح سؤال واختبار المؤقت
```

---

## 16. التوسع المستقبلي (Future Scaling)

### أ. 10,000 مستخدم — الإعداد الحالي كافٍ

```
Supabase Free (500MB):
  ✅ يتحمل ~100 اتصال متزامن
  ✅ كافٍ حتى ~10K مستخدم
  
Railway Starter ($5/شهر):
  ✅ 512MB RAM
  ✅ يكفي لـ 100-500 طلب/ثانية
  
تحسينات مطلوبة عند 10K:
  ✅ أضف indexes لقاعدة البيانات (مذكورة في القسم 5)
  ✅ فعّل Supabase Connection Pooling
```

**تحسينات Supabase عند 10K:**
```sql
-- تأكد من وجود هذه الـ indexes
CREATE INDEX idx_users_email         ON users(email);
CREATE INDEX idx_questions_cat_diff  ON questions(category_id, difficulty);
CREATE INDEX idx_sessions_created    ON game_sessions(created_at DESC);
```

---

### ب. 100,000 مستخدم — يحتاج تحسينات

```
المشاكل المتوقعة:
  ❌ قاعدة البيانات تبطّأ بدون caching
  ❌ الباك اند لا يتحمل الطلبات الكثيرة

الحلول:
  ✅ ترقية Supabase إلى Pro ($25/شهر)
  ✅ ترقية Railway إلى خطة أعلى
  ✅ إضافة Redis Caching
```

**إضافة Redis Caching:**
```python
import redis.asyncio as redis

cache = redis.from_url(os.environ["REDIS_URL"])

@api_router.get("/categories")
async def get_categories():
    cached = await cache.get("categories")
    if cached:
        return json.loads(cached)
    
    # من قاعدة البيانات
    cats = await db.execute(select(Category).order_by(Category.order))
    result = [c.__dict__ for c in cats.scalars().all()]
    
    await cache.setex("categories", 3600, json.dumps(result))
    return result
```

**لإضافة Redis على Railway:**
```
Railway Dashboard → New Service → Add Redis
ثم استخدم REDIS_URL متغير البيئة
```

---

### ج. 1,000,000 مستخدم — معمارية Microservices

```
المعمارية المقترحة:

┌─────────────────────────────────────────────────────────┐
│              Cloudflare CDN + DDoS Protection           │
└────────────────────────┬────────────────────────────────┘
                         │
┌────────────────────────▼────────────────────────────────┐
│                   Load Balancer (AWS ALB)               │
└───────┬────────────────┬───────────────┬────────────────┘
        │                │               │
┌───────▼──────┐  ┌──────▼──────┐  ┌────▼────────────────┐
│  Auth Service│  │ Game Service│  │    AI Service        │
│  (FastAPI)   │  │  (FastAPI)  │  │    (FastAPI)         │
│  2 instances │  │ 4 instances │  │    1 instance        │
└───────┬──────┘  └──────┬──────┘  └────┬────────────────┘
        │                │              │
┌───────▼────────────────▼──────────────▼────────────────┐
│                 Redis Cluster (Sessions + Cache)        │
└────────────────────────┬────────────────────────────────┘
                         │
┌────────────────────────▼────────────────────────────────┐
│            Supabase Enterprise / AWS RDS                │
│         (Read Replicas + Connection Pooling)            │
└─────────────────────────────────────────────────────────┘

التكلفة عند 1M مستخدم:
  Supabase Team:     ~$599/شهر
  Railway/AWS:       ~$500/شهر
  Redis:             ~$100/شهر
  CDN:               ~$50/شهر
  المجموع:           ~$1,250/شهر
```

**تحسينات الكود للمليون:**

```python
# 1. Connection Pool لـ PostgreSQL
engine = create_async_engine(
    DATABASE_URL,
    pool_size=20,
    max_overflow=30,
    pool_pre_ping=True,
    pool_recycle=3600
)

# 2. Pagination لكل القوائم
@api_router.get("/questions")
async def get_questions(page: int = 1, limit: int = 50, db=Depends(get_db)):
    offset = (page - 1) * limit
    result = await db.execute(
        select(Question).offset(offset).limit(limit)
    )
    total = await db.execute(select(func.count(Question.id)))
    return {
        "questions": result.scalars().all(),
        "total": total.scalar(),
        "page": page
    }

# 3. Background Tasks للعمليات الثقيلة
@api_router.post("/ai/generate-questions")
async def generate_questions(body: dict, bg: BackgroundTasks, admin=Depends(get_admin)):
    task_id = str(uuid.uuid4())
    bg.add_task(run_ai_generation, task_id, body)
    return {"task_id": task_id, "status": "processing"}

# 4. WebSockets للـ Real-time (مستقبلاً)
@app.websocket("/ws/game/{session_id}")
async def game_ws(websocket: WebSocket, session_id: str):
    await websocket.accept()
    while True:
        session = await db.execute(select(GameSession).where(GameSession.id == session_id))
        s = session.scalar_one()
        await websocket.send_json({
            "team1_score": s.team1_score,
            "team2_score": s.team2_score
        })
        await asyncio.sleep(2)
```

---

### د. رفع الصور للـ Cloud (عند التوسع)

**المشكلة الحالية:** الصور المرفوعة تُحفظ محلياً في `/backend/static/uploads/` — هذا لا يعمل مع Serverless أو مع أكثر من instance.

**الحل: Supabase Storage أو AWS S3**

```python
# مثال: رفع الصور لـ Supabase Storage
from supabase import create_client

supabase = create_client(os.environ["SUPABASE_URL"], os.environ["SUPABASE_SERVICE_KEY"])

async def upload_to_supabase(file: UploadFile) -> str:
    content = await file.read()
    filename = f"uploads/{uuid.uuid4()}.{file.filename.split('.')[-1]}"
    
    supabase.storage.from_("hujjah-images").upload(
        path=filename,
        file=content,
        file_options={"content-type": file.content_type}
    )
    
    url = supabase.storage.from_("hujjah-images").get_public_url(filename)
    return url
```

---

## ملخص المفاتيح والحسابات

| الخدمة | ما تحتاجه | من أين |
|--------|----------|--------|
| `DATABASE_URL` | Connection String | Supabase → Settings → Database → URI |
| `JWT_SECRET_KEY` | نص عشوائي طويل | اكتب أي نص ≥ 32 حرف |
| `ADMIN_PASSWORD` | كلمة مرور الأدمن | اختارها بنفسك |
| `STRIPE_API_KEY` | Secret key | dashboard.stripe.com → Developers → API Keys |
| `GEMINI_API_KEY` | API key | aistudio.google.com/app/apikey |
| `REACT_APP_BACKEND_URL` | رابط الباك اند | Railway → رابط الـ service |

---

## أوامر مفيدة

```bash
# تشغيل محلي
cd backend && uvicorn server:app --port 8001 --reload
cd frontend && yarn start

# بناء للإنتاج
cd frontend && yarn build

# اختبار الـ API
curl http://localhost:8001/api/categories | python3 -m json.tool

# تسجيل دخول الأدمن
curl -X POST http://localhost:8001/api/admin/login \
  -H "Content-Type: application/json" \
  -d '{"password":"hujjah2024"}'

# إعادة ضبط البيانات (حذف وإعادة)
TOKEN="your_admin_token"
curl -X POST "http://localhost:8001/api/seed?force=true" \
  -H "Authorization: Bearer $TOKEN"

# فحص عدد الأسئلة
curl http://localhost:8001/api/questions/count

# نشر الباك اند
cd backend && railway up

# نشر الفرونت اند
cd frontend && vercel --prod
```

---

## بيانات الاختبار

| المتغير | القيمة |
|---------|--------|
| **كلمة مرور الأدمن** | `hujjah2024` (يمكن تغييرها في .env) |
| **رابط الأدمن** | `/admin` |
| **بريد اختبار** | أي بريد صالح (لا توجد تحقق من البريد) |
| **Stripe test card** | `4242 4242 4242 4242` — أي تاريخ مستقبلي — أي CVC |

---

*آخر تحديث: فبراير 2026 | المعمارية: Vercel + Railway + Supabase*
