#!/usr/bin/env python3
"""Serve the static site and a shared calendar store.

Usage:
    python server.py [port]

The API is available at /api/events:
    GET    /api/events        list all events
    POST   /api/events        create an event
    PATCH  /api/events/<id>   update an event
    DELETE /api/events/<id>   delete an event

Events are written to data/events.json. The file is created on the first
write. This server uses only the Python standard library.

For a LAN preview bind to all interfaces:
    HOST=0.0.0.0 python server.py 8000
"""

from __future__ import annotations

import json
import os
import re
import sys
import threading
import time
import uuid
from datetime import date
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import unquote, urlsplit

ROOT = Path(__file__).resolve().parent
DATA_FILE = ROOT / "data" / "events.json"
API_PATH = "/api/events"
STORAGE_VERSION = 1
MAX_EVENTS = 500
MAX_BODY = 64 * 1024
CATEGORIES = {"sensor", "funk", "workshop", "milestone"}
DATE_RE = re.compile(r"^\d{4}-\d{2}-\d{2}$")
TIME_RE = re.compile(r"^([01]\d|2[0-3]):[0-5]\d$")
ID_RE = re.compile(r"^[A-Za-z0-9._:-]{1,96}$")
ITEM_RE = re.compile(r"^/api/events/([A-Za-z0-9._:-]{1,96})$")
STORE_LOCK = threading.Lock()


def backup_corrupt_store() -> None:
    try:
        target = DATA_FILE.with_name(f"events.corrupt-{int(time.time())}.json")
        DATA_FILE.replace(target)
    except OSError:
        pass


def sanitize_event(payload: dict, fallback_id: str | None = None) -> dict:
    if not isinstance(payload, dict):
        raise ValueError("Event must be an object")

    event_id = str(payload.get("id") or fallback_id or f"evt-{uuid.uuid4()}")
    if not ID_RE.fullmatch(event_id):
        raise ValueError("Invalid event id")

    event_date = str(payload.get("date") or "")
    if not DATE_RE.fullmatch(event_date):
        raise ValueError("Invalid date")
    try:
        parsed_date = date.fromisoformat(event_date)
    except ValueError as exc:
        raise ValueError("Invalid date") from exc
    if parsed_date.isoformat() != event_date:
        raise ValueError("Invalid date")

    event_time = str(payload.get("time") or "")
    if not TIME_RE.fullmatch(event_time):
        raise ValueError("Invalid time")

    title = str(payload.get("title") or "").strip()
    if not title:
        raise ValueError("Title is required")
    title = title[:64]

    category = str(payload.get("cat") or "")
    if category not in CATEGORIES:
        raise ValueError("Unknown category")

    description = str(payload.get("desc") or "").strip()[:220]

    return {
        "id": event_id,
        "date": event_date,
        "time": event_time,
        "title": title,
        "cat": category,
        "desc": description,
        "done": payload.get("done") is True,
    }


def load_events() -> list[dict]:
    if not DATA_FILE.exists():
        return []

    try:
        with DATA_FILE.open("r", encoding="utf-8") as handle:
            payload = json.load(handle)
    except (OSError, json.JSONDecodeError):
        backup_corrupt_store()
        return []

    if isinstance(payload, dict):
        raw_events = payload.get("events")
    else:
        raw_events = payload
    if not isinstance(raw_events, list):
        return []

    events: list[dict] = []
    seen: set[str] = set()
    for raw in raw_events[:MAX_EVENTS]:
        try:
            event = sanitize_event(raw)
        except (TypeError, ValueError):
            continue
        if event["id"] in seen:
            continue
        seen.add(event["id"])
        events.append(event)
    return events


def save_events(events: list[dict]) -> None:
    DATA_FILE.parent.mkdir(parents=True, exist_ok=True)
    temporary = DATA_FILE.with_suffix(".json.tmp")
    with temporary.open("w", encoding="utf-8", newline="\n") as handle:
        json.dump(
            {"version": STORAGE_VERSION, "events": events},
            handle,
            ensure_ascii=False,
            indent=2,
        )
        handle.write("\n")
        handle.flush()
        os.fsync(handle.fileno())
    os.replace(temporary, DATA_FILE)


class CalendarHandler(SimpleHTTPRequestHandler):
    server_version = "AgoraCalendar/1.0"

    def __init__(self, *args, **kwargs) -> None:
        super().__init__(*args, directory=str(ROOT), **kwargs)

    def end_headers(self) -> None:
        if self.path.startswith("/api/"):
            self.send_header("Cache-Control", "no-store")
        self.send_header("X-Content-Type-Options", "nosniff")
        super().end_headers()

    def do_GET(self) -> None:
        path = self.current_path()
        if self.is_blocked(path):
            self.send_error(404)
            return
        if path in (API_PATH, f"{API_PATH}/"):
            self.list_events()
            return
        if path.startswith("/api/"):
            self.send_json(404, {"error": "Not found"})
            return
        super().do_GET()

    def current_path(self) -> str:
        """Return a decoded, normalized URL path.

        SimpleHTTPRequestHandler normalizes ``..`` segments later, so the
        blocklist has to look at the same final path. Backslashes are treated
        as separators because this project is served on Windows as well.
        """
        path = unquote(urlsplit(self.path).path).replace("\\", "/")
        if "\x00" in path:
            return "/\x00"
        parts: list[str] = []
        for part in path.split("/"):
            if part in ("", "."):
                continue
            if part == "..":
                if parts:
                    parts.pop()
                continue
            parts.append(part)
        return "/" + "/".join(parts)

    @staticmethod
    def is_blocked(path: str) -> bool:
        if any(part.startswith(".") for part in path.split("/") if part):
            return True
        return path in ("/data", "/server.py") or path.startswith("/data/")

    def do_POST(self) -> None:
        path = self.current_path()
        if path in (API_PATH, f"{API_PATH}/"):
            self.create_event()
            return
        if path.startswith("/api/"):
            self.send_json(404, {"error": "Not found"})
            return
        self.send_json(405, {"error": "Method not allowed"})

    def do_PATCH(self) -> None:
        path = self.current_path()
        match = ITEM_RE.fullmatch(path)
        if match:
            self.update_event(match.group(1))
            return
        self.send_json(404 if path.startswith("/api/") else 405, {"error": "Not found"})

    def do_DELETE(self) -> None:
        path = self.current_path()
        match = ITEM_RE.fullmatch(path)
        if match:
            self.delete_event(match.group(1))
            return
        self.send_json(404 if path.startswith("/api/") else 405, {"error": "Not found"})

    def do_OPTIONS(self) -> None:
        if not self.current_path().startswith("/api/"):
            self.send_response(204)
            self.end_headers()
            return
        self.send_response(204)
        self.send_header("Allow", "GET, POST, PATCH, DELETE, OPTIONS")
        self.end_headers()

    def read_json(self) -> dict:
        try:
            length = int(self.headers.get("Content-Length") or 0)
        except ValueError as exc:
            raise ValueError("Invalid Content-Length") from exc
        if length <= 0:
            raise ValueError("Request body is required")
        if length > MAX_BODY:
            raise ValueError("Request body is too large")

        raw = self.rfile.read(length)
        try:
            payload = json.loads(raw.decode("utf-8"))
        except (UnicodeDecodeError, json.JSONDecodeError) as exc:
            raise ValueError("Invalid JSON") from exc
        if not isinstance(payload, dict):
            raise ValueError("Request body must be an object")
        return payload

    def send_json(self, status: int, payload: dict) -> None:
        body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def list_events(self) -> None:
        with STORE_LOCK:
            events = load_events()
        self.send_json(
            200,
            {"version": STORAGE_VERSION, "storage": "global", "events": events},
        )

    def create_event(self) -> None:
        try:
            payload = self.read_json()
            event = sanitize_event(payload)
        except ValueError as exc:
            self.send_json(400, {"error": str(exc)})
            return

        with STORE_LOCK:
            events = load_events()
            if any(existing["id"] == event["id"] for existing in events):
                self.send_json(409, {"error": "Event id already exists"})
                return
            if len(events) >= MAX_EVENTS:
                self.send_json(409, {"error": "Event limit reached"})
                return
            events.append(event)
            save_events(events)

        self.send_json(201, {"event": event})

    def update_event(self, event_id: str) -> None:
        try:
            payload = self.read_json()
        except ValueError as exc:
            self.send_json(400, {"error": str(exc)})
            return

        with STORE_LOCK:
            events = load_events()
            index = next((i for i, event in enumerate(events) if event["id"] == event_id), None)
            if index is None:
                self.send_json(404, {"error": "Event not found"})
                return
            try:
                updated = sanitize_event({**events[index], **payload, "id": event_id})
            except ValueError as exc:
                self.send_json(400, {"error": str(exc)})
                return
            events[index] = updated
            save_events(events)

        self.send_json(200, {"event": updated})

    def delete_event(self, event_id: str) -> None:
        with STORE_LOCK:
            events = load_events()
            remaining = [event for event in events if event["id"] != event_id]
            if len(remaining) == len(events):
                self.send_json(404, {"error": "Event not found"})
                return
            save_events(remaining)

        self.send_response(204)
        self.end_headers()


def main() -> None:
    port = int(sys.argv[1]) if len(sys.argv) > 1 else int(os.environ.get("PORT", "8000"))
    host = os.environ.get("HOST", "127.0.0.1")
    server = ThreadingHTTPServer((host, port), CalendarHandler)
    print(f"Serving {ROOT} at http://{host}:{port}")
    print(f"Global calendar data: {DATA_FILE}")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        server.server_close()


if __name__ == "__main__":
    main()
