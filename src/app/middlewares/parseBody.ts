import { RequestHandler } from "express";

export const parseBody: RequestHandler = (req, res, next) => {
  if (req.body?.data) {
    try {
      req.body = JSON.parse(req.body.data);
    } catch {
      res.status(400).json({
        success: false,
        message: "Invalid JSON format in data",
      });
      return; // 👈 IMPORTANT: no Response return
    }
  }
  next();
};
