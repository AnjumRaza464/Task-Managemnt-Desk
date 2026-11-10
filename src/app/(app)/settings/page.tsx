import type { Metadata } from "next";
import { requireManagerPage } from "@/lib/auth-guard";
import { getCategories } from "@/lib/queries/categories";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PageHeader } from "@/components/shared/page-header";
import { AppearanceSettings } from "@/components/settings/appearance-settings";
import { CategoryManager } from "@/components/settings/category-manager";
import { PasswordForm } from "@/components/settings/password-form";
import { ProfileForm } from "@/components/settings/profile-form";

export const metadata: Metadata = { title: "Settings" };

export default async function SettingsPage({ searchParams }: PageProps<"/settings">) {
  const manager = await requireManagerPage();
  const params = await searchParams;
  const isAdmin = manager.role === "ADMIN";
  // Categories are an admin-panel concept; managers manage their account and appearance only.
  const tabs = isAdmin ? ["profile", "security", "categories", "appearance"] : ["profile", "security", "appearance"];
  const initial = tabs.includes(params.tab as string) ? (params.tab as string) : "profile";
  const categories = isAdmin ? await getCategories() : [];

  return (
    <>
      <PageHeader title="Settings" description={isAdmin ? "Your account, task categories and appearance." : "Your account and appearance."} />
      <Tabs defaultValue={initial} className="gap-6">
        <TabsList>
          <TabsTrigger value="profile">Profile</TabsTrigger>
          <TabsTrigger value="security">Security</TabsTrigger>
          {isAdmin && <TabsTrigger value="categories">Categories</TabsTrigger>}
          <TabsTrigger value="appearance">Appearance</TabsTrigger>
        </TabsList>
        <TabsContent value="profile">
          <ProfileForm user={manager} />
        </TabsContent>
        <TabsContent value="security">
          <PasswordForm />
        </TabsContent>
        {isAdmin && (
          <TabsContent value="categories">
            <CategoryManager categories={categories} />
          </TabsContent>
        )}
        <TabsContent value="appearance">
          <AppearanceSettings />
        </TabsContent>
      </Tabs>
    </>
  );
}
