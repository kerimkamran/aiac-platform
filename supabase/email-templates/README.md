# Vantage email templates and sign-in link setup

Vantage sends **one** email through Supabase: the "Reset password" email. It is
used for invitations, "Resend invite", deadline reminders and "Forgot
password". HR creates the account first, then this email lets the person choose
a password.

## One-time setup in the Supabase Dashboard

Do this for every Supabase project (staging and production).

1. **Authentication > Email Templates > Reset password**
   - Subject: `Set your Vantage password`
   - Body: paste in all of `recovery.html`.
2. **Authentication > URL Configuration**
   - **Site URL**: the address people use to reach Vantage, for example
     `https://vantage.example.com`, with no slash at the end. The emailed link
     starts with this value, so a wrong Site URL sends people to the wrong
     site.
   - **Redirect URLs**: add `https://<your domain>/invite/callback`.
3. **Authentication > Sign In / Providers > Email**
   - **Email OTP expiration**: `86400` (24 hours, the maximum). The default is
     one hour, which is too short for an invitation.
   - **Email OTP length**: `10` (the maximum). The secret in each link is
     built from this code, so a longer code makes links far harder to guess.
     Nobody has to type it: people only click the link.
   - "Allow new users to sign up" should be **off**. Accounts are created by HR.
   - **Minimum password length**: 8, with no required character types. The
     set-password page tells people "At least 8 characters"; if you make the
     rule stricter, change that text in `src/i18n` to match.
4. **Authentication > SMTP Settings**: set up custom SMTP. Supabase's built-in
   mail service only delivers to members of the Supabase project team and
   allows a few emails per hour, so real candidates never receive anything
   without this. Set the **sender name** to `Vantage`: the help pages tell
   people to look for an email from Vantage.
5. **Authentication > Rate Limits**: after setting up SMTP, raise "Emails sent
   per hour" so bulk invitations are not cut off. "Forgot password" does not
   tell people when a send fails, so a low limit fails silently.

## How the link works

The button in `recovery.html` opens
`<Site URL>/auth/confirm?token_hash=...&type=recovery`. That page shows a
**Continue** button. Selecting it checks the link on the server, signs the
person in and takes them to "Set your password".

- The link works on any phone or computer. It does not depend on the browser
  that sent the invitation.
- Opening the page does not use the link up. This matters because mail
  security scanners open links in emails before the reader does.
- The link works once. An expired or used link shows "Send me a new link".
- After Continue, the person has an hour to choose a password.
- Someone who is already signed in (for example HR checking a copied link)
  is warned that continuing will sign them out and use the link up.

If the template is **not** updated, Supabase's default link is still accepted
(the app reads the sign-in tokens Supabase puts in the address bar), but a mail
scanner can use that link up before the person clicks it. Update the template.

"Copy invite link" in People builds the same `/auth/confirm` link without
sending an email. It needs `SUPABASE_SERVICE_ROLE_KEY`.

## Files

- `recovery.html`: the email described above.
- `invite.html`: kept ready for Supabase's "Invite user" template. Vantage does
  not send it today.

Both are English only. The AZ and RU versions should be written and reviewed by
a native speaker before they are added.
