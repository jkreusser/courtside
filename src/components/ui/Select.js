'use client';

import { forwardRef } from 'react';
import clsx from 'clsx';

const Select = forwardRef(({ className, children, ...props }, ref) => {
    return (
        <select
            ref={ref}
            className={clsx(
                'flex h-10 w-full appearance-none rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm ring-offset-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-900 dark:ring-offset-zinc-950 transition-all duration-200 hover:border-zinc-400 dark:hover:border-zinc-600',
                className
            )}
            {...props}
        >
            {children}
        </select>
    );
});

Select.displayName = 'Select';

const SelectOption = forwardRef(({ className, ...props }, ref) => {
    return <option ref={ref} className={className} {...props} />;
});

SelectOption.displayName = 'SelectOption';

export { Select, SelectOption }; 