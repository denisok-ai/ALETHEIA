#!/usr/bin/env python3
import base64, json, urllib.parse as u
from pathlib import Path

key = Path("/etc/aletheia/outline-access.key").read_text().strip()
frag = key.split("#", 1)[0]
p = u.urlparse(frag)
userinfo = p.username or (p.netloc.rsplit("@", 1)[0] if "@" in p.netloc else "")
pad = "=" * ((4 - len(userinfo) % 4) % 4)
method, password = base64.urlsafe_b64decode(userinfo + pad).decode().split(":", 1)
outbound = {
    "type": "shadowsocks",
    "tag": "outline",
    "server": p.hostname,
    "server_port": p.port or 8388,
    "method": method,
    "password": password,
}
cfg = {
    "log": {"level": "warn"},
    "inbounds": [{"type": "socks", "tag": "in", "listen": "127.0.0.1", "listen_port": 1080}],
    "outbounds": [outbound, {"type": "direct", "tag": "direct"}],
    "route": {"final": "outline"},
}
Path("/etc/sing-box/outline-telegram.json").write_text(json.dumps(cfg, indent=2))
print(method)
