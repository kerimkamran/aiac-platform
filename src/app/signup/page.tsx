import { redirect } from "next/navigation";

// There is no public sign-up. The old "Accounts are invite-only" dead end is
// now a helpful page: how to find your invitation and set up your account.
export default function SignupPage() {
  redirect("/help/invitation");
}
