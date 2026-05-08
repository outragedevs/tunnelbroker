import { createClient } from "@/utils/supabase/server";
import { redirect } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default async function AccountPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return redirect("/sign-in");
  }

  // Get user metadata
  const userData = user.user_metadata;
  const fullName = userData?.full_name || "";
  const nickname = userData?.nickname || "";
  const isEmailAuth = user.app_metadata.provider === "email";

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Account Management</h1>
      
      <Card>
        <CardHeader>
          <CardTitle>Profile Information</CardTitle>
          <CardDescription>Update your account details</CardDescription>
        </CardHeader>
        <CardContent>
          <form className="space-y-4">
            <div className="grid grid-cols-1 gap-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email Address</Label>
                <Input id="email" defaultValue={user.email} disabled />
                <p className="text-xs text-muted-foreground">
                  Email address cannot be changed directly. Please contact support.
                </p>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="fullName">Full Name</Label>
                <Input id="fullName" defaultValue={fullName} />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="nickname">Nickname (optional)</Label>
                <Input id="nickname" defaultValue={nickname} />
              </div>
            </div>
            
            <Button type="submit">Update Profile</Button>
          </form>
        </CardContent>
      </Card>
      
      {isEmailAuth && (
        <Card>
          <CardHeader>
            <CardTitle>Change Password</CardTitle>
            <CardDescription>Update your password</CardDescription>
          </CardHeader>
          <CardContent>
            <form className="space-y-4">
              <div className="grid grid-cols-1 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="currentPassword">Current Password</Label>
                  <Input id="currentPassword" type="password" />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="newPassword">New Password</Label>
                  <Input id="newPassword" type="password" />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="confirmPassword">Confirm New Password</Label>
                  <Input id="confirmPassword" type="password" />
                </div>
              </div>
              
              <Button type="submit">Change Password</Button>
            </form>
          </CardContent>
        </Card>
      )}
      
      <Card>
        <CardHeader>
          <CardTitle>Linked Accounts</CardTitle>
          <CardDescription>Manage your authentication methods</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium">GitHub</p>
                <p className="text-sm text-muted-foreground">
                  {user.app_metadata.provider === "github" 
                    ? "Your account is linked to GitHub" 
                    : "Link your account to GitHub for easier login"}
                </p>
              </div>
              <Button variant="outline">
                {user.app_metadata.provider === "github" ? "Unlink" : "Link"}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
      
      <Card>
        <CardHeader>
          <CardTitle>Delete Account</CardTitle>
          <CardDescription>Delete account is not implemented yet. To delete your account, please contact support on <a href="https://ircnet.info" target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:text-blue-700 underline">IRCnet</a>, channel #6to4</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="mb-4 text-muted-foreground">
            This action cannot be undone. All your data, including tunnels, will be permanently deleted.
          </p>
          <Button variant="destructive">Delete Account</Button>
        </CardContent>
      </Card>
    </div>
  );
}
