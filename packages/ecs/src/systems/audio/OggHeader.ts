interface OggCodec {
  readonly identification: Uint8Array;
  readonly comment: Uint8Array;
  readonly headerPackets: number;
}

interface OggPage {
  readonly offset: number;
  readonly end: number;
  readonly serial: number;
  readonly lacing: Uint8Array;
  readonly dataOffset: number;
}

interface PacketSegment {
  readonly packet: number;
  readonly offset: number;
  readonly size: number;
}

interface OggHeaderLayout {
  readonly bytes: Uint8Array;
  readonly codec: OggCodec;
  readonly packets: readonly Uint8Array[];
  readonly firstPage: OggPage;
  readonly pageCount: number;
  readonly end: number;
}

interface CommentPacket {
  readonly vendor: Uint8Array;
  readonly comments: readonly string[];
  readonly trailer: Uint8Array;
}

// CONSTANTS
const kEncoder = new TextEncoder();
const kDecoder = new TextDecoder();
const kCapturePattern = kEncoder.encode("OggS");
const kPageHeaderBytes = 27;
const kMaxSegments = 255;
const kContinuedPacket = 0x01;
const kUnknownGranule = 0xff;
const kCodecs: readonly OggCodec[] = [
  {
    identification: kEncoder.encode("OpusHead"),
    comment: kEncoder.encode("OpusTags"),
    headerPackets: 2
  },
  {
    identification: kEncoder.encode("\x01vorbis"),
    comment: kEncoder.encode("\x03vorbis"),
    headerPackets: 3
  }
];
const kCrcTable = createCrcTable();

export class OggHeader {
  readonly comments: readonly string[];

  #layout: OggHeaderLayout;
  #comment: CommentPacket;

  static parse(
    bytes: Uint8Array
  ): OggHeader | null {
    const layout = readLayout(bytes);
    const comment = layout === null ?
      null :
      parseCommentPacket(layout.packets[1], layout.codec);

    return layout === null || comment === null ?
      null :
      new OggHeader(layout, comment);
  }

  private constructor(
    layout: OggHeaderLayout,
    comment: CommentPacket
  ) {
    this.#layout = layout;
    this.#comment = comment;
    this.comments = comment.comments;
  }

  comment(
    name: string
  ): string | undefined {
    const entry = this.comments.findLast(
      (comment) => commentName(comment) === name.toUpperCase()
    );

    return entry?.slice(entry.indexOf("=") + 1);
  }

  withComment(
    name: string,
    value: string
  ): Uint8Array {
    const { bytes, codec, packets, firstPage, pageCount, end } = this.#layout;
    const comments = this.comments
      .filter((comment) => commentName(comment) !== name.toUpperCase())
      .concat(`${name}=${value}`);
    const headerPages = encodePages([
      encodeCommentPacket(codec, {
        ...this.#comment,
        comments
      }),
      ...packets.slice(2)
    ], firstPage.serial);
    const rest = renumberPages(
      bytes.subarray(end),
      firstPage.serial,
      headerPages.length - (pageCount - 1)
    );

    return concat([
      bytes.subarray(firstPage.offset, firstPage.end),
      ...headerPages,
      rest
    ]);
  }
}

function readLayout(
  bytes: Uint8Array
): OggHeaderLayout | null {
  const packets: Uint8Array[] = [];
  let chunks: Uint8Array[] = [];
  let firstPage: OggPage | null = null;
  let codec: OggCodec | null = null;

  for (let offset = 0, pageCount = 1; ; pageCount++) {
    const page = readPage(bytes, offset);
    if (page === null) {
      return null;
    }
    firstPage ??= page;

    let dataOffset = page.dataOffset;
    for (const size of page.lacing) {
      chunks.push(bytes.subarray(dataOffset, dataOffset + size));
      dataOffset += size;
      if (size < 255) {
        packets.push(concat(chunks));
        chunks = [];
      }
    }

    if (codec === null && packets.length > 0) {
      codec = kCodecs.find(
        (candidate) => startsWith(packets[0], candidate.identification)
      ) ?? null;
      if (codec === null) {
        return null;
      }
    }
    if (codec !== null && packets.length >= codec.headerPackets) {
      return packets.length > codec.headerPackets || chunks.length > 0 ?
        null :
        {
          bytes,
          codec,
          packets,
          firstPage,
          pageCount,
          end: page.end
        };
    }
    offset = page.end;
  }
}

function readPage(
  bytes: Uint8Array,
  offset: number
): OggPage | null {
  if (
    offset + kPageHeaderBytes > bytes.byteLength ||
    !startsWith(bytes.subarray(offset), kCapturePattern)
  ) {
    return null;
  }

  const segments = bytes[offset + kPageHeaderBytes - 1];
  const dataOffset = offset + kPageHeaderBytes + segments;
  const lacing = bytes.subarray(offset + kPageHeaderBytes, dataOffset);
  const end = dataOffset + lacing.reduce((sum, size) => sum + size, 0);
  if (end > bytes.byteLength) {
    return null;
  }

  return {
    offset,
    end,
    serial: dataView(bytes).getUint32(offset + 14, true),
    lacing,
    dataOffset
  };
}

function parseCommentPacket(
  packet: Uint8Array,
  codec: OggCodec
): CommentPacket | null {
  if (!startsWith(packet, codec.comment)) {
    return null;
  }

  const view = dataView(packet);
  let offset = codec.comment.byteLength;
  function take(
    length: number | null
  ): Uint8Array | null {
    if (length === null || offset + length > packet.byteLength) {
      return null;
    }
    const taken = packet.subarray(offset, offset + length);
    offset += length;

    return taken;
  }
  function u32(): number | null {
    const bytes = take(4);

    return bytes === null ? null : view.getUint32(offset - 4, true);
  }

  const vendor = take(u32());
  const count = u32();
  if (vendor === null || count === null) {
    return null;
  }

  const comments: string[] = [];
  for (let index = 0; index < count; index++) {
    const comment = take(u32());
    if (comment === null) {
      return null;
    }
    comments.push(kDecoder.decode(comment));
  }

  return {
    vendor,
    comments,
    trailer: packet.subarray(offset)
  };
}

function commentName(
  comment: string
): string {
  const separator = comment.indexOf("=");

  return separator > 0 ? comment.slice(0, separator).toUpperCase() : "";
}

function encodeCommentPacket(
  codec: OggCodec,
  comment: CommentPacket
): Uint8Array {
  const encoded = comment.comments.map((entry) => kEncoder.encode(entry));

  return concat([
    codec.comment,
    u32(comment.vendor.byteLength),
    comment.vendor,
    u32(encoded.length),
    ...encoded.flatMap((entry) => [u32(entry.byteLength), entry]),
    comment.trailer
  ]);
}

function encodePages(
  packets: readonly Uint8Array[],
  serial: number
): Uint8Array[] {
  const segments: PacketSegment[] = [];
  for (const [packet, bytes] of packets.entries()) {
    for (let offset = 0; ; offset += 255) {
      const size = Math.min(bytes.byteLength - offset, 255);
      segments.push({
        packet,
        offset,
        size
      });
      if (size < 255) {
        break;
      }
    }
  }

  const pages: Uint8Array[] = [];
  for (let start = 0; start < segments.length; start += kMaxSegments) {
    const slice = segments.slice(start, start + kMaxSegments);
    const header = new Uint8Array(kPageHeaderBytes + slice.length);
    const view = dataView(header);
    header.set(kCapturePattern);
    header[5] = start > 0 && segments[start - 1].size === 255 ?
      kContinuedPacket :
      0;
    if (slice.every((segment) => segment.size === 255)) {
      header.fill(kUnknownGranule, 6, 14);
    }
    view.setUint32(14, serial, true);
    view.setUint32(18, pages.length + 1, true);
    header[26] = slice.length;
    header.set(slice.map((segment) => segment.size), kPageHeaderBytes);

    const page = concat([
      header,
      ...slice.map((segment) => packets[segment.packet]
        .subarray(segment.offset, segment.offset + segment.size))
    ]);
    writeCrc(page);
    pages.push(page);
  }

  return pages;
}

function renumberPages(
  rest: Uint8Array,
  serial: number,
  shift: number
): Uint8Array {
  if (shift === 0) {
    return rest;
  }

  const copy = rest.slice();
  const view = dataView(copy);
  for (
    let page = readPage(copy, 0);
    page !== null;
    page = readPage(copy, page.end)
  ) {
    if (page.serial === serial) {
      const sequence = view.getUint32(page.offset + 18, true);
      view.setUint32(page.offset + 18, sequence + shift, true);
      writeCrc(copy.subarray(page.offset, page.end));
    }
  }

  return copy;
}

function writeCrc(
  page: Uint8Array
): void {
  const view = dataView(page);
  view.setUint32(22, 0, true);
  let crc = 0;
  for (const byte of page) {
    crc = ((crc << 8) ^ kCrcTable[((crc >>> 24) ^ byte) & 0xff]) >>> 0;
  }
  view.setUint32(22, crc, true);
}

function createCrcTable(): Uint32Array {
  const table = new Uint32Array(256);
  for (let index = 0; index < 256; index++) {
    let value = index << 24;
    for (let bit = 0; bit < 8; bit++) {
      value = (value & 0x80000000) === 0 ?
        value << 1 :
        (value << 1) ^ 0x04c11db7;
    }
    table[index] = value >>> 0;
  }

  return table;
}

function dataView(
  bytes: Uint8Array
): DataView {
  return new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
}

function u32(
  value: number
): Uint8Array {
  const bytes = new Uint8Array(4);
  dataView(bytes).setUint32(0, value, true);

  return bytes;
}

function startsWith(
  bytes: Uint8Array,
  prefix: Uint8Array
): boolean {
  return bytes.byteLength >= prefix.byteLength &&
    prefix.every((byte, index) => bytes[index] === byte);
}

function concat(
  parts: readonly Uint8Array[]
): Uint8Array {
  if (parts.length === 1) {
    return parts[0];
  }

  const bytes = new Uint8Array(
    parts.reduce((sum, part) => sum + part.byteLength, 0)
  );
  let offset = 0;
  for (const part of parts) {
    bytes.set(part, offset);
    offset += part.byteLength;
  }

  return bytes;
}
