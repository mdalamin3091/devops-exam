#!/usr/bin/env bash
# ============================================================
#  EXAM ISOLATION FILE 
# ============================================================

# 1) short prefix (only lowercase letters, no space). যেমন: alamin -> am
PFX="alamin"

# 2) student number (1..6).
N=1

# ------------- নিচের কিছু হাত দিও না -------------
PORT_BASE=$(( 30000 + N * 100 ))
APP1_PORT=$(( PORT_BASE + 1 ))     # backend 1   
APP2_PORT=$(( PORT_BASE + 2 ))     # backend 2   
NGINX_PORT=$(( PORT_BASE + 80 ))   # nginx       
USERPORT=$(( PORT_BASE + 9 ))      # A2 normal user process 

# --- Scenario B (docker) ---
APP_PORT=$(( PORT_BASE + 3 ))      # compose app   
SWARM_PORT=$(( PORT_BASE + 4 ))    # swarm stack  
PG_PORT=$(( PORT_BASE + 5 ))       # postgres      
PROM_PORT=$(( PORT_BASE + 90 ))    # prometheus    
GRAF_PORT=$(( PORT_BASE + 91 ))    # grafana       

COMPOSE_PROJECT_NAME="notes_${PFX}"   # container/network/volume সব এই নামে হবে
IMAGE="notes-api_${PFX}"              # local image নাম
STACK="notes_${PFX}"                  # swarm stack নাম

APPDIR="/srv/app_${PFX}"
SVC="myapp_${PFX}"
SVC2="myapp2_${PFX}"
APPUSER="myappuser_${PFX}"
HCLOG="/var/log/healthcheck_${PFX}.log"

export PFX N PORT_BASE APP1_PORT APP2_PORT NGINX_PORT MYSTERY_PORT USERPORT
export APPDIR SVC SVC2 APPUSER HCLOG
export APP_PORT SWARM_PORT PG_PORT PROM_PORT GRAF_PORT
export COMPOSE_PROJECT_NAME IMAGE STACK

echo "PFX=$PFX N=$N"
echo "APP1=$APP1_PORT APP2=$APP2_PORT NGINX=$NGINX_PORT MYSTERY=$MYSTERY_PORT USERPORT=$USERPORT"
echo "APPDIR=$APPDIR SVC=$SVC USER=$APPUSER"
echo "APP=$APP_PORT SWARM=$SWARM_PORT PG=$PG_PORT PROM=$PROM_PORT GRAFANA=$GRAF_PORT"
echo "PROJECT=$COMPOSE_PROJECT_NAME IMAGE=$IMAGE STACK=$STACK"
