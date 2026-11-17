"use client";

import { SectionError } from "@/components/SectionError";
import { useShellText } from "@/components/shell-i18n";

export default function Error(props: { error: Error & { digest?: string }; reset: () => void }) {
  const { text } = useShellText();
  return <SectionError {...props} homeHref="/candidate" homeLabel={text.myHome} />;
}
