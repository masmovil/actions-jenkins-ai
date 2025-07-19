# Jenkins AI Action (TypeScript)

This GitHub Action analyzes Jenkins logs using AI (Google Vertex Gemini) and posts results to Slack.

## Features

- Fetches Jenkins console logs from Google Cloud Storage
- Analyzes logs using Google Vertex AI (Gemini)
- Posts AI analysis results to Slack threads
- Written in TypeScript for better maintainability and type safety

## Inputs

| Input | Description | Required |
|-------|-------------|----------|
| `status-url` | URL to the Jenkins job status page, used to fetch logs | Yes |
| `slack-access-token` | Access token for Slack, used to match commit emails to usernames | Yes |
| `slack-message-thread-ts` | Thread timestamp for Slack messages, used to post results in the same thread | Yes |
| `slack-channel` | Slack channel or user ID where the message is posted | Yes |
| `gcp-sa` | Google Cloud Service Account JSON, used for authentication with Google Cloud services | Yes |

## Usage

```yaml
name: Jenkins AI Analysis
on:
  workflow_dispatch:
    inputs:
      jenkins_url:
        description: 'Jenkins job URL'
        required: true
      slack_channel:
        description: 'Slack channel ID'
        required: true
      slack_thread_ts:
        description: 'Slack thread timestamp'
        required: true

jobs:
  analyze-jenkins-logs:
    runs-on: ubuntu-latest
    steps:
      - name: Analyze Jenkins Logs
        uses: masmovil/actions-jenkins-ai@main
        with:
          status-url: ${{ github.event.inputs.jenkins_url }}
          slack-access-token: ${{ secrets.SLACK_ACCESS_TOKEN }}
          slack-message-thread-ts: ${{ github.event.inputs.slack_thread_ts }}
          slack-channel: ${{ github.event.inputs.slack_channel }}
          gcp-sa: ${{ secrets.GCP_SERVICE_ACCOUNT }}
```

## Development

### Prerequisites

- Node.js 20+
- npm

### Setup

1. Clone the repository
2. Install dependencies:
   ```bash
   npm install
   ```

### Build

```bash
npm run build
```

This will:
1. Compile TypeScript to JavaScript
2. Bundle all dependencies into a single `dist/index.js` file using `ncc`

### Testing

#### Unit Tests
```bash
npm test
```

#### Integration Testing (Local Action Testing)

To test the action locally with real inputs, we provide a comprehensive test script that simulates the GitHub Actions environment.

##### Files Used for Testing

- **`test.js`** - Main test script that simulates GitHub Actions environment
- **`.env.example`** - Template file with placeholder values
- **`.env`** - Your local environment file (git-ignored, you need to create this)

##### How the Test Script Works

The test script (`test.js`) does the following:

1. **Loads environment variables** from `.env` file using `dotenv`
2. **Mocks the `@actions/core` module** to use environment variables as inputs
3. **Maps environment variables to action inputs**:
   - `STATUS_URL` → `status-url` input
   - `SLACK_ACCESS_TOKEN` → `slack-access-token` input
   - `SLACK_MESSAGE_THREAD_TS` → `slack-message-thread-ts` input
   - `SLACK_CHANNEL` → `slack-channel` input
   - `GCP_SA` → `gcp-sa` input
4. **Executes the action locally** with real API calls (but using test data)

##### Setting Up for Testing

1. **Create environment file**:
   ```bash
   cp .env.example .env
   ```

2. **Edit `.env` file** with your actual values:
   ```bash
   # Example values
   STATUS_URL=https://ci-masstack.masstack.com/job/mas-stack/job/mm-monorepo-build/job/PR-12345/1
   SLACK_ACCESS_TOKEN=
   SLACK_MESSAGE_THREAD_TS=1234567890.123456
   SLACK_CHANNEL=C1234567890
   GCP_SA={"type":"service_account","project_id":"mm-swe-prod",...}
   ```

3. **Run the local test**:
   ```bash
   npm run test:action
   ```

##### What You'll See

The test script provides detailed logging:

```
🧪 Starting Jenkins AI Action Test
=====================================
🔍 Checking environment variables...
✅ All required environment variables are set

📥 Input 'status-url': [SET]
📥 Input 'slack-access-token': [SET]
📥 Input 'slack-message-thread-ts': [SET]
📥 Input 'slack-channel': [SET]
📥 Input 'gcp-sa': [SET]
ℹ️  🚀 Starting Jenkins AI analysis
ℹ️  GCP authentication configured
ℹ️  Calling Gemini API via Vertex AI with model: gemini-2.5-flash
ℹ️  Gemini API Response:
{...}
ℹ️  Message successfully sent to the Slack thread.
ℹ️  ✅ Jenkins AI analysis completed successfully
✅ Test completed successfully!
```

## Project Structure

```
├── main.ts                  # Main TypeScript source code
├── main.test.ts             # Unit tests
├── test.js                  # Local testing script
├── dist/
│   ├── index.js             # Bundled JavaScript (auto-generated)
│   └── index.js.map         # Source map (auto-generated)
├── action.yml               # GitHub Action metadata
├── package.json             # Node.js dependencies and scripts
├── tsconfig.json            # TypeScript configuration
├── jest.config.js           # Jest testing configuration
├── .env.example             # Environment variables template
└── .gitignore              # Git ignore rules
```

## Contributing

1. Make changes to `main.ts`
2. Run tests: `npm test`
3. Build the project: `npm run build`
4. Commit both source and built files (`dist/` directory must be committed)

## License

MIT
