import { useForm } from '@tanstack/react-form';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { createFileRoute } from '@tanstack/react-router';
import { Loader2, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import { z } from 'zod';

import {
  authClient,
  changePassword,
  MIN_PASSWORD_LENGTH,
  useSession,
} from '@/core/auth/client';
import { Link } from '@/core/i18n/navigation';
import { cn } from '@/lib/utils';
import { m } from '@/paraglide/messages.js';
import { PasswordField } from '@/components/form-field';
import { Button, buttonVariants } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';

const passwordSchema = z
  .object({
    currentPassword: z.string().min(1),
    newPassword: z
      .string()
      .min(MIN_PASSWORD_LENGTH, m['common.sign.password_min_length']()),
    confirmPassword: z.string().min(1),
    revokeOtherSessions: z.boolean(),
  })
  .refine((d) => d.newPassword === d.confirmPassword, {
    path: ['confirmPassword'],
    message: m['common.sign.password_mismatch'](),
  });

interface AuthAccount {
  providerId: string;
  accountId: string;
}

async function listAccounts(): Promise<AuthAccount[]> {
  const { data, error } = await authClient.$fetch<AuthAccount[]>(
    '/list-accounts',
    { method: 'GET' }
  );
  if (error) throw new Error(error.message || 'Failed to load accounts');
  return data ?? [];
}

function ChangePasswordCard() {
  const queryClient = useQueryClient();

  const form = useForm({
    defaultValues: {
      currentPassword: '',
      newPassword: '',
      confirmPassword: '',
      revokeOtherSessions: false,
    },
    validators: { onSubmit: passwordSchema },
    onSubmit: async ({ value }) => {
      const result: any = await changePassword({
        currentPassword: value.currentPassword,
        newPassword: value.newPassword,
        revokeOtherSessions: value.revokeOtherSessions,
      });
      if (result?.error) {
        toast.error(
          result.error.code === 'INVALID_PASSWORD'
            ? m['settings.security.invalid_current_password']()
            : result.error.message || m['settings.security.save_failed']()
        );
        return;
      }
      toast.success(m['settings.security.saved']());
      queryClient.invalidateQueries({ queryKey: ['user-accounts'] });
      form.reset();
    },
  });

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        form.handleSubmit();
      }}
    >
      <Card>
        <CardHeader>
          <CardTitle>{m['settings.security.password_card']()}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6 pb-2">
          <form.Field name="currentPassword">
            {(field) => (
              <PasswordField
                field={field}
                label={m['settings.security.current_password_title']()}
                required
                autoComplete="current-password"
                placeholder={m[
                  'settings.security.current_password_placeholder'
                ]()}
                revealLabel={m['common.sign.show_password']()}
                hideLabel={m['common.sign.hide_password']()}
              />
            )}
          </form.Field>
          <form.Field name="newPassword">
            {(field) => (
              <PasswordField
                field={field}
                label={m['common.sign.new_password_title']()}
                required
                autoComplete="new-password"
                placeholder={m['common.sign.new_password_placeholder']()}
                revealLabel={m['common.sign.show_password']()}
                hideLabel={m['common.sign.hide_password']()}
              />
            )}
          </form.Field>
          <form.Field name="confirmPassword">
            {(field) => (
              <PasswordField
                field={field}
                label={m['common.sign.confirm_password_title']()}
                required
                autoComplete="new-password"
                placeholder={m[
                  'common.sign.confirm_new_password_placeholder'
                ]()}
                revealLabel={m['common.sign.show_password']()}
                hideLabel={m['common.sign.hide_password']()}
              />
            )}
          </form.Field>
          <form.Field name="revokeOtherSessions">
            {(field) => (
              <div className="flex items-start gap-3">
                <Checkbox
                  id={field.name}
                  checked={field.state.value}
                  onCheckedChange={(checked) =>
                    field.handleChange(checked === true)
                  }
                />
                <div className="space-y-1 leading-tight">
                  <Label htmlFor={field.name} className="cursor-pointer">
                    {m['settings.security.revoke_other_sessions']()}
                  </Label>
                  <p className="text-muted-foreground text-sm">
                    {m['settings.security.revoke_other_sessions_hint']()}
                  </p>
                </div>
              </div>
            )}
          </form.Field>
        </CardContent>
        <CardFooter>
          <form.Subscribe selector={(s) => s.isSubmitting}>
            {(isSubmitting) => (
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting && (
                  <Loader2 className="mr-2 size-4 animate-spin" />
                )}
                {isSubmitting
                  ? m['settings.security.saving']()
                  : m['settings.security.submit']()}
              </Button>
            )}
          </form.Subscribe>
        </CardFooter>
      </Card>
    </form>
  );
}

function SetPasswordCard({
  provider,
  email,
}: {
  provider: string;
  email: string;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{m['settings.security.password_card']()}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4 pb-2">
        <p className="text-muted-foreground text-sm">
          {m['settings.security.no_password_description']({ provider, email })}
        </p>
        <Link
          href={
            email
              ? `/forgot-password?email=${encodeURIComponent(email)}`
              : '/forgot-password'
          }
          className={cn(buttonVariants({ variant: 'outline' }), 'w-fit')}
        >
          {m['settings.security.set_password']()}
        </Link>
      </CardContent>
    </Card>
  );
}

function SecurityPage() {
  const { data: session } = useSession();

  const accountsQuery = useQuery({
    queryKey: ['user-accounts'],
    queryFn: listAccounts,
  });

  const accounts = accountsQuery.data;
  const hasPassword = !!accounts?.some((a) => a.providerId === 'credential');
  const socialProvider = accounts?.find(
    (a) => a.providerId !== 'credential'
  )?.providerId;
  const providerLabel = socialProvider
    ? socialProvider.charAt(0).toUpperCase() + socialProvider.slice(1)
    : 'email';
  const email = session?.user?.email || '';

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-bold">{m['settings.security.title']()}</h1>
        <p className="text-muted-foreground">
          {m['settings.security.description']()}
        </p>
      </div>

      {accountsQuery.isPending ? (
        <Card>
          <CardHeader>
            <Skeleton className="h-6 w-32" />
          </CardHeader>
          <CardContent className="space-y-6">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </CardContent>
        </Card>
      ) : accountsQuery.isError ? (
        <Card>
          <CardHeader>
            <CardTitle>{m['settings.security.password_card']()}</CardTitle>
          </CardHeader>
          <CardContent className="text-destructive pb-2 text-sm">
            {m['settings.security.load_failed']()}
          </CardContent>
          <CardFooter>
            <Button
              variant="outline"
              onClick={() => accountsQuery.refetch()}
              disabled={accountsQuery.isFetching}
            >
              <RefreshCw className="mr-2 size-4" />
              {m['common.error.retry']()}
            </Button>
          </CardFooter>
        </Card>
      ) : hasPassword ? (
        <ChangePasswordCard />
      ) : (
        <SetPasswordCard provider={providerLabel} email={email} />
      )}

      <p className="text-muted-foreground text-sm">
        {m['settings.security.signed_in_as']({ email })}
      </p>
    </div>
  );
}

export const Route = createFileRoute('/settings/security')({
  component: SecurityPage,
});
