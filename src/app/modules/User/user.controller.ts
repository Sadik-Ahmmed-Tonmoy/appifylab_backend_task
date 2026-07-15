/* eslint-disable @typescript-eslint/no-explicit-any */
import httpStatus from 'http-status';
import sendResponse from '../../../shared/sendResponse';
import { UserService } from './user.service';
import { Request, Response } from 'express';
import catchAsync from '../../utils/catchAsync';

const updateUser = catchAsync(async (req: Request, res: Response) => {
  const id = req.user.id;
  const profileImage =
    req.files && (req.files as any).profileImage
      ? (req.files as any).profileImage[0]
      : null;
  const result = await UserService.updateUser(
    id,
    req.body,
    profileImage,
  );

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'User updated successfully',
    data: result,
  });
});




const deleteUser = catchAsync(async (req: Request, res: Response) => {
  const id = req.user.id;
  await UserService.deleteUser(id);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'User deleted successfully',
    data: null,
  });
});


const getUserById = catchAsync(async (req: Request, res: Response) => {
  const id = req.params.id as string;
  const result = await UserService.getUserById(id);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'User fetched successfully',
    data: result,
  });
});

const statusUpdate = catchAsync(async (req: Request, res: Response) => {
  const id = req.params.id as string;
  const status = req.body.status;
  const result = await UserService.statusUpdate(id, status);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'User status updated successfully',
    data: result,
  });
});



const deleteUserAsAdmin = catchAsync(async (req: Request, res: Response) => {
  const id = req.params.userId as string;
  await UserService.deleteUserAsAdmin(id);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'User deleted successfully',
    data: null,
  });
});


const getAllUsers = catchAsync(async (req: Request, res: Response) => {
  const page = req.query['page'] ? Number(req.query['page']) : 1;
  const limit = req.query['limit'] ? Number(req.query['limit']) : 50;
  const role = req.query['role'] as string | undefined;
  const result = await UserService.getUsersByRole(role || 'USER', page, limit);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Users fetched successfully',
    data: result.data,
    meta: result.meta,
  });
});

const getMyRewards = catchAsync(async (req: Request, res: Response) => {
  const id = req.user.id;
  const result = await UserService.getMyRewards(id);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Reward points fetched',
    data: result,
  });
});

export const UserController = {
  updateUser,
  deleteUser,
  deleteUserAsAdmin,
  getUserById,
  statusUpdate,
  getAllUsers,
  getMyRewards,
};
