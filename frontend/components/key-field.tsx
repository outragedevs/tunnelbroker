'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { CopyIcon, CheckIcon, EyeIcon, EyeOffIcon } from 'lucide-react';

interface KeyFieldProps {
  label: string;
  value: string;
  sensitive?: boolean;
  warning?: string;
}

export function KeyField({ label, value, sensitive = false, warning }: KeyFieldProps) {
  const [visible, setVisible] = useState(!sensitive);
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between">
        <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
          {label}
        </label>
        {warning && (
          <span className="text-xs text-amber-600 dark:text-amber-400">
            {warning}
          </span>
        )}
      </div>

      <div className="flex gap-2">
        <div className="flex-1 rounded-md border border-gray-300 bg-gray-50 px-3 py-2 dark:border-gray-700 dark:bg-gray-800">
          <code className="text-sm font-mono text-gray-900 dark:text-gray-100 break-all">
            {visible ? value : '\u2022'.repeat(44)}
          </code>
        </div>

        <div className="flex gap-1">
          {sensitive && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setVisible(!visible)}
              title={visible ? 'Hide key' : 'Show key'}
            >
              {visible ? <EyeOffIcon size={16} /> : <EyeIcon size={16} />}
            </Button>
          )}

          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleCopy}
            title="Copy to clipboard"
          >
            {copied ? <CheckIcon size={16} /> : <CopyIcon size={16} />}
          </Button>
        </div>
      </div>
    </div>
  );
}
