import express from "express";
import auth from "../../middlewares/auth";
import validateRequest from "../../middlewares/validateRequest";
import { AuthController } from "./auth.controller";
import { authValidation } from "./auth.validation";

const router = express.Router();

// user login route
router.post("/signup", AuthController.createUser);
router.post("/register", AuthController.createUser); // alias for frontend

router.post("/register-staff", auth("SUPER_ADMIN", "ADMIN"), AuthController.registerStaff);

router.post("/login", AuthController.loginUser);

router.post("/social-login", AuthController.socialLogin);

router.get("/get-me", auth(), AuthController.getMe);

router.post("/google-login", AuthController.googleLoginWithNextAuth);

router.post(
  "/verify-otp",
  validateRequest(authValidation.verify),
  AuthController.verifyOTP
);

router.post("/social-signup-login", AuthController.socialSignupOrLogin);


router.post(
  "/resend-otp",
  validateRequest(authValidation.resend),
  AuthController.resendOTP
);

router.put(
  "/change-password",
  auth(),
  validateRequest(authValidation.changePasswordValidationSchema),
  AuthController.changePassword
);

router.post(
  "/forget-password",
  validateRequest(authValidation.forgetPasswordValidationSchema),
  AuthController.forgetPassword
);
router.post(
  "/forgot-password",
  validateRequest(authValidation.forgetPasswordValidationSchema),
  AuthController.forgetPassword
); // alias for frontend

router.post(
  "/reset-password",
  validateRequest(authValidation.resetPasswordValidationSchema),
  AuthController.resetPassword
);

router.post("/refresh-token", AuthController.refreshToken);



router.post("/logout", AuthController.logoutUser);

router.patch(
  "/user-status-update/:id",
  auth("SUPER_ADMIN", "ADMIN"),
  AuthController.userStatusUpdate
);

export const AuthRoutes = router;
