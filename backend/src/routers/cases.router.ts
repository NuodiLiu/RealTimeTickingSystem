import { CasesController } from '../controllers/cases.controller';
import { Router } from 'express';

const router = Router();

// define more public routes here
router.get('/?status=queued',CasesController.getQueuedCases);

export default router;