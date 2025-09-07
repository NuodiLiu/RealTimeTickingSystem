import { Router } from 'express';
import { AuthController } from '../controllers/auth.controller';
import { requireStaff } from '../middlewares/auth.middleware';

const router = Router();

// define more public routes here
router.post('/invites', requireStaff, AuthController.createInvite)
router.post('/register', AuthController.register);
router.post('/login', AuthController.login);
router.post("/refresh", AuthController.refresh);
router.post("/logout", AuthController.logout);

export default router;