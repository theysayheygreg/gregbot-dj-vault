import type { VendorSurface } from './types.js';

export const corpusVendors: VendorSurface[] = [
  {
    slug: 'pioneer-alphatheta',
    name: 'Pioneer DJ / AlphaTheta',
    scope: 'CDJ, XDJ, DJM, firmware archives, release notes, rekordbox interaction, and USB behavior.',
    artifactTypes: ['firmware', 'release-notes', 'manuals', 'usb-export-notes'],
  },
  {
    slug: 'native-instruments',
    name: 'Native Instruments / Traktor',
    scope: 'Traktor software versions, hardware firmware, metadata behavior, and collection formats.',
    artifactTypes: ['desktop-apps', 'firmware', 'collection-analysis', 'release-notes'],
  },
  {
    slug: 'serato',
    name: 'Serato',
    scope: 'Serato DJ Pro/Lite software, hardware mappings, crate behavior, and metadata interoperability.',
    artifactTypes: ['desktop-apps', 'release-notes', 'hardware-notes'],
  },
  {
    slug: 'denon-engine',
    name: 'Denon DJ / Engine DJ',
    scope: 'Firmware, Engine DJ software, device-library behavior, and cross-ecosystem intersections.',
    artifactTypes: ['firmware', 'desktop-apps', 'release-notes', 'media-layout-notes'],
  },
];
