import { addDays, istDate } from './dates.ts'
import { rupeesToPaise } from './money.ts'
import type { Batch, Department, PackShape, Product } from './types.ts'

/**
 * DEMO CATALOG. Brand names and prices are illustrative samples for a prototype; no affiliation with any brand is
 * implied, and none of this is real stock. Batch expiry dates are written as day offsets from "today" so the demo
 * always shows a live mix of fresh, near-expiry, expiring-today, expired and invalid stock.
 *
 * Batch spec: [qty, expiryOffsetDays | null | 'bad'].  null = no date entered, 'bad' = an unparseable date.
 */
type BSpec = [qty: number, expiry: number | null | 'bad']
type Opts = Partial<
  Pick<Product, 'veg' | 'isNew' | 'available' | 'flaggedForRemoval' | 'requiresExpiry' | 'policyOverride'>
> & { aliases?: string[]; desc?: string }

interface Row {
  p: Product
  b: BSpec[]
}

const PALETTE = ['#c98255', '#77856b', '#a8b89a', '#b6513a', '#d9b44a', '#4a504b', '#8a6a4d', '#6f8f86', '#9a5c3c']
function colorFor(brand: string): string {
  let h = 0
  for (const ch of brand) h = (h * 31 + ch.charCodeAt(0)) >>> 0
  return PALETTE[h % PALETTE.length]
}

const DESC: Record<Department, string> = {
  fresh: 'Sorted fresh for the day. Wash before use.',
  pantry: 'Everyday kitchen staple. Store in a cool, dry place.',
  chilled: 'Keep refrigerated. Use by the best-before date.',
  household: 'For everyday cleaning and home care.',
  personal_care: 'Personal care essential. Check the pack for usage directions.',
  snacks: 'Ready-to-eat snack. Reseal the pack after opening.',
  beverages: 'Ready-to-drink or ready-to-brew. Serve as directed.',
  bakery: 'Baked fresh. Best enjoyed within the best-before date.',
}

const rows: Row[] = []
const seq: Record<string, number> = {}

function add(
  store: string,
  prefix: string,
  dept: Department,
  en: string,
  ta: string,
  brand: string,
  unit: string,
  price: number,
  mrp: number,
  shape: PackShape,
  tags: string,
  batches: BSpec[],
  o: Opts = {},
) {
  seq[prefix] = (seq[prefix] ?? 0) + 1
  const id = `${prefix}-${String(seq[prefix]).padStart(2, '0')}`
  const tagList = tags ? tags.split(',') : []
  rows.push({
    b: batches,
    p: {
      id,
      storeId: store,
      department: dept,
      name: { en, ta },
      brand,
      unit,
      pricePaise: rupeesToPaise(price),
      mrpPaise: rupeesToPaise(mrp),
      description: o.desc ?? DESC[dept],
      shape,
      color: colorFor(brand),
      tags: tagList,
      aliases: o.aliases ?? [],
      veg: o.veg ?? true,
      requiresExpiry: o.requiresExpiry ?? true,
      available: o.available ?? true,
      flaggedForRemoval: o.flaggedForRemoval ?? false,
      isNew: o.isNew,
      policyOverride: o.policyOverride,
    },
  })
}

/* ------------------------------------------------------------------ Marutham Super Mart */
const MM = 'store-marutham'
const mm = (...a: [Department, string, string, string, string, number, number, PackShape, string, BSpec[], Opts?]) =>
  add(MM, 'mm', ...a)
mm('pantry', 'Whole Wheat Atta', 'கோதுமை மாவு', 'Aashirvaad', '5 kg', 265, 295, 'pouch', 'staple,atta,quick', [[60, 150]], { aliases: ['godhumai', 'wheat flour'] })
mm('pantry', 'Sona Masoori Rice', 'சோனா மசூரி அரிசி', 'Kaveri', '5 kg', 335, 360, 'pouch', 'staple,rice', [[35, 200]], { aliases: ['arisi'] })
mm('pantry', 'Toor Dal', 'துவரம் பருப்பு', 'Tata Sampann', '1 kg', 168, 185, 'pouch', 'staple,toordal,dal', [[28, 120], [20, 260]], { aliases: ['paruppu', 'thuvaram paruppu'] })
mm('pantry', 'Iodised Salt', 'உப்பு', 'Tata Salt', '1 kg', 28, 30, 'pouch', 'staple,salt', [[100, 400]], { aliases: ['uppu'] })
mm('pantry', 'Sunflower Oil', 'சூரியகாந்தி எண்ணெய்', 'Fortune', '1 litre', 138, 155, 'bottle', 'staple,oil', [[50, 160]], { aliases: ['ennai'] })
mm('pantry', 'Filter Coffee Powder', 'ஃபில்டர் காபி தூள்', 'Madras Gold', '250 g', 190, 210, 'jar', 'staple,coffee', [[18, 90]], { aliases: ['kaapi'] })
mm('pantry', 'Sugar', 'சர்க்கரை', 'Dhampur', '1 kg', 47, 50, 'pouch', 'staple', [[70, 300]], { aliases: ['sakkarai'] })
mm('pantry', 'Sambar Powder', 'சாம்பார் பொடி', 'MTR', '200 g', 82, 90, 'box', 'sambarpowder,spice', [[24, 210]])
mm('pantry', 'Masala Noodles 4-pack', 'மசாலா நூடுல்ஸ்', 'Maggi', '280 g', 56, 60, 'pouch', 'quick,snack', [[60, 120]], { isNew: false })
mm('snacks', 'Cashew Cookies', 'முந்திரி பிஸ்கட்', 'Britannia Good Day', '200 g', 40, 45, 'box', 'snack,quick', [[45, 75]])
mm('snacks', 'Glucose Biscuits', 'குளுக்கோஸ் பிஸ்கட்', 'Parle-G', '800 g', 80, 85, 'pouch', 'snack,quick', [[30, 60]])
mm('snacks', 'Classic Salted Chips', 'உப்பு சிப்ஸ்', "Lay's", '52 g', 20, 20, 'pouch', 'snack', [[3, 45]])
mm('snacks', 'Aloo Bhujia', 'ஆலு புஜியா', "Haldiram's", '200 g', 62, 70, 'pouch', 'snack', [[22, 4]])
mm('snacks', 'Spicy Murukku', 'காரம் முறுக்கு', 'Kovai Snacks', '200 g', 55, 60, 'pouch', 'snack', [[18, 60]], { flaggedForRemoval: true })
mm('beverages', 'Tea Gold', 'தேயிலை தூள்', 'Tata Tea', '250 g', 140, 150, 'box', 'staple,tea', [[26, 240]], { aliases: ['chai', 'tea powder'] })
mm('beverages', 'Mixed Fruit Juice', 'கலவை பழச்சாறு', 'Real', '1 litre', 110, 120, 'carton', 'drink', [[14, 50], [10, -2]])
mm('beverages', 'Packaged Drinking Water', 'குடிநீர்', 'Bisleri', '1 litre', 20, 20, 'bottle', 'drink,quick', [[200, 300]])
mm('beverages', 'Tender Coconut Water', 'இளநீர்', 'Kovai Fresh', '200 ml', 40, 45, 'carton', 'drink', [[12, 0]], { aliases: ['ilaneer'] })
mm('beverages', 'Cold Coffee Can', 'குளிர் காபி', 'Kovai Fresh', '180 ml', 55, 60, 'carton', 'drink', [[20, 100]], { available: false })
mm('chilled', 'Table Butter', 'வெண்ணெய்', 'Amul', '100 g', 58, 60, 'bar', 'dairy,quick', [[40, 45]], { aliases: ['vennai'] })
mm('chilled', 'Cheese Slices', 'சீஸ் துண்டுகள்', 'Amul', '200 g', 135, 140, 'box', 'dairy', [[16, 30]])
mm('chilled', 'Idli Dosa Batter', 'இட்லி தோசை மாவு', 'Kovai Batter Co.', '1 kg', 75, 80, 'tub', 'idlibatter,quick', [[0, 3]], { aliases: ['maavu'] })
mm('household', 'Quick Wash Detergent Powder', 'சலவைத் தூள்', 'Surf Excel', '1 kg', 130, 145, 'pouch', 'refill,cleaning', [[34, null]], { requiresExpiry: false, aliases: ['soap powder'] })
mm('household', 'Dishwash Gel', 'பாத்திரம் கழுவும் திரவம்', 'Vim', '500 ml', 110, 120, 'bottle', 'refill,cleaning', [[40, null]], { requiresExpiry: false })
mm('household', 'Floor Cleaner', 'தரை சுத்தம் செய்யும் திரவம்', 'Lizol', '975 ml', 190, 215, 'bottle', 'cleaning', [[22, null]], { requiresExpiry: false })
mm('personal_care', 'Strong Teeth Toothpaste', 'பற்பசை', 'Colgate', '200 g', 105, 115, 'box', 'refill,personal', [[44, 400]], { aliases: ['paste'] })
mm('personal_care', 'Original Soap 3-pack', 'சோப்பு', 'Dettol', '3 × 75 g', 125, 135, 'box', 'refill,personal', [[38, 600]], { aliases: ['soap'] })
mm('personal_care', 'Anti-Dandruff Shampoo', 'ஷாம்பு', 'Clinic Plus', '340 ml', 190, 215, 'bottle', 'personal', [[17, 500]])
mm('bakery', 'Sandwich Bread', 'சாண்ட்விச் ரொட்டி', 'Modern', '400 g', 45, 45, 'pouch', 'quick,bakery', [[20, 2]], { aliases: ['bread', 'rotti'] })

/* ------------------------------------------------------------------ Selvam Provision Stores */
const SV = 'store-selvam'
const sv = (...a: [Department, string, string, string, string, number, number, PackShape, string, BSpec[], Opts?]) =>
  add(SV, 'sv', ...a)
sv('pantry', 'Ponni Boiled Rice', 'பொன்னி புழுங்கல் அரிசி', 'Selvam Select', '1 kg', 62, 65, 'pouch', 'staple,rice', [[200, 240]], { aliases: ['arisi', 'puzhungal'] })
sv('pantry', 'Idli Rice', 'இட்லி அரிசி', 'Selvam Select', '1 kg', 70, 75, 'pouch', 'staple,rice', [[50, 200]], { aliases: ['arisi'] })
sv('pantry', 'Toor Dal', 'துவரம் பருப்பு', 'Selvam Select', '500 g', 88, 95, 'pouch', 'staple,toordal,dal', [[40, 150]], { aliases: ['paruppu'] })
sv('pantry', 'Urad Dal', 'உளுத்தம் பருப்பு', 'Selvam Select', '500 g', 92, 100, 'pouch', 'staple,dal', [[30, 150]], { aliases: ['ulutham paruppu'] })
sv('pantry', 'Moong Dal', 'பாசிப் பருப்பு', 'Selvam Select', '500 g', 96, 105, 'pouch', 'dal', [[26, 150]], { aliases: ['pasi paruppu'] })
sv('pantry', 'Sesame (Gingelly) Oil', 'நல்லெண்ணெய்', 'Idhayam', '500 ml', 285, 310, 'bottle', 'staple,oil', [[25, 200]], { aliases: ['nallennai'] })
sv('pantry', 'Coconut Oil', 'தேங்காய் எண்ணெய்', 'KLF Coconad', '500 ml', 168, 180, 'bottle', 'oil', [[30, 220]], { aliases: ['thengai ennai'] })
sv('pantry', 'Tamarind', 'புளி', 'Selvam Select', '250 g', 48, 50, 'pouch', 'tamarind', [[40, 300]], { aliases: ['puli'] })
sv('pantry', 'Red Chilli Powder', 'மிளகாய்த் தூள்', 'Ruchi', '200 g', 78, 85, 'pouch', 'spice', [[30, 180]], { aliases: ['milagai thool'] })
sv('pantry', 'Turmeric Powder', 'மஞ்சள் தூள்', 'Ruchi', '100 g', 38, 42, 'pouch', 'spice', [[34, 180]], { aliases: ['manjal'] })
sv('pantry', 'Rasam Powder', 'ரசம் பொடி', 'Sakthi', '100 g', 45, 50, 'pouch', 'rasampowder,spice', [[28, 210]])
sv('pantry', 'Jaggery', 'வெல்லம்', 'Selvam Select', '500 g', 62, 70, 'bar', 'staple', [[25, 120]], { aliases: ['vellam'] })
sv('pantry', 'Beaten Rice (Poha)', 'அவல்', 'Selvam Select', '500 g', 55, 60, 'pouch', 'quick', [[2, 90]], { aliases: ['aval'] })
sv('pantry', 'Ragi Flour', 'ராகி மாவு', 'Kovai Millet', '500 g', 62, 70, 'pouch', 'staple', [[22, 14]], { aliases: ['kezhvaragu'], isNew: true })
sv('pantry', 'Sago', 'ஜவ்வரிசி', 'Selvam Select', '250 g', 48, 50, 'pouch', 'staple', [[18, -10]], { aliases: ['javvarisi'] })
sv('pantry', 'Sugar', 'சர்க்கரை', 'Selvam Select', '1 kg', 46, 50, 'pouch', 'staple', [[0, 200]], { aliases: ['sakkarai'] })
sv('pantry', 'Fennel Seeds', 'சோம்பு', 'Selvam Select', '100 g', 42, 45, 'pouch', 'spice', [[15, 'bad']], { aliases: ['sombu'] })

/* ------------------------------------------------------------------ Pasumai Fruits & Vegetables */
const PV = 'store-pasumai'
const pv = (...a: [Department, string, string, string, string, number, number, PackShape, string, BSpec[], Opts?]) =>
  add(PV, 'pv', ...a)
pv('fresh', 'Tomato', 'தக்காளி', 'Local Farm', '500 g', 28, 30, 'crate', 'veg,tomato,dinner', [[60, 3]], { aliases: ['thakkali'] })
pv('fresh', 'Onion (Big)', 'பெரிய வெங்காயம்', 'Local Farm', '1 kg', 42, 45, 'crate', 'veg,onion,dinner,staple', [[80, 10]], { aliases: ['vengayam'] })
pv('fresh', 'Potato', 'உருளைக்கிழங்கு', 'Local Farm', '1 kg', 40, 42, 'crate', 'veg,potato,dinner', [[70, 12]], { aliases: ['urulai'] })
pv('fresh', 'Carrot', 'கேரட்', 'Local Farm', '500 g', 38, 40, 'crate', 'veg,dinner', [[30, 4]])
pv('fresh', 'Brinjal', 'கத்தரிக்காய்', 'Local Farm', '500 g', 36, 40, 'crate', 'veg,dinner', [[25, 3]], { aliases: ['kathirikai'] })
pv('fresh', 'Drumstick', 'முருங்கைக்காய்', 'Local Farm', '250 g', 30, 32, 'crate', 'veg,drumstick,dinner', [[18, 2]], { aliases: ['murungai'] })
pv('fresh', "Ladies' Finger", 'வெண்டைக்காய்', 'Local Farm', '500 g', 44, 48, 'crate', 'veg,dinner', [[20, 3]], { aliases: ['vendakkai', 'okra'] })
pv('fresh', 'Lemon', 'எலுமிச்சை', 'Local Farm', '6 pieces', 24, 25, 'crate', 'veg,lemon,dinner', [[40, 7]], { aliases: ['elumichai'] })
pv('fresh', 'Green Chilli', 'பச்சை மிளகாய்', 'Local Farm', '100 g', 12, 12, 'crate', 'veg,greenchilli,dinner', [[35, 2]], { aliases: ['pachai milagai'] })
pv('fresh', 'Curry Leaves', 'கறிவேப்பிலை', 'Local Farm', '1 bunch', 10, 10, 'crate', 'curryleaf,dinner', [[30, 1]], { aliases: ['karuveppilai'] })
pv('fresh', 'Coriander Leaves', 'கொத்தமல்லி', 'Local Farm', '1 bunch', 15, 15, 'crate', 'dinner', [[3, 2]], { aliases: ['kothamalli'] })
pv('fresh', 'Garlic', 'பூண்டு', 'Local Farm', '100 g', 28, 30, 'crate', 'veg,garlic,dinner', [[25, 20]], { aliases: ['poondu'] })
pv('fresh', 'Coconut', 'தேங்காய்', 'Local Farm', '1 piece', 32, 35, 'crate', 'coconut,dinner', [[40, 10]], { aliases: ['thengai'] })
pv('fresh', 'Banana (Robusta)', 'வாழைப்பழம்', 'Local Farm', '6 pieces', 42, 45, 'crate', 'fruit', [[30, 3]], { aliases: ['vazhaipazham'] })
pv('fresh', 'Apple (Shimla)', 'ஆப்பிள்', 'Local Farm', '500 g', 120, 130, 'crate', 'fruit', [[15, 6]])
pv('fresh', 'Papaya', 'பப்பாளி', 'Local Farm', '1 piece', 48, 50, 'crate', 'fruit', [[10, 3]], { aliases: ['pappali'] })
pv('fresh', 'Spinach (Keerai)', 'கீரை', 'Local Farm', '1 bunch', 18, 20, 'crate', 'veg', [[15, -1]], { aliases: ['keerai'] })
pv('fresh', 'Ginger', 'இஞ்சி', 'Local Farm', '100 g', 22, 25, 'crate', 'veg', [[0, 5]], { aliases: ['inji'] })

/* ------------------------------------------------------------------ Madhuram Bakery */
const MB = 'store-madhuram'
const mb = (...a: [Department, string, string, string, string, number, number, PackShape, string, BSpec[], Opts?]) =>
  add(MB, 'mb', ...a)
mb('bakery', 'Milk Bread', 'பால் ரொட்டி', 'Madhuram', '400 g', 42, 45, 'pouch', 'quick,bakery', [[30, 2]], { aliases: ['bread'] })
mb('bakery', 'Brown Bread', 'பிரவுன் ரொட்டி', 'Madhuram', '400 g', 55, 60, 'pouch', 'bakery', [[22, 2]])
mb('bakery', 'Butter Bun (2 pieces)', 'வெண்ணெய் பன்', 'Madhuram', '2 pieces', 24, 24, 'pouch', 'quick,bakery', [[25, 1]], { aliases: ['bun'] })
mb('bakery', 'Plum Cake', 'பிளம் கேக்', 'Madhuram', '250 g', 120, 130, 'box', 'bakery', [[12, 6]], { aliases: ['cake'] })
mb('bakery', 'Chocolate Cake', 'சாக்லேட் கேக்', 'Madhuram', '500 g', 380, 400, 'box', 'bakery', [[4, 2]])
mb('bakery', 'Vegetable Puff', 'காய்கறி பஃப்', 'Madhuram', '1 piece', 18, 18, 'bar', 'snack,bakery', [[20, 0]], { aliases: ['puff'] })
mb('bakery', 'Cream Roll', 'கிரீம் ரோல்', 'Madhuram', '1 piece', 20, 20, 'bar', 'bakery', [[0, 1]])
mb('bakery', 'Tea Rusk', 'ரஸ்க்', 'Madhuram', '200 g', 40, 42, 'pouch', 'snack,quick', [[35, 25]])
mb('bakery', 'Khara Biscuit', 'காரா பிஸ்கட்', 'Madhuram', '250 g', 65, 70, 'pouch', 'snack', [[16, 20]], { aliases: ['biscuit'] })
mb('bakery', 'Coconut Cookies', 'தேங்காய் குக்கீஸ்', 'Madhuram', '200 g', 85, 90, 'box', 'snack,new', [[18, 30]], { isNew: true })

/* ------------------------------------------------------------------ Thenral Dairy */
const TD = 'store-thenral'
const td = (...a: [Department, string, string, string, string, number, number, PackShape, string, BSpec[], Opts?]) =>
  add(TD, 'td', ...a)
td('chilled', 'Toned Milk', 'பால்', 'Thenral', '500 ml', 27, 28, 'carton', 'dairy,quick,milk', [[120, 3]], { aliases: ['paal', 'milk'] })
td('chilled', 'Full Cream Milk', 'முழு கிரீம் பால்', 'Thenral', '1 litre', 66, 68, 'carton', 'dairy,milk', [[70, 3]], { aliases: ['paal', 'milk'] })
td('chilled', 'Curd Cup', 'தயிர்', 'Thenral', '400 g', 38, 40, 'tub', 'dairy,quick,curd', [[45, 5]], { aliases: ['thayir', 'yogurt'] })
td('chilled', 'Curd Tub', 'தயிர்', 'Thenral', '1 kg', 78, 80, 'tub', 'dairy,curd', [[0, 4]], { aliases: ['thayir'] })
td('chilled', 'Buttermilk', 'மோர்', 'Thenral', '200 ml', 10, 10, 'carton', 'dairy,drink', [[60, 2]], { aliases: ['mor'] })
td('chilled', 'Sweet Lassi', 'லஸ்ஸி', 'Thenral', '200 ml', 25, 25, 'carton', 'dairy,drink', [[14, 4], [8, 1]])
td('chilled', 'Paneer', 'பனீர்', 'Thenral', '200 g', 88, 95, 'box', 'dairy,dinner', [[24, 6]])
td('chilled', 'Cow Ghee', 'நெய்', 'Thenral', '500 ml', 335, 350, 'jar', 'dairy,staple', [[18, 150]], { aliases: ['nei'] })
td('chilled', 'Table Butter', 'வெண்ணெய்', 'Thenral', '200 g', 112, 120, 'bar', 'dairy', [[16, 40]], { aliases: ['vennai'] })
td('chilled', 'Farm Eggs', 'முட்டை', 'Thenral', '6 pieces', 42, 45, 'box', 'quick,egg', [[50, 12]], { veg: false, aliases: ['muttai'], policyOverride: { nearExpiryDays: 3 } })
td('chilled', 'Flavoured Milk', 'சுவை பால்', 'Thenral', '200 ml', 25, 25, 'carton', 'dairy,drink', [[26, -1]])

/* ------------------------------------------------------------------ Illam Household Needs */
const IH = 'store-illam'
const ih = (...a: [Department, string, string, string, string, number, number, PackShape, string, BSpec[], Opts?]) =>
  add(IH, 'ih', ...a)
ih('household', 'Quick Wash Detergent', 'சலவைத் தூள்', 'Surf Excel', '1 kg', 135, 150, 'pouch', 'refill,cleaning', [[30, null]], { requiresExpiry: false })
ih('household', 'Dishwash Bar', 'பாத்திரம் கழுவும் சோப்பு', 'Vim', '300 g', 28, 30, 'bar', 'refill,cleaning', [[80, null]], { requiresExpiry: false })
ih('household', 'Toilet Cleaner', 'கழிவறை சுத்திகரிப்பு', 'Harpic', '500 ml', 98, 105, 'bottle', 'cleaning', [[26, null]], { requiresExpiry: false })
ih('household', 'Glass Cleaner', 'கண்ணாடி சுத்திகரிப்பு', 'Colin', '500 ml', 98, 105, 'bottle', 'cleaning', [[12, null]], { requiresExpiry: false })
ih('household', 'Scrub Pad', 'ஸ்க்ரப் பேட்', 'Scotch-Brite', '1 pack', 40, 45, 'box', 'cleaning', [[60, null]], { requiresExpiry: false })
ih('household', 'Garbage Bags (Medium)', 'குப்பைப் பைகள்', 'Kovai Home', '30 pieces', 85, 95, 'box', 'cleaning', [[24, null]], { requiresExpiry: false })
ih('household', 'Mosquito Repellent Refill', 'கொசு விரட்டி', 'Good Knight', '45 ml', 78, 85, 'box', 'refill', [[28, 500]], { aliases: ['kosu'] })
ih('household', 'Room Freshener Gel', 'அறை நறுமணம்', 'Odonil', '75 g', 62, 70, 'tub', 'cleaning', [[3, 400]])
ih('personal_care', 'Soap 4-pack', 'சோப்பு', 'Lifebuoy', '4 × 100 g', 140, 150, 'box', 'refill,personal', [[40, 600]])
ih('personal_care', 'Ayurvedic Soap', 'ஆயுர்வேத சோப்பு', 'Medimix', '125 g', 48, 52, 'bar', 'personal', [[55, 500]])
ih('personal_care', 'Smooth Silky Shampoo', 'ஷாம்பு', 'Sunsilk', '340 ml', 185, 210, 'bottle', 'personal', [[18, 500]])
ih('personal_care', 'Soft Toothbrush (2 pack)', 'பல் துலக்கி', 'Oral-B', '1 pack', 60, 70, 'box', 'refill,personal', [[44, null]], { requiresExpiry: false })
ih('personal_care', 'Coconut Hair Oil', 'தேங்காய் எண்ணெய்', 'Parachute', '250 ml', 98, 105, 'bottle', 'personal', [[30, 400]])
ih('personal_care', 'Hand Wash Refill', 'கை கழுவும் திரவம்', 'Dettol', '750 ml', 99, 110, 'pouch', 'refill,personal', [[20, -20]])
ih('personal_care', 'Cold Cream', 'குளிர் கிரீம்', "Pond's", '100 ml', 115, 125, 'jar', 'personal', [[8, 300], [5, 'bad']])
ih('personal_care', 'Face Wash', 'முகம் கழுவும் திரவம்', 'Himalaya', '100 ml', 140, 155, 'bottle', 'personal,new', [[15, 450]], { isNew: true })

/** Build the demo catalog relative to `now`. Pure: call it again whenever "today" matters. */
export function buildDemoCatalog(now: Date = new Date()): { products: Product[]; batches: Batch[] } {
  const today = istDate(now)
  const products: Product[] = []
  const batches: Batch[] = []
  for (const { p, b } of rows) {
    products.push(p)
    b.forEach(([qty, expiry], i) => {
      let expiryDate: string | null
      if (expiry === null) expiryDate = null
      else if (expiry === 'bad') expiryDate = '31/02/26' // deliberately unparseable
      else expiryDate = addDays(today, expiry)
      batches.push({ id: `${p.id}-b${i + 1}`, productId: p.id, batchNo: `${p.id.toUpperCase()}-${String(i + 1).padStart(3, '0')}`, qty, expiryDate, status: 'active' })
    })
  }
  return { products, batches }
}
