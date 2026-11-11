// CONSTANTS
const kExtendedFileName = /filename\*=UTF-8''([^;\s]+)/i;
const kReservedAttrChars = /['()*]/g;

export class AttachmentDisposition {
  static parse(
    header: string | null
  ): AttachmentDisposition | null {
    const encoded = header?.match(kExtendedFileName)?.[1];
    if (encoded === undefined) {
      return null;
    }

    try {
      return new AttachmentDisposition(decodeURIComponent(encoded));
    }
    catch {
      return null;
    }
  }

  readonly fileName: string;

  constructor(
    fileName: string
  ) {
    this.fileName = fileName;
  }

  toString(): string {
    const encoded = encodeURIComponent(this.fileName).replace(
      kReservedAttrChars,
      (char) => `%${char.charCodeAt(0).toString(16).toUpperCase()}`
    );

    return `attachment; filename*=UTF-8''${encoded}`;
  }
}
