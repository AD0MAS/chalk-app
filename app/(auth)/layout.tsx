// Login screen: no navbar, one centred card on the paper background.
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return <main className="flex min-h-dvh items-center justify-center px-4 py-12">{children}</main>;
}
