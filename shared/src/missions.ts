import type { Meal, Mission } from './types.ts'

/** Shopping missions are data, not code: add or tune one by editing this list. */
const dinnerMeals: Meal[] = [
  {
    id: 'sambar-rice',
    name: { en: 'Sambar rice', ta: 'சாம்பார் சாதம்' },
    blurb: { en: 'A comforting weekday dinner.', ta: '' },
    ingredients: ['rice', 'toordal', 'sambarpowder', 'tomato', 'onion', 'drumstick', 'curryleaf'],
  },
  {
    id: 'lemon-rice',
    name: { en: 'Lemon rice', ta: 'எலுமிச்சை சாதம்' },
    blurb: { en: 'Ready in twenty minutes.', ta: '' },
    ingredients: ['rice', 'lemon', 'oil', 'curryleaf', 'greenchilli'],
  },
  {
    id: 'chapati-kurma',
    name: { en: 'Chapati and potato kurma', ta: 'சப்பாத்தி உருளைக்கிழங்கு குருமா' },
    blurb: { en: 'Soft chapatis with a mild kurma.', ta: '' },
    ingredients: ['atta', 'potato', 'onion', 'tomato', 'oil'],
  },
  {
    id: 'tomato-rasam',
    name: { en: 'Tomato rasam', ta: 'தக்காளி ரசம்' },
    blurb: { en: 'Light, peppery and quick.', ta: '' },
    ingredients: ['tomato', 'toordal', 'rasampowder', 'garlic', 'curryleaf', 'tamarind'],
  },
  {
    id: 'idli-chutney',
    name: { en: 'Idli with coconut chutney', ta: 'இட்லி தேங்காய் சட்னி' },
    blurb: { en: 'Soft idlis and a fresh chutney.', ta: '' },
    ingredients: ['idlibatter', 'coconut', 'greenchilli', 'curryleaf'],
  },
]

export const MISSIONS: Mission[] = [
  {
    id: 'weekly-essentials',
    title: { en: 'Weekly essentials', ta: 'வாராந்திர அத்தியாவசியங்கள்' },
    blurb: { en: 'Rice, dal, oil, flour and the other things you buy every week.', ta: '' },
    anyTags: ['staple'],
  },
  {
    id: 'restock-home',
    title: { en: 'Restock my home', ta: 'வீட்டுப் பொருட்களை நிரப்பு' },
    blurb: { en: 'Cleaning and refill items that are running low.', ta: '' },
    anyTags: ['cleaning', 'refill'],
    departments: ['household'],
  },
  {
    id: 'fresh-produce',
    title: { en: 'Fresh fruits and vegetables', ta: 'புதிய பழங்கள் & காய்கறிகள்' },
    blurb: { en: 'Today’s fruit and vegetables, with the freshness window shown.', ta: '' },
    departments: ['fresh'],
  },
  {
    id: 'dinner-ingredients',
    title: { en: 'Dinner ingredients', ta: 'இரவு உணவுக்கான பொருட்கள்' },
    blurb: { en: 'Pick a simple meal and see what each ingredient costs nearby.', ta: '' },
    meals: dinnerMeals,
  },
  {
    id: 'family-snacks',
    title: { en: 'Snacks for the family', ta: 'குடும்பத்துக்கான சிற்றுண்டிகள்' },
    blurb: { en: 'Biscuits, bakes and tea-time snacks.', ta: '' },
    anyTags: ['snack'],
    departments: ['snacks'],
  },
  {
    id: 'quick-essentials',
    title: { en: 'Quick essentials', ta: 'அவசரத் தேவைகள்' },
    blurb: { en: 'Milk, bread, eggs and other things you need right now.', ta: '' },
    anyTags: ['quick'],
  },
  {
    id: 'personal-refill',
    title: { en: 'Personal care refill', ta: 'தனிநபர் பராமரிப்பு' },
    blurb: { en: 'Soap, toothpaste, shampoo and similar.', ta: '' },
    anyTags: ['personal'],
    departments: ['personal_care'],
  },
  {
    id: 'something-new',
    title: { en: 'Explore something new', ta: 'புதியவற்றை முயற்சிக்க' },
    blurb: { en: 'Recently added products from nearby stores.', ta: '' },
    onlyNew: true,
  },
]
