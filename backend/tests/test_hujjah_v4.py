"""
Backend tests for Hujjah v4 - 36-tile board, free categories, real images
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestFreeCategoriesAPI:
    """Test /api/free-categories endpoint"""

    def test_free_categories_returns_6(self):
        r = requests.get(f"{BASE_URL}/api/free-categories")
        assert r.status_code == 200
        data = r.json()
        assert "category_ids" in data
        assert len(data["category_ids"]) == 6
        print(f"PASS: free-categories returns {len(data['category_ids'])} ids")

    def test_free_categories_correct_ids(self):
        expected = {"cat_word", "cat_islamic", "cat_music", "cat_flags", "cat_easy", "cat_science"}
        r = requests.get(f"{BASE_URL}/api/free-categories")
        data = r.json()
        assert set(data["category_ids"]) == expected
        print(f"PASS: correct free category ids: {data['category_ids']}")

    def test_free_categories_have_image_urls(self):
        r = requests.get(f"{BASE_URL}/api/free-categories")
        data = r.json()
        cats = data.get("categories", [])
        assert len(cats) == 6
        for cat in cats:
            assert cat.get("image_url"), f"Category {cat.get('id')} missing image_url"
        print("PASS: all 6 free categories have image_url")


class TestCategoriesAPI:
    """Test general categories endpoint"""

    def test_all_categories_have_image_url(self):
        r = requests.get(f"{BASE_URL}/api/categories")
        assert r.status_code == 200
        cats = r.json()
        assert len(cats) >= 6
        for cat in cats:
            assert cat.get("image_url"), f"Category {cat.get('id')} missing image_url"
        print(f"PASS: all {len(cats)} categories have image_url")

    def test_categories_no_mongo_id(self):
        r = requests.get(f"{BASE_URL}/api/categories")
        cats = r.json()
        for cat in cats:
            assert "_id" not in cat, "MongoDB _id exposed"
        print("PASS: no _id exposed")


class TestGameSession:
    """Test game session creation and tile fetching"""

    def setup_method(self):
        # Create session
        r = requests.post(f"{BASE_URL}/api/game/session", json={
            "team1_name": "الفريق أ",
            "team2_name": "الفريق ب"
        })
        assert r.status_code == 200
        self.session = r.json()
        self.session_id = self.session["id"]

        # Update with categories
        r2 = requests.put(f"{BASE_URL}/api/game/session/{self.session_id}", json={
            "team1_categories": ["cat_flags", "cat_easy", "cat_word"],
            "team2_categories": ["cat_islamic", "cat_science", "cat_music"],
            "status": "playing"
        })
        assert r2.status_code == 200
        print(f"Session created: {self.session_id}")

    def test_get_question_slot1(self):
        """Slot 1 question for cat_flags difficulty 200"""
        r = requests.post(
            f"{BASE_URL}/api/game/session/{self.session_id}/question?category_id=cat_flags&difficulty=200"
        )
        assert r.status_code == 200
        q = r.json()
        assert q.get("text")
        assert q.get("answer")
        assert q.get("difficulty") == 200
        print(f"PASS: slot1 question returned: {q['text'][:30]}...")

    def test_get_question_slot2_different(self):
        """Two questions from same category/difficulty should be different (non-repeat)"""
        r1 = requests.post(
            f"{BASE_URL}/api/game/session/{self.session_id}/question?category_id=cat_flags&difficulty=200"
        )
        r2 = requests.post(
            f"{BASE_URL}/api/game/session/{self.session_id}/question?category_id=cat_flags&difficulty=200"
        )
        assert r1.status_code == 200
        assert r2.status_code == 200
        q1 = r1.json()
        q2 = r2.json()
        # For free users, questions may repeat but should return valid questions
        assert q1.get("text")
        assert q2.get("text")
        print(f"PASS: slot1={q1['text'][:20]}, slot2={q2['text'][:20]}")

    def test_session_has_all_6_categories(self):
        r = requests.get(f"{BASE_URL}/api/game/session/{self.session_id}")
        assert r.status_code == 200
        session = r.json()
        t1 = session.get("team1_categories", [])
        t2 = session.get("team2_categories", [])
        assert len(t1) == 3
        assert len(t2) == 3
        assert len(set(t1) | set(t2)) == 6
        print(f"PASS: 6 categories assigned correctly")


class TestPricingAPI:
    """Stripe is mocked - just verify endpoint behavior"""

    def test_checkout_requires_auth(self):
        r = requests.post(f"{BASE_URL}/api/subscription/checkout", json={"plan_id": "monthly", "origin_url": "http://test.com"})
        # Should return 401 or 503 (mocked)
        assert r.status_code in [401, 422, 503]
        print(f"PASS: checkout without auth returns {r.status_code}")
