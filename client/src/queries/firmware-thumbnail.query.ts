import { useQuery } from "@tanstack/vue-query";
import { PrinterRemoteFileService } from "@/backend";
import { ComputedRef, Ref, computed } from "vue";

export const firmwareThumbnailQueryKey = "firmware-thumbnail";

/**
 * Cached fetch of the firmware-side thumbnail (PrusaLink and other
 * adapters that expose `/printer-files/:id/firmware-thumbnail/:path`).
 * Used as the thumbnail source for USB-only jobs that have no
 * fileStorageId — i.e. the file lives on the printer, not on the
 * server.
 */
export const useFirmwareThumbnailQuery = (
  printerId: ComputedRef<number | null | undefined> | Ref<number | null | undefined>,
  path: ComputedRef<string | null | undefined> | Ref<string | null | undefined>,
  variant: "small" | "big" = "big",
  enabled?: boolean,
) => {
  return useQuery({
    queryKey: computed(() => [firmwareThumbnailQueryKey, printerId.value, path.value, variant]),
    queryFn: async () => {
      if (!printerId.value || !path.value) return null;
      return await PrinterRemoteFileService.getFirmwareThumbnail(
        printerId.value,
        path.value,
        variant,
      );
    },
    enabled: computed(
      () => !!printerId.value && !!path.value && enabled !== false,
    ),
    // Thumbnails on the printer don't change; cache aggressively.
    staleTime: 1000 * 60 * 60,
    retry: false,
  });
};
