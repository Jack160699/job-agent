import { createClient } from "@/lib/supabase/server";
import prisma from "@/lib/db";

export async function getAuthUser() {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    return user;
  } catch {
    return null;
  }
}

export async function getDbUser() {
  try {
    const authUser = await getAuthUser();
    if (!authUser?.email) return null;

    let user = await prisma.user.findUnique({
      where: { supabaseId: authUser.id },
      include: { settings: true },
    });

    if (!user) {
      user = await prisma.user.create({
        data: {
          supabaseId: authUser.id,
          email: authUser.email,
          fullName: (authUser.user_metadata?.full_name as string) || null,
          settings: {
            create: {
              jobTitles: ["Software Engineer"],
              locations: ["Remote"],
            },
          },
        },
        include: { settings: true },
      });
    }

    return user;
  } catch (error) {
    console.error("getDbUser failed:", error);
    return null;
  }
}

export async function requireDbUser() {
  const user = await getDbUser();
  if (!user) {
    throw new Error("Unauthorized");
  }
  return user;
}
