#!/bin/bash
echo ========== 1 .env ==========
grep -q ^MAILCOW_API_KEY= /opt/ALETHEIA/.env && (echo -n MAILCOW_API_KEY: present length=; grep ^MAILCOW_API_KEY= /opt/ALETHEIA/.env | cut -d= -f2- | wc -c) || echo MAILCOW_API_KEY: NOT SET
grep -q ^MAIL_PROVISIONING_MODE= /opt/ALETHEIA/.env && (echo -n MAIL_PROVISIONING_MODE: present value=; grep ^MAIL_PROVISIONING_MODE= /opt/ALETHEIA/.env | cut -d= -f2-) || echo MAIL_PROVISIONING_MODE: NOT SET
grep -q ^CRON_SECRET= /opt/ALETHEIA/.env && (echo -n CRON_SECRET: present length=; grep ^CRON_SECRET= /opt/ALETHEIA/.env | cut -d= -f2- | wc -c) || echo CRON_SECRET: NOT SET