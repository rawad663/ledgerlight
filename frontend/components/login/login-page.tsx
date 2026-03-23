"use client";

import * as z from "zod";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useState } from "react";
import { Button } from "../ui/button";
import { useMutation } from "@/hooks/use-api";
import { useToast } from "@/hooks/use-toast";

const LoginInput = z.object({
  email: z.string().trim().email(),
  password: z.string().trim(),
});

type LoginInputType = {
  email: string;
  password: string;
};
type LoginInputErrors = {
  email: string | null;
  password: string | null;
};

export function LoginPage() {
  const [formData, setFormData] = useState<LoginInputType>({
    email: "",
    password: "",
  });
  const [formErrors, setFormErrors] = useState<LoginInputErrors>({
    email: null,
    password: null,
  });

  const { mutate, loading, error } = useMutation();
  const { toast } = useToast();

  async function onSubmit() {
    try {
      const data = LoginInput.parse(formData);

      const res = await mutate((api) =>
        api.POST("/auth/login", { body: data }),
      );
    } catch (e) {
      if (e instanceof z.ZodError) {
        // handle error
      }
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center">
      <Card className="w-1/2 p-8">
        <h1 className="text-center">Login to Ledger Light</h1>

        <Input
          type="text"
          placeholder="Email"
          value={formData.email}
          onChange={(e) =>
            setFormData({ ...formData, email: e.currentTarget.value })
          }
        />
        <Input
          type="password"
          placeholder="Password"
          value={formData.password}
          onChange={(e) =>
            setFormData({ ...formData, password: e.currentTarget.value })
          }
        />
        <Button disabled={loading} onClick={onSubmit}>
          Login
        </Button>
      </Card>
    </div>
  );
}
