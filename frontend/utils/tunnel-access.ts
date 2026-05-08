import { NextResponse } from "next/server";

import { createClient } from "@/utils/supabase/server";
import { getUserHex4Id } from "@/utils/user-utils";

export async function requireAuthenticatedHex4Id() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return {
      errorResponse: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    };
  }

  const hex4Id = await getUserHex4Id(user.id);
  if (!hex4Id) {
    return {
      errorResponse: NextResponse.json({ error: "Could not resolve user identity" }, { status: 500 }),
    };
  }

  return { hex4Id };
}
