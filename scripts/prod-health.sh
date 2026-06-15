#!/bin/bash
cd /home/denisok/projects/AVATERRA
source scripts/.deploy.env 2>/dev/null || true
KEY="${DEPLOY_SSH_KEY:-$HOME/.ssh/avaterra_deploy_nopass}"
ssh -i "$KEY" -o IdentitiesOnly=yes root@95.181.224.70 "curl -sS http://127.0.0.1:3000/api/health | head -c 200"
