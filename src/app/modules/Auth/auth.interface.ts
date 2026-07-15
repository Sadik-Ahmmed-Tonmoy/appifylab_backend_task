import { OTPPurpose } from "@prisma/client";


export type IUser = {
  firstName: string;
  lastName: string;
  email: string;
  phoneNumber?: string;
  password?: string;
  profileImage?: string;
}

export type ForgetPasswordPayload = {
  email: string;
}


export type OTPGeneratePayload = {
  userId: string;
  purpose: OTPPurpose;
  expiresInMinutes?: number;
}

export type OTPVerifyPayload = {
  email: string;
  code: string;
  purpose: OTPPurpose;
}