import pathlib
p = pathlib.Path('/etc/nginx/sites-enabled/aletheia')
text = p.read_text()
needle = '        proxy_pass http://127.0.0.1:3000;\n'
insert = needle + '        proxy_redirect http://localhost:3000/ https://avaterra.pro/;\n        proxy_redirect https://localhost:3000/ https://avaterra.pro/;\n'
if 'proxy_redirect http://localhost:3000/' not in text:
    if needle not in text:
        raise SystemExit('needle missing')
    # only last occurrence in location /
    idx = text.rfind(needle)
    text = text[:idx] + insert + text[idx+len(needle):]
    p.write_text(text)
    print('patched')
else:
    print('already')
