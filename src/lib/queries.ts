export const VIEWER_QUERY = /* GraphQL */ `
  query Viewer {
    viewer {
      id
      name
      email
      organization {
        id
        urlKey
      }
    }
  }
`;

export interface ViewerResponse {
  viewer: {
    id: string;
    name: string;
    email: string;
    organization: {
      id: string;
      urlKey: string;
    };
  };
}

export const ISSUES_QUERY = /* GraphQL */ `
  query Issues($first: Int!, $filter: IssueFilter) {
    issues(first: $first, filter: $filter) {
      nodes {
        id
        identifier
        title
        url
        startedAt
        createdAt
        dueDate
        estimate
        state {
          id
          name
          type
          color
        }
        assignee {
          id
          name
          avatarUrl
        }
        project {
          id
          name
          startDate
          targetDate
        }
        team {
          id
          name
          key
        }
        cycle {
          id
          number
          startsAt
          endsAt
        }
        relations {
          nodes {
            type
            relatedIssue {
              id
            }
          }
        }
      }
      pageInfo {
        hasNextPage
        endCursor
      }
    }
  }
`;

export interface IssuesResponse {
  issues: {
    nodes: IssueNode[];
    pageInfo: { hasNextPage: boolean; endCursor: string | null };
  };
}

export interface IssueNode {
  assignee: { id: string; name: string; avatarUrl: string | null } | null;
  createdAt: string;
  cycle: {
    id: string;
    number: number;
    startsAt: string;
    endsAt: string;
  } | null;
  dueDate: string | null;
  estimate: number | null;
  id: string;
  identifier: string;
  project: {
    id: string;
    name: string;
    startDate: string | null;
    targetDate: string | null;
  } | null;
  relations: {
    nodes: {
      type: string;
      relatedIssue: { id: string } | null;
    }[];
  };
  startedAt: string | null;
  state: { id: string; name: string; type: string; color: string };
  team: { id: string; name: string; key: string };
  title: string;
  url: string;
}

export const ISSUE_SET_DUE_MUTATION = /* GraphQL */ `
  mutation IssueSetDue($id: String!, $dueDate: TimelessDate) {
    issueUpdate(id: $id, input: { dueDate: $dueDate }) {
      success
      issue {
        id
        dueDate
      }
    }
  }
`;

export interface IssueSetDueResponse {
  issueUpdate: {
    success: boolean;
    issue: { id: string; dueDate: string | null };
  };
}

export const ISSUE_SET_TITLE_MUTATION = /* GraphQL */ `
  mutation IssueSetTitle($id: String!, $title: String!) {
    issueUpdate(id: $id, input: { title: $title }) {
      success
      issue {
        id
        title
      }
    }
  }
`;

export interface IssueSetTitleResponse {
  issueUpdate: {
    success: boolean;
    issue: { id: string; title: string };
  };
}

export const PROJECTS_QUERY = /* GraphQL */ `
  query Projects($first: Int!) {
    projects(first: $first) {
      nodes {
        id
        name
        url
        color
        progress
        startDate
        targetDate
        lead {
          id
          name
        }
        projectMilestones {
          nodes {
            id
            name
            targetDate
          }
        }
      }
    }
  }
`;

export interface ProjectMilestone {
  id: string;
  name: string;
  targetDate: string | null;
}

export interface ProjectNode {
  color: string;
  id: string;
  lead: { id: string; name: string } | null;
  name: string;
  progress: number;
  projectMilestones: { nodes: ProjectMilestone[] };
  startDate: string | null;
  targetDate: string | null;
  url: string;
}

export interface ProjectsResponse {
  projects: { nodes: ProjectNode[] };
}

export const PROJECT_SET_DATES_MUTATION = /* GraphQL */ `
  mutation ProjectSetDates(
    $id: String!
    $startDate: TimelessDate
    $targetDate: TimelessDate
  ) {
    projectUpdate(
      id: $id
      input: { startDate: $startDate, targetDate: $targetDate }
    ) {
      success
      project {
        id
        startDate
        targetDate
      }
    }
  }
`;

export interface ProjectSetDatesResponse {
  projectUpdate: {
    success: boolean;
    project: {
      id: string;
      startDate: string | null;
      targetDate: string | null;
    };
  };
}
