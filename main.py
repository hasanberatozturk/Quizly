"""Quizly: a small, self-contained FastAPI + Vue quiz application."""

import json
import os
import sqlite3
import uuid
from contextlib import contextmanager, asynccontextmanager
from datetime import datetime, timezone
from pathlib import Path
from typing import Annotated, Literal

from fastapi import Depends, FastAPI, HTTPException, Request, Response
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, ConfigDict, Field, StringConstraints

from migrations import migrate_turkish_text

BASE = Path(__file__).resolve().parent
DATABASE = Path(os.environ.get("QUIZLY_DB", str(BASE / "data" / "quizly.db")))
Text = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=500)]
Category = Literal["Science", "Technology", "Geography", "Arts & Culture", "History", "General Knowledge", "Mathematics", "Nature"]
Difficulty = Literal["Easy", "Medium", "Hard"]
Confidence = Literal["low", "medium", "high"]
CATEGORIES = json.loads((BASE / "categories.json").read_text(encoding="utf-8-sig"))


@contextmanager
def database():
    conn = sqlite3.connect(DATABASE, timeout=15)
    conn.row_factory = sqlite3.Row
    try:
        with conn:
            yield conn
    finally:
        conn.close()


@asynccontextmanager
async def lifespan(app):
    DATABASE.parent.mkdir(parents=True, exist_ok=True)
    with database() as db:
        db.executescript("""
        CREATE TABLE IF NOT EXISTS quizzes (id TEXT PRIMARY KEY, owner TEXT, content TEXT NOT NULL);
        CREATE TABLE IF NOT EXISTS bookmarks (owner TEXT, quiz_id TEXT, PRIMARY KEY(owner, quiz_id));
        CREATE TABLE IF NOT EXISTS attempts (
            id TEXT PRIMARY KEY, owner TEXT NOT NULL, quiz_id TEXT NOT NULL,
            started TEXT NOT NULL, content TEXT NOT NULL, result TEXT);
        """)
        for quiz in json.loads((BASE / "quizzes.json").read_text(encoding="utf-8-sig")):
            db.execute("INSERT OR IGNORE INTO quizzes VALUES (?, NULL, ?)", (quiz["id"], json.dumps(quiz)))
        migrate_turkish_text(db)
    yield


app = FastAPI(title="Quizly API", version="1.0.0", lifespan=lifespan)
app.mount("/static", StaticFiles(directory=BASE / "static"), name="static")


def visitor(request: Request, response: Response):
    cookie = request.cookies.get("quizly_visitor", "")
    try:
        return str(uuid.UUID(cookie))
    except ValueError:
        value = str(uuid.uuid4())
        response.set_cookie("quizly_visitor", value, max_age=31536000, httponly=True,
                            samesite="strict", secure=request.url.scheme == "https")
        return value


Visitor = Annotated[str, Depends(visitor)]


def get_quiz(db, quiz_id, owner):
    row = db.execute("SELECT content FROM quizzes WHERE id=? AND (owner IS NULL OR owner=?)",
                     (quiz_id, owner)).fetchone()
    if not row:
        raise HTTPException(404, "Test bulunamadı.")
    return json.loads(row["content"])


def summary(quiz):
    return {**{k: v for k, v in quiz.items() if k != "questions"},
            "question_count": len(quiz["questions"]), "minutes": max(1, len(quiz["questions"]))}


@app.get("/", include_in_schema=False)
def index():
    return FileResponse(BASE / "static" / "index.html")


@app.get("/api/quizzes")
def quizzes(owner: Visitor):
    with database() as db:
        rows = db.execute("SELECT content FROM quizzes WHERE owner IS NULL OR owner=?", (owner,)).fetchall()
        saved = {r[0] for r in db.execute("SELECT quiz_id FROM bookmarks WHERE owner=?", (owner,))}
    return [{**summary(json.loads(r["content"])), "saved": json.loads(r["content"])["id"] in saved} for r in rows]


class Bookmark(BaseModel):
    saved: bool


@app.put("/api/quizzes/{quiz_id}/bookmark")
def bookmark(quiz_id: str, body: Bookmark, owner: Visitor):
    with database() as db:
        get_quiz(db, quiz_id, owner)
        if body.saved:
            db.execute("INSERT OR IGNORE INTO bookmarks VALUES (?, ?)", (owner, quiz_id))
        else:
            db.execute("DELETE FROM bookmarks WHERE owner=? AND quiz_id=?", (owner, quiz_id))
    return body


class Question(BaseModel):
    model_config = ConfigDict(extra="forbid")
    text: Text
    options: list[Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=200)]] = Field(min_length=4, max_length=4)
    correct: int = Field(ge=0, le=3, strict=True)
    explanation: Text


class NewQuiz(BaseModel):
    model_config = ConfigDict(extra="forbid")
    title: Annotated[str, StringConstraints(strip_whitespace=True, min_length=3, max_length=80)]
    description: Annotated[str, StringConstraints(strip_whitespace=True, min_length=3, max_length=180)]
    category: Category
    difficulty: Difficulty
    questions: list[Question] = Field(min_length=1, max_length=20)


@app.post("/api/quizzes", status_code=201)
def create_quiz(body: NewQuiz, owner: Visitor):
    quiz = {**body.model_dump(), "id": str(uuid.uuid4()), "custom": True}
    with database() as db:
        db.execute("INSERT INTO quizzes VALUES (?, ?, ?)", (quiz["id"], owner, json.dumps(quiz)))
    return {**summary(quiz), "saved": False}


def create_attempt(db, quiz, owner):
    attempt_id = str(uuid.uuid4())
    db.execute("INSERT INTO attempts VALUES (?, ?, ?, ?, ?, NULL)",
               (attempt_id, owner, quiz["id"], datetime.now(timezone.utc).isoformat(), json.dumps(quiz)))
    return {"id": attempt_id, "quiz": summary(quiz), "questions": [
        {"text": q["text"], "options": q["options"]} for q in quiz["questions"]]}


@app.post("/api/quizzes/{quiz_id}/attempts", status_code=201)
def start_quiz(quiz_id: str, owner: Visitor):
    with database() as db:
        return create_attempt(db, get_quiz(db, quiz_id, owner), owner)


@app.post("/api/attempts/{attempt_id}/practice", status_code=201)
def practice_wrong_answers(attempt_id: str, owner: Visitor):
    with database() as db:
        row = db.execute("SELECT content, result FROM attempts WHERE id=? AND owner=?", (attempt_id, owner)).fetchone()
        if row is None:
            raise HTTPException(404, "Test denemesi bulunamadı.")
        if row["result"] is None:
            raise HTTPException(409, "Tekrar çalışması için önce testi tamamla.")
        result = json.loads(row["result"])
        snapshot = json.loads(row["content"])
        wrong = [question for question, review in zip(snapshot["questions"], result["review"])
                 if not review["is_correct"]]
        if not wrong:
            raise HTTPException(409, "Bu denemede yanlış yanıtın yok.")
        original_title = snapshot.get("original_title", snapshot["title"])
        practice = {**snapshot, "title": "Tekrar: " + original_title,
                    "description": "Yanlış yanıtladığın sorularla bilgilerini pekiştir.",
                    "questions": wrong, "practice": True, "source_attempt_id": attempt_id,
                    "original_title": original_title}
        return create_attempt(db, practice, owner)


class Submission(BaseModel):
    answers: list[Annotated[int, Field(ge=0, le=3, strict=True)]] = Field(min_length=1, max_length=20)
    confidence: list[Confidence | None] | None = Field(default=None, min_length=1, max_length=20)


@app.post("/api/attempts/{attempt_id}/submit")
def submit(attempt_id: str, body: Submission, owner: Visitor):
    with database() as db:
        db.execute("BEGIN IMMEDIATE")
        row = db.execute("SELECT * FROM attempts WHERE id=? AND owner=?", (attempt_id, owner)).fetchone()
        if not row:
            raise HTTPException(404, "Test denemesi bulunamadı.")
        if row["result"]:
            return json.loads(row["result"])
        quiz = json.loads(row["content"])
        if len(body.answers) != len(quiz["questions"]):
            raise HTTPException(422, "Göndermeden önce lütfen tüm soruları yanıtla.")
        if body.confidence is not None and len(body.confidence) != len(body.answers):
            raise HTTPException(422, "Güven düzeyleri soru sayısıyla eşleşmeli.")
        confidence = body.confidence if body.confidence is not None else [None] * len(body.answers)
        review = [{**q, "selected": answer, "is_correct": answer == q["correct"], "confidence": level}
                  for q, answer, level in zip(quiz["questions"], body.answers, confidence)]
        correct = sum(q["is_correct"] for q in review)
        now = datetime.now(timezone.utc)
        result = {"id": attempt_id, "quiz_id": quiz["id"], "title": quiz["title"],
                  "category": quiz["category"], "correct": correct, "total": len(review),
                  "score": round(correct / len(review) * 100), "completed": now.isoformat(),
                  "seconds": max(0, int((now - datetime.fromisoformat(row["started"])).total_seconds())),
                  "review": review, "practice": quiz.get("practice", False),
                  "high_confidence_wrong": sum(q["confidence"] == "high" and not q["is_correct"] for q in review)}
        if quiz.get("practice"):
            result["source_attempt_id"] = quiz["source_attempt_id"]
        db.execute("UPDATE attempts SET result=? WHERE id=?", (json.dumps(result), attempt_id))
    return result


@app.get("/api/progress")
def progress(owner: Visitor):
    with database() as db:
        results = [json.loads(r[0]) for r in db.execute(
            "SELECT result FROM attempts WHERE owner=? AND result IS NOT NULL ORDER BY started DESC", (owner,))]
    regular = [result for result in results if not result.get("practice")]
    return {"attempts": results, "completed": len(regular), "practice_completed": len(results) - len(regular),
            "average": round(sum(r["score"] for r in regular) / len(regular)) if regular else 0,
            "best": max((r["score"] for r in regular), default=0),
            "correct": sum(r["correct"] for r in regular)}


@app.get("/api/categories")
def categories(owner: Visitor):
    with database() as db:
        quizzes = [json.loads(row[0]) for row in db.execute(
            "SELECT content FROM quizzes WHERE owner IS NULL OR owner=?", (owner,))]
    return [{**category, "quiz_count": sum(quiz["category"] == category["id"] for quiz in quizzes),
             "question_count": sum(len(quiz["questions"]) for quiz in quizzes if quiz["category"] == category["id"])}
            for category in CATEGORIES]
