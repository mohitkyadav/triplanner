// Ready-made packing lists. Adding one skips what the list already holds.
export const PACKING_TEMPLATES = [
  {
    id: 'essentials',
    label: 'Essentials',
    items: ['Passport / ID', 'Wallet & cards', 'Phone & charger', 'Power adapter', 'Medication', 'Toiletries', 'Keys'],
  },
  {
    id: 'beach',
    label: 'Beach',
    items: ['Swimwear', 'Sunscreen', 'Sunglasses', 'Hat', 'Beach towel', 'Sandals', 'After-sun'],
  },
  {
    id: 'cold',
    label: 'Cold weather',
    items: ['Warm jacket', 'Gloves', 'Scarf', 'Beanie', 'Thermal layers', 'Warm socks', 'Lip balm'],
  },
  {
    id: 'business',
    label: 'Business',
    items: ['Laptop & charger', 'Business cards', 'Formal outfit', 'Notebook', 'Presentation adapter'],
  },
  {
    id: 'hiking',
    label: 'Hiking',
    items: ['Hiking boots', 'Rain jacket', 'Water bottle', 'Snacks', 'First-aid kit', 'Headlamp', 'Day pack'],
  },
]

// The texts from `texts` the list does not hold yet, compared without case.
export function missingFrom(list, texts) {
  const have = new Set(list.map(p => p.text.trim().toLowerCase()))
  const out = []
  for (const t of texts) {
    const key = t.trim().toLowerCase()
    if (key && !have.has(key)) {
      have.add(key)
      out.push(t.trim())
    }
  }
  return out
}
