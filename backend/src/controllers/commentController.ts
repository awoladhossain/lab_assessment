import { Response } from 'express';
import prisma from '../prisma';
import { AuthenticatedRequest } from '../middleware/auth';

export const createComment = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { postId, text, parentId } = req.body;
    const authorId = req.user?.id;

    if (!authorId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    if (!postId || !text) {
      return res.status(400).json({ error: 'Post ID and text are required' });
    }

    // Verify post exists
    const postExists = await prisma.post.findUnique({
      where: { id: postId }
    });

    if (!postExists) {
      return res.status(404).json({ error: 'Post not found' });
    }

    // Verify parent comment exists if replying
    if (parentId) {
      const parentExists = await prisma.comment.findUnique({
        where: { id: parentId }
      });

      if (!parentExists) {
        return res.status(404).json({ error: 'Parent comment not found' });
      }
    }

    const comment = await prisma.comment.create({
      data: {
        text: text.trim(),
        postId,
        authorId,
        parentId: parentId || null
      },
      include: {
        author: {
          select: { id: true, firstName: true, lastName: true, email: true }
        }
      }
    });

    return res.status(201).json({
      message: parentId ? 'Reply added successfully' : 'Comment added successfully',
      comment
    });
  } catch (err: any) {
    console.error('Create comment error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

export const toggleLikeComment = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id: commentId } = req.params;
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const comment = await prisma.comment.findUnique({
      where: { id: commentId }
    });

    if (!comment) {
      return res.status(404).json({ error: 'Comment or reply not found' });
    }

    const existingLike = await prisma.commentLike.findUnique({
      where: {
        userId_commentId: { userId, commentId }
      }
    });

    if (existingLike) {
      await prisma.commentLike.delete({
        where: {
          userId_commentId: { userId, commentId }
        }
      });

      const likes = await prisma.commentLike.findMany({
        where: { commentId },
        include: { user: { select: { id: true, firstName: true, lastName: true } } }
      });

      return res.json({
        message: 'Comment/reply unliked',
        liked: false,
        likesCount: likes.length,
        likedBy: likes.map(l => ({ id: l.user.id, name: `${l.user.firstName} ${l.user.lastName}` }))
      });
    } else {
      await prisma.commentLike.create({
        data: { userId, commentId }
      });

      const likes = await prisma.commentLike.findMany({
        where: { commentId },
        include: { user: { select: { id: true, firstName: true, lastName: true } } }
      });

      return res.json({
        message: 'Comment/reply liked',
        liked: true,
        likesCount: likes.length,
        likedBy: likes.map(l => ({ id: l.user.id, name: `${l.user.firstName} ${l.user.lastName}` }))
      });
    }
  } catch (err: any) {
    console.error('Toggle like comment error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
};
