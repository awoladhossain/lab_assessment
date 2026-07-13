import { Router } from 'express';
import { createPost, getFeed, toggleLikePost } from '../controllers/postController';
import { authenticateToken } from '../middleware/auth';
import { upload } from '../middleware/upload';

const router = Router();

router.post('/', authenticateToken as any, upload.single('image'), createPost as any);
router.get('/', authenticateToken as any, getFeed as any);
router.post('/:id/like', authenticateToken as any, toggleLikePost as any);

export default router;
