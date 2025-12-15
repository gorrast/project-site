import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Blue Bay Cup',
  icons: {
    icon: '/favicon.ico',
  },
};

export default function BlueBayCupLayout({ 
    children,
 }: Readonly<{
    children: React.ReactNode; 
}>) {
  return <>{children}</>;
}