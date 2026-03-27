# HUJJAH (حُجّة) - Platform PRD & Progress

## Original Problem Statement
Upgrade the Hujjah trivia game into a professional SaaS platform with strict Role-Based Access Control (RBAC), an Admin Activity Log, Platform Analytics, Staff Dashboard, and Payment API integration.

## Core Requirements
- Separate Admin dashboard views: Super Admin (full access) vs Staff (content-only)
- Backend + Frontend security to prevent unauthorized access
- Admin Activity Log (who did what, when) - Super Admin only
- Platform Analytics (users, sessions, categories, revenue) - Super Admin only
- Payment Gateway endpoints using PAYMENT_API_ID / PAYMENT_API_KEY

## Tech Stack
- Frontend: React + Tailwind CSS
- Backend: FastAPI (Python) + JWT Auth
- Database: MongoDB
- AI: Google Gemini (Emergent LLM Key) for question generation

## Architecture
```
/app/
├── backend/server.py    (~2250 lines, monolithic)
├── frontend/src/
│   ├── App.js
│   ├── context/GameContext.js
│   └── pages/
│       ├── AdminDashboard.jsx   (~1550 lines)
│       ├── AdminLoginPage.jsx
│       ├── GameBoardPage.jsx
│       ├── QuestionPage.jsx
│       ├── TournamentBracketPage.jsx
│       └── CategorySelectPage.jsx
└── memory/PRD.md
```

## RBAC Roles
- **super_admin**: username=`admin`, password=`ADMIN_PASSWORD` — full access
- **staff**: stored in `admin_accounts` collection — content management only

## Staff-Accessible Tabs
- الأسئلة (questions), توليد AI, وضع التجربة (experimental)

## Super Admin-Only Tabs
- المستخدمون, الإحصاءات, الإعدادات, سجل النشاط, الموظفون + seed button

## Key API Endpoints (RBAC enforced)
- `POST /api/admin/login` — accepts {username, password}, returns {token, role, name}
- `GET /api/admin/verify` — returns {valid, role, name}
- `GET /api/admin/analytics` — super_admin only
- `GET /api/admin/users` — super_admin only
- `GET /api/admin/logs` — super_admin only
- `POST /api/admin/staff` — super_admin only
- `GET /api/admin/staff` — super_admin only
- `DELETE /api/admin/staff/{id}` — super_admin only
- `POST /api/admin/users/{id}/gift-subscription` — super_admin only
- `POST /api/payment/v2/initiate` — payment initiation
- `GET /api/payment/v2/verify/{txn_id}` — payment verification
- `POST /api/payment/v2/activate` — super_admin only
- `POST /api/payment/v2/renew` — super_admin only
- `POST /api/payment/v2/failure` — record payment failure

## DB Collections
- `users`: id, email, hashed_password, subscription_type, subscription_expires_at
- `categories`: id, name, image_url, is_premium, is_active
- `questions`: id, text, options, correct_answer, category_id, difficulty, is_experimental
- `admin_accounts`: id, username, password_hash, display_name, created_at
- `admin_logs`: id, admin_name, admin_role, action, target_type, target_name, details, timestamp
- `game_sessions`: id, team1, team2, status, created_at
- `payment_transactions`: id, user_id, plan_id, amount, currency, payment_status, status

## What's Been Implemented

### Session 1-12 (Previous)
- Full trivia game: Standard + Tournament modes
- Game Master control panel
- Premium categories system
- AI question generation (Google Gemini)
- Category is_active toggle
- 3 letter-based categories seeded (A, B, Q)
- Tournament bracket redesign (up to 8 teams)
- TV-friendly large screen UI

### Session 13 (Feb 2026) — RBAC + Logs + Payments
- **RBAC System**: Super Admin vs Staff role separation
  - Modified admin login to accept username + password
  - `get_admin` returns dict with role info
  - New `get_super_admin` dependency (403 for staff)
  - Backward compatible with old tokens
- **Admin Activity Log**: 
  - `admin_logs` collection in MongoDB
  - `log_admin_action()` helper
  - Logs all CRUD operations on questions, categories, users, settings
  - "سجل النشاط" tab (Super Admin only)
- **Staff Management**:
  - CRUD endpoints for staff accounts
  - "الموظفون" tab with add/edit/delete UI
  - Staff stored in `admin_accounts` collection
- **Gift Subscription**: `POST /admin/users/{id}/gift-subscription`
- **Enhanced Analytics**: categories.total/active/inactive/premium, most_popular
- **Payment API v2 endpoints**: initiate, verify, activate, renew, failure
  - Uses PAYMENT_API_ID + PAYMENT_API_KEY from env
  - Backend-only (never exposed to frontend)
- **Frontend RBAC**: Role-aware dashboard, filtered tabs per role
- **Role badge** in dashboard header

## P1/P2 Remaining Features
### P1 — Refactoring
- server.py (~2250 lines) → split into modules (auth.py, payments.py, categories.py, questions.py, admin.py)
- AdminDashboard.jsx (~1550 lines) → split into sub-components (AnalyticsTab, StaffTab, LogsTab, etc.)

### P2 — Future
- Real payment gateway integration (requires knowing which gateway PAYMENT_API_ID belongs to)
- Email notifications for subscriptions
- User self-service subscription portal
- Game session analytics (average duration, win rates)
- Multi-language support

## Credentials
- Admin: username=admin, password=hujjah2024
- App URL: https://hujjah-trivia.preview.emergentagent.com
