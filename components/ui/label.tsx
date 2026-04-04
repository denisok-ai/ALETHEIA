'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';

export interface LabelProps
  extends React.LabelHTMLAttributes<HTMLLabelElement> {}

const Label = React.forwardRef<HTMLLabelElement, LabelProps>(
  ({ className, ...props }, ref) => (
    // Примитив: связь с полем через htmlFor у родителя или вложенный control.
    // eslint-disable-next-line jsx-a11y/label-has-associated-control
    <label
      ref={ref}
      className={cn(
        'text-sm font-medium text-[var(--portal-text)] leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70',
        className
      )}
      {...props}
    />
  )
);
Label.displayName = 'Label';

export { Label };
