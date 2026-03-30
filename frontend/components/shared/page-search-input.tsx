"use client";

import { Search } from "lucide-react";

import { Input } from "@/components/ui/input";

type PageSearchInputProps = {
  value: string;
  onChange: (nextValue: string) => void;
  placeholder: string;
};

export function PageSearchInput({
  value,
  onChange,
  placeholder,
}: PageSearchInputProps) {
  return (
    <div className="relative flex-1 min-w-[240px] max-w-sm">
      <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
      <Input
        placeholder={placeholder}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="pl-9"
      />
    </div>
  );
}
