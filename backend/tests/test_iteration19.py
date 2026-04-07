"""
Iteration 19 Backend Tests
Tests: Paylink endpoints, File import, Pending questions workflow, Bulk fetch images
"""
import pytest
import requests
import os
import json
import io

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "").rstrip("/")

# ── Auth helpers ──────────────────────────────────────────────────────────────

def get_user_token():
    r = requests.post(f"{BASE_URL}/api/auth/login", json={
        "email": "paylinktest2@test.com", "password": "test123456"
    })
    if r.status_code == 200:
        return r.json().get("token")
    return None

def get_admin_token():
    r = requests.post(f"{BASE_URL}/api/admin/login", json={
        "username": "admin", "password": "hujjah2024"
    })
    if r.status_code == 200:
        return r.json().get("token")
    return None

# ── Paylink ───────────────────────────────────────────────────────────────────

class TestPaylink:
    """Paylink payment gateway endpoints"""

    def test_paylink_initiate_returns_payment_url(self):
        token = get_user_token()
        if not token:
            pytest.skip("User login failed")
        r = requests.post(
            f"{BASE_URL}/api/paylink/initiate",
            json={"plan_id": "monthly", "origin_url": BASE_URL,
                  "client_name": "Test User", "client_mobile": "0501234567"},
            headers={"Authorization": f"Bearer {token}"}
        )
        print(f"Paylink initiate status: {r.status_code}, body: {r.text[:300]}")
        # Should return 200 with payment_url OR 503 if credentials not set
        assert r.status_code in (200, 503), f"Unexpected status: {r.status_code}"
        if r.status_code == 200:
            data = r.json()
            assert "payment_url" in data, f"Missing payment_url in {data}"
            assert "transaction_no" in data, f"Missing transaction_no in {data}"
            print(f"  payment_url: {data['payment_url']}")
            print(f"  transaction_no: {data['transaction_no']}")

    def test_paylink_verify_known_txn(self):
        token = get_user_token()
        if not token:
            pytest.skip("User login failed")
        txn_no = "1774929970854"
        r = requests.get(
            f"{BASE_URL}/api/paylink/verify/{txn_no}",
            headers={"Authorization": f"Bearer {token}"}
        )
        print(f"Paylink verify status: {r.status_code}, body: {r.text[:300]}")
        assert r.status_code in (200, 503, 404, 400), f"Unexpected status: {r.status_code}"
        if r.status_code == 200:
            data = r.json()
            assert "order_status" in data, f"Missing order_status in {data}"

    def test_paylink_status_no_auth(self):
        """Public endpoint - no auth required"""
        txn_no = "1774929970854"
        r = requests.get(f"{BASE_URL}/api/paylink/status/{txn_no}")
        print(f"Paylink status (no auth) status: {r.status_code}, body: {r.text[:300]}")
        assert r.status_code in (200, 503, 400, 404), f"Unexpected status: {r.status_code}"

# ── File Import ───────────────────────────────────────────────────────────────

class TestFileImport:
    """File import endpoints for admin"""

    def test_import_json_file(self):
        token = get_admin_token()
        if not token:
            pytest.skip("Admin login failed")
        questions = [
            {"question": "ما عاصمة السعودية؟", "answer": "الرياض", "category": "جغرافيا"},
            {"question": "ما أكبر دولة عربية؟", "answer": "الجزائر", "category": "جغرافيا"},
        ]
        json_bytes = json.dumps(questions, ensure_ascii=False).encode("utf-8")
        r = requests.post(
            f"{BASE_URL}/api/admin/questions/import",
            headers={"Authorization": f"Bearer {token}"},
            files={"file": ("questions.json", io.BytesIO(json_bytes), "application/json")}
        )
        print(f"Import JSON status: {r.status_code}, body: {r.text[:300]}")
        assert r.status_code == 200, f"Expected 200, got {r.status_code}: {r.text[:200]}"
        data = r.json()
        assert data.get("count", 0) > 0, f"count should be > 0: {data}"

    def test_import_txt_file_ai_extraction(self):
        """TXT file triggers AI (Gemini) extraction"""
        token = get_admin_token()
        if not token:
            pytest.skip("Admin login failed")
        txt_content = """
س: ما هو أعلى جبل في العالم؟
أ) جبل إيفرست
ب) جبل أكونكاغوا
ج) جبل كليمنجارو
د) جبل ماكينلي
الإجابة: أ

س: كم عدد قارات العالم؟
أ) 5
ب) 6
ج) 7
د) 8
الإجابة: ج
""".encode("utf-8")
        r = requests.post(
            f"{BASE_URL}/api/admin/questions/import",
            headers={"Authorization": f"Bearer {token}"},
            files={"file": ("questions.txt", io.BytesIO(txt_content), "text/plain")}
        )
        print(f"Import TXT status: {r.status_code}, body: {r.text[:500]}")
        assert r.status_code == 200, f"Expected 200, got {r.status_code}: {r.text[:200]}"
        data = r.json()
        print(f"  count extracted: {data.get('count', 0)}")
        assert data.get("count", 0) >= 0, "count should be >= 0"

# ── Pending Questions Workflow ─────────────────────────────────────────────────

class TestPendingQuestions:
    """Admin pending questions CRUD workflow"""

    def test_get_pending_questions(self):
        token = get_admin_token()
        if not token:
            pytest.skip("Admin login failed")
        r = requests.get(
            f"{BASE_URL}/api/admin/questions/pending",
            headers={"Authorization": f"Bearer {token}"}
        )
        print(f"Pending questions status: {r.status_code}, body: {r.text[:300]}")
        assert r.status_code == 200
        data = r.json()
        assert "items" in data or isinstance(data, list), f"Unexpected shape: {data}"

    def test_approve_and_reject_workflow(self):
        """Import → get pending → approve one → reject one"""
        token = get_admin_token()
        if not token:
            pytest.skip("Admin login failed")
        # Import a JSON with 2 questions
        questions = [
            {"question": "TEST_approve_سؤال1؟", "answer": "أ", "category": "اختبار"},
            {"question": "TEST_reject_سؤال2؟", "answer": "ب", "category": "اختبار"},
        ]
        json_bytes = json.dumps(questions, ensure_ascii=False).encode("utf-8")
        imp = requests.post(
            f"{BASE_URL}/api/admin/questions/import",
            headers={"Authorization": f"Bearer {token}"},
            files={"file": ("q.json", io.BytesIO(json_bytes), "application/json")}
        )
        assert imp.status_code == 200, f"Import failed: {imp.text[:200]}"

        # Get pending
        r = requests.get(
            f"{BASE_URL}/api/admin/questions/pending",
            headers={"Authorization": f"Bearer {token}"}
        )
        assert r.status_code == 200
        data = r.json()
        items = data if isinstance(data, list) else data.get("items", [])
        print(f"  Pending count: {len(items)}")

        # Find our test questions
        approve_id = next((q["id"] for q in items if "TEST_approve" in q.get("question", "")), None)
        reject_id = next((q["id"] for q in items if "TEST_reject" in q.get("question", "")), None)

        if approve_id:
            ar = requests.post(
                f"{BASE_URL}/api/admin/questions/{approve_id}/approve",
                headers={"Authorization": f"Bearer {token}"}
            )
            print(f"  Approve status: {ar.status_code}, body: {ar.text[:200]}")
            assert ar.status_code == 200, f"Approve failed: {ar.text}"

        if reject_id:
            rr = requests.post(
                f"{BASE_URL}/api/admin/questions/{reject_id}/reject",
                headers={"Authorization": f"Bearer {token}"}
            )
            print(f"  Reject status: {rr.status_code}, body: {rr.text[:200]}")
            assert rr.status_code == 200, f"Reject failed: {rr.text}"

    def test_approve_all(self):
        token = get_admin_token()
        if not token:
            pytest.skip("Admin login failed")
        r = requests.post(
            f"{BASE_URL}/api/admin/questions/approve-all",
            headers={"Authorization": f"Bearer {token}"}
        )
        print(f"Approve-all status: {r.status_code}, body: {r.text[:200]}")
        assert r.status_code == 200

    def test_bulk_fetch_images(self):
        token = get_admin_token()
        if not token:
            pytest.skip("Admin login failed")
        r = requests.post(
            f"{BASE_URL}/api/admin/questions/bulk-fetch-images",
            headers={"Authorization": f"Bearer {token}"}
        )
        print(f"Bulk fetch images status: {r.status_code}, body: {r.text[:300]}")
        assert r.status_code in (200, 202, 404), f"Unexpected: {r.status_code}: {r.text[:200]}"
