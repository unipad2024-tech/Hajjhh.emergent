"""
Iteration 8 - Testing: free-categories API, trial settings, experimental toggle, 
AI generate with Gemini, session creation with is_trial, admin tab
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')
ADMIN_PASSWORD = "hujjah2024"

def get_admin_token():
    r = requests.post(f"{BASE_URL}/api/admin/login", json={"password": ADMIN_PASSWORD})
    if r.status_code == 200:
        return r.json().get("token")
    return None

@pytest.fixture(scope="module")
def admin_token():
    token = get_admin_token()
    if not token:
        pytest.skip("Admin login failed")
    return token

@pytest.fixture(scope="module")
def admin_headers(admin_token):
    return {"Authorization": f"Bearer {admin_token}"}

# Test 1: /api/free-categories returns required fields
def test_free_categories_structure():
    r = requests.get(f"{BASE_URL}/api/free-categories")
    assert r.status_code == 200, f"Got {r.status_code}: {r.text}"
    data = r.json()
    assert "trial_enabled" in data
    assert "trial_team1_categories" in data
    assert "trial_team2_categories" in data
    assert isinstance(data["trial_team1_categories"], list)
    assert isinstance(data["trial_team2_categories"], list)
    print(f"PASS: free-categories returns {data}")

# Test 2: PUT /api/settings updates trial categories, then verify via GET /api/free-categories
def test_settings_trial_categories_persistence(admin_headers):
    payload = {
        "trial_team1_categories": ["cat_sports", "cat_easy", "cat_word"],
        "trial_team2_categories": ["cat_islamic", "cat_science", "cat_music"]
    }
    r = requests.put(f"{BASE_URL}/api/settings", json=payload, headers=admin_headers)
    assert r.status_code == 200, f"PUT settings failed: {r.text}"
    
    # Verify via /api/free-categories
    r2 = requests.get(f"{BASE_URL}/api/free-categories")
    assert r2.status_code == 200
    data = r2.json()
    assert data["trial_team1_categories"] == ["cat_sports", "cat_easy", "cat_word"], f"Got {data['trial_team1_categories']}"
    assert data["trial_team2_categories"] == ["cat_islamic", "cat_science", "cat_music"]
    print(f"PASS: trial categories persisted correctly")

# Test 3: PATCH /api/questions/{id}/experimental
def test_toggle_experimental(admin_headers):
    # Get a question first
    r = requests.get(f"{BASE_URL}/api/questions?limit=1", headers=admin_headers)
    if r.status_code != 200 or not r.json():
        pytest.skip("No questions available")
    questions = r.json()
    q = questions[0] if isinstance(questions, list) else questions.get("questions", [None])[0]
    if not q:
        pytest.skip("No questions found")
    q_id = q.get("id")
    
    # Toggle to experimental=True
    r2 = requests.patch(f"{BASE_URL}/api/questions/{q_id}/experimental", 
                        json={"is_experimental": True}, headers=admin_headers)
    assert r2.status_code == 200, f"PATCH experimental failed: {r2.text}"
    data = r2.json()
    assert data.get("is_experimental") == True
    print(f"PASS: experimental toggle works for question {q_id}")
    
    # Toggle back
    requests.patch(f"{BASE_URL}/api/questions/{q_id}/experimental", 
                   json={"is_experimental": False}, headers=admin_headers)

# Test 4: POST /api/game/session - is_trial for unauthenticated user
def test_session_creation_is_trial():
    # Get categories to use
    cats_r = requests.get(f"{BASE_URL}/api/categories")
    if cats_r.status_code != 200:
        pytest.skip("Can't get categories")
    cats = cats_r.json()
    if not cats or len(cats) < 2:
        pytest.skip("Not enough categories")
    
    cat1 = cats[0].get("id", cats[0].get("slug", "cat_easy"))
    cat2 = cats[1].get("id", cats[1].get("slug", "cat_sports")) if len(cats) > 1 else cat1
    
    # No auth header = trial user
    r = requests.post(f"{BASE_URL}/api/game/session", json={
        "team1_name": "فريق 1",
        "team2_name": "فريق 2",
        "team1_categories": [cat1],
        "team2_categories": [cat2]
    })
    assert r.status_code == 200, f"Session creation failed: {r.text}"
    data = r.json()
    assert data.get("is_trial") == True, f"Expected is_trial=True for unauthenticated user, got {data.get('is_trial')}"
    print(f"PASS: session is_trial=True for unauthenticated user")

# Test 5: POST /api/ai/generate-questions with Gemini
def test_ai_generate_with_gemini(admin_headers):
    r = requests.post(f"{BASE_URL}/api/ai/generate-questions", json={
        "category": "cat_easy",
        "difficulty": 100,
        "count": 1
    }, headers=admin_headers, timeout=30)
    assert r.status_code == 200, f"AI generate failed: {r.status_code}: {r.text}"
    data = r.json()
    assert "questions" in data or isinstance(data, list)
    questions = data.get("questions", data) if isinstance(data, dict) else data
    assert len(questions) > 0
    # Check Arabic content
    q = questions[0]
    assert "question" in q or "text" in q
    print(f"PASS: AI Gemini generate returned {len(questions)} question(s)")
    print(f"Sample: {questions[0]}")

# Test 6: /api/free-categories is not hardcoded - changes persist
def test_free_categories_not_hardcoded(admin_headers):
    # Change to different values
    new_t1 = ["cat_flags", "cat_easy", "cat_word"]
    requests.put(f"{BASE_URL}/api/settings", json={"trial_team1_categories": new_t1}, headers=admin_headers)
    
    r = requests.get(f"{BASE_URL}/api/free-categories")
    data = r.json()
    assert data["trial_team1_categories"] == new_t1, f"Categories not dynamic: got {data['trial_team1_categories']}"
    print(f"PASS: free-categories is dynamic, not hardcoded")
