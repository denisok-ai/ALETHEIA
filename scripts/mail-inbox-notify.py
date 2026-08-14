#!/usr/bin/env python3
"""
Уведомление в Telegram о НОВЫХ входящих письмах в ящиках avaterra.pro,
КРОМЕ служебных (DMARC-отчёты, mailer-daemon, postmaster, no-reply и наши
собственные адреса @avaterra.pro).

Зачем: письма клиентов падают в admin@avaterra.pro (туда же алиас
notifications@), но ящик никто не проверяет — письмо Елизаветы (жалоба на
демо-курс) висело непрочитанным. Этот сторож сообщает о живой почте сразу.

Как: doveadm выдаёт письма с UID больше запомненного (по ящику), служебные
отсеиваются, тема декодируется, ссыла уходит в Telegram через HTTPS_PROXY.
Состояние (последний UID на ящик) — /var/lib/aletheia-mail-notify/state.json.
Первый прогон по ящику только запоминает текущий максимум (без спама истории).

Cron: раз в 10 мин (/etc/cron.d/aletheia-mail-inbox-notify).
"""
import json
import os
import re
import subprocess
import sys
import urllib.parse
import urllib.request
from email.header import decode_header

ENV_FILE = os.environ.get("ENV_FILE", "/opt/ALETHEIA/.env")
DB = os.environ.get("PROD_DB", "/opt/ALETHEIA/prisma/dev.db")
STATE_DIR = "/var/lib/aletheia-mail-notify"
STATE_FILE = os.path.join(STATE_DIR, "state.json")
DOVECOT = "mailcowdockerized-dovecot-mailcow-1"
MAILBOXES = [
    "admin@avaterra.pro",
    "info@avaterra.pro",
    "support@avaterra.pro",
    "tatyana@avaterra.pro",
    "yarik@avaterra.pro",
]
# Служебные отправители — не тревожим.
SERVICE_RE = re.compile(
    r"(dmarc|mailer-daemon|postmaster|no-?reply|@avaterra\.pro)", re.IGNORECASE
)


def read_env(path):
    out = {}
    try:
        with open(path, encoding="utf-8", errors="replace") as f:
            for line in f:
                m = re.match(r"^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*?)\s*$", line)
                if m:
                    out[m.group(1)] = m.group(2).strip().strip('"').strip("'")
    except OSError:
        pass
    return out


def load_state():
    try:
        with open(STATE_FILE, encoding="utf-8") as f:
            return json.load(f)
    except (OSError, ValueError):
        return {}


def save_state(state):
    os.makedirs(STATE_DIR, exist_ok=True)
    tmp = STATE_FILE + ".tmp"
    with open(tmp, "w", encoding="utf-8") as f:
        json.dump(state, f)
    os.replace(tmp, STATE_FILE)


def dec(s):
    if not s:
        return ""
    try:
        return "".join(
            p.decode(enc or "utf-8", "replace") if isinstance(p, bytes) else p
            for p, enc in decode_header(s)
        ).strip()
    except Exception:
        return s.strip()


def doveadm_fetch(mailbox, since_uid):
    """Список писем ящика с uid > since_uid: [(uid, from, subject, date)]."""
    query = ["mailbox", "INBOX"]
    if since_uid > 0:
        query += ["uid", f"{since_uid + 1}:*"]
    else:
        query += ["all"]
    try:
        raw = subprocess.run(
            ["docker", "exec", DOVECOT, "doveadm", "fetch", "-u", mailbox,
             "uid hdr.from hdr.subject hdr.date", *query],
            capture_output=True, text=True, timeout=60,
        ).stdout
    except (subprocess.SubprocessError, OSError):
        return []
    records = []
    for block in raw.split("\x0c"):
        fields, key = {}, None
        for line in block.splitlines():
            m = re.match(r"^(uid|hdr\.from|hdr\.subject|hdr\.date):\s?(.*)$", line)
            if m:
                key = m.group(1)
                fields[key] = m.group(2)
            elif key and line.startswith(" "):
                fields[key] += line  # продолжение (длинная тема)
        if "uid" in fields:
            try:
                uid = int(fields["uid"].strip())
            except ValueError:
                continue
            records.append((uid, fields.get("hdr.from", ""),
                            fields.get("hdr.subject", ""), fields.get("hdr.date", "")))
    return records


def tg_send(token, proxy, chat_ids, text):
    opener = urllib.request.build_opener(
        urllib.request.ProxyHandler({"https": proxy, "http": proxy}) if proxy
        else urllib.request.ProxyHandler({})
    )
    for cid in chat_ids:
        data = urllib.parse.urlencode({"chat_id": cid, "text": text}).encode()
        try:
            opener.open(
                f"https://api.telegram.org/bot{token}/sendMessage", data, timeout=25
            ).read()
        except Exception as e:
            print(f"tg send fail {cid}: {e}", file=sys.stderr)


def main():
    env = read_env(ENV_FILE)
    token = env.get("TELEGRAM_BOT_TOKEN", "")
    proxy = env.get("HTTPS_PROXY", "")
    if not token:
        print("нет TELEGRAM_BOT_TOKEN", file=sys.stderr)
        return
    try:
        chat_ids = [
            c.strip() for c in subprocess.run(
                ["sqlite3", "-readonly", DB,
                 "SELECT value FROM SystemSetting WHERE key='telegram_admin_chat_ids';"],
                capture_output=True, text=True, timeout=15,
            ).stdout.strip().split(",") if c.strip()
        ]
    except (subprocess.SubprocessError, OSError):
        chat_ids = []
    if not chat_ids:
        print("нет chat_ids", file=sys.stderr)
        return

    state = load_state()
    for mbox in MAILBOXES:
        known = mbox in state
        last = int(state.get(mbox, 0))
        recs = doveadm_fetch(mbox, last if known else 0)
        max_uid = max((r[0] for r in recs), default=last)
        if not known:
            # Первый раз видим ящик: запоминаем текущий максимум (0 для пустого),
            # без алертов — иначе спам всей истории. Дальше уведомляем о новом.
            state[mbox] = max((r[0] for r in recs), default=0)
            continue
        for uid, frm, subj, date in sorted(recs):
            if uid <= last:
                continue
            if SERVICE_RE.search(frm):
                continue  # служебное (DMARC, mailer-daemon, no-reply, свой домен)
            frm_d, subj_d = dec(frm), dec(subj) or "(без темы)"
            tg_send(token, proxy, chat_ids,
                    f"📩 AVATERRA · Новое письмо ({mbox})\n"
                    f"От: {frm_d}\n"
                    f"Тема: {subj_d}\n"
                    f"{date.strip()}")
        if recs:
            state[mbox] = max(max_uid, last)
    save_state(state)


if __name__ == "__main__":
    main()
