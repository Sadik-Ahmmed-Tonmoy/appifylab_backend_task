import express from 'express';
import auth from '../../middlewares/auth';
import { UserController } from './user.controller';
import { UserRole } from '@prisma/client';
import { fileUploader } from '../../../helpers/fileUploader';
import { parseBody } from '../../middlewares/parseBody';

const router = express.Router();

router.patch(
  '/update-user',
  fileUploader.userImages,
  parseBody,
  auth(),
  UserController.updateUser,
);



router.get('/single/:id', auth(), UserController.getUserById);
router.get('/all', auth('SUPER_ADMIN', 'ADMIN'), UserController.getAllUsers);
router.patch(
  '/status/:id',
  auth(UserRole.SUPER_ADMIN, UserRole.ADMIN),
  UserController.statusUpdate,
);




router.delete(
  '/delete-user',
  auth(),
  UserController.deleteUser,
);

router.delete(
  '/delete-admin/:userId',
  auth(UserRole.SUPER_ADMIN, UserRole.ADMIN),
  UserController.deleteUserAsAdmin,
);

router.get('/my-rewards', auth(), UserController.getMyRewards);

export const UserRouters = router;
