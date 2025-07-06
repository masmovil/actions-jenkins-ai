import os
import requests

STATUS_URL = os.environ.get('STATUS_URL')
SLACK_TOKEN = os.environ.get('SLACK_ACCESS_TOKEN')
THREAD_TS = os.environ.get('SLACK_MESSAGE_THREAD_TS')
CHANNEL = os.environ.get('SLACK_CHANNEL')

class JenkinsRun:
    def __init__(self, status_url):
        self.status_url = status_url

        # Extract metadata from the status URL
        # Example status_url: https://ci-masstack.masstack.com/job/mas-stack/job/mm-monorepo-build/job/PR-70374/1/display/redirect
        url = self.status_url.replace('/display/redirect', '')

        # https://ci-masstack.masstack.com/job/mas-stack/job/mm-monorepo-build/job/PR-70374/1
        parts = url.split('/job/')
        # 0. https://ci-masstack.masstack.com
        # 1. mas-stack
        # 2. mm-monorepo-build
        # 3. PR-70374/1
        if len(parts) < 4:
            print('Error: Invalid status URL format. Expected at least 4 parts after "/job/": {}'.format(url))
            exit(1)
        self.directory = parts[1]
        self.job_name = parts[2]
        self.branch, self.build_number = parts[3].split('/')

        return

def main():
    validate_environment_variables()

    print('Starting Jenkins AI analysis')

    jenkins_run = JenkinsRun(STATUS_URL)

    message = ('Hello! This is the start of the Jenkins AI analysis for '
               '<{}|job> {}/{}, branch {}, build number {}').format(STATUS_URL,
                                                                          jenkins_run.directory,
                                                                          jenkins_run.job_name,
                                                                          jenkins_run.branch,
                                                                          jenkins_run.build_number),
    send_slack_message(message)

    return

def validate_environment_variables():
    if not STATUS_URL or not SLACK_TOKEN or not THREAD_TS or not CHANNEL:
        print('Error: One or more required environment variables are not set.')
        print('Please ensure STATUS_URL, SLACK_ACCESS_TOKEN, SLACK_MESSAGE_THREAD_TS, and SLACK_CHANNEL are set.')
        exit(1)
    return

def send_slack_message(message):
    headers = {
        'Authorization': f'Bearer {SLACK_TOKEN}',
        'Content-Type': 'application/json; charset=utf-8'
    }
    payload = {
        'channel': CHANNEL,
        'text': message,
        'thread_ts': THREAD_TS
    }
    response = requests.post('https://slack.com/api/chat.postMessage', json=payload, headers=headers)
    if response.status_code != 200 or not response.json().get('ok'):
        print('Error sending message to Slack:', response.text)
        exit(1)
    else:
        print('Message successfully sent to the Slack thread.')
    return


if __name__ == "__main__":
    main()
