"""One-time data migrations for existing installations."""

import json
from pathlib import Path


def migrate_turkish_text(db):
    """Translate built-in quiz text without changing answers, scores, or custom content."""
    migration = "001_turkish_text"
    db.execute("CREATE TABLE IF NOT EXISTS schema_migrations (name TEXT PRIMARY KEY)")
    if db.execute("SELECT 1 FROM schema_migrations WHERE name=?", (migration,)).fetchone():
        return
    translations = json.loads((Path(__file__).parent / "turkish_text.json").read_text(encoding="utf-8"))

    def translate(value):
        if isinstance(value, dict):
            return {key: translate(item) for key, item in value.items()}
        if isinstance(value, list):
            return [translate(item) for item in value]
        if isinstance(value, str):
            return translations.get(value, value)
        return value

    # Only the app's six built-in quizzes are translated. User-authored text stays intact.
    for quiz_id in ("science", "technology", "geography", "culture", "history", "general"):
        row = db.execute("SELECT content FROM quizzes WHERE id=? AND owner IS NULL", (quiz_id,)).fetchone()
        if row is None:
            continue
        content = json.dumps(translate(json.loads(row["content"])), ensure_ascii=False)
        db.execute("UPDATE quizzes SET content=? WHERE id=? AND owner IS NULL", (content, quiz_id))
        for attempt in db.execute("SELECT id, content, result FROM attempts WHERE quiz_id=?", (quiz_id,)).fetchall():
            snapshot = json.dumps(translate(json.loads(attempt["content"])), ensure_ascii=False)
            result = (json.dumps(translate(json.loads(attempt["result"])), ensure_ascii=False)
                      if attempt["result"] is not None else None)
            db.execute("UPDATE attempts SET content=?, result=? WHERE id=?", (snapshot, result, attempt["id"]))
    db.execute("INSERT INTO schema_migrations VALUES (?)", (migration,))
