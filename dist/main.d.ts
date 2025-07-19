interface AIAnalysis {
    root_cause: string;
    team_responsible: string;
    suggested_solution: string;
}
declare class JenkinsRun {
    statusUrl: string;
    directory: string;
    jobName: string;
    branch: string;
    buildNumber: string;
    constructor(statusUrl: string);
}
declare function main(): Promise<void>;
declare function analyzeLog(logContent: string): Promise<AIAnalysis>;
declare function sendSlackMessageToThread(message: string, slackToken: string, channel: string, threadTs: string): Promise<void>;
export { main, JenkinsRun, analyzeLog, sendSlackMessageToThread };
//# sourceMappingURL=main.d.ts.map