#!/usr/bin/env python3
"""Export navimba.com cookies from Chrome (macOS) → .navimba-cookies.json"""
import hashlib
import json
import os
import shutil
import sqlite3
import subprocess
import sys
import tempfile
from datetime import datetime, timezone
from pathlib import Path

from Cryptodome.Cipher import AES

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / ".navimba-cookies.json"
CHROME_COOKIES = Path.home() / "Library/Application Support/Google/Chrome/Default/Cookies"
SALT = b"saltysalt"
ITER = 1003
PHPBB_PREFIX = "phpbb3_"


def chrome_key():
    pw = subprocess.check_output(["security", "find-generic-password", "-wa", "Chrome"]).strip()
    return hashlib.pbkdf2_hmac("sha1", pw, SALT, ITER, dklen=16)


def decrypt_cookie(raw, key):
    if raw[:3] != b"v10":
        return None
    cipher = AES.new(key, AES.MODE_CBC, IV=b" " * 16)
    dec = cipher.decrypt(raw[3:])
    pad = dec[-1]
    if 1 <= pad <= 16:
        dec = dec[:-pad]
    if len(dec) > 32:
        dec = dec[32:]
    text = dec.decode("utf-8", errors="replace")
    # Drop failed decrypts (binary garbage)
    if not text or any(ord(c) < 32 and c not in "\t\n\r" for c in text):
        return None
    return text


def main():
    profile = os.environ.get("CHROME_PROFILE", "Default")
    cookies_path = Path.home() / "Library/Application Support/Google/Chrome" / profile / "Cookies"
    if not cookies_path.exists():
        print(f"Chrome cookies not found: {cookies_path}", file=sys.stderr)
        sys.exit(1)

    key = chrome_key()
    tmp = tempfile.NamedTemporaryFile(delete=False, suffix=".db")
    tmp.close()
    shutil.copy2(cookies_path, tmp.name)

    conn = sqlite3.connect(tmp.name)
    rows = conn.execute(
        "SELECT name, encrypted_value FROM cookies WHERE host_key LIKE '%navimba.com%'"
    ).fetchall()
    conn.close()
    os.unlink(tmp.name)

    cookies = {}
    for name, enc in rows:
        val = decrypt_cookie(enc, key)
        if val:
            cookies[name] = val

    user_id = cookies.get(f"{PHPBB_PREFIX}ae6de_u") or next(
        (v for k, v in cookies.items() if k.endswith("_u")), "?"
    )
    logged_in = str(user_id) not in ("1", "?", "")

    data = {
        "savedAt": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
        "user": os.environ.get("NAVIMBA_USER", "Svetlika"),
        "source": f"chrome-{profile.lower()}",
        "loggedIn": logged_in,
        "phpbbUserId": user_id,
        "cookies": cookies,
    }
    OUT.write_text(json.dumps(data, indent=2, ensure_ascii=False) + "\n")
    print(f"Saved {len(cookies)} cookies → {OUT}")
    print(f"Logged in: {logged_in} (user id {user_id})")
    return 0 if logged_in else 1


if __name__ == "__main__":
    raise SystemExit(main())
