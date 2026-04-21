# دليل التطوير — حُجّة (HUJJAH)

> **ملاحظة لـ Claude Code:** هذا الملف يحتوي على (1) سياق المشروع الكامل، (2) ما تم إنجازه في آخر مراجعة UI/UX، (3) ما تبقّى من شغل مرتّب حسب الأولوية. اقرأه **كاملاً** قبل أي تعديل.

---

## 🎯 نظرة عامة على المشروع

- **الاسم:** حُجّة (HUJJAH) — منصة SaaS عربية للعبة تريفيا (سين جيم، مخمخ)
- **الجمهور:** السعودية والخليج + الشركات/الفرق
- **المهمة:** نوفّر تجربة لعبة تلفزيونية فاخرة بطابع تراثي عربي (برجندي عنابي × ذهبي سعودي) — بحسب `design_guidelines.json`، الشخصية هي "E1 - The Anti-AI Designer".

### المعمارية

```
repo/
├── frontend/                    # React 19 + CRA (Craco) + Tailwind + shadcn/ui
│   ├── src/
│   │   ├── styles/theme.css     # ✨ جديد: نظام التصميم الموحّد (المرجع الوحيد للألوان)
│   │   ├── index.css            # يستورد theme.css، فيه animations و legacy classes
│   │   ├── App.js               # الـ router + ThemeSync + Toaster مخصّص
│   │   ├── context/GameContext.js
│   │   ├── components/ui/       # shadcn/ui (مولّد)
│   │   └── pages/               # 15 صفحة
│   ├── tailwind.config.js       # ✨ مرتبط بالكامل بـ CSS variables
│   └── package.json             # React 19, Radix UI, Framer, Recharts, lucide
│
├── backend/                     # FastAPI monolith
│   ├── server.py                # ~3000 سطر (222KB) — يحتاج تقسيم لاحقاً
│   ├── services/payment/paylinkService.py
│   └── requirements.txt
│
├── design_guidelines.json       # المرجع الرسمي للتصميم
├── memory/PRD.md                # متطلبات المنتج + الـ backlog
└── DEPLOYMENT.md                # Vercel + Railway
```

### المجموعات (Collections) في MongoDB

`users`, `categories`, `category_groups`, `questions`, `pending_questions`, `game_sessions`, `payment_transactions`, `admin_activity_logs`

### التكاملات

- **Paylink.sa** — الدفع (`PAYMENT_API_ID`, `PAYMENT_API_KEY`)
- **Google Gemini** — توليد الأسئلة
- **Unsplash API** — الصور
- **SMTP/Gmail** — إشعارات

---

## ✅ ما تم إنجازه في مراجعة UI/UX — Sprint 4 (2026-04)

### المرحلة 1 — أساس نظام التصميم

**1.1 — `frontend/src/styles/theme.css` (ملف جديد، المرجع الوحيد)**

كل الألوان والـ gradients والـ shadows تُعرَّف هنا. الـ components الأخرى **يجب** أن تستهلك هذه المتغيرات عبر Tailwind أو الـ composite classes — لا يُسمح بإضافة hex codes جديدة مباشرة في الصفحات.

- Brand palette: `--brand-burgundy`, `--brand-gold`, `--brand-cream` + المشتقات
- Semantic aliases: `--color-primary`, `--color-secondary`, `--color-success`, `--color-warning`, `--color-danger`
- Team tokens: `--color-team1`, `--color-team2` (+ soft/deep) — **قابلة للتخصيص لاحقاً**
- Gradients: `--gradient-studio` (الخلفية العنابية)، `--gradient-parchment`، `--gradient-tile`
- Composite utility classes:
  - `.bg-studio` — الخلفية العنابية (بديل `DARK_BG` القديم)
  - `.studio-ambient` — التوهجات الذهبية (قابل إضافته كأول child داخل `.bg-studio`)
  - `.pattern-overlay-dark` / `.pattern-overlay-light` — نقشة الزخرفة الإسلامية
  - `.card-studio` / `.card-studio-elevated` — بطاقات موحّدة
  - `.btn-primary-studio` / `.btn-ghost-studio` — أزرار
  - `.input-studio` — حقول إدخال
  - `.text-gold-muted` / `.text-gold-soft` — نصوص بـ contrast WCAG AA مضمون
- Sonner toast theming: CSS selectors مستهدفة (`[data-sonner-toaster] ...`) تعطي برغندي/ذهبي بدل الأخضر/الأحمر الجنيريك
- `prefers-reduced-motion` — يُعطّل الأنيميشن لمن يحتاج ذلك
- Dark mode: مفعّل عبر `[data-theme="dark"]` على `<html>`

**1.2 — `frontend/src/index.css` (أعيد بناؤه)**

- يستورد `theme.css` أولاً
- يضيف خط **Tajawal** (كان مذكور في guidelines لكن غير مستورد)
- `:focus-visible` — ring ذهبي موحّد لكل الأزرار للـ keyboard users
- `.sr-only` — نص للـ screen readers
- كل الألوان الـ hardcoded استُبدلت بـ `var(--...)`

**1.3 — `frontend/tailwind.config.js` (أعيد ربطه بالكامل)**

- `darkMode: ["class", '[data-theme="dark"]']` — يتفعّل تلقائياً من attribute
- كل لون يقرأ من CSS variable (`primary: "var(--brand-burgundy)"`)
- tokens جديدة: `team1`, `team2`, `bg-gradient-studio`, `shadow-glow-lg`, إلخ

**1.4 — `frontend/src/App.js` (أعيد بناؤه)**

- مكوّن `<ThemeSync />` صغير يقرأ `darkMode` من `GameContext` ويكتب `data-theme="dark"` على `<html>` — هذا يفعّل كل الـ overrides في `theme.css` بضربة واحدة
- Toaster: بدون `richColors` (نستخدم styling مخصّص)، `dir="rtl"`، خط Cairo، `closeButton`، `duration: 3500`

**1.5 — إزالة `DARK_BG` المكرر من 8 ملفات**

الملفات التي كانت تحتوي على نفس `const DARK_BG = {...}` في كل ملف:

- `AdminLoginPage.jsx`
- `LoginPage.jsx`
- `PaymentSuccessPage.jsx`
- `PricingPage.jsx`
- `SecretWordPage.jsx`
- `SignupPage.jsx`
- `TeamSetupPage.jsx`
- `TournamentSetupPage.jsx`

**تحوّلت جميعها** من `style={DARK_BG}` إلى `className="... bg-studio"`. التغيير في كل ملف **سطرين فقط**: حذف `const DARK_BG` + تعديل className في root div.

### المرحلة 2 — مكاسب سريعة عالية الأثر

**2.1 — `HomePage.jsx` — إعادة بناء كاملة**

- **Drawer للموبايل (`<md`):** زر hamburger يفتح panel جانبي مع navigation كامل. يغلق بـ ESC + click خارج + body scroll lock.
- **استبدال جميع الإيموجي بـ lucide-react**
- **a11y:** `aria-label`, `aria-expanded`, `aria-controls`, `role="banner"`, `role="dialog"`, `aria-modal`, `sr-only`
- **Contrast:** رفع من `/25`, `/30` إلى `/50` و `/65` و `/85` في النصوص

---

## 📋 ملفات معدّلة في هذه المراجعة

### ملفات جديدة
| الملف | الوصف |
|------|-------|
| `frontend/src/styles/theme.css` | نظام التصميم الموحّد — **المرجع الوحيد** |
| `CLAUDE.md` | هذا الملف |

### ملفات مُعاد بناؤها
| الملف | التغيير |
|------|--------|
| `frontend/src/index.css` | يستورد theme.css، Tajawal، focus-visible، sr-only |
| `frontend/tailwind.config.js` | كل الألوان من CSS variables + tokens جديدة |
| `frontend/src/App.js` | ThemeSync + Toaster مخصّص |
| `frontend/src/pages/HomePage.jsx` | drawer للموبايل + lucide icons + a11y |

### ملفات مُعدّلة بتغيير طفيف
| الملف | التغيير |
|------|--------|
| `frontend/src/pages/AdminLoginPage.jsx`      | `DARK_BG` → `bg-studio` |
| `frontend/src/pages/LoginPage.jsx`           | `DARK_BG` → `bg-studio` |
| `frontend/src/pages/PaymentSuccessPage.jsx`  | `DARK_BG` → `bg-studio` |
| `frontend/src/pages/PricingPage.jsx`         | `DARK_BG` → `bg-studio` |
| `frontend/src/pages/SecretWordPage.jsx`      | `DARK_BG` → `bg-studio` |
| `frontend/src/pages/SignupPage.jsx`          | `DARK_BG` → `bg-studio` |
| `frontend/src/pages/TeamSetupPage.jsx`       | `DARK_BG` → `bg-studio` |
| `frontend/src/pages/TournamentSetupPage.jsx` | `DARK_BG` → `bg-studio` |

---

## 🚧 المتبقّي — خطة Claude Code

### 🥇 أولوية P0

#### P0.1 — تثبيت التبعيات والتأكد من عدم انكسار البناء
```bash
cd frontend && yarn install && yarn build
```

#### P0.2 — حذف اعتماديات `darkMode` inline من CategorySelectPage و GameBoardPage
لا تحذف `darkMode` من Context — فقط استبدل inline styles بـ classes من theme.css.

---

### 🥈 أولوية P1

#### P1.1 — `QuestionPage.jsx` — Layout جديد للـ TV/landscape
- Portrait: Timer فوق، السؤال يملأ 70%+
- Landscape: Timer على اليمين (20%)، السؤال على اليسار (80%)

#### P1.2 — a11y كاملة على QuestionPage + GameBoardPage
- `aria-label` لكل زر
- `role="timer"` و `aria-live="polite"` على عدّاد الوقت
- `role="status"` و `aria-live="polite"` على تحديث النقاط

#### P1.3 — team colors قابلة للتخصيص
استبدل `from-red-700` و `from-blue-700` بـ `from-team1-deep to-team1` و `from-team2-deep to-team2`

#### P1.4 — تفعيل Pattern Overlay على HomePage
```jsx
<div className="fixed inset-0 pattern-overlay-dark pointer-events-none" aria-hidden="true" />
```

#### P1.5 — زر dark mode toggle (Sun/Moon) في HomePage drawer

---

### 🥉 أولوية P2

#### P2.1 — تقسيم `AdminDashboard.jsx` (2519 سطر)
```
frontend/src/pages/admin/
├── index.jsx
├── OverviewTab.jsx
├── QuestionsTab.jsx
├── PendingTab.jsx
├── CategoriesTab.jsx
├── UsersTab.jsx
├── TrashTab.jsx
├── ActivityTab.jsx
├── AIImportTab.jsx
├── SettingsTab.jsx
└── _shared/
    ├── PendingQuestionCard.jsx
    ├── QuestionForm.jsx
    ├── CategoryForm.jsx
    └── useAdminApi.js
```

#### P2.2 — Confetti canvas-based
```bash
yarn add canvas-confetti
```

#### P2.3 — Lazy loading للـ Admin و Tournament

#### P2.4 — ESLint rule يمنع hex colors مباشرة

---

## 📖 قواعد يجب على Claude Code اتباعها

### قاعدة 1: لا ألوان hardcoded
❌ `style={{ color: "#F1E194" }}`
✅ `style={{ color: "var(--brand-gold)" }}`
✅ `className="text-secondary"`

### قاعدة 2: لا إيموجي في الـ UI المهم
✅ OK في toasts فقط. ❌ ليس في أزرار CTA أو headings. استخدم `lucide-react`.

### قاعدة 3: كل زر icon-only يحتاج `aria-label`
```jsx
<button aria-label="إغلاق"><X size={18} aria-hidden="true" /></button>
```

### قاعدة 4: الـ contrast الأدنى
- نص عادي: `text-secondary/70` (5:1 على burgundy — يجتاز AA)
- نص كبير: `text-secondary/55` (3:1 — يجتاز AA Large Text)

### قاعدة 5: كل component جديد يستعمل الـ composite classes
❌ inline styles طويلة
✅ `className="card-studio"`

### قاعدة 6: استخدم `data-testid` على كل زر تفاعلي جديد

---

## 🏃 أوامر سريعة

```bash
# تشغيل محلي
cd frontend && yarn install && yarn start   # http://localhost:3000
cd backend  && pip install -r requirements.txt && uvicorn server:app --reload --port 8001

# البناء للإنتاج
cd frontend && yarn build
```

---

## 🔑 معلومات مهمة

- **الريبو:** `https://github.com/unipad2024-tech/Hajjhh.emergent.git`
- **Frontend URL:** `https://frontend-umber-chi-98.vercel.app`
- **Admin Panel:** `/admin` (كلمة المرور: `ADMIN_PASSWORD` env var)
- **الخط:** Cairo (أساسي) + Tajawal (ثانوي)
- **الألوان:** Burgundy `#5B0E14` × Gold `#F1E194` × Cream `#FDF6E3`
- **الاتجاه:** RTL دائماً

---

## 📌 ملاحظة أخيرة

أي تغيير في نظام الألوان يكون **فقط** عبر `theme.css`. أي component جديد يحترم:
- RTL first
- Cairo كخط أساسي
- burgundy/gold فقط
- ما في `#FFFFFF` — استخدم `--brand-cream`

قبل الـ commit: شغّل `yarn build` وتأكد من صفر warnings جديدة.
