"""Backend tests for HUJJAH Trivia Game"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestAuth:
    """Admin authentication tests"""
    
    def test_login_success(self):
        r = requests.post(f"{BASE_URL}/api/auth/login", json={"password": "hujjah2024"})
        assert r.status_code == 200
        data = r.json()
        assert "token" in data
        assert isinstance(data["token"], str)
    
    def test_login_wrong_password(self):
        r = requests.post(f"{BASE_URL}/api/auth/login", json={"password": "wrong"})
        assert r.status_code == 401

    def test_verify_token(self):
        token = requests.post(f"{BASE_URL}/api/auth/login", json={"password": "hujjah2024"}).json()["token"]
        r = requests.get(f"{BASE_URL}/api/auth/verify", headers={"Authorization": f"Bearer {token}"})
        assert r.status_code == 200
        assert r.json()["valid"] == True


class TestCategories:
    """Categories CRUD tests"""
    
    def test_get_categories(self):
        r = requests.get(f"{BASE_URL}/api/categories")
        assert r.status_code == 200
        data = r.json()
        assert isinstance(data, list)
        assert len(data) > 0
        # Verify category structure
        cat = data[0]
        assert "id" in cat
        assert "name" in cat
        assert "_id" not in cat  # MongoDB _id should be excluded
    
    def test_categories_have_7_seeded(self):
        r = requests.get(f"{BASE_URL}/api/categories")
        data = r.json()
        assert len(data) >= 7
        names = [c["name"] for c in data]
        assert "ولا كلمة" in names
    
    def test_create_category_requires_auth(self):
        r = requests.post(f"{BASE_URL}/api/categories", json={"name": "Test", "description": ""})
        assert r.status_code == 401


class TestQuestions:
    """Questions tests"""
    
    def test_get_all_questions(self):
        r = requests.get(f"{BASE_URL}/api/questions")
        assert r.status_code == 200
        data = r.json()
        assert isinstance(data, list)
        assert len(data) >= 30  # Should have many seeded questions
    
    def test_get_questions_by_category(self):
        r = requests.get(f"{BASE_URL}/api/questions?category_id=cat_flags")
        assert r.status_code == 200
        data = r.json()
        assert len(data) > 0
        for q in data:
            assert q["category_id"] == "cat_flags"
            assert "_id" not in q
    
    def test_get_questions_by_difficulty(self):
        r = requests.get(f"{BASE_URL}/api/questions?difficulty=200")
        assert r.status_code == 200
        data = r.json()
        for q in data:
            assert q["difficulty"] == 200
    
    def test_get_single_question(self):
        # Get a question id first
        questions = requests.get(f"{BASE_URL}/api/questions?category_id=cat_flags").json()
        q_id = questions[0]["id"]
        r = requests.get(f"{BASE_URL}/api/questions/{q_id}")
        assert r.status_code == 200
        assert r.json()["id"] == q_id
    
    def test_get_question_not_found(self):
        r = requests.get(f"{BASE_URL}/api/questions/nonexistent")
        assert r.status_code == 404
    
    def test_create_question_requires_auth(self):
        r = requests.post(f"{BASE_URL}/api/questions", json={
            "category_id": "cat_flags", "difficulty": 200, "text": "test?", "answer": "test"
        })
        assert r.status_code == 401
    
    def test_word_category_has_secret_type(self):
        r = requests.get(f"{BASE_URL}/api/questions?category_id=cat_word")
        assert r.status_code == 200
        data = r.json()
        assert len(data) > 0
        secret_questions = [q for q in data if q["question_type"] == "secret_word"]
        assert len(secret_questions) > 0


class TestGameSession:
    """Game session tests"""
    
    def test_create_session(self):
        r = requests.post(f"{BASE_URL}/api/game/session", json={
            "team1_name": "فريق 1", "team2_name": "فريق 2"
        })
        assert r.status_code == 200
        data = r.json()
        assert "id" in data
        assert data["team1_name"] == "فريق 1"
        assert data["team1_score"] == 0
        assert data["team2_score"] == 0
        assert "_id" not in data
        return data["id"]
    
    def test_get_session(self):
        session_id = requests.post(f"{BASE_URL}/api/game/session", json={
            "team1_name": "A", "team2_name": "B"
        }).json()["id"]
        r = requests.get(f"{BASE_URL}/api/game/session/{session_id}")
        assert r.status_code == 200
        assert r.json()["id"] == session_id
    
    def test_update_session_categories(self):
        session_id = requests.post(f"{BASE_URL}/api/game/session", json={
            "team1_name": "A", "team2_name": "B"
        }).json()["id"]
        r = requests.put(f"{BASE_URL}/api/game/session/{session_id}", json={
            "team1_categories": ["cat_flags", "cat_easy", "cat_saudi"],
            "team2_categories": ["cat_islamic", "cat_science", "cat_logos"]
        })
        assert r.status_code == 200
        data = r.json()
        assert data["team1_categories"] == ["cat_flags", "cat_easy", "cat_saudi"]
    
    def test_get_next_question(self):
        session_id = requests.post(f"{BASE_URL}/api/game/session", json={
            "team1_name": "A", "team2_name": "B"
        }).json()["id"]
        r = requests.post(
            f"{BASE_URL}/api/game/session/{session_id}/question",
            params={"category_id": "cat_flags", "difficulty": 200}
        )
        assert r.status_code == 200
        data = r.json()
        assert "id" in data
        assert "text" in data
        assert "answer" in data
    
    def test_update_score(self):
        session_id = requests.post(f"{BASE_URL}/api/game/session", json={
            "team1_name": "A", "team2_name": "B"
        }).json()["id"]
        r = requests.post(
            f"{BASE_URL}/api/game/session/{session_id}/score",
            json={"team": 1, "points": 200}
        )
        assert r.status_code == 200
        data = r.json()
        assert data["team1_score"] == 200
        assert data["team2_score"] == 0


class TestSecretWord:
    """Secret word (QR) tests"""
    
    def test_get_secret_word(self):
        # Get a secret_word question
        questions = requests.get(f"{BASE_URL}/api/questions?category_id=cat_word").json()
        secret_q = next((q for q in questions if q["question_type"] == "secret_word"), None)
        assert secret_q is not None
        r = requests.get(f"{BASE_URL}/api/secret/{secret_q['id']}")
        assert r.status_code == 200
        data = r.json()
        assert "word" in data
        assert data["word"] == secret_q["answer"]
    
    def test_secret_word_not_found(self):
        r = requests.get(f"{BASE_URL}/api/secret/nonexistent")
        assert r.status_code == 404


class TestAdminCRUD:
    """Admin CRUD for questions"""
    
    @pytest.fixture
    def token(self):
        return requests.post(f"{BASE_URL}/api/auth/login", json={"password": "hujjah2024"}).json()["token"]
    
    def test_create_and_delete_question(self, token):
        headers = {"Authorization": f"Bearer {token}"}
        # Create
        r = requests.post(f"{BASE_URL}/api/questions", json={
            "category_id": "cat_easy",
            "difficulty": 200,
            "text": "TEST_سؤال اختبار؟",
            "answer": "إجابة اختبار",
            "question_type": "text"
        }, headers=headers)
        assert r.status_code == 200
        q_id = r.json()["id"]
        
        # Verify it exists
        get_r = requests.get(f"{BASE_URL}/api/questions/{q_id}")
        assert get_r.status_code == 200
        
        # Delete
        del_r = requests.delete(f"{BASE_URL}/api/questions/{q_id}", headers=headers)
        assert del_r.status_code == 200
        
        # Verify deleted
        get_r2 = requests.get(f"{BASE_URL}/api/questions/{q_id}")
        assert get_r2.status_code == 404
    
    def test_edit_question(self, token):
        headers = {"Authorization": f"Bearer {token}"}
        # Create
        q_id = requests.post(f"{BASE_URL}/api/questions", json={
            "category_id": "cat_easy", "difficulty": 200,
            "text": "TEST_original", "answer": "original"
        }, headers=headers).json()["id"]
        
        # Update
        r = requests.put(f"{BASE_URL}/api/questions/{q_id}", json={
            "category_id": "cat_easy", "difficulty": 400,
            "text": "TEST_updated", "answer": "updated"
        }, headers=headers)
        assert r.status_code == 200
        assert r.json()["difficulty"] == 400
        
        # Cleanup
        requests.delete(f"{BASE_URL}/api/questions/{q_id}", headers=headers)
