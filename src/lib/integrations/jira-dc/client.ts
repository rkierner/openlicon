import type {
  JiraDcWorklog,
  JiraDcSearchResponse,
  JiraDcWorklogResponse,
  JiraDcMyselfResponse,
} from "./types";

/**
 * Jira Data Center REST API v2 client.
 *
 * Authentication: Personal Access Token (supported since Jira DC 8.14).
 * Uses "Authorization: Bearer <pat>" header.
 *
 * Note: Jira Cloud uses OAuth2 and a different API shape — that is a separate adapter.
 */
export class JiraDcClient {
  private readonly baseUrl: string;

  constructor(
    baseUrl: string,
    private readonly pat: string
  ) {
    // Normalize: strip trailing slash
    this.baseUrl = baseUrl.replace(/\/$/, "");
  }

  private get headers(): Record<string, string> {
    return {
      Authorization: `Bearer ${this.pat}`,
      "Content-Type": "application/json",
      Accept: "application/json",
    };
  }

  private async request<T>(path: string, options?: RequestInit): Promise<T> {
    const url = `${this.baseUrl}${path}`;
    const res = await fetch(url, { ...options, headers: this.headers });

    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw new Error(
        `Jira DC API error ${res.status} ${res.statusText} on ${path}: ${body}`
      );
    }

    return res.json() as Promise<T>;
  }

  /**
   * Tests connectivity by calling /rest/api/2/myself.
   * Returns the authenticated user's name and display name, or throws.
   */
  async testConnection(): Promise<{ name: string; displayName: string }> {
    const data = await this.request<JiraDcMyselfResponse>("/rest/api/2/myself");
    return { name: data.name, displayName: data.displayName };
  }

  /**
   * Returns all issues that have worklogs authored by the given Jira username
   * within the specified date range, using JQL search.
   *
   * Handles pagination automatically (up to 1000 issues total per call).
   */
  private async searchIssuesWithWorklogs(
    username: string,
    weekStart: Date,
    weekEnd: Date
  ): Promise<Array<{ id: string; key: string; projectKey: string }>> {
    const fmt = (d: Date) =>
      `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

    const jql = `worklogAuthor = "${username}" AND worklogDate >= "${fmt(weekStart)}" AND worklogDate <= "${fmt(weekEnd)}"`;

    const results: Array<{ id: string; key: string; projectKey: string }> = [];
    let startAt = 0;
    const maxResults = 100;

    while (true) {
      const data = await this.request<JiraDcSearchResponse>("/rest/api/2/search", {
        method: "POST",
        body: JSON.stringify({
          jql,
          fields: ["summary", "project"],
          maxResults,
          startAt,
        }),
      });

      for (const issue of data.issues) {
        results.push({
          id: issue.id,
          key: issue.key,
          projectKey: issue.fields.project.key,
        });
      }

      startAt += data.issues.length;
      if (startAt >= data.total || data.issues.length === 0) break;
      if (results.length >= 1000) break; // safety cap
    }

    return results;
  }

  /**
   * Fetches worklogs for a single issue, filtered to the given author and date range.
   */
  private async getWorklogsForIssue(
    issue: { id: string; key: string; projectKey: string },
    username: string,
    weekStart: Date,
    weekEnd: Date
  ): Promise<JiraDcWorklog[]> {
    let startAt = 0;
    const maxResults = 100;
    const worklogs: JiraDcWorklog[] = [];

    while (true) {
      const data = await this.request<JiraDcWorklogResponse>(
        `/rest/api/2/issue/${issue.key}/worklog?startAt=${startAt}&maxResults=${maxResults}`
      );

      for (const wl of data.worklogs) {
        if (wl.author.name !== username) continue;
        const started = new Date(wl.started);
        if (started < weekStart || started > weekEnd) continue;

        worklogs.push({
          id: wl.id,
          issueId: issue.id,
          issueKey: issue.key,
          projectKey: issue.projectKey,
          author: wl.author,
          started: wl.started,
          timeSpentSeconds: wl.timeSpentSeconds,
          comment: wl.comment,
        });
      }

      startAt += data.worklogs.length;
      if (startAt >= data.total || data.worklogs.length === 0) break;
    }

    return worklogs;
  }

  /**
   * Returns all worklogs for the given Jira DC username during the specified week.
   * Combines JQL issue search and per-issue worklog fetching.
   */
  async getWeeklyWorklogs(
    username: string,
    weekStart: Date,
    weekEnd: Date
  ): Promise<JiraDcWorklog[]> {
    const issues = await this.searchIssuesWithWorklogs(username, weekStart, weekEnd);

    const allWorklogs: JiraDcWorklog[] = [];
    for (const issue of issues) {
      const worklogs = await this.getWorklogsForIssue(issue, username, weekStart, weekEnd);
      allWorklogs.push(...worklogs);
    }

    return allWorklogs;
  }
}
