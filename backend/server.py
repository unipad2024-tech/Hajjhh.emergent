from fastapi import FastAPI, APIRouter, HTTPException, Depends, Header, Request, BackgroundTasks, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from dotenv import load_dotenv
from motor.motor_asyncio import AsyncIOMotorClient
import os, logging, uuid, random, shutil, re, json, httpx
from pathlib import Path
from pydantic import BaseModel, EmailStr, Field
from typing import List, Optional, Dict
from datetime import datetime, timezone, timedelta
from jose import jwt, JWTError
from passlib.context import CryptContext
from emergentintegrations.payments.stripe.checkout import (
    StripeCheckout, CheckoutSessionRequest, CheckoutSessionResponse, CheckoutStatusResponse
)

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

app = FastAPI()
api_router = APIRouter(prefix="/api")

# ─── Static files for uploaded images ────────────────────────────────────────
UPLOAD_DIR = ROOT_DIR / "static" / "uploads"
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
app.mount("/api/static", StaticFiles(directory=str(ROOT_DIR / "static")), name="static")

SECRET_KEY      = os.environ.get('JWT_SECRET_KEY', 'hujjah_secret_2024')
ADMIN_PASSWORD  = os.environ.get('ADMIN_PASSWORD', 'hujjah2024')
STRIPE_API_KEY  = os.environ.get('STRIPE_API_KEY', '')
ALGORITHM       = "HS256"

pwd_ctx = CryptContext(schemes=["bcrypt"], deprecated="auto")
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# ─── Subscription Plans (server-side only – never from frontend) ────────────
SUBSCRIPTION_PLANS = {
    "monthly": {"name": "Premium شهري",   "amount": 29.99, "currency": "sar", "days": 30},
    "annual":  {"name": "Premium سنوي",   "amount": 239.99,"currency": "sar", "days": 365},
}

FREE_CATEGORIES = ["cat_word", "cat_islamic", "cat_music", "cat_flags", "cat_easy", "cat_science"]

# ══════════════════════════════════════════════════════════════════════════════
# MODELS
# ══════════════════════════════════════════════════════════════════════════════

class UserCreate(BaseModel):
    email: str
    username: str
    password: str

class UserLogin(BaseModel):
    email: str
    password: str

class UserUpdate(BaseModel):
    username: Optional[str] = None
    password: Optional[str] = None

class AdminLogin(BaseModel):
    password: str

class AdminUserUpdate(BaseModel):
    subscription_type: str
    subscription_expires_at: Optional[str] = None

class Category(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    description: str = ""
    icon: str = ""
    image_url: str = ""
    is_special: bool = False
    color: str = "#5B0E14"
    order: int = 0
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())

class CategoryCreate(BaseModel):
    name: str
    description: str = ""
    icon: str = ""
    image_url: str = ""
    is_special: bool = False
    color: str = "#5B0E14"
    order: int = 0

class Question(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    category_id: str
    difficulty: int
    text: str
    answer: str
    image_url: str = ""
    answer_image_url: str = ""
    question_type: str = "text"
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())

class QuestionCreate(BaseModel):
    category_id: str
    difficulty: int
    text: str
    answer: str
    image_url: str = ""
    answer_image_url: str = ""
    question_type: str = "text"

class GameSessionCreate(BaseModel):
    team1_name: str
    team2_name: str
    user_id: Optional[str] = None

class GameSessionUpdate(BaseModel):
    team1_name: Optional[str] = None
    team2_name: Optional[str] = None
    team1_score: Optional[int] = None
    team2_score: Optional[int] = None
    team1_categories: Optional[List[str]] = None
    team2_categories: Optional[List[str]] = None
    used_questions: Optional[List[str]] = None
    status: Optional[str] = None

class ScoreUpdate(BaseModel):
    team: int
    points: int
    question_id: Optional[str] = None

class CheckoutCreate(BaseModel):
    plan_id: str
    origin_url: str

class MarkAnswered(BaseModel):
    question_id: str

# ══════════════════════════════════════════════════════════════════════════════
# AUTH HELPERS
# ══════════════════════════════════════════════════════════════════════════════

def hash_pw(pw: str) -> str:
    return pwd_ctx.hash(pw)

def verify_pw(pw: str, hashed: str) -> bool:
    return pwd_ctx.verify(pw, hashed)

def create_token(payload: dict, expires_hours: int = 24) -> str:
    p = {**payload, "exp": datetime.now(timezone.utc) + timedelta(hours=expires_hours)}
    return jwt.encode(p, SECRET_KEY, algorithm=ALGORITHM)

async def get_admin(authorization: Optional[str] = Header(None)):
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(401, "غير مصرح")
    try:
        data = jwt.decode(authorization.split(" ")[1], SECRET_KEY, algorithms=[ALGORITHM])
        if data.get("role") != "admin":
            raise HTTPException(403, "غير مصرح")
        return True
    except JWTError:
        raise HTTPException(401, "جلسة منتهية")

async def get_current_user(authorization: Optional[str] = Header(None)) -> Optional[dict]:
    if not authorization or not authorization.startswith("Bearer "):
        return None
    try:
        data = jwt.decode(authorization.split(" ")[1], SECRET_KEY, algorithms=[ALGORITHM])
        if data.get("role") != "user":
            return None
        user = await db.users.find_one({"id": data["sub"]}, {"_id": 0})
        return user
    except JWTError:
        return None

async def require_user(authorization: Optional[str] = Header(None)) -> dict:
    user = await get_current_user(authorization)
    if not user:
        raise HTTPException(401, "يجب تسجيل الدخول أولاً")
    return user

# ══════════════════════════════════════════════════════════════════════════════
# USER AUTH ROUTES
# ══════════════════════════════════════════════════════════════════════════════

@api_router.post("/auth/register")
async def register(body: UserCreate):
    if len(body.password) < 6:
        raise HTTPException(400, "كلمة المرور يجب أن تكون 6 أحرف على الأقل")
    existing = await db.users.find_one({"email": body.email.lower()})
    if existing:
        raise HTTPException(409, "البريد الإلكتروني مسجل مسبقاً")
    existing_u = await db.users.find_one({"username": body.username})
    if existing_u:
        raise HTTPException(409, "اسم المستخدم محجوز")
    user = {
        "id": str(uuid.uuid4()),
        "email": body.email.lower().strip(),
        "username": body.username.strip(),
        "password_hash": hash_pw(body.password),
        "subscription_type": "free",
        "subscription_expires_at": None,
        "answered_question_ids": [],
        "game_count": 0,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "last_active": datetime.now(timezone.utc).isoformat(),
    }
    await db.users.insert_one(user)
    token = create_token({"sub": user["id"], "role": "user", "email": user["email"]})
    safe = {k: v for k, v in user.items() if k not in ("_id", "password_hash", "answered_question_ids")}
    return {"token": token, "user": safe}

@api_router.post("/auth/login")
async def login(body: UserLogin):
    user = await db.users.find_one({"email": body.email.lower()})
    if not user or not verify_pw(body.password, user.get("password_hash", "")):
        raise HTTPException(401, "البريد أو كلمة المرور غلط")
    await db.users.update_one({"id": user["id"]}, {"$set": {"last_active": datetime.now(timezone.utc).isoformat()}})
    token = create_token({"sub": user["id"], "role": "user", "email": user["email"]})
    safe = {k: v for k, v in user.items() if k not in ("_id", "password_hash", "answered_question_ids")}
    return {"token": token, "user": safe}

@api_router.get("/auth/me")
async def get_me(user: dict = Depends(require_user)):
    safe = {k: v for k, v in user.items() if k not in ("_id", "password_hash", "answered_question_ids")}
    safe["answered_count"] = len(user.get("answered_question_ids", []))
    return safe

@api_router.put("/auth/me")
async def update_me(body: UserUpdate, user: dict = Depends(require_user)):
    updates = {}
    if body.username:
        ex = await db.users.find_one({"username": body.username, "id": {"$ne": user["id"]}})
        if ex:
            raise HTTPException(409, "اسم المستخدم محجوز")
        updates["username"] = body.username
    if body.password:
        if len(body.password) < 6:
            raise HTTPException(400, "كلمة المرور قصيرة")
        updates["password_hash"] = hash_pw(body.password)
    if updates:
        await db.users.update_one({"id": user["id"]}, {"$set": updates})
    updated = await db.users.find_one({"id": user["id"]}, {"_id": 0, "password_hash": 0})
    return updated

# ══════════════════════════════════════════════════════════════════════════════
# ADMIN AUTH
# ══════════════════════════════════════════════════════════════════════════════

@api_router.post("/admin/login")
async def admin_login(body: AdminLogin):
    if body.password != ADMIN_PASSWORD:
        raise HTTPException(401, "كلمة المرور غلط")
    token = create_token({"sub": "admin", "role": "admin"}, expires_hours=48)
    return {"token": token}

@api_router.get("/admin/verify")
async def admin_verify(_: bool = Depends(get_admin)):
    return {"valid": True}

# Keep backward compat
@api_router.post("/auth/admin-login")
async def admin_login_legacy(body: AdminLogin):
    return await admin_login(body)

@api_router.get("/auth/verify")
async def verify_legacy(_: bool = Depends(get_admin)):
    return {"valid": True}

# ══════════════════════════════════════════════════════════════════════════════
# ADMIN – USERS & ANALYTICS
# ══════════════════════════════════════════════════════════════════════════════

@api_router.get("/admin/users")
async def admin_list_users(_: bool = Depends(get_admin)):
    users = await db.users.find({}, {"_id": 0, "password_hash": 0, "answered_question_ids": 0}).to_list(1000)
    for u in users:
        u["answered_count"] = 0
        full = await db.users.find_one({"id": u["id"]}, {"answered_question_ids": 1})
        if full:
            u["answered_count"] = len(full.get("answered_question_ids", []))
    return users

@api_router.put("/admin/users/{user_id}")
async def admin_update_user(user_id: str, body: AdminUserUpdate, _: bool = Depends(get_admin)):
    updates = {"subscription_type": body.subscription_type}
    if body.subscription_expires_at:
        updates["subscription_expires_at"] = body.subscription_expires_at
    elif body.subscription_type == "premium":
        expires = (datetime.now(timezone.utc) + timedelta(days=30)).isoformat()
        updates["subscription_expires_at"] = expires
    else:
        updates["subscription_expires_at"] = None
    await db.users.update_one({"id": user_id}, {"$set": updates})
    user = await db.users.find_one({"id": user_id}, {"_id": 0, "password_hash": 0})
    return user

@api_router.delete("/admin/users/{user_id}")
async def admin_delete_user(user_id: str, _: bool = Depends(get_admin)):
    await db.users.delete_one({"id": user_id})
    return {"message": "تم الحذف"}

@api_router.get("/admin/analytics")
async def admin_analytics(_: bool = Depends(get_admin)):
    now = datetime.now(timezone.utc)
    yesterday  = (now - timedelta(days=1)).isoformat()
    week_ago   = (now - timedelta(days=7)).isoformat()
    month_ago  = (now - timedelta(days=30)).isoformat()

    users_total   = await db.users.count_documents({})
    premium       = await db.users.count_documents({"subscription_type": "premium"})
    recent_7d     = await db.users.count_documents({"created_at": {"$gte": week_ago}})
    q_total       = await db.questions.count_documents({})
    sessions_total= await db.game_sessions.count_documents({})
    active_24h    = await db.game_sessions.count_documents({"created_at": {"$gte": yesterday}})
    revenue_docs  = await db.payment_transactions.find({"payment_status": "paid"}, {"amount": 1}).to_list(1000)
    total_revenue = sum(float(d.get("amount", 0)) for d in revenue_docs)
    recent_txns   = await db.payment_transactions.find({}, {"_id": 0}).sort("created_at", -1).to_list(10)

    cats = await db.categories.find({}, {"_id": 0, "id": 1, "name": 1}).to_list(50)
    cat_stats = []
    for c in cats:
        count = await db.questions.count_documents({"category_id": c["id"]})
        cat_stats.append({"id": c["id"], "name": c["name"], "count": count})

    return {
        "users":    {"total": users_total, "premium": premium, "free": users_total - premium, "recent_7d": recent_7d},
        "questions": {"total": q_total, "by_category": cat_stats},
        "sessions": {"total": sessions_total, "active_24h": active_24h},
        "revenue":  {"total": round(total_revenue, 2), "currency": "USD", "recent_transactions": recent_txns},
    }

@api_router.get("/admin/sessions")
async def admin_sessions(_: bool = Depends(get_admin)):
    sessions = await db.game_sessions.find({}, {"_id": 0}).sort("created_at", -1).to_list(50)
    return sessions

@api_router.get("/admin/payments")
async def admin_payments(_: bool = Depends(get_admin)):
    txns = await db.payment_transactions.find({}, {"_id": 0}).sort("created_at", -1).to_list(100)
    return txns

# ══════════════════════════════════════════════════════════════════════════════
# CATEGORIES
# ══════════════════════════════════════════════════════════════════════════════

@api_router.get("/categories")
async def get_categories():
    return await db.categories.find({}, {"_id": 0}).sort("order", 1).to_list(100)

@api_router.get("/free-categories")
async def get_free_categories():
    s = await db.settings.find_one({"key": "game_settings"}, {"_id": 0})
    settings = {**DEFAULT_SETTINGS, **(s or {})}
    t1 = settings.get("trial_team1_categories", DEFAULT_SETTINGS["trial_team1_categories"])
    t2 = settings.get("trial_team2_categories", DEFAULT_SETTINGS["trial_team2_categories"])
    all_ids = list(dict.fromkeys(t1 + t2))  # preserve order, no duplicates
    cats = await db.categories.find({"id": {"$in": all_ids}}, {"_id": 0}).to_list(20)
    cats_map = {c["id"]: c for c in cats}
    return {
        "trial_enabled":          settings.get("trial_enabled", True),
        "trial_team1_categories": t1,
        "trial_team2_categories": t2,
        "team1_categories":       [cats_map[i] for i in t1 if i in cats_map],
        "team2_categories":       [cats_map[i] for i in t2 if i in cats_map],
        "category_ids":           all_ids,
        "categories":             cats,
    }

@api_router.post("/categories")
async def create_category(body: CategoryCreate, _: bool = Depends(get_admin)):
    cat = Category(**body.model_dump())
    await db.categories.insert_one(cat.model_dump())
    return cat

@api_router.put("/categories/{cat_id}")
async def update_category(cat_id: str, body: CategoryCreate, _: bool = Depends(get_admin)):
    upd = {**body.model_dump(), "updated_at": datetime.now(timezone.utc).isoformat()}
    res = await db.categories.find_one_and_update({"id": cat_id}, {"$set": upd}, {"_id": 0}, return_document=True)
    if not res:
        raise HTTPException(404, "الفئة غير موجودة")
    return res

@api_router.delete("/categories/{cat_id}")
async def delete_category(cat_id: str, _: bool = Depends(get_admin)):
    await db.categories.delete_one({"id": cat_id})
    await db.questions.delete_many({"category_id": cat_id})
    return {"message": "تم الحذف"}

# ══════════════════════════════════════════════════════════════════════════════
# QUESTIONS  (no limit – admin can add unlimited)
# ══════════════════════════════════════════════════════════════════════════════

@api_router.get("/questions")
async def get_questions(category_id: Optional[str] = None, difficulty: Optional[int] = None):
    q = {}
    if category_id: q["category_id"] = category_id
    if difficulty:  q["difficulty"]   = difficulty
    return await db.questions.find(q, {"_id": 0}).to_list(10000)

@api_router.get("/questions/count")
async def count_questions(category_id: Optional[str] = None, difficulty: Optional[int] = None):
    q = {}
    if category_id: q["category_id"] = category_id
    if difficulty:  q["difficulty"]   = difficulty
    return {"count": await db.questions.count_documents(q)}

@api_router.get("/questions/{q_id}")
async def get_question(q_id: str):
    q = await db.questions.find_one({"id": q_id}, {"_id": 0})
    if not q: raise HTTPException(404, "السؤال غير موجود")
    return q

@api_router.post("/questions")
async def create_question(body: QuestionCreate, _: bool = Depends(get_admin)):
    q = Question(**body.model_dump())
    await db.questions.insert_one(q.model_dump())
    return q

@api_router.put("/questions/{q_id}")
async def update_question(q_id: str, body: QuestionCreate, _: bool = Depends(get_admin)):
    upd = {**body.model_dump(), "updated_at": datetime.now(timezone.utc).isoformat()}
    res = await db.questions.find_one_and_update({"id": q_id}, {"$set": upd}, {"_id": 0}, return_document=True)
    if not res: raise HTTPException(404, "السؤال غير موجود")
    return res

@api_router.delete("/questions/{q_id}")
async def delete_question(q_id: str, _: bool = Depends(get_admin)):
    await db.questions.delete_one({"id": q_id})
    return {"message": "تم الحذف"}

@api_router.patch("/questions/{q_id}/experimental")
async def toggle_experimental(q_id: str, body: dict, _: bool = Depends(get_admin)):
    val = body.get("is_experimental", True)
    await db.questions.update_one({"id": q_id}, {"$set": {"is_experimental": val}})
    return {"id": q_id, "is_experimental": val}

# ══════════════════════════════════════════════════════════════════════════════
# GAME SESSION
# ══════════════════════════════════════════════════════════════════════════════

@api_router.post("/game/session")
async def create_session(body: GameSessionCreate, authorization: Optional[str] = Header(None)):
    user = await get_current_user(authorization)
    is_trial = not user or user.get("subscription_type") != "premium"
    session = {
        "id": str(uuid.uuid4()),
        "team1_name": body.team1_name,
        "team2_name": body.team2_name,
        "team1_score": 0,
        "team2_score": 0,
        "team1_categories": [],
        "team2_categories": [],
        "used_questions": [],
        "user_id": body.user_id,
        "is_trial": is_trial,
        "status": "setup",
        "created_at": datetime.now(timezone.utc).isoformat(),
        "updated_at": datetime.now(timezone.utc).isoformat(),
    }
    if body.user_id:
        await db.users.update_one({"id": body.user_id}, {"$inc": {"game_count": 1}})
    await db.game_sessions.insert_one(session)
    result = {k: v for k, v in session.items() if k != "_id"}
    return result

@api_router.get("/game/session/{session_id}")
async def get_session(session_id: str):
    s = await db.game_sessions.find_one({"id": session_id}, {"_id": 0})
    if not s: raise HTTPException(404, "الجلسة غير موجودة")
    return s

@api_router.put("/game/session/{session_id}")
async def update_session(session_id: str, body: GameSessionUpdate):
    upd = {k: v for k, v in body.model_dump().items() if v is not None}
    upd["updated_at"] = datetime.now(timezone.utc).isoformat()
    res = await db.game_sessions.find_one_and_update({"id": session_id}, {"$set": upd}, {"_id": 0}, return_document=True)
    if not res: raise HTTPException(404, "الجلسة غير موجودة")
    return res

@api_router.post("/game/session/{session_id}/question")
async def get_next_question(session_id: str, category_id: str, difficulty: int,
                            authorization: Optional[str] = Header(None)):
    session = await db.game_sessions.find_one({"id": session_id}, {"_id": 0})
    if not session: raise HTTPException(404, "الجلسة غير موجودة")

    exclude_ids = list(session.get("used_questions", []))
    is_trial    = session.get("is_trial", False)

    # Premium users: also exclude globally answered questions
    user = await get_current_user(authorization)
    is_premium = False
    if user:
        is_premium = (user.get("subscription_type") == "premium")
        if is_premium:
            is_trial = False
            exclude_ids = list(set(exclude_ids + user.get("answered_question_ids", [])))

    # Build base query
    base_q = {"category_id": category_id, "difficulty": difficulty, "id": {"$nin": exclude_ids}}

    # Trial sessions: filter only experimental questions (if any are marked)
    if is_trial:
        settings_doc = await db.settings.find_one({"key": "game_settings"}, {"_id": 0})
        use_trial_only = (settings_doc or {}).get("trial_questions_only", False)
        if use_trial_only:
            trial_q = {**base_q, "is_experimental": True}
            available = await db.questions.find(trial_q, {"_id": 0}).to_list(1000)
            if not available:
                # fallback: all questions if none tagged
                available = await db.questions.find(base_q, {"_id": 0}).to_list(1000)
        else:
            available = await db.questions.find(base_q, {"_id": 0}).to_list(1000)
    else:
        available = await db.questions.find(base_q, {"_id": 0}).to_list(1000)

    if not available:
        # Reset and try again (ignoring exclude list)
        reset_q = {"category_id": category_id, "difficulty": difficulty}
        if is_trial and (settings_doc if 'settings_doc' in dir() else {}).get("trial_questions_only"):
            reset_q["is_experimental"] = True
        available = await db.questions.find(reset_q, {"_id": 0}).to_list(1000)
        if not available:
            raise HTTPException(404, "لا يوجد أسئلة")

    question = random.choice(available)

    new_used = list(set(session.get("used_questions", []) + [question["id"]]))
    await db.game_sessions.update_one(
        {"id": session_id},
        {"$set": {"used_questions": new_used, "updated_at": datetime.now(timezone.utc).isoformat()}}
    )

    # Track for premium users
    if is_premium and user:
        await db.users.update_one(
            {"id": user["id"]},
            {"$addToSet": {"answered_question_ids": question["id"]}}
        )

    return question

@api_router.post("/game/session/{session_id}/score")
async def update_score(session_id: str, body: ScoreUpdate,
                       authorization: Optional[str] = Header(None)):
    session = await db.game_sessions.find_one({"id": session_id}, {"_id": 0})
    if not session: raise HTTPException(404, "الجلسة غير موجودة")

    field = "team1_score" if body.team == 1 else "team2_score"
    new_score = max(0, session.get(field, 0) + body.points)
    await db.game_sessions.update_one(
        {"id": session_id},
        {"$set": {field: new_score, "updated_at": datetime.now(timezone.utc).isoformat()}}
    )
    updated = await db.game_sessions.find_one({"id": session_id}, {"_id": 0})
    return {"team1_score": updated["team1_score"], "team2_score": updated["team2_score"]}

# ══════════════════════════════════════════════════════════════════════════════
# SECRET WORD (QR)
# ══════════════════════════════════════════════════════════════════════════════

@api_router.get("/secret/{question_id}")
async def get_secret_word(question_id: str):
    q = await db.questions.find_one({"id": question_id}, {"_id": 0})
    if not q: raise HTTPException(404, "الكلمة غير موجودة")
    return {"word": q.get("answer", ""), "image_url": q.get("image_url", ""), "difficulty": q.get("difficulty", 200)}

# ══════════════════════════════════════════════════════════════════════════════
# SUBSCRIPTIONS (STRIPE)
# ══════════════════════════════════════════════════════════════════════════════

@api_router.get("/subscription/plans")
async def get_plans():
    return [{"id": k, **v} for k, v in SUBSCRIPTION_PLANS.items()]

@api_router.post("/subscription/checkout")
async def create_checkout(body: CheckoutCreate, user: dict = Depends(require_user), request: Request = None):
    plan = SUBSCRIPTION_PLANS.get(body.plan_id)
    if not plan:
        raise HTTPException(400, "الخطة غير موجودة")
    if not STRIPE_API_KEY or STRIPE_API_KEY == "sk_test_emergent":
        raise HTTPException(503, "خدمة الدفع غير مفعّلة حتى الآن، تواصل مع الإدارة")

    origin = body.origin_url.rstrip("/")
    success_url = f"{origin}/payment/success?session_id={{CHECKOUT_SESSION_ID}}"
    cancel_url  = f"{origin}/pricing"

    stripe = StripeCheckout(api_key=STRIPE_API_KEY, webhook_url=f"{origin}/api/webhook/stripe")
    req = CheckoutSessionRequest(
        amount=plan["amount"],
        currency=plan["currency"],
        success_url=success_url,
        cancel_url=cancel_url,
        metadata={"user_id": user["id"], "plan_id": body.plan_id, "email": user["email"]},
    )
    session: CheckoutSessionResponse = await stripe.create_checkout_session(req)

    txn = {
        "id": str(uuid.uuid4()),
        "session_id": session.session_id,
        "user_id": user["id"],
        "email": user["email"],
        "plan_id": body.plan_id,
        "amount": plan["amount"],
        "currency": plan["currency"],
        "payment_status": "pending",
        "status": "initiated",
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.payment_transactions.insert_one(txn)
    return {"url": session.url, "session_id": session.session_id}

@api_router.get("/subscription/status/{stripe_session_id}")
async def check_payment_status(stripe_session_id: str, user: dict = Depends(require_user)):
    txn = await db.payment_transactions.find_one({"session_id": stripe_session_id}, {"_id": 0})
    if not txn:
        raise HTTPException(404, "الدفعة غير موجودة")

    # Already processed
    if txn.get("payment_status") == "paid":
        return {"payment_status": "paid", "status": "complete"}

    stripe = StripeCheckout(api_key=STRIPE_API_KEY, webhook_url="")
    checkout_status: CheckoutStatusResponse = await stripe.get_checkout_status(stripe_session_id)

    update = {
        "payment_status": checkout_status.payment_status,
        "status": checkout_status.status,
        "updated_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.payment_transactions.update_one({"session_id": stripe_session_id}, {"$set": update})

    if checkout_status.payment_status == "paid":
        plan_id = txn.get("plan_id", "monthly")
        plan    = SUBSCRIPTION_PLANS.get(plan_id, SUBSCRIPTION_PLANS["monthly"])
        expires = (datetime.now(timezone.utc) + timedelta(days=plan["days"])).isoformat()
        already = await db.users.find_one({"id": user["id"], "subscription_type": "premium"})
        if not already or not already.get("subscription_expires_at"):
            await db.users.update_one(
                {"id": user["id"]},
                {"$set": {"subscription_type": "premium", "subscription_expires_at": expires}}
            )

    return {"payment_status": checkout_status.payment_status, "status": checkout_status.status}

@api_router.post("/webhook/stripe")
async def stripe_webhook(request: Request):
    body = await request.body()
    sig  = request.headers.get("Stripe-Signature", "")
    stripe = StripeCheckout(api_key=STRIPE_API_KEY, webhook_url="")
    try:
        event = await stripe.handle_webhook(body, sig)
        if event.payment_status == "paid":
            txn = await db.payment_transactions.find_one({"session_id": event.session_id})
            if txn and txn.get("payment_status") != "paid":
                plan_id = txn.get("plan_id", "monthly")
                plan    = SUBSCRIPTION_PLANS.get(plan_id, SUBSCRIPTION_PLANS["monthly"])
                expires = (datetime.now(timezone.utc) + timedelta(days=plan["days"])).isoformat()
                await db.users.update_one(
                    {"id": txn["user_id"]},
                    {"$set": {"subscription_type": "premium", "subscription_expires_at": expires}}
                )
                await db.payment_transactions.update_one(
                    {"session_id": event.session_id},
                    {"$set": {"payment_status": "paid", "status": "complete"}}
                )
    except Exception as e:
        logger.error(f"Webhook error: {e}")
    return {"received": True}

# ══════════════════════════════════════════════════════════════════════════════
# SEED
# ══════════════════════════════════════════════════════════════════════════════

def q(cat, diff, text, answer, img="", aimg="", qtype="text"):
    return {"id": str(uuid.uuid4()), "category_id": cat, "difficulty": diff,
            "text": text, "answer": answer, "image_url": img, "answer_image_url": aimg,
            "question_type": qtype, "created_at": datetime.now(timezone.utc).isoformat()}

@api_router.post("/seed")
async def seed_data(force: bool = False, _: bool = Depends(get_admin)):
    existing = await db.categories.count_documents({})
    if existing > 0 and not force:
        return {"message": "البيانات موجودة مسبقاً"}
    if force:
        await db.categories.delete_many({})
        await db.questions.delete_many({})

    categories = [
        {"id":"cat_flags",   "name":"اعلام دول",      "icon":"🏳️","image_url":"https://static.prod-images.emergentagent.com/jobs/2e2396b6-cc98-44c9-bfbe-97e0e9727ada/images/789e9577be35fbf27c01b939a7864cd14c4aa947ecdd1dffb985e8cf92803c56.png","is_special":False,"color":"#166534","order":1,"description":"خمّن علم الدولة!","created_at":datetime.now(timezone.utc).isoformat()},
        {"id":"cat_easy",    "name":"معلومات عامة",   "icon":"💡","image_url":"https://static.prod-images.emergentagent.com/jobs/2e2396b6-cc98-44c9-bfbe-97e0e9727ada/images/ef7d4ad149135fb20af44b7c285da0442405131faae6b590a9e3b88bad9deec3.png","is_special":False,"color":"#1e40af","order":2,"description":"معلومات للجميع","created_at":datetime.now(timezone.utc).isoformat()},
        {"id":"cat_saudi",   "name":"السعودية",       "icon":"🇸🇦","image_url":"https://images.unsplash.com/photo-1722966885396-1f3dcebdf27f?crop=entropy&cs=srgb&fm=jpg&q=85","is_special":False,"color":"#5B0E14","order":3,"description":"أسئلة عن المملكة","created_at":datetime.now(timezone.utc).isoformat()},
        {"id":"cat_islamic", "name":"اسلامي",         "icon":"☪️","image_url":"https://static.prod-images.emergentagent.com/jobs/2e2396b6-cc98-44c9-bfbe-97e0e9727ada/images/415591654801e274c08fe69190400fa76fc011cbd93e02bdcb51ad4d6c838d24.png","is_special":False,"color":"#065f46","order":4,"description":"أسئلة إسلامية","created_at":datetime.now(timezone.utc).isoformat()},
        {"id":"cat_science", "name":"علوم",           "icon":"🔬","image_url":"https://static.prod-images.emergentagent.com/jobs/2e2396b6-cc98-44c9-bfbe-97e0e9727ada/images/5a646d99acb87f702e9b9e1b526e57a3aa5e72ea83e1383922de853c3217fcd2.png","is_special":False,"color":"#4c1d95","order":5,"description":"علوم للجميع","created_at":datetime.now(timezone.utc).isoformat()},
        {"id":"cat_logos",   "name":"شعارات",         "icon":"🏷️","image_url":"https://static.prod-images.emergentagent.com/jobs/2e2396b6-cc98-44c9-bfbe-97e0e9727ada/images/f24c5c166f24d1b9a42f735e4068ea1e7314629e35b6ae5f9004b239034385b2.png","is_special":False,"color":"#7c2d12","order":6,"description":"خمّن الشعار!","created_at":datetime.now(timezone.utc).isoformat()},
        {"id":"cat_word",    "name":"ولا كلمة",       "icon":"🤫","image_url":"https://static.prod-images.emergentagent.com/jobs/2e2396b6-cc98-44c9-bfbe-97e0e9727ada/images/4dbb8986ed1f7fd1808e2cfe86c647cce9b6418d187c7dc40e0c927a3ca63ba3.png","is_special":True, "color":"#4a044e","order":7,"description":"وصّف بدون ما تقول الكلمة!","created_at":datetime.now(timezone.utc).isoformat()},
        {"id":"cat_culture", "name":"ثقافة شعبية",    "icon":"🎬","image_url":"https://images.unsplash.com/photo-1771909752746-8fd6c4ca6686?crop=entropy&cs=srgb&fm=jpg&q=85","is_special":False,"color":"#831843","order":8,"description":"مسلسلات وأفلام وبرامج","created_at":datetime.now(timezone.utc).isoformat()},
        {"id":"cat_sports",  "name":"رياضة",          "icon":"⚽","image_url":"https://static.prod-images.emergentagent.com/jobs/2e2396b6-cc98-44c9-bfbe-97e0e9727ada/images/e51328694c4b4c81a6ee96efd6195f7efcb47bf810bc16433b131fcc4650d516.png","is_special":False,"color":"#134e4a","order":9,"description":"كرة وبطولات","created_at":datetime.now(timezone.utc).isoformat()},
        {"id":"cat_music",   "name":"موسيقى وفن",     "icon":"🎵","image_url":"https://static.prod-images.emergentagent.com/jobs/2e2396b6-cc98-44c9-bfbe-97e0e9727ada/images/06e0f32385eaf6b70c73ad579e42d9057de72575eed0ac8ee6e226bd5d36eb97.png","is_special":False,"color":"#1e3a5f","order":10,"description":"أغاني وفنانين","created_at":datetime.now(timezone.utc).isoformat()},
    ]
    await db.categories.insert_many(categories)

    questions = [
        # ── اعلام دول ─────────────────────────────────────────────────
        q("cat_flags",300,"علم أي دولة هذا؟","اليابان","https://flagcdn.com/w320/jp.png"),
        q("cat_flags",300,"علم أي دولة هذا؟","فرنسا","https://flagcdn.com/w320/fr.png"),
        q("cat_flags",300,"علم أي دولة هذا؟","المملكة المتحدة","https://flagcdn.com/w320/gb.png"),
        q("cat_flags",300,"علم أي دولة هذا؟","أمريكا","https://flagcdn.com/w320/us.png"),
        q("cat_flags",300,"علم أي دولة هذا؟","السعودية","https://flagcdn.com/w320/sa.png"),
        q("cat_flags",300,"علم أي دولة هذا؟","الإمارات","https://flagcdn.com/w320/ae.png"),
        q("cat_flags",300,"علم أي دولة هذا؟","مصر","https://flagcdn.com/w320/eg.png"),
        q("cat_flags",300,"علم أي دولة هذا؟","ألمانيا","https://flagcdn.com/w320/de.png"),
        q("cat_flags",300,"علم أي دولة هذا؟","إيطاليا","https://flagcdn.com/w320/it.png"),
        q("cat_flags",300,"علم أي دولة هذا؟","كندا","https://flagcdn.com/w320/ca.png"),
        q("cat_flags",300,"علم أي دولة هذا؟","الصين","https://flagcdn.com/w320/cn.png"),
        q("cat_flags",300,"علم أي دولة هذا؟","روسيا","https://flagcdn.com/w320/ru.png"),
        q("cat_flags",300,"علم أي دولة هذا؟","البرازيل","https://flagcdn.com/w320/br.png"),
        q("cat_flags",300,"علم أي دولة هذا؟","الكويت","https://flagcdn.com/w320/kw.png"),
        q("cat_flags",300,"علم أي دولة هذا؟","قطر","https://flagcdn.com/w320/qa.png"),
        q("cat_flags",600,"علم أي دولة هذا؟","تركيا","https://flagcdn.com/w320/tr.png"),
        q("cat_flags",600,"علم أي دولة هذا؟","أستراليا","https://flagcdn.com/w320/au.png"),
        q("cat_flags",600,"علم أي دولة هذا؟","كوريا الجنوبية","https://flagcdn.com/w320/kr.png"),
        q("cat_flags",600,"علم أي دولة هذا؟","الأردن","https://flagcdn.com/w320/jo.png"),
        q("cat_flags",600,"علم أي دولة هذا؟","المكسيك","https://flagcdn.com/w320/mx.png"),
        q("cat_flags",600,"علم أي دولة هذا؟","الهند","https://flagcdn.com/w320/in.png"),
        q("cat_flags",600,"علم أي دولة هذا؟","إسبانيا","https://flagcdn.com/w320/es.png"),
        q("cat_flags",600,"علم أي دولة هذا؟","هولندا","https://flagcdn.com/w320/nl.png"),
        q("cat_flags",600,"علم أي دولة هذا؟","عُمان","https://flagcdn.com/w320/om.png"),
        q("cat_flags",600,"علم أي دولة هذا؟","البحرين","https://flagcdn.com/w320/bh.png"),
        q("cat_flags",600,"علم أي دولة هذا؟","المغرب","https://flagcdn.com/w320/ma.png"),
        q("cat_flags",600,"علم أي دولة هذا؟","تونس","https://flagcdn.com/w320/tn.png"),
        q("cat_flags",600,"علم أي دولة هذا؟","الجزائر","https://flagcdn.com/w320/dz.png"),
        q("cat_flags",600,"علم أي دولة هذا؟","اليونان","https://flagcdn.com/w320/gr.png"),
        q("cat_flags",600,"علم أي دولة هذا؟","بولندا","https://flagcdn.com/w320/pl.png"),
        q("cat_flags",900,"علم أي دولة هذا؟","البرتغال","https://flagcdn.com/w320/pt.png"),
        q("cat_flags",900,"علم أي دولة هذا؟","السويد","https://flagcdn.com/w320/se.png"),
        q("cat_flags",900,"علم أي دولة هذا؟","النرويج","https://flagcdn.com/w320/no.png"),
        q("cat_flags",900,"علم أي دولة هذا؟","بلجيكا","https://flagcdn.com/w320/be.png"),
        q("cat_flags",900,"علم أي دولة هذا؟","الأرجنتين","https://flagcdn.com/w320/ar.png"),
        q("cat_flags",900,"علم أي دولة هذا؟","فنلندا","https://flagcdn.com/w320/fi.png"),
        q("cat_flags",900,"علم أي دولة هذا؟","تشيلي","https://flagcdn.com/w320/cl.png"),
        q("cat_flags",900,"علم أي دولة هذا؟","باكستان","https://flagcdn.com/w320/pk.png"),
        q("cat_flags",900,"علم أي دولة هذا؟","إندونيسيا","https://flagcdn.com/w320/id.png"),
        q("cat_flags",900,"علم أي دولة هذا؟","سويسرا","https://flagcdn.com/w320/ch.png"),
        q("cat_flags",900,"علم أي دولة هذا؟","النمسا","https://flagcdn.com/w320/at.png"),
        q("cat_flags",900,"علم أي دولة هذا؟","الدنمارك","https://flagcdn.com/w320/dk.png"),
        q("cat_flags",900,"علم أي دولة هذا؟","رومانيا","https://flagcdn.com/w320/ro.png"),
        q("cat_flags",900,"علم أي دولة هذا؟","كرواتيا","https://flagcdn.com/w320/hr.png"),
        q("cat_flags",900,"علم أي دولة هذا؟","أيرلندا","https://flagcdn.com/w320/ie.png"),

        # ── معلومات سهلة ──────────────────────────────────────────────
        q("cat_easy",300,"كم يوم في الأسبوع؟","7"),
        q("cat_easy",300,"كم شهر في السنة؟","12"),
        q("cat_easy",300,"كم إصبع في اليدين؟","10"),
        q("cat_easy",300,"ما لون السماء؟","أزرق"),
        q("cat_easy",300,"كم ساعة في اليوم؟","24"),
        q("cat_easy",300,"أسرع حيوان بري؟","الفهد"),
        q("cat_easy",300,"أكبر الكواكب في المجموعة الشمسية؟","المشتري"),
        q("cat_easy",300,"ما لون الحليب؟","أبيض"),
        q("cat_easy",300,"كم أرجل للعنكبوت؟","8"),
        q("cat_easy",300,"حيوان معروف بالوفاء؟","الكلب"),
        q("cat_easy",300,"وش الغاز اللي نتنفسه؟","الأكسجين"),
        q("cat_easy",300,"كم يوم في السنة؟","365"),
        q("cat_easy",300,"أطول عظمة في الجسم؟","عظمة الفخذ"),
        q("cat_easy",300,"أكبر دولة مساحةً؟","روسيا"),
        q("cat_easy",300,"كم قارة في العالم؟","7"),
        q("cat_easy",600,"أطول نهر في العالم؟","النيل"),
        q("cat_easy",600,"كم كوكب في المجموعة الشمسية؟","8"),
        q("cat_easy",600,"عاصمة فرنسا؟","باريس"),
        q("cat_easy",600,"أكبر محيط؟","المحيط الهادئ"),
        q("cat_easy",600,"درجة غليان الماء؟","100 درجة"),
        q("cat_easy",600,"كم عظمة في جسم الإنسان؟","206"),
        q("cat_easy",600,"كم مرة يدق القلب في الدقيقة؟","70"),
        q("cat_easy",600,"عاصمة اليابان؟","طوكيو"),
        q("cat_easy",600,"عاصمة البرازيل؟","برازيليا"),
        q("cat_easy",600,"كم حواس الإنسان الأساسية؟","5"),
        q("cat_easy",600,"من اخترع المصباح؟","توماس إديسون"),
        q("cat_easy",600,"عاصمة أستراليا؟","كانبيرا"),
        q("cat_easy",600,"كم قدم في الميل؟","5280"),
        q("cat_easy",600,"أثقل المعادن الطبيعية؟","الأوزميوم"),
        q("cat_easy",600,"الجهاز المسؤول عن ضخ الدم؟","القلب"),
        q("cat_easy",900,"سرعة الضوء تقريباً؟","300,000 كم/ثانية"),
        q("cat_easy",900,"الغاز الأكثر في الغلاف الجوي؟","النيتروجين"),
        q("cat_easy",900,"كم كروموسوم لدى الإنسان؟","46"),
        q("cat_easy",900,"ما المعدن السائل عند درجة حرارة الغرفة؟","الزئبق"),
        q("cat_easy",900,"كم سنة تعيش السلحفاة؟","150"),
        q("cat_easy",900,"الكوكب الأبرد؟","أورانوس"),
        q("cat_easy",900,"ماذا تسمى دراسة الأحافير؟","علم الحفريات"),
        q("cat_easy",900,"رمز الكيمياء للذهب؟","Au"),
        q("cat_easy",900,"رمز الكيمياء للحديد؟","Fe"),
        q("cat_easy",900,"رمز الكيمياء للصوديوم؟","Na"),
        q("cat_easy",900,"عدد أضلاع السداسي؟","6"),
        q("cat_easy",900,"أعمق نقطة في المحيط؟","حفرة ماريانا"),
        q("cat_easy",900,"النظرية التي تصف نشأة الكون؟","الانفجار العظيم"),
        q("cat_easy",900,"وحدة قياس القوة؟","النيوتن"),
        q("cat_easy",900,"كم أسنان للإنسان البالغ؟","32"),

        # ── السعودية ──────────────────────────────────────────────────
        q("cat_saudi",300,"عاصمة السعودية؟","الرياض"),
        q("cat_saudi",300,"أكبر مسجد في العالم؟","المسجد الحرام"),
        q("cat_saudi",300,"عملة السعودية؟","الريال"),
        q("cat_saudi",300,"كم منطقة إدارية في السعودية؟","13"),
        q("cat_saudi",300,"اليوم الوطني السعودي؟","23 سبتمبر"),
        q("cat_saudi",300,"الملك المؤسس للمملكة؟","الملك عبدالعزيز"),
        q("cat_saudi",300,"ثاني أكبر مدن السعودية؟","جدة"),
        q("cat_saudi",300,"المشروب الشعبي السعودي الأشهر؟","القهوة العربية"),
        q("cat_saudi",300,"البحر الذي تطل عليه جدة؟","البحر الأحمر"),
        q("cat_saudi",300,"أشهر وجبة سعودية؟","الكبسة"),
        q("cat_saudi",300,"أين يقع المسجد النبوي؟","المدينة المنورة"),
        q("cat_saudi",300,"ما اسم مشروع المدينة المستقبلية؟","نيوم"),
        q("cat_saudi",300,"شركة النفط السعودية العملاقة؟","أرامكو"),
        q("cat_saudi",300,"موقع أثري سعودي مشهور؟","العُلا / مدائن صالح"),
        q("cat_saudi",300,"أعلى جبل في السعودية؟","جبل السودة"),
        q("cat_saudi",600,"سنة تأسيس المملكة العربية السعودية؟","1932"),
        q("cat_saudi",600,"أكبر صحراء في السعودية؟","الربع الخالي"),
        q("cat_saudi",600,"سنة اكتشاف النفط في السعودية؟","1938"),
        q("cat_saudi",600,"كم مسيرة يستغرق الحج؟","5 أيام"),
        q("cat_saudi",600,"المدينة السعودية المعروفة بالورد؟","الطائف"),
        q("cat_saudi",600,"أول جامعة في السعودية؟","جامعة الملك سعود"),
        q("cat_saudi",600,"عدد سكان السعودية تقريباً؟","35 مليون"),
        q("cat_saudi",600,"الرمز الوطني على علم السعودية؟","السيف والنخلة"),
        q("cat_saudi",600,"أطول برج في الرياض؟","برج المملكة"),
        q("cat_saudi",600,"المبادرة البيئية السعودية الكبرى؟","السعودية الخضراء"),
        q("cat_saudi",600,"خطة التنويع الاقتصادي السعودية؟","رؤية 2030"),
        q("cat_saudi",600,"البحر الذي تطل عليه المنطقة الشرقية؟","الخليج العربي"),
        q("cat_saudi",600,"مطعم سعودي شعبي لكل المناسبات؟","مطاعم البيك"),
        q("cat_saudi",600,"منطقة السعودية المشهورة بزراعة التمر؟","المدينة المنورة / القصيم"),
        q("cat_saudi",600,"أشهر حي تاريخي في الرياض؟","الدرعية"),
        q("cat_saudi",900,"مساحة السعودية تقريباً؟","2.15 مليون كم٢"),
        q("cat_saudi",900,"طول الحدود البرية السعودية؟","4431 كم"),
        q("cat_saudi",900,"أول سفير سعودي لدى الولايات المتحدة؟","الأمير بندر بن سلطان"),
        q("cat_saudi",900,"عدد محافظات منطقة مكة المكرمة؟","10"),
        q("cat_saudi",900,"اسم الربع الخالي بالإنجليزية؟","Empty Quarter"),
        q("cat_saudi",900,"أعمق بئر نفط في السعودية؟","شيبة"),
        q("cat_saudi",900,"السنة التي عادت فيها السينما للسعودية؟","2018"),
        q("cat_saudi",900,"حاكم الرياض في زمن الملك عبدالعزيز؟","الملك عبدالعزيز نفسه"),
        q("cat_saudi",900,"سنة انضمام السعودية لمجموعة العشرين؟","1999"),
        q("cat_saudi",900,"أول امرأة سعودية تحصل على ترخيص قيادة؟","2018 (السنة التي سُمح فيها)"),
        q("cat_saudi",900,"كم نسمة في الرياض تقريباً؟","8 مليون"),
        q("cat_saudi",900,"مؤسس مدينة الرياض الحديثة؟","الملك عبدالعزيز"),
        q("cat_saudi",900,"تلقّب مدينة جدة بـ؟","عروس البحر الأحمر"),
        q("cat_saudi",900,"سنة دخول السعودية الأمم المتحدة؟","1945"),
        q("cat_saudi",900,"ما هو النظام السياسي للسعودية؟","ملكية مطلقة"),

        # ── اسلامي ────────────────────────────────────────────────────
        q("cat_islamic",300,"كم ركن للإسلام؟","5"),
        q("cat_islamic",300,"أول سورة في القرآن؟","الفاتحة"),
        q("cat_islamic",300,"كم سورة في القرآن؟","114"),
        q("cat_islamic",300,"شهر الصيام؟","رمضان"),
        q("cat_islamic",300,"كم صلاة يومياً؟","5"),
        q("cat_islamic",300,"اتجاه الصلاة؟","الكعبة"),
        q("cat_islamic",300,"الكتاب المقدس للمسلمين؟","القرآن"),
        q("cat_islamic",300,"عيد نهاية رمضان؟","عيد الفطر"),
        q("cat_islamic",300,"مولد النبي؟","مكة المكرمة"),
        q("cat_islamic",300,"كم أجزاء القرآن؟","30"),
        q("cat_islamic",300,"أكبر عدد ركعات في صلاة؟","العشاء - 4 فرض"),
        q("cat_islamic",300,"كم عدد أركان الإيمان؟","6"),
        q("cat_islamic",300,"اليوم الذي رُفعت فيه الأعمال أسبوعياً؟","الجمعة"),
        q("cat_islamic",300,"كم نبي ذُكر في القرآن؟","25"),
        q("cat_islamic",300,"ماذا يقال عند الأكل؟","بسم الله"),
        q("cat_islamic",600,"نسبة الزكاة؟","2.5%"),
        q("cat_islamic",600,"كم ركعة في المغرب؟","3"),
        q("cat_islamic",600,"أم المؤمنين الأولى؟","السيدة خديجة"),
        q("cat_islamic",600,"أول مسجد بُني في الإسلام؟","مسجد قباء"),
        q("cat_islamic",600,"كم آية في سورة البقرة؟","286"),
        q("cat_islamic",600,"المدينة التي هاجر إليها النبي؟","المدينة المنورة"),
        q("cat_islamic",600,"آخر سورة نزلت؟","سورة النصر"),
        q("cat_islamic",600,"أطول سورة في القرآن؟","البقرة"),
        q("cat_islamic",600,"من جمع القرآن أولاً؟","أبو بكر الصديق"),
        q("cat_islamic",600,"كم سنة نزل القرآن؟","23"),
        q("cat_islamic",600,"ليلة القدر أفضل من؟","ألف شهر"),
        q("cat_islamic",600,"كم غزوة للنبي؟","27"),
        q("cat_islamic",600,"من كتب القرآن في عهد الصديق؟","زيد بن ثابت"),
        q("cat_islamic",600,"اليوم الذي نزل فيه القرآن؟","رمضان"),
        q("cat_islamic",600,"ملك الوحي؟","جبريل"),
        q("cat_islamic",900,"عدد آيات القرآن؟","6236"),
        q("cat_islamic",900,"عدد كلمات القرآن؟","77,430"),
        q("cat_islamic",900,"سنة الهجرة؟","622 م"),
        q("cat_islamic",900,"والد النبي إبراهيم؟","آزر"),
        q("cat_islamic",900,"أعمى بالخلق؟","النبي يعقوب (حزنا)"),
        q("cat_islamic",900,"أول شهيد في الإسلام؟","سمية بنت خياط"),
        q("cat_islamic",900,"كم سنة عاش النبي محمد؟","63 سنة"),
        q("cat_islamic",900,"سنة وفاة النبي؟","632 م"),
        q("cat_islamic",900,"معركة بدر في السنة؟","2 هجرية"),
        q("cat_islamic",900,"كم ضربة دق قلب النبي؟","لا يُعلم بدقة"),
        q("cat_islamic",900,"من هو ذو القرنين؟","ملك عادل ذُكر في القرآن"),
        q("cat_islamic",900,"أكثر الأنبياء ذكراً في القرآن؟","موسى"),
        q("cat_islamic",900,"كم سنة دام حكم عمر بن الخطاب؟","10 سنوات"),
        q("cat_islamic",900,"من لقّب بأمين الأمة؟","أبو عبيدة بن الجراح"),
        q("cat_islamic",900,"كم عدد المحارم للمرأة في الإسلام؟","محدد في الفقه الإسلامي"),

        # ── علوم بسيطة ───────────────────────────────────────────────
        q("cat_science",300,"الغاز الذي نتنفسه؟","الأكسجين"),
        q("cat_science",300,"كم كوكب في المجموعة الشمسية؟","8"),
        q("cat_science",300,"أكبر كوكب؟","المشتري"),
        q("cat_science",300,"طاقة النباتات؟","الشمس"),
        q("cat_science",300,"أقرب كوكب للشمس؟","عطارد"),
        q("cat_science",300,"الكوكب الأحمر؟","المريخ"),
        q("cat_science",300,"تركيبة الماء؟","H₂O"),
        q("cat_science",300,"الكوكب ذو الحلقات؟","زحل"),
        q("cat_science",300,"أصغر كوكب؟","عطارد"),
        q("cat_science",300,"الجاذبية تعمل بسبب؟","الكتلة"),
        q("cat_science",300,"أين يوجد الدماغ؟","الرأس"),
        q("cat_science",300,"اسم أول إنسان في الفضاء؟","يوري غاغارين"),
        q("cat_science",300,"سرعة الصوت تقريباً؟","340 م/ثانية"),
        q("cat_science",300,"كم قمر للمريخ؟","2"),
        q("cat_science",300,"الذرة تتكون من؟","نيوترونات، بروتونات، إلكترونات"),
        q("cat_science",600,"درجة غليان الماء؟","100"),
        q("cat_science",600,"رمز الذهب؟","Au"),
        q("cat_science",600,"كم عنصر في الجدول الدوري؟","118"),
        q("cat_science",600,"اكتشف الجاذبية؟","نيوتن"),
        q("cat_science",600,"رمز الحديد؟","Fe"),
        q("cat_science",600,"العضو الذي ينقي الدم؟","الكلية"),
        q("cat_science",600,"مصدر ضوء القمر؟","انعكاس الشمس"),
        q("cat_science",600,"اكتشف البنسلين؟","ألكسندر فليمنج"),
        q("cat_science",600,"وحدة قياس الضغط؟","الباسكال"),
        q("cat_science",600,"الخلايا البيضاء وظيفتها؟","المناعة"),
        q("cat_science",600,"رمز الصوديوم؟","Na"),
        q("cat_science",600,"رمز الكربون؟","C"),
        q("cat_science",600,"أبرد درجة ممكنة؟","الصفر المطلق (-273°C)"),
        q("cat_science",600,"العنصر الأكثر في القشرة الأرضية؟","الأكسجين"),
        q("cat_science",600,"اسم أول قمر صناعي؟","سبوتنيك"),
        q("cat_science",900,"النظرية النسبية لـ؟","إينشتاين"),
        q("cat_science",900,"نظرية نشأة الكون؟","الانفجار العظيم"),
        q("cat_science",900,"وحدة قياس القوة؟","النيوتن"),
        q("cat_science",900,"كم أسنان للبالغ؟","32"),
        q("cat_science",900,"العلم الذي يدرس الأحافير؟","علم الحفريات"),
        q("cat_science",900,"سرعة الضوء؟","300,000 كم/ثانية"),
        q("cat_science",900,"الأثقل المعادن؟","الأوزميوم"),
        q("cat_science",900,"رمز الزئبق؟","Hg"),
        q("cat_science",900,"عدد الكروموسومات البشرية؟","46"),
        q("cat_science",900,"أكبر عضو في الجسم؟","الجلد"),
        q("cat_science",900,"دراسة الكون؟","علم الفلك"),
        q("cat_science",900,"أسرع المخلوقات في البحر؟","سمكة الأبرة (سيلفيش)"),
        q("cat_science",900,"الجهاز العصبي المركزي يتكون من؟","المخ والحبل الشوكي"),
        q("cat_science",900,"أكثر سائل في الجسم؟","الماء"),
        q("cat_science",900,"عمر الشمس تقريباً؟","4.6 مليار سنة"),

        # ── شعارات ────────────────────────────────────────────────────
        q("cat_logos",300,"شعار أي شركة؟ (تفاحة ناقصة)","أبل"),
        q("cat_logos",300,"شعار أي شركة؟ (M أصفر)","ماكدونالدز"),
        q("cat_logos",300,"شعار أي شركة؟ (علامة صح)","نايكي"),
        q("cat_logos",300,"شعار أي شركة؟ (حورية البحر)","ستاربكس"),
        q("cat_logos",300,"شعار أي شركة؟ (حرف G ملوّن)","جوجل"),
        q("cat_logos",300,"شعار أي شركة؟ (حرف f أزرق)","فيسبوك"),
        q("cat_logos",300,"شعار أي شركة؟ (طائر أزرق)","تويتر X"),
        q("cat_logos",300,"شعار أي شركة؟ (N حمراء)","نتفليكس"),
        q("cat_logos",300,"شعار أي شركة؟ (A وسهم)","أمازون"),
        q("cat_logos",300,"شعار أي شركة؟ (3 خطوط)","أديداس"),
        q("cat_logos",300,"شعار أي شركة؟ (كاميرا ملوّنة)","إنستغرام"),
        q("cat_logos",300,"شعار أي شركة؟ (صاروخ أبيض)","تيك توك"),
        q("cat_logos",300,"شعار أي شركة؟ (صفحة بيضاء)","يوتيوب"),
        q("cat_logos",300,"شعار أي شركة؟ (p أرجواني)","بليستيشن"),
        q("cat_logos",300,"شعار أي شركة؟ (خمس خطوط)","مرسيدس"),
        q("cat_logos",600,"شعار أي شركة سيارات؟ (4 حلقات)","أودي"),
        q("cat_logos",600,"شعار أي شركة؟ (نجمة 3 أطراف بدائرة)","مرسيدس"),
        q("cat_logos",600,"شعار أي شركة؟ (5 حلقات ملوّنة)","الأولمبياد"),
        q("cat_logos",600,"شعار أي شركة؟ (فرس طائر)","فيراري"),
        q("cat_logos",600,"شعار أي شركة؟ (تمساح أخضر)","لاكوست"),
        q("cat_logos",600,"شعار أي شركة؟ (حروف LV)","لويس فيتون"),
        q("cat_logos",600,"شعار أي شركة؟ (أزرق مخطط)","سامسونج"),
        q("cat_logos",600,"شعار أي شركة؟ (بومة صفراء)","سناب شات"),
        q("cat_logos",600,"شعار أي شركة؟ (Δ أحمر)","مالبورو"),
        q("cat_logos",600,"شعار أي شركة؟ (نقطة صفراء على زرقاء)","IKEA"),
        q("cat_logos",600,"شعار أي شركة؟ (خلية نحل)","BBC"),
        q("cat_logos",600,"شعار أي شركة؟ (مستطيل أخضر)","stc"),
        q("cat_logos",600,"شعار أي شركة؟ (حرف W أزرق)","واتساب"),
        q("cat_logos",600,"شعار أي شركة؟ (طيف ألوان)","مايكروسوفت"),
        q("cat_logos",600,"شعار أي شركة؟ (S وخطوط)","سامسونج"),
        q("cat_logos",900,"شعار أي شركة؟ (شمعة متقدة)","BP"),
        q("cat_logos",900,"شعار أي شركة؟ (بتلة خضراء)","ستارباكس القديم"),
        q("cat_logos",900,"شعار أي شركة؟ (حرف H مربع أزرق)","هيلتون"),
        q("cat_logos",900,"شعار أي شركة؟ (نسر ذهبي)","فيزا"),
        q("cat_logos",900,"شعار أي شركة؟ (دائرة حمراء فارغة)","Toyota"),
        q("cat_logos",900,"شعار أي شركة؟ (علامة استفهام بيضاء)","?"),
        q("cat_logos",900,"شعار أي شركة؟ (شريط موجي)","Pepsi"),
        q("cat_logos",900,"شعار أي شركة؟ (حرف E متشابك)","Etsy"),
        q("cat_logos",900,"شعار أي شركة؟ (ساعة رقمية حمراء)","Casio"),
        q("cat_logos",900,"شعار أي شركة؟ (ارنب أبيض)","Playboy"),
        q("cat_logos",900,"شعار أي شركة؟ (شراع أزرق)","Samsung Galaxy"),
        q("cat_logos",900,"شعار أي شركة؟ (حرف Z أصفر)","Zara"),
        q("cat_logos",900,"شعار أي شركة؟ (شكل مثمن أزرق)","Allianz"),
        q("cat_logos",900,"شعار أي شركة؟ (ثلاث دوائر متداخلة)","Audi"),
        q("cat_logos",900,"شعار أي شركة؟ (نقطة حمراء صغيرة)","Vodafone"),

        # ── ولا كلمة ──────────────────────────────────────────────────
        q("cat_word",300,"وصّف الكلمة لفريقك!","بيت",qtype="secret_word"),
        q("cat_word",300,"وصّف الكلمة لفريقك!","سيارة",qtype="secret_word"),
        q("cat_word",300,"وصّف الكلمة لفريقك!","شجرة",qtype="secret_word"),
        q("cat_word",300,"وصّف الكلمة لفريقك!","ماء",qtype="secret_word"),
        q("cat_word",300,"وصّف الكلمة لفريقك!","شمس",qtype="secret_word"),
        q("cat_word",300,"وصّف الكلمة لفريقك!","طيارة",qtype="secret_word"),
        q("cat_word",300,"وصّف الكلمة لفريقك!","كتاب",qtype="secret_word"),
        q("cat_word",300,"وصّف الكلمة لفريقك!","قلم",qtype="secret_word"),
        q("cat_word",300,"وصّف الكلمة لفريقك!","باب",qtype="secret_word"),
        q("cat_word",300,"وصّف الكلمة لفريقك!","تلفون",qtype="secret_word"),
        q("cat_word",300,"وصّف الكلمة لفريقك!","قهوة",qtype="secret_word"),
        q("cat_word",300,"وصّف الكلمة لفريقك!","مطر",qtype="secret_word"),
        q("cat_word",300,"وصّف الكلمة لفريقك!","كلب",qtype="secret_word"),
        q("cat_word",300,"وصّف الكلمة لفريقك!","قطة",qtype="secret_word"),
        q("cat_word",300,"وصّف الكلمة لفريقك!","جبال",qtype="secret_word"),
        q("cat_word",600,"وصّف الكلمة لفريقك!","مطار",qtype="secret_word"),
        q("cat_word",600,"وصّف الكلمة لفريقك!","مسبح",qtype="secret_word"),
        q("cat_word",600,"وصّف الكلمة لفريقك!","برج إيفل",qtype="secret_word"),
        q("cat_word",600,"وصّف الكلمة لفريقك!","دكتور",qtype="secret_word"),
        q("cat_word",600,"وصّف الكلمة لفريقك!","ثلج",qtype="secret_word"),
        q("cat_word",600,"وصّف الكلمة لفريقك!","صحراء",qtype="secret_word"),
        q("cat_word",600,"وصّف الكلمة لفريقك!","موسيقى",qtype="secret_word"),
        q("cat_word",600,"وصّف الكلمة لفريقك!","مستشفى",qtype="secret_word"),
        q("cat_word",600,"وصّف الكلمة لفريقك!","كعبة",qtype="secret_word"),
        q("cat_word",600,"وصّف الكلمة لفريقك!","ملعب",qtype="secret_word"),
        q("cat_word",600,"وصّف الكلمة لفريقك!","تلفزيون",qtype="secret_word"),
        q("cat_word",600,"وصّف الكلمة لفريقك!","رحلة",qtype="secret_word"),
        q("cat_word",600,"وصّف الكلمة لفريقك!","مطبخ",qtype="secret_word"),
        q("cat_word",600,"وصّف الكلمة لفريقك!","شاطئ",qtype="secret_word"),
        q("cat_word",600,"وصّف الكلمة لفريقك!","قلعة",qtype="secret_word"),
        q("cat_word",900,"وصّف الكلمة لفريقك!","برلمان",qtype="secret_word"),
        q("cat_word",900,"وصّف الكلمة لفريقك!","جامعة",qtype="secret_word"),
        q("cat_word",900,"وصّف الكلمة لفريقك!","فيلسوف",qtype="secret_word"),
        q("cat_word",900,"وصّف الكلمة لفريقك!","انتخابات",qtype="secret_word"),
        q("cat_word",900,"وصّف الكلمة لفريقك!","ميكروسكوب",qtype="secret_word"),
        q("cat_word",900,"وصّف الكلمة لفريقك!","اقتصاد",qtype="secret_word"),
        q("cat_word",900,"وصّف الكلمة لفريقك!","تلسكوب",qtype="secret_word"),
        q("cat_word",900,"وصّف الكلمة لفريقك!","محكمة",qtype="secret_word"),
        q("cat_word",900,"وصّف الكلمة لفريقك!","دبلوماسي",qtype="secret_word"),
        q("cat_word",900,"وصّف الكلمة لفريقك!","ثورة",qtype="secret_word"),
        q("cat_word",900,"وصّف الكلمة لفريقك!","استعمار",qtype="secret_word"),
        q("cat_word",900,"وصّف الكلمة لفريقك!","نووي",qtype="secret_word"),
        q("cat_word",900,"وصّف الكلمة لفريقك!","فوضى",qtype="secret_word"),
        q("cat_word",900,"وصّف الكلمة لفريقك!","مستكشف",qtype="secret_word"),
        q("cat_word",900,"وصّف الكلمة لفريقك!","ديمقراطية",qtype="secret_word"),

        # ── ثقافة شعبية ───────────────────────────────────────────────
        q("cat_culture",300,"وش اسم أشهر مسلسل كوميدي سعودي؟","طاش ما طاش"),
        q("cat_culture",300,"وش اسم أول فيلم سعودي عُرض في دور السينما؟","وجدة"),
        q("cat_culture",300,"في أي سنة عادت السينما للسعودية؟","2018"),
        q("cat_culture",300,"وش اسم أشهر برنامج رمضاني يجمع الفنانين؟","أرامكو / MBC"),
        q("cat_culture",300,"من هو مقدم برنامج رامز جلال الشهير؟","رامز جلال"),
        q("cat_culture",300,"وش اسم أشهر مسلسل تركي في العالم العربي؟","قيامة أرطغرل"),
        q("cat_culture",300,"وش اسم الفيلم الذي شارك فيه ليوناردو ديكابريو في جزيرة؟","لاس ايلاند / Shutter Island"),
        q("cat_culture",300,"وش اسم سلسلة أفلام الخارق الشهيرة؟","Marvel / أفنجرز"),
        q("cat_culture",300,"وش اسم أشهر مسلسل أمريكي عن العائلة السوداء؟","Fresh Prince"),
        q("cat_culture",300,"وش أشهر منصة بث عربية؟","Shahid / شاهد"),
        q("cat_culture",300,"وش اسم أشهر برنامج مسابقات غنائي عربي؟","Arab Idol"),
        q("cat_culture",300,"وش اسم الشخصية الرئيسية في فيلم الأسد الملك؟","سيمبا"),
        q("cat_culture",300,"وش اسم أشهر فيلم كرتوني عن سمكة؟","Finding Nemo"),
        q("cat_culture",300,"وش اسم مسلسل الأطباء الشهير؟","Grey's Anatomy / دكتور هاوس"),
        q("cat_culture",300,"وش اسم بطل فيلم Spider-Man؟","بيتر باركر"),
        q("cat_culture",600,"وش اسم مخرج فيلم Inception؟","كريستوفر نولان"),
        q("cat_culture",600,"وش اسم أغنى شخص في مسلسل Money Heist؟","البروفيسور"),
        q("cat_culture",600,"في أي بلد صُوِّر مسلسل قيامة أرطغرل؟","تركيا"),
        q("cat_culture",600,"وش اسم سلسلة أفلام الوحش الغريب الشهيرة؟","Jurassic Park"),
        q("cat_culture",600,"وش اسم فريق كرة اللعبة في فيلم Space Jam؟","Tune Squad"),
        q("cat_culture",600,"من قدّم The Voice Arabia في أول موسم؟","عمرو دياب + كاظم الساهر"),
        q("cat_culture",600,"وش اسم مسلسل الزومبي الأمريكي الشهير؟","The Walking Dead"),
        q("cat_culture",600,"وش اسم أشهر مسلسل كوميدي أمريكي عن الأصدقاء؟","Friends"),
        q("cat_culture",600,"وش اسم أشهر مسلسل سعودي خيال علمي؟","النهاية"),
        q("cat_culture",600,"كم جزء لسلسلة Fast and Furious حتى 2024؟","11 جزء"),
        q("cat_culture",600,"من يلعب دور Iron Man في أفلام Marvel؟","روبرت داوني جونيور"),
        q("cat_culture",600,"وش اسم قناة الأطفال السعودية الشهيرة؟","MBC3"),
        q("cat_culture",600,"وش اسم أشهر مسلسل جريمة دنماركي؟","The Killing / Borgen"),
        q("cat_culture",600,"وش اسم برنامج الطبخ السعودي الشهير؟","عالم أنوشة"),
        q("cat_culture",600,"وش اسم الممثل البطل في فيلم Titanic؟","ليوناردو ديكابريو"),
        q("cat_culture",900,"كم حلقة في Game of Thrones بالكامل؟","73 حلقة"),
        q("cat_culture",900,"وش اسم المخرج الياباني لـ Spirited Away؟","هاياو مياغي"),
        q("cat_culture",900,"وش اسم أشهر مسلسل كوري دراما؟","Crash Landing on You"),
        q("cat_culture",900,"وش اسم أول فيلم Disney باللغة العربية الكاملة؟","أبو دنياه"),
        q("cat_culture",900,"وش اسم مكان التصوير الرئيسي لـ Game of Thrones؟","مالطا وإيرلندا الشمالية"),
        q("cat_culture",900,"من أخرج سلسلة Lord of the Rings؟","بيتر جاكسون"),
        q("cat_culture",900,"وش اسم أكثر مسلسل مشاهدةً في تاريخ Netflix؟","Wednesday"),
        q("cat_culture",900,"وش اسم برنامج Survivor العربي؟","المليون"),
        q("cat_culture",900,"وش اسم أول فيلم حصل على أوسكار من العالم العربي؟","Z"),
        q("cat_culture",900,"كم جزء لسلسلة Harry Potter الرئيسية؟","8"),
        q("cat_culture",900,"وش اسم أكثر فيلم إيرادات في التاريخ؟","Avatar"),
        q("cat_culture",900,"وش اسم مخرج فيلم Avengers Endgame؟","Anthony & Joe Russo"),
        q("cat_culture",900,"وش اسم بطلة فيلم Hunger Games؟","كاتنيس إيفردين"),
        q("cat_culture",900,"في أي سنة صدر أول فيلم Toy Story؟","1995"),
        q("cat_culture",900,"وش اسم الفيلم الذي يمثّل فيه وِيل سميث ملاكم؟","Ali"),

        # ── رياضة ─────────────────────────────────────────────────────
        q("cat_sports",300,"كم لاعب في فريق كرة القدم؟","11"),
        q("cat_sports",300,"كم هدف فاز به المنتخب السعودي على الأرجنتين 2022؟","2-1"),
        q("cat_sports",300,"في أي دولة أُقيم كأس العالم 2022؟","قطر"),
        q("cat_sports",300,"من فاز بكأس العالم 2022؟","الأرجنتين"),
        q("cat_sports",300,"أشهر لاعب كرة قدم في العالم؟","رونالدو / ميسي"),
        q("cat_sports",300,"أي نادي يلعب فيه رونالدو في السعودية؟","النصر"),
        q("cat_sports",300,"ما رقم قميص رونالدو المشهور؟","7"),
        q("cat_sports",300,"من فاز بكأس العالم أكثر مرة؟","البرازيل (5 مرات)"),
        q("cat_sports",300,"كم دقيقة المباراة الأصلية؟","90"),
        q("cat_sports",300,"أول بطولة آسيا للأندية فاز بها نادي سعودي؟","الهلال"),
        q("cat_sports",300,"كم مرة فاز الهلال بالدوري السعودي؟","أكثر من 18 مرة"),
        q("cat_sports",300,"ما الرياضة التي تستخدم رقعة الشطرنج؟","الشطرنج"),
        q("cat_sports",300,"كم لاعب في فريق كرة السلة؟","5"),
        q("cat_sports",300,"كم أشواط في مباراة تنس؟","3 أو 5"),
        q("cat_sports",300,"مَن صاحب أكثر ميداليات أولمبية؟","مايكل فيلبس"),
        q("cat_sports",600,"من فاز بكأس العالم للأندية 2023؟","Manchester City"),
        q("cat_sports",600,"كم فريق في دوري أبطال أوروبا؟","32 فريق"),
        q("cat_sports",600,"أي نادي سعودي يلعب فيه نيمار؟","الهلال"),
        q("cat_sports",600,"أول دولة عربية تستضيف كأس العالم؟","قطر"),
        q("cat_sports",600,"أين تقع بطولة ويمبلدون؟","لندن، إنجلترا"),
        q("cat_sports",600,"من حمل راية السعودية في أولمبياد 2024؟","طارق حامدي"),
        q("cat_sports",600,"كم دولة تشارك في كأس العالم 2026؟","48"),
        q("cat_sports",600,"من فاز بأكثر كؤوس تشامبيونز؟","ريال مدريد"),
        q("cat_sports",600,"ما الفرق بين الجودو والكاراتيه؟","الجودو رياضة مصارعة، الكاراتيه ضربات"),
        q("cat_sports",600,"أين أُقيمت أولمبياد 2024؟","باريس"),
        q("cat_sports",600,"من فاز ببطولة الفورمولا 1 أكثر مرات؟","لويس هاملتون (7 مرات)"),
        q("cat_sports",600,"أي فريق فاز بأكثر دوريات كأس السوبر السعودي؟","الهلال"),
        q("cat_sports",600,"أشهر سباق دراجات في العالم؟","Tour de France"),
        q("cat_sports",600,"كم أمتار في سباق 100 م؟","100"),
        q("cat_sports",600,"من يحمل لقب الأقوى رجل في العالم؟","بطل World's Strongest Man"),
        q("cat_sports",900,"في أي سنة أُسِّس نادي الهلال السعودي؟","1957"),
        q("cat_sports",900,"أول سعودي يفوز بميدالية أولمبية؟","هاشم الحسن 1984"),
        q("cat_sports",900,"من يحمل رقم الأهداف الأعلى في تاريخ كأس العالم؟","رونالدو البرازيلي (15 هدف)"),
        q("cat_sports",900,"أي دولة فازت بأكثر ميداليات أولمبية تاريخياً؟","أمريكا"),
        q("cat_sports",900,"من هو مدرب المنتخب السعودي في كأس العالم 2022؟","هيرفي رينار"),
        q("cat_sports",900,"في أي سنة مشاركة السعودية الأولى في كأس العالم؟","1994"),
        q("cat_sports",900,"ما اسم أكبر ملعب في السعودية؟","ملعب الملك فهد الدولي"),
        q("cat_sports",900,"من فاز ببطولة NBA أكثر مرة؟","بوسطن سيلتيكس"),
        q("cat_sports",900,"كم دولة في كأس الخليج العربي؟","6"),
        q("cat_sports",900,"من أسرع عداء في التاريخ؟","أوسين بولت"),
        q("cat_sports",900,"كم مرة فاز الاتحاد ببطولة دوري أبطال آسيا؟","مرتين"),
        q("cat_sports",900,"أين يقع ملعب Camp Nou؟","برشلونة، إسبانيا"),
        q("cat_sports",900,"من يلعب دور الحارس في كرة القدم؟","حارس المرمى"),
        q("cat_sports",900,"في أي سنة أسس نادي الاتحاد السعودي؟","1927"),
        q("cat_sports",900,"من فاز بكأس العالم 2018؟","فرنسا"),

        # ── موسيقى وفن ────────────────────────────────────────────────
        q("cat_music",300,"من هو المطرب السعودي الأشهر؟","محمد عبده"),
        q("cat_music",300,"من هو فنان العرب؟","محمد عبده"),
        q("cat_music",300,"أغنية رابح صقر الأشهر؟","يا ليل / وليد الشامي"),
        q("cat_music",300,"أي مطرب لقّب بكوكب الشرق؟","أم كلثوم"),
        q("cat_music",300,"وش اسم أغنية عمرو دياب الأشهر؟","حبيبي يا نور عيني"),
        q("cat_music",300,"من غنى أغنية Shape of You؟","Ed Sheeran"),
        q("cat_music",300,"أي تطبيق يُستخدم لاكتشاف اسم الأغنية؟","Shazam"),
        q("cat_music",300,"كم وتر في الجيتار الكلاسيكي؟","6"),
        q("cat_music",300,"من هو ملك البوب العالمي؟","مايكل جاكسون"),
        q("cat_music",300,"أشهر أغنية في فيلم Titanic؟","My Heart Will Go On"),
        q("cat_music",300,"أشهر مغني راب عربي؟","فريدي / عمر سليمان"),
        q("cat_music",300,"أشهر مطربة خليجية؟","أحلام / نوال الكويتية"),
        q("cat_music",300,"وش اسم مجموعة الأغاني الأشهر ببريطانيا؟","The Beatles"),
        q("cat_music",300,"من هو بوزيقي صاحب الكمان الأشهر؟","مصطفى الكرد"),
        q("cat_music",300,"وش اسم مسابقة الأغاني الأوروبية؟","Eurovision"),
        q("cat_music",600,"وش اسم ألبوم مايكل جاكسون الأشهر؟","Thriller"),
        q("cat_music",600,"من هو مؤلف أوبرا Rigoletto؟","فيردي"),
        q("cat_music",600,"وش اسم مطرب Save Your Tears؟","The Weeknd"),
        q("cat_music",600,"كم طبقة في الصوت البشري؟","4 رئيسية (سوبرانو، ألتو، تينور، باص)"),
        q("cat_music",600,"أي بلد يُعدّ مهد موسيقى الجاز؟","أمريكا (نيو أورليانز)"),
        q("cat_music",600,"وش اسم أغنية فيروز الأشهر؟","سألوني الناس"),
        q("cat_music",600,"وش اسم المطرب السعودي الشاب الأشهر؟","ماجد المهندس / رابح صقر"),
        q("cat_music",600,"من غنى أغنية Someone Like You؟","Adele"),
        q("cat_music",600,"وش اسم جهاز عزف الموسيقى الكلاسيكية بـ 88 مفتاح؟","البيانو"),
        q("cat_music",600,"في أي سنة تأسست مجموعة BTS؟","2013"),
        q("cat_music",600,"وش اسم أغنية عبدالمجيد عبدالله الأشهر؟","لا تسأل"),
        q("cat_music",600,"أشهر مطربة في تاريخ أمريكا؟","Whitney Houston / Mariah Carey"),
        q("cat_music",600,"وش اسم مطرب YMCA؟","Village People"),
        q("cat_music",600,"من هو صاحب أغنية Blinding Lights؟","The Weeknd"),
        q("cat_music",600,"وش اسم الآلة الموسيقية العربية بوتر؟","العود"),
        q("cat_music",900,"وش اسم السيمفونية رقم 9 لبيتهوفن؟","Ode to Joy"),
        q("cat_music",900,"في أي سنة توفي مايكل جاكسون؟","2009"),
        q("cat_music",900,"وش اسم أغنية النشيد الوطني السعودي؟","النشيد الوطني السعودي (عاشت الملك)"),
        q("cat_music",900,"من مؤلف سيمفونية القدر؟","بيتهوفن"),
        q("cat_music",900,"وش اسم الجائزة الموسيقية الكبرى في أمريكا؟","Grammy"),
        q("cat_music",900,"وش اسم أكثر أغنية مشاهدةً في YouTube؟","Baby Shark"),
        q("cat_music",900,"من هو أكثر فنان بيعاً في تاريخ الموسيقى؟","مايكل جاكسون"),
        q("cat_music",900,"وش اسم أول نشيد وطني مسجّل صوتياً في التاريخ؟","النشيد البريطاني"),
        q("cat_music",900,"في أي سنة تأسست دار الأوبرا في دبي؟","2016"),
        q("cat_music",900,"من مؤلف الموزارت؟","والد ليوبولد موتسارت - هو نفسه مؤلف"),
        q("cat_music",900,"وش اسم مطرب أغنية Bohemian Rhapsody؟","Freddie Mercury / Queen"),
        q("cat_music",900,"كم مرة فازت Adele بجائزة Grammy؟","15 مرة"),
        q("cat_music",900,"من هو المطرب الكوري الأكثر متابعةً؟","BTS"),
        q("cat_music",900,"وش اسم أداة الموسيقى التقليدية السعودية؟","الدف والمزمار"),
        q("cat_music",900,"في أي سنة صدر ألبوم Thriller؟","1982"),
    ]

    await db.questions.insert_many(questions)
    total_q = len(questions)
    total_c = len(categories)
    return {"message": f"تم إضافة {total_c} فئة و {total_q} سؤال"}


# ══════════════════════════════════════════════════════════════════════════════
# ══════════════════════════════════════════════════════════════════════════════
# SETTINGS
# ══════════════════════════════════════════════════════════════════════════════

DEFAULT_SETTINGS = {
    "key": "game_settings",
    "default_timer": 65,
    "word_timers": {"300": 80, "600": 60, "900": 45},
    "free_categories": ["cat_word", "cat_islamic", "cat_music", "cat_flags", "cat_easy", "cat_science"],
    "trial_enabled": True,
    "trial_team1_categories": ["cat_flags", "cat_easy", "cat_word"],
    "trial_team2_categories": ["cat_islamic", "cat_science", "cat_music"],
    "trial_questions_only": False,
}

@api_router.get("/settings")
async def get_settings():
    s = await db.settings.find_one({"key": "game_settings"}, {"_id": 0})
    if not s:
        await db.settings.insert_one({**DEFAULT_SETTINGS})
        return {**DEFAULT_SETTINGS}
    s.pop("_id", None)
    # Merge with defaults to ensure new fields are always present
    merged = {**DEFAULT_SETTINGS, **s}
    return merged

@api_router.put("/settings")
async def update_settings(body: dict, admin=Depends(get_admin)):
    body.pop("_id", None)
    body.pop("key", None)
    await db.settings.update_one(
        {"key": "game_settings"},
        {"$set": {**body, "key": "game_settings"}},
        upsert=True
    )
    updated = await db.settings.find_one({"key": "game_settings"}, {"_id": 0})
    if updated:
        updated.pop("_id", None)
        return {**DEFAULT_SETTINGS, **updated}
    return {"message": "تم حفظ الإعدادات"}

# ══════════════════════════════════════════════════════════════════════════════
# IMAGE UPLOAD
# ══════════════════════════════════════════════════════════════════════════════

ALLOWED_EXTS = {"jpg", "jpeg", "png", "webp"}

@api_router.post("/upload")
async def upload_image(request: Request, file: UploadFile = File(...), admin=Depends(get_admin)):
    ext = (file.filename or "file.jpg").rsplit(".", 1)[-1].lower()
    if ext not in ALLOWED_EXTS:
        raise HTTPException(400, "يُسمح فقط بـ PNG / JPG / WEBP")
    if file.size and file.size > 5 * 1024 * 1024:
        raise HTTPException(400, "الحجم الأقصى 5 ميغابايت")
    filename = f"{uuid.uuid4()}.{ext}"
    dest = UPLOAD_DIR / filename
    content = await file.read()
    dest.write_bytes(content)
    # Use forwarded host/proto headers if behind reverse proxy
    fwd_proto = request.headers.get("x-forwarded-proto") or str(request.base_url).split("://")[0]
    fwd_host  = request.headers.get("x-forwarded-host") or request.headers.get("host") or str(request.base_url).split("://")[1].rstrip("/")
    base = f"{fwd_proto}://{fwd_host.rstrip('/')}"
    url = f"{base}/api/static/uploads/{filename}"
    return {"url": url, "filename": filename}

# ROOT
# ══════════════════════════════════════════════════════════════════════════════

# ══════════════════════════════════════════════════════════════════════════════
# AI QUESTION GENERATOR  (Google Gemini 2.0 Flash – direct REST)
# ══════════════════════════════════════════════════════════════════════════════

async def _gemini_generate(prompt: str) -> str:
    api_key = os.environ.get("GEMINI_API_KEY", "")
    if not api_key:
        raise HTTPException(500, "GEMINI_API_KEY غير مضبوط في ملف البيئة")
    url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-lite-latest:generateContent?key={api_key}"
    payload = {"contents": [{"parts": [{"text": prompt}]}]}
    async with httpx.AsyncClient(timeout=60) as client:
        r = await client.post(url, json=payload)
    if r.status_code != 200:
        raise HTTPException(500, f"خطأ Gemini {r.status_code}: {r.text[:300]}")
    data = r.json()
    try:
        return data["candidates"][0]["content"]["parts"][0]["text"]
    except (KeyError, IndexError):
        raise HTTPException(500, "لم يُرسل Gemini استجابة نصية")


@api_router.post("/ai/generate-questions")
async def ai_generate_questions(body: dict, admin=Depends(get_admin)):
    category_id = body.get("category_id", "")
    raw_diff = body.get("difficulty", 300)
    diff_map = {"easy": 300, "medium": 600, "hard": 900, "سهل": 300, "متوسط": 600, "صعب": 900}
    difficulty = diff_map.get(str(raw_diff).lower(), None) or (int(raw_diff) if str(raw_diff).isdigit() else 300)
    count = min(int(body.get("count", 10)), 20)

    cat = await db.categories.find_one({"id": category_id}, {"_id": 0})
    cat_name   = cat.get("name", "عامة") if cat else "عامة"
    diff_label = "سهلة ومباشرة" if difficulty == 300 else ("متوسطة الصعوبة" if difficulty == 600 else "صعبة ومتحدية")

    prompt = (
        f"أنشئ بالضبط {count} سؤال ترفيهي لفئة \"{cat_name}\" بمستوى ({diff_label}).\n\n"
        "شروط أساسية:\n"
        "- اكتب باللغة العربية الفصيحة أو العامية السعودية\n"
        "- الأسئلة حماسية، متنوعة، وغير متكررة\n"
        "- الإجابة قصيرة جداً: كلمة أو كلمتان فقط\n"
        "- لا تُضِف أي شرح أو ترقيم خارج الـ JSON\n\n"
        "أرجع JSON array فقط بالشكل التالي وبدون أي نص قبله أو بعده:\n"
        '[{"text":"نص السؤال؟","answer":"الإجابة"},{"text":"سؤال آخر؟","answer":"إجابة"}]'
    )

    raw_text = await _gemini_generate(prompt)
    m = re.search(r'\[.*\]', raw_text, re.DOTALL)
    if not m:
        raise HTTPException(500, "لم يُرسل Gemini JSON صالحاً")
    try:
        raw_list = json.loads(m.group())
    except json.JSONDecodeError:
        raise HTTPException(500, "فشل في قراءة JSON المُرسَل من Gemini")

    questions = []
    for q in raw_list[:count]:
        txt = (q.get("text") or "").strip()
        ans = (q.get("answer") or "").strip()
        if txt and ans:
            questions.append({
                "id":               str(uuid.uuid4()),
                "category_id":      category_id,
                "difficulty":       difficulty,
                "text":             txt,
                "answer":           ans,
                "image_url":        "",
                "answer_image_url": "",
                "question_type":    "text",
                "is_experimental":  True,
                "created_at":       datetime.now(timezone.utc).isoformat(),
            })
    return {"questions": questions, "count": len(questions)}


@api_router.post("/ai/save-questions")
async def ai_save_questions(body: dict, admin=Depends(get_admin)):
    questions = body.get("questions", [])
    if not questions:
        raise HTTPException(400, "لا توجد أسئلة للحفظ")
    to_insert = []
    for q in questions:
        q.pop("_id", None)
        if not q.get("id"):
            q["id"] = str(uuid.uuid4())
        to_insert.append(q)
    await db.questions.insert_many(to_insert)
    return {"message": f"تم حفظ {len(to_insert)} سؤال", "count": len(to_insert)}

@api_router.get("/")
async def root():
    return {"message": "Hujjah API v2 – حُجّة", "version": "2.0"}

app.include_router(api_router)
app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
