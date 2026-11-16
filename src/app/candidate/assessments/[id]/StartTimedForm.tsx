"use client";

import { useRef, useState } from "react";
import { Icon } from "@/components/ui";
import { Button } from "@/components/ui/Button";
import { Callout } from "@/components/ui/Callout";
import { cameraConsentKey } from "./proctoring-gate";

/**
 * The "Start the timed assessment" button. When the assessment records video,
 * the camera is checked and allowed here, BEFORE the clock starts, so a slow
 * permission prompt never eats into the candidate's time.
 */
export function StartTimedForm({
  caId,
  minutes,
  cameraRequired,
  startAction,
}: {
  caId: string;
  minutes: number;
  cameraRequired: boolean;
  startAction: () => Promise<void>;
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
        <Callout tone="info" title="This assessment uses your camera" className="mb-4">
          Video is recorded for the hiring team to check the assessment was taken fairly. It is not analysed automatically.
          You will be asked to allow the camera now, before the timer starts.
        </Callout>
      ) : null}
      {state === "blocked" ? (
        <Callout tone="warning" title="The camera is blocked" role="alert" className="mb-4">
          Allow camera access for this site in your browser, then press the button again. The timer has not started.
        </Callout>
      ) : null}
      <Button
        type="button"
        size="lg"
        block
        onClick={onStart}
        pending={state === "checking" || state === "starting"}
        pendingLabel={state === "checking" ? "Checking the camera…" : "Starting…"}
      >
        {cameraRequired ? (
          <>
            <Icon name="camera" className="h-4 w-4" />
            Allow the camera and start
          </>
        ) : (
          "Start the timed assessment"
        )}
      </Button>
      <p className="mt-3 text-center text-sm text-muted">The {minutes}-minute timer begins the moment you start.</p>
    </form>
  );
}
