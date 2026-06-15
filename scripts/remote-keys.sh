#!/bin/bash
sqlite3 /opt/ALETHEIA/prisma/dev.db "SELECT key FROM SystemSetting ORDER BY key;"