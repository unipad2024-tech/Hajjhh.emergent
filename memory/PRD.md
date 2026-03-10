# HUJJAH (حُجّة) - PRD

## Project Overview
HUJJAH is a competitive team trivia social game website for Saudi Arabian gatherings. It's a Jeopardy-style game for groups of friends, families, and events.

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
2. Jeopardy-style board with 7 categories × 3 difficulty levels (200/400/600)
3. Each team selects 3 categories (6 total on board)
4. 75-second countdown timer with tension sound
5. Answer reveal with team point assignment
6. Special "ولا كلمة" category with QR code secret word system
7. Admin panel (password protected) for question/category management
8. Arabic-only interface, Saudi casual dialect
9. Deep Burgundy (#5B0E14) + Golden Sand (#F1E194) color scheme
10. Cairo font for premium Arabic typography

## What's Been Implemented

### Backend (FastAPI) - Completed 2026-03-10
- Auth: JWT admin login (ADMIN_PASSWORD env var, default hujjah2024)
- Categories API: CRUD (7 default categories seeded)
- Questions API: CRUD with category/difficulty filter (210 questions seeded, short answers)
- Game Session API: Create/read/update, random unused question per tile, score update
- Secret Word API: GET /api/secret/{question_id} for QR mobile reveal
- Seed Endpoint: POST /api/seed with force=true for re-seeding

### Frontend (React RTL) - Completed 2026-03-10
- HomePage: Dark game-show background, large حُجّة title, categories preview, animated CTA
- TeamSetupPage: Enter team names, VS divider, form validation
- CategorySelectPage: Team 1 then Team 2 each pick 3 categories (disabled if Team 1 picked)
- GameBoardPage: Dark Jeopardy grid, animated ScoreCounter, confetti on win, winner modal, force-end game
- QuestionPage: 75s timer SVG ring, tension sound at 10s, buzz on 0s, answer reveal with animation, team point buttons (red/blue), correct sound, QR code for secret word category
- SecretWordPage: Mobile QR scan page showing secret word in large gold text
- AdminLoginPage: Password-protected entry
- AdminDashboard: Full CRUD questions & categories, question count stats per category

### Data
- 210 Questions seeded: 10 per difficulty (200/400/600) per category × 7 = 210
- Short answers: "7" not "7 أيام", "الرياض" not "الرياض العاصمة"
- Flag images from flagcdn.com (auto in seed)

### Testing (Iteration 2 - 2026-03-10)
- Backend: 100% (22/22 tests)
- Frontend: 100% all flows

## P0/P1/P2 Backlog

### P0 (Critical - done ✓)
- [x] Full game flow
- [x] Admin CRUD
- [x] QR secret word system
- [x] Timer with sound

### P1 (High priority - next)
- [ ] Image upload support (currently URL-based only)
- [ ] Sound effects library (correct/wrong answer sounds)
- [ ] Animated score counter on game board
- [ ] End-of-game winner celebration screen
- [ ] Export/print game results

### P2 (Nice to have)
- [ ] Multiple game room support
- [ ] Custom categories creation in game UI (non-admin)
- [ ] Team avatar/color picker
- [ ] Question preview in admin before saving
- [ ] Game history/stats

## API Endpoints
- POST /api/auth/login
- GET /api/auth/verify
- GET /api/categories
- POST /api/categories [admin]
- PUT/DELETE /api/categories/{id} [admin]
- GET /api/questions
- POST /api/questions [admin]
- PUT/DELETE /api/questions/{id} [admin]
- POST /api/game/session
- GET /api/game/session/{id}
- PUT /api/game/session/{id}
- POST /api/game/session/{id}/question
- POST /api/game/session/{id}/score
- GET /api/secret/{question_id}
- POST /api/seed [admin]

## Environment Variables
- Backend: MONGO_URL, DB_NAME, CORS_ORIGINS, JWT_SECRET_KEY, ADMIN_PASSWORD
- Frontend: REACT_APP_BACKEND_URL

## Deployment Notes
- Run `POST /api/seed` once with admin token to seed initial questions
- Admin default password: hujjah2024 (change via ADMIN_PASSWORD env var)
- RTL layout requires `dir="rtl"` on root (set in App.js)
