import type { StoreCategory } from '@thulir/shared'
import type { PackSource } from '@/components/products/packDesign'

const L = (en: string, ta: string) => ({ en, ta })
const pack = (id: string, en: string, ta: string, brand: string, unit: string, department: PackSource['department'], shape: PackSource['shape'], color: string): PackSource => ({
  id,
  name: L(en, ta),
  brand,
  unit,
  department,
  shape,
  color,
  veg: true,
})

/** Three representative packs per kind of shop, so each card shows what you will find inside. */
export const SHOWCASE: Record<StoreCategory, PackSource[]> = {
  supermarket: [
    pack('a-rice', 'Ponni Rice', 'பொன்னி அரிசி', 'Kaveri', '5 kg', 'pantry', 'pouch', '#f3d9a0'),
    pack('a-oil', 'Groundnut Oil', 'கடலை எண்ணெய்', 'Selvam', '1 L', 'pantry', 'bottle', '#e6a817'),
    pack('a-tea', 'Assam Tea', 'தேநீர்', 'Chai Co', '250 g', 'beverages', 'box', '#b7332b'),
  ],
  provision: [
    pack('b-salt', 'Crystal Salt', 'உப்பு', 'Thulir Pantry', '1 kg', 'pantry', 'pouch', '#e8eef5'),
    pack('b-dal', 'Toor Dal', 'துவரம் பருப்பு', 'Kaveri', '1 kg', 'pantry', 'pouch', '#e9b949'),
    pack('b-spice', 'Chilli Powder', 'மிளகாய்த் தூள்', 'Selvam', '200 g', 'pantry', 'pouch', '#c8372d'),
  ],
  fruit_veg: [
    pack('c-banana', 'Banana', 'வாழைப்பழம்', 'Farm', '1 dozen', 'fresh', 'crate', '#f1cf3b'),
    pack('c-tomato', 'Tomato', 'தக்காளி', 'Farm', '1 kg', 'fresh', 'crate', '#d9402e'),
    pack('c-spinach', 'Spinach', 'கீரை', 'Farm', '1 bunch', 'fresh', 'crate', '#3f8f3a'),
  ],
  bakery: [
    pack('d-bread', 'Milk Bread', 'பால் ரொட்டி', 'Madhuram', '400 g', 'bakery', 'pouch', '#e2b36b'),
    pack('d-cookie', 'Butter Cookies', 'வெண்ணெய் பிஸ்கட்', 'Madhuram', '200 g', 'snacks', 'box', '#d9742a'),
    pack('d-bun', 'Honey Buns', 'தேன் பன்', 'Madhuram', '4 pcs', 'bakery', 'pouch', '#cf8b4a'),
  ],
  dairy: [
    pack('e-milk', 'Fresh Milk', 'பால்', 'Pasumai', '1 L', 'chilled', 'carton', '#3b8fd6'),
    pack('e-curd', 'Set Curd', 'தயிர்', 'Pasumai', '500 g', 'chilled', 'tub', '#f4f1e8'),
    pack('e-butter', 'Salted Butter', 'வெண்ணெய்', 'Pasumai', '100 g', 'chilled', 'bar', '#f2d36b'),
  ],
  household: [
    pack('f-wash', 'Detergent', 'சலவை பவுடர்', 'Illam', '1 kg', 'household', 'box', '#2f7fd0'),
    pack('f-dish', 'Dish Wash', 'பாத்திரம் சோப்', 'Illam', '500 ml', 'household', 'bottle', '#3fae6a'),
    pack('f-floor', 'Floor Cleaner', 'தரை சுத்தம்', 'Illam', '1 L', 'household', 'bottle', '#7a4fd0'),
  ],
}

export const TONES: Record<StoreCategory, [string, string]> = {
  supermarket: ['#3f7a3a', '#1f4a22'],
  provision: ['#d94f2b', '#8f2c12'],
  fruit_veg: ['#7aa83a', '#3f6a1c'],
  bakery: ['#e8842a', '#a8480f'],
  dairy: ['#2fa4c4', '#17586f'],
  household: ['#7a4fd0', '#43267f'],
}

