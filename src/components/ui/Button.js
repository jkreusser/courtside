'use client';

import { forwardRef } from 'react';
import clsx from 'clsx';

const Button = forwardRef(
    ({ className, variant = 'primary', size = 'md', children, ...props }, ref) => {
        const baseStyles = 'inline-flex items-center justify-center rounded-md font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:opacity-50';

        const variantStyles = {
            primary: 'bg-primary hover:bg-white text-secondary',
            secondary: 'border border-white bg-transparent hover:bg-white/10 dark:border-white text-white',
            outline: 'border border-white bg-transparent hover:bg-white/10 dark:border-white text-white',
            ghost: 'bg-transparent hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-900 dark:text-zinc-50',
            danger: 'bg-red-500 hover:bg-red-600 text-white',
        };

        const sizeStyles = {
            sm: 'h-8 px-3 text-xs',
            md: 'h-10 px-4 py-2',
            lg: 'h-12 px-6 py-3 text-lg',
        };

        return (
            <button
                className={clsx(
                    baseStyles,
                    variantStyles[variant],
                    sizeStyles[size],
                    className
                )}
                ref={ref}
                {...props}
            >
                {children}
            </button>
        );
    }
);

Button.displayName = 'Button';

export default Button; 