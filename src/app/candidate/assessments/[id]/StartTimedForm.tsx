"use client";

import { useRef, useState } from "react";
import { Icon } from "@/components/ui";
import { Button } from "@/components/ui/Button";
import { Callout } from "@/components/ui/Callout";
import { cameraConsentKey } from "./proctoring-gate";
import type { Dict } from "@/i18n/en";
import { fillText } from "@/lib/dates";

/**
 * The text.startTimed button. When the assessment records video,
 * the camera is checked and allowed here, BEFORE the clock starts, so a slow
 * permission prompt never eats into the candidate's time.
 */
export function StartTimedForm({
  caId,
  minutes,
  cameraRequired,
  startAction,
  text,
}: {
  caId: string;
  minutes: number;
  cameraRequired: boolean;
  startAction: () => Promise<void>;
  text: Dict["candidate"]["start"];
}) {
  const formRef = useRef<HTMLFormElement>(null);
  const [state, setState] = useState<"idle" | "checking" | "starting" | "blocked">("idle");

  async function onStart() {
    if (!cameraRequired) {
      setState("starting");
      formRef.current?.requestSubmit();
      return;
    }
    setState("checking");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
      stream.getTracks().forEach((t) => t.stop());
      try {
        sessionStorage.setItem(cameraConsentKey(caId), "1");
      } catch {}
      setState("starting");
      formRef.current?.requestSubmit();
    } catch {
      setState("blocked");
    }
  }

  return (
    <form ref={formRef} action={startAction} className="mt-8">
      {cameraRequired ? (
        <Callout tone="info" title={text.cameraTitle} className="mb-4">
          {text.cameraBody}
        </Callout>
      ) : null}
      {state === "blocked" ? (
        <Callout tone="warning" title={text.blockedTitle} role="alert" className="mb-4">
          {text.blockedBody}
        </Callout>
      ) : null}
      <Button
        type="button"
        size="lg"
        block
        onClick={onStart}
        pending={state === "checking" || state === "starting"}
        pendingLabel={state === "checking" ? text.checking : text.starting}
      >
        {cameraRequired ? (
          <>
            <Icon name="camera" className="h-4 w-4" />
            {text.allowAndStart}
          </>
        ) : (
          text.startTimed
        )}
      </Button>
      <p className="mt-3 text-center text-sm text-muted">{fillText(text.timerBegins, { n: minutes })}</p>
    </form>
  );
}
