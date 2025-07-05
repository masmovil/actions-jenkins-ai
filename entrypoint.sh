#!/bin/sh -l

echo 'Running entrypoint'

SLACK_ACCESS_TOKEN="$1"
SLACK_MESSAGE_THREAD_TS="$2"
SLACK_CHANNEL="$3"

export SLACK_ACCESS_TOKEN
export SLACK_MESSAGE_THREAD_TS
export SLACK_CHANNEL

pip3 install --no-cache-dir -r /requirements.txt
python3 /main.py

echo 'Running entrypoint done'
