import { Image, Text, View } from '@react-pdf/renderer';
import type { DocModel } from './model.js';

/** Obrázek podpisu a/nebo razítko „Podepsáno“ uvnitř podpisového pole zaměstnance. */
export function SignatureMark({ sig }: { sig: DocModel['signature'] }) {
  if (!sig || (!sig.image && !sig.stamp)) return null;
  const width = Math.min(100, Math.max(30, sig.widthPct));
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
      {sig.image ? <Image src={sig.image} style={{ width: `${sig.stamp ? width * 0.6 : width}%`, maxHeight: 38, objectFit: 'contain' }} /> : <View />}
      {sig.stamp && (
        <View style={{ border: '0.75pt solid #333', borderRadius: 2, paddingVertical: 1.5, paddingHorizontal: 3 }}>
          <Text style={{ fontSize: 6.5, fontWeight: 700 }}>Podepsáno</Text>
          <Text style={{ fontSize: 6 }}>{sig.stamp.name}</Text>
          <Text style={{ fontSize: 6 }}>{sig.stamp.date}</Text>
        </View>
      )}
    </View>
  );
}
