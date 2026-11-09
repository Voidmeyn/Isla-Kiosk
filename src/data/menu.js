



const img = (slug) => `assets/img/drinks/${slug}.webp`;

export const categories = [
  { id: 'all', label: 'All' },
  { id: 'espresso', label: 'Espresso Based' },
  { id: 'matcha', label: 'Matcha Series' },
  { id: 'milk', label: 'Milk Based' },
  { id: 'juice', label: 'Juice' },
  { id: 'blended', label: 'Blended Series' },
  { id: 'hot', label: 'Hot' },
];


export const products = [
  { id: 'caffe-latte', name: 'Caffe Latte', price: 59, category: 'espresso' },
  { id: 'spanish-latte', name: 'Spanish Latte', price: 59, category: 'espresso' },
  { id: 'vanilla-latte', name: 'Vanilla Latte', price: 59, category: 'espresso' },
  { id: 'caramel-latte', name: 'Caramel Latte', price: 59, category: 'espresso' },
  { id: 'matcha-latte', name: 'Matcha Latte', price: 59, category: 'matcha' },
  { id: 'strawberry-matcha', name: 'Strawberry Matcha', price: 59, category: 'matcha' },
  { id: 'white-mocha', name: 'White Mocha', price: 59, category: 'espresso' },
  { id: 'americano', name: 'Americano', price: 59, category: 'espresso' },
  { id: 'java-chips', name: 'Java Chips', price: 59, category: 'espresso' },
  { id: 'einspanner-latte', name: 'Einspanner Latte', price: 59, category: 'espresso' },
  { id: 'matcha-espresso', name: 'Matcha Espresso', price: 59, category: 'matcha' },

  { id: 'merry-matcha', name: 'Merry Matcha', price: 75, category: 'matcha' },
  { id: 'strawberry', name: 'Strawberry', price: 59, category: 'milk' },
  { id: 'dark-cocoa', name: 'Dark Cocoa', price: 59, category: 'milk' },
  { id: 'ube-taro', name: 'Ube Taro', price: 59, category: 'milk' },
  { id: 'cocoa-berry', name: 'Cocoa Berry', price: 59, category: 'milk' },
  { id: 'purple-lemonade', name: 'Purple Lemonade', price: 49, category: 'juice', addons: false },
  { id: 'pink-lychee', name: 'Pink Lychee', price: 49, category: 'juice', addons: false },
  { id: 'blended-java-chips', name: 'Blended Java Chips', price: 75, category: 'blended' },
  { id: 'blended-dark-cocoa', name: 'Blended Dark Cocoa', price: 75, category: 'blended' },
  { id: 'matcha-dream', name: 'Matcha Dream', price: 75, category: 'blended' },
  { id: 'ube-dream', name: 'Ube Dream', price: 75, category: 'blended' },
  { id: 'strawberry-dream', name: 'Strawberry Dream', price: 75, category: 'blended' },
  { id: 'capuccino', name: 'Capuccino', price: 39, category: 'hot' },
  { id: 'creamy-cocoa', name: 'Creamy Cocoa', price: 39, category: 'hot' },
].map((p) => ({ available: true, addons: true, ...p, image: img(p.id) }));

export const addons = [
  { id: 'coffee-jelly', name: 'Coffee Jelly', price: 11, image: 'assets/img/addons/coffee-jelly.webp' },
  { id: 'espresso-shot', name: 'Espresso Shot', price: 11, image: 'assets/img/addons/espresso-shot.webp' },
  { id: 'cream-cloud', name: 'Cream Cloud', price: 11, image: 'assets/img/addons/cream-cloud.webp' },
  { id: 'condensed-milk', name: 'Condensed Milk', price: 11, image: 'assets/img/addons/condensed-milk.webp' },
];
export const MAX_ADDON_QTY = 3;

const byId = new Map(products.map((p) => [p.id, p]));
const addonMap = new Map(addons.map((a) => [a.id, a]));
export const productById = (id) => byId.get(id);
export const addonById = (id) => addonMap.get(id);
