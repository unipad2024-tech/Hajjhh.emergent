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
- **Auth**: JWT-based admin login (password: hujjah2024 via env)
- **Categories API**: CRUD for 7 default categories
- **Questions API**: CRUD with category/difficulty filtering (210 seeded questions)
- **Game Session API**: Create, read, update sessions
- **Question Fetch**: Random unused question for category+difficulty
- **Score Update**: Real-time score tracking per team
- **Secret Word API**: GET /api/secret/{question_id} for QR mobile reveal
- **Seed Endpoint**: POST /api/seed seeds all 210 questions

### Frontend (React) - Completed 2026-03-10
- **HomePage**: Welcoming landing with title, categories preview, instructions
- **TeamSetupPage**: Enter team names (Team 1 & Team 2)
- **CategorySelectPage**: Each team picks 3 categories (with visual selection state)
- **GameBoardPage**: Jeopardy grid (6 cats × 3 difficulties = 18 tiles), real-time scores
- **QuestionPage**: Full-screen question, 75s timer, answer reveal, point assignment, QR for secret words
- **SecretWordPage**: Mobile QR scan page showing secret word
- **AdminLoginPage**: Password-protected admin entry
- **AdminDashboard**: Full CRUD for questions & categories with filtering

### Data
- 7 Categories: اعلام دول, معلومات سهلة, السعودية, اسلامي, علوم بسيطة, شعارات, ولا كلمة
- 210 Questions: 10 per difficulty per category (30 per category × 7 = 210)
- Flag images from flagcdn.com (automatic in seed)

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
