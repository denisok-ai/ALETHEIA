#!/usr/bin/env python3
import base64, json, sys, urllib.parse as u
from pathlib import Path

key = Path("/etc/aletheia/outline-access.key").read_text().strip()
frag = key.split("#", 1)[0]
p = u.urlparse(frag)
host = p.hostname
port = p.port or 8388
userinfo = p.username or (p.netloc.rsplit("@", 1)[0] if "@" in p.netloc else "")
pad = "=" * ((4 - len(userinfo) % 4) % 4)
method, password = base64.urlsafe_b64decode(userinfo + pad).decode().split(":", 1)
q = u.parse_qs(p.query)
prefix_raw = u.unquote(q.get("prefix", [""])[0]) if q.get("prefix") else ""
prefix_b64 = base64.b64encode(prefix_raw.encode("latin1")).decode() if prefix_raw else ""
cfg = {
    "server": host,
    "server_port": port,
    "method": method,
    "password": password,
    "local_address": "127.0.0.1",
    "local_port": 1080,
    "timeout": 300,
}
if prefix_b64:
    cfg["plugin"] = "stream-prefix"
    cfg["plugin_opts"] = f"prefix={prefix_b64}"
out = Path("/etc/shadowsocks-libev/outline-telegram.json")
out.parent.mkdir(parents=True, exist_ok=True)
out.write_text(json.dumps(cfg, indent=2))
out.chmod(0o600)
print("ok", "prefix=yes" if prefix_b64 else "prefix=no")
