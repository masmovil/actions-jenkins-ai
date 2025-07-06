import json
import os
import requests
import tempfile
from google.cloud import storage
from google.cloud import aiplatform  # Import Vertex AI client
from vertexai.preview.generative_models import GenerativeModel, Part  # For Gemini models via Vertex AI

STATUS_URL = os.environ.get('STATUS_URL')
SLACK_TOKEN = os.environ.get('SLACK_ACCESS_TOKEN')
THREAD_TS = os.environ.get('SLACK_MESSAGE_THREAD_TS')
CHANNEL = os.environ.get('SLACK_CHANNEL')
GCP_SA = os.environ.get('GCP_SA')

PROJECT_ID = "mm-swe-sta"
REGION = "europe-west1"
GEMINI_MODEL_NAME = "gemini-2.5-flash"

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

    print('🚀 Starting Jenkins AI analysis')

    jenkins_run = JenkinsRun(STATUS_URL)

    authenticate_gcp()

    # Download the console.log file from Google Cloud Storage
    console_log_content = download_console_log(jenkins_run)

    message = ('Hello :wave:! This is the :robot_face: Jenkins AI analysis for '
               '<{}|job> `{}/{}`, branch `{}`, build number `{}`:').format(STATUS_URL,
                                                       jenkins_run.directory,
                                                       jenkins_run.job_name,
                                                       jenkins_run.branch,
                                                       jenkins_run.build_number)
    send_slack_message_to_thread(message)

    # Analyze the log
    ai_analysis = analyze_log(console_log_content)

    ai_analysis_message = f"""
:robot_face: *Jenkins AI Analysis* :sparkles:

* :mag_right: *Likely Root Cause:* {ai_analysis.get('root_cause', 'Not identified')}

* :handshake: *Team responsible:* {ai_analysis.get('team_responsible', 'Not identified')}

* :bulb: *Suggested Solution/Next Steps:* {ai_analysis.get('suggested_solution', 'Not identified')}
    """

    send_slack_message_to_thread(ai_analysis_message)

    return

def validate_environment_variables():
    if not STATUS_URL or not SLACK_TOKEN or not THREAD_TS or not CHANNEL or not GCP_SA:
        print('Error: One or more required environment variables are not set.')
        print('Please ensure STATUS_URL, SLACK_ACCESS_TOKEN, SLACK_MESSAGE_THREAD_TS, SLACK_CHANNEL and GCP_SA are set.')
        exit(1)
    return

def authenticate_gcp():
    # Write GCP_SA contents to a temporary file and set the env variable
    with tempfile.NamedTemporaryFile(mode='w', delete=False) as temp_cred_file:
        temp_cred_file.write(GCP_SA)
        temp_cred_file.flush()
        os.environ["GOOGLE_APPLICATION_CREDENTIALS"] = temp_cred_file.name

    # Initialize the Vertex AI client
    aiplatform.init(project=PROJECT_ID, location=REGION)
    return

def download_console_log(jenkins_run):
    bucket_name = "mm-platform-sre-prod-jenkins-logs"
    blob_path = f"ci-masstack/{jenkins_run.directory}/{jenkins_run.job_name}/{jenkins_run.branch}/{jenkins_run.build_number}/console.log"
    try:
        client = storage.Client()
        bucket = client.bucket(bucket_name)
        blob = bucket.blob(blob_path)
        content = blob.download_as_text()
    except Exception as e:
        print(f"Error downloading console.log from GCS: {e}")
        print(f"Bucket: {bucket_name}, Blob Path: {blob_path}")
        exit(1)
    return content

def analyze_log(log_content):
    # 1. Prepare prompt for Gemini API
    prompt_text = """
    Analyze the following Jenkins log for a failed pipeline. We use Bazel and we code in Java with Vert.x, Go and React.
    For test jobs, we use both unit tests and acceptance tests.
    Identify the core issue, cause, and suggest a concise solution or next steps.
    Focus on extracting the most critical error messages and context.
    The cause is usually found in the last lines of the log.

    Format your response as follows, using a JSON structure. Return a valid JSON, without any additional text or formatting.
    For file names or paths, format with backticks "`".
    ---
    "{
        "root_cause": [Concise explanation of the root cause, e.g., "Maven build failed due to missing dependency", "Unit test failures", "Deployment timeout", "Disk space issue"],
        "team_responsible": [Team name, e.g., "mas-billing", "provision", "corporate-erp". The team is usually specified in the path, 2 levels after pkg directory. If the issue does not seem to be related to code, the "platform" team is responsible.],
        "suggested_solution": [Provide actionable steps to resolve the issue, e.g., "Check pom.xml for correct dependency", "Review unit test reports", "Increase deployment timeout", "Clean up disk space on agent"]
    }"
    ---

    Here is the Jenkins log:
    ---
    %s
    ---
    """ % log_content

    try:
        # 2. Call Gemini API via Vertex AI
        print(f"Calling Gemini API via Vertex AI with model: {GEMINI_MODEL_NAME}")
        generation_config = {
            "temperature": 0.2,  # Lower temperature for more factual, less creative output
            "top_p": 0.9,
            "top_k": 40
        }

        model = GenerativeModel(GEMINI_MODEL_NAME)

        # When using GenerativeModel from vertexai.preview.generative_models,
        # you pass the prompt directly as a string or a list of Parts
        response = model.generate_content(
            prompt_text,
            generation_config=generation_config
        )

        ai_analysis = response.text
        print(f"Gemini API Response:\n{ai_analysis}")

        # Example response:
        # ```json
        # {
        #     "root_cause": "Go unit test failure: A mocked service method (GetRatingCaseConversion) was called more times than expected within the 'TestSetCDRsRatingCaseConversion' test, indicating a mismatch between test expectations and code behavior or an issue with the test logic.",
        #     "team_responsible": "mas-billing",
        #     "suggested_solution": "Review the 'TestSetCDRsRatingCaseConversion' unit test in 'pkg/mas-stack/bss/mas-billing/rating-engine/engine/debit_service_test.go'. Verify the mock setup for 'GetRatingCaseConversion' to ensure its expected call count aligns with the actual calls. Debug the 'debit_service.go' logic to understand why the unexpected call is occurring. Also, investigate the 'recordTypeNotSupported' error as it might be related to the test data or the logic being tested."
        # }
        # ```

        # Clean up the response to ensure it is valid JSON
        ai_analysis = '\n'.join(ai_analysis.split('\n')[1:-1])  # Remove the first and last lines (they are not part of the JSON)

        return json.loads(ai_analysis)

    except Exception as e:
        print(f"Error during AI analysis: {e}")
        exit(1)

def send_slack_message_to_thread(message):
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
