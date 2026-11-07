import type { ImageSourcePropType } from 'react-native';

// Bundled cover photos (from vedabase.io's library page, 256px wide) so they
// show offline. Books without an entry — vanisource-only works, lectures,
// letters, conversations — fall back to a drawn cover in BookCover.
export const BOOK_COVERS: Record<string, ImageSourcePropType> = {
  bg: require('../../assets/covers/bg.jpg'),
  sb: require('../../assets/covers/sb.jpg'),
  cc: require('../../assets/covers/cc.jpg'),
  noi: require('../../assets/covers/noi.jpg'),
  nod: require('../../assets/covers/nod.jpg'),
  iso: require('../../assets/covers/iso.jpg'),
  kb: require('../../assets/covers/kb.jpg'),
  ssr: require('../../assets/covers/ssr.jpg'),
  tlc: require('../../assets/covers/tlc.jpg'),
  bbd: require('../../assets/covers/bbd.jpg'),
  rv: require('../../assets/covers/rv.jpg'),
  pqpa: require('../../assets/covers/pqpa.jpg'),
  tlk: require('../../assets/covers/tlk.jpg'),
  tqk: require('../../assets/covers/tqk.jpg'),
  lob: require('../../assets/covers/lob.jpg'),
  spl: require('../../assets/covers/spl.jpg'),
  rkd: require('../../assets/covers/rkd.jpg'),
  bs: require('../../assets/covers/bs.jpg'),
  cat: require('../../assets/covers/cat.jpg'),
  josd: require('../../assets/covers/josd.jpg'),
  otk: require('../../assets/covers/otk.jpg'),
  pop: require('../../assets/covers/pop.jpg'),
  poy: require('../../assets/covers/poy.jpg'),
  asc: require('../../assets/covers/asc.jpg'),
};
