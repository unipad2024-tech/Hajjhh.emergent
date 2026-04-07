from fastapi import FastAPI, APIRouter, HTTPException, Depends, Header, Request, BackgroundTasks, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from dotenv import load_dotenv
from motor.motor_asyncio import AsyncIOMotorClient
import os, logging, uuid, random, shutil, re, json, httpx, asyncio, io
from pathlib import Path
from pydantic import BaseModel, EmailStr, Field
from typing import List, Optional, Dict
from datetime import datetime, timezone, timedelta
from jose import jwt, JWTError
from passlib.context import CryptContext
import aiosmtplib
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from emergentintegrations.payments.stripe.checkout import (
    StripeCheckout, CheckoutSessionRequest, CheckoutSessionResponse, CheckoutStatusResponse
)
from services.payment.paylinkService import create_invoice as paylink_create_invoice, get_invoice_status as paylink_get_status
import pandas as pd

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
PAYMENT_API_ID  = os.environ.get('PAYMENT_API_ID', '')
PAYMENT_API_KEY = os.environ.get('PAYMENT_API_KEY', '')
EMAIL_USER      = os.environ.get('EMAIL_USER', '')
EMAIL_PASS      = os.environ.get('EMAIL_PASS', '')
UNSPLASH_API_KEY = os.environ.get('UNSPLASH_API_KEY', '')
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
    username: str = "admin"
    password: str

class AdminUserUpdate(BaseModel):
    subscription_type: str
    subscription_expires_at: Optional[str] = None

class StaffCreate(BaseModel):
    username: str
    password: str
    display_name: str = ""

class GiftSubscription(BaseModel):
    plan_id: str = "monthly"
    days: Optional[int] = None

class CategoryGroup(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    icon: str = ""
    color: str = "#5B0E14"
    order: int = 0
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())

class CategoryGroupCreate(BaseModel):
    name: str
    icon: str = ""
    color: str = "#5B0E14"
    order: int = 0

class Category(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    description: str = ""
    icon: str = ""
    image_url: str = ""
    is_special: bool = False
    is_premium: bool = False
    is_active: bool = True
    color: str = "#5B0E14"
    order: int = 0
    group_id: Optional[str] = None
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())

class CategoryCreate(BaseModel):
    name: str
    description: str = ""
    icon: str = ""
    image_url: str = ""
    is_special: bool = False
    is_premium: bool = False
    is_active: bool = True
    color: str = "#5B0E14"
    order: int = 0
    group_id: Optional[str] = None

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

async def get_admin(authorization: Optional[str] = Header(None)) -> dict:
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(401, "غير مصرح")
    try:
        data = jwt.decode(authorization.split(" ")[1], SECRET_KEY, algorithms=[ALGORITHM])
        if data.get("role") != "admin":
            raise HTTPException(403, "غير مصرح")
        # backward compat: old tokens without sub_role — treat as super_admin
        if "sub_role" not in data:
            data["sub_role"] = "super_admin"
            data["admin_name"] = "المدير الرئيسي"
        return data
    except JWTError:
        raise HTTPException(401, "جلسة منتهية")

async def get_super_admin(authorization: Optional[str] = Header(None)) -> dict:
    """Dependency that only allows super_admin access."""
    admin = await get_admin(authorization)
    if admin.get("sub_role") != "super_admin":
        raise HTTPException(403, "يتطلب صلاحيات المدير الرئيسي فقط")
    return admin

async def log_admin_action(admin_data: dict, action: str, target_type: str,
                            target_name: str = "", details: str = ""):
    """Log admin/staff actions to admin_logs collection."""
    try:
        log = {
            "id": str(uuid.uuid4()),
            "admin_name": admin_data.get("admin_name", "غير معروف"),
            "admin_role": admin_data.get("sub_role", "admin"),
            "action": action,
            "target_type": target_type,
            "target_name": target_name,
            "details": details,
            "timestamp": datetime.now(timezone.utc).isoformat(),
        }
        await db.admin_logs.insert_one(log)
    except Exception as e:
        logger.warning(f"Failed to log admin action: {e}")

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
    username = (body.username or "admin").strip()
    # Super admin login
    if username.lower() == "admin" or username == "":
        if body.password != ADMIN_PASSWORD:
            raise HTTPException(401, "كلمة المرور غلط")
        token = create_token(
            {"sub": "admin", "role": "admin", "sub_role": "super_admin",
             "admin_name": "المدير الرئيسي"},
            expires_hours=48
        )
        return {"token": token, "role": "super_admin", "name": "المدير الرئيسي"}
    # Staff login
    staff = await db.admin_accounts.find_one({"username": username}, {"_id": 0})
    if not staff or not verify_pw(body.password, staff.get("password_hash", "")):
        raise HTTPException(401, "اسم المستخدم أو كلمة المرور غلط")
    display = staff.get("display_name") or username
    token = create_token(
        {"sub": staff["id"], "role": "admin", "sub_role": "staff",
         "admin_name": display},
        expires_hours=48
    )
    return {"token": token, "role": "staff", "name": display}

@api_router.get("/admin/verify")
async def admin_verify(admin: dict = Depends(get_admin)):
    return {"valid": True, "role": admin.get("sub_role", "super_admin"), "name": admin.get("admin_name", "المدير")}

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
async def admin_list_users(_: dict = Depends(get_super_admin)):
    users = await db.users.find({}, {"_id": 0, "password_hash": 0, "answered_question_ids": 0}).to_list(1000)
    for u in users:
        u["answered_count"] = 0
        full = await db.users.find_one({"id": u["id"]}, {"answered_question_ids": 1})
        if full:
            u["answered_count"] = len(full.get("answered_question_ids", []))
    return users

@api_router.put("/admin/users/{user_id}")
async def admin_update_user(user_id: str, body: AdminUserUpdate, admin: dict = Depends(get_super_admin)):
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
    await log_admin_action(admin, "تعديل اشتراك", "مستخدم",
                           user.get("username", user_id) if user else user_id,
                           f"الاشتراك → {body.subscription_type}")
    return user

@api_router.delete("/admin/users/{user_id}")
async def admin_delete_user(user_id: str, admin: dict = Depends(get_super_admin)):
    user = await db.users.find_one({"id": user_id}, {"_id": 0})
    await db.users.delete_one({"id": user_id})
    await log_admin_action(admin, "حذف", "مستخدم",
                           user.get("username", user_id) if user else user_id)
    return {"message": "تم الحذف"}

@api_router.get("/admin/analytics")
async def admin_analytics(_: dict = Depends(get_super_admin)):
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

    # Enhanced platform analytics
    active_cats = await db.categories.count_documents({"is_active": {"$ne": False}})
    inactive_cats = await db.categories.count_documents({"is_active": False})
    premium_cats = await db.categories.count_documents({"is_premium": True})
    most_popular = max(cat_stats, key=lambda x: x["count"]) if cat_stats else {}

    return {
        "users":    {"total": users_total, "premium": premium, "free": users_total - premium, "recent_7d": recent_7d},
        "questions": {"total": q_total, "by_category": cat_stats},
        "sessions": {"total": sessions_total, "active_24h": active_24h},
        "revenue":  {"total": round(total_revenue, 2), "currency": "SAR", "recent_transactions": recent_txns},
        "categories": {"total": len(cats), "active": active_cats, "inactive": inactive_cats,
                       "premium": premium_cats, "most_popular": most_popular},
    }

@api_router.get("/admin/sessions")
async def admin_sessions(_: dict = Depends(get_super_admin)):
    sessions = await db.game_sessions.find({}, {"_id": 0}).sort("created_at", -1).to_list(50)
    return sessions

@api_router.get("/admin/payments")
async def admin_payments(_: dict = Depends(get_super_admin)):
    txns = await db.payment_transactions.find({}, {"_id": 0}).sort("created_at", -1).to_list(100)
    return txns

# ══════════════════════════════════════════════════════════════════════════════
# CATEGORIES
# ══════════════════════════════════════════════════════════════════════════════

@api_router.get("/categories")
async def get_categories(show_inactive: bool = False):
    cats = await db.categories.find({}, {"_id": 0}).sort("order", 1).to_list(100)
    for c in cats:
        c.setdefault("is_premium", False)
        c.setdefault("is_active", True)
    if not show_inactive:
        cats = [c for c in cats if c.get("is_active", True)]
    return cats

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
async def create_category(body: CategoryCreate, admin: dict = Depends(get_admin)):
    cat = Category(**body.model_dump())
    await db.categories.insert_one(cat.model_dump())
    await log_admin_action(admin, "إضافة", "فئة", cat.name)
    return cat

@api_router.put("/categories/{cat_id}")
async def update_category(cat_id: str, body: CategoryCreate, admin: dict = Depends(get_admin)):
    upd = {**body.model_dump(), "updated_at": datetime.now(timezone.utc).isoformat()}
    res = await db.categories.find_one_and_update({"id": cat_id}, {"$set": upd}, {"_id": 0}, return_document=True)
    if not res:
        raise HTTPException(404, "الفئة غير موجودة")
    await log_admin_action(admin, "تعديل", "فئة", res.get("name", cat_id))
    return res

@api_router.delete("/categories/{cat_id}")
async def delete_category(cat_id: str, admin: dict = Depends(get_admin)):
    cat = await db.categories.find_one({"id": cat_id}, {"_id": 0})
    await db.categories.delete_one({"id": cat_id})
    await db.questions.delete_many({"category_id": cat_id})
    await log_admin_action(admin, "حذف", "فئة", cat.get("name", cat_id) if cat else cat_id)
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
async def create_question(body: QuestionCreate, admin: dict = Depends(get_admin)):
    q = Question(**body.model_dump())
    await db.questions.insert_one(q.model_dump())
    cat = await db.categories.find_one({"id": body.category_id}, {"_id": 0, "name": 1})
    cat_name = cat.get("name", body.category_id) if cat else body.category_id
    await log_admin_action(admin, "إضافة", "سؤال", q.text[:60], f"فئة: {cat_name} | صعوبة: {body.difficulty}")
    return q

@api_router.put("/questions/{q_id}")
async def update_question(q_id: str, body: QuestionCreate, admin: dict = Depends(get_admin)):
    upd = {**body.model_dump(), "updated_at": datetime.now(timezone.utc).isoformat()}
    res = await db.questions.find_one_and_update({"id": q_id}, {"$set": upd}, {"_id": 0}, return_document=True)
    if not res: raise HTTPException(404, "السؤال غير موجود")
    await log_admin_action(admin, "تعديل", "سؤال", res.get("text", q_id)[:60])
    return res

@api_router.delete("/questions/{q_id}")
async def delete_question(q_id: str, admin: dict = Depends(get_admin)):
    q = await db.questions.find_one({"id": q_id}, {"_id": 0})
    if not q:
        raise HTTPException(404, "السؤال غير موجود")
    # Backup before deletion — questions can be restored from admin panel
    backup = {**q, "deleted_at": datetime.now(timezone.utc).isoformat(),
              "deleted_by": admin.get("admin_name", "غير معروف")}
    await db.deleted_questions.insert_one(backup)
    await db.questions.delete_one({"id": q_id})
    await log_admin_action(admin, "حذف", "سؤال", q.get("text", q_id)[:60] if q else q_id)
    return {"message": "تم الحذف (يمكن استعادته من سلة المحذوفات)"}

@api_router.get("/admin/deleted-questions")
async def get_deleted_questions(limit: int = 50, admin: dict = Depends(get_admin)):
    """List recently deleted questions — admin only."""
    deleted = await db.deleted_questions.find(
        {}, {"_id": 0}
    ).sort("deleted_at", -1).limit(limit).to_list(limit)
    return {"items": deleted, "total": len(deleted)}

@api_router.post("/admin/restore-question/{q_id}")
async def restore_question(q_id: str, admin: dict = Depends(get_admin)):
    """Restore a question from the deleted questions archive."""
    q = await db.deleted_questions.find_one({"id": q_id}, {"_id": 0})
    if not q:
        raise HTTPException(404, "السؤال غير موجود في المحذوفات")
    restore_doc = {k: v for k, v in q.items() if k not in ("deleted_at", "deleted_by")}
    # Assign a fresh ID to avoid collision
    restore_doc["id"] = str(uuid.uuid4())
    restore_doc["restored_at"] = datetime.now(timezone.utc).isoformat()
    await db.questions.insert_one(restore_doc)
    await db.deleted_questions.delete_one({"id": q_id})
    await log_admin_action(admin, "استعادة سؤال", "سؤال", q.get("text", q_id)[:60])
    return {"message": "تمت الاستعادة", "new_id": restore_doc["id"]}

@api_router.patch("/questions/{q_id}/autosave")
async def autosave_question(q_id: str, body: dict, admin: dict = Depends(get_admin)):
    """Quick auto-save for question field changes — no full validation required."""
    allowed_fields = {"text", "answer", "image_url", "answer_image_url", "image_query", "difficulty"}
    updates = {k: v for k, v in body.items() if k in allowed_fields}
    if not updates:
        return {"saved": False, "reason": "no valid fields"}
    updates["updated_at"] = datetime.now(timezone.utc).isoformat()
    await db.questions.update_one({"id": q_id}, {"$set": updates})
    return {"saved": True, "updated_fields": list(updates.keys())}


# ══════════════════════════════════════════════════════════════════════════════
# QUESTION IMPORT  (All file types + AI extraction)
# ══════════════════════════════════════════════════════════════════════════════

DIFF_MAP_IMPORT = {300: 300, 600: 600, 900: 900, "300": 300, "600": 600, "900": 900,
                   "easy": 300, "سهل": 300, "medium": 600, "متوسط": 600, "hard": 900, "صعب": 900}

def _parse_difficulty(val) -> int:
    if val is None: return 300
    if isinstance(val, (int, float)) and not str(val) == "nan":
        return DIFF_MAP_IMPORT.get(int(val), 300)
    return DIFF_MAP_IMPORT.get(str(val).strip().lower(), 300)

def _parse_questions_df(df: "pd.DataFrame", category_id: str) -> list:
    """Convert a DataFrame to a list of question dicts."""
    col_map = {}
    for c in df.columns:
        cl = str(c).strip().lower()
        if cl in ("text", "question", "سؤال", "نص السؤال"):
            col_map["text"] = c
        elif cl in ("answer", "الإجابة", "إجابة", "جواب"):
            col_map["answer"] = c
        elif cl in ("difficulty", "صعوبة", "مستوى"):
            col_map["difficulty"] = c
        elif cl in ("category_id", "category", "فئة"):
            col_map["category_id"] = c
        elif cl in ("image_url", "image", "صورة"):
            col_map["image_url"] = c
        elif cl in ("image_query",):
            col_map["image_query"] = c

    questions = []
    ts = datetime.now(timezone.utc).isoformat()
    for _, row in df.iterrows():
        text  = str(row.get(col_map.get("text", ""), "") or "").strip()
        ans   = str(row.get(col_map.get("answer", ""), "") or "").strip()
        if not text or not ans or text == "nan" or ans == "nan":
            continue
        cat_id = str(row.get(col_map.get("category_id", ""), category_id) or category_id).strip()
        diff   = _parse_difficulty(row.get(col_map.get("difficulty", ""), 300))
        img    = str(row.get(col_map.get("image_url", ""), "") or "").strip()
        query  = str(row.get(col_map.get("image_query", ""), "") or "").strip()
        questions.append({
            "id":               str(uuid.uuid4()),
            "category_id":      cat_id if cat_id != "nan" else category_id,
            "difficulty":       diff,
            "text":             text,
            "answer":           ans,
            "image_url":        img if img != "nan" else "",
            "answer_image_url": "",
            "image_query":      query if query != "nan" else "",
            "question_type":    "text",
            "is_experimental":  False,
            "status":           "pending",
            "created_at":       ts,
        })
    return questions


AI_EXTRACT_PROMPT = """أنت خبير في استخراج الأسئلة من المحتوى العربي.

مهمتك: استخراج جميع الأسئلة والإجابات من النص التالي.

قواعد صارمة:
1. استخرج نص الإجابة الكاملة — لا تكتب 'أ' أو 'ب' أو 'ج' أو 'د' أو A/B/C/D أبداً
2. إذا كانت أسئلة متعددة الاختيارات: اكتب نص الإجابة الصحيحة كاملاً
3. difficulty: حدد المستوى بدقة: 300 (سهل/معلومات عامة) أو 600 (متوسط/يحتاج تفكير) أو 900 (صعب/متخصص)
4. لا تجمع السؤال مع الإجابة في نفس الحقل
5. استخرج كل الأسئلة الموجودة — لا تتجاهل أي منها
6. image_query: جملة إنجليزية قصيرة مناسبة للبحث عن صورة

أعد JSON array فقط بدون أي نص آخر:
[{"text":"نص السؤال؟","answer":"الإجابة الكاملة","difficulty":300,"image_query":"search term"}]

"""

CHUNK_SIZE = 12000  # chars per AI call


async def _parse_ai_response_to_questions(raw: str, category_id: str, ai_engine: str = "claude", extra_prompt: str = "") -> list:
    """Parse AI response JSON → question dicts. Returns empty list on failure."""
    # Try to extract JSON array
    m = re.search(r'\[\s*\{.*?\}\s*\]', raw, re.DOTALL) or re.search(r'\[.*\]', raw, re.DOTALL)
    if not m:
        return []
    try:
        items = json.loads(m.group())
    except json.JSONDecodeError:
        # Try to repair broken JSON
        try:
            items = json.loads(m.group().replace("'", '"'))
        except Exception:
            return []

    ts = datetime.now(timezone.utc).isoformat()
    questions = []
    for r in items:
        text = str(r.get("text") or r.get("question") or "").strip()
        ans  = str(r.get("answer") or r.get("إجابة") or "").strip()
        if not text or not ans:
            continue
        # Skip answers that are just choice letters
        if ans.strip() in {"أ", "ب", "ج", "د", "A", "B", "C", "D", "1", "2", "3", "4"}:
            continue
        questions.append({
            "id":               str(uuid.uuid4()),
            "category_id":      str(r.get("category_id") or category_id).strip() or category_id,
            "difficulty":       _parse_difficulty(r.get("difficulty", 300)),
            "text":             text,
            "answer":           ans,
            "image_url":        str(r.get("image_url") or "").strip(),
            "answer_image_url": "",
            "image_query":      str(r.get("image_query") or "").strip(),
            "question_type":    "text",
            "is_experimental":  False,
            "status":           "pending",
            "created_at":       ts,
        })
    return questions


async def _extract_via_ai(text_content: str, category_id: str, extra_prompt: str = "", ai_engine: str = "claude") -> list:
    """Extract Q&A from plain text using AI, with chunked processing for large files."""
    custom = f"\nتعليمات المشرف: {extra_prompt}\n" if extra_prompt else ""
    questions = []
    seen_texts = set()

    # Chunk large documents
    chunks = []
    if len(text_content) <= CHUNK_SIZE:
        chunks = [text_content]
    else:
        # Split by double newline first (paragraph boundary)
        paras = text_content.split("\n\n")
        current = ""
        for para in paras:
            if len(current) + len(para) > CHUNK_SIZE:
                if current.strip():
                    chunks.append(current.strip())
                current = para
            else:
                current += "\n\n" + para
        if current.strip():
            chunks.append(current.strip())

    logger.info(f"File import: {len(chunks)} chunks, total {len(text_content)} chars")

    for i, chunk in enumerate(chunks):
        prompt = AI_EXTRACT_PROMPT + custom + f"\n--- الجزء {i+1}/{len(chunks)} ---\n" + chunk
        try:
            raw = await _ai_generate(prompt, prefer=ai_engine)
            chunk_qs = await _parse_ai_response_to_questions(raw, category_id, ai_engine, extra_prompt)
            for q in chunk_qs:
                if q["text"] not in seen_texts:
                    seen_texts.add(q["text"])
                    questions.append(q)
        except Exception as e:
            logger.warning(f"Chunk {i+1} AI extraction failed: {e}")
            continue
        await asyncio.sleep(0.5)  # Rate limit between chunks

    return questions


async def _extract_pdf_text(content: bytes) -> str:
    """Extract text from a PDF using pypdf."""
    try:
        import pypdf
        reader = pypdf.PdfReader(io.BytesIO(content))
        pages  = [p.extract_text() or "" for p in reader.pages]
        return "\n".join(pages)
    except Exception as e:
        logger.warning(f"PDF extraction error: {e}")
        return ""


async def _extract_docx_text(content: bytes) -> str:
    """Extract text from a Word .docx file."""
    try:
        from docx import Document
        doc = Document(io.BytesIO(content))
        return "\n".join(p.text for p in doc.paragraphs if p.text.strip())
    except Exception as e:
        logger.warning(f"DOCX extraction error: {e}")
        return ""


async def _extract_image_questions(content: bytes, mime: str, category_id: str) -> list:
    """Use Gemini Vision to extract questions from an image."""
    import base64
    img_b64 = base64.b64encode(content).decode()
    GEMINI_KEY = os.environ.get("GEMINI_API_KEY", "")
    if not GEMINI_KEY:
        return []
    payload = {
        "contents": [{
            "parts": [
                {"text": "استخرج الأسئلة والإجابات من هذه الصورة. أعد JSON array فقط: [{\"text\":\"السؤال؟\",\"answer\":\"الإجابة\",\"difficulty\":300,\"image_query\":\"search term\"}]"},
                {"inline_data": {"mime_type": mime, "data": img_b64}},
            ]
        }]
    }
    async with httpx.AsyncClient(timeout=30) as client:
        resp = await client.post(
            f"https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key={GEMINI_KEY}",
            json=payload,
        )
    if resp.status_code != 200:
        return []
    raw = resp.json().get("candidates", [{}])[0].get("content", {}).get("parts", [{}])[0].get("text", "")
    m = re.search(r'\[.*?\]', raw, re.DOTALL)
    if not m:
        return []
    try:
        items = json.loads(m.group())
    except json.JSONDecodeError:
        return []

    ts = datetime.now(timezone.utc).isoformat()
    questions = []
    for r in items:
        text = str(r.get("text") or "").strip()
        ans  = str(r.get("answer") or "").strip()
        if text and ans:
            questions.append({
                "id":               str(uuid.uuid4()),
                "category_id":      category_id,
                "difficulty":       _parse_difficulty(r.get("difficulty", 300)),
                "text":             text,
                "answer":           ans,
                "image_url":        "",
                "answer_image_url": "",
                "image_query":      str(r.get("image_query") or "").strip(),
                "question_type":    "text",
                "is_experimental":  False,
                "status":           "pending",
                "created_at":       ts,
            })
    return questions


@api_router.post("/admin/questions/import")
async def import_questions(
    file: UploadFile = File(...),
    category_id: str = "",
    extra_prompt: str = "",
    ai_engine: str = "claude",
    admin: dict = Depends(get_admin),
):
    """Import questions from any file type (Excel/CSV/JSON/PDF/Word/Image/TXT) with AI extraction."""
    filename = (file.filename or "untitled").lower()
    content  = await file.read()
    questions = []
    extra_prompt = extra_prompt.strip()

    try:
        if filename.endswith(".json"):
            raw = json.loads(content.decode("utf-8"))
            raw_list = raw if isinstance(raw, list) else raw.get("questions", [])
            ts = datetime.now(timezone.utc).isoformat()
            for r in raw_list:
                text = str(r.get("text") or r.get("question") or "").strip()
                ans  = str(r.get("answer") or "").strip()
                if not text or not ans: continue
                questions.append({
                    "id":               str(uuid.uuid4()),
                    "category_id":      str(r.get("category_id") or category_id or "").strip() or category_id,
                    "difficulty":       _parse_difficulty(r.get("difficulty", 300)),
                    "text":             text,
                    "answer":           ans,
                    "image_url":        str(r.get("image_url") or "").strip(),
                    "answer_image_url": "",
                    "image_query":      str(r.get("image_query") or "").strip(),
                    "question_type":    "text",
                    "is_experimental":  False,
                    "status":           "pending",
                    "created_at":       ts,
                })
        elif filename.endswith(".csv"):
            df = pd.read_csv(io.BytesIO(content))
            questions = _parse_questions_df(df, category_id)
        elif filename.endswith((".xlsx", ".xls")):
            df = pd.read_excel(io.BytesIO(content))
            questions = _parse_questions_df(df, category_id)
        elif filename.endswith(".txt"):
            text_content = content.decode("utf-8", errors="replace")
            questions = await _extract_via_ai(text_content, category_id, extra_prompt, ai_engine)
        elif filename.endswith(".pdf"):
            # Try Gemini file analysis first, fallback to text extraction
            tmp_path = f"/tmp/upload_{uuid.uuid4().hex}.pdf"
            with open(tmp_path, "wb") as f:
                f.write(content)
            try:
                prompt = AI_EXTRACT_PROMPT + (f"\nتعليمات: {extra_prompt}\n" if extra_prompt else "")
                prompt += "\nاستخرج جميع الأسئلة من هذا الملف — لا تتجاهل أي سؤال."
                raw = await _gemini_analyze_file(tmp_path, "application/pdf", prompt)
                questions = await _parse_ai_response_to_questions(raw, category_id, ai_engine, extra_prompt)
            except Exception:
                # Fallback: text extraction
                pdf_text = await _extract_pdf_text(content)
                if not pdf_text.strip():
                    raise HTTPException(422, "لم يُمكن استخراج نص من الـ PDF")
                questions = await _extract_via_ai(pdf_text, category_id, extra_prompt, ai_engine)
            finally:
                if os.path.exists(tmp_path): os.remove(tmp_path)
        elif filename.endswith((".docx", ".doc")):
            doc_text = await _extract_docx_text(content)
            if not doc_text.strip():
                raise HTTPException(422, "لم يُمكن استخراج نص من ملف Word")
            questions = await _extract_via_ai(doc_text, category_id, extra_prompt, ai_engine)
        elif filename.endswith((".png", ".jpg", ".jpeg", ".webp", ".gif")):
            ext_to_mime = {".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg",
                           ".webp": "image/webp", ".gif": "image/gif"}
            ext  = "." + filename.rsplit(".", 1)[-1]
            mime = ext_to_mime.get(ext, "image/jpeg")
            questions = await _extract_image_questions(content, mime, category_id)
        else:
            # Try as UTF-8 text → AI extraction
            try:
                text_content = content.decode("utf-8", errors="replace")
                questions = await _extract_via_ai(text_content, category_id, extra_prompt, ai_engine)
            except Exception:
                raise HTTPException(400, "صيغة الملف غير مدعومة")
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(422, f"خطأ في قراءة الملف: {str(e)[:200]}")

    if not questions:
        raise HTTPException(400, "لم يتم العثور على أسئلة صالحة — تأكد من الملف أو جرب تعليمات مختلفة")

    await db.pending_questions.insert_many(questions)
    await log_admin_action(admin, "رفع ملف أسئلة", "أسئلة معلقة", filename,
                           f"عدد الأسئلة: {len(questions)}")
    return {"message": f"تم استيراد {len(questions)} سؤال في انتظار المراجعة", "count": len(questions)}


# ══════════════════════════════════════════════════════════════════════════════
# ADMIN APPROVAL WORKFLOW
# ══════════════════════════════════════════════════════════════════════════════

@api_router.get("/admin/questions/pending")
async def get_pending_questions(
    category_id: Optional[str] = None,
    limit: int = 100,
    admin: dict = Depends(get_admin),
):
    """Get all questions in the staging area awaiting admin approval."""
    q = {}
    if category_id:
        q["category_id"] = category_id
    items = await db.pending_questions.find(q, {"_id": 0}).sort("created_at", -1).limit(limit).to_list(limit)
    total = await db.pending_questions.count_documents(q)
    return {"items": items, "total": total}


@api_router.patch("/admin/questions/pending/{q_id}")
async def patch_pending_question(q_id: str, body: dict, admin: dict = Depends(get_admin)):
    """Update specific fields of a pending question (e.g., image_url, answer_image_url)."""
    allowed = {"text", "answer", "image_url", "answer_image_url", "image_query", "difficulty", "category_id"}
    updates = {k: v for k, v in body.items() if k in allowed}
    if not updates:
        raise HTTPException(400, "لا توجد حقول صالحة للتحديث")
    result = await db.pending_questions.update_one({"id": q_id}, {"$set": updates})
    if result.matched_count == 0:
        raise HTTPException(404, "السؤال غير موجود")
    return {"message": "تم التحديث"}


@api_router.post("/admin/questions/{q_id}/approve")
async def approve_pending_question(q_id: str, body: dict = {}, admin: dict = Depends(get_admin)):
    """Approve a pending question — move it to the live questions collection."""
    q = await db.pending_questions.find_one({"id": q_id}, {"_id": 0})
    if not q:
        raise HTTPException(404, "السؤال غير موجود في قائمة الانتظار")

    # Apply any edits passed in the request body
    allowed = {"text", "answer", "image_url", "answer_image_url", "image_query", "difficulty", "category_id"}
    for k, v in (body or {}).items():
        if k in allowed:
            q[k] = v

    # Auto-fetch Unsplash image if image_query exists but image_url is empty
    if q.get("image_query") and not q.get("image_url"):
        try:
            unsplash_key = os.environ.get("UNSPLASH_API_KEY", "")
            if unsplash_key:
                async with httpx.AsyncClient(timeout=10) as uc:
                    r = await uc.get(
                        "https://api.unsplash.com/photos/random",
                        params={"query": q["image_query"], "orientation": "landscape"},
                        headers={"Authorization": f"Client-ID {unsplash_key}"},
                    )
                    if r.status_code == 200:
                        img_data = r.json()
                        q["image_url"] = img_data.get("urls", {}).get("regular", "")
        except Exception as ue:
            logger.warning(f"Unsplash fetch on approve failed: {ue}")

    q.pop("status", None)
    q["approved_by"] = admin.get("admin_name", "admin")
    q["approved_at"] = datetime.now(timezone.utc).isoformat()

    await db.questions.insert_one(q)
    await db.pending_questions.delete_one({"id": q_id})
    await log_admin_action(admin, "موافقة سؤال", "سؤال", q.get("text", q_id)[:60])
    return {"message": "تمت الموافقة ونشر السؤال", "id": q_id}


@api_router.post("/admin/questions/{q_id}/reject")
async def reject_pending_question(q_id: str, body: dict = {}, admin: dict = Depends(get_admin)):
    """Reject and delete a pending question."""
    q = await db.pending_questions.find_one({"id": q_id}, {"_id": 0})
    if not q:
        raise HTTPException(404, "السؤال غير موجود")
    reason = (body or {}).get("reason", "رُفض من قِبل المشرف")
    await db.pending_questions.delete_one({"id": q_id})
    await log_admin_action(admin, "رفض سؤال", "سؤال", q.get("text", q_id)[:60], reason)
    return {"message": "تم رفض السؤال وحذفه"}


@api_router.put("/admin/questions/{q_id}/pending")
async def update_pending_question(q_id: str, body: dict, admin: dict = Depends(get_admin)):
    """Edit a pending question before approval."""
    allowed = {"text", "answer", "image_url", "answer_image_url", "image_query",
               "difficulty", "category_id", "question_type"}
    updates = {k: v for k, v in body.items() if k in allowed}
    if not updates:
        raise HTTPException(400, "لا توجد حقول صالحة للتحديث")
    updates["updated_at"] = datetime.now(timezone.utc).isoformat()
    res = await db.pending_questions.find_one_and_update(
        {"id": q_id}, {"$set": updates}, {"_id": 0}, return_document=True
    )
    if not res:
        raise HTTPException(404, "السؤال غير موجود")
    return res


@api_router.post("/admin/questions/bulk-fetch-images")
async def bulk_fetch_images(body: dict = {}, admin: dict = Depends(get_admin)):
    """Bulk-fetch Unsplash images for questions that have image_query but empty image_url."""
    unsplash_key = os.environ.get("UNSPLASH_API_KEY", "")
    if not unsplash_key:
        raise HTTPException(503, "Unsplash API key غير مضبوط")

    limit = min(int(body.get("limit", 50)), 200)
    category_id = body.get("category_id")
    q_filter = {"image_query": {"$ne": ""}, "$or": [{"image_url": ""}, {"image_url": None}], "deleted_at": None}
    if category_id:
        q_filter["category_id"] = category_id

    questions = await db.questions.find(q_filter, {"_id": 0, "id": 1, "image_query": 1}).limit(limit).to_list(limit)
    updated = 0
    async with httpx.AsyncClient(timeout=12) as client:
        for q in questions:
            try:
                r = await client.get(
                    "https://api.unsplash.com/photos/random",
                    params={"query": q["image_query"], "orientation": "landscape"},
                    headers={"Authorization": f"Client-ID {unsplash_key}"},
                )
                if r.status_code == 200:
                    img_url = r.json().get("urls", {}).get("regular", "")
                    if img_url:
                        await db.questions.update_one({"id": q["id"]}, {"$set": {"image_url": img_url}})
                        updated += 1
                await asyncio.sleep(0.3)  # Rate limit
            except Exception:
                continue

    return {"message": f"تم تحديث صور {updated} سؤال من أصل {len(questions)}", "updated": updated, "total": len(questions)}

@api_router.post("/admin/questions/approve-all")
async def approve_all_pending(admin: dict = Depends(get_admin)):
    """Approve ALL pending questions in one click (auto-fetch Unsplash for missing images)."""
    pending = await db.pending_questions.find({}, {"_id": 0}).to_list(10000)
    if not pending:
        return {"message": "لا توجد أسئلة معلقة", "count": 0}
    ts     = datetime.now(timezone.utc).isoformat()
    unsplash_key = os.environ.get("UNSPLASH_API_KEY", "")
    to_ins = []
    for q in pending:
        # Auto-fetch Unsplash for questions that need an image
        if unsplash_key and q.get("image_query") and not q.get("image_url"):
            try:
                async with httpx.AsyncClient(timeout=8) as uc:
                    r = await uc.get(
                        "https://api.unsplash.com/photos/random",
                        params={"query": q["image_query"], "orientation": "landscape"},
                        headers={"Authorization": f"Client-ID {unsplash_key}"},
                    )
                    if r.status_code == 200:
                        q["image_url"] = r.json().get("urls", {}).get("regular", "")
            except Exception:
                pass
        q.pop("status", None)
        q["approved_by"] = admin.get("admin_name", "admin")
        q["approved_at"] = ts
        to_ins.append(q)
    await db.questions.insert_many(to_ins)
    await db.pending_questions.delete_many({})
    await log_admin_action(admin, "موافقة جماعية", "أسئلة", f"{len(to_ins)} سؤال")
    return {"message": f"تمت الموافقة على {len(to_ins)} سؤال ونشرها", "count": len(to_ins)}

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

    # Build base query — exclude soft-deleted questions
    base_q = {"category_id": category_id, "difficulty": difficulty, "id": {"$nin": exclude_ids}, "deleted_at": None}

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
        reset_q = {"category_id": category_id, "difficulty": difficulty, "deleted_at": None}
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
# PAYMENT CONFIG (Placeholder for future payment integration)
# ══════════════════════════════════════════════════════════════════════════════

# ══════════════════════════════════════════════════════════════════════════════
# PAYMENT CONFIG & INTEGRATION (PAYMENT_API_ID / PAYMENT_API_KEY)
# ══════════════════════════════════════════════════════════════════════════════

PAYMENT_PUBLIC_KEY  = os.environ.get("PAYMENT_PUBLIC_KEY", "")
PAYMENT_SECRET_KEY_LEGACY = os.environ.get("PAYMENT_SECRET_KEY", "")

@api_router.get("/payment/config")
async def get_payment_config():
    """Returns public payment configuration for frontend."""
    return {
        "public_key": PAYMENT_PUBLIC_KEY,
        "enabled": bool(PAYMENT_PUBLIC_KEY or PAYMENT_API_ID),
        "gateway": "custom" if PAYMENT_API_ID else ("stripe" if STRIPE_API_KEY else "none"),
    }

@api_router.post("/payment/v2/initiate")
async def payment_initiate(body: dict, user: dict = Depends(require_user)):
    """Initiate a payment using PAYMENT_API_ID/PAYMENT_API_KEY."""
    if not PAYMENT_API_ID or not PAYMENT_API_KEY:
        raise HTTPException(503, "بوابة الدفع غير مفعّلة — تواصل مع الإدارة")
    plan_id = body.get("plan_id", "monthly")
    plan = SUBSCRIPTION_PLANS.get(plan_id)
    if not plan:
        raise HTTPException(400, "الخطة غير موجودة")
    txn = {
        "id": str(uuid.uuid4()),
        "user_id": user["id"],
        "email": user["email"],
        "plan_id": plan_id,
        "amount": plan["amount"],
        "currency": plan["currency"],
        "payment_status": "pending",
        "gateway": "payment_api",
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.payment_transactions.insert_one(txn)
    return {
        "transaction_id": txn["id"],
        "amount": plan["amount"],
        "currency": plan["currency"],
        "status": "pending",
        "message": "تم إنشاء طلب الدفع — يرجى إكمال الدفع عبر بوابة الدفع",
    }

@api_router.get("/payment/v2/verify/{transaction_id}")
async def payment_verify(transaction_id: str, user: dict = Depends(require_user)):
    """Verify payment status and activate premium if paid."""
    if not PAYMENT_API_ID or not PAYMENT_API_KEY:
        raise HTTPException(503, "بوابة الدفع غير مفعّلة")
    txn = await db.payment_transactions.find_one({"id": transaction_id, "user_id": user["id"]}, {"_id": 0})
    if not txn:
        raise HTTPException(404, "المعاملة غير موجودة")
    if txn.get("payment_status") == "paid":
        return {"payment_status": "paid", "message": "تم التحقق — الاشتراك مفعّل"}
    return {"payment_status": txn.get("payment_status", "pending"), "message": "بانتظار تأكيد الدفع"}

@api_router.post("/payment/v2/activate")
async def payment_activate(body: dict, admin: dict = Depends(get_super_admin)):
    """Manually activate premium for a user (after payment verification)."""
    user_id = body.get("user_id")
    transaction_id = body.get("transaction_id")
    plan_id = body.get("plan_id", "monthly")
    if not user_id:
        raise HTTPException(400, "user_id مطلوب")
    plan = SUBSCRIPTION_PLANS.get(plan_id, SUBSCRIPTION_PLANS["monthly"])
    expires = (datetime.now(timezone.utc) + timedelta(days=plan["days"])).isoformat()
    await db.users.update_one(
        {"id": user_id},
        {"$set": {"subscription_type": "premium", "subscription_expires_at": expires}}
    )
    if transaction_id:
        await db.payment_transactions.update_one(
            {"id": transaction_id},
            {"$set": {"payment_status": "paid", "status": "complete",
                      "updated_at": datetime.now(timezone.utc).isoformat()}}
        )
    user = await db.users.find_one({"id": user_id}, {"_id": 0, "password_hash": 0})
    await log_admin_action(admin, "تفعيل اشتراك", "مستخدم",
                           user.get("username", user_id) if user else user_id,
                           f"الخطة: {plan_id}")
    return {"message": "تم تفعيل الاشتراك المميز", "expires_at": expires}

@api_router.post("/payment/v2/renew")
async def payment_renew(body: dict, admin: dict = Depends(get_super_admin)):
    """Renew or extend a user's premium subscription."""
    user_id = body.get("user_id")
    plan_id = body.get("plan_id", "monthly")
    if not user_id:
        raise HTTPException(400, "user_id مطلوب")
    plan = SUBSCRIPTION_PLANS.get(plan_id, SUBSCRIPTION_PLANS["monthly"])
    user = await db.users.find_one({"id": user_id}, {"_id": 0})
    current_exp = user.get("subscription_expires_at") if user else None
    try:
        base = datetime.fromisoformat(current_exp) if current_exp else datetime.now(timezone.utc)
        if base < datetime.now(timezone.utc):
            base = datetime.now(timezone.utc)
    except Exception:
        base = datetime.now(timezone.utc)
    new_exp = (base + timedelta(days=plan["days"])).isoformat()
    await db.users.update_one(
        {"id": user_id},
        {"$set": {"subscription_type": "premium", "subscription_expires_at": new_exp}}
    )
    await log_admin_action(admin, "تجديد اشتراك", "مستخدم",
                           user.get("username", user_id) if user else user_id,
                           f"الخطة: {plan_id} | حتى: {new_exp[:10]}")
    return {"message": "تم تجديد الاشتراك", "expires_at": new_exp}

@api_router.post("/payment/v2/failure")
async def payment_failure(body: dict):
    """Handle payment failure — update transaction status."""
    transaction_id = body.get("transaction_id")
    reason = body.get("reason", "فشل الدفع")
    if transaction_id:
        await db.payment_transactions.update_one(
            {"id": transaction_id},
            {"$set": {"payment_status": "failed", "status": "failed",
                      "failure_reason": reason,
                      "updated_at": datetime.now(timezone.utc).isoformat()}}
        )
    return {"message": "تم تسجيل فشل الدفع"}


# ══════════════════════════════════════════════════════════════════════════════
# PAYLINK PAYMENT GATEWAY  (paylink.sa)
# ══════════════════════════════════════════════════════════════════════════════

class PaylinkInitiate(BaseModel):
    plan_id: str = "monthly"
    client_name: str
    client_mobile: str
    origin_url: str  # frontend base URL for redirect

@api_router.post("/paylink/initiate")
async def paylink_initiate(body: PaylinkInitiate, user: dict = Depends(require_user)):
    """Create a Paylink invoice and return the payment URL."""
    if not PAYMENT_API_ID or not PAYMENT_API_KEY:
        raise HTTPException(503, "بوابة الدفع غير مفعّلة — تواصل مع الإدارة")

    plan = SUBSCRIPTION_PLANS.get(body.plan_id)
    if not plan:
        raise HTTPException(400, "الخطة غير موجودة")

    order_number = f"HUJJAH-{uuid.uuid4().hex[:12].upper()}"
    base_url     = body.origin_url.rstrip("/")
    callback_url = f"{base_url}/payment/success"
    cancel_url   = f"{base_url}/payment/canceled"

    try:
        result = await paylink_create_invoice(
            amount=plan["amount"],
            order_number=order_number,
            client_name=body.client_name,
            client_mobile=body.client_mobile,
            client_email=user.get("email", ""),
            callback_url=callback_url,
            cancel_url=cancel_url,
            note=f"{plan['name']} — حُجّة",
        )
    except Exception as e:
        logger.error(f"Paylink initiate error: {e}")
        raise HTTPException(502, f"خطأ في بوابة الدفع: {str(e)[:200]}")

    transaction_no = result.get("transactionNo", "")
    payment_url    = result.get("url", "")

    # Store transaction
    txn = {
        "id":             str(uuid.uuid4()),
        "transaction_no": transaction_no,
        "order_number":   order_number,
        "user_id":        user["id"],
        "email":          user.get("email", ""),
        "plan_id":        body.plan_id,
        "amount":         plan["amount"],
        "currency":       "SAR",
        "payment_status": "pending",
        "gateway":        "paylink",
        "payment_url":    payment_url,
        "created_at":     datetime.now(timezone.utc).isoformat(),
    }
    await db.payment_transactions.insert_one(txn)

    return {
        "payment_url":    payment_url,
        "transaction_no": transaction_no,
        "order_number":   order_number,
        "amount":         plan["amount"],
        "currency":       "SAR",
    }


@api_router.get("/paylink/verify/{transaction_no}")
async def paylink_verify(transaction_no: str, user: dict = Depends(require_user)):
    """Verify Paylink payment status and activate premium if paid."""
    txn = await db.payment_transactions.find_one(
        {"transaction_no": transaction_no, "user_id": user["id"]}, {"_id": 0}
    )
    if not txn:
        raise HTTPException(404, "المعاملة غير موجودة")

    # Already paid
    if txn.get("payment_status") == "paid":
        return {"order_status": "Paid", "message": "الاشتراك مفعّل"}

    try:
        data = await paylink_get_status(transaction_no)
    except Exception as e:
        logger.error(f"Paylink verify error: {e}")
        raise HTTPException(502, f"خطأ التحقق: {str(e)[:200]}")

    order_status = data.get("orderStatus", "Pending")
    now = datetime.now(timezone.utc).isoformat()

    if order_status == "Paid":
        plan     = SUBSCRIPTION_PLANS.get(txn.get("plan_id", "monthly"), SUBSCRIPTION_PLANS["monthly"])
        expires  = (datetime.now(timezone.utc) + timedelta(days=plan["days"])).isoformat()
        await db.users.update_one(
            {"id": user["id"]},
            {"$set": {"subscription_type": "premium", "subscription_expires_at": expires,
                      "notify_warning_sent": False, "notify_expired_sent": False}}
        )
        await db.payment_transactions.update_one(
            {"transaction_no": transaction_no},
            {"$set": {"payment_status": "paid", "status": "complete", "updated_at": now}}
        )

    return {"order_status": order_status, "message": "تم التحقق"}


@api_router.get("/paylink/status/{transaction_no}")
async def paylink_status_check(transaction_no: str):
    """Public status check (no auth) — called after redirect from Paylink."""
    try:
        data = await paylink_get_status(transaction_no)
        return {"order_status": data.get("orderStatus", "Pending"), "transaction_no": transaction_no}
    except Exception as e:
        return {"order_status": "Unknown", "error": str(e)[:100]}

# ══════════════════════════════════════════════════════════════════════════════
# SEED
# ══════════════════════════════════════════════════════════════════════════════

def q(cat, diff, text, answer, img="", aimg="", qtype="text"):
    return {"id": str(uuid.uuid4()), "category_id": cat, "difficulty": diff,
            "text": text, "answer": answer, "image_url": img, "answer_image_url": aimg,
            "question_type": qtype, "is_experimental": False, "created_at": datetime.now(timezone.utc).isoformat()}

PREMIUM_CATEGORIES_SEED = [
    {"id":"cat_football","name":"كرة القدم",   "icon":"⚽","image_url":"https://images.unsplash.com/photo-1574629810360-7efbbe195018?w=400&q=80","is_special":False,"is_premium":True,"color":"#064e3b","order":11,"description":"أسئلة كرة القدم العالمية"},
    {"id":"cat_anime",   "name":"أنمي",         "icon":"🎌","image_url":"https://images.unsplash.com/photo-1578632767115-351597cf2477?w=400&q=80","is_special":False,"is_premium":True,"color":"#831843","order":12,"description":"عالم الأنمي الياباني"},
    {"id":"cat_movies",  "name":"أفلام",        "icon":"🎥","image_url":"https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?w=400&q=80","is_special":False,"is_premium":True,"color":"#1e3a5f","order":13,"description":"عالم السينما والأفلام"},
    {"id":"cat_games",   "name":"ألعاب فيديو",  "icon":"🎮","image_url":"https://images.unsplash.com/photo-1542751371-adc38448a05e?w=400&q=80","is_special":False,"is_premium":True,"color":"#4c1d95","order":14,"description":"ألعاب الفيديو والـ Gaming"},
    {"id":"cat_history", "name":"تاريخ",        "icon":"📜","image_url":"https://images.unsplash.com/photo-1461360370896-922624d12aa1?w=400&q=80","is_special":False,"is_premium":True,"color":"#78350f","order":15,"description":"الأحداث التاريخية الكبرى"},
    {"id":"cat_geo",     "name":"جغرافيا",      "icon":"🌍","image_url":"https://images.unsplash.com/photo-1526778548025-fa2f459cd5c1?w=400&q=80","is_special":False,"is_premium":True,"color":"#065f46","order":16,"description":"دول وعواصم وجغرافيا"},
    {"id":"cat_tech",    "name":"تكنولوجيا",    "icon":"💻","image_url":"https://images.unsplash.com/photo-1518770660439-4636190af475?w=400&q=80","is_special":False,"is_premium":True,"color":"#1e40af","order":17,"description":"عالم التقنية والابتكار"},
    {"id":"cat_food",    "name":"مأكولات",      "icon":"🍕","image_url":"https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=400&q=80","is_special":False,"is_premium":True,"color":"#c2410c","order":18,"description":"أكلات وطبخ من حول العالم"},
    {"id":"cat_cars",    "name":"سيارات",       "icon":"🚗","image_url":"https://images.unsplash.com/photo-1503376780353-7e6692767b70?w=400&q=80","is_special":False,"is_premium":True,"color":"#374151","order":19,"description":"عالم السيارات والسباقات"},
    {"id":"cat_space",   "name":"الفضاء",       "icon":"🚀","image_url":"https://images.unsplash.com/photo-1446776811953-b23d57bd21aa?w=400&q=80","is_special":False,"is_premium":True,"color":"#0c0a2e","order":20,"description":"الكون والفضاء والنجوم"},
]

@api_router.post("/migrate-premium")
async def migrate_premium_categories(_: dict = Depends(get_super_admin)):
    """Add premium categories to existing DB without resetting data."""
    added_cats = 0
    ts = datetime.now(timezone.utc).isoformat()
    for cat in PREMIUM_CATEGORIES_SEED:
        existing = await db.categories.find_one({"id": cat["id"]})
        if not existing:
            await db.categories.insert_one({**cat, "created_at": ts})
            added_cats += 1
        else:
            # Update is_premium flag if missing
            await db.categories.update_one({"id": cat["id"]}, {"$set": {"is_premium": True}})

    # Add starter questions for premium categories
    added_q = 0
    for cat_id in [c["id"] for c in PREMIUM_CATEGORIES_SEED]:
        existing_q = await db.questions.count_documents({"category_id": cat_id})
        if existing_q == 0:
            # Will be populated when seed data includes them
            pass

    return {"message": f"تم إضافة {added_cats} فئة Premium", "added_categories": added_cats}

@api_router.post("/migrate-premium-questions")
async def migrate_premium_questions(_: bool = Depends(get_admin)):
    """Add starter questions for premium categories that have none."""
    return await _insert_premium_questions()

async def _insert_premium_questions() -> dict:
    premium_qs = _build_premium_questions()
    added = 0
    for pq in premium_qs:
        existing = await db.questions.count_documents({"category_id": pq["category_id"], "difficulty": pq["difficulty"]})
        if existing < 15:  # only add if not enough questions
            await db.questions.insert_one(pq)
            added += 1
    return {"message": f"تم إضافة {added} سؤال للفئات المدفوعة", "added": added}

def _build_premium_questions() -> list:
    qs = []
    def qq(cat, diff, text, answer):
        return {"id": str(uuid.uuid4()), "category_id": cat, "difficulty": diff, "text": text,
                "answer": answer, "image_url": "", "answer_image_url": "",
                "question_type": "text", "is_experimental": False,
                "created_at": datetime.now(timezone.utc).isoformat()}
    # كرة القدم
    qs += [
        qq("cat_football",300,"من فاز بكأس العالم 2018؟","فرنسا"),
        qq("cat_football",300,"ما عدد لاعبي الكرة في كل فريق؟","11"),
        qq("cat_football",300,"أكثر دولة فازت بكأس العالم؟","البرازيل"),
        qq("cat_football",300,"في أي مدينة يقع نادي برشلونة؟","برشلونة"),
        qq("cat_football",300,"ما لقب نادي ريال مدريد؟","الملكي"),
        qq("cat_football",600,"من فاز بكأس العالم 2022؟","الأرجنتين"),
        qq("cat_football",600,"كم مرة فازت ألمانيا بكأس العالم؟","4 مرات"),
        qq("cat_football",600,"في أي دولة تقام كأس العالم 2026؟","أمريكا"),
        qq("cat_football",600,"ما لقب ميسي في ملاعب الكرة؟","البرغوث"),
        qq("cat_football",600,"من هو هداف تاريخ دوري أبطال أوروبا؟","رونالدو البرتغالي"),
        qq("cat_football",900,"كم عدد دورات كأس العالم حتى 2022؟","22"),
        qq("cat_football",900,"من هو أصغر هداف في تاريخ كأس العالم؟","بيليه"),
        qq("cat_football",900,"في أي عام أُقيمت أول نسخة من كأس العالم؟","1930"),
        qq("cat_football",900,"ما أعلى نتيجة في تاريخ كأس العالم؟","10-1"),
        qq("cat_football",900,"كم مرة رُشّح رونالدو لجائزة الكرة الذهبية؟","5 مرات"),
    ]
    # أنمي
    qs += [
        qq("cat_anime",300,"ما اسم بطل أنمي ون بيس؟","لوفي"),
        qq("cat_anime",300,"ما اسم بطل أنمي ناروتو؟","ناروتو أوزوماكي"),
        qq("cat_anime",300,"من رسم أنمي دراغون بول؟","أكيرا تورياما"),
        qq("cat_anime",300,"في ناروتو ما اسم فريق كاكاشي؟","الفريق 7"),
        qq("cat_anime",300,"ما قوة لوفي في ون بيس؟","المطاط"),
        qq("cat_anime",600,"من أخرج فيلم رحلة شيهيرو؟","هاياو ميازاكي"),
        qq("cat_anime",600,"ما اسم شركة أنمي جيبلي؟","استوديو جيبلي"),
        qq("cat_anime",600,"من رسم هجوم العمالقة؟","هاجيمي إيساياما"),
        qq("cat_anime",600,"ما اسم البطل في هجوم العمالقة؟","إيرين ييغر"),
        qq("cat_anime",600,"ما معنى كلمة سنباي باليابانية؟","الأستاذ / الأكبر"),
        qq("cat_anime",900,"في أي عام بدأ بث أنمي ون بيس؟","1999"),
        qq("cat_anime",900,"ما أطول أنمي من حيث عدد الحلقات؟","سازاي-سان"),
        qq("cat_anime",900,"ما معنى كلمة أنمي؟","رسوم متحركة"),
        qq("cat_anime",900,"من مؤلف أنمي ناروتو؟","ماساشي كيشيموتو"),
        qq("cat_anime",900,"ما اسم قرية ناروتو؟","قرية أوراق الشجر"),
    ]
    # أفلام
    qs += [
        qq("cat_movies",300,"أكثر فيلم إيرادات في التاريخ؟","أفاتار"),
        qq("cat_movies",300,"من أخرج فيلم تيتانيك؟","جيمس كاميرون"),
        qq("cat_movies",300,"ما اسم بطل الأسد الملك؟","سيمبا"),
        qq("cat_movies",300,"في أي فيلم تظهر شخصية هيرميون؟","هاري بوتر"),
        qq("cat_movies",300,"من بطل فيلم إيرون مان؟","توني ستارك"),
        qq("cat_movies",600,"من أخرج ثلاثية سيد الخواتم؟","بيتر جاكسون"),
        qq("cat_movies",600,"ما أشهر جائزة سينمائية في العالم؟","الأوسكار"),
        qq("cat_movies",600,"كم مرة رُشّح ليوناردو للأوسكار قبل الفوز؟","5 مرات"),
        qq("cat_movies",600,"ما الشركة المنتجة لأفلام مارفل؟","مارفل ستوديوز"),
        qq("cat_movies",600,"في أي عام صدر أول فيلم Star Wars؟","1977"),
        qq("cat_movies",900,"من كتب رواية هاري بوتر؟","جيه كيه رولينغ"),
        qq("cat_movies",900,"ما الفيلم الفائز بأكثر عدد أوسكار؟","تيتانيك وبن هور وملك العودة"),
        qq("cat_movies",900,"في أي عام صدر فيلم The Dark Knight؟","2008"),
        qq("cat_movies",900,"من أخرج فيلم Inception؟","كريستوفر نولان"),
        qq("cat_movies",900,"في أي فيلم يُقال: الحياة كالشوكولاتة؟","فورست غامب"),
    ]
    # ألعاب فيديو
    qs += [
        qq("cat_games",300,"شركة صانعة PlayStation؟","سوني"),
        qq("cat_games",300,"شركة صانعة Xbox؟","مايكروسوفت"),
        qq("cat_games",300,"ما اسم الأميرة في لعبة زيلدا؟","زيلدا"),
        qq("cat_games",300,"ما أشهر لعبة ماريو؟","سوبر ماريو"),
        qq("cat_games",300,"شركة صانعة لعبة فورتنايت؟","إيبيك غيمز"),
        qq("cat_games",600,"في أي عام صدرت أول PlayStation؟","1994"),
        qq("cat_games",600,"من صمم لعبة سوبر ماريو؟","شيغيرو مياموتو"),
        qq("cat_games",600,"ما اللعبة الأكثر مبيعاً في التاريخ؟","ماينكرافت"),
        qq("cat_games",600,"ما اسم بطل لعبة The Legend of Zelda؟","لينك"),
        qq("cat_games",600,"من صنع لعبة Minecraft؟","موجانج"),
        qq("cat_games",900,"في أي عام صدر أول إصدار Call of Duty؟","2003"),
        qq("cat_games",900,"من صمم شخصية Pac-Man؟","توورو إواتاني"),
        qq("cat_games",900,"ما معنى اختصار RPG في الألعاب؟","لعبة تقمص الأدوار"),
        qq("cat_games",900,"ما أول لعبة صدرت لـ Sega؟","Altered Beast"),
        qq("cat_games",900,"ما محرك الرسوميات المستخدم في ألعاب Epic؟","Unreal Engine"),
    ]
    # تاريخ
    qs += [
        qq("cat_history",300,"من فتح القسطنطينية؟","السلطان محمد الفاتح"),
        qq("cat_history",300,"متى نزل الإنسان على القمر؟","1969"),
        qq("cat_history",300,"ما اسم أول إنسان على القمر؟","نيل أرمسترونغ"),
        qq("cat_history",300,"من بنى الأهرامات؟","الفراعنة"),
        qq("cat_history",300,"في أي سنة ولد النبي محمد عليه الصلاة والسلام؟","570 ميلادي"),
        qq("cat_history",600,"ما اسم الحضارة التي بنت ماتشو بيتشو؟","الإنكا"),
        qq("cat_history",600,"في أي عام انتهت الحرب العالمية الثانية؟","1945"),
        qq("cat_history",600,"ما اسم أول رئيس للولايات المتحدة؟","جورج واشنطن"),
        qq("cat_history",600,"في أي عام قامت الثورة الفرنسية؟","1789"),
        qq("cat_history",600,"من اكتشف أمريكا؟","كريستوفر كولومبوس"),
        qq("cat_history",900,"متى سقطت الإمبراطورية الرومانية الغربية؟","476 ميلادي"),
        qq("cat_history",900,"ما اسم المعركة التي انتصر فيها صلاح الدين 1187؟","معركة حطين"),
        qq("cat_history",900,"في أي عام ألقيت القنبلة الذرية على هيروشيما؟","1945"),
        qq("cat_history",900,"ما اسم الأسرة التي بنت أكبر الأهرام؟","الأسرة الرابعة"),
        qq("cat_history",900,"كم استمرت الحرب العالمية الأولى؟","4 سنوات"),
    ]
    # جغرافيا
    qs += [
        qq("cat_geo",300,"ما أكبر قارة في العالم؟","آسيا"),
        qq("cat_geo",300,"ما أعلى جبل في العالم؟","إيفرست"),
        qq("cat_geo",300,"كم دولة في العالم؟","195"),
        qq("cat_geo",300,"ما عاصمة الصين؟","بكين"),
        qq("cat_geo",300,"ما أطول نهر في العالم؟","النيل"),
        qq("cat_geo",600,"ما أصغر دولة في العالم؟","الفاتيكان"),
        qq("cat_geo",600,"ما أكبر صحراء في العالم؟","الصحراء الكبرى"),
        qq("cat_geo",600,"ما عاصمة كندا؟","أوتاوا"),
        qq("cat_geo",600,"ما أعمق بحيرة في العالم؟","بايكال"),
        qq("cat_geo",600,"ما أكبر محيط في العالم؟","المحيط الهادئ"),
        qq("cat_geo",900,"ما أصغر قارة في العالم؟","أستراليا"),
        qq("cat_geo",900,"ما أطول سلسلة جبلية في العالم؟","جبال الأنديز"),
        qq("cat_geo",900,"ما اسم أكبر جزيرة في العالم؟","غرينلاند"),
        qq("cat_geo",900,"كم يبلغ محيط الأرض؟","40075 كيلومتر"),
        qq("cat_geo",900,"ما اسم أعلى بركان في العالم؟","أوخوس ديل سالادو"),
    ]
    # تكنولوجيا
    qs += [
        qq("cat_tech",300,"من أسس شركة أبل؟","ستيف جوبز"),
        qq("cat_tech",300,"ما نظام تشغيل الأيفون؟","iOS"),
        qq("cat_tech",300,"ما تطبيق التواصل الذي أسسه زوكربيرغ؟","فيسبوك"),
        qq("cat_tech",300,"ما محرك بحث غوغل؟","Google Search"),
        qq("cat_tech",300,"ما معنى اختصار AI؟","ذكاء اصطناعي"),
        qq("cat_tech",600,"من أسس شركة تيسلا؟","إيلون ماسك"),
        qq("cat_tech",600,"من اخترع الإنترنت؟","تيم برنرز لي"),
        qq("cat_tech",600,"ما معنى CPU؟","وحدة المعالجة المركزية"),
        qq("cat_tech",600,"ما أول نظام Windows؟","Windows 1.0"),
        qq("cat_tech",600,"ما تطبيق التواصل الذي يملكه إيلون ماسك؟","X / تويتر"),
        qq("cat_tech",900,"من اخترع الحاسوب؟","تشارلز بابيج"),
        qq("cat_tech",900,"ما أول لغة برمجة في التاريخ؟","فورتران"),
        qq("cat_tech",900,"ما معنى HTML؟","لغة ترميز النص التشعبي"),
        qq("cat_tech",900,"في أي عام أُطلقت أول نسخة Windows؟","1985"),
        qq("cat_tech",900,"ما معنى RAM؟","ذاكرة الوصول العشوائي"),
    ]
    # مأكولات
    qs += [
        qq("cat_food",300,"ما أشهر أكلة سعودية؟","الكبسة"),
        qq("cat_food",300,"من أي دولة جاءت البيتزا؟","إيطاليا"),
        qq("cat_food",300,"من أي دولة جاءت السوشي؟","اليابان"),
        qq("cat_food",300,"ما الفاكهة الأكثر ماءً؟","البطيخ"),
        qq("cat_food",300,"ما أشهر حلوى عربية؟","الكنافة"),
        qq("cat_food",600,"ما مكوّن البرغر الأساسي؟","لحم البقر"),
        qq("cat_food",600,"أي شوكولاتة تحتوي على أعلى نسبة كاكاو؟","الداكنة"),
        qq("cat_food",600,"ما المكوّن الأساسي في الغوكامولي؟","الأفوكادو"),
        qq("cat_food",600,"في أي دولة اخترعت الكرواسون؟","النمسا"),
        qq("cat_food",600,"ما أغلى بهار في العالم؟","الزعفران"),
        qq("cat_food",900,"ما المكوّنات الرئيسية في صلصة البستو؟","ريحان وزيت زيتون وصنوبر"),
        qq("cat_food",900,"ما الغذاء الأكثر استهلاكاً في العالم؟","الأرز"),
        qq("cat_food",900,"ما الفيتامين الأكثر في البرتقال؟","فيتامين C"),
        qq("cat_food",900,"ما أصل أكلة الشاورما؟","الإمبراطورية العثمانية"),
        qq("cat_food",900,"ما الحبوب التي يُصنع منها الخبز؟","القمح"),
    ]
    # سيارات
    qs += [
        qq("cat_cars",300,"ما أشهر شركة سيارات يابانية؟","تويوتا"),
        qq("cat_cars",300,"من أسس شركة فورد؟","هنري فورد"),
        qq("cat_cars",300,"ما وقود السيارات الكهربائية؟","الكهرباء"),
        qq("cat_cars",300,"ما أسرع سيارة في العالم تقريباً؟","بوغاتي شيرون"),
        qq("cat_cars",300,"في أي دولة تصنع رولز رويس؟","بريطانيا"),
        qq("cat_cars",600,"من اخترع السيارة؟","كارل بنز"),
        qq("cat_cars",600,"ما معنى اختصار BMW؟","مصانع محركات بافاريا"),
        qq("cat_cars",600,"ما الشركة التي تصنع بورشه؟","بورشه AG"),
        qq("cat_cars",600,"متى اخترعت أول سيارة بمحرك بنزين؟","1885"),
        qq("cat_cars",600,"ما الدولة الأكثر إنتاجاً للسيارات؟","الصين"),
        qq("cat_cars",900,"ما معنى ABS في السيارات؟","نظام الفرامل المانع للانسداد"),
        qq("cat_cars",900,"ما اسم أول سيارة كهربائية شعبية؟","تيسلا رودستر"),
        qq("cat_cars",900,"كم حصان تملك بوغاتي فيرون؟","1001 حصان"),
        qq("cat_cars",900,"في أي عام أُنشئت شركة فيراري؟","1939"),
        qq("cat_cars",900,"ما أغلى سيارة في التاريخ؟","بوغاتي لا فويتير نوار"),
    ]
    # الفضاء
    qs += [
        qq("cat_space",300,"ما أقرب نجم للأرض؟","الشمس"),
        qq("cat_space",300,"كم كوكب في المجموعة الشمسية؟","8"),
        qq("cat_space",300,"ما أكبر كوكب في المجموعة الشمسية؟","المشتري"),
        qq("cat_space",300,"ما اسم أول إنسان في الفضاء؟","يوري غاغارين"),
        qq("cat_space",300,"ما اسم الكوكب الأحمر؟","المريخ"),
        qq("cat_space",600,"كم يبعد القمر عن الأرض؟","384 ألف كيلومتر"),
        qq("cat_space",600,"ما اسم التلسكوب الفضائي الشهير؟","هابل"),
        qq("cat_space",600,"كم يستغرق ضوء الشمس للوصول للأرض؟","8 دقائق"),
        qq("cat_space",600,"ما اسم مجرتنا؟","درب التبانة"),
        qq("cat_space",600,"ما أبعد كوكب في المجموعة الشمسية؟","نبتون"),
        qq("cat_space",900,"ما اسم أكبر ثقب أسود مكتشف؟","TON 618"),
        qq("cat_space",900,"كم يبعد أقرب نجم بعد الشمس؟","4.2 سنة ضوئية"),
        qq("cat_space",900,"ما الكوكب الذي يدور بشكل عكسي؟","الزهرة"),
        qq("cat_space",900,"ما اسم مهمة أول إنسان على القمر؟","أبولو 11"),
        qq("cat_space",900,"كم عدد النجوم في درب التبانة؟","200 إلى 400 مليار نجم"),
    ]
    return qs

@api_router.post("/seed")
async def seed_data(_: dict = Depends(get_super_admin)):
    """Seed ONLY adds new default categories/questions. NEVER deletes or overwrites existing data."""
    existing_cats = await db.categories.count_documents({})
    existing_qs   = await db.questions.count_documents({})
    # Safety: absolutely never delete existing user data

    categories = [
        {"id":"cat_flags",   "name":"اعلام دول",      "icon":"🏳️","image_url":"https://static.prod-images.emergentagent.com/jobs/2e2396b6-cc98-44c9-bfbe-97e0e9727ada/images/789e9577be35fbf27c01b939a7864cd14c4aa947ecdd1dffb985e8cf92803c56.png","is_special":False,"is_premium":False,"color":"#166534","order":1,"description":"خمّن علم الدولة!","created_at":datetime.now(timezone.utc).isoformat()},
        {"id":"cat_easy",    "name":"معلومات عامة",   "icon":"💡","image_url":"https://static.prod-images.emergentagent.com/jobs/2e2396b6-cc98-44c9-bfbe-97e0e9727ada/images/ef7d4ad149135fb20af44b7c285da0442405131faae6b590a9e3b88bad9deec3.png","is_special":False,"is_premium":False,"color":"#1e40af","order":2,"description":"معلومات للجميع","created_at":datetime.now(timezone.utc).isoformat()},
        {"id":"cat_saudi",   "name":"السعودية",       "icon":"🇸🇦","image_url":"https://images.unsplash.com/photo-1722966885396-1f3dcebdf27f?crop=entropy&cs=srgb&fm=jpg&q=85","is_special":False,"is_premium":False,"color":"#5B0E14","order":3,"description":"أسئلة عن المملكة","created_at":datetime.now(timezone.utc).isoformat()},
        {"id":"cat_islamic", "name":"اسلامي",         "icon":"☪️","image_url":"https://static.prod-images.emergentagent.com/jobs/2e2396b6-cc98-44c9-bfbe-97e0e9727ada/images/415591654801e274c08fe69190400fa76fc011cbd93e02bdcb51ad4d6c838d24.png","is_special":False,"is_premium":False,"color":"#065f46","order":4,"description":"أسئلة إسلامية","created_at":datetime.now(timezone.utc).isoformat()},
        {"id":"cat_science", "name":"علوم",           "icon":"🔬","image_url":"https://static.prod-images.emergentagent.com/jobs/2e2396b6-cc98-44c9-bfbe-97e0e9727ada/images/5a646d99acb87f702e9b9e1b526e57a3aa5e72ea83e1383922de853c3217fcd2.png","is_special":False,"is_premium":False,"color":"#4c1d95","order":5,"description":"علوم للجميع","created_at":datetime.now(timezone.utc).isoformat()},
        {"id":"cat_logos",   "name":"شعارات",         "icon":"🏷️","image_url":"https://static.prod-images.emergentagent.com/jobs/2e2396b6-cc98-44c9-bfbe-97e0e9727ada/images/f24c5c166f24d1b9a42f735e4068ea1e7314629e35b6ae5f9004b239034385b2.png","is_special":False,"is_premium":False,"color":"#7c2d12","order":6,"description":"خمّن الشعار!","created_at":datetime.now(timezone.utc).isoformat()},
        {"id":"cat_word",    "name":"ولا كلمة",       "icon":"🤫","image_url":"https://static.prod-images.emergentagent.com/jobs/2e2396b6-cc98-44c9-bfbe-97e0e9727ada/images/4dbb8986ed1f7fd1808e2cfe86c647cce9b6418d187c7dc40e0c927a3ca63ba3.png","is_special":True, "is_premium":False,"color":"#4a044e","order":7,"description":"وصّف بدون ما تقول الكلمة!","created_at":datetime.now(timezone.utc).isoformat()},
        {"id":"cat_culture", "name":"ثقافة شعبية",    "icon":"🎬","image_url":"https://images.unsplash.com/photo-1771909752746-8fd6c4ca6686?crop=entropy&cs=srgb&fm=jpg&q=85","is_special":False,"is_premium":False,"color":"#831843","order":8,"description":"مسلسلات وأفلام وبرامج","created_at":datetime.now(timezone.utc).isoformat()},
        {"id":"cat_sports",  "name":"رياضة",          "icon":"⚽","image_url":"https://static.prod-images.emergentagent.com/jobs/2e2396b6-cc98-44c9-bfbe-97e0e9727ada/images/e51328694c4b4c81a6ee96efd6195f7efcb47bf810bc16433b131fcc4650d516.png","is_special":False,"is_premium":False,"color":"#134e4a","order":9,"description":"كرة وبطولات","created_at":datetime.now(timezone.utc).isoformat()},
        {"id":"cat_music",   "name":"موسيقى وفن",     "icon":"🎵","image_url":"https://static.prod-images.emergentagent.com/jobs/2e2396b6-cc98-44c9-bfbe-97e0e9727ada/images/06e0f32385eaf6b70c73ad579e42d9057de72575eed0ac8ee6e226bd5d36eb97.png","is_special":False,"is_premium":False,"color":"#1e3a5f","order":10,"description":"أغاني وفنانين","created_at":datetime.now(timezone.utc).isoformat()},
        # ── Premium Categories ────────────────────────────────────────────────
        {"id":"cat_football","name":"كرة القدم",       "icon":"⚽","image_url":"https://images.unsplash.com/photo-1574629810360-7efbbe195018?w=400&q=80","is_special":False,"is_premium":True,"color":"#064e3b","order":11,"description":"أسئلة كرة القدم العالمية","created_at":datetime.now(timezone.utc).isoformat()},
        {"id":"cat_anime",   "name":"أنمي",            "icon":"🎌","image_url":"https://images.unsplash.com/photo-1578632767115-351597cf2477?w=400&q=80","is_special":False,"is_premium":True,"color":"#831843","order":12,"description":"عالم الأنمي الياباني","created_at":datetime.now(timezone.utc).isoformat()},
        {"id":"cat_movies",  "name":"أفلام",           "icon":"🎥","image_url":"https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?w=400&q=80","is_special":False,"is_premium":True,"color":"#1e3a5f","order":13,"description":"عالم السينما والأفلام","created_at":datetime.now(timezone.utc).isoformat()},
        {"id":"cat_games",   "name":"ألعاب فيديو",     "icon":"🎮","image_url":"https://images.unsplash.com/photo-1542751371-adc38448a05e?w=400&q=80","is_special":False,"is_premium":True,"color":"#4c1d95","order":14,"description":"ألعاب الفيديو والـ Gaming","created_at":datetime.now(timezone.utc).isoformat()},
        {"id":"cat_history", "name":"تاريخ",           "icon":"📜","image_url":"https://images.unsplash.com/photo-1461360370896-922624d12aa1?w=400&q=80","is_special":False,"is_premium":True,"color":"#78350f","order":15,"description":"الأحداث التاريخية الكبرى","created_at":datetime.now(timezone.utc).isoformat()},
        {"id":"cat_geo",     "name":"جغرافيا",         "icon":"🌍","image_url":"https://images.unsplash.com/photo-1526778548025-fa2f459cd5c1?w=400&q=80","is_special":False,"is_premium":True,"color":"#065f46","order":16,"description":"دول وعواصم وجغرافيا","created_at":datetime.now(timezone.utc).isoformat()},
        {"id":"cat_tech",    "name":"تكنولوجيا",       "icon":"💻","image_url":"https://images.unsplash.com/photo-1518770660439-4636190af475?w=400&q=80","is_special":False,"is_premium":True,"color":"#1e40af","order":17,"description":"عالم التقنية والابتكار","created_at":datetime.now(timezone.utc).isoformat()},
        {"id":"cat_food",    "name":"مأكولات",         "icon":"🍕","image_url":"https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=400&q=80","is_special":False,"is_premium":True,"color":"#c2410c","order":18,"description":"أكلات وطبخ من حول العالم","created_at":datetime.now(timezone.utc).isoformat()},
        {"id":"cat_cars",    "name":"سيارات",          "icon":"🚗","image_url":"https://images.unsplash.com/photo-1503376780353-7e6692767b70?w=400&q=80","is_special":False,"is_premium":True,"color":"#374151","order":19,"description":"عالم السيارات والسباقات","created_at":datetime.now(timezone.utc).isoformat()},
        {"id":"cat_space",   "name":"الفضاء",          "icon":"🚀","image_url":"https://images.unsplash.com/photo-1446776811953-b23d57bd21aa?w=400&q=80","is_special":False,"is_premium":True,"color":"#0c0a2e","order":20,"description":"الكون والفضاء والنجوم","created_at":datetime.now(timezone.utc).isoformat()},
    ]
    # SAFE INSERT: only add categories that don't exist yet (by id)
    existing_cat_ids = {c["id"] async for c in db.categories.find({}, {"_id": 0, "id": 1})}
    new_cats = [c for c in categories if c["id"] not in existing_cat_ids]
    if new_cats:
        await db.categories.insert_many(new_cats)
    added_cats = len(new_cats)

    questions = [
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

        # ── كرة القدم (Premium) ───────────────────────────────────────────────
        q("cat_football",300,"من فاز بكأس العالم 2018؟","فرنسا"),
        q("cat_football",300,"ما عدد لاعبي الكرة في كل فريق؟","11"),
        q("cat_football",300,"أكثر دولة فازت بكأس العالم؟","البرازيل"),
        q("cat_football",300,"في أي مدينة يقع نادي برشلونة؟","برشلونة"),
        q("cat_football",300,"ما لقب نادي ريال مدريد؟","الملكي"),
        q("cat_football",600,"من فاز بكأس العالم 2022؟","الأرجنتين"),
        q("cat_football",600,"كم مرة فازت ألمانيا بكأس العالم؟","4 مرات"),
        q("cat_football",600,"في أي دولة تقام كأس العالم 2026؟","أمريكا"),
        q("cat_football",600,"ما لقب ميسي في ملاعب الكرة؟","البرغوث / العبقري"),
        q("cat_football",600,"من هو هداف تاريخ دوري أبطال أوروبا؟","رونالدو البرتغالي"),
        q("cat_football",900,"كم عدد دورات كأس العالم حتى 2022؟","22"),
        q("cat_football",900,"من هو أصغر هداف في تاريخ كأس العالم؟","بيليه"),
        q("cat_football",900,"في أي عام أُقيمت أول نسخة من كأس العالم؟","1930"),
        q("cat_football",900,"ما أعلى نتيجة في تاريخ كأس العالم؟","10-1"),
        q("cat_football",900,"كم مرة رُشّح رونالدو لجائزة الكرة الذهبية؟","5 مرات"),

        # ── أنمي (Premium) ───────────────────────────────────────────────────
        q("cat_anime",300,"ما اسم بطل أنمي ون بيس؟","لوفي"),
        q("cat_anime",300,"ما اسم بطل أنمي ناروتو؟","ناروتو أوزوماكي"),
        q("cat_anime",300,"من رسم أنمي دراغون بول؟","أكيرا تورياما"),
        q("cat_anime",300,"في ناروتو، ما اسم فريق كاكاشي؟","الفريق 7"),
        q("cat_anime",300,"ما قوة لوفي في ون بيس؟","جوما جوما (المطاط)"),
        q("cat_anime",600,"من أخرج فيلم رحلة شيهيرو؟","هاياو ميازاكي"),
        q("cat_anime",600,"ما اسم الشركة المنتجة لأفلام جيبلي؟","استوديو جيبلي"),
        q("cat_anime",600,"من رسم هجوم العمالقة؟","هاجيمي إيساياما"),
        q("cat_anime",600,"ما اسم البطل في أنمي هجوم العمالقة؟","إيرين ييغر"),
        q("cat_anime",600,"ما معنى كلمة سنباي باليابانية؟","الزميل الأكبر / الأستاذ"),
        q("cat_anime",900,"في أي عام بدأ بث أنمي ون بيس؟","1999"),
        q("cat_anime",900,"ما أطول أنمي من حيث عدد الحلقات؟","سازاي-سان"),
        q("cat_anime",900,"ما معنى كلمة أنمي باليابانية؟","رسوم متحركة"),
        q("cat_anime",900,"من مؤلف أنمي نارتو؟","ماساشي كيشيموتو"),
        q("cat_anime",900,"ما اسم القرية في ناروتو التي نشأ فيها؟","قرية أوراق الشجر"),

        # ── أفلام (Premium) ──────────────────────────────────────────────────
        q("cat_movies",300,"أكثر فيلم إيرادات في التاريخ؟","أفاتار"),
        q("cat_movies",300,"من أخرج فيلم تيتانيك؟","جيمس كاميرون"),
        q("cat_movies",300,"ما اسم بطل فيلم الأسد الملك؟","سيمبا"),
        q("cat_movies",300,"في أي فيلم تظهر شخصية هيرميون؟","هاري بوتر"),
        q("cat_movies",300,"من بطل فيلم إيرون مان؟","توني ستارك"),
        q("cat_movies",600,"من أخرج ثلاثية سيد الخواتم؟","بيتر جاكسون"),
        q("cat_movies",600,"ما الجائزة السينمائية الأشهر في العالم؟","الأوسكار"),
        q("cat_movies",600,"كم مرة رُشّح ليوناردو ديكابريو للأوسكار قبل أن يفوز؟","5 مرات"),
        q("cat_movies",600,"ما اسم الشركة المنتجة لأفلام مارفل؟","مارفل ستوديوز"),
        q("cat_movies",600,"في أي عام صدر أول فيلم Star Wars؟","1977"),
        q("cat_movies",900,"من كتب رواية هاري بوتر؟","جيه كيه رولينغ"),
        q("cat_movies",900,"ما الفيلم الذي فاز بأكثر عدد أوسكار في التاريخ؟","تيتانيك / بن هور / ملك العودة (11 أوسكار)"),
        q("cat_movies",900,"في أي عام صدر فيلم The Dark Knight؟","2008"),
        q("cat_movies",900,"من أخرج فيلم Inception؟","كريستوفر نولان"),
        q("cat_movies",900,"ما الفيلم الذي يقول فيه توم هانكس: الحياة كالشوكولاتة؟","فورست غامب"),

        # ── ألعاب فيديو (Premium) ─────────────────────────────────────────────
        q("cat_games",300,"شركة صانعة PlayStation؟","سوني"),
        q("cat_games",300,"شركة صانعة Xbox؟","مايكروسوفت"),
        q("cat_games",300,"ما اسم الأميرة في لعبة زيلدا؟","زيلدا"),
        q("cat_games",300,"ما أشهر لعبة ماريو؟","سوبر ماريو"),
        q("cat_games",300,"شركة صانعة لعبة فورتنايت؟","إيبيك غيمز"),
        q("cat_games",600,"في أي عام صدرت أول PlayStation؟","1994"),
        q("cat_games",600,"من صمم لعبة سوبر ماريو؟","شيغيرو مياموتو"),
        q("cat_games",600,"ما اللعبة الأكثر مبيعاً في التاريخ؟","ماينكرافت"),
        q("cat_games",600,"ما اسم بطل لعبة The Legend of Zelda؟","لينك"),
        q("cat_games",600,"ما الفريق الذي ابتكر لعبة Minecraft؟","موجانج"),
        q("cat_games",900,"في أي عام صدر أول إصدار من Call of Duty؟","2003"),
        q("cat_games",900,"من صمم شخصية Pac-Man؟","توورو إواتاني"),
        q("cat_games",900,"ما اسم محرك الرسوميات في لعبة Unreal Engine 5؟","Unreal Engine 5"),
        q("cat_games",900,"ما أول لعبة صدرت لنظام Sega Mega Drive؟","Altered Beast"),
        q("cat_games",900,"ما معنى اختصار RPG في الألعاب؟","لعبة تقمص الأدوار"),

        # ── تاريخ (Premium) ──────────────────────────────────────────────────
        q("cat_history",300,"من فتح القسطنطينية؟","السلطان محمد الفاتح"),
        q("cat_history",300,"متى نزل الإنسان على القمر؟","1969"),
        q("cat_history",300,"ما اسم أول إنسان على القمر؟","نيل أرمسترونغ"),
        q("cat_history",300,"من بنى الأهرامات؟","الفراعنة"),
        q("cat_history",300,"في أي سنة ولد الرسول محمد عليه الصلاة والسلام؟","570 ميلادي"),
        q("cat_history",600,"ما اسم الحضارة التي بنت ماتشو بيتشو؟","الإنكا"),
        q("cat_history",600,"في أي عام انتهت الحرب العالمية الثانية؟","1945"),
        q("cat_history",600,"ما اسم أول رئيس للولايات المتحدة؟","جورج واشنطن"),
        q("cat_history",600,"في أي عام قامت الثورة الفرنسية؟","1789"),
        q("cat_history",600,"من اكتشف أمريكا؟","كريستوفر كولومبوس"),
        q("cat_history",900,"متى سقطت الإمبراطورية الرومانية الغربية؟","476 ميلادي"),
        q("cat_history",900,"ما اسم المعركة التي انتصر فيها صلاح الدين 1187؟","معركة حطين"),
        q("cat_history",900,"في أي عام ألقيت القنبلة الذرية على هيروشيما؟","1945"),
        q("cat_history",900,"ما اسم الأسرة التي بنت الأهرام الأكبر؟","الأسرة الرابعة"),
        q("cat_history",900,"كم استمرت الحرب العالمية الأولى؟","4 سنوات"),

        # ── جغرافيا (Premium) ────────────────────────────────────────────────
        q("cat_geo",300,"ما أكبر قارة في العالم؟","آسيا"),
        q("cat_geo",300,"ما أعلى جبل في العالم؟","إيفرست"),
        q("cat_geo",300,"كم دولة في العالم تقريباً؟","195"),
        q("cat_geo",300,"ما عاصمة الصين؟","بكين"),
        q("cat_geo",300,"ما أطول نهر في العالم؟","النيل"),
        q("cat_geo",600,"ما أصغر دولة في العالم؟","الفاتيكان"),
        q("cat_geo",600,"ما أكبر صحراء في العالم؟","الصحراء الكبرى"),
        q("cat_geo",600,"ما عاصمة كندا؟","أوتاوا"),
        q("cat_geo",600,"ما أعمق بحيرة في العالم؟","بايكال"),
        q("cat_geo",600,"ما أكبر محيط في العالم؟","المحيط الهادئ"),
        q("cat_geo",900,"ما أصغر قارة في العالم؟","أستراليا / أوقيانوسيا"),
        q("cat_geo",900,"ما أطول سلسلة جبلية في العالم؟","جبال الأنديز"),
        q("cat_geo",900,"ما اسم أكبر جزيرة في العالم؟","غرينلاند"),
        q("cat_geo",900,"كم كيلومتر يبلغ محيط الأرض؟","40,075 كيلومتر"),
        q("cat_geo",900,"ما اسم أعلى بركان في العالم؟","أوخوس ديل سالادو"),

        # ── تكنولوجيا (Premium) ──────────────────────────────────────────────
        q("cat_tech",300,"من أسس شركة أبل؟","ستيف جوبز"),
        q("cat_tech",300,"ما نظام تشغيل الأيفون؟","iOS"),
        q("cat_tech",300,"ما تطبيق التواصل الذي أسسه مارك زوكربيرغ؟","فيسبوك"),
        q("cat_tech",300,"ما اسم محرك بحث غوغل؟","Google Search"),
        q("cat_tech",300,"ما معنى اختصار AI؟","ذكاء اصطناعي"),
        q("cat_tech",600,"من أسس شركة تيسلا للسيارات الكهربائية؟","إيلون ماسك"),
        q("cat_tech",600,"من اخترع الإنترنت؟","تيم برنرز لي"),
        q("cat_tech",600,"ما معنى CPU؟","وحدة المعالجة المركزية"),
        q("cat_tech",600,"ما أول نظام تشغيل Windows إصداراً؟","Windows 1.0"),
        q("cat_tech",600,"ما تطبيق التواصل الذي يملكه إيلون ماسك؟","X / تويتر"),
        q("cat_tech",900,"من اخترع الحاسوب؟","تشارلز بابيج"),
        q("cat_tech",900,"ما أول لغة برمجة في التاريخ؟","فورتران"),
        q("cat_tech",900,"ما معنى اختصار HTML؟","لغة ترميز النص التشعبي"),
        q("cat_tech",900,"في أي عام أُطلقت أول نسخة من Windows؟","1985"),
        q("cat_tech",900,"ما معنى اختصار RAM؟","ذاكرة الوصول العشوائي"),

        # ── مأكولات (Premium) ────────────────────────────────────────────────
        q("cat_food",300,"ما أشهر أكلة سعودية؟","الكبسة"),
        q("cat_food",300,"من أي دولة جاءت البيتزا؟","إيطاليا"),
        q("cat_food",300,"من أي دولة جاءت السوشي؟","اليابان"),
        q("cat_food",300,"ما الفاكهة التي تحتوي على أكثر كميات الماء؟","البطيخ"),
        q("cat_food",300,"ما أشهر حلوى عربية؟","الكنافة"),
        q("cat_food",600,"ما مكوّن البرغر الأساسي؟","لحم البقر"),
        q("cat_food",600,"ما الشوكولاتة التي تحتوي على أعلى نسبة كاكاو؟","الداكنة"),
        q("cat_food",600,"ما المكوّن الأساسي في الغوكامولي؟","الأفوكادو"),
        q("cat_food",600,"في أي دولة اخترعت أكلة الكروسان؟","النمسا"),
        q("cat_food",600,"ما أغلى بهار في العالم؟","الزعفران"),
        q("cat_food",900,"ما المكوّنات الرئيسية في صلصة البستو؟","ريحان وزيت زيتون وصنوبر"),
        q("cat_food",900,"ما الغذاء الأكثر استهلاكاً في العالم؟","الأرز"),
        q("cat_food",900,"ما الفيتامين الموجود بكثرة في البرتقال؟","فيتامين C"),
        q("cat_food",900,"ما أصل أكلة الشاورما؟","الإمبراطورية العثمانية"),
        q("cat_food",900,"ما الحبوب التي يصنع منها الخبز؟","القمح"),

        # ── سيارات (Premium) ─────────────────────────────────────────────────
        q("cat_cars",300,"ما أشهر شركة سيارات يابانية؟","تويوتا"),
        q("cat_cars",300,"من أسس شركة فورد؟","هنري فورد"),
        q("cat_cars",300,"ما وقود السيارات الكهربائية؟","الكهرباء"),
        q("cat_cars",300,"من صنّع سيارة رولز رويس؟","بريطانيا"),
        q("cat_cars",300,"ما أسرع سيارة في العالم تقريباً؟","بوغاتي شيرون"),
        q("cat_cars",600,"من اخترع السيارة؟","كارل بنز"),
        q("cat_cars",600,"ما معنى اختصار BMW؟","مصانع محركات بافاريا"),
        q("cat_cars",600,"ما الشركة التي تصنع بورشه؟","بورشه AG"),
        q("cat_cars",600,"متى اخترعت أول سيارة بمحرك بنزين؟","1885"),
        q("cat_cars",600,"ما الدولة الأكثر إنتاجاً للسيارات؟","الصين"),
        q("cat_cars",900,"ما معنى اختصار ABS في السيارات؟","نظام الفرامل المانع للانسداد"),
        q("cat_cars",900,"ما اسم أول سيارة كهربائية شعبية؟","تيسلا رودستر"),
        q("cat_cars",900,"كم حصان تملك بوغاتي فيرون؟","1001 حصان"),
        q("cat_cars",900,"ما اسم أغلى سيارة في التاريخ؟","بوغاتي لا فويتور نوار"),
        q("cat_cars",900,"في أي عام أُنشئت شركة فيراري؟","1939"),

        # ── الفضاء (Premium) ─────────────────────────────────────────────────
        q("cat_space",300,"ما أقرب نجم للأرض؟","الشمس"),
        q("cat_space",300,"كم كوكب في المجموعة الشمسية؟","8"),
        q("cat_space",300,"ما أكبر كوكب في المجموعة الشمسية؟","المشتري"),
        q("cat_space",300,"ما اسم أول إنسان في الفضاء؟","يوري غاغارين"),
        q("cat_space",300,"ما اسم الكوكب الأحمر؟","المريخ"),
        q("cat_space",600,"كم يبعد القمر عن الأرض تقريباً؟","384,000 كيلومتر"),
        q("cat_space",600,"ما اسم التلسكوب الفضائي الشهير؟","هابل"),
        q("cat_space",600,"كم يستغرق الضوء للوصول من الشمس للأرض؟","8 دقائق"),
        q("cat_space",600,"ما اسم مجرتنا؟","درب التبانة"),
        q("cat_space",600,"ما أبعد كوكب في المجموعة الشمسية؟","نبتون"),
        q("cat_space",900,"ما اسم أكبر ثقب أسود مكتشف حتى الآن؟","TON 618"),
        q("cat_space",900,"كم يبعد أقرب نجم بعد الشمس؟","4.2 سنة ضوئية"),
        q("cat_space",900,"ما الكوكب الذي يدور بشكل عكسي؟","الزهرة"),
        q("cat_space",900,"كم عدد النجوم في مجرة درب التبانة تقريباً؟","200-400 مليار نجم"),
        q("cat_space",900,"ما اسم المهمة الفضائية التي أوصلت أول إنسان للقمر؟","أبولو 11"),
    ]

    # SAFE INSERT: only add seed questions that don't already exist (by text+category_id)
    existing_texts = set()
    async for eq in db.questions.find({}, {"_id": 0, "text": 1, "category_id": 1}):
        existing_texts.add((eq.get("category_id",""), eq.get("text","").strip()))
    new_questions = [qu for qu in questions if (qu.get("category_id",""), qu.get("text","").strip()) not in existing_texts]
    if new_questions:
        await db.questions.insert_many(new_questions)
    added_qs = len(new_questions)
    total_c = len(new_cats)
    return {
        "message": f"تمت إضافة {total_c} فئة جديدة و {added_qs} سؤال جديد (لم يُحذف شيء)",
        "categories_added": total_c,
        "questions_added": added_qs,
        "categories_skipped": len(categories) - total_c,
        "questions_skipped": len(questions) - added_qs,
    }


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
async def update_settings(body: dict, admin: dict = Depends(get_admin)):
    body.pop("_id", None)
    body.pop("key", None)
    await db.settings.update_one(
        {"key": "game_settings"},
        {"$set": {**body, "key": "game_settings"}},
        upsert=True
    )
    updated = await db.settings.find_one({"key": "game_settings"}, {"_id": 0})
    await log_admin_action(admin, "تعديل", "إعدادات", "إعدادات اللعبة")
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
# AI ENGINE  (Claude primary · Gemini fallback · file-aware)
# ══════════════════════════════════════════════════════════════════════════════

async def _claude_generate(prompt: str) -> str:
    """Generate text with Claude claude-sonnet-4-5-20250929 via emergentintegrations."""
    api_key = os.environ.get("CLAUDE_API_KEY", "")
    if not api_key:
        raise ValueError("CLAUDE_API_KEY not set")
    from emergentintegrations.llm.chat import LlmChat, UserMessage
    chat = LlmChat(
        api_key=api_key,
        session_id=f"hujjah-{uuid.uuid4().hex[:8]}",
        system_message="أنت مساعد ذكي متخصص في توليد أسئلة الترفيه العربية."
    ).with_model("anthropic", "claude-sonnet-4-5-20250929")
    resp = await chat.send_message(UserMessage(text=prompt))
    return resp if isinstance(resp, str) else str(resp)


async def _gemini_generate(prompt: str) -> str:
    """Generate text with Gemini 2.5 Flash via direct REST."""
    api_key = os.environ.get("GEMINI_API_KEY", "")
    if not api_key:
        raise HTTPException(500, "GEMINI_API_KEY غير مضبوط في ملف البيئة")
    url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key={api_key}"
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


async def _ai_generate(prompt: str, prefer: str = "claude") -> str:
    """Try Claude first, fall back to Gemini if unavailable."""
    if prefer == "claude" and os.environ.get("CLAUDE_API_KEY"):
        try:
            return await _claude_generate(prompt)
        except Exception as ce:
            logger.warning(f"Claude failed, falling back to Gemini: {ce}")
    return await _gemini_generate(prompt)


async def _gemini_analyze_file(file_path: str, mime_type: str, prompt: str) -> str:
    """Use Gemini with file attachment (supports PDF, images, etc.)."""
    api_key = os.environ.get("GEMINI_API_KEY", "")
    if not api_key:
        raise HTTPException(500, "GEMINI_API_KEY غير مضبوط")
    from emergentintegrations.llm.chat import LlmChat, UserMessage, FileContentWithMimeType
    chat = LlmChat(
        api_key=api_key,
        session_id=f"hujjah-file-{uuid.uuid4().hex[:8]}",
        system_message="أنت مساعد ذكي لتحليل الملفات واستخراج الأسئلة."
    ).with_model("gemini", "gemini-2.5-flash")
    file_obj = FileContentWithMimeType(file_path=file_path, mime_type=mime_type)
    msg = UserMessage(text=prompt, file_contents=[file_obj])
    resp = await chat.send_message(msg)
    return resp if isinstance(resp, str) else str(resp)


async def _fetch_unsplash_image(query: str) -> str:
    """Fetch a single Unsplash image URL for a query. Returns URL or empty string."""
    if not query:
        return ""
    key = os.environ.get("UNSPLASH_API_KEY", "")
    if not key:
        return ""
    try:
        async with httpx.AsyncClient(timeout=8) as c:
            r = await c.get(
                "https://api.unsplash.com/photos/random",
                params={"query": query, "orientation": "landscape"},
                headers={"Authorization": f"Client-ID {key}"},
            )
            if r.status_code == 200:
                return r.json().get("urls", {}).get("regular", "")
    except Exception:
        pass
    return ""


@api_router.post("/ai/generate-questions")
async def ai_generate_questions(body: dict, admin=Depends(get_admin)):
    category_id      = body.get("category_id", "")
    mode             = body.get("mode", "single")
    ai_engine        = body.get("ai_engine", "claude")      # "claude" | "gemini"
    fetch_images     = body.get("fetch_images", True)        # auto-fetch Unsplash
    extra_prompt     = (body.get("prompt_description") or body.get("extra_prompt") or "").strip()

    cat      = await db.categories.find_one({"id": category_id}, {"_id": 0})
    cat_name = cat.get("name", "عامة") if cat else "عامة"
    cat_desc = (cat.get("description") or cat_name) if cat else cat_name

    existing_qs = await db.questions.find(
        {"category_id": category_id, "deleted_at": None},
        {"_id": 0, "text": 1}
    ).to_list(300)
    existing_hint = ""
    if existing_qs:
        lines = "\n".join(f"- {q['text']}" for q in existing_qs[-30:])
        existing_hint = f"\n⚠️ لا تكرر هذه الأسئلة الموجودة:\n{lines}\n\n"

    custom = f"\nتعليمات المشرف: {extra_prompt}\n" if extra_prompt else ""

    base_rules = (
        "- اكتب الأسئلة والإجابات باللغة العربية الفصيحة\n"
        "- الأسئلة متنوعة، حماسية، وغير متكررة\n"
        "- الإجابة نص قصير (كلمة إلى ثلاث كلمات) — لا تكتب 'أ' أو 'ب' أو 'ج' أبداً\n"
        "- image_query: جملة إنجليزية قصيرة مناسبة للبحث عن صورة\n"
        "- أرجع JSON array فقط بدون أي شرح:\n"
        '[{"text":"...؟","answer":"...","image_query":"...","difficulty":300}]'
    )

    async def _gen(count: int, diff: int) -> list:
        diff_label = {300: "سهلة", 600: "متوسطة", 900: "صعبة"}.get(diff, "متوسطة")
        prompt = (
            f"أنشئ بالضبط {count} سؤال لفئة \"{cat_name}\" بمستوى {diff_label} ({diff} نقطة).\n"
            f"وصف الفئة: {cat_desc}\n"
            f"{custom}{existing_hint}{base_rules}"
        )
        raw = await _ai_generate(prompt, prefer=ai_engine)
        m = re.search(r'\[.*?\]', raw, re.DOTALL) or re.search(r'\[.*\]', raw, re.DOTALL)
        if not m:
            return []
        try:
            items = json.loads(m.group())
        except json.JSONDecodeError:
            return []
        ts = datetime.now(timezone.utc).isoformat()
        result = []
        for q in items[:count]:
            txt = (q.get("text") or "").strip()
            ans = (q.get("answer") or "").strip()
            # Skip if answer looks like a choice letter
            if not txt or not ans or ans in {"أ", "ب", "ج", "د", "A", "B", "C", "D"}:
                continue
            result.append({
                "id": str(uuid.uuid4()), "category_id": category_id, "difficulty": diff,
                "text": txt, "answer": ans,
                "image_query": (q.get("image_query") or "").strip(),
                "image_url": "", "answer_image_url": "",
                "question_type": "text", "is_experimental": True, "created_at": ts,
            })
        return result

    if mode == "full18":
        all_questions = []
        for diff, count in [(300, 6), (600, 6), (900, 6)]:
            all_questions.extend(await _gen(count, diff))
    else:
        raw_diff = body.get("difficulty", 300)
        diff_map = {"easy": 300, "medium": 600, "hard": 900, "سهل": 300, "متوسط": 600, "صعب": 900}
        difficulty = diff_map.get(str(raw_diff).lower()) or (int(raw_diff) if str(raw_diff).isdigit() else 300)
        count      = min(int(body.get("count", 10)), 30)
        all_questions = await _gen(count, difficulty)

    # Auto-fetch Unsplash images in parallel
    if fetch_images and all_questions:
        image_results = await asyncio.gather(
            *[_fetch_unsplash_image(q["image_query"]) for q in all_questions],
            return_exceptions=True,
        )
        for i, url in enumerate(image_results):
            if isinstance(url, str) and url:
                all_questions[i]["image_url"] = url

    return {"questions": all_questions, "count": len(all_questions)}


@api_router.post("/ai/save-questions")
async def ai_save_questions(body: dict, admin=Depends(get_admin)):
    questions = body.get("questions", [])
    if not questions:
        raise HTTPException(400, "لا توجد أسئلة للحفظ")
    save_as_pending = body.get("pending", False)
    target = db.pending_questions if save_as_pending else db.questions
    to_insert = []
    for q in questions:
        q.pop("_id", None)
        if not q.get("id"):
            q["id"] = str(uuid.uuid4())
        if save_as_pending:
            q["status"] = "pending"
        to_insert.append(q)
    await target.insert_many(to_insert)
    dest = "قائمة الانتظار" if save_as_pending else "الأسئلة"
    return {"message": f"تم حفظ {len(to_insert)} سؤال في {dest}", "count": len(to_insert)}

@api_router.get("/")
async def root():
    return {"message": "Hujjah API v2 – حُجّة", "version": "2.0"}

@api_router.post("/admin/seed-letter-categories")
async def seed_letter_categories(_: dict = Depends(get_super_admin)):
    """Add 3 new letter/word-based categories and their questions."""
    new_cats = [
        {
            "id": "cat_proverbs",
            "name": "أمثال شعبية",
            "description": "أكمل الأمثال الشعبية السعودية والعربية",
            "icon": "📜",
            "image_url": "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=600&q=80",
            "is_special": False,
            "is_premium": False,
            "is_active": True,
            "color": "#1e3a5f",
            "order": 21,
            "created_at": datetime.now(timezone.utc).isoformat(),
        },
        {
            "id": "cat_letters",
            "name": "حرف وكلمة",
            "description": "ألعاب الحروف والكلمات",
            "icon": "🔤",
            "image_url": "https://images.unsplash.com/photo-1546410531-bb4caa6b424d?w=600&q=80",
            "is_special": False,
            "is_premium": False,
            "is_active": True,
            "color": "#14532d",
            "order": 22,
            "created_at": datetime.now(timezone.utc).isoformat(),
        },
        {
            "id": "cat_whois",
            "name": "من أنا؟",
            "description": "خمّن من يصفه الوصف",
            "icon": "❓",
            "image_url": "https://images.unsplash.com/photo-1553481187-be93c21490a9?w=600&q=80",
            "is_special": False,
            "is_premium": False,
            "is_active": True,
            "color": "#4c1d95",
            "order": 23,
            "created_at": datetime.now(timezone.utc).isoformat(),
        },
    ]

    # Questions for أمثال شعبية
    proverb_questions = [
        # 300
        {"id": str(uuid.uuid4()), "category_id": "cat_proverbs", "difficulty": 300, "text": "اكمل المثل: الحر تكفيه...", "answer": "الإشارة", "image_url": "", "answer_image_url": "", "question_type": "text", "created_at": datetime.now(timezone.utc).isoformat()},
        {"id": str(uuid.uuid4()), "category_id": "cat_proverbs", "difficulty": 300, "text": "اكمل المثل: من جدّ...", "answer": "وجد", "image_url": "", "answer_image_url": "", "question_type": "text", "created_at": datetime.now(timezone.utc).isoformat()},
        {"id": str(uuid.uuid4()), "category_id": "cat_proverbs", "difficulty": 300, "text": "اكمل المثل: القناعة...", "answer": "كنز لا يفنى", "image_url": "", "answer_image_url": "", "question_type": "text", "created_at": datetime.now(timezone.utc).isoformat()},
        {"id": str(uuid.uuid4()), "category_id": "cat_proverbs", "difficulty": 300, "text": "اكمل المثل: من صبر...", "answer": "ظفر", "image_url": "", "answer_image_url": "", "question_type": "text", "created_at": datetime.now(timezone.utc).isoformat()},
        {"id": str(uuid.uuid4()), "category_id": "cat_proverbs", "difficulty": 300, "text": "اكمل المثل: يد واحدة لا...", "answer": "تصفق", "image_url": "", "answer_image_url": "", "question_type": "text", "created_at": datetime.now(timezone.utc).isoformat()},
        {"id": str(uuid.uuid4()), "category_id": "cat_proverbs", "difficulty": 300, "text": "اكمل المثل: الكذب...", "answer": "مفتاح كل شر", "image_url": "", "answer_image_url": "", "question_type": "text", "created_at": datetime.now(timezone.utc).isoformat()},
        {"id": str(uuid.uuid4()), "category_id": "cat_proverbs", "difficulty": 300, "text": "اكمل المثل: خير الكلام...", "answer": "ما قلّ ودل", "image_url": "", "answer_image_url": "", "question_type": "text", "created_at": datetime.now(timezone.utc).isoformat()},
        # 600
        {"id": str(uuid.uuid4()), "category_id": "cat_proverbs", "difficulty": 600, "text": "اكمل المثل: من حفر حفرة...", "answer": "وقع فيها", "image_url": "", "answer_image_url": "", "question_type": "text", "created_at": datetime.now(timezone.utc).isoformat()},
        {"id": str(uuid.uuid4()), "category_id": "cat_proverbs", "difficulty": 600, "text": "اكمل المثل: الغائب حجته...", "answer": "معه", "image_url": "", "answer_image_url": "", "question_type": "text", "created_at": datetime.now(timezone.utc).isoformat()},
        {"id": str(uuid.uuid4()), "category_id": "cat_proverbs", "difficulty": 600, "text": "اكمل المثل: ما خاب من...", "answer": "استشار", "image_url": "", "answer_image_url": "", "question_type": "text", "created_at": datetime.now(timezone.utc).isoformat()},
        {"id": str(uuid.uuid4()), "category_id": "cat_proverbs", "difficulty": 600, "text": "اكمل المثل: اطلب العلم من...", "answer": "المهد إلى اللحد", "image_url": "", "answer_image_url": "", "question_type": "text", "created_at": datetime.now(timezone.utc).isoformat()},
        {"id": str(uuid.uuid4()), "category_id": "cat_proverbs", "difficulty": 600, "text": "اكمل المثل: العين لا تعلو على...", "answer": "الحاجب", "image_url": "", "answer_image_url": "", "question_type": "text", "created_at": datetime.now(timezone.utc).isoformat()},
        {"id": str(uuid.uuid4()), "category_id": "cat_proverbs", "difficulty": 600, "text": "اكمل المثل: العلم في الصغر...", "answer": "كالنقش على الحجر", "image_url": "", "answer_image_url": "", "question_type": "text", "created_at": datetime.now(timezone.utc).isoformat()},
        {"id": str(uuid.uuid4()), "category_id": "cat_proverbs", "difficulty": 600, "text": "اكمل المثل: أعطِ الخبز لخبّازه...", "answer": "ولو أكل نصه", "image_url": "", "answer_image_url": "", "question_type": "text", "created_at": datetime.now(timezone.utc).isoformat()},
        # 900
        {"id": str(uuid.uuid4()), "category_id": "cat_proverbs", "difficulty": 900, "text": "اكمل المثل: التدبير نصف...", "answer": "المعيشة", "image_url": "", "answer_image_url": "", "question_type": "text", "created_at": datetime.now(timezone.utc).isoformat()},
        {"id": str(uuid.uuid4()), "category_id": "cat_proverbs", "difficulty": 900, "text": "اكمل المثل: الوقت كالسيف...", "answer": "إن لم تقطعه قطعك", "image_url": "", "answer_image_url": "", "question_type": "text", "created_at": datetime.now(timezone.utc).isoformat()},
        {"id": str(uuid.uuid4()), "category_id": "cat_proverbs", "difficulty": 900, "text": "اكمل المثل: شبل من أسد يجري...", "answer": "في جحر الحيات", "image_url": "", "answer_image_url": "", "question_type": "text", "created_at": datetime.now(timezone.utc).isoformat()},
        {"id": str(uuid.uuid4()), "category_id": "cat_proverbs", "difficulty": 900, "text": "اكمل المثل: إذا أردت أن تُطاع...", "answer": "فاطلب المستطاع", "image_url": "", "answer_image_url": "", "question_type": "text", "created_at": datetime.now(timezone.utc).isoformat()},
        {"id": str(uuid.uuid4()), "category_id": "cat_proverbs", "difficulty": 900, "text": "اكمل المثل: رُبّ كلمة قالت...", "answer": "لصاحبها دعي", "image_url": "", "answer_image_url": "", "question_type": "text", "created_at": datetime.now(timezone.utc).isoformat()},
        {"id": str(uuid.uuid4()), "category_id": "cat_proverbs", "difficulty": 900, "text": "اكمل المثل: جار قريب خير من...", "answer": "أخ بعيد", "image_url": "", "answer_image_url": "", "question_type": "text", "created_at": datetime.now(timezone.utc).isoformat()},
    ]

    # Questions for حرف وكلمة
    letters_questions = [
        # 300
        {"id": str(uuid.uuid4()), "category_id": "cat_letters", "difficulty": 300, "text": "أكمل الكلمة: ك_تاب (حرف واحد ناقص)", "answer": "كتاب", "image_url": "", "answer_image_url": "", "question_type": "text", "created_at": datetime.now(timezone.utc).isoformat()},
        {"id": str(uuid.uuid4()), "category_id": "cat_letters", "difficulty": 300, "text": "ما الحيوان الذي يبدأ بحرف الأسد؟", "answer": "أسد", "image_url": "", "answer_image_url": "", "question_type": "text", "created_at": datetime.now(timezone.utc).isoformat()},
        {"id": str(uuid.uuid4()), "category_id": "cat_letters", "difficulty": 300, "text": "أكمل: الشمس تشرق من الـ...", "answer": "شرق", "image_url": "", "answer_image_url": "", "question_type": "text", "created_at": datetime.now(timezone.utc).isoformat()},
        {"id": str(uuid.uuid4()), "category_id": "cat_letters", "difficulty": 300, "text": "ما الكلمة الناقصة: _لاح (آلة زراعية)", "answer": "فلاح", "image_url": "", "answer_image_url": "", "question_type": "text", "created_at": datetime.now(timezone.utc).isoformat()},
        {"id": str(uuid.uuid4()), "category_id": "cat_letters", "difficulty": 300, "text": "كلمة من 3 حروف تعني الماء في الصحراء تبدأ بـ و", "answer": "واحة", "image_url": "", "answer_image_url": "", "question_type": "text", "created_at": datetime.now(timezone.utc).isoformat()},
        {"id": str(uuid.uuid4()), "category_id": "cat_letters", "difficulty": 300, "text": "أكمل: الريـ__  تهب من الشمال", "answer": "الريح", "image_url": "", "answer_image_url": "", "question_type": "text", "created_at": datetime.now(timezone.utc).isoformat()},
        {"id": str(uuid.uuid4()), "category_id": "cat_letters", "difficulty": 300, "text": "ما الحرف الناقص: م_دينة", "answer": "مدينة (الحرف دال)", "image_url": "", "answer_image_url": "", "question_type": "text", "created_at": datetime.now(timezone.utc).isoformat()},
        # 600
        {"id": str(uuid.uuid4()), "category_id": "cat_letters", "difficulty": 600, "text": "رتب هذه الحروف لتكوّن دولة عربية: ر - ص - م", "answer": "مصر", "image_url": "", "answer_image_url": "", "question_type": "text", "created_at": datetime.now(timezone.utc).isoformat()},
        {"id": str(uuid.uuid4()), "category_id": "cat_letters", "difficulty": 600, "text": "أكمل: ___________ الرياض عاصمة المملكة (كلمة تنتهي بـ ن)", "answer": "إن", "image_url": "", "answer_image_url": "", "question_type": "text", "created_at": datetime.now(timezone.utc).isoformat()},
        {"id": str(uuid.uuid4()), "category_id": "cat_letters", "difficulty": 600, "text": "رتب هذه الحروف لتكوّن فاكهة: ن - م - و - ل - ي", "answer": "ليمون", "image_url": "", "answer_image_url": "", "question_type": "text", "created_at": datetime.now(timezone.utc).isoformat()},
        {"id": str(uuid.uuid4()), "category_id": "cat_letters", "difficulty": 600, "text": "أكمل الكلمة بإضافة حرف واحد: ق_مر (يضيء في الليل)", "answer": "قمر", "image_url": "", "answer_image_url": "", "question_type": "text", "created_at": datetime.now(timezone.utc).isoformat()},
        {"id": str(uuid.uuid4()), "category_id": "cat_letters", "difficulty": 600, "text": "ما الكلمة التي تقرأ من اليمين واليسار بنفس الطريقة وتعني سيارة أطفال؟", "answer": "كوكو (متناظرة)", "image_url": "", "answer_image_url": "", "question_type": "text", "created_at": datetime.now(timezone.utc).isoformat()},
        {"id": str(uuid.uuid4()), "category_id": "cat_letters", "difficulty": 600, "text": "رتب الحروف لتكوّن مدينة سعودية: ة - ك - م - م", "answer": "مكة", "image_url": "", "answer_image_url": "", "question_type": "text", "created_at": datetime.now(timezone.utc).isoformat()},
        {"id": str(uuid.uuid4()), "category_id": "cat_letters", "difficulty": 600, "text": "أزل حرفاً واحداً من كلمة 'سماء' لتحصل على لون", "answer": "سما → سما، أزل الألف: سم (سم؟) لا، أزل السين: ماء أو أزل الميم: ساء — الإجابة: سماء → سما → (أزل الواو أو...) رسالة: الجواب 'ساء'", "image_url": "", "answer_image_url": "", "question_type": "text", "created_at": datetime.now(timezone.utc).isoformat()},
        # 900
        {"id": str(uuid.uuid4()), "category_id": "cat_letters", "difficulty": 900, "text": "ما الكلمة التي إذا قلبت حروفها تصبح ضدها: 'جبن' ← ضدها؟", "answer": "نجب (من النجابة والشجاعة)", "image_url": "", "answer_image_url": "", "question_type": "text", "created_at": datetime.now(timezone.utc).isoformat()},
        {"id": str(uuid.uuid4()), "category_id": "cat_letters", "difficulty": 900, "text": "رتب الحروف لتكوّن اسم نبي: س - ي - ع - م - ل - إ", "answer": "إسماعيل", "image_url": "", "answer_image_url": "", "question_type": "text", "created_at": datetime.now(timezone.utc).isoformat()},
        {"id": str(uuid.uuid4()), "category_id": "cat_letters", "difficulty": 900, "text": "ما الكلمة العربية الوحيدة التي تنتهي بـ 'وق'؟ (نوع من الطيور)", "answer": "طاووق / تاووق", "image_url": "", "answer_image_url": "", "question_type": "text", "created_at": datetime.now(timezone.utc).isoformat()},
        {"id": str(uuid.uuid4()), "category_id": "cat_letters", "difficulty": 900, "text": "أضف حرفاً لكلمة 'بر' لتصبح مكاناً لصلاة المسلمين", "answer": "مبر → محراب أو: 'بر' + ح = برح... الإجابة: مبرة أو أضف 'ج' = برج", "image_url": "", "answer_image_url": "", "question_type": "text", "created_at": datetime.now(timezone.utc).isoformat()},
        {"id": str(uuid.uuid4()), "category_id": "cat_letters", "difficulty": 900, "text": "ما الحرف الذي يتكرر 3 مرات في كلمة 'موز' بعد تضعيفه؟", "answer": "المضعف: مووز — الحرف الواو", "image_url": "", "answer_image_url": "", "question_type": "text", "created_at": datetime.now(timezone.utc).isoformat()},
        {"id": str(uuid.uuid4()), "category_id": "cat_letters", "difficulty": 900, "text": "رتب الحروف: ن-د-أ-ع-ا لتكوّن دولة عربية", "answer": "عدنان — أو: الأردن؟ لا... الإجابة: 'عدنان' (اسم) أو إعادة: أ-ع-د-ن-ا = إعادة → الأردن ليس هنا. الإجابة الصحيحة: نادعا = ندع أو عدنا", "image_url": "", "answer_image_url": "", "question_type": "text", "created_at": datetime.now(timezone.utc).isoformat()},
    ]

    # Questions for من أنا؟
    whois_questions = [
        # 300
        {"id": str(uuid.uuid4()), "category_id": "cat_whois", "difficulty": 300, "text": "من أنا؟ أنا أكبر مدينة في المملكة العربية السعودية وعاصمتها", "answer": "الرياض", "image_url": "", "answer_image_url": "", "question_type": "text", "created_at": datetime.now(timezone.utc).isoformat()},
        {"id": str(uuid.uuid4()), "category_id": "cat_whois", "difficulty": 300, "text": "من أنا؟ أنا أطول جبل في العالم وأتواجد في منطقة الهيمالايا", "answer": "جبل إيفرست", "image_url": "", "answer_image_url": "", "question_type": "text", "created_at": datetime.now(timezone.utc).isoformat()},
        {"id": str(uuid.uuid4()), "category_id": "cat_whois", "difficulty": 300, "text": "من أنا؟ أنا الفاكهة الصفراء التي تنمو في المناطق الحارة وأعرف بـ'الذهب الأصفر'", "answer": "الموز", "image_url": "", "answer_image_url": "", "question_type": "text", "created_at": datetime.now(timezone.utc).isoformat()},
        {"id": str(uuid.uuid4()), "category_id": "cat_whois", "difficulty": 300, "text": "من أنا؟ أنا أهم حدث رياضي في العالم يُقام كل 4 سنوات لكرة القدم", "answer": "كأس العالم", "image_url": "", "answer_image_url": "", "question_type": "text", "created_at": datetime.now(timezone.utc).isoformat()},
        {"id": str(uuid.uuid4()), "category_id": "cat_whois", "difficulty": 300, "text": "من أنا؟ أنا النجم الأكثر لمعاناً في سماء النهار", "answer": "الشمس", "image_url": "", "answer_image_url": "", "question_type": "text", "created_at": datetime.now(timezone.utc).isoformat()},
        {"id": str(uuid.uuid4()), "category_id": "cat_whois", "difficulty": 300, "text": "من أنا؟ أنا الحيوان الذي يُعرف بـ'سفينة الصحراء'", "answer": "الجمل", "image_url": "", "answer_image_url": "", "question_type": "text", "created_at": datetime.now(timezone.utc).isoformat()},
        {"id": str(uuid.uuid4()), "category_id": "cat_whois", "difficulty": 300, "text": "من أنا؟ أنا المبنى الذي تلتف حوله الكعبة المشرفة وهو مركز الحج", "answer": "المسجد الحرام", "image_url": "", "answer_image_url": "", "question_type": "text", "created_at": datetime.now(timezone.utc).isoformat()},
        # 600
        {"id": str(uuid.uuid4()), "category_id": "cat_whois", "difficulty": 600, "text": "من أنا؟ أنا نهر أفريقي يمر بمصر وأطول أنهار العالم", "answer": "نهر النيل", "image_url": "", "answer_image_url": "", "question_type": "text", "created_at": datetime.now(timezone.utc).isoformat()},
        {"id": str(uuid.uuid4()), "category_id": "cat_whois", "difficulty": 600, "text": "من أنا؟ أنا عالم سعودي ولد في الطائف وكُنت أول رائد فضاء عربي", "answer": "الأمير سلطان بن سلمان", "image_url": "", "answer_image_url": "", "question_type": "text", "created_at": datetime.now(timezone.utc).isoformat()},
        {"id": str(uuid.uuid4()), "category_id": "cat_whois", "difficulty": 600, "text": "من أنا؟ أنا الشيء الذي يُقال 'ماء النار' وهو مادة قابلة للاشتعال", "answer": "الكحول / الإيثانول", "image_url": "", "answer_image_url": "", "question_type": "text", "created_at": datetime.now(timezone.utc).isoformat()},
        {"id": str(uuid.uuid4()), "category_id": "cat_whois", "difficulty": 600, "text": "من أنا؟ أنا مدينة سعودية تُعرف بـ'العروس' وتقع على البحر الأحمر", "answer": "جدة", "image_url": "", "answer_image_url": "", "question_type": "text", "created_at": datetime.now(timezone.utc).isoformat()},
        {"id": str(uuid.uuid4()), "category_id": "cat_whois", "difficulty": 600, "text": "من أنا؟ أنا الطائر الذي يرمز للسلام وهو أبيض اللون", "answer": "الحمامة", "image_url": "", "answer_image_url": "", "question_type": "text", "created_at": datetime.now(timezone.utc).isoformat()},
        {"id": str(uuid.uuid4()), "category_id": "cat_whois", "difficulty": 600, "text": "من أنا؟ أنا الرياضي السعودي اللاعب في نادي الهلال والفائز بجائزة أفضل لاعب", "answer": "محمد الدعيع (أو حسب السياق: سالم الدوسري)", "image_url": "", "answer_image_url": "", "question_type": "text", "created_at": datetime.now(timezone.utc).isoformat()},
        {"id": str(uuid.uuid4()), "category_id": "cat_whois", "difficulty": 600, "text": "من أنا؟ أنا لغة البرمجة التي سُميت على اسم ثعبان", "answer": "Python (بايثون)", "image_url": "", "answer_image_url": "", "question_type": "text", "created_at": datetime.now(timezone.utc).isoformat()},
        # 900
        {"id": str(uuid.uuid4()), "category_id": "cat_whois", "difficulty": 900, "text": "من أنا؟ أنا العالم المسلم الأندلسي الذي وضع أسس الجراحة في القرن العاشر الميلادي", "answer": "الزهراوي (أبو القاسم الزهراوي)", "image_url": "", "answer_image_url": "", "question_type": "text", "created_at": datetime.now(timezone.utc).isoformat()},
        {"id": str(uuid.uuid4()), "category_id": "cat_whois", "difficulty": 900, "text": "من أنا؟ أنا المدينة السعودية التي تقع في جوف المملكة وتُعرف بآثارها النبطية وهي من التراث العالمي", "answer": "العُلا (مدائن صالح)", "image_url": "", "answer_image_url": "", "question_type": "text", "created_at": datetime.now(timezone.utc).isoformat()},
        {"id": str(uuid.uuid4()), "category_id": "cat_whois", "difficulty": 900, "text": "من أنا؟ أنا البروتين الذي يعطي الجلد والشعر لونهما وأُنتج بفعل الشمس", "answer": "الميلانين", "image_url": "", "answer_image_url": "", "question_type": "text", "created_at": datetime.now(timezone.utc).isoformat()},
        {"id": str(uuid.uuid4()), "category_id": "cat_whois", "difficulty": 900, "text": "من أنا؟ أنا أول مسلسل سعودي حاز على جوائز دولية وعُرض على منصة عالمية في 2023", "answer": "مداح الظلام / بالنسبة لمسلسلات 2023", "image_url": "", "answer_image_url": "", "question_type": "text", "created_at": datetime.now(timezone.utc).isoformat()},
        {"id": str(uuid.uuid4()), "category_id": "cat_whois", "difficulty": 900, "text": "من أنا؟ أنا أكبر منشأة رياضية في العالم العربي وافتُتحت في السعودية عام 2022", "answer": "استاد الملك فهد الدولي", "image_url": "", "answer_image_url": "", "question_type": "text", "created_at": datetime.now(timezone.utc).isoformat()},
        {"id": str(uuid.uuid4()), "category_id": "cat_whois", "difficulty": 900, "text": "من أنا؟ أنا المبادرة السعودية التي تهدف لزراعة 10 مليار شجرة بحلول 2030", "answer": "مبادرة السعودية الخضراء", "image_url": "", "answer_image_url": "", "question_type": "text", "created_at": datetime.now(timezone.utc).isoformat()},
    ]

    all_questions = proverb_questions + letters_questions + whois_questions
    added_cats = 0
    added_qs = 0

    for cat in new_cats:
        existing = await db.categories.find_one({"id": cat["id"]})
        if not existing:
            await db.categories.insert_one(cat)
            added_cats += 1

    for q in all_questions:
        existing = await db.questions.find_one({"text": q["text"], "category_id": q["category_id"]})
        if not existing:
            await db.questions.insert_one(q)
            added_qs += 1

    return {
        "status": "done",
        "categories_added": added_cats,
        "questions_added": added_qs,
        "total_questions": len(all_questions),
    }

# ══════════════════════════════════════════════════════════════════════════════
# ADMIN LOGS  (Super Admin only)
# ══════════════════════════════════════════════════════════════════════════════

@api_router.get("/admin/logs")
async def get_admin_logs(limit: int = 50, skip: int = 0, admin: dict = Depends(get_super_admin)):
    logs = await db.admin_logs.find({}, {"_id": 0}).sort("timestamp", -1).skip(skip).limit(limit).to_list(limit)
    total = await db.admin_logs.count_documents({})
    return {"logs": logs, "total": total, "limit": limit, "skip": skip}

# ══════════════════════════════════════════════════════════════════════════════
# STAFF MANAGEMENT  (Super Admin only)
# ══════════════════════════════════════════════════════════════════════════════

@api_router.get("/admin/staff")
async def list_staff(_: dict = Depends(get_super_admin)):
    staff = await db.admin_accounts.find({}, {"_id": 0, "password_hash": 0}).to_list(100)
    return staff

@api_router.post("/admin/staff")
async def create_staff(body: StaffCreate, admin: dict = Depends(get_super_admin)):
    existing = await db.admin_accounts.find_one({"username": body.username})
    if existing:
        raise HTTPException(409, "اسم المستخدم محجوز")
    if len(body.password) < 6:
        raise HTTPException(400, "كلمة المرور يجب أن تكون 6 أحرف على الأقل")
    staff = {
        "id": str(uuid.uuid4()),
        "username": body.username.strip(),
        "password_hash": hash_pw(body.password),
        "display_name": (body.display_name or body.username).strip(),
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.admin_accounts.insert_one(staff)
    await log_admin_action(admin, "إضافة موظف", "موظف", staff["display_name"])
    return {"id": staff["id"], "username": staff["username"], "display_name": staff["display_name"],
            "created_at": staff["created_at"]}

@api_router.put("/admin/staff/{staff_id}")
async def update_staff(staff_id: str, body: dict, admin: dict = Depends(get_super_admin)):
    updates = {}
    if body.get("display_name"):
        updates["display_name"] = body["display_name"].strip()
    if body.get("password"):
        if len(body["password"]) < 6:
            raise HTTPException(400, "كلمة المرور 6 أحرف على الأقل")
        updates["password_hash"] = hash_pw(body["password"])
    if not updates:
        raise HTTPException(400, "لا توجد بيانات للتحديث")
    await db.admin_accounts.update_one({"id": staff_id}, {"$set": updates})
    staff = await db.admin_accounts.find_one({"id": staff_id}, {"_id": 0, "password_hash": 0})
    if not staff:
        raise HTTPException(404, "الموظف غير موجود")
    await log_admin_action(admin, "تعديل موظف", "موظف", staff.get("display_name", staff_id))
    return staff

@api_router.delete("/admin/staff/{staff_id}")
async def delete_staff(staff_id: str, admin: dict = Depends(get_super_admin)):
    staff = await db.admin_accounts.find_one({"id": staff_id}, {"_id": 0})
    if not staff:
        raise HTTPException(404, "الموظف غير موجود")
    await db.admin_accounts.delete_one({"id": staff_id})
    await log_admin_action(admin, "حذف موظف", "موظف", staff.get("display_name", staff_id))
    return {"message": "تم الحذف"}

# ══════════════════════════════════════════════════════════════════════════════
# GIFT SUBSCRIPTION  (Super Admin only)
# ══════════════════════════════════════════════════════════════════════════════

@api_router.post("/admin/users/{user_id}/gift-subscription")
async def gift_subscription(user_id: str, body: GiftSubscription, admin: dict = Depends(get_super_admin)):
    plan = SUBSCRIPTION_PLANS.get(body.plan_id, SUBSCRIPTION_PLANS["monthly"])
    days = body.days if body.days else plan["days"]
    expires = (datetime.now(timezone.utc) + timedelta(days=days)).isoformat()
    await db.users.update_one(
        {"id": user_id},
        {"$set": {"subscription_type": "premium", "subscription_expires_at": expires,
                  "notify_warning_sent": False, "notify_expired_sent": False}}
    )
    txn = {
        "id": str(uuid.uuid4()),
        "user_id": user_id,
        "plan_id": body.plan_id,
        "amount": 0,
        "currency": "SAR",
        "payment_status": "gift",
        "status": "complete",
        "gifted_by": admin.get("admin_name"),
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.payment_transactions.insert_one(txn)
    user = await db.users.find_one({"id": user_id}, {"_id": 0, "password_hash": 0})
    await log_admin_action(admin, "هدية اشتراك", "مستخدم",
                           user.get("username", user_id) if user else user_id,
                           f"مدة {days} يوم حتى {expires[:10]}")
    return {"message": f"تم منح الاشتراك المميز لـ {days} يوم", "expires_at": expires, "user": user}

# ══════════════════════════════════════════════════════════════════════════════
# EMAIL NOTIFICATION SYSTEM
# ══════════════════════════════════════════════════════════════════════════════

async def send_email_notification(to_email: str, subject: str, html_body: str) -> bool:
    """Send email via Gmail SMTP. Returns True on success."""
    if not EMAIL_USER or not EMAIL_PASS:
        logger.warning("Email credentials not configured — skipping email send")
        return False
    try:
        msg = MIMEMultipart("alternative")
        msg["From"]    = f"Hujjah Game <{EMAIL_USER}>"
        msg["To"]      = to_email
        msg["Subject"] = subject
        msg.attach(MIMEText(html_body, "html", "utf-8"))
        await aiosmtplib.send(
            msg,
            hostname="smtp.gmail.com",
            port=587,
            start_tls=True,
            username=EMAIL_USER,
            password=EMAIL_PASS.replace(" ", ""),  # strip spaces from app password
        )
        logger.info(f"Email sent to {to_email}: {subject}")
        return True
    except Exception as e:
        logger.error(f"Failed to send email to {to_email}: {e}")
        return False

def build_warning_email(username: str, expires_at: str) -> str:
    exp_date = expires_at[:10] if expires_at else ""
    return f"""
    <div dir="rtl" style="font-family:Arial,sans-serif;max-width:520px;margin:auto;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 4px 20px rgba(0,0,0,0.1)">
      <div style="background:linear-gradient(135deg,#5B0E14,#8B1520);padding:32px;text-align:center">
        <h1 style="color:#F1E194;margin:0;font-size:2rem">حُجّة</h1>
        <p style="color:rgba(241,225,148,0.7);margin:8px 0 0">لعبة المعلومات العربية</p>
      </div>
      <div style="padding:32px">
        <h2 style="color:#5B0E14;margin:0 0 16px">مرحباً {username} 👋</h2>
        <p style="color:#444;line-height:1.7;font-size:1rem">
          اشتراكك المميز في <strong>حُجّة</strong> سينتهي قريباً بتاريخ <strong>{exp_date}</strong>.
        </p>
        <p style="color:#444;line-height:1.7">
          جدّد اشتراكك الآن للاستمرار في الاستمتاع بجميع الفئات المميزة دون انقطاع.
        </p>
        <div style="text-align:center;margin:28px 0">
          <a href="https://hujjah-trivia.preview.emergentagent.com/pricing"
             style="background:#F1E194;color:#5B0E14;padding:14px 32px;border-radius:50px;text-decoration:none;font-weight:900;font-size:1.1rem">
            جدّد الاشتراك
          </a>
        </div>
        <p style="color:#888;font-size:0.85rem;text-align:center">
          إذا كنت لا ترغب في هذه الرسائل يمكنك تجاهلها.
        </p>
      </div>
    </div>
    """

def build_expired_email(username: str) -> str:
    return f"""
    <div dir="rtl" style="font-family:Arial,sans-serif;max-width:520px;margin:auto;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 4px 20px rgba(0,0,0,0.1)">
      <div style="background:linear-gradient(135deg,#5B0E14,#8B1520);padding:32px;text-align:center">
        <h1 style="color:#F1E194;margin:0;font-size:2rem">حُجّة</h1>
        <p style="color:rgba(241,225,148,0.7);margin:8px 0 0">لعبة المعلومات العربية</p>
      </div>
      <div style="padding:32px">
        <h2 style="color:#5B0E14;margin:0 0 16px">مرحباً {username} 👋</h2>
        <p style="color:#444;line-height:1.7;font-size:1rem">
          انتهى اشتراكك المميز في <strong>حُجّة</strong>.
        </p>
        <p style="color:#444;line-height:1.7">
          يمكنك تجديد اشتراكك في أي وقت للعودة إلى الوصول الكامل لجميع الفئات والمحتوى المميز.
        </p>
        <div style="text-align:center;margin:28px 0">
          <a href="https://hujjah-trivia.preview.emergentagent.com/pricing"
             style="background:#F1E194;color:#5B0E14;padding:14px 32px;border-radius:50px;text-decoration:none;font-weight:900;font-size:1.1rem">
            اشترك مجدداً
          </a>
        </div>
      </div>
    </div>
    """

async def check_subscription_notifications():
    """Check all premium users and send expiry notification emails."""
    now = datetime.now(timezone.utc)
    three_days_later = now + timedelta(days=3)
    try:
        premium_users = await db.users.find(
            {"subscription_type": "premium", "subscription_expires_at": {"$exists": True, "$ne": None}},
            {"_id": 0, "id": 1, "email": 1, "username": 1,
             "subscription_expires_at": 1, "notify_warning_sent": 1, "notify_expired_sent": 1}
        ).to_list(1000)

        for user in premium_users:
            exp_str = user.get("subscription_expires_at", "")
            if not exp_str or not user.get("email"):
                continue
            try:
                exp_dt = datetime.fromisoformat(exp_str)
            except Exception:
                continue

            if now < exp_dt <= three_days_later and not user.get("notify_warning_sent"):
                # Warning: expires within 3 days
                sent = await send_email_notification(
                    user["email"],
                    "⚠️ اشتراكك في حُجّة سينتهي قريباً",
                    build_warning_email(user.get("username", ""), exp_str)
                )
                if sent:
                    await db.users.update_one({"id": user["id"]}, {"$set": {"notify_warning_sent": True}})

            elif exp_dt <= now and not user.get("notify_expired_sent"):
                # Expired
                sent = await send_email_notification(
                    user["email"],
                    "❌ انتهى اشتراكك المميز في حُجّة",
                    build_expired_email(user.get("username", ""))
                )
                if sent:
                    await db.users.update_one(
                        {"id": user["id"]},
                        {"$set": {"notify_expired_sent": True, "subscription_type": "free"}}
                    )

        logger.info(f"Subscription check complete — processed {len(premium_users)} users")
    except Exception as e:
        logger.error(f"Subscription check error: {e}")

@api_router.post("/admin/trigger-subscription-check")
async def trigger_subscription_check(_: dict = Depends(get_super_admin)):
    """Manually trigger subscription expiry check (for testing)."""
    await check_subscription_notifications()
    return {"message": "تم تشغيل فحص الاشتراكات"}

# ══════════════════════════════════════════════════════════════════════════════
# UNSPLASH IMAGE SEARCH
# ══════════════════════════════════════════════════════════════════════════════

@api_router.get("/unsplash/search")
async def unsplash_search(query: str, admin: dict = Depends(get_admin)):
    """Fetch a relevant image from Unsplash for a given search query."""
    if not UNSPLASH_API_KEY:
        raise HTTPException(503, "Unsplash API key not configured")
    try:
        async with httpx.AsyncClient(timeout=8.0) as client:
            resp = await client.get(
                "https://api.unsplash.com/search/photos",
                params={"query": query, "per_page": 3, "client_id": UNSPLASH_API_KEY,
                        "orientation": "landscape"}
            )
            data = resp.json()
            results = data.get("results", [])
            if results:
                photo = results[0]
                return {
                    "url": photo["urls"]["small"],
                    "regular_url": photo["urls"]["regular"],
                    "thumb_url": photo["urls"]["thumb"],
                    "credit_name": photo["user"]["name"],
                    "credit_link": photo["user"]["links"]["html"],
                    "alt": photo.get("alt_description") or query,
                }
        return {"url": None, "regular_url": None, "thumb_url": None}
    except Exception as e:
        logger.error(f"Unsplash error: {e}")
        return {"url": None, "regular_url": None, "thumb_url": None}

# ══════════════════════════════════════════════════════════════════════════════
# CATEGORY GROUPS
# ══════════════════════════════════════════════════════════════════════════════

DEFAULT_GROUPS = [
    {"name": "علمي",        "icon": "🔬", "color": "#1e40af", "order": 1},
    {"name": "ثقافة عامة",  "icon": "🌍", "color": "#065f46", "order": 2},
    {"name": "رياضة",       "icon": "⚽", "color": "#92400e", "order": 3},
    {"name": "تاريخ",       "icon": "📜", "color": "#7c2d12", "order": 4},
    {"name": "جغرافيا",     "icon": "🗺️", "color": "#1e3a5f", "order": 5},
    {"name": "دين",         "icon": "☪️", "color": "#166534", "order": 6},
    {"name": "تكنولوجيا",   "icon": "💻", "color": "#1e1b4b", "order": 7},
    {"name": "ترفيه",       "icon": "🎬", "color": "#7c1d68", "order": 8},
    {"name": "مسلسلات",     "icon": "📺", "color": "#991b1b", "order": 9},
    {"name": "أنمي",        "icon": "🎌", "color": "#92400e", "order": 10},
]

@api_router.get("/category-groups")
async def list_category_groups():
    groups = await db.category_groups.find({}, {"_id": 0}).sort("order", 1).to_list(100)
    return groups

@api_router.post("/category-groups")
async def create_category_group(body: CategoryGroupCreate, admin: dict = Depends(get_admin)):
    group = CategoryGroup(**body.model_dump())
    await db.category_groups.insert_one(group.model_dump())
    await log_admin_action(admin, "إضافة", "مجموعة فئات", group.name)
    return {k: v for k, v in group.model_dump().items() if k != "_id"}

@api_router.put("/category-groups/{group_id}")
async def update_category_group(group_id: str, body: CategoryGroupCreate, admin: dict = Depends(get_admin)):
    upd = {**body.model_dump(), "updated_at": datetime.now(timezone.utc).isoformat()}
    res = await db.category_groups.find_one_and_update(
        {"id": group_id}, {"$set": upd}, {"_id": 0}, return_document=True
    )
    if not res: raise HTTPException(404, "المجموعة غير موجودة")
    await log_admin_action(admin, "تعديل", "مجموعة فئات", res.get("name", group_id))
    return res

@api_router.delete("/category-groups/{group_id}")
async def delete_category_group(group_id: str, admin: dict = Depends(get_super_admin)):
    group = await db.category_groups.find_one({"id": group_id}, {"_id": 0})
    if not group: raise HTTPException(404, "المجموعة غير موجودة")
    # Un-assign categories from this group
    await db.categories.update_many({"group_id": group_id}, {"$set": {"group_id": None}})
    await db.category_groups.delete_one({"id": group_id})
    await log_admin_action(admin, "حذف", "مجموعة فئات", group.get("name", group_id))
    return {"message": "تم الحذف"}

@api_router.post("/admin/seed-category-groups")
async def seed_category_groups(_: dict = Depends(get_super_admin)):
    """Seed default category groups if none exist."""
    count = await db.category_groups.count_documents({})
    if count > 0:
        return {"message": "المجموعات موجودة مسبقاً", "count": count}
    added = 0
    for g in DEFAULT_GROUPS:
        grp = CategoryGroup(**g)
        await db.category_groups.insert_one(grp.model_dump())
        added += 1
    return {"message": f"تمت إضافة {added} مجموعة", "added": added}

app.include_router(api_router)
app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)

async def _subscription_daily_loop():
    """Run subscription expiry check every 24 hours."""
    await asyncio.sleep(30)  # Wait 30s after startup before first run
    while True:
        try:
            await check_subscription_notifications()
        except Exception as e:
            logger.error(f"Daily subscription loop error: {e}")
        await asyncio.sleep(86400)  # 24 hours

@app.on_event("startup")
async def startup_event():
    asyncio.create_task(_subscription_daily_loop())
    logger.info("Subscription notification loop started")
    # DB Indexes for performance at scale
    try:
        await db.questions.create_index([("category_id", 1), ("difficulty", 1)])
        await db.questions.create_index([("id", 1)], unique=True)
        await db.users.create_index([("id", 1)], unique=True)
        await db.users.create_index([("email", 1)], unique=True)
        await db.game_sessions.create_index([("id", 1)], unique=True)
        await db.pending_questions.create_index([("category_id", 1)])
        await db.pending_questions.create_index([("id", 1)])
        await db.payment_transactions.create_index([("transaction_no", 1)])
        await db.payment_transactions.create_index([("user_id", 1)])
        logger.info("DB indexes created/verified")
    except Exception as e:
        logger.warning(f"Index creation warning: {e}")

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
