import os
import requests

SLACK_TOKEN = os.environ.get('SLACK_ACCESS_TOKEN')
THREAD_TS = os.environ.get('SLACK_MESSAGE_THREAD_TS')
CHANNEL = os.environ.get('SLACK_CHANNEL')

if not SLACK_TOKEN or not THREAD_TS or not CHANNEL:
    print('Missing required environment variables.')
    exit(1)

headers = {
    'Authorization': f'Bearer {SLACK_TOKEN}',
    'Content-Type': 'application/json; charset=utf-8'
}

payload = {
    'channel': CHANNEL,
    'text': 'Hello! This is the start of the Jenkins AI analysis thread.',
    'thread_ts': THREAD_TS
}

response = requests.post('https://slack.com/api/chat.postMessage', json=payload, headers=headers)

if response.status_code != 200 or not response.json().get('ok'):
    print('Error sending message to Slack:', response.text)
    exit(1)
else:
    print('Message successfully sent to the Slack thread.')
