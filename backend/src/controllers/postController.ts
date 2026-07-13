import { Response } from 'express';
import prisma from '../prisma';
import { AuthenticatedRequest } from '../middleware/auth';
import { Visibility } from '@prisma/client';

export const createPost = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { text, visibility } = req.body;
    const authorId = req.user?.id;

    if (!authorId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    if (!text && !req.file) {
      return res.status(400).json({ error: 'Post must contain text or an image' });
    }

    // Set image path if uploaded
    let imageUrl: string | null = null;
    if (req.file) {
      imageUrl = `/uploads/${req.file.filename}`;
    }

    // Parse visibility
    let postVisibility: Visibility = Visibility.PUBLIC;
    if (visibility === 'PRIVATE') {
      postVisibility = Visibility.PRIVATE;
    }

    const post = await prisma.post.create({
      data: {
        text: text || '',
        imageUrl,
        visibility: postVisibility,
        authorId
      },
      include: {
        author: {
          select: { id: true, firstName: true, lastName: true, email: true }
        }
      }
    });

    return res.status(201).json({
      message: 'Post created successfully',
      post
    });
  } catch (err: any) {
    console.error('Create post error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

export const getFeed = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const currentUserId = req.user?.id;

    if (!currentUserId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // Fetch posts that are PUBLIC OR owned by current user
    const posts = await prisma.post.findMany({
      where: {
        OR: [
          { visibility: Visibility.PUBLIC },
          { authorId: currentUserId }
        ]
      },
      orderBy: { createdAt: 'desc' },
      include: {
        author: {
          select: { id: true, firstName: true, lastName: true, email: true }
        },
        postLikes: {
          include: {
            user: {
              select: { id: true, firstName: true, lastName: true }
            }
          }
        },
        comments: {
          where: { parentId: null }, // Fetch only top-level comments
          orderBy: { createdAt: 'asc' },
          include: {
            author: {
              select: { id: true, firstName: true, lastName: true, email: true }
            },
            commentLikes: {
              include: {
                user: {
                  select: { id: true, firstName: true, lastName: true }
                }
              }
            },
            replies: {
              orderBy: { createdAt: 'asc' },
              include: {
                author: {
                  select: { id: true, firstName: true, lastName: true, email: true }
                },
                commentLikes: {
                  include: {
                    user: {
                      select: { id: true, firstName: true, lastName: true }
                    }
                  }
                }
              }
            }
          }
        }
      }
    });

    // Format feed response to return like state and comments neatly
    const formattedPosts = posts.map(post => {
      const isLiked = post.postLikes.some(like => like.userId === currentUserId);
      const likedBy = post.postLikes.map(like => ({
        id: like.user.id,
        name: `${like.user.firstName} ${like.user.lastName}`
      }));

      const formattedComments = post.comments.map(comment => {
        const isCommentLiked = comment.commentLikes.some(like => like.userId === currentUserId);
        const commentLikedBy = comment.commentLikes.map(like => ({
          id: like.user.id,
          name: `${like.user.firstName} ${like.user.lastName}`
        }));

        const formattedReplies = comment.replies.map(reply => {
          const isReplyLiked = reply.commentLikes.some(like => like.userId === currentUserId);
          const replyLikedBy = reply.commentLikes.map(like => ({
            id: like.user.id,
            name: `${like.user.firstName} ${like.user.lastName}`
          }));

          return {
            ...reply,
            isLiked: isReplyLiked,
            likedBy: replyLikedBy,
            likesCount: reply.commentLikes.length
          };
        });

        return {
          ...comment,
          isLiked: isCommentLiked,
          likedBy: commentLikedBy,
          likesCount: comment.commentLikes.length,
          replies: formattedReplies
        };
      });

      return {
        ...post,
        isLiked,
        likedBy,
        likesCount: post.postLikes.length,
        comments: formattedComments
      };
    });

    return res.json({ posts: formattedPosts });
  } catch (err: any) {
    console.error('Get feed error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

export const toggleLikePost = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id: postId } = req.params;
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const post = await prisma.post.findUnique({
      where: { id: postId }
    });

    if (!post) {
      return res.status(404).json({ error: 'Post not found' });
    }

    const existingLike = await prisma.postLike.findUnique({
      where: {
        userId_postId: { userId, postId }
      }
    });

    if (existingLike) {
      await prisma.postLike.delete({
        where: {
          userId_postId: { userId, postId }
        }
      });

      // Get updated likes list
      const likes = await prisma.postLike.findMany({
        where: { postId },
        include: { user: { select: { id: true, firstName: true, lastName: true } } }
      });

      return res.json({
        message: 'Post unliked',
        liked: false,
        likesCount: likes.length,
        likedBy: likes.map(l => ({ id: l.user.id, name: `${l.user.firstName} ${l.user.lastName}` }))
      });
    } else {
      await prisma.postLike.create({
        data: { userId, postId }
      });

      // Get updated likes list
      const likes = await prisma.postLike.findMany({
        where: { postId },
        include: { user: { select: { id: true, firstName: true, lastName: true } } }
      });

      return res.json({
        message: 'Post liked',
        liked: true,
        likesCount: likes.length,
        likedBy: likes.map(l => ({ id: l.user.id, name: `${l.user.firstName} ${l.user.lastName}` }))
      });
    }
  } catch (err: any) {
    console.error('Toggle like post error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
};
