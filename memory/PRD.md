# HUJJAH (حُجّة) - Platform PRD & Progress

## Original Problem Statement
Upgrade the Hujjah trivia game into a professional SaaS platform with:
- Strict Role-Based Access Control (RBAC) — Super Admin vs Staff
- Admin Activity Log + Platform Analytics
- Staff Dashboard + Staff Management
- Email Notification System
- AI Question Generation with Unsplash Image Search
- Category Organization System (Groups)
- Payment API Integration

## Tech Stack
- Frontend: React + Tailwind CSS + Lucide React
- Backend: FastAPI (Python) + JWT Auth + aiosmtplib (email)
- Database: MongoDB
- AI: Google Gemini (Emergent LLM Key) for question generation
- Images: Unsplash API

## Architecture
```
/app/
├── backend/server.py    (~2510 lines, monolithic)
├── frontend/src/
│   ├── App.js
│   ├── context/GameContext.js
│   └── pages/
│       ├── AdminDashboard.jsx   (~1900 lines)
│       ├── AdminLoginPage.jsx
│       ├── LoginPage.jsx
│       ├── SignupPage.jsx
│       ├── QuestionPage.jsx     (zoom modal added)
│       ├── CategorySelectPage.jsx (group filter added)
│       ├── GameBoardPage.jsx
│       ├── TournamentBracketPage.jsx
│       └── TournamentSetupPage.jsx
└── memory/PRD.md
```

## RBAC Roles
- **super_admin**: username=`admin`, password=`hujjah2024` — full access to all tabs
- **staff**: stored in `admin_accounts` collection — content management only

### Staff-Accessible Tabs
- الأسئلة (questions), توليد AI, وضع التجربة (experimental)

### Super Admin-Only Tabs
- المستخدمون, الإحصاءات, الإعدادات, سجل النشاط, الموظفون + seed button

## Key API Endpoints
```
Authentication:
POST /api/admin/login        → {username, password} → {token, role, name}
GET  /api/admin/verify       → {valid, role, name}

RBAC (Super Admin only):
GET  /api/admin/users
PUT  /api/admin/users/{id}
DEL  /api/admin/users/{id}
POST /api/admin/users/{id}/gift-subscription
GET  /api/admin/analytics
GET  /api/admin/sessions
GET  /api/admin/payments
GET  /api/admin/logs
POST /api/admin/staff
GET  /api/admin/staff
PUT  /api/admin/staff/{id}
DEL  /api/admin/staff/{id}
POST /api/admin/trigger-subscription-check

Content (Both roles):
GET/POST/PUT/DEL /api/categories
GET/POST/PUT/DEL /api/questions
POST /api/ai/generate-questions   (returns image_query per question)
POST /api/ai/save-questions

Category Groups (Admin):
GET  /api/category-groups
POST /api/category-groups
PUT  /api/category-groups/{id}
DEL  /api/category-groups/{id}
POST /api/admin/seed-category-groups

Unsplash:
GET  /api/unsplash/search?query=...  (admin only)

Payment v2:
POST /api/payment/v2/initiate
GET  /api/payment/v2/verify/{txn_id}
POST /api/payment/v2/activate   (super_admin)
POST /api/payment/v2/renew      (super_admin)
POST /api/payment/v2/failure
```

## DB Collections
- `users`: id, email, hashed_password, subscription_type, subscription_expires_at, notify_warning_sent, notify_expired_sent
- `categories`: id, name, icon, image_url, is_premium, is_active, group_id
- `category_groups`: id, name, icon, color, order, created_at
- `questions`: id, text, answer, image_query, image_url, answer_image_url, category_id, difficulty, is_experimental
- `admin_accounts`: id, username, password_hash, display_name, created_at
- `admin_logs`: id, admin_name, admin_role, action, target_type, target_name, details, timestamp
- `game_sessions`: id, team1, team2, status, created_at
- `payment_transactions`: id, user_id, plan_id, amount, currency, payment_status, status

## Environment Variables
```
JWT_SECRET_KEY, ADMIN_PASSWORD
MONGO_URL, DB_NAME
STRIPE_API_KEY, PAYMENT_API_ID, PAYMENT_API_KEY
EMAIL_USER=hujjahgame@gmail.com, EMAIL_PASS=(Gmail App Password)
UNSPLASH_API_KEY=(provided key)
GEMINI_API_KEY (or Emergent LLM Key)
```

## What's Been Implemented

### Session 1-12 (Previous)
- Full trivia game: Standard + Tournament modes (up to 8 teams)
- Game Master control panel
- Premium categories system + is_active toggle
- AI question generation (Google Gemini)
- 3 letter-based categories seeded (A, B, Q)
- Tournament bracket redesign
- TV-friendly large screen UI

### Session 13 — RBAC + Logs + Payments (Feb 2026)
- RBAC: Super Admin vs Staff with JWT sub_role
- Admin Activity Log (admin_logs collection, log_admin_action helper)
- Staff Management (CRUD via admin_accounts collection)
- Gift Subscription endpoint
- Enhanced Analytics (categories.total/active/premium/most_popular)
- Payment v2 endpoints (initiate, verify, activate, renew, failure)
- Role badge in dashboard header, filtered tabs by role

### Session 15 — Data Safety + AI Dedup + Payments (Feb 2026)
- **CRITICAL FIX: Data Loss Prevention**
  - Removed "Add Data" seed button from frontend completely
  - Seed endpoint now NEVER deletes/overwrites — only adds items not already in DB
  - Removed dangerous `force=True` parameter from seed endpoint
- **Question Restore System**
  - Deleted questions backed up to `deleted_questions` collection before removal
  - "سلة المحذوفات" restore panel in questions tab
  - Restore any deleted question with one click
  - Enhanced delete confirmation dialog shows question preview
- **Auto-Save**: Debounced auto-save (1.5s) for question text and answer fields
- **AI Deduplication**: AI generation now fetches existing questions and instructs AI not to repeat them
- **Payment API Keys Configured**: PAYMENT_API_ID=APP_ID_1774162201273, PAYMENT_API_KEY configured in backend .env
- **New Endpoints**: PATCH /questions/{id}/autosave, GET /admin/deleted-questions, POST /admin/restore-question/{id}
- **Password Toggle**: Eye icon on Login, Signup (2 fields), AdminLogin pages
- **Image Zoom Modal**: Click on question/answer images → fullscreen overlay (ZoomIn icon hover)
- **AI + Unsplash**: image_query field per generated question, auto-fetch from Unsplash in review UI
- **Email Notifications**: Gmail SMTP (aiosmtplib), daily subscription check loop, warning (3 days before) + expired emails in Arabic HTML
- **Category Groups**: 10 default groups (علمي، رياضة، تاريخ، etc.), group_id on categories, group filter tabs in CategorySelectPage, grouped sidebar in AdminDashboard
- **Admin Dashboard**: Group filter in category sidebar, Group assignment dropdown in category form, Group management (add/edit/delete groups)
- **Group Form Modal**: Create/edit groups with icon, color, order

## P1/P2 Remaining Features
### P1 — Refactoring (Technical Debt)
- server.py (~2510 lines) → split into modules: auth.py, payments.py, categories.py, admin.py, email.py
- AdminDashboard.jsx (~1900 lines) → AnalyticsTab, StaffTab, LogsTab, AITab sub-components

### P2 — Future Features
- Real payment gateway integration (requires knowing PAYMENT_API_ID gateway type)
- User self-service subscription portal
- Game session analytics (average duration, win rates)
- Email unsubscribe link
- Push notifications (Firebase)
- Multi-language support (EN/AR)
- Category image from Unsplash (auto-search on category name)

## Credentials
- Admin: username=admin, password=hujjah2024
- App URL: https://hujjah-trivia.preview.emergentagent.com
