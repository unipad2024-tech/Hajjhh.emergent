"""
Test suite for iteration 7 features: AI question generator, trial mode, turn system backend
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

@pytest.fixture(scope="module")
def admin_token():
    resp = requests.post(f"{BASE_URL}/api/admin/login", json={"password": "hujjah2024"})
    assert resp.status_code == 200, f"Admin login failed: {resp.text}"
    return resp.json()["token"]

@pytest.fixture(scope="module")
def admin_headers(admin_token):
    return {"Authorization": f"Bearer {admin_token}", "Content-Type": "application/json"}

# Test 1: Admin login
class TestAdminAuth:
    def test_admin_login(self):
        resp = requests.post(f"{BASE_URL}/api/admin/login", json={"password": "hujjah2024"})
        assert resp.status_code == 200
        data = resp.json()
        assert "token" in data
        print("PASS: Admin login OK")

# Test 2: GET settings (free_categories field)
class TestSettings:
    def test_get_settings_has_free_categories(self):
        resp = requests.get(f"{BASE_URL}/api/settings")
        assert resp.status_code == 200
        data = resp.json()
        assert "free_categories" in data
        print(f"PASS: Settings has free_categories: {data['free_categories']}")

    def test_put_settings_free_categories(self, admin_headers):
        resp = requests.put(f"{BASE_URL}/api/settings",
            headers=admin_headers,
            json={"free_categories": ["cat_word", "cat_islamic", "cat_easy"]}
        )
        assert resp.status_code == 200
        data = resp.json()
        assert "free_categories" in data
        assert "cat_easy" in data["free_categories"]
        print(f"PASS: PUT settings free_categories OK: {data['free_categories']}")

# Test 3: GET categories
class TestCategories:
    def test_get_categories(self):
        resp = requests.get(f"{BASE_URL}/api/categories")
        assert resp.status_code == 200
        cats = resp.json()
        assert len(cats) > 0
        print(f"PASS: Got {len(cats)} categories")
        return cats

# Test 4: AI generate-questions
class TestAIGenerate:
    def test_ai_generate_requires_auth(self):
        resp = requests.post(f"{BASE_URL}/api/ai/generate-questions",
            json={"category_id": "cat_easy", "difficulty": 300, "count": 3}
        )
        assert resp.status_code in [401, 403]
        print("PASS: AI generate requires auth")

    def test_ai_generate_questions(self, admin_headers):
        """Generate questions with AI - may take up to 30 seconds"""
        resp = requests.post(f"{BASE_URL}/api/ai/generate-questions",
            headers=admin_headers,
            json={"category_id": "cat_easy", "difficulty": 300, "count": 3},
            timeout=60
        )
        assert resp.status_code == 200, f"AI generate failed: {resp.text}"
        data = resp.json()
        assert "questions" in data
        assert "count" in data
        assert data["count"] > 0
        q = data["questions"][0]
        assert "text" in q
        assert "answer" in q
        assert q["category_id"] == "cat_easy"
        assert q["difficulty"] == 300
        print(f"PASS: AI generated {data['count']} questions. Sample: {q['text'][:50]}")

    def test_ai_save_questions(self, admin_headers):
        """Generate then save questions"""
        # First generate
        gen_resp = requests.post(f"{BASE_URL}/api/ai/generate-questions",
            headers=admin_headers,
            json={"category_id": "cat_easy", "difficulty": 600, "count": 2},
            timeout=60
        )
        if gen_resp.status_code != 200:
            pytest.skip("AI generate failed, skipping save test")
        questions = gen_resp.json()["questions"]
        
        # Now save
        save_resp = requests.post(f"{BASE_URL}/api/ai/save-questions",
            headers=admin_headers,
            json={"questions": questions}
        )
        assert save_resp.status_code == 200
        data = save_resp.json()
        assert data["count"] == len(questions)
        print(f"PASS: Saved {data['count']} AI questions")

    def test_ai_save_requires_auth(self):
        resp = requests.post(f"{BASE_URL}/api/ai/save-questions",
            json={"questions": [{"text": "test", "answer": "ans"}]}
        )
        assert resp.status_code in [401, 403]
        print("PASS: AI save requires auth")

    def test_ai_save_empty_fails(self, admin_headers):
        resp = requests.post(f"{BASE_URL}/api/ai/save-questions",
            headers=admin_headers,
            json={"questions": []}
        )
        assert resp.status_code == 400
        print("PASS: AI save empty questions returns 400")
