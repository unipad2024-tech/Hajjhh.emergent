# HUJJAH (حُجّة) — Product Requirements Document

## Original Problem Statement
A professional Arabic SaaS trivia game platform with multi-team support, subscription tiers, and an admin dashboard for content management.

## Target Audience
- Arabic-speaking players (Saudi Arabia and GCC)
- Families, friends, corporate teams looking for entertainment
- Content admins managing questions

## Core Requirements
1. Multi-team trivia game (Standard + Tournament modes)
2. Question categories with difficulty levels (300/600/900)
3. Premium subscription via payment gateway
4. Admin panel for question/category/user management
5. AI-powered question generation
6. Soft-delete trash bin
7. Role-based access (Super Admin vs Staff)

---

## Architecture

```
/app/
├── backend/
│   ├── server.py              (~3000 lines monolith)
│   ├── services/
│   │   └── payment/
│   │       └── paylinkService.py  (Paylink.sa gateway)
│   └── requirements.txt
└── frontend/
    └── src/
        └── pages/
            ├── AdminDashboard.jsx
            ├── GameBoardPage.jsx
            ├── QuestionPage.jsx
            ├── PricingPage.jsx
            └── PaymentSuccessPage.jsx
```

## DB Collections
- `users` — email, role, subscription_status, answered_question_ids
- `categories` — name, group_id, is_premium
- `category_groups` — name
- `questions` — text, answer, difficulty, category_id, image_url, answer_image_url, image_query, deleted_at
- `pending_questions` — same as questions + status="pending" (staging area)
- `game_sessions` — team info, used_questions, scores
- `payment_transactions` — Paylink transaction tracking
- `admin_activity_logs` — audit trail

---

## What Has Been Implemented

### Sprint 1 (Prior sessions)
- [x] Basic gameplay (Standard + Tournament modes)
- [x] Category system with groups
- [x] Admin login with JWT
- [x] RBAC (Super Admin vs Staff)
- [x] Admin activity logs
- [x] Soft-delete trash bin (restore)
- [x] Auto-save for question drafts
- [x] Password visibility toggles
- [x] SMTP email cron for subscription expiry notifications
- [x] AI question generation (Gemini) with Unsplash image fetching
- [x] Question deduplication in AI generation

### Sprint 3 — 2026-02 (Current session)
- [x] **QuickHostBar** — شريط تحكم سريع دائماً مرئي فوق لوحة اللعبة (+300/600/900 لكل فريق + تبديل الدور)
- [x] **زر لوحة المضيف** — أكبر وأوضح مع animation نابضة gmpPulse
- [x] **PendingQuestionCard** — مكوّن مستقل يعرض صورة السؤال وصورة الإجابة بشكل منفصل مع تعديل مباشر
- [x] **Custom AI Prompt في استيراد الملفات** — textarea في قسم استيراد الملف يُمرَّر كـ extra_prompt للـ backend
- [x] **PATCH /api/admin/questions/pending/{id}** — endpoint جديد لتحديث حقول الأسئلة المعلقة


- [x] **Paylink.sa Payment Gateway** — `services/payment/paylinkService.py`
  - Auth → Create Invoice → Redirect to Paylink → Verify payment
  - Endpoints: POST /api/paylink/initiate, GET /api/paylink/verify/{txn}, GET /api/paylink/status/{txn}
- [x] **AI Question Import System** — POST /api/admin/questions/import
  - Supports Excel (.xlsx/.xls), CSV, JSON
  - Auto-maps difficulty: 300=Easy, 600=Medium, 900=Hard
- [x] **Admin Approval Workflow (Staging)**
  - GET /api/admin/questions/pending
  - POST /api/admin/questions/{id}/approve
  - POST /api/admin/questions/{id}/reject
  - POST /api/admin/questions/approve-all
  - "مراجعة الأسئلة" tab in AdminDashboard
- [x] **AI Generate 18 Questions (6+6+6)** — mode="full18"
  - Saves directly to pending queue for review
- [x] **Fixed Gameplay Image Bug** — Race condition in parallel Unsplash fetches
  - Collect all results first, then batch-update state
- [x] **Soft-deleted question filter in gameplay** — `deleted_at: None` filter
- [x] **DB Indexing** on startup for scale (8000+ questions)
- [x] **PricingPage** updated for Paylink (name/mobile modal)
- [x] **PaymentSuccessPage** updated for Paylink transaction verification

---

## P0/P1/P2 Remaining Backlog

### P0 — Critical
- [ ] Verify Paylink integration works end-to-end with real payment (requires live environment)
- [ ] Question image display: confirm images are correctly saved when admin approves AI questions with Unsplash images in pending review

### P1 — Important
- [ ] Question Repetition Prevention — currently uses `answered_question_ids` per user (basic). Could enhance with `user_answered_questions` collection for richer tracking
- [ ] AI Image Pipeline for pending questions — when approving, auto-fetch Unsplash if `image_query` present but `image_url` empty

### P2 — Nice to Have
- [ ] Pagination for question list (currently loads all in memory)
- [ ] Question search/filter by text in admin
- [ ] Bulk question edit in admin
- [ ] Tournament bracket improvements
- [ ] User profile page with stats
- [ ] Push notifications for subscription expiry

---

## 3rd Party Integrations
- **Paylink.sa** — Payment gateway (PAYMENT_API_ID, PAYMENT_API_KEY in .env)
- **Google Gemini** — AI question generation (via Emergent LLM Key)
- **Unsplash API** — Question images
- **SMTP/Gmail** — Email notifications

## Key API Endpoints
- `POST /api/paylink/initiate` — Start Paylink payment
- `GET /api/paylink/verify/{txn}` — Verify and activate subscription
- `POST /api/admin/questions/import` — File upload (Excel/CSV/JSON)
- `GET /api/admin/questions/pending` — Staging area
- `POST /api/admin/questions/{id}/approve` — Move to live
- `POST /api/admin/questions/approve-all` — Bulk approve
- `POST /api/ai/generate-questions` — AI generation (mode=full18 for 18 questions)
- `POST /api/game/session/{id}/question` — Get next question (excludes deleted)
