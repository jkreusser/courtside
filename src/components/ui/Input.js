'use client';

import { forwardRef } from 'react';
import clsx from 'clsx';

const Input = forwardRef(({ className, type = 'text', ...props }, ref) => {
    return (
        <input
            type={type}
            className={clsx(
                'flex h-10 w-full rounded-md border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm ring-offset-zinc-950 file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-zinc-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 transition-all duration-200 hover:border-zinc-600',
                className
            )}
            ref={ref}
            {...props}
        />
    );
});

Input.displayName = 'Input';

export default Input; 