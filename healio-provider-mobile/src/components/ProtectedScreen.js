import React from 'react';

// ProtectedScreen no longer enforces a wallet/subscription gate for provider app.
// It simply renders its children so provider features remain accessible.
export default function ProtectedScreen({ children }) {
  return <>{children}</>;
}
