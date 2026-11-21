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

mm('pantry', 'Basmati Rice', 'பாசுமதி அரிசி', 'India Gate', '1 kg', 165, 180, 'pouch', 'staple,rice', [[26, 240]], { aliases: ['biryani rice'] })
mm('pantry', 'Rava (Semolina)', 'ரவை', 'Aashirvaad', '500 g', 38, 42, 'pouch', 'staple,quick', [[40, 150]], { aliases: ['sooji'] })
mm('pantry', 'Gram Flour (Besan)', 'கடலை மாவு', 'Tata Sampann', '500 g', 68, 74, 'pouch', 'staple', [[30, 150]], { aliases: ['kadalai maavu'] })
mm('pantry', 'Maida', 'மைதா', 'Aashirvaad', '1 kg', 52, 56, 'pouch', 'staple', [[34, 150]])
mm('pantry', 'Turmeric Powder', 'மஞ்சள் தூள்', 'Catch', '100 g', 40, 44, 'pouch', 'spice', [[44, 200]], { aliases: ['manjal'] })
mm('pantry', 'Coriander Powder', 'மல்லித் தூள்', 'Catch', '200 g', 62, 68, 'pouch', 'spice', [[36, 200]], { aliases: ['malli thool'] })
mm('pantry', 'Cumin Seeds', 'சீரகம்', 'Catch', '100 g', 58, 64, 'jar', 'spice', [[28, 300]], { aliases: ['jeeragam'] })
mm('pantry', 'Mustard Seeds', 'கடுகு', 'Catch', '100 g', 24, 26, 'jar', 'spice', [[40, 300]], { aliases: ['kadugu'] })
mm('pantry', 'Black Pepper', 'மிளகு', 'Catch', '50 g', 72, 78, 'jar', 'spice', [[20, 300]], { aliases: ['milagu'] })
mm('pantry', 'Garam Masala', 'கரம் மசாலா', 'MDH', '100 g', 76, 82, 'box', 'spice', [[22, 240]])
mm('pantry', 'Mango Pickle', 'மாங்காய் ஊறுகாய்', 'Priya', '300 g', 85, 92, 'jar', 'pickle', [[26, 200]], { aliases: ['oorugai'] })
mm('pantry', 'Mixed Fruit Jam', 'பழக் கூழ்', 'Kissan', '500 g', 160, 175, 'jar', 'jam', [[18, 200]])
mm('pantry', 'Honey', 'தேன்', 'Dabur', '250 g', 135, 150, 'jar', 'honey', [[20, 360]], { aliases: ['then'] })
mm('pantry', 'Tomato Ketchup', 'தக்காளி கெட்ச்அப்', 'Kissan', '500 g', 120, 130, 'bottle', 'sauce', [[24, 240]])
mm('pantry', 'Peanut Butter', 'வேர்க்கடலை வெண்ணெய்', 'Sundrop', '340 g', 175, 190, 'jar', 'spread', [[14, 240]])
mm('pantry', 'Rolled Oats', 'ஓட்ஸ்', 'Quaker', '1 kg', 190, 210, 'pouch', 'breakfast,quick', [[22, 200]])
mm('pantry', 'Corn Flakes', 'கார்ன் ஃப்ளேக்ஸ்', "Kellogg's", '475 g', 185, 200, 'box', 'breakfast,quick', [[18, 160]])
mm('pantry', 'Vermicelli', 'சேமியா', 'Bambino', '400 g', 46, 50, 'pouch', 'quick', [[40, 200]], { aliases: ['semiya'] })
mm('pantry', 'Pasta Penne', 'பாஸ்தா', 'Del Monte', '500 g', 95, 105, 'pouch', 'quick', [[16, 300]])
mm('snacks', 'Marie Biscuits', 'மேரி பிஸ்கட்', 'Britannia', '250 g', 30, 32, 'pouch', 'snack,quick', [[60, 90]])
mm('snacks', 'Banana Chips', 'வாழைக்காய் சிப்ஸ்', 'Kovai Snacks', '150 g', 48, 52, 'pouch', 'snack', [[26, 50]], { aliases: ['vazhakkai'] })
mm('snacks', 'Mixture', 'மிக்சர்', 'Kovai Snacks', '250 g', 70, 75, 'pouch', 'snack', [[24, 55]])
mm('snacks', 'Peanut Chikki', 'கடலை மிட்டாய்', 'Kovai Snacks', '100 g', 30, 32, 'bar', 'snack', [[40, 120]], { aliases: ['kadalai mittai'] })
mm('snacks', 'Cream Biscuits', 'கிரீம் பிஸ்கட்', 'Oreo', '120 g', 40, 42, 'box', 'snack', [[50, 120]])
mm('snacks', 'Dark Chocolate Bar', 'சாக்லேட்', 'Cadbury', '55 g', 80, 85, 'bar', 'snack', [[36, 180]])
mm('beverages', 'Instant Coffee', 'உடனடி காபி', 'Bru', '100 g', 295, 320, 'jar', 'coffee', [[16, 300]])
mm('beverages', 'Green Tea Bags', 'கிரீன் டீ', 'Lipton', '25 bags', 145, 160, 'box', 'tea', [[20, 300]])
mm('beverages', 'Orange Soft Drink', 'ஆரஞ்சு பானம்', 'Fanta', '750 ml', 40, 42, 'bottle', 'drink', [[48, 120]])
mm('beverages', 'Lemon Soda', 'எலுமிச்சை சோடா', 'Sprite', '750 ml', 40, 42, 'bottle', 'drink', [[44, 120]])
mm('beverages', 'Mango Drink', 'மாம்பழ பானம்', 'Maaza', '600 ml', 38, 40, 'bottle', 'drink', [[52, 120]])
mm('beverages', 'Malt Health Drink', 'ஹெல்த் டிரிங்க்', 'Horlicks', '500 g', 285, 310, 'jar', 'drink', [[18, 300]])
mm('chilled', 'Fresh Cream', 'கிரீம்', 'Amul', '200 ml', 62, 66, 'carton', 'dairy', [[16, 20]])
mm('chilled', 'Mayonnaise', 'மயோனைஸ்', 'Veeba', '250 g', 95, 105, 'jar', 'sauce', [[14, 120]])
mm('household', 'Floor Mop Refill', 'தரை துடைப்பான்', 'Kovai Home', '1 piece', 120, 135, 'box', 'cleaning', [[16, null]], { requiresExpiry: false })
mm('household', 'Aluminium Foil', 'அலுமினியம் தாள்', 'Freshwrap', '9 m', 55, 60, 'box', 'kitchen', [[28, null]], { requiresExpiry: false })
mm('household', 'Tissue Rolls (4)', 'டிஷ்யூ', 'Kovai Home', '4 rolls', 95, 105, 'box', 'kitchen', [[30, null]], { requiresExpiry: false })
mm('household', 'Safety Matches (10)', 'தீப்பெட்டி', 'Ship', '10 boxes', 20, 20, 'box', 'kitchen', [[90, null]], { requiresExpiry: false, aliases: ['theepetti'] })
mm('household', 'Laundry Brush', 'துணி துவைக்கும் பிரஷ்', 'Kovai Home', '1 piece', 45, 50, 'box', 'cleaning', [[26, null]], { requiresExpiry: false })
mm('personal_care', 'Talcum Powder', 'பவுடர்', "Pond's", '300 g', 135, 145, 'tub', 'personal', [[20, 600]])
mm('personal_care', 'Deodorant Spray', 'டியோடரன்ட்', 'Fogg', '150 ml', 190, 210, 'bottle', 'personal', [[14, 600]])
mm('personal_care', 'Coconut Hair Oil', 'தேங்காய் எண்ணெய்', 'Parachute', '200 ml', 85, 92, 'bottle', 'personal', [[30, 400]])
mm('personal_care', 'Body Lotion', 'உடல் லோஷன்', 'Vaseline', '200 ml', 175, 190, 'bottle', 'personal', [[16, 500]])
mm('bakery', 'Brown Bread', 'பிரவுன் ரொட்டி', 'Modern', '400 g', 55, 58, 'pouch', 'bakery', [[16, 3]])
mm('bakery', 'Fruit Bun', 'பழ பன்', 'Modern', '2 pieces', 25, 25, 'pouch', 'bakery', [[18, 2]])

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

sv('pantry', 'Boiled Rice (Raw)', 'புழுங்கல் அரிசி', 'Selvam Select', '5 kg', 290, 310, 'pouch', 'staple,rice', [[40, 240]])
sv('pantry', 'Mustard Seeds', 'கடுகு', 'Selvam Select', '100 g', 22, 24, 'pouch', 'spice', [[60, 300]], { aliases: ['kadugu'] })
sv('pantry', 'Fenugreek Seeds', 'வெந்தயம்', 'Selvam Select', '100 g', 26, 28, 'pouch', 'spice', [[50, 300]], { aliases: ['vendhayam'] })
sv('pantry', 'Cumin Seeds', 'சீரகம்', 'Selvam Select', '100 g', 55, 60, 'pouch', 'spice', [[44, 300]], { aliases: ['jeeragam'] })
sv('pantry', 'Black Pepper', 'மிளகு', 'Selvam Select', '50 g', 66, 72, 'pouch', 'spice', [[30, 300]], { aliases: ['milagu'] })
sv('pantry', 'Coriander Seeds', 'மல்லி', 'Selvam Select', '200 g', 38, 42, 'pouch', 'spice', [[46, 300]], { aliases: ['malli'] })
sv('pantry', 'Dry Red Chilli', 'வத்தல்', 'Selvam Select', '200 g', 58, 64, 'pouch', 'spice', [[38, 300]], { aliases: ['vathal'] })
sv('pantry', 'Black Gram Whole', 'கருப்பு உளுந்து', 'Selvam Select', '500 g', 85, 92, 'pouch', 'dal', [[26, 200]])
sv('pantry', 'Chickpeas (Kondakadalai)', 'கொண்டைக்கடலை', 'Selvam Select', '500 g', 72, 80, 'pouch', 'dal', [[30, 200]], { aliases: ['kadalai'] })
sv('pantry', 'Green Gram Whole', 'பாசிப்பயறு', 'Selvam Select', '500 g', 80, 88, 'pouch', 'dal', [[28, 200]])
sv('pantry', 'Peanuts', 'வேர்க்கடலை', 'Selvam Select', '500 g', 78, 85, 'pouch', 'staple', [[34, 120]], { aliases: ['verkadalai'] })
sv('pantry', 'Rock Salt', 'கல் உப்பு', 'Selvam Select', '1 kg', 24, 26, 'pouch', 'salt', [[80, 400]])
sv('pantry', 'Dry Coconut (Copra)', 'கொப்பரை', 'Selvam Select', '250 g', 95, 105, 'pouch', 'staple', [[20, 120]])
sv('pantry', 'Wheat Flour (Atta)', 'கோதுமை மாவு', 'Selvam Select', '5 kg', 250, 275, 'pouch', 'staple,atta', [[36, 150]])

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

pv('fresh', 'Beans', 'பீன்ஸ்', 'Local Farm', '250 g', 30, 32, 'crate', 'veg,dinner', [[28, 3]])
pv('fresh', 'Cabbage', 'முட்டைக்கோஸ்', 'Local Farm', '1 piece', 36, 40, 'crate', 'veg,dinner', [[22, 5]], { aliases: ['muttaikose'] })
pv('fresh', 'Cauliflower', 'காலிஃபிளவர்', 'Local Farm', '1 piece', 40, 45, 'crate', 'veg,dinner', [[18, 4]])
pv('fresh', 'Beetroot', 'பீட்ரூட்', 'Local Farm', '500 g', 34, 38, 'crate', 'veg', [[24, 6]])
pv('fresh', 'Radish', 'முள்ளங்கி', 'Local Farm', '500 g', 26, 28, 'crate', 'veg', [[20, 4]], { aliases: ['mullangi'] })
pv('fresh', 'Pumpkin', 'பூசணிக்காய்', 'Local Farm', '500 g', 22, 25, 'crate', 'veg', [[26, 8]])
pv('fresh', 'Bottle Gourd', 'சுரைக்காய்', 'Local Farm', '1 piece', 32, 35, 'crate', 'veg', [[18, 4]])
pv('fresh', 'Cucumber', 'வெள்ளரிக்காய்', 'Local Farm', '500 g', 28, 30, 'crate', 'veg', [[30, 4]])
pv('fresh', 'Sweet Potato', 'சர்க்கரைவள்ளிக் கிழங்கு', 'Local Farm', '500 g', 36, 40, 'crate', 'veg', [[22, 7]])
pv('fresh', 'Mango (Banganapalli)', 'மாம்பழம்', 'Local Farm', '1 kg', 110, 120, 'crate', 'fruit', [[20, 4]], { aliases: ['maambazham'] })
pv('fresh', 'Pomegranate', 'மாதுளை', 'Local Farm', '500 g', 95, 105, 'crate', 'fruit', [[16, 6]])
pv('fresh', 'Grapes (Green)', 'திராட்சை', 'Local Farm', '500 g', 85, 95, 'crate', 'fruit', [[14, 4]])
pv('fresh', 'Guava', 'கொய்யா', 'Local Farm', '500 g', 55, 60, 'crate', 'fruit', [[18, 4]])
pv('fresh', 'Watermelon', 'தர்பூசணி', 'Local Farm', '1 piece', 70, 80, 'crate', 'fruit', [[12, 5]])
pv('fresh', 'Mint Leaves', 'புதினா', 'Local Farm', '1 bunch', 10, 10, 'crate', 'dinner', [[24, 2]])

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

mb('bakery', 'Whole Wheat Bread', 'கோதுமை ரொட்டி', 'Madhuram', '400 g', 52, 56, 'pouch', 'bakery', [[20, 2]])
mb('bakery', 'Garlic Bread', 'பூண்டு ரொட்டி', 'Madhuram', '250 g', 60, 65, 'pouch', 'bakery', [[14, 2]])
mb('bakery', 'Fruit Cake Slice', 'பழ கேக்', 'Madhuram', '1 slice', 35, 38, 'box', 'bakery', [[22, 4]])
mb('bakery', 'Muffins (2)', 'மஃபின்ஸ்', 'Madhuram', '2 pieces', 50, 55, 'box', 'bakery', [[18, 2]])
mb('bakery', 'Doughnut', 'டோநட்', 'Madhuram', '1 piece', 30, 30, 'box', 'bakery', [[20, 1]])
mb('bakery', 'Egg Puff', 'முட்டை பஃப்', 'Madhuram', '1 piece', 22, 22, 'bar', 'snack,bakery', [[16, 0]], { veg: false })
mb('bakery', 'Paneer Puff', 'பனீர் பஃப்', 'Madhuram', '1 piece', 28, 28, 'bar', 'snack,bakery', [[16, 0]])
mb('bakery', 'Rusk Toast', 'ரஸ்க் டோஸ்ட்', 'Madhuram', '250 g', 48, 52, 'pouch', 'snack', [[26, 30]])
mb('bakery', 'Almond Biscuits', 'பாதாம் பிஸ்கட்', 'Madhuram', '200 g', 95, 100, 'box', 'snack', [[14, 30]])
mb('bakery', 'Birthday Cake (Vanilla)', 'பிறந்தநாள் கேக்', 'Madhuram', '500 g', 320, 340, 'box', 'bakery', [[5, 2]])
mb('bakery', 'Ragi Cookies', 'ராகி பிஸ்கட்', 'Madhuram', '200 g', 78, 85, 'box', 'snack', [[16, 30]])
mb('bakery', 'Jam Tart', 'ஜாம் டார்ட்', 'Madhuram', '2 pieces', 40, 44, 'box', 'bakery', [[14, 3]])

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

td('chilled', 'Skimmed Milk', 'கொழுப்பற்ற பால்', 'Thenral', '500 ml', 29, 30, 'carton', 'dairy,milk', [[40, 3]])
td('chilled', 'Probiotic Drink', 'புரோபயாடிக் பானம்', 'Thenral', '65 ml', 12, 12, 'carton', 'dairy,drink', [[60, 8]])
td('chilled', 'Mango Lassi', 'மாம்பழ லஸ்ஸி', 'Thenral', '200 ml', 28, 28, 'carton', 'dairy,drink', [[20, 5]])
td('chilled', 'Rose Milk', 'ரோஸ் பால்', 'Thenral', '200 ml', 26, 26, 'carton', 'dairy,drink', [[24, 5]])
td('chilled', 'Cheese Cubes', 'சீஸ் துண்டுகள்', 'Thenral', '200 g', 125, 135, 'box', 'dairy', [[14, 30]])
td('chilled', 'Mozzarella', 'மொசரெல்லா', 'Thenral', '200 g', 150, 160, 'box', 'dairy', [[12, 25]])
td('chilled', 'Fresh Cream', 'கிரீம்', 'Thenral', '200 ml', 58, 62, 'carton', 'dairy', [[12, 15]])
td('chilled', 'Ghee Pouch', 'நெய் பை', 'Thenral', '200 ml', 150, 160, 'pouch', 'dairy', [[18, 150]])

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

ih('household', 'Phenyl', 'பீனால்', 'Kovai Home', '500 ml', 65, 72, 'bottle', 'cleaning', [[30, null]], { requiresExpiry: false })
ih('household', 'Bathroom Cleaner', 'குளியலறை சுத்திகரிப்பு', 'Domex', '500 ml', 92, 100, 'bottle', 'cleaning', [[24, null]], { requiresExpiry: false })
ih('household', 'Dish Scrub Brush', 'பாத்திரம் துலக்கும் பிரஷ்', 'Scotch-Brite', '1 piece', 35, 40, 'box', 'cleaning', [[40, null]], { requiresExpiry: false })
ih('household', 'Candles (6)', 'மெழுகுவர்த்தி', 'Kovai Home', '6 pieces', 30, 32, 'box', 'cleaning', [[50, null]], { requiresExpiry: false })
ih('household', 'Clothes Pegs (24)', 'துணி கிளிப்', 'Kovai Home', '24 pieces', 45, 50, 'box', 'cleaning', [[34, null]], { requiresExpiry: false })
ih('household', 'Washing Soap Bar', 'துணி சோப்பு', 'Wheel', '250 g', 22, 24, 'bar', 'cleaning', [[90, null]], { requiresExpiry: false })
ih('household', 'Liquid Detergent', 'திரவ சலவை', 'Ariel', '1 litre', 245, 265, 'bottle', 'cleaning', [[16, null]], { requiresExpiry: false })
ih('household', 'Naphthalene Balls', 'கற்பூர உருண்டை', 'Kovai Home', '100 g', 35, 38, 'box', 'cleaning', [[40, null]], { requiresExpiry: false })
ih('personal_care', 'Talcum Powder', 'பவுடர்', 'Cinthol', '300 g', 120, 130, 'tub', 'personal', [[22, 600]])
ih('personal_care', 'Hair Conditioner', 'கண்டிஷனர்', 'Dove', '180 ml', 160, 175, 'bottle', 'personal', [[14, 500]])
ih('personal_care', 'Face Cream', 'முகக் கிரீம்', 'Fair & Lovely', '50 g', 90, 99, 'jar', 'personal', [[20, 400]])
ih('personal_care', 'Razor (3 pack)', 'ரேஸர்', 'Gillette', '3 pieces', 85, 95, 'box', 'personal', [[26, null]], { requiresExpiry: false })
ih('personal_care', 'Deodorant Roll-on', 'ரோல்-ஆன்', 'Nivea', '50 ml', 140, 155, 'bottle', 'personal', [[18, 500]])
ih('personal_care', 'Sanitary Pads', 'சானிடரி பேட்', 'Whisper', '15 pieces', 135, 145, 'box', 'personal', [[24, 600]])
ih('personal_care', 'Lip Balm', 'உதடு தைலம்', 'Himalaya', '10 g', 70, 75, 'bar', 'personal', [[22, 400]])
ih('personal_care', 'Kajal', 'கண்மை', 'Lakme', '1 piece', 160, 175, 'bar', 'personal', [[16, 500]])

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
