import { Suspense } from "react";

import { LoginPage } from "@/components/login/login-page";

export default function Login() {
  return (
    <Suspense>
      <LoginPage />
    </Suspense>
  );
}
