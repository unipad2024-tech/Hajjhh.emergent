"""Backend tests for iteration 19: PATCH pending questions endpoint"""
import pytest
import requests
import os

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "").rstrip("/")

class TestAdminAuth:
    """Admin authentication"""
    def test_admin_login(self):
        r = requests.post(f"{BASE_URL}/api/admin/login", json={"username": "admin", "password": "hujjah2024"})
        assert r.status_code == 200
        data = r.json()
        assert "token" in data
        print(f"Admin login OK, token: {data['token'][:20]}...")


@pytest.fixture(scope="module")
def admin_token():
    r = requests.post(f"{BASE_URL}/api/admin/login", json={"username": "admin", "password": "hujjah2024"})
    if r.status_code == 200:
        return r.json()["token"]
    pytest.skip("Admin login failed")


@pytest.fixture(scope="module")
def auth_headers(admin_token):
    return {"Authorization": f"Bearer {admin_token}"}


class TestPatchPendingQuestion:
    """Test PATCH /api/admin/questions/pending/{id}"""

    def test_patch_nonexistent_returns_404(self, auth_headers):
        r = requests.patch(
            f"{BASE_URL}/api/admin/questions/pending/nonexistent-id-12345",
            json={"image_url": "https://example.com/img.jpg"},
            headers=auth_headers,
        )
        assert r.status_code == 404
        print(f"404 for nonexistent: OK")

    def test_patch_no_valid_fields_returns_400(self, auth_headers):
        r = requests.patch(
            f"{BASE_URL}/api/admin/questions/pending/some-id",
            json={"invalid_field": "value"},
            headers=auth_headers,
        )
        assert r.status_code == 400
        print("400 for no valid fields: OK")

    def test_patch_requires_auth(self):
        r = requests.patch(
            f"{BASE_URL}/api/admin/questions/pending/some-id",
            json={"image_url": "https://example.com/img.jpg"},
        )
        assert r.status_code == 401 or r.status_code == 403
        print(f"Auth required: {r.status_code}")

    def test_pending_list_endpoint(self, auth_headers):
        r = requests.get(f"{BASE_URL}/api/admin/questions/pending", headers=auth_headers)
        assert r.status_code == 200
        data = r.json()
        assert "items" in data
        assert "total" in data
        print(f"Pending total: {data['total']}")

    def test_patch_existing_pending_question(self, auth_headers):
        """Create a pending question via import then patch it"""
        # Get pending list to see if there are existing ones
        r = requests.get(f"{BASE_URL}/api/admin/questions/pending?limit=1", headers=auth_headers)
        assert r.status_code == 200
        items = r.json()["items"]
        if not items:
            print("No pending questions to test PATCH with — skipping actual patch")
            pytest.skip("No pending questions available")
        q = items[0]
        qid = q["id"]
        # Patch image_url
        r2 = requests.patch(
            f"{BASE_URL}/api/admin/questions/pending/{qid}",
            json={"image_url": "https://example.com/test-patch.jpg"},
            headers=auth_headers,
        )
        assert r2.status_code == 200
        data = r2.json()
        assert "message" in data or "تم" in str(data)
        print(f"PATCH pending question {qid}: OK - {data}")
