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
  const tabs = ["profile", "security", "categories", "appearance"] as const;
  const initial = tabs.includes(params.tab as (typeof tabs)[number]) ? (params.tab as string) : "profile";
  const categories = await getCategories();

  return (
    <>
      <PageHeader title="Settings" description="Your account, task categories and appearance." />
      <Tabs defaultValue={initial} className="gap-6">
        <TabsList>
          <TabsTrigger value="profile">Profile</TabsTrigger>
          <TabsTrigger value="security">Security</TabsTrigger>
          <TabsTrigger value="categories">Categories</TabsTrigger>
          <TabsTrigger value="appearance">Appearance</TabsTrigger>
        </TabsList>
        <TabsContent value="profile">
          <ProfileForm user={manager} />
        </TabsContent>
        <TabsContent value="security">
          <PasswordForm />
        </TabsContent>
        <TabsContent value="categories">
          <CategoryManager categories={categories} />
        </TabsContent>
        <TabsContent value="appearance">
          <AppearanceSettings />
        </TabsContent>
      </Tabs>
    </>
  );
}
