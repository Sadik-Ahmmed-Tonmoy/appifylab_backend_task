/* eslint-disable @typescript-eslint/no-explicit-any */
import { Visibility } from '@prisma/client';
import prisma from '../../../shared/prisma';
import { uploadToDigitalOcean } from '../../../helpers/digitalOcean';
import ApiError from '../../../errors/ApiErrors';
import httpStatus from 'http-status';
import path from 'path';
import fs from 'fs';
import config from '../../../config';

// Check if DigitalOcean credentials are configured
const hasDoCredentials = !!(
  config.do_space.endpoints &&
  config.do_space.access_key &&
  config.do_space.secret_key &&
  config.do_space.bucket
);

// Local uploads directory (fallback when DO is not configured)
const localUploadDir = path.join(process.cwd(), 'public', 'uploads');
if (!hasDoCredentials && !fs.existsSync(localUploadDir)) {
  fs.mkdirSync(localUploadDir, { recursive: true });
}

const uploadFile = async (file: any ): Promise<string> => {
  if (hasDoCredentials) {
    return await uploadToDigitalOcean(file);
  }
  // Local fallback: copy from temp to public/uploads
  const ext = path.extname(file.originalname) || '';
  const filename = `${Date.now()}-${Math.random().toString(36).substring(2, 8)}${ext}`;
  const destPath = path.join(localUploadDir, filename);
  if (file.path) {
    fs.copyFileSync(file.path, destPath);
    fs.unlinkSync(file.path);
  } else if (file.buffer) {
    fs.writeFileSync(destPath, file.buffer);
  }
  return `/upload/uploads/${filename}`;
};


const createPost = async (userId: string, payload: any, file?: any) => {
  let imageUrl = null;
  if (file) {
    imageUrl = await uploadFile(file);
  }

  const post = await prisma.post.create({
    data: {
      userId,
      text: payload.text || null,
      image: imageUrl,
      visibility: payload.visibility === 'PRIVATE' ? Visibility.PRIVATE : Visibility.PUBLIC,
    },
    include: {
      user: {
        select: {
          id: true,
          email: true,
          userProfile: true,
        },
      },
      likes: {
        include: {
          user: {
            select: {
              id: true,
              userProfile: true,
            },
          },
        },
      },
      comments: {
        include: {
          user: {
            select: {
              id: true,
              userProfile: true,
            },
          },
        },
      },
    },
  });

  return post;
};

const getAllPosts = async (
  currentUserId: string,
  options: { page?: number; limit?: number } = {},
) => {
  const page = Math.max(1, options.page ?? 1);
  const limit = Math.min(50, Math.max(1, options.limit ?? 10));
  const skip = (page - 1) * limit;

  const where = {
    OR: [
      { visibility: Visibility.PUBLIC },
      { userId: currentUserId },
    ],
  };

  const [total, posts] = await Promise.all([
    prisma.post.count({ where }),
    prisma.post.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit,
      include: {
        user: {
          select: {
            id: true,
            email: true,
            userProfile: true,
          },
        },
        likes: {
          include: {
            user: {
              select: {
                id: true,
                userProfile: true,
              },
            },
          },
        },
        comments: {
          orderBy: { createdAt: 'asc' },
          include: {
            user: {
              select: {
                id: true,
                userProfile: true,
              },
            },
            likes: {
              include: {
                user: {
                  select: {
                    id: true,
                    userProfile: true,
                  },
                },
              },
            },
            replies: {
              orderBy: { createdAt: 'asc' },
              include: {
                user: {
                  select: {
                    id: true,
                    userProfile: true,
                  },
                },
                likes: {
                  include: {
                    user: {
                      select: {
                        id: true,
                        userProfile: true,
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    }),
  ]);

  return {
    data: posts,
    meta: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  };
};

const togglePostLike = async (userId: string, postId: string) => {
  const post = await prisma.post.findUnique({ where: { id: postId } });
  if (!post) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Post not found');
  }

  const existingLike = await prisma.postLike.findUnique({
    where: {
      postId_userId: {
        postId,
        userId,
      },
    },
  });

  if (existingLike) {
    await prisma.postLike.delete({
      where: {
        postId_userId: {
          postId,
          userId,
        },
      },
    });
    return { liked: false };
  } else {
    await prisma.postLike.create({
      data: {
        postId,
        userId,
      },
    });
    return { liked: true };
  }
};

const createComment = async (userId: string, postId: string, text: string) => {
  const post = await prisma.post.findUnique({ where: { id: postId } });
  if (!post) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Post not found');
  }

  const comment = await prisma.comment.create({
    data: {
      postId,
      userId,
      text,
    },
    include: {
      user: {
        select: {
          id: true,
          userProfile: true,
        },
      },
      likes: true,
      replies: true,
    },
  });

  return comment;
};

const toggleCommentLike = async (userId: string, commentId: string) => {
  const comment = await prisma.comment.findUnique({ where: { id: commentId } });
  if (!comment) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Comment not found');
  }

  const existingLike = await prisma.commentLike.findUnique({
    where: {
      commentId_userId: {
        commentId,
        userId,
      },
    },
  });

  if (existingLike) {
    await prisma.commentLike.delete({
      where: {
        commentId_userId: {
          commentId,
          userId,
        },
      },
    });
    return { liked: false };
  } else {
    await prisma.commentLike.create({
      data: {
        commentId,
        userId,
      },
    });
    return { liked: true };
  }
};

const createReply = async (userId: string, commentId: string, text: string) => {
  const comment = await prisma.comment.findUnique({ where: { id: commentId } });
  if (!comment) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Comment not found');
  }

  const reply = await prisma.reply.create({
    data: {
      commentId,
      userId,
      text,
    },
    include: {
      user: {
        select: {
          id: true,
          userProfile: true,
        },
      },
      likes: true,
    },
  });

  return reply;
};

const toggleReplyLike = async (userId: string, replyId: string) => {
  const reply = await prisma.reply.findUnique({ where: { id: replyId } });
  if (!reply) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Reply not found');
  }

  const existingLike = await prisma.replyLike.findUnique({
    where: {
      replyId_userId: {
        replyId,
        userId,
      },
    },
  });

  if (existingLike) {
    await prisma.replyLike.delete({
      where: {
        replyId_userId: {
          replyId,
          userId,
        },
      },
    });
    return { liked: false };
  } else {
    await prisma.replyLike.create({
      data: {
        replyId,
        userId,
      },
    });
    return { liked: true };
  }
};

export const PostService = {
  createPost,
  getAllPosts,
  togglePostLike,
  createComment,
  toggleCommentLike,
  createReply,
  toggleReplyLike,
};
