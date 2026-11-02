import { Resend } from "resend";

const from = process.env.EMAIL_FROM ?? "Afterset <noreply@afterset.hrlw.dev>";

export async function sendEmail(to: string, subject: string, html: string) {
  if (!process.env.AUTH_RESEND_KEY) {
    console.log(`[email:dev] to=${to} subject=${subject}\n${html}`);
    return;
  }
  const resend = new Resend(process.env.AUTH_RESEND_KEY);
  const { error } = await resend.emails.send({ from, to, subject, html });
  if (error) console.error("[email] send failed", error);
}
