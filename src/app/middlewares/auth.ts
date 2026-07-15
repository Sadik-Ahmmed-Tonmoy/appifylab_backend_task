import { NextFunction, Request, Response } from 'express';

import { JsonWebTokenError, Secret, TokenExpiredError } from 'jsonwebtoken';
import config from '../../config';

import { UserStatus } from '@prisma/client';
import httpStatus from 'http-status';
import ApiError from '../../errors/ApiErrors';
import { jwtHelpers } from '../../helpers/jwtHelpers';
import prisma from '../../shared/prisma';
import type { MyUser } from '../../interfaces';

const auth = (...roles: string[]) => {
  return async (
    req: Request & { user?: MyUser },
    res: Response,
    next: NextFunction,
  ) => {
    try {
      const authHeader = req.headers.authorization;

      if (!authHeader || !authHeader.startsWith("Bearer ")) {
        throw new ApiError(httpStatus.UNAUTHORIZED, "Verify token needed");
      }

      const token = authHeader.split(" ")[1];

      if (!token) {
        if (req.headers.accept === "text/event-stream") {
          res.writeHead(httpStatus.UNAUTHORIZED, {
            "Content-Type": "text/event-stream",
            Connection: "close",
          });
          res.write(
            `event: error\ndata: ${JSON.stringify({
              message: "User not found!",
            })}\n\n`
          );
          res.end();
          return;
        }
        throw new ApiError(httpStatus.UNAUTHORIZED, "You are not authorized!");
      }

      let verifiedUser;
      try {
        verifiedUser = jwtHelpers.verifyToken(token, config.jwt.access_secret as Secret);
      } catch (jwtErr) {
        if (jwtErr instanceof TokenExpiredError) {
          throw new ApiError(httpStatus.UNAUTHORIZED, "Access token expired");
        }
        if (jwtErr instanceof JsonWebTokenError) {
          throw new ApiError(httpStatus.UNAUTHORIZED, "Invalid access token");
        }
        throw jwtErr;
      }

      const user = await prisma.user.findUnique({
        where: {
          id: verifiedUser.id,
        },
      });

      if (!user) {
        throw new ApiError(httpStatus.NOT_FOUND, 'This user is not found !');
      }

      const userStatus = user?.status;

      if (userStatus === UserStatus.INACTIVE) {
        throw new ApiError(httpStatus.FORBIDDEN, 'This user is inactive !');
      }
      if (user.status === UserStatus.BLOCKED) {
        throw new ApiError(httpStatus.UNAUTHORIZED, 'You are Blocked!');
      }

      if (!user.isVerified) {
        throw new ApiError(httpStatus.UNAUTHORIZED, 'You are not verified!');
      }

      if (roles.length && !roles.includes(verifiedUser.role)) {
        throw new ApiError(httpStatus.FORBIDDEN, "Forbidden! You are not authorized");
      }

      req.user = verifiedUser as MyUser;

      next();
    } catch (err) {
      console.log(err);
      next(err);
    }
  };
};

export default auth;