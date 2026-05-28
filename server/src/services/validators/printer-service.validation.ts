import { PrinterTypesEnum } from "@/services/printer-api.interface";
import { RefinementCtx, z } from "zod";

export const printerApiKeyValidator = z.string().optional();
export const printerNameValidator = z.string();
export const printerUsernameValidator = z.string().nullable();
export const printerPasswordValidator = z.string().nullable();
export const printerEnabledValidator = z.boolean();
export const printerDisabledReasonValidator = z.string().nullable();
export const printerUrlValidator = z.string().url();
export const printerTypeValidator = z.nativeEnum(PrinterTypesEnum);
export const printerDateAddedValidator = z.number().optional();

const prusaLinkAuthSchema = z.object({
  username: printerUsernameValidator,
  password: printerPasswordValidator,
});

const basePrinterSchema = z
  .object({
    dateAdded: printerDateAddedValidator,
    printerURL: printerUrlValidator,
    printerType: printerTypeValidator,
    apiKey: printerApiKeyValidator,
    username: printerUsernameValidator.optional(),
    password: printerPasswordValidator.optional(),
    enabled: printerEnabledValidator.optional(),
    name: printerNameValidator,
  })
  .strip();

// Infer base schema required to do superRefine
const apiKeyPrinterTypeSchema = z.object({
  apiKey: printerApiKeyValidator,
  printerType: printerTypeValidator,
  username: printerUsernameValidator.optional(),
  password: printerPasswordValidator.optional(),
});
type ApiKeyPrinterTypeSchema = z.infer<typeof apiKeyPrinterTypeSchema>;

export const refineApiKeyValidator = <T extends ApiKeyPrinterTypeSchema>(data: T, ctx: RefinementCtx) => {
  // PrusaLink requires username/password (HTTP digest auth).
  const result = prusaLinkAuthSchema.safeParse({
    username: data.username,
    password: data.password,
  });
  if (!result.success) {
    result.error.issues.forEach((issue) => {
      ctx.addIssue({
        ...issue,
        path: ["username", ...issue.path],
      });
      ctx.addIssue({
        ...issue,
        path: ["password", ...issue.path],
      });
    });
  }
};

export const createPrinterSchema = basePrinterSchema.superRefine(refineApiKeyValidator);

export const updatePrinterEnabledSchema = z.object({
  enabled: printerEnabledValidator,
});

export const updatePrinterDisabledReasonSchema = z.object({
  disabledReason: printerDisabledReasonValidator,
});
