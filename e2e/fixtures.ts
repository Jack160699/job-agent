export const SAMPLE_RESUME = `John Doe
Software Engineer | john.doe@email.com | San Francisco, CA

SUMMARY
Full-stack software engineer with 5 years of experience building web applications
using React, TypeScript, Node.js, and PostgreSQL. Experienced with AWS, Docker,
and CI/CD pipelines.

EXPERIENCE
Senior Software Engineer | TechCorp | 2021 - Present
- Built React and Next.js applications serving 100K+ users
- Designed REST and GraphQL APIs with Node.js and PostgreSQL
- Deployed microservices on AWS using Docker and Kubernetes
- Led Agile team of 4 engineers

Software Engineer | StartupXYZ | 2019 - 2021
- Developed TypeScript frontend components with React
- Implemented automated testing with Jest and Playwright
- Optimized SQL queries reducing latency by 40%

EDUCATION
B.S. Computer Science | State University | 2019

SKILLS
JavaScript, TypeScript, React, Next.js, Node.js, Python, PostgreSQL, MongoDB,
AWS, Docker, Kubernetes, Git, GraphQL, REST, CI/CD, Agile, System Design
`;

export const TEST_USER = {
  fullName: "QA Test User",
  email: `qa.jobagent.${Date.now()}@gmail.com`,
  password:
    process.env.E2E_EPHEMERAL_PASSWORD ||
    `QaEphemeral_${Date.now()}_${Math.random().toString(36).slice(2, 10)}!`,
};
