#!/bin/bash
source /opt/mailcow-dockerized/mailcow.conf
echo after_source DBUSER_len=${#DBUSER} DBNAME=$DBNAME
echo ========== 2 Mailcow MySQL api ==========
docker exec mailcowdockerized-mysql-mailcow-1 mysql -u$DBUSER -p$DBPASS $DBNAME --batch --silent -e "SELECT COUNT(*) AS api_rows FROM api;"
docker exec mailcowdockerized-mysql-mailcow-1 mysql -u$DBUSER -p$DBPASS $DBNAME --batch -e "SELECT active, access, LENGTH(api_key) AS key_len FROM api WHERE active=1 LIMIT 3;" 2>&1
echo all api rows up to 5:
docker exec mailcowdockerized-mysql-mailcow-1 mysql -u$DBUSER -p$DBPASS $DBNAME --batch -e "SELECT active, access, LENGTH(api_key) AS key_len FROM api LIMIT 5;" 2>&1
echo active=1 count:
docker exec mailcowdockerized-mysql-mailcow-1 mysql -u$DBUSER -p$DBPASS $DBNAME --batch --silent -e "SELECT COUNT(*) FROM api WHERE active=1;"
