from fastapi import FastAPI, APIRouter, HTTPException, Depends, Header
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field
from typing import List, Optional
import uuid
from datetime import datetime, timezone, timedelta
from jose import jwt, JWTError
import random

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

app = FastAPI()
api_router = APIRouter(prefix="/api")

SECRET_KEY = os.environ.get('JWT_SECRET_KEY', 'hujjah_secret_key_2024')
ADMIN_PASSWORD = os.environ.get('ADMIN_PASSWORD', 'hujjah2024')
ALGORITHM = "HS256"

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# ─── Models ───────────────────────────────────────────────────────────────────

class AdminLogin(BaseModel):
    password: str

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
    difficulty: int  # 200, 400, 600
    text: str
    answer: str
    image_url: str = ""
    answer_image_url: str = ""
    question_type: str = "text"  # "text" or "secret_word"
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())

class QuestionCreate(BaseModel):
    category_id: str
    difficulty: int
    text: str
    answer: str
    image_url: str = ""
    answer_image_url: str = ""
    question_type: str = "text"

class GameSession(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    team1_name: str
    team2_name: str
    team1_score: int = 0
    team2_score: int = 0
    team1_categories: List[str] = []
    team2_categories: List[str] = []
    used_questions: List[str] = []
    status: str = "setup"
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
    updated_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())

class GameSessionCreate(BaseModel):
    team1_name: str
    team2_name: str

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
    team: int  # 1 or 2
    points: int

# ─── Auth ──────────────────────────────────────────────────────────────────────

def create_token():
    payload = {"sub": "admin", "exp": datetime.now(timezone.utc) + timedelta(hours=24)}
    return jwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)

async def get_admin(authorization: Optional[str] = Header(None)):
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="غير مصرح")
    token = authorization.split(" ")[1]
    try:
        jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        return True
    except JWTError:
        raise HTTPException(status_code=401, detail="جلسة منتهية")

@api_router.post("/auth/login")
async def admin_login(body: AdminLogin):
    if body.password != ADMIN_PASSWORD:
        raise HTTPException(status_code=401, detail="كلمة المرور غلط")
    return {"token": create_token()}

@api_router.get("/auth/verify")
async def verify_token(_: bool = Depends(get_admin)):
    return {"valid": True}

# ─── Categories ───────────────────────────────────────────────────────────────

@api_router.get("/categories", response_model=List[Category])
async def get_categories():
    cats = await db.categories.find({}, {"_id": 0}).sort("order", 1).to_list(100)
    return cats

@api_router.post("/categories", response_model=Category)
async def create_category(body: CategoryCreate, _: bool = Depends(get_admin)):
    cat = Category(**body.model_dump())
    await db.categories.insert_one(cat.model_dump())
    return cat

@api_router.put("/categories/{cat_id}", response_model=Category)
async def update_category(cat_id: str, body: CategoryCreate, _: bool = Depends(get_admin)):
    update_data = body.model_dump()
    update_data["updated_at"] = datetime.now(timezone.utc).isoformat()
    result = await db.categories.find_one_and_update(
        {"id": cat_id}, {"$set": update_data}, {"_id": 0}, return_document=True
    )
    if not result:
        raise HTTPException(status_code=404, detail="الفئة غير موجودة")
    return result

@api_router.delete("/categories/{cat_id}")
async def delete_category(cat_id: str, _: bool = Depends(get_admin)):
    await db.categories.delete_one({"id": cat_id})
    await db.questions.delete_many({"category_id": cat_id})
    return {"message": "تم الحذف"}

# ─── Questions ────────────────────────────────────────────────────────────────

@api_router.get("/questions", response_model=List[Question])
async def get_questions(category_id: Optional[str] = None, difficulty: Optional[int] = None):
    query = {}
    if category_id:
        query["category_id"] = category_id
    if difficulty:
        query["difficulty"] = difficulty
    questions = await db.questions.find(query, {"_id": 0}).to_list(1000)
    return questions

@api_router.get("/questions/{q_id}", response_model=Question)
async def get_question(q_id: str):
    q = await db.questions.find_one({"id": q_id}, {"_id": 0})
    if not q:
        raise HTTPException(status_code=404, detail="السؤال غير موجود")
    return q

@api_router.post("/questions", response_model=Question)
async def create_question(body: QuestionCreate, _: bool = Depends(get_admin)):
    q = Question(**body.model_dump())
    await db.questions.insert_one(q.model_dump())
    return q

@api_router.put("/questions/{q_id}", response_model=Question)
async def update_question(q_id: str, body: QuestionCreate, _: bool = Depends(get_admin)):
    update_data = body.model_dump()
    update_data["updated_at"] = datetime.now(timezone.utc).isoformat()
    result = await db.questions.find_one_and_update(
        {"id": q_id}, {"$set": update_data}, {"_id": 0}, return_document=True
    )
    if not result:
        raise HTTPException(status_code=404, detail="السؤال غير موجود")
    return result

@api_router.delete("/questions/{q_id}")
async def delete_question(q_id: str, _: bool = Depends(get_admin)):
    await db.questions.delete_one({"id": q_id})
    return {"message": "تم الحذف"}

# ─── Game Session ─────────────────────────────────────────────────────────────

@api_router.post("/game/session", response_model=GameSession)
async def create_session(body: GameSessionCreate):
    session = GameSession(**body.model_dump())
    await db.game_sessions.insert_one(session.model_dump())
    return session

@api_router.get("/game/session/{session_id}", response_model=GameSession)
async def get_session(session_id: str):
    session = await db.game_sessions.find_one({"id": session_id}, {"_id": 0})
    if not session:
        raise HTTPException(status_code=404, detail="الجلسة غير موجودة")
    return session

@api_router.put("/game/session/{session_id}", response_model=GameSession)
async def update_session(session_id: str, body: GameSessionUpdate):
    update_data = {k: v for k, v in body.model_dump().items() if v is not None}
    update_data["updated_at"] = datetime.now(timezone.utc).isoformat()
    result = await db.game_sessions.find_one_and_update(
        {"id": session_id}, {"$set": update_data}, {"_id": 0}, return_document=True
    )
    if not result:
        raise HTTPException(status_code=404, detail="الجلسة غير موجودة")
    return result

@api_router.post("/game/session/{session_id}/question")
async def get_next_question(session_id: str, category_id: str, difficulty: int):
    session = await db.game_sessions.find_one({"id": session_id}, {"_id": 0})
    if not session:
        raise HTTPException(status_code=404, detail="الجلسة غير موجودة")

    used = session.get("used_questions", [])
    available = await db.questions.find(
        {"category_id": category_id, "difficulty": difficulty, "id": {"$nin": used}},
        {"_id": 0}
    ).to_list(100)

    if not available:
        raise HTTPException(status_code=404, detail="لا يوجد أسئلة متاحة")

    question = random.choice(available)
    new_used = used + [question["id"]]
    await db.game_sessions.update_one(
        {"id": session_id},
        {"$set": {"used_questions": new_used, "updated_at": datetime.now(timezone.utc).isoformat()}}
    )
    return question

@api_router.post("/game/session/{session_id}/score")
async def update_score(session_id: str, body: ScoreUpdate):
    session = await db.game_sessions.find_one({"id": session_id}, {"_id": 0})
    if not session:
        raise HTTPException(status_code=404, detail="الجلسة غير موجودة")

    field = "team1_score" if body.team == 1 else "team2_score"
    current = session.get(field, 0)
    new_score = max(0, current + body.points)
    await db.game_sessions.update_one(
        {"id": session_id},
        {"$set": {field: new_score, "updated_at": datetime.now(timezone.utc).isoformat()}}
    )
    updated = await db.game_sessions.find_one({"id": session_id}, {"_id": 0})
    return {"team1_score": updated["team1_score"], "team2_score": updated["team2_score"]}

# ─── Secret Word (QR) ─────────────────────────────────────────────────────────

@api_router.get("/secret/{question_id}")
async def get_secret_word(question_id: str):
    q = await db.questions.find_one({"id": question_id}, {"_id": 0})
    if not q:
        raise HTTPException(status_code=404, detail="الكلمة غير موجودة")
    return {"word": q.get("answer", ""), "image_url": q.get("image_url", ""), "difficulty": q.get("difficulty", 200)}

# ─── Seed ─────────────────────────────────────────────────────────────────────

@api_router.post("/seed")
async def seed_data(_: bool = Depends(get_admin)):
    existing = await db.categories.count_documents({})
    if existing > 0:
        return {"message": "البيانات موجودة مسبقاً"}

    categories = [
        {"id": "cat_flags", "name": "اعلام دول", "icon": "🏳️", "image_url": "", "is_special": False, "color": "#1a6b3c", "order": 1, "description": "خمّن علم الدولة!", "created_at": datetime.now(timezone.utc).isoformat()},
        {"id": "cat_easy", "name": "معلومات سهلة", "icon": "💡", "image_url": "", "is_special": False, "color": "#1a3a6b", "order": 2, "description": "معلومات سهلة للجميع", "created_at": datetime.now(timezone.utc).isoformat()},
        {"id": "cat_saudi", "name": "السعودية", "icon": "🇸🇦", "image_url": "", "is_special": False, "color": "#5B0E14", "order": 3, "description": "اسئلة عن المملكة", "created_at": datetime.now(timezone.utc).isoformat()},
        {"id": "cat_islamic", "name": "اسلامي", "icon": "☪️", "image_url": "", "is_special": False, "color": "#2d5a27", "order": 4, "description": "أسئلة إسلامية", "created_at": datetime.now(timezone.utc).isoformat()},
        {"id": "cat_science", "name": "علوم بسيطة", "icon": "🔬", "image_url": "", "is_special": False, "color": "#1a3a6b", "order": 5, "description": "علوم للجميع", "created_at": datetime.now(timezone.utc).isoformat()},
        {"id": "cat_logos", "name": "شعارات", "icon": "🏷️", "image_url": "", "is_special": False, "color": "#6b3a1a", "order": 6, "description": "خمّن الشعار!", "created_at": datetime.now(timezone.utc).isoformat()},
        {"id": "cat_word", "name": "ولا كلمة", "icon": "🤫", "image_url": "", "is_special": True, "color": "#4a1a6b", "order": 7, "description": "وصّف بدون ما تقول الكلمة!", "created_at": datetime.now(timezone.utc).isoformat()},
    ]
    await db.categories.insert_many(categories)

    questions = [
        # ─── اعلام دول ───
        # 200 - Easy flags
        {"id": str(uuid.uuid4()), "category_id": "cat_flags", "difficulty": 200, "text": "علم أي دولة هذا؟", "answer": "اليابان", "image_url": "https://flagcdn.com/w320/jp.png", "answer_image_url": "", "question_type": "text", "created_at": datetime.now(timezone.utc).isoformat()},
        {"id": str(uuid.uuid4()), "category_id": "cat_flags", "difficulty": 200, "text": "علم أي دولة هذا؟", "answer": "فرنسا", "image_url": "https://flagcdn.com/w320/fr.png", "answer_image_url": "", "question_type": "text", "created_at": datetime.now(timezone.utc).isoformat()},
        {"id": str(uuid.uuid4()), "category_id": "cat_flags", "difficulty": 200, "text": "علم أي دولة هذا؟", "answer": "المملكة المتحدة", "image_url": "https://flagcdn.com/w320/gb.png", "answer_image_url": "", "question_type": "text", "created_at": datetime.now(timezone.utc).isoformat()},
        {"id": str(uuid.uuid4()), "category_id": "cat_flags", "difficulty": 200, "text": "علم أي دولة هذا؟", "answer": "أمريكا", "image_url": "https://flagcdn.com/w320/us.png", "answer_image_url": "", "question_type": "text", "created_at": datetime.now(timezone.utc).isoformat()},
        {"id": str(uuid.uuid4()), "category_id": "cat_flags", "difficulty": 200, "text": "علم أي دولة هذا؟", "answer": "المملكة العربية السعودية", "image_url": "https://flagcdn.com/w320/sa.png", "answer_image_url": "", "question_type": "text", "created_at": datetime.now(timezone.utc).isoformat()},
        {"id": str(uuid.uuid4()), "category_id": "cat_flags", "difficulty": 200, "text": "علم أي دولة هذا؟", "answer": "الإمارات", "image_url": "https://flagcdn.com/w320/ae.png", "answer_image_url": "", "question_type": "text", "created_at": datetime.now(timezone.utc).isoformat()},
        {"id": str(uuid.uuid4()), "category_id": "cat_flags", "difficulty": 200, "text": "علم أي دولة هذا؟", "answer": "مصر", "image_url": "https://flagcdn.com/w320/eg.png", "answer_image_url": "", "question_type": "text", "created_at": datetime.now(timezone.utc).isoformat()},
        {"id": str(uuid.uuid4()), "category_id": "cat_flags", "difficulty": 200, "text": "علم أي دولة هذا؟", "answer": "ألمانيا", "image_url": "https://flagcdn.com/w320/de.png", "answer_image_url": "", "question_type": "text", "created_at": datetime.now(timezone.utc).isoformat()},
        {"id": str(uuid.uuid4()), "category_id": "cat_flags", "difficulty": 200, "text": "علم أي دولة هذا؟", "answer": "إيطاليا", "image_url": "https://flagcdn.com/w320/it.png", "answer_image_url": "", "question_type": "text", "created_at": datetime.now(timezone.utc).isoformat()},
        {"id": str(uuid.uuid4()), "category_id": "cat_flags", "difficulty": 200, "text": "علم أي دولة هذا؟", "answer": "كندا", "image_url": "https://flagcdn.com/w320/ca.png", "answer_image_url": "", "question_type": "text", "created_at": datetime.now(timezone.utc).isoformat()},
        # 400 - Medium flags
        {"id": str(uuid.uuid4()), "category_id": "cat_flags", "difficulty": 400, "text": "علم أي دولة هذا؟", "answer": "البرازيل", "image_url": "https://flagcdn.com/w320/br.png", "answer_image_url": "", "question_type": "text", "created_at": datetime.now(timezone.utc).isoformat()},
        {"id": str(uuid.uuid4()), "category_id": "cat_flags", "difficulty": 400, "text": "علم أي دولة هذا؟", "answer": "تركيا", "image_url": "https://flagcdn.com/w320/tr.png", "answer_image_url": "", "question_type": "text", "created_at": datetime.now(timezone.utc).isoformat()},
        {"id": str(uuid.uuid4()), "category_id": "cat_flags", "difficulty": 400, "text": "علم أي دولة هذا؟", "answer": "أستراليا", "image_url": "https://flagcdn.com/w320/au.png", "answer_image_url": "", "question_type": "text", "created_at": datetime.now(timezone.utc).isoformat()},
        {"id": str(uuid.uuid4()), "category_id": "cat_flags", "difficulty": 400, "text": "علم أي دولة هذا؟", "answer": "كوريا الجنوبية", "image_url": "https://flagcdn.com/w320/kr.png", "answer_image_url": "", "question_type": "text", "created_at": datetime.now(timezone.utc).isoformat()},
        {"id": str(uuid.uuid4()), "category_id": "cat_flags", "difficulty": 400, "text": "علم أي دولة هذا؟", "answer": "الأردن", "image_url": "https://flagcdn.com/w320/jo.png", "answer_image_url": "", "question_type": "text", "created_at": datetime.now(timezone.utc).isoformat()},
        {"id": str(uuid.uuid4()), "category_id": "cat_flags", "difficulty": 400, "text": "علم أي دولة هذا؟", "answer": "قطر", "image_url": "https://flagcdn.com/w320/qa.png", "answer_image_url": "", "question_type": "text", "created_at": datetime.now(timezone.utc).isoformat()},
        {"id": str(uuid.uuid4()), "category_id": "cat_flags", "difficulty": 400, "text": "علم أي دولة هذا؟", "answer": "المكسيك", "image_url": "https://flagcdn.com/w320/mx.png", "answer_image_url": "", "question_type": "text", "created_at": datetime.now(timezone.utc).isoformat()},
        {"id": str(uuid.uuid4()), "category_id": "cat_flags", "difficulty": 400, "text": "علم أي دولة هذا؟", "answer": "الهند", "image_url": "https://flagcdn.com/w320/in.png", "answer_image_url": "", "question_type": "text", "created_at": datetime.now(timezone.utc).isoformat()},
        {"id": str(uuid.uuid4()), "category_id": "cat_flags", "difficulty": 400, "text": "علم أي دولة هذا؟", "answer": "إسبانيا", "image_url": "https://flagcdn.com/w320/es.png", "answer_image_url": "", "question_type": "text", "created_at": datetime.now(timezone.utc).isoformat()},
        {"id": str(uuid.uuid4()), "category_id": "cat_flags", "difficulty": 400, "text": "علم أي دولة هذا؟", "answer": "هولندا", "image_url": "https://flagcdn.com/w320/nl.png", "answer_image_url": "", "question_type": "text", "created_at": datetime.now(timezone.utc).isoformat()},
        # 600 - Hard flags
        {"id": str(uuid.uuid4()), "category_id": "cat_flags", "difficulty": 600, "text": "علم أي دولة هذا؟", "answer": "البرتغال", "image_url": "https://flagcdn.com/w320/pt.png", "answer_image_url": "", "question_type": "text", "created_at": datetime.now(timezone.utc).isoformat()},
        {"id": str(uuid.uuid4()), "category_id": "cat_flags", "difficulty": 600, "text": "علم أي دولة هذا؟", "answer": "السويد", "image_url": "https://flagcdn.com/w320/se.png", "answer_image_url": "", "question_type": "text", "created_at": datetime.now(timezone.utc).isoformat()},
        {"id": str(uuid.uuid4()), "category_id": "cat_flags", "difficulty": 600, "text": "علم أي دولة هذا؟", "answer": "النرويج", "image_url": "https://flagcdn.com/w320/no.png", "answer_image_url": "", "question_type": "text", "created_at": datetime.now(timezone.utc).isoformat()},
        {"id": str(uuid.uuid4()), "category_id": "cat_flags", "difficulty": 600, "text": "علم أي دولة هذا؟", "answer": "بلجيكا", "image_url": "https://flagcdn.com/w320/be.png", "answer_image_url": "", "question_type": "text", "created_at": datetime.now(timezone.utc).isoformat()},
        {"id": str(uuid.uuid4()), "category_id": "cat_flags", "difficulty": 600, "text": "علم أي دولة هذا؟", "answer": "الأرجنتين", "image_url": "https://flagcdn.com/w320/ar.png", "answer_image_url": "", "question_type": "text", "created_at": datetime.now(timezone.utc).isoformat()},
        {"id": str(uuid.uuid4()), "category_id": "cat_flags", "difficulty": 600, "text": "علم أي دولة هذا؟", "answer": "فنلندا", "image_url": "https://flagcdn.com/w320/fi.png", "answer_image_url": "", "question_type": "text", "created_at": datetime.now(timezone.utc).isoformat()},
        {"id": str(uuid.uuid4()), "category_id": "cat_flags", "difficulty": 600, "text": "علم أي دولة هذا؟", "answer": "تشيلي", "image_url": "https://flagcdn.com/w320/cl.png", "answer_image_url": "", "question_type": "text", "created_at": datetime.now(timezone.utc).isoformat()},
        {"id": str(uuid.uuid4()), "category_id": "cat_flags", "difficulty": 600, "text": "علم أي دولة هذا؟", "answer": "باكستان", "image_url": "https://flagcdn.com/w320/pk.png", "answer_image_url": "", "question_type": "text", "created_at": datetime.now(timezone.utc).isoformat()},
        {"id": str(uuid.uuid4()), "category_id": "cat_flags", "difficulty": 600, "text": "علم أي دولة هذا؟", "answer": "إندونيسيا", "image_url": "https://flagcdn.com/w320/id.png", "answer_image_url": "", "question_type": "text", "created_at": datetime.now(timezone.utc).isoformat()},
        {"id": str(uuid.uuid4()), "category_id": "cat_flags", "difficulty": 600, "text": "علم أي دولة هذا؟", "answer": "سويسرا", "image_url": "https://flagcdn.com/w320/ch.png", "answer_image_url": "", "question_type": "text", "created_at": datetime.now(timezone.utc).isoformat()},

        # ─── معلومات سهلة ───
        # 200
        {"id": str(uuid.uuid4()), "category_id": "cat_easy", "difficulty": 200, "text": "كم يوم في الأسبوع؟", "answer": "7 أيام", "image_url": "", "answer_image_url": "", "question_type": "text", "created_at": datetime.now(timezone.utc).isoformat()},
        {"id": str(uuid.uuid4()), "category_id": "cat_easy", "difficulty": 200, "text": "كم شهر في السنة؟", "answer": "12 شهر", "image_url": "", "answer_image_url": "", "question_type": "text", "created_at": datetime.now(timezone.utc).isoformat()},
        {"id": str(uuid.uuid4()), "category_id": "cat_easy", "difficulty": 200, "text": "كم إصبع في اليدين معاً؟", "answer": "10 أصابع", "image_url": "", "answer_image_url": "", "question_type": "text", "created_at": datetime.now(timezone.utc).isoformat()},
        {"id": str(uuid.uuid4()), "category_id": "cat_easy", "difficulty": 200, "text": "ما هو لون السماء في النهار؟", "answer": "أزرق", "image_url": "", "answer_image_url": "", "question_type": "text", "created_at": datetime.now(timezone.utc).isoformat()},
        {"id": str(uuid.uuid4()), "category_id": "cat_easy", "difficulty": 200, "text": "كم ساعة في اليوم؟", "answer": "24 ساعة", "image_url": "", "answer_image_url": "", "question_type": "text", "created_at": datetime.now(timezone.utc).isoformat()},
        {"id": str(uuid.uuid4()), "category_id": "cat_easy", "difficulty": 200, "text": "ما هو الحيوان المعروف بالوفاء؟", "answer": "الكلب", "image_url": "", "answer_image_url": "", "question_type": "text", "created_at": datetime.now(timezone.utc).isoformat()},
        {"id": str(uuid.uuid4()), "category_id": "cat_easy", "difficulty": 200, "text": "أيهم أكبر: القمر أم الشمس؟", "answer": "الشمس", "image_url": "", "answer_image_url": "", "question_type": "text", "created_at": datetime.now(timezone.utc).isoformat()},
        {"id": str(uuid.uuid4()), "category_id": "cat_easy", "difficulty": 200, "text": "كم عدد أرجل الكرسي عادةً؟", "answer": "4 أرجل", "image_url": "", "answer_image_url": "", "question_type": "text", "created_at": datetime.now(timezone.utc).isoformat()},
        {"id": str(uuid.uuid4()), "category_id": "cat_easy", "difficulty": 200, "text": "ما هو لون الحليب؟", "answer": "أبيض", "image_url": "", "answer_image_url": "", "question_type": "text", "created_at": datetime.now(timezone.utc).isoformat()},
        {"id": str(uuid.uuid4()), "category_id": "cat_easy", "difficulty": 200, "text": "ما هو أسرع حيوان بري؟", "answer": "الفهد", "image_url": "", "answer_image_url": "", "question_type": "text", "created_at": datetime.now(timezone.utc).isoformat()},
        # 400
        {"id": str(uuid.uuid4()), "category_id": "cat_easy", "difficulty": 400, "text": "كم عدد كوكب المجموعة الشمسية؟", "answer": "8 كواكب", "image_url": "", "answer_image_url": "", "question_type": "text", "created_at": datetime.now(timezone.utc).isoformat()},
        {"id": str(uuid.uuid4()), "category_id": "cat_easy", "difficulty": 400, "text": "ما هي أكبر دولة في العالم مساحةً؟", "answer": "روسيا", "image_url": "", "answer_image_url": "", "question_type": "text", "created_at": datetime.now(timezone.utc).isoformat()},
        {"id": str(uuid.uuid4()), "category_id": "cat_easy", "difficulty": 400, "text": "كم عدد قارات العالم؟", "answer": "7 قارات", "image_url": "", "answer_image_url": "", "question_type": "text", "created_at": datetime.now(timezone.utc).isoformat()},
        {"id": str(uuid.uuid4()), "category_id": "cat_easy", "difficulty": 400, "text": "ما هو أطول نهر في العالم؟", "answer": "النيل", "image_url": "", "answer_image_url": "", "question_type": "text", "created_at": datetime.now(timezone.utc).isoformat()},
        {"id": str(uuid.uuid4()), "category_id": "cat_easy", "difficulty": 400, "text": "كم عدد حواس الإنسان؟", "answer": "5 حواس", "image_url": "", "answer_image_url": "", "question_type": "text", "created_at": datetime.now(timezone.utc).isoformat()},
        {"id": str(uuid.uuid4()), "category_id": "cat_easy", "difficulty": 400, "text": "ما هي عاصمة فرنسا؟", "answer": "باريس", "image_url": "", "answer_image_url": "", "question_type": "text", "created_at": datetime.now(timezone.utc).isoformat()},
        {"id": str(uuid.uuid4()), "category_id": "cat_easy", "difficulty": 400, "text": "ما هو أكبر محيط في العالم؟", "answer": "المحيط الهادئ", "image_url": "", "answer_image_url": "", "question_type": "text", "created_at": datetime.now(timezone.utc).isoformat()},
        {"id": str(uuid.uuid4()), "category_id": "cat_easy", "difficulty": 400, "text": "كم عظمة في جسم الإنسان البالغ؟", "answer": "206 عظمة", "image_url": "", "answer_image_url": "", "question_type": "text", "created_at": datetime.now(timezone.utc).isoformat()},
        {"id": str(uuid.uuid4()), "category_id": "cat_easy", "difficulty": 400, "text": "ما هو الجهاز الذي يضخ الدم في جسم الإنسان؟", "answer": "القلب", "image_url": "", "answer_image_url": "", "question_type": "text", "created_at": datetime.now(timezone.utc).isoformat()},
        {"id": str(uuid.uuid4()), "category_id": "cat_easy", "difficulty": 400, "text": "كم مرة تقريباً يدق قلب الإنسان في الدقيقة؟", "answer": "70 مرة", "image_url": "", "answer_image_url": "", "question_type": "text", "created_at": datetime.now(timezone.utc).isoformat()},
        # 600
        {"id": str(uuid.uuid4()), "category_id": "cat_easy", "difficulty": 600, "text": "ما هو أعمق بحر في العالم؟", "answer": "البحر الأبيض المتوسط (أعمق منطقة في المحيط الهادئ - حفرة ماريانا)", "image_url": "", "answer_image_url": "", "question_type": "text", "created_at": datetime.now(timezone.utc).isoformat()},
        {"id": str(uuid.uuid4()), "category_id": "cat_easy", "difficulty": 600, "text": "كم تبلغ سرعة الضوء تقريباً؟", "answer": "300,000 كيلومتر في الثانية", "image_url": "", "answer_image_url": "", "question_type": "text", "created_at": datetime.now(timezone.utc).isoformat()},
        {"id": str(uuid.uuid4()), "category_id": "cat_easy", "difficulty": 600, "text": "ما هو العنصر الأكثر وفرة في الغلاف الجوي؟", "answer": "النيتروجين", "image_url": "", "answer_image_url": "", "question_type": "text", "created_at": datetime.now(timezone.utc).isoformat()},
        {"id": str(uuid.uuid4()), "category_id": "cat_easy", "difficulty": 600, "text": "كم ضلعاً للمسدس؟", "answer": "6 أضلاع", "image_url": "", "answer_image_url": "", "question_type": "text", "created_at": datetime.now(timezone.utc).isoformat()},
        {"id": str(uuid.uuid4()), "category_id": "cat_easy", "difficulty": 600, "text": "ما هو أثقل المعادن الطبيعية؟", "answer": "الأوزميوم", "image_url": "", "answer_image_url": "", "question_type": "text", "created_at": datetime.now(timezone.utc).isoformat()},
        {"id": str(uuid.uuid4()), "category_id": "cat_easy", "difficulty": 600, "text": "كم عدد الكروموسومات في جسم الإنسان السليم؟", "answer": "46 كروموسوم", "image_url": "", "answer_image_url": "", "question_type": "text", "created_at": datetime.now(timezone.utc).isoformat()},
        {"id": str(uuid.uuid4()), "category_id": "cat_easy", "difficulty": 600, "text": "ما هو الجهاز العصبي الذي يتحكم في الوظائف اللاإرادية؟", "answer": "الجهاز العصبي اللاإرادي", "image_url": "", "answer_image_url": "", "question_type": "text", "created_at": datetime.now(timezone.utc).isoformat()},
        {"id": str(uuid.uuid4()), "category_id": "cat_easy", "difficulty": 600, "text": "ما هو أبرد كوكب في المجموعة الشمسية؟", "answer": "أورانوس", "image_url": "", "answer_image_url": "", "question_type": "text", "created_at": datetime.now(timezone.utc).isoformat()},
        {"id": str(uuid.uuid4()), "category_id": "cat_easy", "difficulty": 600, "text": "كم سنة تعيش السلحفاة تقريباً؟", "answer": "150 سنة", "image_url": "", "answer_image_url": "", "question_type": "text", "created_at": datetime.now(timezone.utc).isoformat()},
        {"id": str(uuid.uuid4()), "category_id": "cat_easy", "difficulty": 600, "text": "ما هو اسم العلم الذي يدرس الفضاء؟", "answer": "علم الفلك", "image_url": "", "answer_image_url": "", "question_type": "text", "created_at": datetime.now(timezone.utc).isoformat()},

        # ─── السعودية ───
        # 200
        {"id": str(uuid.uuid4()), "category_id": "cat_saudi", "difficulty": 200, "text": "وش عاصمة السعودية؟", "answer": "الرياض", "image_url": "", "answer_image_url": "", "question_type": "text", "created_at": datetime.now(timezone.utc).isoformat()},
        {"id": str(uuid.uuid4()), "category_id": "cat_saudi", "difficulty": 200, "text": "وش اسم أكبر مسجد في العالم الموجود بالسعودية؟", "answer": "المسجد الحرام", "image_url": "", "answer_image_url": "", "question_type": "text", "created_at": datetime.now(timezone.utc).isoformat()},
        {"id": str(uuid.uuid4()), "category_id": "cat_saudi", "difficulty": 200, "text": "ما هي لغة السعوديين الرسمية؟", "answer": "العربية", "image_url": "", "answer_image_url": "", "question_type": "text", "created_at": datetime.now(timezone.utc).isoformat()},
        {"id": str(uuid.uuid4()), "category_id": "cat_saudi", "difficulty": 200, "text": "في أي قارة تقع المملكة العربية السعودية؟", "answer": "آسيا", "image_url": "", "answer_image_url": "", "question_type": "text", "created_at": datetime.now(timezone.utc).isoformat()},
        {"id": str(uuid.uuid4()), "category_id": "cat_saudi", "difficulty": 200, "text": "ما هي عملة المملكة العربية السعودية؟", "answer": "الريال السعودي", "image_url": "", "answer_image_url": "", "question_type": "text", "created_at": datetime.now(timezone.utc).isoformat()},
        {"id": str(uuid.uuid4()), "category_id": "cat_saudi", "difficulty": 200, "text": "وش اسم ثاني أكبر مدينة في السعودية؟", "answer": "جدة", "image_url": "", "answer_image_url": "", "question_type": "text", "created_at": datetime.now(timezone.utc).isoformat()},
        {"id": str(uuid.uuid4()), "category_id": "cat_saudi", "difficulty": 200, "text": "ما هو اليوم الوطني السعودي؟", "answer": "23 سبتمبر", "image_url": "", "answer_image_url": "", "question_type": "text", "created_at": datetime.now(timezone.utc).isoformat()},
        {"id": str(uuid.uuid4()), "category_id": "cat_saudi", "difficulty": 200, "text": "وش اسم الملك المؤسس للمملكة العربية السعودية؟", "answer": "الملك عبدالعزيز", "image_url": "", "answer_image_url": "", "question_type": "text", "created_at": datetime.now(timezone.utc).isoformat()},
        {"id": str(uuid.uuid4()), "category_id": "cat_saudi", "difficulty": 200, "text": "ما هو المشروب الوطني غير الرسمي في السعودية؟", "answer": "القهوة العربية", "image_url": "", "answer_image_url": "", "question_type": "text", "created_at": datetime.now(timezone.utc).isoformat()},
        {"id": str(uuid.uuid4()), "category_id": "cat_saudi", "difficulty": 200, "text": "كم منطقة إدارية في المملكة العربية السعودية؟", "answer": "13 منطقة", "image_url": "", "answer_image_url": "", "question_type": "text", "created_at": datetime.now(timezone.utc).isoformat()},
        # 400
        {"id": str(uuid.uuid4()), "category_id": "cat_saudi", "difficulty": 400, "text": "في أي سنة تأسست المملكة العربية السعودية؟", "answer": "1932", "image_url": "", "answer_image_url": "", "question_type": "text", "created_at": datetime.now(timezone.utc).isoformat()},
        {"id": str(uuid.uuid4()), "category_id": "cat_saudi", "difficulty": 400, "text": "ما اسم أطول برج في السعودية؟", "answer": "برج المملكة", "image_url": "", "answer_image_url": "", "question_type": "text", "created_at": datetime.now(timezone.utc).isoformat()},
        {"id": str(uuid.uuid4()), "category_id": "cat_saudi", "difficulty": 400, "text": "ما هو اسم منطقة السعودية المشهورة بالورد الطائفي؟", "answer": "الطائف", "image_url": "", "answer_image_url": "", "question_type": "text", "created_at": datetime.now(timezone.utc).isoformat()},
        {"id": str(uuid.uuid4()), "category_id": "cat_saudi", "difficulty": 400, "text": "ما هي وجبة السعودية الوطنية الشهيرة؟", "answer": "الكبسة", "image_url": "", "answer_image_url": "", "question_type": "text", "created_at": datetime.now(timezone.utc).isoformat()},
        {"id": str(uuid.uuid4()), "category_id": "cat_saudi", "difficulty": 400, "text": "ما اسم أعلى جبل في المملكة العربية السعودية؟", "answer": "جبل السودة", "image_url": "", "answer_image_url": "", "question_type": "text", "created_at": datetime.now(timezone.utc).isoformat()},
        {"id": str(uuid.uuid4()), "category_id": "cat_saudi", "difficulty": 400, "text": "كم يبلغ عدد سكان المملكة تقريباً؟", "answer": "35 مليون", "image_url": "", "answer_image_url": "", "question_type": "text", "created_at": datetime.now(timezone.utc).isoformat()},
        {"id": str(uuid.uuid4()), "category_id": "cat_saudi", "difficulty": 400, "text": "ما هو اسم الموقع الأثري السعودي المدرج في اليونسكو؟", "answer": "العُلا (مدائن صالح)", "image_url": "", "answer_image_url": "", "question_type": "text", "created_at": datetime.now(timezone.utc).isoformat()},
        {"id": str(uuid.uuid4()), "category_id": "cat_saudi", "difficulty": 400, "text": "ما هو اسم مشروع المدينة المستقبلية السعودية؟", "answer": "نيوم", "image_url": "", "answer_image_url": "", "question_type": "text", "created_at": datetime.now(timezone.utc).isoformat()},
        {"id": str(uuid.uuid4()), "category_id": "cat_saudi", "difficulty": 400, "text": "ما هو اسم شركة النفط السعودية العملاقة؟", "answer": "أرامكو", "image_url": "", "answer_image_url": "", "question_type": "text", "created_at": datetime.now(timezone.utc).isoformat()},
        {"id": str(uuid.uuid4()), "category_id": "cat_saudi", "difficulty": 400, "text": "ما اسم الممر المائي الذي تطل عليه جدة؟", "answer": "البحر الأحمر", "image_url": "", "answer_image_url": "", "question_type": "text", "created_at": datetime.now(timezone.utc).isoformat()},
        # 600
        {"id": str(uuid.uuid4()), "category_id": "cat_saudi", "difficulty": 600, "text": "في أي سنة اكتُشف النفط في السعودية؟", "answer": "1938", "image_url": "", "answer_image_url": "", "question_type": "text", "created_at": datetime.now(timezone.utc).isoformat()},
        {"id": str(uuid.uuid4()), "category_id": "cat_saudi", "difficulty": 600, "text": "ما هي المدينة السعودية التي تضم أقدم ميناء؟", "answer": "جدة", "image_url": "", "answer_image_url": "", "question_type": "text", "created_at": datetime.now(timezone.utc).isoformat()},
        {"id": str(uuid.uuid4()), "category_id": "cat_saudi", "difficulty": 600, "text": "كم يبلغ طول الحد البري السعودي تقريباً؟", "answer": "4431 كيلومتر", "image_url": "", "answer_image_url": "", "question_type": "text", "created_at": datetime.now(timezone.utc).isoformat()},
        {"id": str(uuid.uuid4()), "category_id": "cat_saudi", "difficulty": 600, "text": "ما هو المركز المالي السعودي في رؤية 2030؟", "answer": "الرياض مركز للمال والأعمال العالمي", "image_url": "", "answer_image_url": "", "question_type": "text", "created_at": datetime.now(timezone.utc).isoformat()},
        {"id": str(uuid.uuid4()), "category_id": "cat_saudi", "difficulty": 600, "text": "كم عدد محافظات منطقة مكة المكرمة؟", "answer": "10 محافظات", "image_url": "", "answer_image_url": "", "question_type": "text", "created_at": datetime.now(timezone.utc).isoformat()},
        {"id": str(uuid.uuid4()), "category_id": "cat_saudi", "difficulty": 600, "text": "ما هو اسم صحراء الربع الخالي بالإنجليزية؟", "answer": "Empty Quarter", "image_url": "", "answer_image_url": "", "question_type": "text", "created_at": datetime.now(timezone.utc).isoformat()},
        {"id": str(uuid.uuid4()), "category_id": "cat_saudi", "difficulty": 600, "text": "ما اسم أول جامعة أُسست في المملكة العربية السعودية؟", "answer": "جامعة الملك سعود", "image_url": "", "answer_image_url": "", "question_type": "text", "created_at": datetime.now(timezone.utc).isoformat()},
        {"id": str(uuid.uuid4()), "category_id": "cat_saudi", "difficulty": 600, "text": "كم تبلغ مساحة المملكة تقريباً؟", "answer": "2.15 مليون كيلومتر مربع", "image_url": "", "answer_image_url": "", "question_type": "text", "created_at": datetime.now(timezone.utc).isoformat()},
        {"id": str(uuid.uuid4()), "category_id": "cat_saudi", "difficulty": 600, "text": "ما هو اسم منطقة التوسعة السعودية الجديدة في البحر الأحمر؟", "answer": "مشروع البحر الأحمر (NEOM)", "image_url": "", "answer_image_url": "", "question_type": "text", "created_at": datetime.now(timezone.utc).isoformat()},
        {"id": str(uuid.uuid4()), "category_id": "cat_saudi", "difficulty": 600, "text": "ما هو اسم المبادرة السعودية الخضراء لزراعة الأشجار؟", "answer": "السعودية الخضراء", "image_url": "", "answer_image_url": "", "question_type": "text", "created_at": datetime.now(timezone.utc).isoformat()},

        # ─── اسلامي ───
        # 200
        {"id": str(uuid.uuid4()), "category_id": "cat_islamic", "difficulty": 200, "text": "كم عدد أركان الإسلام؟", "answer": "5 أركان", "image_url": "", "answer_image_url": "", "question_type": "text", "created_at": datetime.now(timezone.utc).isoformat()},
        {"id": str(uuid.uuid4()), "category_id": "cat_islamic", "difficulty": 200, "text": "ما هي أول سورة في القرآن الكريم؟", "answer": "سورة الفاتحة", "image_url": "", "answer_image_url": "", "question_type": "text", "created_at": datetime.now(timezone.utc).isoformat()},
        {"id": str(uuid.uuid4()), "category_id": "cat_islamic", "difficulty": 200, "text": "كم عدد سور القرآن الكريم؟", "answer": "114 سورة", "image_url": "", "answer_image_url": "", "question_type": "text", "created_at": datetime.now(timezone.utc).isoformat()},
        {"id": str(uuid.uuid4()), "category_id": "cat_islamic", "difficulty": 200, "text": "في أي شهر يصوم المسلمون؟", "answer": "رمضان", "image_url": "", "answer_image_url": "", "question_type": "text", "created_at": datetime.now(timezone.utc).isoformat()},
        {"id": str(uuid.uuid4()), "category_id": "cat_islamic", "difficulty": 200, "text": "كم عدد الصلوات اليومية؟", "answer": "5 صلوات", "image_url": "", "answer_image_url": "", "question_type": "text", "created_at": datetime.now(timezone.utc).isoformat()},
        {"id": str(uuid.uuid4()), "category_id": "cat_islamic", "difficulty": 200, "text": "إلى أي مكان يتجه المسلم أثناء الصلاة؟", "answer": "الكعبة المشرفة", "image_url": "", "answer_image_url": "", "question_type": "text", "created_at": datetime.now(timezone.utc).isoformat()},
        {"id": str(uuid.uuid4()), "category_id": "cat_islamic", "difficulty": 200, "text": "ما هو اسم الكتاب المقدس للمسلمين؟", "answer": "القرآن الكريم", "image_url": "", "answer_image_url": "", "question_type": "text", "created_at": datetime.now(timezone.utc).isoformat()},
        {"id": str(uuid.uuid4()), "category_id": "cat_islamic", "difficulty": 200, "text": "ما هو اليوم الذي يحتفل فيه المسلمون بنهاية رمضان؟", "answer": "عيد الفطر", "image_url": "", "answer_image_url": "", "question_type": "text", "created_at": datetime.now(timezone.utc).isoformat()},
        {"id": str(uuid.uuid4()), "category_id": "cat_islamic", "difficulty": 200, "text": "في أي مدينة وُلد النبي محمد صلى الله عليه وسلم؟", "answer": "مكة المكرمة", "image_url": "", "answer_image_url": "", "question_type": "text", "created_at": datetime.now(timezone.utc).isoformat()},
        {"id": str(uuid.uuid4()), "category_id": "cat_islamic", "difficulty": 200, "text": "ما هو اسم أذان الفجر الخاص؟", "answer": "الصلاة خير من النوم", "image_url": "", "answer_image_url": "", "question_type": "text", "created_at": datetime.now(timezone.utc).isoformat()},
        # 400
        {"id": str(uuid.uuid4()), "category_id": "cat_islamic", "difficulty": 400, "text": "كم عدد أنبياء الإسلام المذكورين في القرآن؟", "answer": "25 نبياً", "image_url": "", "answer_image_url": "", "question_type": "text", "created_at": datetime.now(timezone.utc).isoformat()},
        {"id": str(uuid.uuid4()), "category_id": "cat_islamic", "difficulty": 400, "text": "ما هي آخر سورة نزلت في القرآن الكريم؟", "answer": "سورة النصر", "image_url": "", "answer_image_url": "", "question_type": "text", "created_at": datetime.now(timezone.utc).isoformat()},
        {"id": str(uuid.uuid4()), "category_id": "cat_islamic", "difficulty": 400, "text": "كم عدد أجزاء القرآن الكريم؟", "answer": "30 جزءاً", "image_url": "", "answer_image_url": "", "question_type": "text", "created_at": datetime.now(timezone.utc).isoformat()},
        {"id": str(uuid.uuid4()), "category_id": "cat_islamic", "difficulty": 400, "text": "ما هو اليوم المقدس في الإسلام للجمعة؟", "answer": "يوم الجمعة", "image_url": "", "answer_image_url": "", "question_type": "text", "created_at": datetime.now(timezone.utc).isoformat()},
        {"id": str(uuid.uuid4()), "category_id": "cat_islamic", "difficulty": 400, "text": "ما هي نسبة الزكاة الواجبة على المال؟", "answer": "2.5%", "image_url": "", "answer_image_url": "", "question_type": "text", "created_at": datetime.now(timezone.utc).isoformat()},
        {"id": str(uuid.uuid4()), "category_id": "cat_islamic", "difficulty": 400, "text": "ما هو اسم ليلة القدر في القرآن؟", "answer": "ليلة القدر - خير من ألف شهر", "image_url": "", "answer_image_url": "", "question_type": "text", "created_at": datetime.now(timezone.utc).isoformat()},
        {"id": str(uuid.uuid4()), "category_id": "cat_islamic", "difficulty": 400, "text": "ما عدد ركعات صلاة المغرب؟", "answer": "3 ركعات", "image_url": "", "answer_image_url": "", "question_type": "text", "created_at": datetime.now(timezone.utc).isoformat()},
        {"id": str(uuid.uuid4()), "category_id": "cat_islamic", "difficulty": 400, "text": "ما هي المدينة التي هاجر إليها النبي من مكة؟", "answer": "المدينة المنورة", "image_url": "", "answer_image_url": "", "question_type": "text", "created_at": datetime.now(timezone.utc).isoformat()},
        {"id": str(uuid.uuid4()), "category_id": "cat_islamic", "difficulty": 400, "text": "كم عدد آيات سورة البقرة؟", "answer": "286 آية", "image_url": "", "answer_image_url": "", "question_type": "text", "created_at": datetime.now(timezone.utc).isoformat()},
        {"id": str(uuid.uuid4()), "category_id": "cat_islamic", "difficulty": 400, "text": "ما هو اسم أول مسجد بني في الإسلام؟", "answer": "مسجد قباء", "image_url": "", "answer_image_url": "", "question_type": "text", "created_at": datetime.now(timezone.utc).isoformat()},
        # 600
        {"id": str(uuid.uuid4()), "category_id": "cat_islamic", "difficulty": 600, "text": "ما هي أطول سورة في القرآن الكريم؟", "answer": "سورة البقرة", "image_url": "", "answer_image_url": "", "question_type": "text", "created_at": datetime.now(timezone.utc).isoformat()},
        {"id": str(uuid.uuid4()), "category_id": "cat_islamic", "difficulty": 600, "text": "كم عدد الآيات الكريمة في القرآن؟", "answer": "6236 آية", "image_url": "", "answer_image_url": "", "question_type": "text", "created_at": datetime.now(timezone.utc).isoformat()},
        {"id": str(uuid.uuid4()), "category_id": "cat_islamic", "difficulty": 600, "text": "في أي سنة هجرية وُلد النبي محمد؟", "answer": "عام الفيل (قبل الهجرة بـ 53 سنة)", "image_url": "", "answer_image_url": "", "question_type": "text", "created_at": datetime.now(timezone.utc).isoformat()},
        {"id": str(uuid.uuid4()), "category_id": "cat_islamic", "difficulty": 600, "text": "ما هو اسم والد النبي إبراهيم؟", "answer": "آزر", "image_url": "", "answer_image_url": "", "question_type": "text", "created_at": datetime.now(timezone.utc).isoformat()},
        {"id": str(uuid.uuid4()), "category_id": "cat_islamic", "difficulty": 600, "text": "في كم سنة أُنزل القرآن الكريم؟", "answer": "23 سنة", "image_url": "", "answer_image_url": "", "question_type": "text", "created_at": datetime.now(timezone.utc).isoformat()},
        {"id": str(uuid.uuid4()), "category_id": "cat_islamic", "difficulty": 600, "text": "ما هو اسم الصحابي الذي جمع القرآن في مصحف؟", "answer": "سيدنا أبو بكر الصديق (بأمره) وزيد بن ثابت (الكاتب)", "image_url": "", "answer_image_url": "", "question_type": "text", "created_at": datetime.now(timezone.utc).isoformat()},
        {"id": str(uuid.uuid4()), "category_id": "cat_islamic", "difficulty": 600, "text": "كم غزوة شارك فيها النبي محمد شخصياً؟", "answer": "27 غزوة", "image_url": "", "answer_image_url": "", "question_type": "text", "created_at": datetime.now(timezone.utc).isoformat()},
        {"id": str(uuid.uuid4()), "category_id": "cat_islamic", "difficulty": 600, "text": "ما هو اسم أم المؤمنين التي كانت أولى زوجات النبي؟", "answer": "السيدة خديجة", "image_url": "", "answer_image_url": "", "question_type": "text", "created_at": datetime.now(timezone.utc).isoformat()},
        {"id": str(uuid.uuid4()), "category_id": "cat_islamic", "difficulty": 600, "text": "ما هو عدد كلمات القرآن الكريم تقريباً؟", "answer": "77,430 كلمة", "image_url": "", "answer_image_url": "", "question_type": "text", "created_at": datetime.now(timezone.utc).isoformat()},
        {"id": str(uuid.uuid4()), "category_id": "cat_islamic", "difficulty": 600, "text": "ما هو اسم الملك الموكل بالوحي؟", "answer": "جبريل عليه السلام", "image_url": "", "answer_image_url": "", "question_type": "text", "created_at": datetime.now(timezone.utc).isoformat()},

        # ─── علوم بسيطة ───
        # 200
        {"id": str(uuid.uuid4()), "category_id": "cat_science", "difficulty": 200, "text": "ما هو الغاز الذي نتنفسه؟", "answer": "الأكسجين", "image_url": "", "answer_image_url": "", "question_type": "text", "created_at": datetime.now(timezone.utc).isoformat()},
        {"id": str(uuid.uuid4()), "category_id": "cat_science", "difficulty": 200, "text": "كم عدد كواكب المجموعة الشمسية؟", "answer": "8 كواكب", "image_url": "", "answer_image_url": "", "question_type": "text", "created_at": datetime.now(timezone.utc).isoformat()},
        {"id": str(uuid.uuid4()), "category_id": "cat_science", "difficulty": 200, "text": "ما هو أكبر كوكب في المجموعة الشمسية؟", "answer": "المشتري", "image_url": "", "answer_image_url": "", "question_type": "text", "created_at": datetime.now(timezone.utc).isoformat()},
        {"id": str(uuid.uuid4()), "category_id": "cat_science", "difficulty": 200, "text": "من أين تأتي الطاقة للنباتات؟", "answer": "الشمس (الضوء)", "image_url": "", "answer_image_url": "", "question_type": "text", "created_at": datetime.now(timezone.utc).isoformat()},
        {"id": str(uuid.uuid4()), "category_id": "cat_science", "difficulty": 200, "text": "ما هو الكوكب الأقرب للشمس؟", "answer": "عطارد", "image_url": "", "answer_image_url": "", "question_type": "text", "created_at": datetime.now(timezone.utc).isoformat()},
        {"id": str(uuid.uuid4()), "category_id": "cat_science", "difficulty": 200, "text": "ما هو الكوكب المعروف بالكوكب الأحمر؟", "answer": "المريخ", "image_url": "", "answer_image_url": "", "question_type": "text", "created_at": datetime.now(timezone.utc).isoformat()},
        {"id": str(uuid.uuid4()), "category_id": "cat_science", "difficulty": 200, "text": "ما هو المكوّن الرئيسي للماء؟", "answer": "هيدروجين وأكسجين (H2O)", "image_url": "", "answer_image_url": "", "question_type": "text", "created_at": datetime.now(timezone.utc).isoformat()},
        {"id": str(uuid.uuid4()), "category_id": "cat_science", "difficulty": 200, "text": "ما هو الجهاز المسؤول عن الهضم في جسم الإنسان؟", "answer": "الجهاز الهضمي", "image_url": "", "answer_image_url": "", "question_type": "text", "created_at": datetime.now(timezone.utc).isoformat()},
        {"id": str(uuid.uuid4()), "category_id": "cat_science", "difficulty": 200, "text": "ما هو أصغر كوكب في المجموعة الشمسية؟", "answer": "عطارد", "image_url": "", "answer_image_url": "", "question_type": "text", "created_at": datetime.now(timezone.utc).isoformat()},
        {"id": str(uuid.uuid4()), "category_id": "cat_science", "difficulty": 200, "text": "ما هو اسم قوة الجذب التي تبقينا على الأرض؟", "answer": "الجاذبية", "image_url": "", "answer_image_url": "", "question_type": "text", "created_at": datetime.now(timezone.utc).isoformat()},
        # 400
        {"id": str(uuid.uuid4()), "category_id": "cat_science", "difficulty": 400, "text": "كم درجة حرارة غليان الماء؟", "answer": "100 درجة مئوية", "image_url": "", "answer_image_url": "", "question_type": "text", "created_at": datetime.now(timezone.utc).isoformat()},
        {"id": str(uuid.uuid4()), "category_id": "cat_science", "difficulty": 400, "text": "ما هو الرمز الكيميائي للذهب؟", "answer": "Au", "image_url": "", "answer_image_url": "", "question_type": "text", "created_at": datetime.now(timezone.utc).isoformat()},
        {"id": str(uuid.uuid4()), "category_id": "cat_science", "difficulty": 400, "text": "كم وحدة في الجدول الدوري؟", "answer": "118 عنصر", "image_url": "", "answer_image_url": "", "question_type": "text", "created_at": datetime.now(timezone.utc).isoformat()},
        {"id": str(uuid.uuid4()), "category_id": "cat_science", "difficulty": 400, "text": "ما هو اسم العالم الذي اكتشف قانون الجاذبية؟", "answer": "إسحاق نيوتن", "image_url": "", "answer_image_url": "", "question_type": "text", "created_at": datetime.now(timezone.utc).isoformat()},
        {"id": str(uuid.uuid4()), "category_id": "cat_science", "difficulty": 400, "text": "ما هو اسم الخلية الأساسية في جسم الإنسان؟", "answer": "الخلية", "image_url": "", "answer_image_url": "", "question_type": "text", "created_at": datetime.now(timezone.utc).isoformat()},
        {"id": str(uuid.uuid4()), "category_id": "cat_science", "difficulty": 400, "text": "ما هي أسرع طيور العالم؟", "answer": "الصقر الحر (البريجون)", "image_url": "", "answer_image_url": "", "question_type": "text", "created_at": datetime.now(timezone.utc).isoformat()},
        {"id": str(uuid.uuid4()), "category_id": "cat_science", "difficulty": 400, "text": "ما هو الرمز الكيميائي للحديد؟", "answer": "Fe", "image_url": "", "answer_image_url": "", "question_type": "text", "created_at": datetime.now(timezone.utc).isoformat()},
        {"id": str(uuid.uuid4()), "category_id": "cat_science", "difficulty": 400, "text": "ما هو العضو الذي ينقي الدم في جسم الإنسان؟", "answer": "الكلية", "image_url": "", "answer_image_url": "", "question_type": "text", "created_at": datetime.now(timezone.utc).isoformat()},
        {"id": str(uuid.uuid4()), "category_id": "cat_science", "difficulty": 400, "text": "ما هو مصدر ضوء القمر؟", "answer": "انعكاس ضوء الشمس", "image_url": "", "answer_image_url": "", "question_type": "text", "created_at": datetime.now(timezone.utc).isoformat()},
        {"id": str(uuid.uuid4()), "category_id": "cat_science", "difficulty": 400, "text": "ما هو الكوكب المعروف بحلقاته الجميلة؟", "answer": "زحل", "image_url": "", "answer_image_url": "", "question_type": "text", "created_at": datetime.now(timezone.utc).isoformat()},
        # 600
        {"id": str(uuid.uuid4()), "category_id": "cat_science", "difficulty": 600, "text": "ما هو الرمز الكيميائي للصوديوم؟", "answer": "Na", "image_url": "", "answer_image_url": "", "question_type": "text", "created_at": datetime.now(timezone.utc).isoformat()},
        {"id": str(uuid.uuid4()), "category_id": "cat_science", "difficulty": 600, "text": "ما عدد أضلاع الجزيء الماء؟", "answer": "جزيء الماء H2O - لا أضلاع له، شكل زاوية", "image_url": "", "answer_image_url": "", "question_type": "text", "created_at": datetime.now(timezone.utc).isoformat()},
        {"id": str(uuid.uuid4()), "category_id": "cat_science", "difficulty": 600, "text": "ما هي وحدة قياس الضغط الجوي؟", "answer": "الباسكال أو الضغط الجوي القياسي (atm)", "image_url": "", "answer_image_url": "", "question_type": "text", "created_at": datetime.now(timezone.utc).isoformat()},
        {"id": str(uuid.uuid4()), "category_id": "cat_science", "difficulty": 600, "text": "من هو العالم الذي اكتشف البنسلين؟", "answer": "ألكسندر فليمنج", "image_url": "", "answer_image_url": "", "question_type": "text", "created_at": datetime.now(timezone.utc).isoformat()},
        {"id": str(uuid.uuid4()), "category_id": "cat_science", "difficulty": 600, "text": "ما هو اسم الخلايا المسؤولة عن مناعة الجسم؟", "answer": "كريات الدم البيضاء", "image_url": "", "answer_image_url": "", "question_type": "text", "created_at": datetime.now(timezone.utc).isoformat()},
        {"id": str(uuid.uuid4()), "category_id": "cat_science", "difficulty": 600, "text": "ما هو العنصر الأكثر انتشاراً في القشرة الأرضية؟", "answer": "الأكسجين", "image_url": "", "answer_image_url": "", "question_type": "text", "created_at": datetime.now(timezone.utc).isoformat()},
        {"id": str(uuid.uuid4()), "category_id": "cat_science", "difficulty": 600, "text": "ما هي النظرية التي تصف نشأة الكون؟", "answer": "نظرية الانفجار العظيم (Big Bang)", "image_url": "", "answer_image_url": "", "question_type": "text", "created_at": datetime.now(timezone.utc).isoformat()},
        {"id": str(uuid.uuid4()), "category_id": "cat_science", "difficulty": 600, "text": "ما هو الرمز الكيميائي للكربون؟", "answer": "C", "image_url": "", "answer_image_url": "", "question_type": "text", "created_at": datetime.now(timezone.utc).isoformat()},
        {"id": str(uuid.uuid4()), "category_id": "cat_science", "difficulty": 600, "text": "ما هي وحدة قياس القوة في النظام الدولي؟", "answer": "النيوتن (N)", "image_url": "", "answer_image_url": "", "question_type": "text", "created_at": datetime.now(timezone.utc).isoformat()},
        {"id": str(uuid.uuid4()), "category_id": "cat_science", "difficulty": 600, "text": "ما عدد أسنان الإنسان البالغ الكاملة؟", "answer": "32 سنة", "image_url": "", "answer_image_url": "", "question_type": "text", "created_at": datetime.now(timezone.utc).isoformat()},

        # ─── شعارات ───
        # 200
        {"id": str(uuid.uuid4()), "category_id": "cat_logos", "difficulty": 200, "text": "شعار أي شركة هذا؟ (تفاحة ناقصة عضة)", "answer": "أبل (Apple)", "image_url": "", "answer_image_url": "", "question_type": "text", "created_at": datetime.now(timezone.utc).isoformat()},
        {"id": str(uuid.uuid4()), "category_id": "cat_logos", "difficulty": 200, "text": "شعار أي شركة هذا؟ (حرف M أصفر على أحمر)", "answer": "ماكدونالدز", "image_url": "", "answer_image_url": "", "question_type": "text", "created_at": datetime.now(timezone.utc).isoformat()},
        {"id": str(uuid.uuid4()), "category_id": "cat_logos", "difficulty": 200, "text": "شعار أي شركة هذا؟ (علامة صح بيضاء)", "answer": "نايكي (Nike)", "image_url": "", "answer_image_url": "", "question_type": "text", "created_at": datetime.now(timezone.utc).isoformat()},
        {"id": str(uuid.uuid4()), "category_id": "cat_logos", "difficulty": 200, "text": "شعار أي شركة هذا؟ (حورية البحر الخضراء)", "answer": "ستاربكس", "image_url": "", "answer_image_url": "", "question_type": "text", "created_at": datetime.now(timezone.utc).isoformat()},
        {"id": str(uuid.uuid4()), "category_id": "cat_logos", "difficulty": 200, "text": "شعار أي شركة هذا؟ (حرف G ملون)", "answer": "جوجل", "image_url": "", "answer_image_url": "", "question_type": "text", "created_at": datetime.now(timezone.utc).isoformat()},
        {"id": str(uuid.uuid4()), "category_id": "cat_logos", "difficulty": 200, "text": "شعار أي شركة هذا؟ (حروف fb)", "answer": "فيسبوك / ميتا", "image_url": "", "answer_image_url": "", "question_type": "text", "created_at": datetime.now(timezone.utc).isoformat()},
        {"id": str(uuid.uuid4()), "category_id": "cat_logos", "difficulty": 200, "text": "شعار أي شركة هذا؟ (طائر أزرق)", "answer": "تويتر (X)", "image_url": "", "answer_image_url": "", "question_type": "text", "created_at": datetime.now(timezone.utc).isoformat()},
        {"id": str(uuid.uuid4()), "category_id": "cat_logos", "difficulty": 200, "text": "شعار أي شركة هذا؟ (أسهم متلوية حمراء)", "answer": "نتفليكس", "image_url": "", "answer_image_url": "", "question_type": "text", "created_at": datetime.now(timezone.utc).isoformat()},
        {"id": str(uuid.uuid4()), "category_id": "cat_logos", "difficulty": 200, "text": "شعار أي شركة هذا؟ (حرف A وسهم ابتسامة)", "answer": "أمازون", "image_url": "", "answer_image_url": "", "question_type": "text", "created_at": datetime.now(timezone.utc).isoformat()},
        {"id": str(uuid.uuid4()), "category_id": "cat_logos", "difficulty": 200, "text": "شعار أي شركة هذا؟ (ثلاث خطوط متوازية)", "answer": "أديداس", "image_url": "", "answer_image_url": "", "question_type": "text", "created_at": datetime.now(timezone.utc).isoformat()},
        # 400
        {"id": str(uuid.uuid4()), "category_id": "cat_logos", "difficulty": 400, "text": "شعار أي شركة هذا؟ (حرف T أزرق وأبيض)", "answer": "تيك توك", "image_url": "", "answer_image_url": "", "question_type": "text", "created_at": datetime.now(timezone.utc).isoformat()},
        {"id": str(uuid.uuid4()), "category_id": "cat_logos", "difficulty": 400, "text": "شعار أي شركة هذا؟ (صواريخ وأجنحة زرقاء)", "answer": "تويتر الجديد (X)", "image_url": "", "answer_image_url": "", "question_type": "text", "created_at": datetime.now(timezone.utc).isoformat()},
        {"id": str(uuid.uuid4()), "category_id": "cat_logos", "difficulty": 400, "text": "شعار أي شركة هذا؟ (خمس حلقات ملونة)", "answer": "الأولمبياد", "image_url": "", "answer_image_url": "", "question_type": "text", "created_at": datetime.now(timezone.utc).isoformat()},
        {"id": str(uuid.uuid4()), "category_id": "cat_logos", "difficulty": 400, "text": "شعار أي شركة هذا؟ (نجمة ثلاثية الأطراف داخل دائرة)", "answer": "مرسيدس", "image_url": "", "answer_image_url": "", "question_type": "text", "created_at": datetime.now(timezone.utc).isoformat()},
        {"id": str(uuid.uuid4()), "category_id": "cat_logos", "difficulty": 400, "text": "شعار أي شركة هذا؟ (مولود يجلس)", "answer": "ميشلان (الدودة البيضاء)", "image_url": "", "answer_image_url": "", "question_type": "text", "created_at": datetime.now(timezone.utc).isoformat()},
        {"id": str(uuid.uuid4()), "category_id": "cat_logos", "difficulty": 400, "text": "شعار أي شركة سيارات هذا؟ (أربع حلقات متشابكة)", "answer": "أودي (Audi)", "image_url": "", "answer_image_url": "", "question_type": "text", "created_at": datetime.now(timezone.utc).isoformat()},
        {"id": str(uuid.uuid4()), "category_id": "cat_logos", "difficulty": 400, "text": "شعار أي شركة هذا؟ (بومة بيضاء)", "answer": "تريباجو أو دواء", "image_url": "", "answer_image_url": "", "question_type": "text", "created_at": datetime.now(timezone.utc).isoformat()},
        {"id": str(uuid.uuid4()), "category_id": "cat_logos", "difficulty": 400, "text": "شعار أي شركة هذا؟ (رجل يقفز في دائرة حمراء)", "answer": "كانون", "image_url": "", "answer_image_url": "", "question_type": "text", "created_at": datetime.now(timezone.utc).isoformat()},
        {"id": str(uuid.uuid4()), "category_id": "cat_logos", "difficulty": 400, "text": "شعار أي تطبيق هذا؟ (كاميرا ملونة على خلفية)", "answer": "إنستغرام", "image_url": "", "answer_image_url": "", "question_type": "text", "created_at": datetime.now(timezone.utc).isoformat()},
        {"id": str(uuid.uuid4()), "category_id": "cat_logos", "difficulty": 400, "text": "شعار أي شركة هذا؟ (سيف عربي أخضر)", "answer": "stc", "image_url": "", "answer_image_url": "", "question_type": "text", "created_at": datetime.now(timezone.utc).isoformat()},
        # 600
        {"id": str(uuid.uuid4()), "category_id": "cat_logos", "difficulty": 600, "text": "شعار أي شركة هذا؟ (حرف H داخل مربع أزرق)", "answer": "هيلتون للفنادق", "image_url": "", "answer_image_url": "", "question_type": "text", "created_at": datetime.now(timezone.utc).isoformat()},
        {"id": str(uuid.uuid4()), "category_id": "cat_logos", "difficulty": 600, "text": "شعار أي شركة هذا؟ (تمساح أخضر صغير)", "answer": "لاكوست (Lacoste)", "image_url": "", "answer_image_url": "", "question_type": "text", "created_at": datetime.now(timezone.utc).isoformat()},
        {"id": str(uuid.uuid4()), "category_id": "cat_logos", "difficulty": 600, "text": "شعار أي شركة هذا؟ (دب أبيض صغير)", "answer": "باندا (شركة أوقاف)", "image_url": "", "answer_image_url": "", "question_type": "text", "created_at": datetime.now(timezone.utc).isoformat()},
        {"id": str(uuid.uuid4()), "category_id": "cat_logos", "difficulty": 600, "text": "شعار أي شركة سيارات هذا؟ (فرس حر)", "answer": "فيراري", "image_url": "", "answer_image_url": "", "question_type": "text", "created_at": datetime.now(timezone.utc).isoformat()},
        {"id": str(uuid.uuid4()), "category_id": "cat_logos", "difficulty": 600, "text": "شعار أي شركة هذا؟ (حروف LV متداخلة)", "answer": "لويس فيتون", "image_url": "", "answer_image_url": "", "question_type": "text", "created_at": datetime.now(timezone.utc).isoformat()},
        {"id": str(uuid.uuid4()), "category_id": "cat_logos", "difficulty": 600, "text": "شعار أي شركة هذا؟ (مطرقة وشكل متماثل)", "answer": "ايكيا (IKEA)", "image_url": "", "answer_image_url": "", "question_type": "text", "created_at": datetime.now(timezone.utc).isoformat()},
        {"id": str(uuid.uuid4()), "category_id": "cat_logos", "difficulty": 600, "text": "شعار أي شركة هذا؟ (يد تمسك كرة أرضية)", "answer": "فيزا (Visa)", "image_url": "", "answer_image_url": "", "question_type": "text", "created_at": datetime.now(timezone.utc).isoformat()},
        {"id": str(uuid.uuid4()), "category_id": "cat_logos", "difficulty": 600, "text": "شعار أي شركة هذا؟ (نسر أبيض)", "answer": "تويوتا أو هوندا", "image_url": "", "answer_image_url": "", "question_type": "text", "created_at": datetime.now(timezone.utc).isoformat()},
        {"id": str(uuid.uuid4()), "category_id": "cat_logos", "difficulty": 600, "text": "شعار أي شركة هذا؟ (ثلاث خطوط متوازية زرقاء)", "answer": "سامسونج أو بيبسي", "image_url": "", "answer_image_url": "", "question_type": "text", "created_at": datetime.now(timezone.utc).isoformat()},
        {"id": str(uuid.uuid4()), "category_id": "cat_logos", "difficulty": 600, "text": "شعار أي شركة هذا؟ (نقطة صفراء)", "answer": "سناب شات (Snapchat)", "image_url": "", "answer_image_url": "", "question_type": "text", "created_at": datetime.now(timezone.utc).isoformat()},

        # ─── ولا كلمة ───
        # 200
        {"id": str(uuid.uuid4()), "category_id": "cat_word", "difficulty": 200, "text": "وصّف هذي الكلمة لفريقك بدون ما تقولها!", "answer": "بيت", "image_url": "", "answer_image_url": "", "question_type": "secret_word", "created_at": datetime.now(timezone.utc).isoformat()},
        {"id": str(uuid.uuid4()), "category_id": "cat_word", "difficulty": 200, "text": "وصّف هذي الكلمة لفريقك بدون ما تقولها!", "answer": "سيارة", "image_url": "", "answer_image_url": "", "question_type": "secret_word", "created_at": datetime.now(timezone.utc).isoformat()},
        {"id": str(uuid.uuid4()), "category_id": "cat_word", "difficulty": 200, "text": "وصّف هذي الكلمة لفريقك بدون ما تقولها!", "answer": "شجرة", "image_url": "", "answer_image_url": "", "question_type": "secret_word", "created_at": datetime.now(timezone.utc).isoformat()},
        {"id": str(uuid.uuid4()), "category_id": "cat_word", "difficulty": 200, "text": "وصّف هذي الكلمة لفريقك بدون ما تقولها!", "answer": "ماء", "image_url": "", "answer_image_url": "", "question_type": "secret_word", "created_at": datetime.now(timezone.utc).isoformat()},
        {"id": str(uuid.uuid4()), "category_id": "cat_word", "difficulty": 200, "text": "وصّف هذي الكلمة لفريقك بدون ما تقولها!", "answer": "شمس", "image_url": "", "answer_image_url": "", "question_type": "secret_word", "created_at": datetime.now(timezone.utc).isoformat()},
        {"id": str(uuid.uuid4()), "category_id": "cat_word", "difficulty": 200, "text": "وصّف هذي الكلمة لفريقك بدون ما تقولها!", "answer": "طيارة", "image_url": "", "answer_image_url": "", "question_type": "secret_word", "created_at": datetime.now(timezone.utc).isoformat()},
        {"id": str(uuid.uuid4()), "category_id": "cat_word", "difficulty": 200, "text": "وصّف هذي الكلمة لفريقك بدون ما تقولها!", "answer": "كتاب", "image_url": "", "answer_image_url": "", "question_type": "secret_word", "created_at": datetime.now(timezone.utc).isoformat()},
        {"id": str(uuid.uuid4()), "category_id": "cat_word", "difficulty": 200, "text": "وصّف هذي الكلمة لفريقك بدون ما تقولها!", "answer": "قلم", "image_url": "", "answer_image_url": "", "question_type": "secret_word", "created_at": datetime.now(timezone.utc).isoformat()},
        {"id": str(uuid.uuid4()), "category_id": "cat_word", "difficulty": 200, "text": "وصّف هذي الكلمة لفريقك بدون ما تقولها!", "answer": "باب", "image_url": "", "answer_image_url": "", "question_type": "secret_word", "created_at": datetime.now(timezone.utc).isoformat()},
        {"id": str(uuid.uuid4()), "category_id": "cat_word", "difficulty": 200, "text": "وصّف هذي الكلمة لفريقك بدون ما تقولها!", "answer": "تلفون", "image_url": "", "answer_image_url": "", "question_type": "secret_word", "created_at": datetime.now(timezone.utc).isoformat()},
        # 400
        {"id": str(uuid.uuid4()), "category_id": "cat_word", "difficulty": 400, "text": "وصّف هذي الكلمة لفريقك بدون ما تقولها!", "answer": "مطار", "image_url": "", "answer_image_url": "", "question_type": "secret_word", "created_at": datetime.now(timezone.utc).isoformat()},
        {"id": str(uuid.uuid4()), "category_id": "cat_word", "difficulty": 400, "text": "وصّف هذي الكلمة لفريقك بدون ما تقولها!", "answer": "مسبح", "image_url": "", "answer_image_url": "", "question_type": "secret_word", "created_at": datetime.now(timezone.utc).isoformat()},
        {"id": str(uuid.uuid4()), "category_id": "cat_word", "difficulty": 400, "text": "وصّف هذي الكلمة لفريقك بدون ما تقولها!", "answer": "برج إيفل", "image_url": "", "answer_image_url": "", "question_type": "secret_word", "created_at": datetime.now(timezone.utc).isoformat()},
        {"id": str(uuid.uuid4()), "category_id": "cat_word", "difficulty": 400, "text": "وصّف هذي الكلمة لفريقك بدون ما تقولها!", "answer": "دكتور", "image_url": "", "answer_image_url": "", "question_type": "secret_word", "created_at": datetime.now(timezone.utc).isoformat()},
        {"id": str(uuid.uuid4()), "category_id": "cat_word", "difficulty": 400, "text": "وصّف هذي الكلمة لفريقك بدون ما تقولها!", "answer": "ثلج", "image_url": "", "answer_image_url": "", "question_type": "secret_word", "created_at": datetime.now(timezone.utc).isoformat()},
        {"id": str(uuid.uuid4()), "category_id": "cat_word", "difficulty": 400, "text": "وصّف هذي الكلمة لفريقك بدون ما تقولها!", "answer": "تنين", "image_url": "", "answer_image_url": "", "question_type": "secret_word", "created_at": datetime.now(timezone.utc).isoformat()},
        {"id": str(uuid.uuid4()), "category_id": "cat_word", "difficulty": 400, "text": "وصّف هذي الكلمة لفريقك بدون ما تقولها!", "answer": "صحراء", "image_url": "", "answer_image_url": "", "question_type": "secret_word", "created_at": datetime.now(timezone.utc).isoformat()},
        {"id": str(uuid.uuid4()), "category_id": "cat_word", "difficulty": 400, "text": "وصّف هذي الكلمة لفريقك بدون ما تقولها!", "answer": "رياضة", "image_url": "", "answer_image_url": "", "question_type": "secret_word", "created_at": datetime.now(timezone.utc).isoformat()},
        {"id": str(uuid.uuid4()), "category_id": "cat_word", "difficulty": 400, "text": "وصّف هذي الكلمة لفريقك بدون ما تقولها!", "answer": "موسيقى", "image_url": "", "answer_image_url": "", "question_type": "secret_word", "created_at": datetime.now(timezone.utc).isoformat()},
        {"id": str(uuid.uuid4()), "category_id": "cat_word", "difficulty": 400, "text": "وصّف هذي الكلمة لفريقك بدون ما تقولها!", "answer": "مستشفى", "image_url": "", "answer_image_url": "", "question_type": "secret_word", "created_at": datetime.now(timezone.utc).isoformat()},
        # 600
        {"id": str(uuid.uuid4()), "category_id": "cat_word", "difficulty": 600, "text": "وصّف هذي الكلمة لفريقك بدون ما تقولها!", "answer": "برلمان", "image_url": "", "answer_image_url": "", "question_type": "secret_word", "created_at": datetime.now(timezone.utc).isoformat()},
        {"id": str(uuid.uuid4()), "category_id": "cat_word", "difficulty": 600, "text": "وصّف هذي الكلمة لفريقك بدون ما تقولها!", "answer": "جامعة", "image_url": "", "answer_image_url": "", "question_type": "secret_word", "created_at": datetime.now(timezone.utc).isoformat()},
        {"id": str(uuid.uuid4()), "category_id": "cat_word", "difficulty": 600, "text": "وصّف هذي الكلمة لفريقك بدون ما تقولها!", "answer": "فيلسوف", "image_url": "", "answer_image_url": "", "question_type": "secret_word", "created_at": datetime.now(timezone.utc).isoformat()},
        {"id": str(uuid.uuid4()), "category_id": "cat_word", "difficulty": 600, "text": "وصّف هذي الكلمة لفريقك بدون ما تقولها!", "answer": "انتخابات", "image_url": "", "answer_image_url": "", "question_type": "secret_word", "created_at": datetime.now(timezone.utc).isoformat()},
        {"id": str(uuid.uuid4()), "category_id": "cat_word", "difficulty": 600, "text": "وصّف هذي الكلمة لفريقك بدون ما تقولها!", "answer": "ميكروسكوب", "image_url": "", "answer_image_url": "", "question_type": "secret_word", "created_at": datetime.now(timezone.utc).isoformat()},
        {"id": str(uuid.uuid4()), "category_id": "cat_word", "difficulty": 600, "text": "وصّف هذي الكلمة لفريقك بدون ما تقولها!", "answer": "مستكشف", "image_url": "", "answer_image_url": "", "question_type": "secret_word", "created_at": datetime.now(timezone.utc).isoformat()},
        {"id": str(uuid.uuid4()), "category_id": "cat_word", "difficulty": 600, "text": "وصّف هذي الكلمة لفريقك بدون ما تقولها!", "answer": "اقتصاد", "image_url": "", "answer_image_url": "", "question_type": "secret_word", "created_at": datetime.now(timezone.utc).isoformat()},
        {"id": str(uuid.uuid4()), "category_id": "cat_word", "difficulty": 600, "text": "وصّف هذي الكلمة لفريقك بدون ما تقولها!", "answer": "تلسكوب", "image_url": "", "answer_image_url": "", "question_type": "secret_word", "created_at": datetime.now(timezone.utc).isoformat()},
        {"id": str(uuid.uuid4()), "category_id": "cat_word", "difficulty": 600, "text": "وصّف هذي الكلمة لفريقك بدون ما تقولها!", "answer": "محكمة", "image_url": "", "answer_image_url": "", "question_type": "secret_word", "created_at": datetime.now(timezone.utc).isoformat()},
        {"id": str(uuid.uuid4()), "category_id": "cat_word", "difficulty": 600, "text": "وصّف هذي الكلمة لفريقك بدون ما تقولها!", "answer": "دبلوماسي", "image_url": "", "answer_image_url": "", "question_type": "secret_word", "created_at": datetime.now(timezone.utc).isoformat()},
    ]

    await db.questions.insert_many(questions)
    return {"message": f"تم إضافة {len(categories)} فئة و {len(questions)} سؤال"}

# ─── Root ─────────────────────────────────────────────────────────────────────

@api_router.get("/")
async def root():
    return {"message": "Hujjah API - حُجّة"}

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
