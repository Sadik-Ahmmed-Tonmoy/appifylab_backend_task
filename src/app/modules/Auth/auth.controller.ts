import { Request, Response } from 'express';
import httpStatus from 'http-status';
import type { MyUser } from '../../../interfaces';
import ApiError from '../../../errors/ApiErrors';
import sendResponse from '../../../shared/sendResponse';
import catchAsync from '../../utils/catchAsync';
import { AuthServices } from './auth.service';


const createUser = catchAsync(async (req: Request, res: Response) => {
  const result = await AuthServices.signupToDb(req.body);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Please verify your email',
    data: result,
  });
});

const loginUser = catchAsync(async (req: Request, res: Response) => {
  const result = await AuthServices.loginUser(req.body);

  if (result.isVerified) {
    res.cookie('accessToken', result.accessToken, {
      httpOnly: true,
      maxAge: 7 * 24 * 60 * 60 * 1000,
      sameSite: 'none',
      secure: true,
    });

    res.cookie('refreshToken', result.refreshToken, {
      httpOnly: true,
      maxAge: result.keepMeLogin
        ? 30 * 24 * 60 * 60 * 1000
        : 7 * 24 * 60 * 60 * 1000,
      sameSite: 'none',
      secure: true,
    });
  }

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: result.isVerified
      ? 'User logged in successfully'
      : 'OTP sent successfully',
    data: result,
  });
});

const socialLogin = catchAsync(async (req: Request, res: Response) => {
  const result = await AuthServices.socialLogin({
    email: req.body.email,
    logInProcess: req.body.logInProcess,
    fcmToken: req.body.fcmToken,
  });

  if (result.isVerified) {
    res.cookie('accessToken', result.accessToken, {
      httpOnly: true,
      maxAge: 7 * 24 * 60 * 60 * 1000,
      sameSite: 'none',
      secure: true,
    });

    res.cookie('refreshToken', result.refreshToken, {
      httpOnly: true,
      maxAge: 30 * 24 * 60 * 60 * 1000,
      sameSite: 'none',
      secure: true,
    });
  }

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: result.isVerified
      ? 'User logged in successfully'
      : 'OTP sent successfully',
    data: result,
  });
});

const getMe = catchAsync(async (req: Request, res: Response) => {
  const id = req.user.id;
  const result = await AuthServices.getMe(id);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'User profile fetched successfully',
    data: result,
  });
});

const googleLoginWithNextAuth = catchAsync(
  async (req: Request, res: Response) => {
    const { isValid, isVerified, accessToken, refreshToken } =
      await AuthServices.googleLoginWithNextAuth(req.body);

    if (!isValid) {
      sendResponse(res, {
        statusCode: httpStatus.BAD_REQUEST,
        success: false,
        message: 'Invalid credentials',
        data: null,
      });
      return;
    }
    if (isValid && isVerified) {
      res.cookie('accessToken', accessToken, {
        httpOnly: true,
        maxAge: 24 * 60 * 60 * 1000,
        sameSite: 'none',
        secure: true,
      });

      res.cookie('refreshToken', refreshToken, {
        httpOnly: true,
        maxAge: 30 * 24 * 60 * 60 * 1000,
        sameSite: 'none',
        secure: true,
      });
    }

    sendResponse(res, {
      statusCode: httpStatus.OK,
      success: true,
      message: 'Google login successful',
      data: isVerified
        ? {
            accessToken,
            refreshToken,
            isVerified,
          }
        : {
            isVerified,
          },
    });
  },
);

// change password
const changePassword = catchAsync(async (req: Request, res: Response) => {
  const id = req.user.id;
  const { oldPassword, newPassword } = req.body;

  await AuthServices.changePassword(id, newPassword, oldPassword);
  sendResponse(res, {
    success: true,
    statusCode: 201,
    message: 'Password changed successfully',
    data: null,
  });
});

// forgot password
const forgetPassword = catchAsync(async (req: Request, res: Response) => {
  const data = await AuthServices.forgetPassword(req.body);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Password reset OTP sent to your email',
    data: data,
  });
});

const resetPassword = catchAsync(async (req: Request, res: Response) => {
  await AuthServices.resetPassword(req.body);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Password reset successfully',
    data: null,
  });
});

// const refreshToken = catchAsync(async (req: Request, res: Response) => {
//   let refreshToken = req.headers['authorization'];
//   if (!refreshToken) {
//     refreshToken = req.cookies.refreshToken;
//   }
//   if (!refreshToken) {
//     throw new ApiError(httpStatus.UNAUTHORIZED, 'Please login first');
//   }

//   // const { refreshToken } = req.cookies;
//   const result = await AuthServices.refreshToken(refreshToken as string);

//   res.cookie('accessToken', result.accessToken, {
//     httpOnly: true,
//     maxAge: 7 * 24 * 60 * 60 * 1000,
//     sameSite: 'none',
//     secure: true,
//   });

//   sendResponse(res, {
//     statusCode: httpStatus.OK,
//     success: true,
//     message: 'Token refreshed successfully',
//     data: result,
//   });
// });


// Add this helper at the top of the file
const extractTokenFromHeader = (authHeader?: string): string | null => {
  if (!authHeader) return null;
  if (authHeader.startsWith('Bearer ')) {
    return authHeader.slice(7); // Remove "Bearer "
  }
  return authHeader; // already just the token
};

const refreshToken = catchAsync(async (req: Request, res: Response) => {
  // ✅ First try Authorization header (strip Bearer)
  console.log(req.header);
  let refreshToken = extractTokenFromHeader(req.headers['authorization']);
  console.log("refreshToken", refreshToken);
  // If not found, fallback to cookie
  if (!refreshToken) {
    refreshToken = req.cookies.refreshToken;
  }
  
  if (!refreshToken) {
    throw new ApiError(httpStatus.UNAUTHORIZED, 'Please login first');
  }

  const result = await AuthServices.refreshToken(refreshToken);

  res.cookie('accessToken', result.accessToken, {
    httpOnly: true,
    maxAge: 7 * 24 * 60 * 60 * 1000,
    sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
    secure: process.env.NODE_ENV === 'production',
  });

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Token refreshed successfully',
    data: result,
  });
});


const logoutUser = catchAsync(async (req: Request, res: Response) => {
  // Clear the token cookie
  res.clearCookie('accessToken', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
  });

  res.clearCookie('refreshToken', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
  });

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'User Successfully logged out',
    data: null,
  });
});

const userStatusUpdate = catchAsync(async (req: Request, res: Response) => {
  const id = req.params.id as string;
  const { status } = req.body;
  const user = await AuthServices.userStatusUpdate(id, status);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'User status updated successfully',
    data: user,
  });
});

const verifyOTP = catchAsync(async (req: Request, res: Response) => {
  const {
    isValid,
    isVerified,
    accessToken,
    refreshToken,
    resetPasswordToken,
    email,
  } = await AuthServices.verifyOTP(req.body);

  if (!isValid) {
    sendResponse(res, {
      statusCode: httpStatus.BAD_REQUEST,
      success: false,
      message: 'Invalid OTP or expired',
      data: null,
    });
    return;
  }
  if (isValid && isVerified) {
    res.cookie('accessToken', accessToken, {
      httpOnly: true,
      maxAge: 24 * 60 * 60 * 1000,
      sameSite: 'none',
      secure: true,
    });

    res.cookie('refreshToken', refreshToken, {
      httpOnly: true,
      maxAge: 30 * 24 * 60 * 60 * 1000,
      sameSite: 'none',
      secure: true,
    });
  }

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'OTP verified successfully',
    data: isVerified
      ? {
          accessToken,
          refreshToken,
          isVerified,
        }
      : {
          isVerified,
          resetPasswordToken,
          email,
        },
  });
});

const resendOTP = catchAsync(async (req: Request, res: Response) => {
  const result = await AuthServices.resendOTP(req.body);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'OTP resent successfully',
    data: result,
  });
});

const socialSignupOrLogin = catchAsync(async (req: Request, res: Response) => {
  const result = await AuthServices.socialSignupOrLogin(req.body);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Social signup/login successful',
    data: result,
  });
});

const registerStaff = catchAsync(async (req: Request, res: Response) => {
  const callerRole = (req as Request & { user?: MyUser }).user?.role || 'USER';
  const result = await AuthServices.registerStaff(req.body, callerRole);
  sendResponse(res, {
    statusCode: httpStatus.CREATED,
    success: true,
    message: 'Staff member registered successfully',
    data: result,
  });
});

export const AuthController = {
  createUser,
  loginUser,
  socialLogin,
  getMe,
  googleLoginWithNextAuth,
  changePassword,
  forgetPassword,
  resetPassword,
  refreshToken,
  logoutUser,
  userStatusUpdate,
  verifyOTP,
  resendOTP,
  socialSignupOrLogin,
  registerStaff,
};
