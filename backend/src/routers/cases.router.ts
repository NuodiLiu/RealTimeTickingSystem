import { CasesController } from "../controllers/cases.controller";
import { Router } from "express";
import { requireDevice, requireStaff } from "../middlewares/auth.middleware";
import { requireAuth } from "../middlewares/azure-auth.middleware";
import { requireAdmin } from '../middlewares/auth.middleware';
import { prisma } from '../lib/prisma';

const router = Router();

interface Case {
  studentName: string;
  category: string;
  createdAt: Date;
  startedAt: Date | null;
  resolvedAt: Date | null;
  staff: { name: string } | null;
  feedback: Array<{ rating: number; comment: string | null }> | null;
}

router.post("/", requireDevice, CasesController.postCase);

// Staff: list cases by status (?status=queued|in_progress|resolved)
router.get("/", requireAuth, requireStaff, CasesController.getQueuedCases);

// Staff: take next case (FIFO)
router.post("/take-next", requireAuth, requireStaff, CasesController.takeNextCase);

// TODO: add require admin check 
router.get('/export-cases', async (req, res) => {
  try {
    const cases = await prisma.studentCase.findMany({
      where: { status: 'RESOLVED' },  // Adjust the filter as needed
      include: {
        staff: true,
        feedback: true,  // Adjust to include feedback if needed
      },
    });

    // Format the data for export
    const result = cases.map((c) => ({
      studentName: c.studentName,
      category: c.category,
      escalatedTo: c.escalatedTo || null,
      createTime: c.createdAt,
      takeTime: c.startedAt,
      resolveTime: c.resolvedAt,
      processingTime: c.startedAt && c.resolvedAt
        ? (new Date(c.resolvedAt).getTime() - new Date(c.startedAt).getTime()) / 1000
        : null,  // Processing time in seconds, returns null if either startedAt or resolvedAt is null
      waitingTime: c.createdAt && c.startedAt
        ? (new Date(c.startedAt).getTime() - new Date(c.createdAt).getTime()) / 1000
        : null,  // Waiting time in seconds, returns null if either createdAt or startedAt is null
      staffName: c.staff?.name,
      // rating: (c.feedback && Array.isArray(c.feedback) && c.feedback.length > 0) ? c.feedback[0]?.rating ?? null : null,
      // feedbackComment: (c.feedback && Array.isArray(c.feedback) && c.feedback.length > 0) ? c.feedback[0]?.comment ?? null : null,
    }));

    res.json(result);
  } catch (error) {
    console.error('Error fetching cases for export:', error);
    res.status(500).json({ error: 'Failed to fetch cases for export' });
  }
});


// Staff: take a case by id
router.post("/:id/take", requireAuth, requireStaff, CasesController.takeCase);


// Staff: resolve a case
router.post("/:id/resolve", requireAuth, requireStaff, CasesController.resolveCase);

// Staff: escalate a case
router.post("/:id/escalate", requireAuth, requireStaff, CasesController.escalateCase);

export default router;
