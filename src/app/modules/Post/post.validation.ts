import { z } from 'zod';

const createPostValidationSchema = z.object({
  body: z.object({
    text: z.string().optional().nullable(),
    visibility: z.enum(['PUBLIC', 'PRIVATE']).optional(),
  }),
});

const createCommentValidationSchema = z.object({
  body: z.object({
    text: z.string({
      required_error: 'Text is required for comment',
    }).min(1, 'Comment text cannot be empty'),
  }),
});

const createReplyValidationSchema = z.object({
  body: z.object({
    text: z.string({
      required_error: 'Text is required for reply',
    }).min(1, 'Reply text cannot be empty'),
  }),
});

export const PostValidation = {
  createPostValidationSchema,
  createCommentValidationSchema,
  createReplyValidationSchema,
};
