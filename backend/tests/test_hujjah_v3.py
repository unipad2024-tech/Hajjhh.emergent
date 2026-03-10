"""
Backend tests for Hujjah Trivia - Iteration 3
Tests: Auth (register/login), Admin (login/users/analytics), Categories, Game flow
"""
import pytest
import requests
import os
import uuid

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test user credentials
TEST_EMAIL = f"test_{uuid.uuid4().hex[:8]}@test.com"
TEST_USERNAME = f"testuser_{uuid.uuid4().hex[:6]}"
TEST_PASSWORD = "test1234"
ADMIN_PASSWORD = "hujjah2024"


@pytest.fixture(scope="module")
def session():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


@pytest.fixture(scope="module")
def user_token(session):
    """Register a test user and return token"""
    resp = session.post(f"{BASE_URL}/api/auth/register", json={
        "email": TEST_EMAIL,
        "username": TEST_USERNAME,
        "password": TEST_PASSWORD
    })
    if resp.status_code == 200:
        return resp.json()["token"]
    pytest.skip(f"Registration failed: {resp.status_code} {resp.text}")


@pytest.fixture(scope="module")
def admin_token(session):
    """Get admin token"""
    resp = session.post(f"{BASE_URL}/api/admin/login", json={"password": ADMIN_PASSWORD})
    if resp.status_code == 200:
        return resp.json()["token"]
    pytest.skip(f"Admin login failed: {resp.status_code}")


# ── Auth Tests ─────────────────────────────────────────────────────────────────

class TestAuth:
    """User authentication endpoints"""

    def test_register_new_user(self, session):
        email = f"reg_{uuid.uuid4().hex[:8]}@test.com"
        resp = session.post(f"{BASE_URL}/api/auth/register", json={
            "email": email,
            "username": f"u_{uuid.uuid4().hex[:6]}",
            "password": "pass1234"
        })
        assert resp.status_code == 200
        data = resp.json()
        assert "token" in data
        assert "user" in data
        assert data["user"]["email"] == email
        assert "password_hash" not in data["user"]
        print("✓ Register new user")

    def test_register_duplicate_email(self, session, user_token):
        """Registering same email again should fail with 409"""
        resp = session.post(f"{BASE_URL}/api/auth/register", json={
            "email": TEST_EMAIL,
            "username": f"u2_{uuid.uuid4().hex[:6]}",
            "password": "pass1234"
        })
        assert resp.status_code == 409
        print("✓ Duplicate email rejected")

    def test_login_success(self, session):
        resp = session.post(f"{BASE_URL}/api/auth/login", json={
            "email": TEST_EMAIL,
            "password": TEST_PASSWORD
        })
        assert resp.status_code == 200
        data = resp.json()
        assert "token" in data
        assert "user" in data
        assert data["user"]["email"] == TEST_EMAIL
        print("✓ Login success")

    def test_login_wrong_password(self, session):
        resp = session.post(f"{BASE_URL}/api/auth/login", json={
            "email": TEST_EMAIL,
            "password": "wrongpass"
        })
        assert resp.status_code == 401
        print("✓ Wrong password rejected")

    def test_get_me(self, session, user_token):
        resp = session.get(f"{BASE_URL}/api/auth/me",
                           headers={"Authorization": f"Bearer {user_token}"})
        assert resp.status_code == 200
        data = resp.json()
        assert data["email"] == TEST_EMAIL
        print("✓ GET /auth/me works")

    def test_get_me_no_token(self, session):
        resp = session.get(f"{BASE_URL}/api/auth/me")
        assert resp.status_code == 401
        print("✓ GET /auth/me without token returns 401")


# ── Admin Auth ─────────────────────────────────────────────────────────────────

class TestAdminAuth:
    def test_admin_login_success(self, session):
        resp = session.post(f"{BASE_URL}/api/admin/login", json={"password": ADMIN_PASSWORD})
        assert resp.status_code == 200
        assert "token" in resp.json()
        print("✓ Admin login success")

    def test_admin_login_wrong(self, session):
        resp = session.post(f"{BASE_URL}/api/admin/login", json={"password": "wrong"})
        assert resp.status_code == 401
        print("✓ Admin wrong password rejected")

    def test_admin_verify(self, session, admin_token):
        resp = session.get(f"{BASE_URL}/api/admin/verify",
                           headers={"Authorization": f"Bearer {admin_token}"})
        assert resp.status_code == 200
        assert resp.json()["valid"] is True
        print("✓ Admin verify works")


# ── Admin Users ────────────────────────────────────────────────────────────────

class TestAdminUsers:
    def test_list_users(self, session, admin_token):
        resp = session.get(f"{BASE_URL}/api/admin/users",
                           headers={"Authorization": f"Bearer {admin_token}"})
        assert resp.status_code == 200
        data = resp.json()
        assert isinstance(data, list)
        print(f"✓ Admin list users: {len(data)} users")

    def test_list_users_no_auth(self, session):
        resp = session.get(f"{BASE_URL}/api/admin/users")
        assert resp.status_code == 401
        print("✓ Admin users requires auth")


# ── Admin Analytics ────────────────────────────────────────────────────────────

class TestAdminAnalytics:
    def test_analytics(self, session, admin_token):
        resp = session.get(f"{BASE_URL}/api/admin/analytics",
                           headers={"Authorization": f"Bearer {admin_token}"})
        assert resp.status_code == 200
        data = resp.json()
        assert "users" in data
        assert "questions" in data
        assert "sessions" in data
        assert "revenue" in data
        assert data["users"]["total"] >= 0
        assert data["questions"]["total"] >= 0
        print(f"✓ Analytics: {data['users']['total']} users, {data['questions']['total']} questions")


# ── Categories ─────────────────────────────────────────────────────────────────

class TestCategories:
    def test_get_categories(self, session):
        resp = session.get(f"{BASE_URL}/api/categories")
        assert resp.status_code == 200
        data = resp.json()
        assert isinstance(data, list)
        assert len(data) >= 10
        # Check no _id field
        for cat in data:
            assert "_id" not in cat
        print(f"✓ Get categories: {len(data)} categories")


# ── Subscription Plans ─────────────────────────────────────────────────────────

class TestSubscription:
    def test_get_plans(self, session):
        resp = session.get(f"{BASE_URL}/api/subscription/plans")
        assert resp.status_code == 200
        data = resp.json()
        assert isinstance(data, list)
        ids = [p["id"] for p in data]
        assert "monthly" in ids
        assert "annual" in ids
        print(f"✓ Get plans: {[p['id'] for p in data]}")

    def test_checkout_requires_auth(self, session):
        resp = session.post(f"{BASE_URL}/api/subscription/checkout", json={
            "plan_id": "monthly",
            "origin_url": "https://example.com"
        })
        assert resp.status_code == 401
        print("✓ Checkout requires auth")


# ── Game Session ───────────────────────────────────────────────────────────────

class TestGameSession:
    def test_create_session(self, session):
        resp = session.post(f"{BASE_URL}/api/game/session", json={
            "team1_name": "فريق ١",
            "team2_name": "فريق ٢"
        })
        assert resp.status_code == 200
        data = resp.json()
        assert "id" in data
        assert data["team1_name"] == "فريق ١"
        assert data["status"] == "setup"
        assert "_id" not in data
        print(f"✓ Create session: {data['id'][:8]}...")
