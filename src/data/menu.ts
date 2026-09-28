export interface MenuItem {
  name: string;
  detail: string;
  price: string;
  badge?: string;
  tag?: 'GF' | 'V' | 'Spicy' | 'Signature';
}

export interface MenuCategory {
  id: string;
  name: string;
  description?: string;
  items: MenuItem[];
}

export const menuCategories: MenuCategory[] = [
  {
    id: "desayunos",
    name: "Desayunos",
    description: "Served daily from 11:00 AM — fresh, hearty Mexican breakfast classics.",
    items: [
      { name: "Huevos con chaya",   detail: "farm eggs, sautéed wild chaya greens, refried black beans, handmade corn tortillas", price: "$12", badge: "Local Favorite", tag: "GF" },
      { name: "Huevos rancheros",   detail: "crisp corn tostadas, sunny eggs, charred ranchera salsa, queso fresco, avocado",     price: "$13", badge: "Popular", tag: "GF" },
      { name: "Omelette del campo", detail: "wild mushrooms, baby spinach, melted Oaxaca cheese, served with house citrus salad",  price: "$14", tag: "V" },
      { name: "Waffle sandwich",    detail: "golden Belgian waffle, smoked thick-cut bacon, fried egg, pure Belizean maple syrup", price: "$13" },
    ],
  },
  {
    id: "tacos",
    name: "Tacos",
    description: "Hand-pressed corn tortillas, made to order and served with house lime and salsas.",
    items: [
      { name: "Tacos de birria",    detail: "12-hour braised beef shank, melted cheese, cilantro, white onion, rich dipping consommé", price: "$18", badge: "House Specialty" },
      { name: "Tacos al pastor",    detail: "achiote-marinated pork, roasted pineapple relish, fresh cilantro, salsa verde",            price: "$16", badge: "Popular", tag: "GF" },
      { name: "Tacos de camarón",   detail: "crispy spiced Caribbean shrimp, shaved purple cabbage, chipotle crema, pico de gallo",    price: "$17", badge: "Fresh Catch" },
      { name: "Quesabirria dorada", detail: "crispy grilled tortilla, melted quesillo, shredded beef, cilantro, scallion broth",       price: "$16", tag: "Signature" },
    ],
  },
  {
    id: "ceviches",
    name: "Ceviches",
    description: "Caught fresh along the coast, cured in fresh lime juice with crisp herbs.",
    items: [
      { name: "Ceviche clásico",    detail: "fresh local white fish, key lime, red onion, habanero essence, fresh cilantro, totopos", price: "$17", badge: "Chef's Catch", tag: "GF" },
      { name: "Ceviche de camarón", detail: "poached Caribbean shrimp, Roma tomato, English cucumber, Hass avocado, heirloom tortilla chips", price: "$18", tag: "GF" },
      { name: "Aguachile verde",    detail: "butterflied shrimp, blended serrano & lime juice, shaved red onion, chilled cucumber",    price: "$19", badge: "Spicy 🌶️", tag: "Spicy" },
    ],
  },
  {
    id: "para-compartir",
    name: "Para compartir",
    description: "Generous sharing platters made for passing around the table with friends and family.",
    items: [
      { name: "Guacamole de la casa", detail: "hand-mashed Hass avocado, charred jalapeño, lime, pico de gallo, warm sea-salt chips", price: "$11", badge: "Must Try", tag: "V" },
      { name: "Nachos supremos",      detail: "black beans, melted artisanal cheese blend, pickled jalapeño, crema, fire-roasted salsa", price: "$15", tag: "V" },
      { name: "Mariscada fría",       detail: "chilled citrus seafood cocktail, calamari, shrimp, fresh lime, avocado, artisanal tostadas", price: "$20", badge: "Signature", tag: "GF" },
    ],
  },
  {
    id: "postres-bebidas",
    name: "Postres & bebidas",
    description: "Handcrafted agave cocktails, chilled fruit aguas, and decadent homemade sweets.",
    items: [
      { name: "Tres leches artesanal", detail: "sponge cake soaked in three-milk infusion, fresh whipped Chantilly, seasonal tropical fruit", price: "$9", badge: "House Dessert" },
      { name: "Churros dorados",       detail: "piping hot cinnamon-sugar pastries with warm spiced Mexican dark chocolate dipping sauce",   price: "$8", badge: "Popular" },
      { name: "Margarita clásica",     detail: "100% blue agave tequila, freshly pressed Persian lime, organic agave nectar, sea salt rim",   price: "$12", badge: "Top Cocktail" },
      { name: "Agua fresca del día",   detail: "daily fresh seasonal fruit (watermelon, hibiscus, or pineapple), lime, touch of cane sugar", price: "$6", tag: "V" },
    ],
  },
];
