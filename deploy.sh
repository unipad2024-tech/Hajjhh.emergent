#!/bin/bash
# ═══════════════════════════════════════════
#   نشر تطبيق حُجّة - سكريبت تلقائي
# ═══════════════════════════════════════════

set -e

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

echo ""
echo "╔══════════════════════════════════════╗"
echo "║     🎮 نشر تطبيق حُجّة              ║"
echo "╚══════════════════════════════════════╝"
echo ""

# ── الخطوة 1: تثبيت الأدوات ──────────────
echo -e "${YELLOW}[1/5] تثبيت الأدوات...${NC}"

if ! command -v railway &> /dev/null; then
    echo "  ← تثبيت Railway CLI..."
    npm install -g @railway/cli 2>/dev/null || curl -fsSL https://railway.app/install.sh | sh
fi

if ! command -v vercel &> /dev/null; then
    echo "  ← تثبيت Vercel CLI..."
    npm install -g vercel
fi

echo -e "${GREEN}  ✓ الأدوات جاهزة${NC}"
echo ""

# ── الخطوة 2: المتغيرات ──────────────────
echo -e "${YELLOW}[2/5] إدخال البيانات المطلوبة${NC}"
echo ""
echo "  ← احتاج رابط MongoDB Atlas"
echo "     (إذا ما عندك حساب: mongodb.com/atlas → Free Cluster)"
echo ""
read -p "  MONGO_URL: " MONGO_URL

if [ -z "$MONGO_URL" ]; then
    echo -e "${RED}  ✗ MONGO_URL مطلوب. أوقف.${NC}"
    exit 1
fi

read -p "  ADMIN_PASSWORD (اتركه فارغ للافتراضي hujjah2024): " ADMIN_PASSWORD
ADMIN_PASSWORD=${ADMIN_PASSWORD:-hujjah2024}

read -p "  GEMINI_API_KEY (AIzaSy...): " GEMINI_API_KEY

# JWT Secret تلقائي
JWT_SECRET=$(node -e "console.log(require('crypto').randomBytes(32).toString('hex'))" 2>/dev/null || cat /dev/urandom | tr -dc 'a-zA-Z0-9' | fold -w 64 | head -n 1)

echo ""
echo -e "${GREEN}  ✓ البيانات جاهزة${NC}"
echo ""

# ── الخطوة 3: نشر الباك اند على Railway ──
echo -e "${YELLOW}[3/5] تسجيل الدخول لـ Railway (سيفتح المتصفح)...${NC}"
railway login
echo ""

echo -e "${YELLOW}  ← رفع الباك اند...${NC}"
cd "$(dirname "$0")/backend"

railway init --name hujjah-backend 2>/dev/null || true

railway variables set \
    MONGO_URL="$MONGO_URL" \
    DB_NAME="hujjah_db" \
    JWT_SECRET="$JWT_SECRET" \
    ADMIN_PASSWORD="$ADMIN_PASSWORD" \
    CORS_ORIGINS="*" \
    STRIPE_API_KEY="sk_test_emergent" \
    GEMINI_API_KEY="$GEMINI_API_KEY"

railway up --detach
echo ""

# احصل على رابط الباك اند
echo -e "${YELLOW}  ← جاري الحصول على رابط الباك اند...${NC}"
sleep 5
BACKEND_URL=$(railway status --json 2>/dev/null | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('url',''))" 2>/dev/null || echo "")

if [ -z "$BACKEND_URL" ]; then
    echo ""
    echo -e "${YELLOW}  ← افتح railway.app وخذ رابط مشروعك ثم الصقه هنا:${NC}"
    read -p "  BACKEND_URL: " BACKEND_URL
fi

# أضف CORS للـ backend url الفعلي
railway variables set CORS_ORIGINS="*"

echo -e "${GREEN}  ✓ الباك اند: $BACKEND_URL${NC}"
echo ""

# ── الخطوة 4: نشر الفرونت اند على Vercel ─
echo -e "${YELLOW}[4/5] تسجيل الدخول لـ Vercel (سيفتح المتصفح)...${NC}"
cd "$(dirname "$0")/frontend"

# اكتب رابط الباك اند في .env مؤقتاً
echo "REACT_APP_BACKEND_URL=$BACKEND_URL" > .env.production

vercel --prod --yes \
    --env REACT_APP_BACKEND_URL="$BACKEND_URL" \
    --env WDS_SOCKET_PORT=443 \
    --env ENABLE_HEALTH_CHECK=false

echo ""

# ── الخطوة 5: ملخص ───────────────────────
echo ""
echo "╔══════════════════════════════════════════════╗"
echo "║   🎉 تم النشر بنجاح!                        ║"
echo "╠══════════════════════════════════════════════╣"
echo "║                                              ║"
printf "║  ✅ الباك اند:  %-30s║\n" "$BACKEND_URL"
echo "║  ✅ الفرونت:   انظر رابط Vercel أعلاه       ║"
echo "║                                              ║"
echo "║  🔐 كلمة مرور الأدمن: $ADMIN_PASSWORD       ║"
echo "║                                              ║"
echo "╚══════════════════════════════════════════════╝"
echo ""
echo "  للنشر مرة ثانية بعد التعديلات:"
echo "  cd backend && railway up"
echo "  cd frontend && vercel --prod"
echo ""
