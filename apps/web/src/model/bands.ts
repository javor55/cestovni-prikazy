// Popis časových pásem ze sady pravidel: 300–720 min = „od 5 do 12 h“, 721–1080 = „nad 12 do 18 h“, 1081– = „nad 18 h“.

const hours = (min: number) => `${Math.round((min / 60) * 100) / 100}`.replace('.', ',');
const from = (min: number) => (min % 60 === 1 ? `nad ${hours(min - 1)}` : `od ${hours(min)}`);

export const bandLabel = (minMinutes: number, maxMinutes: number | null) => (maxMinutes === null ? `${from(minMinutes)} h` : `${from(minMinutes)} do ${hours(maxMinutes)} h`);
