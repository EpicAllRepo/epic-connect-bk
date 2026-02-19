import nodemailer from "nodemailer";

export const sendOtpEmail = async (to: string, otp: string) => {
 const transporter = nodemailer.createTransport({
  host: "smtppro.zoho.in",
  port: 465,
  secure: true,
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});
  await transporter.sendMail({
    from: `"Your App" <${process.env.EMAIL_USER}>`,
    to,
    subject: "Your OTP Code",
    html: `
      <div style="font-family: Arial; padding: 20px;">
        <h2>Login Verification</h2>
        <p>Your OTP is:</p>
        <h1 style="letter-spacing: 6px;">${otp}</h1>
        <p>This code will expire in 5 minutes.</p>
      </div>
    `,
  });
};
