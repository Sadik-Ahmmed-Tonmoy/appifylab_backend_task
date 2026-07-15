/* global Express */
import {
  Prisma,
  UserRole,
  UserStatus,
} from '@prisma/client';
import httpStatus from 'http-status';
import ApiError from '../../../errors/ApiErrors';
import { uploadToDigitalOcean, deleteFromDigitalOcean } from '../../../helpers/digitalOcean';
import prisma from '../../../shared/ommitedPrisma';

// eslint-disable-next-line @typescript-eslint/consistent-type-definitions
type UserUpdatePayload = {
  fullName?: string | null;
  phoneNumber?: string | null;
  language?: string;
  timezone?: string;
  notificationEnabled?: boolean;
  isProfileCompleted?: boolean;
  rewardPoints?: number;
  [key: string]: unknown;
}

const updateUser = async (
  id: string,
  payload: UserUpdatePayload,
  profileImage: Express.Multer.File | null,
) => {
  const user = await prisma.user.findUnique({
    where: { id },
    include: {
      userProfile: true,
      adminProfile: true,
    },
  });

  if (!user) {
    throw new ApiError(httpStatus.NOT_FOUND, 'User not found');
  }

  let profileImageUrl: string | null = null;
  let oldProfileImageToDelete: string | null = null;

  try {
    if (profileImage) {
      if (!profileImage.mimetype.startsWith('image/')) {
        throw new ApiError(httpStatus.BAD_REQUEST, 'Uploaded file must be an image');
      }

      if (profileImage.size > 5 * 1024 * 1024) {
        throw new ApiError(httpStatus.BAD_REQUEST, 'Image size must be less than 5MB');
      }

      profileImageUrl = await uploadToDigitalOcean(profileImage);

      const existingProfileImage = user.role === UserRole.USER
        ? user.userProfile?.profileImage
        : user.adminProfile?.profileImage;

      if (existingProfileImage) {
        oldProfileImageToDelete = existingProfileImage;
      }
    }

    const profileData: Record<string, unknown> = {};
    const userUpdateData: Record<string, unknown> = {};

    if (payload.fullName !== undefined) {
      profileData.fullName = payload.fullName || null;
    }

    if (payload.phoneNumber !== undefined) {
      profileData.phoneNumber = payload.phoneNumber || null;
    }

    if (profileImageUrl !== null) {
      profileData.profileImage = profileImageUrl;
    }

    if (payload.language !== undefined) {
      profileData.language = payload.language || 'en';
    }

    if (payload.timezone !== undefined) {
      profileData.timezone = payload.timezone || 'Asia/Dhaka';
    }

    if (payload.notificationEnabled !== undefined) {
      profileData.notificationEnabled = Boolean(payload.notificationEnabled);
    }

    if (user.role === UserRole.USER && payload.rewardPoints !== undefined) {
      profileData.rewardPoints = Number(payload.rewardPoints);
    }

    if (payload.isProfileCompleted !== undefined) {
      userUpdateData.isProfileCompleted = Boolean(payload.isProfileCompleted);
    }

    userUpdateData.updatedAt = new Date();

    const updatedUser = await prisma.$transaction(async tx => {
      if (Object.keys(userUpdateData).length > 0) {
        await tx.user.update({
          where: { id },
          data: userUpdateData,
        });
      }

      if (Object.keys(profileData).length > 0) {
        if (user.role === UserRole.USER) {
          await tx.userProfile.upsert({
            where: { userId: id },
            update: profileData,
            create: {
              userId: id,
              ...profileData,
            } as any,
          });
        } else {
          await tx.adminProfile.upsert({
            where: { userId: id },
            update: profileData,
            create: {
              userId: id,
              ...profileData,
            } as any,
          });
        }
      }

      return tx.user.findUnique({
        where: { id },
        include: {
          userProfile: true,
          adminProfile: true,
        },
      });
    });

    if (oldProfileImageToDelete && profileImageUrl) {
      try {
        await deleteFromDigitalOcean(oldProfileImageToDelete);
      } catch (deleteError) {
        console.error('Failed to delete old profile image:', deleteError);
      }
    }

    return updatedUser;

  } catch (error) {
    if (profileImageUrl) {
      try {
        await deleteFromDigitalOcean(profileImageUrl);
      } catch (deleteError) {
        console.error('Failed to delete uploaded image during rollback:', deleteError);
      }
    }

    if (error instanceof ApiError) {
      throw error;
    }

    throw new ApiError(
      httpStatus.INTERNAL_SERVER_ERROR,
      `Failed to update user: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
};

const deleteUser = async (id: string) => {
  const user = await prisma.user.findUnique({
    where: { id },
    include: {
      userProfile: true,
      adminProfile: true,
    },
  });

  if (!user) {
    throw new ApiError(httpStatus.NOT_FOUND, 'User not found');
  }

  const profileImage = user.role === UserRole.USER
    ? user.userProfile?.profileImage
    : user.adminProfile?.profileImage;

  if (profileImage) {
    await deleteFromDigitalOcean(profileImage).catch(() => {});
  }

  await prisma.user.delete({ where: { id } });
  return;
};

const deleteUserAsAdmin = deleteUser;

const getUserById = async (id: string) => {
  const user = await prisma.user.findUnique({
    where: { id },
    include: {
      userProfile: true,
      adminProfile: true,
    },
  });

  if (!user) {
    throw new ApiError(httpStatus.NOT_FOUND, 'User not found');
  }

  return user;
};

const statusUpdate = async (id: string, status: UserStatus) => {
  const user = await prisma.user.findUnique({ where: { id } });
  if (!user) {
    throw new ApiError(httpStatus.NOT_FOUND, 'User not found');
  }

  const updatedUser = await prisma.user.update({
    where: { id },
    data: { status },
    include: {
      userProfile: true,
      adminProfile: true,
    },
  });

  return updatedUser;
};

const getUsersByRole = async (role?: string, page = 1, limit = 10) => {
  const skip = (page - 1) * limit;

  const whereCondition: Prisma.UserWhereInput = {
    status: UserStatus.ACTIVE,
  };

  if (role) {
    whereCondition.role = role as UserRole;
  }

  const [users, total] = await Promise.all([
    prisma.user.findMany({
      where: whereCondition,
      select: {
        id: true,
        email: true,
        role: true,
        status: true,
        isVerified: true,
        isProfileCompleted: true,
        userProfile: true,
        adminProfile: true,
        createdAt: true,
      },
      skip,
      take: limit,
      orderBy: { createdAt: 'desc' },
    }),
    prisma.user.count({ where: whereCondition }),
  ]);

  return {
    data: users,
    meta: {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    },
  };
};

const updateNotificationSettings = async (
  id: string,
  settings: {
    notificationEnabled?: boolean;
    fcmToken?: string;
    language?: string;
    timezone?: string;
  },
) => {
  const user = await prisma.user.findUnique({ where: { id } });
  if (!user) {
    throw new ApiError(httpStatus.NOT_FOUND, 'User not found');
  }

  const userUpdates: Record<string, any> = {};
  const profileUpdates: Record<string, any> = {};

  if (settings.fcmToken !== undefined) {
    userUpdates.fcmToken = settings.fcmToken;
  }
  if (settings.notificationEnabled !== undefined) {
    profileUpdates.notificationEnabled = Boolean(settings.notificationEnabled);
  }
  if (settings.language !== undefined) {
    profileUpdates.language = settings.language;
  }
  if (settings.timezone !== undefined) {
    profileUpdates.timezone = settings.timezone;
  }

  const updatedUser = await prisma.$transaction(async tx => {
    if (Object.keys(userUpdates).length > 0) {
      await tx.user.update({
        where: { id },
        data: userUpdates,
      });
    }

    if (Object.keys(profileUpdates).length > 0) {
      if (user.role === UserRole.USER) {
        await tx.userProfile.upsert({
          where: { userId: id },
          update: profileUpdates,
          create: { userId: id, ...profileUpdates } as any,
        });
      } else {
        await tx.adminProfile.upsert({
          where: { userId: id },
          update: profileUpdates,
          create: { userId: id, ...profileUpdates } as any,
        });
      }
    }

    return tx.user.findUnique({
      where: { id },
      include: {
        userProfile: true,
        adminProfile: true,
      },
    });
  });

  return updatedUser;
};

const getMyRewards = async (userId: string) => {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      userProfile: {
        select: { rewardPoints: true },
      },
    },
  });
  if (!user) throw new ApiError(httpStatus.NOT_FOUND, 'User not found');
  const REWARD_POINT_RATE = 0.1; // value per point
  const rewardPoints = user.userProfile?.rewardPoints ?? 0;
  return {
    rewardPoints,
    rewardValue: rewardPoints * REWARD_POINT_RATE,
    pointRate: REWARD_POINT_RATE,
  };
};

export const UserService = {
  updateUser,
  deleteUser,
  getUserById,
  deleteUserAsAdmin,
  statusUpdate,
  getUsersByRole,
  updateNotificationSettings,
  getMyRewards,
};
