import { z } from "zod";

const userValidationSchema = z.object({
  firstName: z.string().min(1, "First name is required"),
  lastName: z.string().min(1, "Last name is required"),
  email: z.string().email(),
  phoneNumber: z
    .string()
    .min(8, "Phone number must be at least 8 characters")
    .max(25, "Phone number must not exceed 25 characters")
    .optional(),
  password: z
    .string()
    .min(8, "Password must be at least 8 characters")
    .optional(),
});

const loginValidationSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8, "Password must be at least 8 characters"),
  keepMeLogin: z.boolean().optional(),
});

const updateProfileSchema = z.object({
  body: z.object({
    firstName: z.string().min(1, "First name is required").optional(),
    lastName: z.string().min(1, "Last name is required").optional(),
    email: z.string().email().optional(),
    phoneNumber: z
      .string()
      .min(8, "Phone number must be at least 8 characters")
      .max(25, "Phone number must not exceed 25 characters")
      .optional(),
    address: z.string().optional(),
    postCode: z.string().optional(),
    profileImage: z.string().optional(),
    purchasedAdvertisements: z
      .array(z.object({
        id: z.string().uuid().optional(),
        title: z.string().min(2).max(100),
        price: z.number().min(1),
        packageValidateDateRange: z.any().optional(),
            createdAt: z.any().optional(),
            carValue: z.string().min(1).optional(),
            sellerType: z.string().min(1).optional(),
            vehicleType: z.string().min(1).optional(),
            duration: z.string().min(1).optional(),
      }))
      .optional(),
    password: z
      .string()
      .min(8, "Password must be at least 8 characters")
      .optional(),
  }),
});

const changePasswordValidationSchema = z.object({
  body: z.object({
    oldPassword: z
      .string()
      .min(8, "Old password must be at least 8 characters"),
    newPassword: z
      .string()
      .min(8, "New password must be at least 8 characters"),
  }),
});

const forgetPasswordValidationSchema = z.object({
  body: z.object({
    email: z.string().email({ message: "Invalid email address" }),
  }),
});

const resetPasswordValidationSchema = z.object({
  body: z.object({
    email: z
      .string({
        required_error: "Email is required",
      })
      .email({ message: "Invalid email address" }),
    password: z
      .string({
        required_error: "New password is required",
      })
      .min(6, "New password must be at least 6 characters"),
    token: z.string({
      required_error: "Reset token is required",
    }),
  }),
});

const verify = z.object({
  body: z.object({
    email: z
      .string({
        required_error: "Email is required",
      })
      .email({ message: "Invalid email address" }),
    code: z.string({ required_error: "OTP code is required" }),
    purpose: z.enum(["EMAIL_VERIFICATION", "PASSWORD_RESET"] as const, {
      required_error: "Purpose is required",
    }),
  }),
});

const resend = z.object({
  body: z.object({
    email: z
      .string({
        required_error: "Email is required",
      })
      .email({ message: "Invalid email address" }),
    purpose: z.enum(["EMAIL_VERIFICATION", "PASSWORD_RESET"] as const, {
      required_error: "Purpose is required",
    }),
  }),
});

export const authValidation = {
  userValidationSchema,
  loginValidationSchema,
  changePasswordValidationSchema,
  updateProfileSchema,
  forgetPasswordValidationSchema,
  resetPasswordValidationSchema,
  verify,
  resend
};
