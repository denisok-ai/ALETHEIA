#!/bin/bash
echo ========== 5 InboundMailbox sqlite ==========
sqlite3 /opt/ALETHEIA/prisma/dev.db "SELECT im.username, im.lastSyncStatus, im.lastSyncError FROM InboundMailbox im;"