import { Resend } from "resend";

const apiKey = process.env.AUTH_RESEND_KEY ?? process.env.RESEND_API_KEY;
const from = process.env.EMAIL_FROM ?? "Afterset <noreply@afterset.hrlw.dev>";

export async function sendEmail(to: string, subject: string, html: string) {
  if (!apiKey) {
    console.log(`[email:dev] to=${to} subject=${subject}\n${html}`);
    return;
  }
  const resend = new Resend(apiKey);
  const { error } = await resend.emails.send({ from, to, subject, html });
  if (error) console.error("[email] send failed", error);
}
