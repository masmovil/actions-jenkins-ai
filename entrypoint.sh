#!/bin/sh -l

echo 'Running entrypoint'

STATUS_URL="$1"
SLACK_ACCESS_TOKEN="$2"
SLACK_MESSAGE_THREAD_TS="$3"
SLACK_CHANNEL="$4"
GCP_SA="$5"

export STATUS_URL
export SLACK_ACCESS_TOKEN
export SLACK_MESSAGE_THREAD_TS
export SLACK_CHANNEL
export GCP_SA

pip3 install --no-cache-dir -r /requirements.txt
python3 /main.py

echo 'Running entrypoint done'
