import * as core from '@actions/core';
import { Storage } from '@google-cloud/storage';
import { VertexAI } from '@google-cloud/vertexai';
import axios from 'axios';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

interface AIAnalysis {
  root_cause: string;
  team_responsible: string;
  suggested_solution: string;
}

interface JenkinsRunInfo {
  statusUrl: string;
  directory: string;
  jobName: string;
  branch: string;
  buildNumber: string;
}

const PROJECT_ID = "mm-swe-prod";
const REGION = "europe-west1";
const GEMINI_MODEL_NAME = "gemini-2.5-flash";

class JenkinsRun {
  public statusUrl: string;
  public directory: string;
  public jobName: string;
  public branch: string;
  public buildNumber: string;

  constructor(statusUrl: string) {
    this.statusUrl = statusUrl;

    // Extract metadata from the status URL
    // Example status_url: https://ci-masstack.masstack.com/job/mas-stack/job/mm-monorepo-build/job/PR-70374/1/display/redirect
    const url = this.statusUrl.replace('/display/redirect', '');

    // https://ci-masstack.masstack.com/job/mas-stack/job/mm-monorepo-build/job/PR-70374/1
    const parts = url.split('/job/');
    // 0. https://ci-masstack.masstack.com
    // 1. mas-stack
    // 2. mm-monorepo-build
    // 3. PR-70374/1
    if (parts.length < 4) {
      throw new Error(`Invalid status URL format. Expected at least 4 parts after "/job/": ${url}`);
    }
    this.directory = parts[1];
    this.jobName = parts[2];
    const branchAndBuild = parts[3].split('/');
    this.branch = branchAndBuild[0];
    this.buildNumber = branchAndBuild[1];
  }
}

async function main(): Promise<void> {
  try {
    core.info('🚀 Starting Jenkins AI analysis');

    // Get inputs
    const statusUrl = core.getInput('status-url', { required: true });
    const slackToken = core.getInput('slack-access-token', { required: true });
    const threadTs = core.getInput('slack-message-thread-ts', { required: true });
    const channel = core.getInput('slack-channel', { required: true });
    const gcpSa = core.getInput('gcp-sa', { required: true });

    validateInputs(statusUrl, slackToken, threadTs, channel, gcpSa);

    const jenkinsRun = new JenkinsRun(statusUrl);

    await authenticateGcp(gcpSa);

    // Download the console.log file from Google Cloud Storage
    const consoleLogContent = await downloadConsoleLog(jenkinsRun);

    const message = `Hello :wave:! This is the :robot_face: Jenkins AI analysis for ` +
      `<${statusUrl}|job> \`${jenkinsRun.directory}/${jenkinsRun.jobName}\`, branch \`${jenkinsRun.branch}\`, build number \`${jenkinsRun.buildNumber}\`:`;
    
    await sendSlackMessageToThread(message, slackToken, channel, threadTs);

    // Analyze the log
    const aiAnalysis = await analyzeLog(consoleLogContent);

    const aiAnalysisMessage = `
:robot_face: *Jenkins AI Analysis* :sparkles:

* :mag_right: *Likely Root Cause:* ${aiAnalysis.root_cause || 'Not identified'}

* :handshake: *Team responsible:* ${aiAnalysis.team_responsible || 'Not identified'}

* :bulb: *Suggested Solution/Next Steps:* ${aiAnalysis.suggested_solution || 'Not identified'}
`;

    await sendSlackMessageToThread(aiAnalysisMessage, slackToken, channel, threadTs);

    core.info('✅ Jenkins AI analysis completed successfully');
  } catch (error) {
    core.setFailed(`Action failed: ${error instanceof Error ? error.message : String(error)}`);
  }
}

function validateInputs(statusUrl: string, slackToken: string, threadTs: string, channel: string, gcpSa: string): void {
  if (!statusUrl || !slackToken || !threadTs || !channel || !gcpSa) {
    throw new Error('One or more required inputs are not set. Please ensure status-url, slack-access-token, slack-message-thread-ts, slack-channel and gcp-sa are set.');
  }
}

async function authenticateGcp(gcpSa: string): Promise<void> {
  // Write GCP_SA contents to a temporary file and set the env variable
  const tempDir = os.tmpdir();
  const tempCredFile = path.join(tempDir, `gcp-credentials-${Date.now()}.json`);
  
  try {
    fs.writeFileSync(tempCredFile, gcpSa);
    process.env.GOOGLE_APPLICATION_CREDENTIALS = tempCredFile;
    core.info('GCP authentication configured');
  } catch (error) {
    throw new Error(`Failed to write GCP credentials: ${error instanceof Error ? error.message : String(error)}`);
  }
}

async function downloadConsoleLog(jenkinsRun: JenkinsRun): Promise<string> {
  const bucketName = "mm-platform-sre-prod-jenkins-logs";
  const blobPath = `ci-masstack/${jenkinsRun.directory}/${jenkinsRun.jobName}/${jenkinsRun.branch}/${jenkinsRun.buildNumber}/console.log`;
  
  try {
    const storage = new Storage();
    const bucket = storage.bucket(bucketName);
    const file = bucket.file(blobPath);
    
    const [content] = await file.download();
    return content.toString('utf-8');
  } catch (error) {
    core.error(`Error downloading console.log from GCS: ${error instanceof Error ? error.message : String(error)}`);
    core.error(`Bucket: ${bucketName}, Blob Path: ${blobPath}`);
    throw error;
  }
}

async function analyzeLog(logContent: string): Promise<AIAnalysis> {
  const promptText = `
    Analyze the following Jenkins log for a failed pipeline. We use Bazel and we code in Java with Vert.x, Go and React.
    For test jobs, we use both unit tests and acceptance tests.
    Identify the core issue, cause, and suggest a concise solution or next steps.
    Focus on extracting the most critical error messages and context.
    The cause is usually found in the last lines of the log.

    Format your response as follows, using a JSON structure. Return a valid JSON, without any additional text or formatting.
    For file names or paths, format with backticks "\`".
    ---
    "{
        "root_cause": [Concise explanation of the root cause, e.g., "Maven build failed due to missing dependency", "Unit test failures", "Deployment timeout", "Disk space issue"],
        "team_responsible": [Team name, e.g., "mas-billing", "provision", "corporate-erp". The team is usually specified in the path, 2 levels after pkg directory. If the issue does not seem to be related to code, the "platform" team is responsible.],
        "suggested_solution": [Provide actionable steps to resolve the issue, e.g., "Check pom.xml for correct dependency", "Review unit test reports", "Increase deployment timeout", "Clean up disk space on agent"]
    }"
    ---

    Here is the Jenkins log:
    ---
    ${logContent}
    ---
  `;

  try {
    core.info(`Calling Gemini API via Vertex AI with model: ${GEMINI_MODEL_NAME}`);
    
    // Initialize the Vertex AI client
    const vertexAI = new VertexAI({
      project: PROJECT_ID,
      location: REGION
    });

    const model = vertexAI.getGenerativeModel({
      model: GEMINI_MODEL_NAME,
      generationConfig: {
        temperature: 0.2,
        topP: 0.9,
        topK: 40
      }
    });

    const response = await model.generateContent({
      contents: [
        {
          role: 'user',
          parts: [
            {
              text: promptText
            }
          ]
        }
      ]
    });

    const aiResponse = response.response.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!aiResponse) {
      throw new Error('Unexpected response format from Vertex AI');
    }

    core.info(`Gemini API Response:\n${aiResponse}`);

    // Clean up the response to ensure it is valid JSON
    const lines = aiResponse.split('\n');
    const jsonLines = lines.slice(1, -1); // Remove the first and last lines (they are not part of the JSON)
    const cleanedResponse = jsonLines.join('\n');

    return JSON.parse(cleanedResponse) as AIAnalysis;

  } catch (error) {
    core.error(`Error during AI analysis: ${error instanceof Error ? error.message : String(error)}`);
    throw error;
  }
}

async function sendSlackMessageToThread(message: string, slackToken: string, channel: string, threadTs: string): Promise<void> {
  const headers = {
    'Authorization': `Bearer ${slackToken}`,
    'Content-Type': 'application/json; charset=utf-8'
  };
  
  const payload = {
    channel: channel,
    text: message,
    thread_ts: threadTs
  };

  try {
    const response = await axios.post('https://slack.com/api/chat.postMessage', payload, { headers });
    
    if (response.status !== 200 || !response.data.ok) {
      throw new Error(`Slack API error: ${response.data.error || response.statusText}`);
    }
    
    core.info('Message successfully sent to the Slack thread.');
  } catch (error) {
    core.error(`Error sending message to Slack: ${error instanceof Error ? error.message : String(error)}`);
    throw error;
  }
}

// Run the action
if (require.main === module) {
  main();
}

export { main, JenkinsRun, analyzeLog, sendSlackMessageToThread };
