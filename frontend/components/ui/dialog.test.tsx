import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

describe("DialogContent", () => {
  it("uses viewport-bounded scrolling by default", () => {
    render(
      <Dialog open>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Default dialog</DialogTitle>
            <DialogDescription>Scrollable dialog body</DialogDescription>
          </DialogHeader>
        </DialogContent>
      </Dialog>,
    );

    const dialog = screen.getByRole("dialog");

    expect(dialog).toHaveClass("max-h-[calc(100vh-2rem)]");
    expect(dialog).toHaveClass("overflow-y-auto");
  });

  it("preserves caller overflow overrides", () => {
    render(
      <Dialog open>
        <DialogContent className="max-h-32 overflow-hidden p-0">
          <DialogHeader>
            <DialogTitle>Overridden dialog</DialogTitle>
            <DialogDescription>Custom overflow behavior</DialogDescription>
          </DialogHeader>
        </DialogContent>
      </Dialog>,
    );

    const dialog = screen.getByRole("dialog");

    expect(dialog).toHaveClass("max-h-32");
    expect(dialog).toHaveClass("overflow-hidden");
    expect(dialog).not.toHaveClass("max-h-[calc(100vh-2rem)]");
    expect(dialog).not.toHaveClass("overflow-y-auto");
  });
});
