import Link from "next/link";
import { getSessionProfile } from "@/lib/authz";
import { Card, PageHeader } from "@/components/ui";

export const metadata = { title: "Help" };

type Topic = { title: string; steps: string[]; link?: { href: string; label: string } };

const EVERYONE: Topic[] = [
  {
    title: "Invite a candidate",
    steps: [
      "Open Invite candidate, type the name and work email, and choose the test.",
      "Optionally pick a deadline. It ends at the end of that day, Baku time.",
      "The person gets an email with a link to set a password. If the email does not arrive, open the person and use Resend invite.",
    ],
    link: { href: "/staff/invite", label: "Invite a candidate" },
  },
  {
    title: "Read a result and decide",
    steps: [
      "Open Candidates and choose a person whose status says Ready for review.",
      "Read the score, then open each answer. You can confirm or correct any score, with a reason.",
      "Pick a decision and add a comment. A decision is recorded under your name, and a second reviewer can add their own.",
      "The candidate sees nothing until you press Release feedback.",
    ],
    link: { href: "/staff/reports/candidates", label: "Open Candidates" },
  },
  {
    title: "Give someone more time",
    steps: [
      "Open the person while their test is not yet submitted.",
      "Use Extra time to add minutes to the clock, or Deadline to move the last day.",
      "Both changes are saved at once. Extra time reaches a test that is already open within a minute or so.",
    ],
  },
];

const BUILDERS: Topic[] = [
  {
    title: "Build a test",
    steps: [
      "Open Tests and choose New assessment. Describe the role or paste a job description.",
      "Check every generated question and the answer key. Edit, replace or delete anything that looks wrong.",
      "Ask for a review, then publish. A test must be published before it can be sent.",
    ],
    link: { href: "/staff/builder", label: "Open Tests" },
  },
];

const ADMINS: Topic[] = [
  {
    title: "Add people and set roles",
    steps: [
      "Open People. Add a candidate or staff member, or upload a CSV with full_name and email columns.",
      "Change a role or deactivate an account from the row. A deactivated person can no longer sign in.",
      "A CSV can be saved as UTF-8 or with the older Windows-1251 encoding; semicolons work too.",
    ],
    link: { href: "/staff/people", label: "Open People" },
  },
  {
    title: "Settings",
    steps: [
      "Open Settings to manage the AI engine and the invitation emails.",
      "Engine keys are stored encrypted and never shown again after saving.",
    ],
    link: { href: "/staff/settings", label: "Open Settings" },
  },
];

const SUPER_ADMIN: Topic[] = [
  {
    title: "Admin panel",
    steps: [
      "Admin holds roles and permissions, approvals, the audit trail, security and data governance.",
      "Requests for new accounts and role changes need a second admin to approve them.",
    ],
    link: { href: "/admin", label: "Open Admin" },
  },
];

function TopicCard({ topic }: { topic: Topic }) {
  return (
    <Card className="p-6">
      <h2 className="text-sm font-bold text-foreground mb-3">{topic.title}</h2>
      <ol className="list-decimal pl-5 space-y-1.5 text-sm text-muted">
        {topic.steps.map((s) => (
          <li key={s}>{s}</li>
        ))}
      </ol>
      {topic.link ? (
        <Link href={topic.link.href} className="inline-block mt-4 text-sm font-semibold text-accent hover:underline">
          {topic.link.label}
        </Link>
      ) : null}
    </Card>
  );
}

// Help for the people who run assessments. Candidates have their own help
// (the invitation page); this one is written per role (UX-ADD-09).
export default async function StaffHelpPage() {
  const me = await getSessionProfile();
  const role = me?.role ?? "recruiter";
  const topics = [
    ...EVERYONE,
    ...(role !== "hiring_manager" ? BUILDERS : []),
    ...(role === "hr_admin" || role === "system_admin" ? ADMINS : []),
    ...(role === "system_admin" ? SUPER_ADMIN : []),
  ];
  return (
    <div className="p-6 lg:p-10 max-w-3xl">
      <PageHeader title="Help" subtitle="Short answers for the things you do most. What you see depends on your role." />
      <div className="space-y-5">
        {topics.map((t) => (
          <TopicCard key={t.title} topic={t} />
        ))}
      </div>
    </div>
  );
}
