<template>
  <BaseDialog
    :id="dialog.dialogId"
    :max-width="showChecksPanel ? '900px' : '800px'"
    @escape="closeDialog()"
    @opened="onDialogOpened()"
  >
    <v-card class="pa-6">
      <v-card-title class="pb-4">
        <div class="d-flex align-center">
          <v-avatar
            color="grey-darken-2"
            size="48"
            class="mr-4"
          >
            <span class="text-h6">{{ avatarInitials }}</span>
          </v-avatar>
          <span class="text-h5">{{ dialogTitle }}</span>
        </div>
      </v-card-title>

      <v-divider class="mb-6"/>

      <v-card-text>
        <v-row>
          <v-col :cols="showChecksPanel ? 8 : 12">
            <v-row v-if="formData">
              <v-col>
                <v-text-field
                  v-model="formData.name"
                  :counter="printerNameRules.max"
                  autofocus
                  class="ma-1"
                  label="Printer name*"
                  required
                />
              </v-col>
              <v-col>
                <v-checkbox
                  v-model="formData.enabled"
                  hint="Disabling makes the printer passive"
                  label="Enabled*"
                  persistent-hint
                  required
                />
              </v-col>
            </v-row>

            <v-text-field
              v-model="formData.printerURL"
              class="ma-1"
              hint="F.e. 'prusalink.local' or 'https://my.printer.com'"
              label="Printer URL*"
            />

            <v-text-field
              v-model="formData.username"
              class="ma-1"
              hint="Username (often 'maker')"
              label="Username"
              persistent-hint
              required
            />

            <v-text-field
              v-model="formData.password"
              class="ma-1"
              hint="Password (visit your printer settings)"
              label="Password"
              persistent-hint
              required
            />
          </v-col>

          <PrinterChecksPanel
            v-if="showChecksPanel"
            :cols="4"
          >
            <v-btn @click="showChecksPanel = false"> Hide checks</v-btn>
          </PrinterChecksPanel>
        </v-row>
        <v-alert
          v-if="printerValidationError?.length"
          class="my-3"
          type="error"
          variant="tonal"
        >
          <div class="d-flex flex-column">
            <strong>Connection Error</strong>
            <span class="mt-2">{{ printerValidationError }}</span>
            <v-checkbox
              v-model="forceSavePrinter"
              color="warning"
              label="Force save"
              class="mt-2"
            />
          </div>
        </v-alert>
        <v-alert
          v-if="validatingPrinter"
          class="my-3"
          type="info"
          variant="tonal"
        >
          <div class="d-flex align-center">
            <v-progress-circular
              indeterminate
              size="20"
              class="mr-3"
            />
            <span>Validating printer connection...</span>
          </div>
        </v-alert>
        <v-alert
          v-if="duplicatingPrinter"
          class="my-3"
          color="info"
        >
          Duplicating printer...
          <v-progress-circular
            class="ml-2"
            indeterminate
            size="20"
          />
        </v-alert>
      </v-card-text>
      <v-card-actions>
        <em class="text-red"> * indicates required field </em>
        <v-spacer/>
        <v-btn
          variant="text"
          @click="closeDialog()"
        >
          Close
        </v-btn>
        <v-btn
          v-if="isUpdating"
          :disabled="!isValid() || duplicatingPrinter"
          :loading="duplicatingPrinter"
          color="gray"
          variant="text"
          @click="duplicatePrinter()"
        >
          Duplicate
        </v-btn>
        <v-btn
          :disabled="!isValid()"
          color="warning"
          variant="text"
          @click="testPrinter()"
        >
          Test connection
        </v-btn>

        <v-btn
          :disabled="!isValid()"
          color="blue-darken-1"
          variant="text"
          @click="submit()"
        >
          {{ submitButtonText }}
        </v-btn>
      </v-card-actions>
    </v-card>
  </BaseDialog>
</template>

<script lang="ts" setup>
import { ref, computed } from "vue";
import { generateInitials } from "@/shared/noun-adjectives.data";
import { usePrinterStore } from "@/store/printer.store";
import { PrintersService } from "@/backend";
import { DialogName } from "@/components/Generic/Dialogs/dialog.constants";
import { useTestPrinterStore } from "@/store/test-printer.store";
import { CreatePrinter, getDefaultCreatePrinter } from "@/models/printers/create-printer.model";
import { useDialog } from "@/shared/dialog.composable";
import { appConstants } from "@/shared/app.constants";
import { useSnackbar } from "@/shared/snackbar.composable";
import { AxiosError } from "axios";
import { useFeatureStore } from "@/store/features.store";
import { PrusaLinkType } from "@/shared/printer-types.constants";
import PrinterChecksPanel from "@/components/Generic/Dialogs/PrinterChecksPanel.vue";
import { useFloorStore } from "@/store/floor.store";
import { captureException } from "@sentry/vue";

const dialog = useDialog(DialogName.AddOrUpdatePrinterDialog);
const printersStore = usePrinterStore();
const testPrinterStore = useTestPrinterStore();
const featureStore = useFeatureStore();
const floorStore = useFloorStore();
const snackbar = useSnackbar();

const printerValidationError = ref<null | string>(null);
const validatingPrinter = ref(false);
const forceSavePrinter = ref(false);
const showChecksPanel = ref(false);
const copyPasteConnectionString = ref("");
const formData = ref(getDefaultCreatePrinter());
const duplicatingPrinter = ref(false);
const isDuplicating = ref(false);
const duplicatedFromName = ref<string | null>(null);

const printerId = computed(() => {
  return dialog.context()?.id;
});

async function onDialogOpened() {
  await featureStore.loadFeatures();

  // Reset duplication state when dialog opens
  isDuplicating.value = false;
  duplicatedFromName.value = null;

  if (!printerId.value) {
    formData.value = getDefaultCreatePrinter();
    formData.value.printerType = PrusaLinkType;
    return;
  }
  const printer = printersStore.printer(printerId.value) as CreatePrinter;
  if (printer) {
    formData.value = PrintersService.convertPrinterToCreateForm(printer);
  }
}

const isUpdating = computed(() => {
  return !!printerId.value && !isDuplicating.value;
});

const dialogTitle = computed(() => {
  if (isDuplicating.value && duplicatedFromName.value) {
    return `Duplicating from "${ duplicatedFromName.value }"`
  }

  if (isUpdating.value) {
    return 'Updating Printer'
  }

  const ctx = dialog.context()
  if (ctx?.floorId) {
    const floor = floorStore.floors.find(f => f.id === ctx.floorId)
    if (floor) {
      return `Add Printer to ${ floor.name }`
    }
  }

  return 'New Printer'
});

const submitButtonText = computed(() => {
  return (forceSavePrinter.value ? "Force " : "") + (isUpdating.value ? "Save" : "Create");
});

const avatarInitials = computed(() => {
  if (formData) {
    return generateInitials(formData.value?.name);
  }
  return "?";
});

const printerNameRules = computed(() => {
  return { required: true, max: appConstants.maxPrinterNameLength };
});

function resetForm() {
  formData.value = getDefaultCreatePrinter();
}

function openTestPanel() {
  showChecksPanel.value = true;
}

async function testPrinter() {
  if (!isValid()) return;

  testPrinterStore.clearEvents();
  openTestPanel();

  const { correlationToken } = await testPrinterStore.createTestPrinter(
    formData.value as CreatePrinter,
  );
  testPrinterStore.currentCorrelationToken = correlationToken;
}

const isValid = () => {
  const form = formData.value;
  if (!form) return false;
  return form.printerURL?.length && form.name?.length && form.username?.length && form.password?.length;
};

async function createPrinter(newPrinterData: CreatePrinter) {
  const printer = await printersStore.createPrinter(newPrinterData, forceSavePrinter.value);
  snackbar.openInfoMessage({
    title: `Printer ${ newPrinterData.name } created`,
  });
  return printer;
}

async function updatePrinter(updatedPrinter: CreatePrinter) {
  const printerId = updatedPrinter.id;

  const printer = await printersStore.updatePrinter(
    {
      printerId: printerId!,
      updatedPrinter,
    },
    forceSavePrinter.value,
  );

  snackbar.openInfoMessage({
    title: `Printer ${ updatedPrinter.name } updated`,
  });

  return printer;
}

async function submit() {
  if (!isValid()) return;

  printerValidationError.value = null;
  validatingPrinter.value = true;

  if (
    formData.value.printerURL?.length &&
    !formData.value.printerURL?.startsWith("http://") &&
    !formData.value.printerURL?.startsWith("https://")
  ) {
    formData.value.printerURL = "https://" + formData.value.printerURL;
  }

  const createdPrinter = formData.value as CreatePrinter;
  createdPrinter.printerType = PrusaLinkType;
  createdPrinter.apiKey = "";

  try {
    if (isUpdating.value) {
      await updatePrinter(createdPrinter);
    } else {
      const printer = await createPrinter(createdPrinter);

      try {
        const dialogContext = dialog.context();
        if (
          dialogContext?.floorId &&
          typeof dialogContext.floorX === 'number' &&
          typeof dialogContext.floorY === 'number' &&
          dialogContext.floorX >= 0 &&
          dialogContext.floorY >= 0
        ) {
          await useFloorStore().addPrinterToFloor({
            floorId: dialogContext.floorId,
            printerId: printer.id,
            y: dialogContext.floorY,
            x: dialogContext.floorX,
          });
        }
      } catch (e) {
        console.warn("Attempt to add printer to floor failed", e);
        captureException(e);
      }
    }

    closeDialog();
  } catch (error) {
    if (error instanceof AxiosError) {
      printerValidationError.value =
        error.response?.data?.error || error.message;
      snackbar.error("Validation Failed", (error as Error).message);
    } else {
      printerValidationError.value = (error as Error).message;
      snackbar.error("Error", (error as Error).message);
    }
  } finally {
    validatingPrinter.value = false;
    forceSavePrinter.value = false;
  }
}

function duplicatePrinter() {
  if (!isValid()) return;

  duplicatingPrinter.value = true;
  printerValidationError.value = null;
  forceSavePrinter.value = false;

  duplicatedFromName.value = formData.value.name || null;
  formData.value.name = "";
  delete formData.value.id;
  isDuplicating.value = true;
  duplicatingPrinter.value = false;
}

function closeDialog() {
  dialog.closeDialog();
  forceSavePrinter.value = false;
  printerValidationError.value = null;
  showChecksPanel.value = false;
  duplicatingPrinter.value = false;
  isDuplicating.value = false;
  duplicatedFromName.value = null;
  testPrinterStore.clearEvents();
  resetForm();
  copyPasteConnectionString.value = "";
}
</script>
