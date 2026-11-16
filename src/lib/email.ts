import "server-only";
import nodemailer from "nodemailer";
import { siteUrl } from "@/lib/site-url";
import { BRAND } from "@/lib/brand";

/**
 * Email sent by Vantage itself through the company's mail server (A-03, A-08).
 *
 * Needs SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS and MAIL_FROM (for example
 * "Vantage <vantage@azerconnect.az>"). Without them nothing is sent and callers
 * fall back to the in-app notification: a reminder is never replaced by a
 * password-reset email.
 *
 * Sign-in links are still sent by Supabase Auth (see supabase/email-templates).
 */

export type Lang = "en" | "az" | "ru";

export function emailConfigured(): boolean {
  return !!(process.env.SMTP_HOST && process.env.MAIL_FROM);
}

export async function sendEmail(input: { to: string; subject: string; text: string; html: string }): Promise<string | null> {
  if (!emailConfigured()) return "Email is not set up yet.";
  try {
    const port = Number(process.env.SMTP_PORT || 587);
    const transport = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port,
      secure: port === 465,
      auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS || "" } : undefined,
    });
    await transport.sendMail({ from: process.env.MAIL_FROM, to: input.to, subject: input.subject, text: input.text, html: input.html });
    return null;
  } catch (e) {
    return e instanceof Error ? e.message : "The email could not be sent.";
  }
}

export function pickLang(raw: string | null | undefined): Lang {
  return raw === "az" || raw === "ru" ? raw : "en";
}

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c] as string);

type Copy = {
  assignedSubject: (t: string) => string;
  assignedBody: (name: string, t: string, due: string | null) => string;
  reminderSubject: (t: string) => string;
  reminderBody: (name: string, t: string, due: string) => string;
  button: string;
  footer: string;
};

const COPY: Record<Lang, Copy> = {
  en: {
    assignedSubject: (t) => `You have a new assessment: ${t}`,
    assignedBody: (n, t, d) => `Hello ${n}, you have been asked to take "${t}".${d ? ` Please finish by ${d}.` : ""} You can start whenever you are ready.`,
    reminderSubject: (t) => `Reminder: ${t} is due soon`,
    reminderBody: (n, t, d) => `Hello ${n}, "${t}" is due on ${d} and you have not finished it yet.`,
    button: "Open Vantage",
    footer: "Sent by Vantage, Azerconnect Group. If this is not for you, you can ignore it.",
  },
  az: {
    assignedSubject: (t) => `Sizin yeni qiymətləndirməniz var: ${t}`,
    assignedBody: (n, t, d) => `Salam ${n}, sizdən "${t}" qiymətləndirməsini keçmək xahiş olunur.${d ? ` Zəhmət olmasa ${d} tarixinədək tamamlayın.` : ""} İstədiyiniz vaxt başlaya bilərsiniz.`,
    reminderSubject: (t) => `Xatırlatma: "${t}" üçün son tarix yaxınlaşır`,
    reminderBody: (n, t, d) => `Salam ${n}, "${t}" üçün son tarix ${d}-dir və siz hələ onu tamamlamamısınız.`,
    button: "Vantage-i açın",
    footer: "Azerconnect Group-un Vantage platformasından göndərilib. Bu məktub sizə aid deyilsə, nəzərə almayın.",
  },
  ru: {
    assignedSubject: (t) => `У вас новая оценка: ${t}`,
    assignedBody: (n, t, d) => `Здравствуйте, ${n}! Вас просят пройти оценку «${t}».${d ? ` Пожалуйста, завершите её до ${d}.` : ""} Начать можно в любое удобное время.`,
    reminderSubject: (t) => `Напоминание: срок для «${t}» скоро истекает`,
    reminderBody: (n, t, d) => `Здравствуйте, ${n}! Срок для «${t}» — ${d}, а вы ещё не завершили оценку.`,
    button: "Открыть Vantage",
    footer: "Отправлено платформой Vantage, Azerconnect Group. Если письмо не для вас, просто проигнорируйте его.",
  },
};

function render(lang: Lang, subject: string, body: string, path: string) {
  const c = COPY[lang];
  const url = `${siteUrl()}${path}`;
  const text = `${body}\n\n${c.button}: ${url}\n\n${c.footer}`;
  const html = `<div style="font-family:Inter,Arial,sans-serif;max-width:520px;margin:0 auto;padding:24px;color:${BRAND.ink}">
<p style="font-size:16px;line-height:1.5">${esc(body)}</p>
<p style="margin:28px 0"><a href="${esc(url)}" style="background:${BRAND.navy};color:${BRAND.white};text-decoration:none;padding:12px 22px;border-radius:999px;font-weight:600">${esc(c.button)}</a></p>
<p style="font-size:13px;color:${BRAND.muted};line-height:1.5">${esc(c.footer)}</p></div>`;
  return { subject, text, html };
}

export function assignmentEmail(p: { lang: Lang; name: string; title: string; due: string | null }) {
  const c = COPY[p.lang];
  return render(p.lang, c.assignedSubject(p.title), c.assignedBody(p.name, p.title, p.due), "/candidate/assessments");
}

export function reminderEmail(p: { lang: Lang; name: string; title: string; due: string }) {
  const c = COPY[p.lang];
  return render(p.lang, c.reminderSubject(p.title), c.reminderBody(p.name, p.title, p.due), "/candidate/assessments");
}
