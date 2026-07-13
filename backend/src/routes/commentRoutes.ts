import { Router } from 'express';
import { createComment, toggleLikeComment } from '../controllers/commentController';
import { authenticateToken } from '../middleware/auth';

const router = Router();

router.post('/', authenticateToken as any, createComment as any);
router.post('/:id/like', authenticateToken as any, toggleLikeComment as any);

export default router;
