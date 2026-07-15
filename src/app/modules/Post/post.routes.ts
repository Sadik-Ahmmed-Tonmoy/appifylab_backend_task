import express from 'express';
import auth from '../../middlewares/auth';
import validateRequest from '../../middlewares/validateRequest';
import { fileUploader } from '../../../helpers/fileUploader';
import { PostController } from './post.controller';
import { PostValidation } from './post.validation';

const router = express.Router();

// Create post with optional image upload
router.post(
  '/',
  auth(),
  fileUploader.postImage,
  (req, res, next) => {
    // Parse body parameters from multipart if needed (since they come as strings)
    next();
  },
  validateRequest(PostValidation.createPostValidationSchema),
  PostController.createPost
);

// Get all visible posts (public + user's own private posts)
router.get('/', auth(), PostController.getAllPosts);

// Toggle post like
router.post('/:id/like', auth(), PostController.togglePostLike);

// Comment on post
router.post(
  '/:id/comments',
  auth(),
  validateRequest(PostValidation.createCommentValidationSchema),
  PostController.createComment
);

// Toggle comment like
router.post('/comments/:id/like', auth(), PostController.toggleCommentLike);

// Reply to comment
router.post(
  '/comments/:id/replies',
  auth(),
  validateRequest(PostValidation.createReplyValidationSchema),
  PostController.createReply
);

// Toggle reply like
router.post('/replies/:id/like', auth(), PostController.toggleReplyLike);

export const PostRoutes = router;
