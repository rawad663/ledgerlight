"use client";

import { Loader2 } from "lucide-react";
import * as React from "react";

import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { useApiClient } from "@/hooks/use-api";

type DeleteProductDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
  product: { id: string; name: string } | null;
};

export function DeleteProductDialog({
  open,
  onOpenChange,
  onSuccess,
  product,
}: DeleteProductDialogProps) {
  const apiClient = useApiClient();
  const [deleting, setDeleting] = React.useState(false);
  const [apiError, setApiError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (open) setApiError(null);
  }, [open]);

  async function handleDelete() {
    if (!product) return;

    setDeleting(true);
    setApiError(null);

    const { error } = await apiClient.DELETE("/products/{id}", {
      params: { path: { id: product.id } },
    });

    setDeleting(false);

    if (error) {
      setApiError((error as Error)?.message ?? "Failed to delete product");
      return;
    }

    onOpenChange(false);
    onSuccess?.();
  }

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Deactivate product?</AlertDialogTitle>
          <AlertDialogDescription>
            This will deactivate{" "}
            <span className="font-medium text-foreground">{product?.name}</span>
            . It will no longer appear in product lists or be available for new
            orders.
          </AlertDialogDescription>
        </AlertDialogHeader>

        {apiError && <p className="text-sm text-destructive">{apiError}</p>}

        <AlertDialogFooter>
          <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
          <Button
            variant="destructive"
            onClick={handleDelete}
            disabled={deleting}
          >
            {deleting && <Loader2 className="mr-1.5 size-4 animate-spin" />}
            Deactivate
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
