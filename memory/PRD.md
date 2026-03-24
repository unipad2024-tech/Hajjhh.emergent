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

## Documentation
- `/app/DOCUMENTATION.md` — التوثيق التقني الشامل (2355 سطر، 16 قسم كامل)
  - المعمارية المستهدفة: Vercel + Railway + Supabase (PostgreSQL)
  - يشمل: Schema كامل، API، Auth، Stripe، Gemini، دليل إعادة البناء
  - آخر تحديث: فبراير 2026

## CHANGELOG

### Mar 2026 — Categories, UI & Admin Control
- **3 new letter-based categories** seeded: أمثال شعبية (cat_proverbs), حرف وكلمة (cat_letters), من أنا؟ (cat_whois) — 20 questions each (60 total), total question bank now ~670
- **is_active field** on categories — admin can deactivate/activate any category; inactive ones hidden from game, shown dim in admin
- **PAYMENT_SECRET_KEY** added to backend .env (backend-only, never exposed to frontend)
- **GameModeSelectPage redesign** — full-screen hero layout, 2 large cards (Standard / Tournament), الأكثر شيوعاً badge
- **CategorySelectPage** — taller cards (minHeight 160px+), bigger images (height 180px), wider grid
- **Admin dashboard** — is_active toggle checkbox in category form, dim+red-dot for inactive categories in sidebar, show_inactive=true param for full category list
- All 10 tests PASS (100%) — iter_15


- **Removed multi-team mode** (3/4 teams) completely — deleted MultiTeamSetupPage/MultiTeamBoardPage, removed routes, cleaned GameContext
- **Tournament Bracket redesign** (`/tournament/bracket`): full visual overhaul with RoundColumn/Connector/MatchCard components, gold connector lines, glow on active match, pulsing border, champion overlay with confetti, progress bar, next-match banner
- **Auto-winner detection**: GameBoardPage stores `currentMatchRef` in tournament state; winner screen auto-records result when returning to bracket
- **GameModeSelectPage**: now only 2 modes (Standard + Tournament), larger cards, cleaner layout
- **data-testids added**: next-match-banner, bracket-progress for testability
- All 15 tests PASS (100%)


- **Game Mode Select Page** (`/mode`): 3 cards (Standard / Multi-team / Tournament) — 'العب الحين' now routes here
- **Multi-Team Mode** (`/multi-setup`, `/multi-game`): 3 or 4 teams, each with own column (300/600/900×2 slots), auto-assigned categories, full GMP panel with N-team score adjust + turn control
- **Tournament Mode** (`/tournament`, `/tournament/bracket`): 4/6/8 teams, auto bracket generation (QF→SF→Final), match play/record, champion banner
- **Premium Bug Fix**: `CategorySelectPage` calls `refreshUser()` on mount — admin-upgraded users now immediately see unlocked categories
- **GMP Button Redesign**: From tiny ⚙ icon → wide pill `⚙ لوحة المضيف` (min-width 140px, burgundy gradient, gold border)
- **QuestionPage Multi-Mode**: Score assignment buttons dynamically show all multi-team members instead of 2-team buttons
- **Back to Tournament**: Winner screen in GameBoardPage shows '🏆 العودة للبطولة' when `gameMode === "tournament"`

### Feb 2026 — UI/UX Improvements (Items 8-10)
- **Team Size Recommendation**: Added non-blocking tip "💡 يُنصح بلاعبين أو أكثر لكل فريق" on TeamSetupPage
- **Larger Timer**: SVG timer on QuestionPage scaled to clamp(130px, 16vh, 210px) — 173px on 1080p TV
- **Larger Team Names**: Game board score bar team names clamp(1.1rem, 2.8vw, 2.2rem), scores clamp(2.2rem, 5vw, 4.2rem)
- **Larger Score Buttons**: Assign buttons show team name (1.7rem) + points (4.5rem) for TV readability
- **Bigger Category Names**: clamp(0.85rem, 1.8vw, 1.3rem) on board cards


- **Game State Sync**: Moved selectedQuestions, currentQuestion, teamScores, remainingTime to central GameContext. markTileUsed/isTileUsed prevent race conditions.
- **AI Generator + Prompt**: Added custom `prompt_description` textarea in admin AI tab. Backend passes it to Gemini.
- **Premium Categories**: Added 10 premium locked categories (cat_football, cat_anime, cat_movies, cat_games, cat_history, cat_geo, cat_tech, cat_food, cat_cars, cat_space) with 150 starter questions. Free users see locked categories with gold lock icon.
- **Payment Prep**: Added PAYMENT_PUBLIC_KEY/PAYMENT_SECRET_KEY env vars + /api/payment/config endpoint.
- **Admin Control**: Added is_premium checkbox to category form. Admin can manage premium categories.
- **UI**: Bigger score buttons (3.5rem), pulsing turn indicator, larger category cards.

### P0 (done ✓)
- Admin panel: full CRUD, AI generator with custom prompt
- Dynamic trial mode manager
- Game state central sync (GameContext)
- 20 categories: 10 free + 10 premium (locked for free users)
- 608 questions total
- **Game Master Panel**: score adjust (+/-), direct score edit, turn control, tile restore — Feb 2026
- **Timer Controls**: pause/resume/reset/restart in QuestionPage — Feb 2026
- **Bug Fix**: Winner screen scores display (scores→teamScores) — Feb 2026
- **Bug Fix**: GMP toggle button z-index raised above Emergent badge — Feb 2026

### P1 (backlog)
- Supabase migration
- Stripe live keys
- More premium questions (use AI generator)

### P2 (future)
- Multi-room support
- User game history analytics
- Custom user-created categories

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
- [x] AI Question Generator tab in Admin (Google Gemini API - gemini-flash-lite-latest, NO credits)
- [x] Trial Mode: fully DYNAMIC - CategorySelectPage reads from /api/free-categories
- [x] Experimental Mode Manager tab: full CRUD for trial categories/questions
  - Enable/disable trial mode toggle
  - Team1 + Team2 category pickers (3 each)
  - Questions list with toggle/edit/delete + is_experimental flag
  - trial_questions_only option (show only marked questions to free users)
- [x] is_trial flag auto-set in game session (true for non-premium users)
- [x] GameBoard Score Bar redesigned: team names large (clamp 0.85-1.5rem), scores huge (clamp 2-3.8rem)
- [x] Active team block glows (red/blue shadow) to show whose turn it is
- [x] Turn indicator enlarged with colored border + glow effect
- [x] Dark mode toggle properly sized (text-sm with padding)
- [x] QuestionPage top bar: team names and scores larger, clearly visible
- [x] Team answer buttons enlarged (2x size) in QuestionPage
- [x] Homepage cleaned: removed categories grid, replaced Arabic numerals ١٢٣ with 1,2,3
- [x] Trial Mode Control in Settings tab: admin selects free categories via checkboxes

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
