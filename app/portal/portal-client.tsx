'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

import PortalEntrySequence from '@/components/portal-entry-sequence';
import portalEntryStyles from '@/components/portal-entry-sequence.module.css';
import { usePortalEntryGate } from '@/hooks/use-portal-entry-gate';

interface PortalClientProps {
  firstName: string;
  children: React.ReactNode;
}

export default function PortalClient({ firstName, children }: PortalClientProps) {
  const { ready, shouldShow, quality, consume, dismiss } = usePortalEntryGate();
  const [completed, setCompleted] = useState(false);
  const contentRef = useRef<HTMLDivElement>(null);
  const consumedRef = useRef(false);

  const showPortalEntry = ready && shouldShow && !completed;

  const handleSequenceComplete = useCallback(() => {
    dismiss();
    setCompleted(true);
  }, [dismiss]);

  useEffect(() => {
    const node = contentRef.current;
    if (!node) {
      return;
    }

    if (showPortalEntry) {
      node.setAttribute('inert', '');
    } else {
      node.removeAttribute('inert');
    }
  }, [showPortalEntry]);

  useEffect(() => {
    if (!showPortalEntry || consumedRef.current) {
      return;
    }

    consume();
    consumedRef.current = true;
  }, [consume, showPortalEntry]);

  return (
    <>
      {showPortalEntry ? (
        <PortalEntrySequence
          firstName={firstName}
          quality={quality}
          onComplete={handleSequenceComplete}
        />
      ) : null}
      <div
        ref={contentRef}
        aria-hidden={showPortalEntry || undefined}
        className={[
          portalEntryStyles.contentShell,
          !ready ? portalEntryStyles.contentBooting : '',
          showPortalEntry ? portalEntryStyles.contentLocked : '',
        ]
          .filter(Boolean)
          .join(' ')}
      >
        {children}
      </div>
    </>
  );
}
