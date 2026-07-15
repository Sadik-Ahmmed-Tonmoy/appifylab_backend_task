import nodemailer from "nodemailer";
import config from "../../config";

export const sendEmail = async (subject: string, to: string, html: string) => {
  try {
    const transporter = nodemailer.createTransport({
      host: 'smtp.gmail.com',
      port: 587,
      secure: false,
      auth: {
        user: config.email.nodemailer_email,
        pass: config.email.nodemailer_pass,
      },
    });

    const info = await transporter.sendMail({
      from: config.email.nodemailer_email,
      to,
      subject,
      html,
    });

    console.log("Email sent:", info.response);
  } catch (error) {
    console.error("Error sending email:", error);
    throw error;
  }
};
