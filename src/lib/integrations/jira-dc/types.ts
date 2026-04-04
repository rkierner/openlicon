// Jira Data Center REST API v2 types

export type JiraDcUser = {
  name: string;
  displayName: string;
  emailAddress?: string;
};

export type JiraDcWorklog = {
  id: string;
  issueId: string;
  issueKey: string;
  projectKey: string;           // extracted from issueKey prefix (e.g. "PROJ" from "PROJ-123")
  author: JiraDcUser;
  started: string;              // ISO-8601 datetime string from Jira
  timeSpentSeconds: number;
  comment?: string;
};

export type JiraDcIssue = {
  id: string;
  key: string;
  fields: {
    summary: string;
    project: {
      id: string;
      key: string;
      name: string;
    };
  };
};

export type JiraDcSearchResponse = {
  issues: JiraDcIssue[];
  total: number;
  maxResults: number;
  startAt: number;
};

export type JiraDcWorklogResponse = {
  worklogs: Array<{
    id: string;
    author: JiraDcUser;
    started: string;
    timeSpentSeconds: number;
    comment?: string;
  }>;
  total: number;
  maxResults: number;
  startAt: number;
};

export type JiraDcMyselfResponse = {
  name: string;
  displayName: string;
  emailAddress: string;
};
