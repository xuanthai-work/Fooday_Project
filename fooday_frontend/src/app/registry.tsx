'use client';

import React, { useState } from 'react';
import { useServerInsertedHTML } from 'next/navigation';
import { StyleRegistry, createStyleRegistry } from 'styled-jsx';

/**
 * Collects styled-jsx rules during SSR and flushes them into <head> before
 * any markup that uses them — prevents the flash of unstyled content the
 * App Router otherwise shows for `<style jsx>` in client components.
 */
export default function StyledJsxRegistry({
  children,
}: {
  children: React.ReactNode;
}) {
  const [registry] = useState(() => createStyleRegistry());

  useServerInsertedHTML(() => {
    const styles = registry.styles();
    registry.flush();
    return <>{styles}</>;
  });

  return <StyleRegistry registry={registry}>{children}</StyleRegistry>;
}
