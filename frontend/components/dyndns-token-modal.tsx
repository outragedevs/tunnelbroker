"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Copy, Check } from "lucide-react";

interface Props {
  tunnelId: string;
  token: string | null;
  onClose: () => void;
}

function CopyButton({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <Button
      variant="outline"
      size="sm"
      onClick={async () => {
        await navigator.clipboard.writeText(value);
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      }}
    >
      {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
    </Button>
  );
}

function CodeBlock({ children }: { children: string }) {
  return (
    <pre className="bg-muted text-xs p-3 rounded overflow-x-auto">
      <code>{children}</code>
    </pre>
  );
}

export function DyndnsTokenModal({ tunnelId, token, onClose }: Props) {
  if (!token) return null;
  const updateUrl = "https://tb.tahio.eu/nic/update?hostname=<domain>&myip=<ipaddr>";

  const fritzbox = `Update-URL: ${updateUrl}
Domain name: ${tunnelId}
Username:    ${tunnelId}
Password:    ${token}`;

  const ddclient = `protocol=dyndns2
use=web, web=https://ipv4.icanhazip.com
server=tb.tahio.eu
ssl=yes
login=${tunnelId}
password=${token}
${tunnelId}`;

  const mikrotik = `:local ip [/ip cloud get public-address]
/tool fetch url="https://tb.tahio.eu/nic/update?hostname=${tunnelId}&myip=$ip" \\
  user="${tunnelId}" password="${token}" mode=https keep-result=no`;

  const openwrt = `config service 'tb_${tunnelId}'
    option enabled '1'
    option service_name 'custom'
    option update_url 'https://[USERNAME]:[PASSWORD]@tb.tahio.eu/nic/update?hostname=[DOMAIN]&myip=[IP]'
    option domain '${tunnelId}'
    option username '${tunnelId}'
    option password '${token}'
    option ip_source 'web'
    option ip_url 'https://ipv4.icanhazip.com'`;

  return (
    <Dialog open={true} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>DDNS token for {tunnelId}</DialogTitle>
          <DialogDescription>
            Copy this token now — we won't show it again after you close this dialog. You can generate a new one anytime with Rotate.
          </DialogDescription>
        </DialogHeader>

        <div className="flex items-center gap-2">
          <code className="flex-1 bg-muted p-2 rounded text-sm break-all font-mono">{token}</code>
          <CopyButton value={token} />
        </div>

        <Tabs defaultValue="fritzbox" className="mt-4">
          <TabsList>
            <TabsTrigger value="fritzbox">Fritz!Box</TabsTrigger>
            <TabsTrigger value="ddclient">ddclient</TabsTrigger>
            <TabsTrigger value="mikrotik">MikroTik</TabsTrigger>
            <TabsTrigger value="openwrt">OpenWrt</TabsTrigger>
          </TabsList>
          <TabsContent value="fritzbox"><CodeBlock>{fritzbox}</CodeBlock></TabsContent>
          <TabsContent value="ddclient"><CodeBlock>{ddclient}</CodeBlock></TabsContent>
          <TabsContent value="mikrotik"><CodeBlock>{mikrotik}</CodeBlock></TabsContent>
          <TabsContent value="openwrt"><CodeBlock>{openwrt}</CodeBlock></TabsContent>
        </Tabs>

        <DialogFooter>
          <Button onClick={onClose}>Close</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
