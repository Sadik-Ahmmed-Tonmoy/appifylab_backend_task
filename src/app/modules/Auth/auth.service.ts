/* eslint-disable no-unused-vars */
/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { LogInProcess, OTPPurpose, UserStatus, UserRole } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import httpStatus from 'http-status';
import { JsonWebTokenError, Secret, TokenExpiredError } from 'jsonwebtoken';
import config from '../../../config';
import { otpEmail } from '../../../emails/otpEmail';
import ApiError from '../../../errors/ApiErrors';
import { generateRandomCode } from '../../../helpers/generateCode';
import { jwtHelpers } from '../../../helpers/jwtHelpers';
import {
  comparePassword,
  hashPassword,
} from '../../../helpers/passwordHelpers';
import prisma from '../../../shared/prisma';
import { ForgetPasswordPayload, OTPVerifyPayload } from './auth.interface';
import { sendEmail } from '../../utils/sendEmail';

// SIGNUP
const signupToDb = async (payload: any) => {
  const { email, password, fcmToken, fullName, phoneNumber, keepMeLogin } = payload;

  if (!email) {
    throw new ApiError(httpStatus.BAD_REQUEST, 'Email is required to create an account');
  }

  const exists = await prisma.user.findUnique({ where: { email } });
  if (exists) {
    throw new ApiError(httpStatus.BAD_REQUEST, 'User with this email already exists');
  }

  // EMAIL signup requires password
  if (payload.logInProcess === LogInProcess.EMAIL && !password) {
    throw new ApiError(httpStatus.BAD_REQUEST, 'Password is required for EMAIL login process');
  }

  let hashedPassword: string | null = null;
  if (password) hashedPassword = await bcrypt.hash(password, 12);

  // EMAIL SIGNUP -> user must verify email → send OTP (Modified: auto-verified for simple flow)
  if (payload.logInProcess === LogInProcess.EMAIL) {
    const computedFullName = fullName || `${payload.firstName || ''} ${payload.lastName || ''}`.trim();
    const result = await prisma.$transaction(async tx => {
      const user = await tx.user.create({
        data: {
          email,
          password: hashedPassword,
          fcmToken,
          logInProcess: LogInProcess.EMAIL,
          isVerified: true,
          isProfileCompleted: true,
          role: UserRole.USER,
          status: UserStatus.ACTIVE,
        },
      });

      const userProfile = await tx.userProfile.create({
        data: {
          userId: user.id,
          fullName: computedFullName,
          firstName: payload.firstName || '',
          lastName: payload.lastName || '',
          phoneNumber: phoneNumber || '',
          profileImage: payload.profileImage || '/assets/images/Avatar.png',
        },
      });

      return { user, userProfile };
    });

    const accessToken = jwtHelpers.generateToken(
      {
        id: result.user.id,
        email: result.user.email,
        role: result.user.role,
      },
      config.jwt.access_secret as Secret,
      config.jwt.access_expires_in as string,
    );

    const refreshToken = jwtHelpers.generateToken(
      { id: result.user.id, role: result.user.role },
      config.jwt.refresh_secret as Secret,
      config.jwt.refresh_expires_in as string,
    );

    const { password: _p, ...userWithoutPassword } = result.user;
    return {
      isVerified: true,
      accessToken,
      refreshToken,
      keepMeLogin,
      role: result.user.role,
      user: {
        ...userWithoutPassword,
        userProfile: result.userProfile,
        adminProfile: null,
      },
    };
  }

  // SOCIAL SIGNUP (fallback for other endpoints if direct login doesn't call socialSignupOrLogin)
  const result = await prisma.$transaction(async tx => {
    const user = await tx.user.create({
      data: {
        email,
        password: hashedPassword,
        fcmToken,
        logInProcess: payload.logInProcess,
        isVerified: true,
        isProfileCompleted: false,
        role: UserRole.USER,
        status: UserStatus.ACTIVE,
      },
    });

    const userProfile = await tx.userProfile.create({
      data: {
        userId: user.id,
        fullName: fullName || '',
        phoneNumber: phoneNumber || '',
        profileImage: payload.profileImage || null,
      },
    });

    return { user, userProfile };
  });

  // Generate tokens
  const accessToken = jwtHelpers.generateToken(
    {
      id: result.user.id,
      email: result.user.email,
      role: result.user.role,
    },
    config.jwt.access_secret as Secret,
    config.jwt.access_expires_in as string,
  );

  const refreshToken = jwtHelpers.generateToken(
    { id: result.user.id, role: result.user.role },
    config.jwt.refresh_secret as Secret,
    config.jwt.refresh_expires_in as string,
  );

  return {
    isVerified: true,
    accessToken,
    refreshToken,
    keepMeLogin,
    role: result.user.role,
    userProfile: result.userProfile,
  };
};

// LOGIN
const loginUser = async (payload: {
  email: string;
  password: string;
  keepMeLogin: boolean;
}) => {
  console.log(payload);
  const userData = await prisma.user.findUnique({
    where: { email: payload.email },
    include: {
      userProfile: true,
      adminProfile: true,
    },
  });

  if (!userData) {
    throw new ApiError(httpStatus.NOT_FOUND, 'User not found with this email');
  }

  if (userData.logInProcess !== LogInProcess.EMAIL) {
    throw new ApiError(
      httpStatus.BAD_REQUEST,
      `Please login with your ${userData.logInProcess} Account`,
    );
  }

  if (
    userData.status === UserStatus.INACTIVE ||
    userData.status === UserStatus.BANNED
  ) {
    throw new ApiError(httpStatus.FORBIDDEN, 'Your account is Suspended');
  }

  if (userData.status === UserStatus.BLOCKED) {
    throw new ApiError(httpStatus.FORBIDDEN, 'Your account is Blocked');
  }

  if (!payload.password || !userData?.password) {
    throw new ApiError(httpStatus.BAD_REQUEST, 'User does not have a password set');
  }

  const isCorrectPassword = await bcrypt.compare(
    payload.password,
    userData.password,
  );

  if (!isCorrectPassword) {
    throw new ApiError(httpStatus.UNAUTHORIZED, 'Password is incorrect');
  }

  if (userData?.isVerified === false) {
    const code = generateRandomCode(6);
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000);
    const otp = await prisma.oTP.create({
      data: {
        userId: userData.id,
        code,
        email: userData.email,
        purpose: OTPPurpose.EMAIL_VERIFICATION,
        expiresAt,
      },
    });

    const html = otpEmail(otp.code, userData.email, 'OTP for Email Verification');
    await sendEmail('Verify Your Email Address', userData.email, html);
    return {
      email: userData.email,
      isVerified: userData.isVerified,
    };
  }

  const accessToken = jwtHelpers.generateToken(
    {
      id: userData.id,
      email: userData.email,
      role: userData.role,
    },
    config.jwt.access_secret as Secret,
    config.jwt.access_expires_in as string,
  );

  const refreshToken = jwtHelpers.generateToken(
    { id: userData.id, role: userData.role },
    config.jwt.refresh_secret as Secret,
    payload.keepMeLogin ? (config.jwt.refresh_expires_in_For_keep_Login as string) : (config.jwt.refresh_expires_in as string),
  );

  return {
    isVerified: userData.isVerified,
    accessToken,
    refreshToken,
    keepMeLogin: payload.keepMeLogin,
    role: userData.role,
    user: {
      id: userData.id,
      email: userData.email,
      role: userData.role,
      userProfile: userData.userProfile,
      adminProfile: userData.adminProfile,
    },
  };
};

// SOCIAL LOGIN
const socialLogin = async (payload: {
  email: string;
  logInProcess: LogInProcess;
  fcmToken?: string;
}) => {
  const userData = await prisma.user.findUnique({
    where: { email: payload.email },
    include: {
      userProfile: true,
      adminProfile: true,
    },
  });

  if (!userData) {
    throw new ApiError(httpStatus.NOT_FOUND, 'User not found');
  }

  if (
    userData.status === UserStatus.INACTIVE ||
    userData.status === UserStatus.BANNED
  ) {
    throw new ApiError(httpStatus.FORBIDDEN, 'Your account is Suspended');
  }

  if (userData.status === UserStatus.BLOCKED) {
    throw new ApiError(httpStatus.FORBIDDEN, 'Your account is Blocked');
  }

  if (!userData.isVerified) {
    const code = generateRandomCode(6);
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000);
    const otp = await prisma.oTP.create({
      data: {
        userId: userData.id,
        code,
        email: userData.email,
        purpose: OTPPurpose.EMAIL_VERIFICATION,
        expiresAt,
      },
    });

    const html = otpEmail(otp.code, userData.email, 'OTP for Email Verification');
    await sendEmail('Verify Your Email Address', userData.email, html);

    return {
      email: userData.email,
      isVerified: userData.isVerified,
    };
  }

  // update fcm token
  if (payload.fcmToken && userData.fcmToken !== payload.fcmToken) {
    await prisma.user.update({
      where: { id: userData.id },
      data: { fcmToken: payload.fcmToken },
    });
  }

  const accessToken = jwtHelpers.generateToken(
    {
      id: userData.id,
      email: userData.email,
      role: userData.role,
    },
    config.jwt.access_secret as Secret,
    config.jwt.access_expires_in as string,
  );

  const refreshToken = jwtHelpers.generateToken(
    { id: userData.id, role: userData.role },
    config.jwt.refresh_secret as Secret,
    config.jwt.refresh_expires_in as string,
  );

  return {
    isVerified: userData.isVerified,
    accessToken,
    refreshToken,
    role: userData.role,
    user: {
      id: userData.id,
      email: userData.email,
      role: userData.role,
      userProfile: userData.userProfile,
      adminProfile: userData.adminProfile,
    },
  };
};

// GET ME
const getMe = async (id: string) => {
  const result = await prisma.user.findUnique({
    where: { id },
    include: {
      userProfile: true,
      adminProfile: true,
    },
  });

  if (!result) {
    throw new ApiError(httpStatus.NOT_FOUND, 'User not found');
  }

  const { password, ...rest } = result;
  return rest;
};

// GOOGLE LOGIN WITH NEXTAUTH
const googleLoginWithNextAuth = async (data: any) => {
  let user = await prisma.user.findUnique({
    where: { email: data.email },
    include: {
      userProfile: true,
      adminProfile: true,
    },
  });

  if (user) {
    user = await prisma.user.update({
      where: { email: data.email },
      data: {
        logInProcess: LogInProcess.GOOGLE,
        isVerified: true,
      },
      include: {
        userProfile: true,
        adminProfile: true,
      },
    });

    if (user.role === UserRole.USER && !user.userProfile) {
      await prisma.userProfile.create({
        data: {
          userId: user.id,
          fullName: data.name || '',
          profileImage: data.image || null,
        },
      });
    } else if (user.role !== UserRole.USER && !user.adminProfile) {
      await prisma.adminProfile.create({
        data: {
          userId: user.id,
          fullName: data.name || '',
          profileImage: data.image || null,
        },
      });
    }
  } else {
    user = await prisma.$transaction(async tx => {
      const createdUser = await tx.user.create({
        data: {
          email: data.email,
          logInProcess: LogInProcess.GOOGLE,
          isVerified: true,
          role: UserRole.USER,
          status: UserStatus.ACTIVE,
        },
      });

      const userProfile = await tx.userProfile.create({
        data: {
          userId: createdUser.id,
          fullName: data.name || '',
          profileImage: data.image || null,
        },
      });

      return {
        ...createdUser,
        userProfile,
        adminProfile: null,
      } as any;
    });
  }

  if (user!.status === UserStatus.INACTIVE || user!.status === UserStatus.BANNED) {
    throw new ApiError(httpStatus.FORBIDDEN, 'Your account is Suspended');
  }

  const accessToken = jwtHelpers.generateToken(
    {
      id: user!.id,
      email: user!.email,
      role: user!.role,
    },
    config.jwt.access_secret as Secret,
    config.jwt.access_expires_in as string,
  );

  const refreshToken = jwtHelpers.generateToken(
    {
      id: user!.id,
      email: user!.email,
      role: user!.role,
    },
    config.jwt.refresh_secret as Secret,
    config.jwt.refresh_expires_in as string,
  );

  const { password: _p, ...userWithoutPassword } = user!;
  return { isValid: true, isVerified: true, accessToken, refreshToken, user: userWithoutPassword };
};

// CHANGE PASSWORD
const changePassword = async (
  id: string,
  newPassword: string,
  oldPassword: string,
) => {
  if (!oldPassword) throw new ApiError(httpStatus.FORBIDDEN, 'Old Password is required');
  if (!newPassword) throw new ApiError(httpStatus.BAD_REQUEST, 'New Password is required');

  const userData = await prisma.user.findUnique({ where: { id } });

  if (!userData) {
    throw new ApiError(httpStatus.NOT_FOUND, 'No record found');
  }

  if (userData.logInProcess !== LogInProcess.EMAIL) {
    throw new ApiError(
      httpStatus.BAD_REQUEST,
      `Please login with your ${userData.logInProcess} account. This account was registered via ${userData.logInProcess}.`,
    );
  }

  const isCorrectPassword = await comparePassword(
    oldPassword,
    userData.password as string,
  );

  if (!isCorrectPassword) {
    throw new ApiError(httpStatus.BAD_REQUEST, 'Incorrect old password!');
  }

  const hashedPassword = await hashPassword(newPassword);

  await prisma.user.update({
    where: { id: userData.id },
    data: { password: hashedPassword },
  });
};

// FORGET PASSWORD
const forgetPassword = async (payload: ForgetPasswordPayload) => {
  const { email } = payload;

  const user = await prisma.user.findUnique({ where: { email } });

  if (!user) {
    throw new ApiError(httpStatus.NOT_FOUND, 'User not found with this email address');
  }

  if (user.logInProcess !== LogInProcess.EMAIL) {
    throw new ApiError(
      httpStatus.BAD_REQUEST,
      `Please login with your ${user.logInProcess} account. This account was registered via ${user.logInProcess}.`,
    );
  }

  if (user.status !== UserStatus.ACTIVE) {
    throw new ApiError(httpStatus.BAD_REQUEST, 'User account is not active');
  }

  const code = generateRandomCode(6);
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000);
  const otp = await prisma.oTP.create({
    data: {
      userId: user.id,
      code,
      email: user.email,
      purpose: OTPPurpose.PASSWORD_RESET,
      expiresAt,
    },
  });

  const html = otpEmail(otp.code, user.email, 'OTP for Password Reset');
  await sendEmail('Reset your password', user.email, html);

  return {
    email: user.email,
    role: user.role,
    logInProcess: user.logInProcess,
    purpose: otp.purpose,
    status: user.status,
    isVerified: user.isVerified,
    expiresAt: otp.expiresAt,
  };
};

// RESET PASSWORD
const resetPassword = async (payload: {
  email: string;
  token: string;
  password: string;
}) => {
  const userData = await prisma.user.findUnique({
    where: {
      email: payload.email,
      status: UserStatus.ACTIVE,
    },
  });

  if (!userData) {
    throw new ApiError(httpStatus.NOT_FOUND, 'User not found');
  }

  const isValidToken = jwtHelpers.verifyToken(
    payload.token,
    config.jwt.access_secret as Secret,
  );

  if (!isValidToken) {
    throw new ApiError(httpStatus.UNAUTHORIZED, 'Invalid or expired token');
  }

  const hashedPassword = await hashPassword(payload.password);

  await prisma.user.update({
    where: { email: payload.email },
    data: { password: hashedPassword },
  });

  return { message: 'Password reset successfully' };
};

// REFRESH TOKEN
const refreshToken = async (token: string) => {
  try{

    let decodedToken;
    try {
      decodedToken = jwtHelpers.verifyToken(
        token,
        config.jwt.refresh_secret as Secret,
      );
  } catch (error) {
    // JWT verification failed – treat as invalid refresh token
    throw new ApiError(httpStatus.FORBIDDEN, 'Refresh token expired or invalid');
  }
  
  if (!decodedToken) {
    throw new ApiError(httpStatus.FORBIDDEN, 'Refresh token expired or invalid');
  }
  
  const user = await prisma.user.findUnique({
    where: { id: decodedToken.id },
  });

  if (!user) {
    throw new ApiError(httpStatus.NOT_FOUND, 'User not found');
  }
  
  const accessToken = jwtHelpers.generateToken(
    {
      id: user.id,
      email: user.email,
      role: user.role,
    },
    config.jwt.access_secret as Secret,
    config.jwt.access_expires_in as string,
  );
  
  return { accessToken };
} catch (err) {
    if (err instanceof TokenExpiredError) {
      throw new ApiError(
        httpStatus.UNAUTHORIZED,
        "Refresh token has expired. Please login again.",
      );
    }

    if (err instanceof JsonWebTokenError) {
      throw new ApiError(
        httpStatus.UNAUTHORIZED,
        "Invalid refresh token.",
      );
    }

  console.error('Unexpected refresh error:', err);
  throw new ApiError(httpStatus.INTERNAL_SERVER_ERROR, 'Something went wrong.');
  }
};

const userStatusUpdate = async (id: string, status: UserStatus) => {
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

// GENERATE OTP
const generateOTP = async (
  email: string,
  purpose: OTPPurpose,
): Promise<{ id: string }> => {
  const user = await prisma.user.findUnique({ where: { email } });

  if (!user) {
    throw new ApiError(httpStatus.NOT_FOUND, 'User not found');
  }

  const code = generateRandomCode(6);
  const expiresAt = new Date();
  expiresAt.setMinutes(expiresAt.getMinutes() + 10);

  const otp = await prisma.oTP.create({
    data: {
      email: user.email,
      code,
      userId: user.id,
      purpose,
      expiresAt,
    },
  });

  const html = otpEmail(
    otp.code,
    user.email,
    `OTP for ${purpose === OTPPurpose.EMAIL_VERIFICATION ? 'Email Verification' : 'Password Reset'}`,
  );

  await sendEmail(
    `OTP for ${purpose === OTPPurpose.EMAIL_VERIFICATION ? 'Email Verification' : 'Password Reset'}`,
    user.email,
    html,
  );

  return { id: otp.id };
};

// VERIFY OTP
const verifyOTP = async (payload: OTPVerifyPayload) => {
  const { email, code, purpose } = payload;

  const user = await prisma.user.findUnique({
    where: { email },
    include: {
      userProfile: true,
      adminProfile: true,
    },
  });

  if (!user) {
    throw new ApiError(httpStatus.NOT_FOUND, 'User not found');
  }

  const otp = await prisma.oTP.findFirst({
    where: {
      userId: user.id,
      code,
      purpose,
      used: false,
      expiresAt: { gt: new Date() },
    },
  });

  if (!otp) {
    return { isValid: false, user };
  }

  await prisma.oTP.update({
    where: { id: otp.id },
    data: { used: true },
  });

  if (purpose === OTPPurpose.EMAIL_VERIFICATION) {
    const updatedUser = await prisma.user.update({
      where: { id: user.id },
      data: { isVerified: true },
      include: {
        userProfile: true,
        adminProfile: true,
      },
    });

    const accessToken = jwtHelpers.generateToken(
      {
        id: updatedUser.id,
        email: updatedUser.email,
        role: updatedUser.role,
      },
      config.jwt.access_secret as Secret,
      config.jwt.access_expires_in as string,
    );

    const refreshToken = jwtHelpers.generateToken(
      {
        id: updatedUser.id,
        email: updatedUser.email,
        role: updatedUser.role,
      },
      config.jwt.refresh_secret as Secret,
      config.jwt.refresh_expires_in as string,
    );

    const { password: _p, ...userWithoutPassword } = updatedUser;
    return {
      isValid: true,
      isVerified: true,
      accessToken,
      refreshToken,
      user: userWithoutPassword,
    };
  } else {
    const resetPasswordToken = jwtHelpers.generateToken(
      {
        id: user.id,
        email: user.email,
        role: user.role,
      },
      config.jwt.access_secret as Secret,
      config.jwt.access_expires_in as string,
    );

    const { password: _p, ...userWithoutPassword } = user;
    return {
      isValid: true,
      isVerified: false,
      resetPasswordToken,
      email,
      user: userWithoutPassword,
    };
  }
};

// RESEND OTP
const resendOTP = async (payload: { email: string; purpose: OTPPurpose }) => {
  const user = await prisma.user.findUnique({
    where: { email: payload.email, status: UserStatus.ACTIVE },
  });

  if (!user) {
    throw new ApiError(httpStatus.NOT_FOUND, 'User not found');
  }

  const code = generateRandomCode(6);
  const expiresAt = new Date();
  expiresAt.setMinutes(expiresAt.getMinutes() + 10);

  const otp = await prisma.oTP.create({
    data: {
      userId: user.id,
      code,
      email: user.email,
      purpose: payload.purpose,
      expiresAt,
    },
  });

  const html = otpEmail(
    otp.code,
    user.email,
    `OTP for ${payload.purpose === OTPPurpose.EMAIL_VERIFICATION ? 'Email Verification' : 'Password Reset'}`,
  );

  await sendEmail(
    `OTP for ${payload.purpose === OTPPurpose.EMAIL_VERIFICATION ? 'Email Verification' : 'Password Reset'}`,
    user.email,
    html,
  );

  return {
    email: user.email,
    role: user.role,
    logInProcess: user.logInProcess,
    status: user.status,
    isVerified: user.isVerified,
    expiresAt: otp.expiresAt,
  };
};

// SOCIAL SIGNUP OR LOGIN
const socialSignupOrLogin = async (payload: {
  email: string;
  logInProcess: LogInProcess;
  fcmToken?: string;
  fullName?: string;
  phoneNumber?: string;
  profileImage?: string;
  keepMeLogin?: boolean;
}) => {
  const {
    email,
    logInProcess,
    fcmToken,
    fullName,
    phoneNumber,
    profileImage,
    keepMeLogin = false,
  } = payload;

  const existingUser = await prisma.user.findUnique({
    where: { email },
    include: {
      userProfile: true,
      adminProfile: true,
    },
  });

  if (existingUser) {
    if (existingUser.logInProcess !== logInProcess) {
      throw new ApiError(
        httpStatus.BAD_REQUEST,
        `Please login with your ${existingUser.logInProcess} account`,
      );
    }

    if (
      existingUser.status === UserStatus.INACTIVE ||
      existingUser.status === UserStatus.BANNED
    ) {
      throw new ApiError(httpStatus.FORBIDDEN, 'Your account is Suspended');
    }

    if (existingUser.status === UserStatus.BLOCKED) {
      throw new ApiError(httpStatus.FORBIDDEN, 'Your account is Blocked');
    }

    if (fcmToken && existingUser.fcmToken !== fcmToken) {
      await prisma.user.update({
        where: { id: existingUser.id },
        data: { fcmToken },
      });
    }

    if (!existingUser.isVerified) {
      const code = generateRandomCode(6);
      const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

      const otp = await prisma.oTP.create({
        data: {
          userId: existingUser.id,
          code,
          email: existingUser.email,
          purpose: OTPPurpose.EMAIL_VERIFICATION,
          expiresAt,
        },
      });

      const html = otpEmail(otp.code, existingUser.email, 'OTP for Email Verification');
      await sendEmail('Verify Your Email Address', existingUser.email, html);

      return {
        email: existingUser.email,
        isVerified: existingUser.isVerified,
        needsVerification: true,
      };
    }

    const accessToken = jwtHelpers.generateToken(
      {
        id: existingUser.id,
        email: existingUser.email,
        role: existingUser.role,
      },
      config.jwt.access_secret as Secret,
      config.jwt.access_expires_in as string,
    );

    const refreshToken = jwtHelpers.generateToken(
      { id: existingUser.id, role: existingUser.role },
      config.jwt.refresh_secret as Secret,
      keepMeLogin ? (config.jwt.refresh_expires_in_For_keep_Login as string) : (config.jwt.refresh_expires_in as string),
    );

    const { password: _p, ...userWithoutPassword } = existingUser;

    return {
      isVerified: true,
      accessToken,
      refreshToken,
      keepMeLogin,
      role: existingUser.role,
      user: userWithoutPassword,
    };
  }

  // SIGNUP
  const isSocialSignup =
    logInProcess === LogInProcess.GOOGLE || logInProcess === LogInProcess.APPLE;

  if (!isSocialSignup) {
    throw new ApiError(
      httpStatus.BAD_REQUEST,
      'Only social login (GOOGLE/APPLE) is supported for this endpoint',
    );
  }

  const result = await prisma.$transaction(async tx => {
    const newUser = await tx.user.create({
      data: {
        email,
        password: null,
        fcmToken,
        logInProcess,
        isVerified: true,
        isProfileCompleted: false,
        role: UserRole.USER,
        status: UserStatus.ACTIVE,
      },
    });

    const userProfile = await tx.userProfile.create({
      data: {
        userId: newUser.id,
        fullName: fullName || '',
        phoneNumber: phoneNumber || '',
        profileImage: profileImage || null,
      },
    });

    return { user: newUser, userProfile };
  });

  const accessToken = jwtHelpers.generateToken(
    {
      id: result.user.id,
      email: result.user.email,
      role: result.user.role,
    },
    config.jwt.access_secret as Secret,
    config.jwt.access_expires_in as string,
  );

  const refreshToken = jwtHelpers.generateToken(
    { id: result.user.id, role: result.user.role },
    config.jwt.refresh_secret as Secret,
    keepMeLogin ? (config.jwt.refresh_expires_in_For_keep_Login as string) : (config.jwt.refresh_expires_in as string),
  );

  const { password: _p, ...userWithoutPassword } = result.user;

  return {
    isVerified: true,
    accessToken,
    refreshToken,
    keepMeLogin,
    role: result.user.role,
    user: {
      ...userWithoutPassword,
      userProfile: result.userProfile,
      adminProfile: null,
    },
  };
};

// REGISTER STAFF
const registerStaff = async (payload: any, createdByRole: string) => {
  if (!['SUPER_ADMIN', 'ADMIN'].includes(createdByRole)) {
    throw new ApiError(httpStatus.FORBIDDEN, 'Only admins can register staff accounts');
  }

  const { email, password, fullName, role = 'ADMIN' } = payload;

  if (!email) throw new ApiError(httpStatus.BAD_REQUEST, 'Email is required');
  if (!password) throw new ApiError(httpStatus.BAD_REQUEST, 'Password is required');
  if (!['ADMIN', 'SUPER_ADMIN'].includes(role)) {
    throw new ApiError(httpStatus.BAD_REQUEST, 'Invalid role. Only ADMIN or SUPER_ADMIN allowed.');
  }

  const exists = await prisma.user.findUnique({ where: { email } });
  if (exists) {
    throw new ApiError(httpStatus.BAD_REQUEST, 'A user with this email already exists');
  }

  const hashedPassword = await bcrypt.hash(password, 12);

  const result = await prisma.$transaction(async tx => {
    const staff = await tx.user.create({
      data: {
        email,
        password: hashedPassword,
        role: role as UserRole,
        status: UserStatus.ACTIVE,
        isVerified: true,
        isProfileCompleted: false,
        logInProcess: LogInProcess.EMAIL,
      },
    });

    const adminProfile = await tx.adminProfile.create({
      data: {
        userId: staff.id,
        fullName: fullName || '',
      },
    });

    return { staff, adminProfile };
  });

  const { password: _pw, ...staffWithoutPassword } = result.staff;
  return {
    ...staffWithoutPassword,
    adminProfile: result.adminProfile,
  };
};

export const AuthServices = {
  signupToDb,
  loginUser,
  socialLogin,
  getMe,
  googleLoginWithNextAuth,
  changePassword,
  forgetPassword,
  resetPassword,
  refreshToken,
  userStatusUpdate,
  generateOTP,
  verifyOTP,
  resendOTP,
  socialSignupOrLogin,
  registerStaff,
};
