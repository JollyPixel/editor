// Import Third-party Dependencies
import { readDetail, type JollyChangeDetail } from "@jolly-pixel/ui";
import { showChoice } from "@jolly-pixel/ui/elements/dialog";
import "@jolly-pixel/ui/elements/text";

// CONSTANTS
const kFieldsStyle = {
  display: "flex",
  "flex-direction": "column",
  gap: "var(--jolly-row-gap, 4px)",
  "--jolly-label-width": "8ch",
  "--jolly-field-inset-end": "0"
};

export interface NewTag {
  name: string;
  message: string;
}

export async function askNewTag(): Promise<NewTag | null> {
  const tag: NewTag = {
    name: "",
    message: ""
  };
  const fields = document.createElement("div");
  for (const [property, value] of Object.entries(kFieldsStyle)) {
    fields.style.setProperty(property, value);
  }
  fields.append(
    textField("Name", "v1", (value) => {
      tag.name = value;
    }),
    textField("Message", "Optional", (value) => {
      tag.message = value;
    })
  );

  const choice = await showChoice({
    title: "New tag",
    icon: "version-save",
    message: "A tag names the saved content of this asset so you can view " +
      "or restore it later.",
    content: [fields],
    actions: [
      {
        value: "create",
        label: "Create",
        variant: "accent"
      }
    ],
    focus: "create"
  });

  return choice === null ?
    null :
    {
      name: tag.name.trim(),
      message: tag.message.trim()
    };
}

function textField(
  label: string,
  placeholder: string,
  capture: (value: string) => void
): HTMLElement {
  const field = document.createElement("jolly-text");
  field.label = label;
  field.placeholder = placeholder;
  field.value = "";
  field.addEventListener("jolly-input", (event) => {
    const detail = readDetail<JollyChangeDetail<string>>(event);
    if (detail !== null) {
      capture(detail.value);
    }
  });
  field.addEventListener("jolly-change", (event) => {
    const detail = readDetail<JollyChangeDetail<string>>(event);
    if (detail !== null) {
      capture(detail.value);
      field.value = detail.value;
    }
  });

  return field;
}
