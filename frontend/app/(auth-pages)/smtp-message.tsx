import { ArrowUpRight, InfoIcon } from "lucide-react";
import Link from "next/link";

export function SmtpMessage() {
  return (
    <div className="bg-muted/50 px-5 py-3 border rounded-md flex gap-4">
      <InfoIcon size={16} className="mt-0.5" />
      <div className="flex flex-col gap-1">
        <small className="text-sm text-secondary-foreground">
          By signing up, you agree to our short usage and privacy policies:
        </small>
        <ul className="list-disc ml-4 text-sm text-secondary-foreground space-y-1">
          <li>Absolutely no warranties</li>
          <li>Absolutely no liability</li>
          <li>Absolutely no tolerance for any kind of abuse</li>
          <li>Support available on <a 
              href="https://ircnet.info" 
              target="_blank" 
              rel="noopener noreferrer" 
              className="text-primary hover:underline"
            >IRCnet</a> #6to4
          </li>
        </ul>
      </div>
    </div>
  );
}
