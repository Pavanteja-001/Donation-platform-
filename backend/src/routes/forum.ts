// Community Q&A Forum (PRD §12, D-023) — authenticated users can ask questions and post
// answers. ADMIN/STAFF can delete questions or answers for moderation. No need-style
// verification lifecycle here — questions are community posts, not verified needs.
import { Router } from "express";
import { z } from "zod";
import { Role } from "@prisma/client";
import { prisma } from "../lib/prisma";
import { requireAuth } from "../middleware/auth";
import { sendPushNotifications } from "../lib/pushNotifications";

const router = Router();
router.use(requireAuth);

const questionInclude = {
  author: { select: { id: true, name: true, profilePhotoUrl: true } },
  answers: {
    include: { author: { select: { id: true, name: true, profilePhotoUrl: true } } },
    orderBy: { createdAt: "asc" as const },
  },
  _count: { select: { answers: true } },
};

// GET /api/forum — paginated list of questions (most recent first, with answer count)
router.get("/", async (req, res) => {
  const cursor = req.query.cursor as string | undefined;
  const limit = 20;

  const questions = await prisma.forumQuestion.findMany({
    take: limit + 1,
    ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
    include: {
      author: { select: { id: true, name: true, profilePhotoUrl: true } },
      _count: { select: { answers: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  const hasMore = questions.length > limit;
  const page = hasMore ? questions.slice(0, limit) : questions;

  res.json({
    questions: page,
    nextCursor: hasMore ? page[page.length - 1].id : null,
  });
});

// GET /api/forum/:id — question detail with all answers
router.get("/:id", async (req, res) => {
  const question = await prisma.forumQuestion.findUnique({
    where: { id: req.params.id },
    include: questionInclude,
  });
  if (!question) return res.status(404).json({ error: "Question not found" });
  res.json({ question });
});

const askSchema = z.object({
  title: z.string().min(5, "Title must be at least 5 characters").max(200),
  body: z.string().min(10, "Body must be at least 10 characters").max(5000),
});

// POST /api/forum — ask a new question
router.post("/", async (req, res) => {
  const parsed = askSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Invalid request" });

  const question = await prisma.forumQuestion.create({
    data: { title: parsed.data.title, body: parsed.data.body, authorId: req.user!.sub },
    include: questionInclude,
  });
  res.status(201).json({ question });
});

const answerSchema = z.object({
  body: z.string().min(5, "Answer must be at least 5 characters").max(5000),
});

// POST /api/forum/:id/answers — reply to a question
router.post("/:id/answers", async (req, res) => {
  const question = await prisma.forumQuestion.findUnique({ where: { id: req.params.id } });
  if (!question) return res.status(404).json({ error: "Question not found" });

  const parsed = answerSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Invalid request" });

  const answer = await prisma.forumAnswer.create({
    data: { body: parsed.data.body, questionId: req.params.id, authorId: req.user!.sub },
    include: { author: { select: { id: true, name: true, profilePhotoUrl: true } } },
  });

  // PRD §17 — send push notification to question author if someone else answered
  if (question.authorId !== req.user!.sub) {
    const questionAuthor = await prisma.user.findUnique({
      where: { id: question.authorId },
      select: { expoPushToken: true },
    });
    if (questionAuthor?.expoPushToken) {
      sendPushNotifications([
        {
          to: questionAuthor.expoPushToken,
          title: "New answer to your question 💬",
          body: `${answer.author.name ?? "A community member"} answered: "${question.title}"`,
          data: { questionId: question.id, answerId: answer.id },
        },
      ]);
    }
  }

  res.status(201).json({ answer });
});

// DELETE /api/forum/:id — delete a question (admin/staff only, or original author)
router.delete("/:id", async (req, res) => {
  const question = await prisma.forumQuestion.findUnique({ where: { id: req.params.id } });
  if (!question) return res.status(404).json({ error: "Question not found" });

  const isModerator = req.user!.role === Role.ADMIN || req.user!.role === Role.STAFF;
  const isAuthor = question.authorId === req.user!.sub;
  if (!isModerator && !isAuthor) return res.status(403).json({ error: "Not allowed" });

  await prisma.forumQuestion.delete({ where: { id: req.params.id } });
  res.json({ ok: true });
});

// DELETE /api/forum/answers/:id — delete an answer (admin/staff only, or original author)
router.delete("/answers/:id", async (req, res) => {
  const answer = await prisma.forumAnswer.findUnique({ where: { id: req.params.id } });
  if (!answer) return res.status(404).json({ error: "Answer not found" });

  const isModerator = req.user!.role === Role.ADMIN || req.user!.role === Role.STAFF;
  const isAuthor = answer.authorId === req.user!.sub;
  if (!isModerator && !isAuthor) return res.status(403).json({ error: "Not allowed" });

  await prisma.forumAnswer.delete({ where: { id: req.params.id } });
  res.json({ ok: true });
});

export default router;
