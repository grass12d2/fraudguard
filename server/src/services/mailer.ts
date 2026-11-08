
import nodemailer from "nodemailer";
import { config } from "../config.js";

const transporter = nodemailer.createTransport({
  host: config.smtpHost,
  port: config.smtpPort,
});

export async function sendVerificationEmail(
  email: string,
  verificationUrl: string
): Promise<void> {
  await transporter.sendMail({
    from: '"FraudGuard" <no-reply@fraudguard.local>',
    to: email,
    subject: "Подтверждение адреса электронной почты",
    text: `Для подтверждения адреса электронной почты перейдите по ссылке:

${verificationUrl}

Ссылка действительна в течение 24 часов.`,
  });
}
