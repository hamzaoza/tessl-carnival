#!/usr/bin/env node

// JIT board queue. Each run:
//   1. moves In progress cards that have an open <BRANCH_PREFIX><n> PR to In review,
//      while In review has fewer than REVIEW_LIMIT cards (oldest first);
//   2. fills free In progress slots from Ready (first in, first out), adding LABEL,
//      which starts the agent.

// --- Configure ---
const WIP_LIMIT = 3;
const REVIEW_LIMIT = 3;
const PROJECT_OWNER_TYPE = 'user'; // "user" or "organization"
const PROJECT_OWNER = 'hamzaoza';
const PROJECT_NUMBER = 5; // from the board URL: .../projects/<number>
const PROJECT_TITLE = 'Carnival Board'; // must match exactly, or the run stops
const LABEL = 'tessl';
const BRANCH_PREFIX = 'tessl/issue-'; // keep in sync with the workflow's `if:`
const STATUS_FIELD = 'Status';
const STATUS = { ready: 'Ready', inProgress: 'In progress', inReview: 'In review' };
const AGENT_FIELD = 'Agent';
const AGENT_OPTION = 'Tessl';
// -----------------

const { PROJECT_TOKEN, GITHUB_TOKEN, GITHUB_REPOSITORY } = process.env;
const DRY_RUN = process.env.DRY_RUN === 'true';

async function request(url, token, options = {}) {
  const res = await fetch(url, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github+json',
      'Content-Type': 'application/json',
    },
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`${res.status} ${url}: ${text}`);
  return text ? JSON.parse(text) : null;
}

async function graphql(query, variables = {}) {
  const body = await request('https://api.github.com/graphql', PROJECT_TOKEN, {
    method: 'POST',
    body: JSON.stringify({ query, variables }),
  });
  if (body.errors) throw new Error(JSON.stringify(body.errors));
  return body.data;
}

const rest = (path, options) => request(`https://api.github.com${path}`, GITHUB_TOKEN, options);

const sameName = (a, b) => a?.toLowerCase() === b.toLowerCase();

async function findProject() {
  const data = await graphql(
    `
            query ($login: String!, $number: Int!) {
                owner: ${PROJECT_OWNER_TYPE}(login: $login) {
                    projectV2(number: $number) {
                        id
                        title
                        fields(first: 50) {
                            nodes {
                                ... on ProjectV2SingleSelectField {
                                    id
                                    name
                                    options {
                                        id
                                        name
                                    }
                                }
                            }
                        }
                    }
                }
            }
        `,
    { login: PROJECT_OWNER, number: PROJECT_NUMBER },
  );
  return data.owner?.projectV2;
}

async function loadItems(projectId) {
  const items = [];
  let cursor = null;
  do {
    const data = await graphql(
      `
        query ($id: ID!, $cursor: String, $status: String!) {
          node(id: $id) {
            ... on ProjectV2 {
              items(first: 100, after: $cursor) {
                pageInfo {
                  hasNextPage
                  endCursor
                }
                nodes {
                  id
                  content {
                    __typename
                    ... on Issue {
                      number
                      state
                      repository {
                        nameWithOwner
                      }
                    }
                  }
                  status: fieldValueByName(name: $status) {
                    ... on ProjectV2ItemFieldSingleSelectValue {
                      name
                      updatedAt
                    }
                  }
                }
              }
            }
          }
        }
      `,
      { id: projectId, cursor, status: STATUS_FIELD },
    );
    const page = data.node.items;
    items.push(...page.nodes);
    cursor = page.pageInfo.hasNextPage ? page.pageInfo.endCursor : null;
  } while (cursor);
  return items;
}

async function main() {
  if (!PROJECT_TOKEN) {
    console.log('PROJECT_TOKEN is not set; nothing to do.');
    return;
  }

  // Fail before any write if the pinned number doesn't point at the expected board.
  const project = await findProject();
  if (!project) throw new Error(`Project ${PROJECT_NUMBER} for ${PROJECT_OWNER} not found.`);
  if (project.title !== PROJECT_TITLE) {
    throw new Error(
      `Project ${PROJECT_NUMBER} is titled "${project.title}", expected "${PROJECT_TITLE}". Nothing was changed.`,
    );
  }

  const field = (name) => project.fields.nodes.find((f) => sameName(f.name, name));
  const option = (f, name) => f?.options.find((o) => sameName(o.name, name));
  const statusField = field(STATUS_FIELD);
  const agentField = field(AGENT_FIELD);
  const status = {
    ready: option(statusField, STATUS.ready),
    inProgress: option(statusField, STATUS.inProgress),
    inReview: option(statusField, STATUS.inReview),
  };
  const agent = option(agentField, AGENT_OPTION);
  if (!statusField || !status.ready || !status.inProgress || !status.inReview) {
    console.log(
      `${STATUS_FIELD} field or its Ready / In progress / In review options are missing; nothing to do.`,
    );
    return;
  }
  if (!agent)
    console.log(
      `Warning: no ${AGENT_FIELD} field with a ${AGENT_OPTION} option; it will not be set.`,
    );

  const setField = (item, fieldId, optionId) =>
    graphql(
      `
        mutation ($project: ID!, $item: ID!, $field: ID!, $option: String!) {
          updateProjectV2ItemFieldValue(
            input: {
              projectId: $project
              itemId: $item
              fieldId: $field
              value: { singleSelectOptionId: $option }
            }
          ) {
            projectV2Item {
              id
            }
          }
        }
      `,
      { project: project.id, item: item.id, field: fieldId, option: optionId },
    );

  const items = await loadItems(project.id);
  const inColumn = (opt) =>
    items
      .filter((i) => i.status?.name === opt.name)
      .sort((a, b) => a.status.updatedAt.localeCompare(b.status.updatedAt));
  const isOurIssue = (i) => i.content?.repository?.nameWithOwner === GITHUB_REPOSITORY;
  // A card can still sit in Ready for a moment after its issue closes.
  const isOpen = (i) => i.content.state === 'OPEN';
  // Without access to the issue's repo, GitHub returns no content (or no repository) for the card.
  // Draft issues and other repos' issues are skipped on purpose and not counted here.
  const isUnreadable = (i) =>
    !i.content || (i.content.__typename === 'Issue' && !i.content.repository);

  const inProgress = inColumn(status.inProgress);
  let inProgressCount = inProgress.length;
  let inReviewCount = inColumn(status.inReview).length;
  console.log(
    `In progress: ${inProgressCount}/${WIP_LIMIT}, In review: ${inReviewCount}/${REVIEW_LIMIT}`,
  );
  const unreadable = [...inProgress, ...inColumn(status.ready)].filter(isUnreadable).length;
  if (unreadable > 0) {
    console.log(
      `Warning: ${unreadable} card(s) in Ready/In progress skipped: can't read their issue. If the repo is private, PROJECT_TOKEN needs the \`repo\` scope as well as \`project\`.`,
    );
  }
  if (DRY_RUN) console.log('Dry run: no changes will be made.');

  // 1. In progress -> In review, while In review has room.
  const [owner] = GITHUB_REPOSITORY.split('/');
  for (const item of inProgress.filter(isOurIssue)) {
    if (inReviewCount >= REVIEW_LIMIT) break;
    const n = item.content.number;
    const head = encodeURIComponent(`${owner}:${BRANCH_PREFIX}${n}`);
    const pulls = await rest(`/repos/${GITHUB_REPOSITORY}/pulls?state=open&head=${head}`);
    if (pulls.length === 0) continue;
    console.log(`#${n}: open PR ${pulls[0].html_url}, moving to In review`);
    if (!DRY_RUN) await setField(item, statusField.id, status.inReview.id);
    inReviewCount++;
    inProgressCount--;
  }

  // 2. Ready -> In progress, while In progress has room.
  for (const item of inColumn(status.ready).filter(isOurIssue).filter(isOpen)) {
    if (inProgressCount >= WIP_LIMIT) break;
    const n = item.content.number;
    console.log(`#${n}: pulling from Ready into In progress`);
    if (!DRY_RUN) {
      // PROJECT_TOKEN, not GITHUB_TOKEN: the factory only starts on a label a person's account adds.
      await request(
        `https://api.github.com/repos/${GITHUB_REPOSITORY}/issues/${n}/labels`,
        PROJECT_TOKEN,
        {
          method: 'POST',
          body: JSON.stringify({ labels: [LABEL] }),
        },
      );
      await setField(item, statusField.id, status.inProgress.id);
      if (agent) await setField(item, agentField.id, agent.id);
    }
    inProgressCount++;
  }

  console.log(
    `Done. In progress: ${inProgressCount}/${WIP_LIMIT}, In review: ${inReviewCount}/${REVIEW_LIMIT}`,
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
