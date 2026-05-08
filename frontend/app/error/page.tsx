import Link from 'next/link';
import { Button } from '@/components/ui/button';

export default function AuthError() {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen text-center px-4">
      <div className="max-w-md p-8 bg-white dark:bg-gray-800 rounded-lg shadow-lg">
        <h1 className="text-2xl font-bold mb-4">Authentication Error</h1>
        
        <div className="mb-6 text-left">
          <p className="mb-4">
            An error occurred during the authentication process. This could be due to:
          </p>
          <ul className="list-disc pl-5 space-y-2">
            <li>Authentication code expiration</li>
            <li>Browser cookie issues</li>
            <li>Permissions were not granted</li>
            <li>Cross-domain authentication problems</li>
          </ul>
        </div>
        
        <div className="flex flex-col gap-4">
          <Button asChild>
            <Link href="/sign-in">
              Try Again
            </Link>
          </Button>
          
          <Button variant="outline" asChild>
            <Link href="/">
              Return to Home
            </Link>
          </Button>
          
          <div className="text-sm text-gray-500 mt-4">
            If you continue to experience issues, please clear your browser cookies 
            and try again, or contact support.
          </div>
        </div>
      </div>
    </div>
  );
} 