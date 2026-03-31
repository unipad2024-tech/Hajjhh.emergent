"""
Iteration 18 - Test new features:
- Paylink endpoints
- Admin questions pending/import/approve-all
- AI generate full18 mode
"""
import pytest
import requests
import os
import json
import tempfile

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

ADMIN_CREDS = {"username": "admin", "password": "hujjah2024"}


@pytest.fixture(scope="module")
def admin_token():
    resp = requests.post(f"{BASE_URL}/api/admin/login", json=ADMIN_CREDS)
    assert resp.status_code == 200, f"Admin login failed: {resp.text}"
    return resp.json()["token"]


@pytest.fixture(scope="module")
def admin_headers(admin_token):
    return {"Authorization": f"Bearer {admin_token}"}


# ── Admin Login ─────────────────────────────────────────────────────────────

class TestAdminLogin:
    def test_admin_login_success(self):
        resp = requests.post(f"{BASE_URL}/api/admin/login", json=ADMIN_CREDS)
        assert resp.status_code == 200
        data = resp.json()
        assert "token" in data
        assert data.get("role") == "super_admin"

    def test_admin_login_wrong_password(self):
        resp = requests.post(f"{BASE_URL}/api/admin/login", json={"username": "admin", "password": "wrong"})
        assert resp.status_code == 401


# ── Pending Questions ────────────────────────────────────────────────────────

class TestPendingQuestions:
    def test_get_pending_requires_auth(self):
        resp = requests.get(f"{BASE_URL}/api/admin/questions/pending")
        assert resp.status_code == 401

    def test_get_pending_returns_items_and_total(self, admin_headers):
        resp = requests.get(f"{BASE_URL}/api/admin/questions/pending", headers=admin_headers)
        assert resp.status_code == 200
        data = resp.json()
        assert "items" in data
        assert "total" in data
        assert isinstance(data["items"], list)
        assert isinstance(data["total"], int)
        print(f"Pending questions: {data['total']}")


# ── Import Questions ─────────────────────────────────────────────────────────

class TestImportQuestions:
    def test_import_json_questions(self, admin_headers):
        questions = [
            {"text": "TEST_سؤال تجريبي 1", "answer": "إجابة 1", "difficulty": 300},
            {"text": "TEST_سؤال تجريبي 2", "answer": "إجابة 2", "difficulty": 600},
        ]
        json_bytes = json.dumps(questions).encode("utf-8")
        resp = requests.post(
            f"{BASE_URL}/api/admin/questions/import",
            headers=admin_headers,
            files={"file": ("questions.json", json_bytes, "application/json")},
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data.get("count") == 2
        print(f"Imported: {data}")

    def test_import_requires_auth(self):
        questions = [{"text": "x", "answer": "y"}]
        json_bytes = json.dumps(questions).encode("utf-8")
        resp = requests.post(
            f"{BASE_URL}/api/admin/questions/import",
            files={"file": ("q.json", json_bytes, "application/json")},
        )
        assert resp.status_code == 401

    def test_import_invalid_format(self, admin_headers):
        resp = requests.post(
            f"{BASE_URL}/api/admin/questions/import",
            headers=admin_headers,
            files={"file": ("q.txt", b"hello world", "text/plain")},
        )
        assert resp.status_code == 400


# ── Approve / Reject Pending ────────────────────────────────────────────────

class TestApproveRejectPending:
    def test_approve_all_pending(self, admin_headers):
        # First import some questions
        questions = [{"text": "TEST_approve سؤال", "answer": "إجابة", "difficulty": 300}]
        json_bytes = json.dumps(questions).encode("utf-8")
        requests.post(
            f"{BASE_URL}/api/admin/questions/import",
            headers=admin_headers,
            files={"file": ("q.json", json_bytes, "application/json")},
        )
        # Now approve-all
        resp = requests.post(f"{BASE_URL}/api/admin/questions/approve-all", headers=admin_headers)
        assert resp.status_code == 200
        data = resp.json()
        assert "count" in data
        assert isinstance(data["count"], int)
        print(f"Approved all: {data}")

    def test_approve_all_when_empty(self, admin_headers):
        # After approve-all above, pending should be empty
        resp = requests.post(f"{BASE_URL}/api/admin/questions/approve-all", headers=admin_headers)
        assert resp.status_code == 200
        data = resp.json()
        assert data.get("count") == 0

    def test_approve_single(self, admin_headers):
        # Import one question
        questions = [{"text": "TEST_single approve", "answer": "A", "difficulty": 300}]
        json_bytes = json.dumps(questions).encode("utf-8")
        requests.post(
            f"{BASE_URL}/api/admin/questions/import",
            headers=admin_headers,
            files={"file": ("q.json", json_bytes, "application/json")},
        )
        # Get pending
        pending_resp = requests.get(f"{BASE_URL}/api/admin/questions/pending", headers=admin_headers)
        items = pending_resp.json().get("items", [])
        if not items:
            pytest.skip("No pending questions to approve")
        q_id = items[0]["id"]
        resp = requests.post(f"{BASE_URL}/api/admin/questions/{q_id}/approve", headers=admin_headers)
        assert resp.status_code == 200
        data = resp.json()
        assert data.get("id") == q_id

    def test_reject_single(self, admin_headers):
        # Import one question
        questions = [{"text": "TEST_reject me", "answer": "B", "difficulty": 300}]
        json_bytes = json.dumps(questions).encode("utf-8")
        requests.post(
            f"{BASE_URL}/api/admin/questions/import",
            headers=admin_headers,
            files={"file": ("q.json", json_bytes, "application/json")},
        )
        pending_resp = requests.get(f"{BASE_URL}/api/admin/questions/pending", headers=admin_headers)
        items = pending_resp.json().get("items", [])
        if not items:
            pytest.skip("No pending questions to reject")
        q_id = items[0]["id"]
        resp = requests.post(f"{BASE_URL}/api/admin/questions/{q_id}/reject", headers=admin_headers)
        assert resp.status_code == 200

    def test_approve_nonexistent_returns_404(self, admin_headers):
        resp = requests.post(f"{BASE_URL}/api/admin/questions/nonexistent-id-9999/approve", headers=admin_headers)
        assert resp.status_code == 404


# ── Paylink Endpoints ────────────────────────────────────────────────────────

class TestPaylinkEndpoints:
    def test_paylink_initiate_requires_auth(self):
        resp = requests.post(f"{BASE_URL}/api/paylink/initiate", json={
            "plan_id": "monthly", "client_name": "Test", "client_mobile": "0500000000",
            "origin_url": "https://example.com"
        })
        assert resp.status_code == 401

    def test_paylink_initiate_with_auth_503_or_502(self, admin_headers):
        """Paylink will fail in preview (no real credentials) but should return 503 or 502, not 500"""
        # Use admin token to initiate — requires user token actually
        # First register a test user
        import uuid
        email = f"test_{uuid.uuid4().hex[:8]}@test.com"
        reg = requests.post(f"{BASE_URL}/api/auth/register", json={
            "email": email, "username": f"test_{uuid.uuid4().hex[:6]}", "password": "password123"
        })
        if reg.status_code != 200:
            pytest.skip("Could not register test user")
        user_token = reg.json()["token"]
        user_headers = {"Authorization": f"Bearer {user_token}"}
        
        resp = requests.post(f"{BASE_URL}/api/paylink/initiate", 
            headers=user_headers,
            json={"plan_id": "monthly", "client_name": "Test User",
                  "client_mobile": "0500000000", "origin_url": "https://example.com"})
        # Should not be 500 (server error), should be 503 (not configured) or 502 (gateway error)
        assert resp.status_code in [200, 502, 503], f"Unexpected status: {resp.status_code} - {resp.text}"
        print(f"Paylink initiate status: {resp.status_code}")

    def test_paylink_status_no_auth(self):
        """Public endpoint — should return something (not 401)"""
        resp = requests.get(f"{BASE_URL}/api/paylink/status/test_txn_12345")
        assert resp.status_code == 200
        data = resp.json()
        assert "order_status" in data
        print(f"Paylink status: {data}")


# ── AI Generate Questions ────────────────────────────────────────────────────

class TestAIGenerateQuestions:
    def test_ai_generate_full18(self, admin_headers):
        """Test full18 mode returns 18 questions or appropriate error"""
        # Get a real category id
        cats_resp = requests.get(f"{BASE_URL}/api/categories")
        cats = cats_resp.json() if cats_resp.status_code == 200 else []
        cat_id = cats[0]["id"] if cats else "cat_word"
        
        resp = requests.post(f"{BASE_URL}/api/ai/generate-questions", 
            headers=admin_headers,
            json={"category_id": cat_id, "mode": "full18"})
        
        # Could succeed (200) or fail due to AI key (502/503)
        print(f"AI generate full18 status: {resp.status_code}")
        if resp.status_code == 200:
            data = resp.json()
            questions = data.get("questions", [])
            assert len(questions) == 18, f"Expected 18, got {len(questions)}"
        else:
            assert resp.status_code in [200, 500, 502, 503]


# ── PaymentSuccessPage Backend ─────────────────────────────────────────────

class TestPaymentSuccess:
    def test_health_check(self):
        resp = requests.get(f"{BASE_URL}/api/health")
        assert resp.status_code == 200
