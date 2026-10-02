import json

import pytest
from fastapi.testclient import TestClient

import main

SEEDS = json.loads((main.BASE / "quizzes.json").read_text(encoding="utf-8-sig"))


@pytest.fixture
def client(tmp_path, monkeypatch):
    monkeypatch.setattr(main, "DATABASE", tmp_path / "quizly.db")
    with TestClient(main.app) as client:
        yield client


def begin(client, quiz="science"):
    response = client.post(f"/api/quizzes/{quiz}/attempts")
    assert response.status_code == 201
    return response.json()


def test_home_and_assets(client):
    assert client.get("/").status_code == 200
    assert client.get("/static/app.js").status_code == 200
    assert client.get("/static/vendor/vue.global.prod.js").status_code == 200
    assert client.get("/openapi.json").status_code == 200


def test_catalog_hides_answers_and_establishes_cookie(client):
    response = client.get("/api/quizzes")
    assert len(response.json()) == len(SEEDS)
    assert "httponly" in response.headers["set-cookie"].lower()
    assert all("questions" not in quiz for quiz in response.json())
    attempt = begin(client)
    assert len(attempt["questions"]) == 5
    assert all(set(q) == {"text", "options"} for q in attempt["questions"])


def test_server_scoring_and_idempotent_submission(client):
    attempt = begin(client)
    url = f'/api/attempts/{attempt["id"]}/submit'
    result = client.post(url, json={"answers": [1, 2, 3, 0, 1]}).json()
    assert result["score"] == 100
    assert result["correct"] == result["total"] == 5
    assert all(q["is_correct"] for q in result["review"])
    assert client.post(url, json={"answers": [0, 0, 0, 0, 0]}).json() == result
    progress = client.get("/api/progress").json()
    assert progress["completed"] == 1
    assert progress["best"] == progress["average"] == 100


def test_partial_score_and_explanations(client):
    attempt = begin(client)
    result = client.post(f'/api/attempts/{attempt["id"]}/submit', json={"answers": [1, 0, 0, 0, 0]}).json()
    assert result["score"] == 40
    assert result["review"][1]["selected"] == 0
    assert result["review"][1]["correct"] == 2
    assert result["review"][1]["explanation"]


@pytest.mark.parametrize("answers", [[0], [], [0, 0, 0, 0, 4], [0, 0, 0, 0, -1], [0, 0, 0, 0, True], [0, 0, 0, 0, "1"]])
def test_invalid_answers_rejected(client, answers):
    attempt = begin(client)
    assert client.post(f'/api/attempts/{attempt["id"]}/submit', json={"answers": answers}).status_code == 422
    assert client.get("/api/progress").json()["completed"] == 0


def test_bookmarks_and_visitor_isolation(client):
    client.get("/api/quizzes")
    original_cookie = client.cookies.get("quizly_visitor")
    assert client.put("/api/quizzes/science/bookmark", json={"saved": True}).status_code == 200
    assert client.get("/api/quizzes").json()[0]["saved"]
    attempt = begin(client)
    client.cookies.clear()
    assert not client.get("/api/quizzes").json()[0]["saved"]
    assert client.post(f'/api/attempts/{attempt["id"]}/submit', json={"answers": [1, 2, 3, 0, 1]}).status_code == 404
    client.cookies.clear()
    client.cookies.set("quizly_visitor", original_cookie)
    client.put("/api/quizzes/science/bookmark", json={"saved": False})
    assert not client.get("/api/quizzes").json()[0]["saved"]


def test_custom_quiz_and_privacy(client):
    quiz = {"title": "My test quiz", "description": "A custom knowledge check", "category": "Technology", "difficulty": "Hard",
            "questions": [{"text": "What is 2 + 2?", "options": ["1", "2", "3", "4"], "correct": 3, "explanation": "Two pairs make four."}]}
    response = client.post("/api/quizzes", json=quiz)
    assert response.status_code == 201
    quiz_id = response.json()["id"]
    assert len(client.get("/api/quizzes").json()) == len(SEEDS) + 1
    attempt = begin(client, quiz_id)
    assert client.post(f'/api/attempts/{attempt["id"]}/submit', json={"answers": [3]}).json()["score"] == 100
    client.cookies.clear()
    assert len(client.get("/api/quizzes").json()) == len(SEEDS)
    assert client.post(f"/api/quizzes/{quiz_id}/attempts").status_code == 404


def test_invalid_quiz_and_missing_resources(client):
    assert client.post("/api/quizzes", json={"title": "  "}).status_code == 422
    assert client.post("/api/quizzes/missing/attempts").status_code == 404
    assert client.put("/api/quizzes/missing/bookmark", json={"saved": True}).status_code == 404
    assert client.post("/api/attempts/missing/submit", json={"answers": [0]}).status_code == 404


def test_data_survives_app_restart(client):
    client.get("/api/quizzes")
    cookie = client.cookies.get("quizly_visitor")
    client.put("/api/quizzes/science/bookmark", json={"saved": True})
    attempt = begin(client)
    client.post(f'/api/attempts/{attempt["id"]}/submit', json={"answers": [1, 2, 3, 0, 1]})
    with TestClient(main.app) as restarted:
        restarted.cookies.set("quizly_visitor", cookie)
        assert len(restarted.get("/api/quizzes").json()) == len(SEEDS)
        assert restarted.get("/api/quizzes").json()[0]["saved"]
        assert restarted.get("/api/progress").json()["completed"] == 1


def test_seed_data_validates():
    for quiz in json.loads((main.BASE / "quizzes.json").read_text(encoding="utf-8-sig")):
        main.NewQuiz.model_validate({k: v for k, v in quiz.items() if k != "id"})


def test_turkish_migration_preserves_history_bookmarks_and_custom_quizzes(client):
    """An English installation upgrades once without losing user data or answer indices."""
    from copy import deepcopy

    client.get("/api/quizzes")
    owner = client.cookies.get("quizly_visitor")
    client.put("/api/quizzes/science/bookmark", json={"saved": True})
    completed = begin(client)
    before = client.post(f'/api/attempts/{completed["id"]}/submit', json={"answers": [1, 0, 0, 0, 0]}).json()
    pending = begin(client)
    translations = json.loads((main.BASE / "migrations" / "turkish_text.json").read_text(encoding="utf-8"))
    reverse = {value: key for key, value in translations.items()}

    def english(value):
        if isinstance(value, dict):
            return {key: english(item) for key, item in value.items()}
        if isinstance(value, list):
            return [english(item) for item in value]
        return reverse.get(value, value) if isinstance(value, str) else value

    with main.database() as db:
        quiz = json.loads(db.execute("SELECT content FROM quizzes WHERE id='science'").fetchone()[0])
        legacy = english(quiz)
        assert legacy["title"] == "A little science, a lot of wonder"
        db.execute("UPDATE quizzes SET content=? WHERE id='science'", (json.dumps(legacy),))
        for row in db.execute("SELECT id, content, result FROM attempts").fetchall():
            result = json.dumps(english(json.loads(row["result"]))) if row["result"] else None
            db.execute("UPDATE attempts SET content=?, result=? WHERE id=?",
                       (json.dumps(english(json.loads(row["content"]))), result, row["id"]))
        custom = {**deepcopy(legacy), "id": "personal-test", "custom": True}
        db.execute("INSERT INTO quizzes VALUES (?, ?, ?)", (custom["id"], owner, json.dumps(custom)))
        db.execute("DELETE FROM schema_migrations WHERE name='001_turkish_text'")

    with TestClient(main.app) as upgraded:
        upgraded.cookies.set("quizly_visitor", owner)
        catalog = upgraded.get("/api/quizzes").json()
        assert next(q for q in catalog if q["id"] == "science")["title"] == "Biraz bilim, bolca merak"
        assert next(q for q in catalog if q["id"] == "science")["saved"]
        assert next(q for q in catalog if q["id"] == custom["id"])["title"] == legacy["title"]
        progress = upgraded.get("/api/progress").json()
        assert progress["attempts"][0] == before
        assert progress["completed"] == 1
        retry = upgraded.post(f'/api/attempts/{completed["id"]}/submit', json={"answers": [0, 0, 0, 0, 0]})
        assert retry.json() == before
        pending_result = upgraded.post(f'/api/attempts/{pending["id"]}/submit', json={"answers": [1, 2, 3, 0, 1]}).json()
        assert pending_result["score"] == 100
        assert pending_result["review"][0]["text"] == "Hangi gezegen Kızıl Gezegen olarak bilinir?"
    with main.database() as db:
        main.migrate_turkish_text(db)
        assert db.execute("SELECT COUNT(*) FROM schema_migrations").fetchone()[0] == 1
        assert json.loads(db.execute("SELECT content FROM quizzes WHERE id=?", (custom["id"],)).fetchone()[0]) == custom


def test_user_facing_api_errors_are_turkish(client):
    assert client.post("/api/quizzes/missing/attempts").json()["detail"] == "Test bulunamadı."
    attempt = begin(client)
    assert client.post(f'/api/attempts/{attempt["id"]}/submit', json={"answers": [0]}).json()["detail"] == "Göndermeden önce lütfen tüm soruları yanıtla."


def test_expanded_categories_and_question_bank(client):
    categories = client.get("/api/categories").json()
    assert len(categories) == 8
    assert all(c["quiz_count"] == 2 and c["question_count"] == 10 for c in categories)
    assert len(SEEDS) == 16
    assert len({q["id"] for q in SEEDS}) == 16
    assert {q["category"] for q in SEEDS} == {c["id"] for c in categories}
    questions = [q for quiz in SEEDS for q in quiz["questions"]]
    assert len(questions) == len({q["text"] for q in questions}) == 80
    assert all(len(set(q["options"])) == 4 for q in questions)
    assert all(q["explanation"] and 0 <= q["correct"] < 4 for q in questions)
    assert len({c["icon"] for c in categories}) == 8
    custom = {k: v for k, v in SEEDS[-1].items() if k != "id"}
    custom["questions"] = custom["questions"][:1]
    assert client.post("/api/quizzes", json=custom).status_code == 201
    category = next(c for c in client.get("/api/categories").json() if c["id"] == custom["category"])
    assert (category["quiz_count"], category["question_count"]) == (3, 11)
    client.cookies.clear()
    category = next(c for c in client.get("/api/categories").json() if c["id"] == custom["category"])
    assert (category["quiz_count"], category["question_count"]) == (2, 10)


def test_wrong_answer_practice_uses_snapshot_without_inflating_scores(client):
    attempt = begin(client)
    original = client.post(f'/api/attempts/{attempt["id"]}/submit', json={"answers": [1, 0, 0, 0, 0]}).json()
    # Practice must use the original snapshot, even if the public bank changes.
    with main.database() as db:
        quiz = json.loads(db.execute("SELECT content FROM quizzes WHERE id='science'").fetchone()[0])
        quiz["questions"][1]["text"] = "An edited question"
        db.execute("UPDATE quizzes SET content=? WHERE id='science'", (json.dumps(quiz),))
    response = client.post(f'/api/attempts/{attempt["id"]}/practice')
    assert response.status_code == 201
    practice = response.json()
    assert practice["quiz"]["practice"]
    assert practice["quiz"]["source_attempt_id"] == attempt["id"]
    assert len(practice["questions"]) == 3
    assert [q["text"] for q in practice["questions"]] == [q["text"] for q in original["review"] if not q["is_correct"]]
    assert all(set(q) == {"text", "options"} for q in practice["questions"])
    result = client.post(f'/api/attempts/{practice["id"]}/submit', json={"answers": [2, 3, 1]}).json()
    assert result["score"] == 100 and result["practice"]
    assert result["source_attempt_id"] == attempt["id"]
    progress = client.get("/api/progress").json()
    assert progress["completed"] == progress["practice_completed"] == 1
    assert progress["best"] == progress["average"] == 40
    assert progress["correct"] == 2
    assert len(progress["attempts"]) == 2
    assert len(client.get("/api/quizzes").json()) == len(SEEDS)
    cookie = client.cookies.get("quizly_visitor")
    with TestClient(main.app) as restarted:
        restarted.cookies.set("quizly_visitor", cookie)
        assert restarted.get("/api/progress").json() == progress


def test_practice_ownership_and_completion_guards(client):
    assert client.post("/api/attempts/missing/practice").status_code == 404
    pending = begin(client)
    assert client.post(f'/api/attempts/{pending["id"]}/practice').status_code == 409
    client.post(f'/api/attempts/{pending["id"]}/submit', json={"answers": [1, 2, 3, 0, 1]})
    assert client.post(f'/api/attempts/{pending["id"]}/practice').status_code == 409
    wrong = begin(client)
    client.post(f'/api/attempts/{wrong["id"]}/submit', json={"answers": [1, 0, 0, 0, 0]})
    owner = client.cookies.get("quizly_visitor")
    client.cookies.clear()
    assert client.post(f'/api/attempts/{wrong["id"]}/practice').status_code == 404
    client.cookies.clear()
    client.cookies.set("quizly_visitor", owner)
    first = client.post(f'/api/attempts/{wrong["id"]}/practice').json()
    client.post(f'/api/attempts/{first["id"]}/submit', json={"answers": [2, 0, 1]})
    second = client.post(f'/api/attempts/{first["id"]}/practice').json()
    assert len(second["questions"]) == 1
    assert second["quiz"]["title"] == first["quiz"]["title"]
    assert second["quiz"]["source_attempt_id"] == first["id"]


def test_optional_confidence_persists_and_identifies_confident_mistakes(client):
    attempt = begin(client)
    url = f'/api/attempts/{attempt["id"]}/submit'
    levels = ["high", "high", "medium", None, "low"]
    result = client.post(url, json={"answers": [1, 0, 0, 0, 0], "confidence": levels}).json()
    assert result["score"] == 40
    assert result["high_confidence_wrong"] == 1
    assert [q["confidence"] for q in result["review"]] == levels
    assert client.get("/api/progress").json()["attempts"][0] == result
    assert client.post(url, json={"answers": [1, 2, 3, 0, 1], "confidence": ["low"] * 5}).json() == result
    other = begin(client)
    result = client.post(f'/api/attempts/{other["id"]}/submit', json={"answers": [1, 2, 3, 0, 1]}).json()
    assert result["high_confidence_wrong"] == 0
    assert all(q["confidence"] is None for q in result["review"])


@pytest.mark.parametrize("levels", [["high"], [], ["certain"] * 5, [1] * 5, [True] * 5])
def test_invalid_confidence_never_completes_attempt(client, levels):
    attempt = begin(client)
    assert client.post(f'/api/attempts/{attempt["id"]}/submit', json={"answers": [1, 2, 3, 0, 1], "confidence": levels}).status_code == 422
    assert client.get("/api/progress").json()["completed"] == 0
