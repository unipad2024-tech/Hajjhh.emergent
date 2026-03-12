# HUJJAH (حُجّة) - PRD

## Project Overview
HUJJAH is a competitive team trivia social game for Saudi gatherings, now transformed into a SaaS platform.

## Architecture
- **Frontend**: React.js (RTL/Arabic, Cairo font, Burgundy/Gold theme)
- **Backend**: FastAPI + Python
- **Database**: MongoDB
- **Deployment**: Emergent Platform

## User Personas
- Saudi families and friend groups at social gatherings
- Event hosts running trivia nights
- Non-technical users (simple UI required)
- Displayed on large TV screens at events

## Core Requirements (Static)
1. Team vs Team gameplay (2 teams)
2. Jeopardy-style board with categories × 3 difficulty levels (200/400/600)
3. Each team selects 3 categories (6 total on board)
4. 75-second countdown timer with tension sound
5. Answer reveal with team point assignment
6. Special "ولا كلمة" category with QR code secret word system
7. Admin panel (password protected) for question/category management
8. Arabic-only interface, Saudi casual dialect
9. Deep Burgundy (#5B0E14) + Golden Sand (#F1E194) color scheme
10. Cairo font for premium Arabic typography
11. **SaaS**: Optional user accounts (free/premium tiers)
12. **SaaS**: Premium subscription via Stripe (non-repeating questions globally)

## Access Tiers
- **Guest (no account)**: Can play freely, questions may repeat
- **Free account**: Registered user, game count tracked, questions may repeat per-session
- **Premium account (paid)**: Questions never repeat globally across all sessions, tracked history

## What's Been Implemented

### Backend (FastAPI/MongoDB) - COMPLETE as of 2026-03-12
- User Auth: JWT register/login (/api/auth/register, /api/auth/login, /api/auth/me)
- Admin Auth: Password-based JWT (/api/admin/login, /api/admin/verify)
- Categories API: Full CRUD (10 categories seeded)
- Questions API: Full CRUD, no limit (450 questions seeded)
- Game Session: Create/read/update, random question per tile
- Premium feature: Non-repeating questions globally (tracked per user)
- Admin APIs: Users management, analytics, payment history
- Stripe integration: Checkout session + webhook + status check
- Subscription Plans: Monthly ($9.99) + Annual ($79.99)
- Seed endpoint: POST /api/seed with force=true
- **NEW** Game Settings API: GET/PUT /api/settings (default timer, word timers)
- **NEW** File Upload API: POST /api/upload (PNG/JPG/WEBP, max 5MB)
- Static file serving: /api/static/uploads/

### Frontend (React RTL) - COMPLETE as of 2026-03-12
- HomePage: User bar (login/signup links), categories grid (10), subscription notice for free users
- LoginPage: Email + password form, JWT stored in localStorage
- SignupPage: Email + username + password + confirm form
- PricingPage: Tier comparison (Guest/Free/Premium) + plan cards + upgrade CTA
- PaymentSuccessPage: Stripe redirect handler, status check
- TeamSetupPage: Enter team names, VS divider
- CategorySelectPage: Team 1 then Team 2 each pick 3 categories
- GameBoardPage: Dark Jeopardy grid, animated ScoreCounter, confetti on win
  - **NEW** Dark Mode toggle (☀️/🌙) with LIGHT/DARK palettes
  - **NEW** Warm gold/brown/red score buttons (not white)
- QuestionPage: Dynamic timer from settings, tension sound, answer reveal, team point buttons, QR for secret word
- SecretWordPage: Mobile QR scan page
- AdminLoginPage: Password-protected entry
- AdminDashboard: 4 tabs (Questions/Users/Analytics/Settings), full CRUD
  - **NEW** Settings tab: default timer + ولا كلمة timers (Easy/Medium/Hard)
  - **NEW** Image upload buttons in question form (question + answer images)
  - **NEW** Image upload buttons in category form
  - **NEW** Category edit (full CRUD: Create, Read, Update, Delete)

### GameContext
- User state: currentUser, userToken (from localStorage)
- Auth: loginUser, registerUser, logoutUser, refreshUser
- Game: createSession (passes user_id if logged in), getNextQuestion (passes Bearer token for premium)
- **NEW** darkMode state + toggleDarkMode
- **NEW** gameSettings state (default_timer, word_timers) loaded from /api/settings

### Data
- 10 Categories: اعلام دول، معلومات سهلة، السعودية، اسلامي، علوم بسيطة، شعارات، ولا كلمة، ثقافة شعبية، رياضة، موسيقى وفن
- 450 Questions seeded: 45 per category (15 per difficulty × 3 difficulties)
- Short answers: "7" not "7 أيام"

### Testing (Iteration 5 - 2026-03-10 - TV Redesign)
- Frontend: 100% (11/11 features)
- Redesign verified: 2×3 grid, 300/600/900, warm bg, real images, SAR pricing

## Environment Variables
- Backend: MONGO_URL, DB_NAME, CORS_ORIGINS, JWT_SECRET_KEY, ADMIN_PASSWORD, STRIPE_API_KEY
- Frontend: REACT_APP_BACKEND_URL

## Admin Credentials
- Password: hujjah2024 (ADMIN_PASSWORD env var)
- Login: /admin -> password -> /admin/dashboard

## P0/P1/P2 Backlog

### P0 (Critical - done ✓)
- [x] Full game flow
- [x] Admin CRUD
- [x] QR secret word system
- [x] Timer with sound
- [x] User registration/login (SaaS Phase 1)
- [x] Subscription tiers (free/premium)
- [x] Admin users & analytics dashboard
- [x] Stripe integration (mocked with test key)
- [x] 36-tile board: 6 categories × 6 tiles (2 per difficulty: slot1/slot2)
- [x] Real category images (Unsplash URLs)
- [x] Free user: 6 fixed locked categories
- [x] TV-style question screen (wide, full-height)
- [x] SAR pricing: 19.99 SAR/month, 149.99 SAR/year
- [x] Board fills full screen height/width
- [x] Dark mode toggle in GameBoardPage (LIGHT/DARK palettes)
- [x] Admin timer control: default_timer + ولا كلمة timers (Easy/Medium/Hard)
- [x] Score buttons warm gold/brown/red gradient (not white)
- [x] Image file upload system (PNG/JPG/WEBP, max 5MB)
- [x] Category full CRUD (Create/Edit/Delete with image upload)
- [x] Settings tab in Admin dashboard

### P1 (High priority - next)
- [ ] Generate 1000+ questions via AI (currently 450)
- [ ] Real Stripe key for production payments
- [ ] Sound effects library (correct/wrong answer sounds)
- [ ] Export/print game results
- [ ] Difficulty balance review: ensure 900-point questions are challenging but not frustrating

### P2 (Nice to have)
- [ ] Multiple game room support
- [ ] Custom categories creation in game UI
- [ ] Team avatar/color picker
- [ ] Game history/stats per user
- [ ] Email verification for new accounts
- [ ] Password reset flow
- [ ] Backend refactoring: split server.py into modules (auth.py, admin.py, game.py, subscriptions.py)

## API Endpoints
- POST /api/auth/register
- POST /api/auth/login
- GET /api/auth/me
- PUT /api/auth/me
- POST /api/admin/login
- GET /api/admin/verify
- GET /api/admin/users
- PUT /api/admin/users/{id}
- DELETE /api/admin/users/{id}
- GET /api/admin/analytics
- GET /api/admin/sessions
- GET /api/admin/payments
- GET /api/categories
- POST /api/categories [admin]
- PUT/DELETE /api/categories/{id} [admin]
- GET /api/questions
- GET /api/questions/count
- POST /api/questions [admin]
- PUT/DELETE /api/questions/{id} [admin]
- POST /api/game/session
- GET /api/game/session/{id}
- PUT /api/game/session/{id}
- POST /api/game/session/{id}/question
- POST /api/game/session/{id}/score
- GET /api/secret/{question_id}
- GET /api/subscription/plans
- POST /api/subscription/checkout
- GET /api/subscription/status/{stripe_session_id}
- POST /api/webhook/stripe
- POST /api/seed [admin]
- GET /api/settings
- PUT /api/settings [admin]
- POST /api/upload [admin]

## Deployment Notes
- Run `POST /api/seed?force=true` with admin token to seed data
- Admin default password: hujjah2024 (change via ADMIN_PASSWORD env var)
- RTL layout requires `dir="rtl"` on root (set in App.js)
- Stripe: replace STRIPE_API_KEY with real key for production payments
