'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

export default function LoginPageRedirect() {
  const router = useRouter();
  useEffect(() => {
    router.replace('/auth/login');
  }, [router]);

  return null;
}
