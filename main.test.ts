import { JenkinsRun } from './main';

describe('JenkinsRun', () => {
  test('should parse Jenkins URL correctly', () => {
    const statusUrl = 'https://ci-masstack.masstack.com/job/mas-stack/job/mm-monorepo-build/job/PR-70374/1/display/redirect';
    const jenkinsRun = new JenkinsRun(statusUrl);

    expect(jenkinsRun.directory).toBe('mas-stack');
    expect(jenkinsRun.jobName).toBe('mm-monorepo-build');
    expect(jenkinsRun.branch).toBe('PR-70374');
    expect(jenkinsRun.buildNumber).toBe('1');
  });

  test('should throw error for invalid URL format', () => {
    const invalidUrl = 'https://invalid-url.com';
    
    expect(() => {
      new JenkinsRun(invalidUrl);
    }).toThrow('Invalid status URL format');
  });

  test('should handle URL without display/redirect suffix', () => {
    const statusUrl = 'https://ci-masstack.masstack.com/job/mas-stack/job/mm-monorepo-build/job/PR-70374/1';
    const jenkinsRun = new JenkinsRun(statusUrl);

    expect(jenkinsRun.directory).toBe('mas-stack');
    expect(jenkinsRun.jobName).toBe('mm-monorepo-build');
    expect(jenkinsRun.branch).toBe('PR-70374');
    expect(jenkinsRun.buildNumber).toBe('1');
  });
});
