import type { Metadata } from "next";
import { PolicyPage, PolicySection } from "@/components/policy-page";

export const metadata: Metadata = {
  title: "Delete your account · Stack",
  description: "How to delete your Stack account and its data.",
};

const CONTACT = process.env.NEXT_PUBLIC_SUPPORT_EMAIL || "hello@stackforge.in";

export default function DeleteAccountInfo() {
  return (
    <PolicyPage title="DELETE ACCOUNT" updated="29 September 2026">
      <p>You can delete your Stack account, made by StackForge Labs, and all its data at any time.</p>

      <PolicySection title="In the app (fastest)">
        <ol className="list-decimal pl-5">
          <li>Open Stack and tap your profile picture to go to <b>You</b>.</li>
          <li>Under <b>Account &amp; sync</b>, tap <b>Delete account</b>.</li>
          <li>Confirm with Google (or your password). Deletion happens immediately.</li>
        </ol>
      </PolicySection>

      <PolicySection title="Without the app">
        <p>
          Email <a href={`mailto:${CONTACT}?subject=Delete%20my%20Stack%20account`} className="underline">{CONTACT}</a>{" "}
          from the address you signed in with and ask us to delete your account. We delete it within 7 days and
          confirm by email.
        </p>
      </PolicySection>

      <PolicySection title="What gets deleted">
        <p>
          Your login, email address, name and photo, and everything synced to your account: notes, highlights, saved
          articles, playlists, focus history, your profile and stored PDF files. Nothing is kept afterwards, except
          where the law requires us to keep a record for a short time.
        </p>
      </PolicySection>
    </PolicyPage>
  );
}
