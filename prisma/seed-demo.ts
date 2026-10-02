/**
 * Demo data: three team members (Anjum, Arhum, Ali) with monthly plans for
 * September, October and November 2026, each holding 3–4 AI-related tasks.
 *
 * Run: npm run db:seed:demo   (idempotent — re-running updates, never duplicates)
 */
import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import bcrypt from "bcryptjs";
import type { Priority, TaskStatus } from "../src/generated/prisma/enums";

const adapter = new PrismaPg({ connectionString: process.env.DIRECT_URL ?? process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

const YEAR = 2026;

type SeedTask = {
  title: string;
  description: string;
  category: string;
  priority: Priority;
  status: TaskStatus;
  completion: number;
  start: number; // day of month
  due: number; // day of month
  subtasks?: string[];
};

type SeedUser = {
  name: string;
  email: string;
  designation: string;
  department: string;
  months: Record<number, SeedTask[]>; // month number -> tasks
};

const MEMBERS: SeedUser[] = [
  {
    name: "Anjum",
    email: "anjum@taskapp.local",
    designation: "AI Engineer",
    department: "AI & Data",
    months: {
      9: [
        {
          title: "Fine-tune customer support chatbot on ticket history",
          description: "Prepare a cleaned dataset from the last 12 months of support tickets and fine-tune the base model for the support assistant.",
          category: "Development",
          priority: "HIGH",
          status: "COMPLETED",
          completion: 100,
          start: 1,
          due: 12,
          subtasks: ["Export and anonymize ticket data", "Build train/validation split", "Run fine-tuning job", "Evaluate on held-out set"],
        },
        {
          title: "Evaluate RAG pipeline retrieval accuracy",
          description: "Measure recall@5 and answer faithfulness of the internal knowledge-base RAG pipeline and document gaps.",
          category: "Development",
          priority: "MEDIUM",
          status: "COMPLETED",
          completion: 100,
          start: 8,
          due: 20,
          subtasks: ["Create 50-question eval set", "Run retrieval benchmark", "Write findings report"],
        },
        {
          title: "Set up prompt versioning and A/B testing",
          description: "Introduce prompt version tags and an A/B toggle so prompt changes can be compared on live traffic.",
          category: "Development",
          priority: "MEDIUM",
          status: "IN_PROGRESS",
          completion: 70,
          start: 15,
          due: 30,
        },
        {
          title: "Write AI usage policy draft for the company",
          description: "Draft internal guidelines for safe use of generative AI tools, including data-handling rules.",
          category: "Operations",
          priority: "LOW",
          status: "OVERDUE",
          completion: 40,
          start: 10,
          due: 25,
        },
      ],
      10: [
        {
          title: "Build LLM cost monitoring dashboard",
          description: "Track token usage and spend per feature and per model; alert when daily spend exceeds budget.",
          category: "Development",
          priority: "HIGH",
          status: "PENDING",
          completion: 0,
          start: 1,
          due: 14,
          subtasks: ["Collect usage logs", "Design dashboard", "Add budget alerts"],
        },
        {
          title: "Implement semantic search for product docs",
          description: "Add vector embeddings for documentation pages and expose a semantic search endpoint.",
          category: "Development",
          priority: "HIGH",
          status: "PENDING",
          completion: 0,
          start: 6,
          due: 22,
        },
        {
          title: "Red-team the chatbot for prompt injection",
          description: "Run adversarial prompts against the support chatbot and document mitigations.",
          category: "Support",
          priority: "CRITICAL",
          status: "PENDING",
          completion: 0,
          start: 15,
          due: 28,
        },
      ],
      11: [
        {
          title: "Deploy speech-to-text for meeting notes",
          description: "Integrate a speech-to-text model to auto-generate meeting summaries for the sales team.",
          category: "Development",
          priority: "MEDIUM",
          status: "PENDING",
          completion: 0,
          start: 2,
          due: 13,
        },
        {
          title: "Quarterly AI model performance review",
          description: "Compile accuracy, latency and cost metrics for all production models and present to leadership.",
          category: "Operations",
          priority: "HIGH",
          status: "PENDING",
          completion: 0,
          start: 10,
          due: 24,
          subtasks: ["Gather metrics", "Prepare slides", "Present to leadership"],
        },
        {
          title: "Research multimodal models for invoice OCR",
          description: "Compare vision-language models for extracting fields from scanned invoices.",
          category: "Finance",
          priority: "LOW",
          status: "PENDING",
          completion: 0,
          start: 16,
          due: 30,
        },
      ],
    },
  },
  {
    name: "Arhum",
    email: "arhum@taskapp.local",
    designation: "Machine Learning Engineer",
    department: "AI & Data",
    months: {
      9: [
        {
          title: "Train demand forecasting model for Q4",
          description: "Use two years of sales data to train a forecasting model and produce weekly demand predictions for Q4.",
          category: "Sales",
          priority: "CRITICAL",
          status: "COMPLETED",
          completion: 100,
          start: 1,
          due: 15,
          subtasks: ["Feature engineering", "Model training", "Backtest against 2025", "Publish forecast"],
        },
        {
          title: "Build anomaly detection for server logs",
          description: "Detect unusual error patterns in production logs using an unsupervised model.",
          category: "Operations",
          priority: "HIGH",
          status: "IN_PROGRESS",
          completion: 60,
          start: 8,
          due: 30,
        },
        {
          title: "Clean and label image dataset for defect detection",
          description: "Label 3,000 product images for the defect-detection computer-vision model.",
          category: "Development",
          priority: "MEDIUM",
          status: "OVERDUE",
          completion: 55,
          start: 5,
          due: 22,
        },
      ],
      10: [
        {
          title: "Deploy defect-detection model to edge devices",
          description: "Quantize the vision model and deploy it to factory-floor cameras.",
          category: "Development",
          priority: "HIGH",
          status: "PENDING",
          completion: 0,
          start: 1,
          due: 16,
          subtasks: ["Quantize model", "Benchmark on device", "Roll out to pilot line"],
        },
        {
          title: "Set up MLflow experiment tracking",
          description: "Standardize experiment tracking and model registry across the ML team.",
          category: "Operations",
          priority: "MEDIUM",
          status: "PENDING",
          completion: 0,
          start: 5,
          due: 20,
        },
        {
          title: "Churn prediction model v2",
          description: "Improve churn model with engagement features and calibrate probabilities.",
          category: "Marketing",
          priority: "HIGH",
          status: "PENDING",
          completion: 0,
          start: 12,
          due: 30,
        },
        {
          title: "Write model card for forecasting model",
          description: "Document intended use, training data, limitations and evaluation results.",
          category: "Operations",
          priority: "LOW",
          status: "PENDING",
          completion: 0,
          start: 20,
          due: 31,
        },
      ],
      11: [
        {
          title: "Automate weekly model retraining pipeline",
          description: "Schedule retraining with data validation checks and automatic rollback on metric regression.",
          category: "Development",
          priority: "HIGH",
          status: "PENDING",
          completion: 0,
          start: 2,
          due: 18,
        },
        {
          title: "Recommendation engine prototype for web store",
          description: "Build a collaborative-filtering prototype and measure click-through uplift offline.",
          category: "Sales",
          priority: "MEDIUM",
          status: "PENDING",
          completion: 0,
          start: 9,
          due: 27,
          subtasks: ["Prepare interaction data", "Train baseline model", "Offline evaluation"],
        },
        {
          title: "GPU cost optimization review",
          description: "Analyze GPU utilization and propose right-sizing for training workloads.",
          category: "Finance",
          priority: "MEDIUM",
          status: "PENDING",
          completion: 0,
          start: 16,
          due: 30,
        },
      ],
    },
  },
  {
    name: "Ali",
    email: "ali@taskapp.local",
    designation: "AI Product Analyst",
    department: "AI & Data",
    months: {
      9: [
        {
          title: "Competitor analysis of AI assistant features",
          description: "Review five competitor products and summarize AI features, pricing and positioning.",
          category: "Marketing",
          priority: "MEDIUM",
          status: "COMPLETED",
          completion: 100,
          start: 1,
          due: 10,
        },
        {
          title: "Design AI onboarding tour for new users",
          description: "Create wireframes for an in-app tour that introduces the AI assistant features.",
          category: "Design",
          priority: "HIGH",
          status: "COMPLETED",
          completion: 100,
          start: 6,
          due: 18,
          subtasks: ["User flow", "Wireframes", "Copywriting"],
        },
        {
          title: "Collect user feedback on AI summaries",
          description: "Run a survey and 8 interviews to assess satisfaction with AI-generated summaries.",
          category: "Support",
          priority: "MEDIUM",
          status: "IN_PROGRESS",
          completion: 50,
          start: 15,
          due: 30,
        },
        {
          title: "Create AI feature adoption report",
          description: "Analyze usage analytics for AI features and report weekly active usage trends.",
          category: "Operations",
          priority: "LOW",
          status: "OVERDUE",
          completion: 30,
          start: 12,
          due: 26,
        },
      ],
      10: [
        {
          title: "Define KPIs for AI email drafting feature",
          description: "Agree success metrics (adoption, edit rate, time saved) with product and engineering.",
          category: "Operations",
          priority: "HIGH",
          status: "PENDING",
          completion: 0,
          start: 1,
          due: 9,
        },
        {
          title: "Prepare AI feature launch campaign",
          description: "Draft landing page copy, email sequence and social posts for the AI assistant launch.",
          category: "Marketing",
          priority: "HIGH",
          status: "PENDING",
          completion: 0,
          start: 5,
          due: 23,
          subtasks: ["Landing page copy", "Email sequence", "Social posts"],
        },
        {
          title: "Usability test AI search results page",
          description: "Moderate 6 usability sessions on the new semantic search results layout.",
          category: "Design",
          priority: "MEDIUM",
          status: "PENDING",
          completion: 0,
          start: 14,
          due: 30,
        },
      ],
      11: [
        {
          title: "Build AI pricing model comparison sheet",
          description: "Compare per-seat vs usage-based pricing for AI add-ons with revenue projections.",
          category: "Finance",
          priority: "HIGH",
          status: "PENDING",
          completion: 0,
          start: 2,
          due: 12,
        },
        {
          title: "Write help-center articles for AI features",
          description: "Publish 6 articles covering setup, prompts, limitations and privacy.",
          category: "Support",
          priority: "MEDIUM",
          status: "PENDING",
          completion: 0,
          start: 8,
          due: 21,
          subtasks: ["Outline articles", "Draft", "Review with legal", "Publish"],
        },
        {
          title: "Plan AI roadmap workshop for December",
          description: "Organize a cross-team workshop to prioritize AI initiatives for next quarter.",
          category: "Operations",
          priority: "LOW",
          status: "PENDING",
          completion: 0,
          start: 17,
          due: 30,
        },
        {
          title: "Analyze AI chatbot conversation transcripts",
          description: "Cluster 2,000 transcripts to find top unanswered intents.",
          category: "Support",
          priority: "MEDIUM",
          status: "PENDING",
          completion: 0,
          start: 10,
          due: 26,
        },
      ],
    },
  },
];

async function main() {
  const adminEmail = process.env.SEED_ADMIN_EMAIL ?? "admin@taskapp.local";
  const memberPassword = process.env.SEED_MEMBER_PASSWORD;
  if (!memberPassword) throw new Error("SEED_MEMBER_PASSWORD must be set in .env");

  const admin = await prisma.user.findUnique({ where: { email: adminEmail } });
  if (!admin) throw new Error("Run the base seed first (npm run db:seed) to create the admin.");

  const categories = await prisma.category.findMany();
  const categoryId = (name: string) => categories.find((c) => c.name === name)?.id ?? null;
  const passwordHash = await bcrypt.hash(memberPassword, 12);

  let taskCount = 0;
  for (const member of MEMBERS) {
    const user = await prisma.user.upsert({
      where: { email: member.email },
      update: { name: member.name, designation: member.designation, department: member.department, role: "MEMBER", isActive: true, passwordHash },
      create: { name: member.name, email: member.email, designation: member.designation, department: member.department, role: "MEMBER", passwordHash },
    });

    for (const [monthStr, tasks] of Object.entries(member.months)) {
      const month = Number(monthStr);
      const plan = await prisma.monthlyPlan.upsert({
        where: { userId_year_month: { userId: user.id, year: YEAR, month } },
        update: {},
        create: { userId: user.id, year: YEAR, month, title: `${member.name} · AI initiatives` },
      });

      for (const [index, t] of tasks.entries()) {
        const dueDate = new Date(YEAR, month - 1, t.due);
        const startDate = new Date(YEAR, month - 1, t.start);
        const existing = await prisma.task.findFirst({ where: { planId: plan.id, title: t.title } });
        const data = {
          title: t.title,
          description: t.description,
          planId: plan.id,
          assigneeId: user.id,
          createdById: admin.id,
          categoryId: categoryId(t.category),
          priority: t.priority,
          status: t.status,
          completion: t.completion,
          startDate,
          dueDate,
          completedAt: t.status === "COMPLETED" ? new Date(YEAR, month - 1, Math.max(t.start, t.due - 1)) : null,
          position: index + 1,
        };
        const task = existing
          ? await prisma.task.update({ where: { id: existing.id }, data })
          : await prisma.task.create({ data });
        taskCount += 1;

        if (t.subtasks && !existing) {
          const doneCount = Math.round((t.completion / 100) * t.subtasks.length);
          await prisma.subTask.createMany({
            data: t.subtasks.map((title, i) => ({ taskId: task.id, title, position: i + 1, isCompleted: i < doneCount })),
          });
        }
        if (!existing) {
          await prisma.activityLog.create({
            data: { actorId: admin.id, taskId: task.id, action: "TASK_CREATED", entity: "Task", entityId: task.id, details: { title: task.title, assignee: user.name } },
          });
        }
      }
    }
  }

  console.log(`Seeded ${MEMBERS.length} members and ${taskCount} tasks across Sep–Nov ${YEAR}.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
