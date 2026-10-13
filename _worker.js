// Deal engine (copied from engine.js at build time)
/*
 * Deal Stack engine.
 * Shared by the app, the coupon collector, the Safari add-on and the Gmail scanner,
 * so every piece reads terms, scores coupons and plans savings the same way.
 */
(function (root, factory) {
  var E = factory();
  if (typeof module === 'object' && module.exports) module.exports = E;
  if (root) root.DealEngine = E;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  var VERSION = '2.0.0';
  var DAY = 86400000;

  /* ------------------------------------------------------------------ */
  /* Categories                                                          */
  /* ------------------------------------------------------------------ */

  var CATEGORIES = [
    { id: 'electronics', label: 'Electronics & Tech', kw: ['laptop', 'tv', 'television', 'monitor', 'headphones', 'headphone', 'earbuds', 'airpods', 'iphone', 'ipad', 'macbook', 'smartphone', 'phone', 'tablet', 'camera', 'ssd', 'hard drive', 'gpu', 'graphics card', 'router', 'speaker', 'smartwatch', 'apple watch', 'console', 'playstation', 'ps5', 'xbox', 'nintendo switch', 'charger', 'usb', 'keyboard', 'mouse', 'printer', 'kindle', 'echo', 'roku', 'fire tv', 'chromebook', 'desktop', 'computer', 'processor', 'cpu', 'memory card', 'microsd', 'drone', 'projector', 'soundbar', 'oled', 'qled', 'power bank', 'smart home', 'webcam', 'galaxy', 'pixel', 'gaming pc', 'nas'] },
    { id: 'fashion', label: 'Clothing & Shoes', kw: ['shirt', 't-shirt', 'tee', 'jeans', 'pants', 'dress', 'shoes', 'shoe', 'sneakers', 'sneaker', 'boots', 'jacket', 'coat', 'hoodie', 'sweater', 'socks', 'underwear', 'apparel', 'clothing', 'shorts', 'leggings', 'sandals', 'handbag', 'purse', 'sunglasses', 'jewelry', 'necklace', 'outerwear', 'activewear', 'polo', 'blazer', 'fleece', 'swimwear', 'bra', 'joggers'] },
    { id: 'home', label: 'Home & Kitchen', kw: ['kitchen', 'cookware', 'skillet', 'knife', 'knives', 'vacuum', 'mattress', 'bedding', 'sheets', 'pillow', 'towel', 'furniture', 'sofa', 'couch', 'lamp', 'air fryer', 'blender', 'instant pot', 'coffee maker', 'espresso', 'keurig', 'dyson', 'roomba', 'robot vacuum', 'drill', 'tool set', 'tools', 'dewalt', 'milwaukee', 'ryobi', 'garden', 'grill', 'patio', 'paint', 'storage', 'organizer', 'rug', 'decor', 'appliance', 'refrigerator', 'washer', 'dryer', 'dishwasher', 'microwave', 'thermostat', 'light bulb', 'cordless', 'mower', 'pressure washer', 'cutlery', 'dutch oven', 'candle', 'air purifier', 'humidifier', 'space heater'] },
    { id: 'grocery', label: 'Groceries', kw: ['grocery', 'groceries', 'snack', 'snacks', 'k-cup', 'k-cups', 'coffee beans', 'cereal', 'beverage', 'soda', 'sparkling water', 'protein bar', 'pantry', 'kirkland', 'produce', 'frozen', 'candy', 'chips', 'olive oil', 'paper towels', 'toilet paper', 'laundry detergent', 'trash bags', 'dish soap'] },
    { id: 'beauty', label: 'Beauty & Health', kw: ['beauty', 'skincare', 'skin care', 'makeup', 'cosmetics', 'shampoo', 'conditioner', 'lotion', 'fragrance', 'perfume', 'cologne', 'razor', 'toothbrush', 'toothpaste', 'vitamin', 'vitamins', 'supplement', 'pharmacy', 'oral care', 'deodorant', 'sunscreen', 'serum', 'moisturizer', 'hair dryer', 'nail', 'contact lenses', 'glasses'] },
    { id: 'food', label: 'Restaurants & Delivery', kw: ['restaurant', 'pizza', 'burger', 'delivery', 'doordash', 'uber eats', 'grubhub', 'takeout', 'meal kit', 'meal', 'chipotle', 'starbucks', 'dunkin', 'mcdonald', 'taco bell', 'wendy', 'dining', 'cafe', 'chick-fil-a', 'panera', 'subway', 'wings', 'sandwich', 'burrito', 'latte', 'drive-thru'] },
    { id: 'travel', label: 'Travel', kw: ['flight', 'flights', 'airline', 'hotel', 'hotels', 'airfare', 'cruise', 'vacation', 'rental car', 'car rental', 'resort', 'airbnb', 'expedia', 'trip', 'travel', 'luggage', 'suitcase', 'carry-on', 'nights', 'roundtrip', 'round-trip', 'airport'] },
    { id: 'sports', label: 'Sports & Outdoors', kw: ['fitness', 'gym', 'yoga', 'bike', 'bicycle', 'running', 'camping', 'tent', 'hiking', 'fishing', 'golf', 'outdoor', 'kayak', 'treadmill', 'dumbbell', 'dumbbells', 'weights', 'sports', 'cooler', 'yeti', 'tumbler', 'water bottle', 'backpacking', 'sleeping bag', 'ski', 'snowboard', 'pickleball', 'basketball', 'football', 'baseball', 'soccer', 'jersey'] },
    { id: 'kids', label: 'Kids & Toys', kw: ['toy', 'toys', 'lego', 'kids', 'baby', 'diaper', 'diapers', 'stroller', 'car seat', 'crib', 'board game', 'puzzle', 'doll', 'nerf', 'barbie', 'hot wheels', 'children', 'toddler', 'infant'] },
    { id: 'pets', label: 'Pets', kw: ['pet', 'pets', 'dog', 'dogs', 'cat', 'cats', 'puppy', 'kitten', 'pet food', 'dog food', 'cat food', 'litter', 'treats', 'aquarium', 'leash', 'chew'] },
    { id: 'auto', label: 'Auto & Gas', kw: ['tire', 'tires', 'motor oil', 'oil change', 'gas', 'fuel', 'gasoline', 'ev charging', 'car battery', 'wiper', 'dash cam', 'car wash', 'auto parts', 'jump starter', 'car'] },
    { id: 'entertainment', label: 'Entertainment & Streaming', kw: ['movie', 'movies', 'streaming', 'netflix', 'hulu', 'disney+', 'spotify', 'music', 'concert', 'tickets', 'ticket', 'video game', 'game', 'games', 'book', 'books', 'audible', 'audiobook', 'magazine', 'subscription', 'theater', 'theatre', 'fandango', 'game pass', 'steam', 'blu-ray', '4k uhd', 'vinyl'] },
    { id: 'office', label: 'Office & School', kw: ['office', 'school', 'notebook', 'notebooks', 'pens', 'printer ink', 'ink', 'toner', 'backpack', 'desk', 'office chair', 'calculator', 'supplies', 'paper', 'planner', 'stapler', 'labels', 'business cards'] },
    { id: 'general', label: 'Everything else', kw: [] }
  ];
  var CAT_BY_ID = {};
  CATEGORIES.forEach(function (c) { CAT_BY_ID[c.id] = c; });

  /* ------------------------------------------------------------------ */
  /* Stores                                                              */
  /* [name, domain, category, merchant type, extra]                      */
  /* Merchant type drives card rewards: online, superstore, warehouse,   */
  /* grocery, dining, gas, travel, streaming, entertainment, drugstore.  */
  /* ------------------------------------------------------------------ */

  var BRAND_ROWS = [
    // Everything stores
    ['Amazon', 'amazon.com', 'general', 'online'],
    ['Walmart', 'walmart.com', 'general', 'superstore'],
    ['Target', 'target.com', 'general', 'superstore'],
    ['Costco', 'costco.com', 'general', 'warehouse'],
    ["Sam's Club", 'samsclub.com', 'general', 'warehouse'],
    ["BJ's Wholesale", 'bjs.com', 'general', 'warehouse'],
    ['eBay', 'ebay.com', 'general', 'online'],
    ['Etsy', 'etsy.com', 'general', 'online'],
    ['Temu', 'temu.com', 'general', 'online'],
    ['QVC', 'qvc.com', 'general', 'online'],
    ['HSN', 'hsn.com', 'general', 'online'],
    ["Kohl's", 'kohls.com', 'fashion', 'online'],
    ["Macy's", 'macys.com', 'fashion', 'online'],
    ['Nordstrom', 'nordstrom.com', 'fashion', 'online'],
    ['Nordstrom Rack', 'nordstromrack.com', 'fashion', 'online'],
    ['JCPenney', 'jcpenney.com', 'fashion', 'online'],
    ["Dillard's", 'dillards.com', 'fashion', 'online'],
    ["Bloomingdale's", 'bloomingdales.com', 'fashion', 'online'],
    ['Saks Fifth Avenue', 'saksfifthavenue.com', 'fashion', 'online'],
    ['TJ Maxx', 'tjmaxx.tjx.com', 'fashion', 'online'],
    ['Marshalls', 'marshalls.com', 'fashion', 'online'],
    ['Overstock', 'overstock.com', 'home', 'online'],
    // Electronics
    ['Best Buy', 'bestbuy.com', 'electronics', 'online'],
    ['Apple', 'apple.com', 'electronics', 'online'],
    ['Samsung', 'samsung.com', 'electronics', 'online'],
    ['Dell', 'dell.com', 'electronics', 'online'],
    ['HP', 'hp.com', 'electronics', 'online'],
    ['Lenovo', 'lenovo.com', 'electronics', 'online'],
    ['Microsoft', 'microsoft.com', 'electronics', 'online'],
    ['Newegg', 'newegg.com', 'electronics', 'online'],
    ['B&H Photo', 'bhphotovideo.com', 'electronics', 'online'],
    ['Adorama', 'adorama.com', 'electronics', 'online'],
    ['Bose', 'bose.com', 'electronics', 'online'],
    ['Sony', 'sony.com', 'electronics', 'online'],
    ['Logitech', 'logitech.com', 'electronics', 'online'],
    ['Anker', 'anker.com', 'electronics', 'online'],
    ['GameStop', 'gamestop.com', 'electronics', 'online'],
    ['Garmin', 'garmin.com', 'electronics', 'online'],
    ['Adobe', 'adobe.com', 'electronics', 'online'],
    // Clothing & shoes
    ['Nike', 'nike.com', 'fashion', 'online'],
    ['Adidas', 'adidas.com', 'fashion', 'online'],
    ['Under Armour', 'underarmour.com', 'sports', 'online'],
    ['Lululemon', 'lululemon.com', 'fashion', 'online'],
    ['Gap', 'gap.com', 'fashion', 'online'],
    ['Old Navy', 'oldnavy.gap.com', 'fashion', 'online'],
    ['Banana Republic', 'bananarepublic.gap.com', 'fashion', 'online'],
    ['Athleta', 'athleta.gap.com', 'fashion', 'online'],
    ['J.Crew', 'jcrew.com', 'fashion', 'online'],
    ['Madewell', 'madewell.com', 'fashion', 'online'],
    ['Abercrombie & Fitch', 'abercrombie.com', 'fashion', 'online'],
    ['Hollister', 'hollisterco.com', 'fashion', 'online'],
    ['American Eagle', 'ae.com', 'fashion', 'online'],
    ["Levi's", 'levi.com', 'fashion', 'online'],
    ['Uniqlo', 'uniqlo.com', 'fashion', 'online'],
    ['H&M', 'hm.com', 'fashion', 'online'],
    ['Zara', 'zara.com', 'fashion', 'online'],
    ['Express', 'express.com', 'fashion', 'online'],
    ['Columbia', 'columbia.com', 'sports', 'online'],
    ['The North Face', 'thenorthface.com', 'sports', 'online'],
    ['Patagonia', 'patagonia.com', 'sports', 'online'],
    ['Carhartt', 'carhartt.com', 'fashion', 'online'],
    ['Ralph Lauren', 'ralphlauren.com', 'fashion', 'online'],
    ['Tommy Hilfiger', 'tommy.com', 'fashion', 'online'],
    ['Coach', 'coach.com', 'fashion', 'online'],
    ['Kate Spade', 'katespade.com', 'fashion', 'online'],
    ['Michael Kors', 'michaelkors.com', 'fashion', 'online'],
    ['Crocs', 'crocs.com', 'fashion', 'online'],
    ['Skechers', 'skechers.com', 'fashion', 'online'],
    ['New Balance', 'newbalance.com', 'fashion', 'online'],
    ['Converse', 'converse.com', 'fashion', 'online'],
    ['Vans', 'vans.com', 'fashion', 'online'],
    ['Foot Locker', 'footlocker.com', 'fashion', 'online'],
    ['DSW', 'dsw.com', 'fashion', 'online'],
    ['Zappos', 'zappos.com', 'fashion', 'online'],
    ['Famous Footwear', 'famousfootwear.com', 'fashion', 'online'],
    ['Allbirds', 'allbirds.com', 'fashion', 'online'],
    ['Hoka', 'hoka.com', 'fashion', 'online'],
    ['Brooks', 'brooksrunning.com', 'sports', 'online'],
    ['Puma', 'puma.com', 'fashion', 'online'],
    ['Reebok', 'reebok.com', 'fashion', 'online'],
    ['Fabletics', 'fabletics.com', 'fashion', 'online'],
    ['Quince', 'quince.com', 'fashion', 'online'],
    ['Everlane', 'everlane.com', 'fashion', 'online'],
    ["Lands' End", 'landsend.com', 'fashion', 'online'],
    ['L.L.Bean', 'llbean.com', 'sports', 'online'],
    ['Shein', 'shein.com', 'fashion', 'online'],
    // Home
    ['Home Depot', 'homedepot.com', 'home', 'online'],
    ["Lowe's", 'lowes.com', 'home', 'online'],
    ['Wayfair', 'wayfair.com', 'home', 'online'],
    ['IKEA', 'ikea.com', 'home', 'online'],
    ['Bed Bath & Beyond', 'bedbathandbeyond.com', 'home', 'online'],
    ['Pottery Barn', 'potterybarn.com', 'home', 'online'],
    ['West Elm', 'westelm.com', 'home', 'online'],
    ['Williams Sonoma', 'williams-sonoma.com', 'home', 'online'],
    ['Crate & Barrel', 'crateandbarrel.com', 'home', 'online'],
    ['Sur La Table', 'surlatable.com', 'home', 'online'],
    ['Dyson', 'dyson.com', 'home', 'online'],
    ['Shark', 'sharkclean.com', 'home', 'online'],
    ['Ninja', 'ninjakitchen.com', 'home', 'online'],
    ['KitchenAid', 'kitchenaid.com', 'home', 'online'],
    ['Brooklinen', 'brooklinen.com', 'home', 'online'],
    ['Casper', 'casper.com', 'home', 'online'],
    ['Purple', 'purple.com', 'home', 'online'],
    ['Ace Hardware', 'acehardware.com', 'home', 'online'],
    ['Harbor Freight', 'harborfreight.com', 'home', 'online'],
    ['Menards', 'menards.com', 'home', 'online'],
    ['Michaels', 'michaels.com', 'home', 'online'],
    ['Hobby Lobby', 'hobbylobby.com', 'home', 'online'],
    ['At Home', 'athome.com', 'home', 'online'],
    ['The Container Store', 'containerstore.com', 'home', 'online'],
    ['Ashley', 'ashleyfurniture.com', 'home', 'online'],
    ['Article', 'article.com', 'home', 'online'],
    ['Ruggable', 'ruggable.com', 'home', 'online'],
    ['Yankee Candle', 'yankeecandle.com', 'home', 'online'],
    // Groceries and drugstores
    ['Kroger', 'kroger.com', 'grocery', 'grocery'],
    ['Whole Foods Market', 'wholefoodsmarket.com', 'grocery', 'grocery'],
    ['Safeway', 'safeway.com', 'grocery', 'grocery'],
    ['Albertsons', 'albertsons.com', 'grocery', 'grocery'],
    ['Publix', 'publix.com', 'grocery', 'grocery'],
    ['H-E-B', 'heb.com', 'grocery', 'grocery'],
    ["Trader Joe's", 'traderjoes.com', 'grocery', 'grocery'],
    ['Aldi', 'aldi.us', 'grocery', 'grocery'],
    ['Stop & Shop', 'stopandshop.com', 'grocery', 'grocery'],
    ['ShopRite', 'shoprite.com', 'grocery', 'grocery'],
    ['Wegmans', 'wegmans.com', 'grocery', 'grocery'],
    ['Giant', 'giantfood.com', 'grocery', 'grocery'],
    ['Instacart', 'instacart.com', 'grocery', 'online'],
    ['Thrive Market', 'thrivemarket.com', 'grocery', 'online'],
    ['Gopuff', 'gopuff.com', 'grocery', 'online'],
    ['Walgreens', 'walgreens.com', 'beauty', 'drugstore'],
    ['CVS', 'cvs.com', 'beauty', 'drugstore'],
    // Beauty
    ['Sephora', 'sephora.com', 'beauty', 'online'],
    ['Ulta Beauty', 'ulta.com', 'beauty', 'online'],
    ['Bath & Body Works', 'bathandbodyworks.com', 'beauty', 'online'],
    ['Glossier', 'glossier.com', 'beauty', 'online'],
    ['Fenty Beauty', 'fentybeauty.com', 'beauty', 'online'],
    ['Dermstore', 'dermstore.com', 'beauty', 'online'],
    ['Clinique', 'clinique.com', 'beauty', 'online'],
    ['Estee Lauder', 'esteelauder.com', 'beauty', 'online'],
    ['MAC Cosmetics', 'maccosmetics.com', 'beauty', 'online'],
    ['e.l.f. Cosmetics', 'elfcosmetics.com', 'beauty', 'online'],
    ["Harry's", 'harrys.com', 'beauty', 'online'],
    ['Dollar Shave Club', 'dollarshaveclub.com', 'beauty', 'online'],
    ['Vitacost', 'vitacost.com', 'beauty', 'online'],
    ['GNC', 'gnc.com', 'beauty', 'online'],
    ['iHerb', 'iherb.com', 'beauty', 'online'],
    // Restaurants and delivery
    ['DoorDash', 'doordash.com', 'food', 'dining'],
    ['Uber Eats', 'ubereats.com', 'food', 'dining'],
    ['Grubhub', 'grubhub.com', 'food', 'dining'],
    ["Domino's", 'dominos.com', 'food', 'dining'],
    ['Pizza Hut', 'pizzahut.com', 'food', 'dining'],
    ["Papa John's", 'papajohns.com', 'food', 'dining'],
    ['Chipotle', 'chipotle.com', 'food', 'dining'],
    ['Starbucks', 'starbucks.com', 'food', 'dining'],
    ["Dunkin'", 'dunkindonuts.com', 'food', 'dining'],
    ["McDonald's", 'mcdonalds.com', 'food', 'dining'],
    ['Taco Bell', 'tacobell.com', 'food', 'dining'],
    ["Wendy's", 'wendys.com', 'food', 'dining'],
    ['Burger King', 'bk.com', 'food', 'dining'],
    ['Chick-fil-A', 'chick-fil-a.com', 'food', 'dining'],
    ['Panera Bread', 'panerabread.com', 'food', 'dining'],
    ['Subway', 'subway.com', 'food', 'dining'],
    ["Applebee's", 'applebees.com', 'food', 'dining'],
    ['Olive Garden', 'olivegarden.com', 'food', 'dining'],
    ['Buffalo Wild Wings', 'buffalowildwings.com', 'food', 'dining'],
    ['Shake Shack', 'shakeshack.com', 'food', 'dining'],
    ['Sweetgreen', 'sweetgreen.com', 'food', 'dining'],
    ['HelloFresh', 'hellofresh.com', 'food', 'online'],
    ['Factor', 'factor75.com', 'food', 'online'],
    // Travel
    ['Expedia', 'expedia.com', 'travel', 'travel'],
    ['Booking.com', 'booking.com', 'travel', 'travel'],
    ['Hotels.com', 'hotels.com', 'travel', 'travel'],
    ['Priceline', 'priceline.com', 'travel', 'travel'],
    ['Kayak', 'kayak.com', 'travel', 'travel'],
    ['Airbnb', 'airbnb.com', 'travel', 'travel'],
    ['Vrbo', 'vrbo.com', 'travel', 'travel'],
    ['Marriott', 'marriott.com', 'travel', 'travel'],
    ['Hilton', 'hilton.com', 'travel', 'travel'],
    ['Hyatt', 'hyatt.com', 'travel', 'travel'],
    ['IHG Hotels', 'ihg.com', 'travel', 'travel'],
    ['Southwest Airlines', 'southwest.com', 'travel', 'travel'],
    ['Delta', 'delta.com', 'travel', 'travel'],
    ['United Airlines', 'united.com', 'travel', 'travel'],
    ['American Airlines', 'aa.com', 'travel', 'travel'],
    ['JetBlue', 'jetblue.com', 'travel', 'travel'],
    ['Hertz', 'hertz.com', 'travel', 'travel'],
    ['Enterprise', 'enterprise.com', 'travel', 'travel'],
    ['Avis', 'avis.com', 'travel', 'travel'],
    ['Budget', 'budget.com', 'travel', 'travel'],
    ['Viator', 'viator.com', 'travel', 'travel'],
    ['Tripadvisor', 'tripadvisor.com', 'travel', 'travel'],
    ['Carnival', 'carnival.com', 'travel', 'travel'],
    ['Royal Caribbean', 'royalcaribbean.com', 'travel', 'travel'],
    ['Amtrak', 'amtrak.com', 'travel', 'travel'],
    // Sports and outdoors
    ["Dick's Sporting Goods", 'dickssportinggoods.com', 'sports', 'online'],
    ['REI', 'rei.com', 'sports', 'online'],
    ['Academy Sports', 'academy.com', 'sports', 'online'],
    ['Bass Pro Shops', 'basspro.com', 'sports', 'online'],
    ["Cabela's", 'cabelas.com', 'sports', 'online'],
    ['YETI', 'yeti.com', 'sports', 'online'],
    ['Hydro Flask', 'hydroflask.com', 'sports', 'online'],
    ['Stanley', 'stanley1913.com', 'sports', 'online'],
    ['Peloton', 'onepeloton.com', 'sports', 'online'],
    ['Golf Galaxy', 'golfgalaxy.com', 'sports', 'online'],
    ['Backcountry', 'backcountry.com', 'sports', 'online'],
    ['Fanatics', 'fanatics.com', 'sports', 'online'],
    // Kids
    ['LEGO', 'lego.com', 'kids', 'online'],
    ["Carter's", 'carters.com', 'kids', 'online'],
    ["The Children's Place", 'childrensplace.com', 'kids', 'online'],
    ['buybuy BABY', 'buybuybaby.com', 'kids', 'online'],
    ['Mattel', 'mattel.com', 'kids', 'online'],
    ['Melissa & Doug', 'melissaanddoug.com', 'kids', 'online'],
    ['Pottery Barn Kids', 'potterybarnkids.com', 'kids', 'online'],
    // Pets
    ['Chewy', 'chewy.com', 'pets', 'online'],
    ['Petco', 'petco.com', 'pets', 'online'],
    ['PetSmart', 'petsmart.com', 'pets', 'online'],
    ['BarkBox', 'barkbox.com', 'pets', 'online'],
    // Auto and gas
    ['AutoZone', 'autozone.com', 'auto', 'online'],
    ['Advance Auto Parts', 'advanceautoparts.com', 'auto', 'online'],
    ["O'Reilly Auto Parts", 'oreillyauto.com', 'auto', 'online'],
    ['NAPA', 'napaonline.com', 'auto', 'online'],
    ['Tire Rack', 'tirerack.com', 'auto', 'online'],
    ['Discount Tire', 'discounttire.com', 'auto', 'online'],
    ['Pep Boys', 'pepboys.com', 'auto', 'online'],
    ['Jiffy Lube', 'jiffylube.com', 'auto', 'online'],
    ['Shell', 'shell.us', 'auto', 'gas'],
    ['Exxon', 'exxon.com', 'auto', 'gas'],
    ['BP', 'bp.com', 'auto', 'gas'],
    // Entertainment and streaming
    ['Netflix', 'netflix.com', 'entertainment', 'streaming'],
    ['Hulu', 'hulu.com', 'entertainment', 'streaming'],
    ['Disney+', 'disneyplus.com', 'entertainment', 'streaming'],
    ['HBO Max', 'hbomax.com', 'entertainment', 'streaming'],
    ['Paramount+', 'paramountplus.com', 'entertainment', 'streaming'],
    ['Peacock', 'peacocktv.com', 'entertainment', 'streaming'],
    ['Spotify', 'spotify.com', 'entertainment', 'streaming'],
    ['YouTube Premium', 'youtube.com', 'entertainment', 'streaming'],
    ['SiriusXM', 'siriusxm.com', 'entertainment', 'streaming'],
    ['Audible', 'audible.com', 'entertainment', 'online'],
    ['Ticketmaster', 'ticketmaster.com', 'entertainment', 'entertainment'],
    ['StubHub', 'stubhub.com', 'entertainment', 'entertainment'],
    ['SeatGeek', 'seatgeek.com', 'entertainment', 'entertainment'],
    ['Fandango', 'fandango.com', 'entertainment', 'entertainment'],
    ['AMC Theatres', 'amctheatres.com', 'entertainment', 'entertainment'],
    ['Regal', 'regmovies.com', 'entertainment', 'entertainment'],
    ['Barnes & Noble', 'barnesandnoble.com', 'entertainment', 'online'],
    ['Steam', 'steampowered.com', 'entertainment', 'online'],
    ['PlayStation', 'playstation.com', 'entertainment', 'online'],
    ['Xbox', 'xbox.com', 'entertainment', 'online'],
    ['Nintendo', 'nintendo.com', 'entertainment', 'online'],
    // Office
    ['Staples', 'staples.com', 'office', 'online'],
    ['Office Depot', 'officedepot.com', 'office', 'online'],
    ['Vistaprint', 'vistaprint.com', 'office', 'online'],
    ['Shutterfly', 'shutterfly.com', 'office', 'online'],
    // Places to pay (no coupons fetched; used for "best card to use")
    ['Costco Gas', 'costco-gas', 'auto', 'costco_gas', { pseudo: true, url: 'https://www.costco.com/gasoline.html' }],
    ['Any gas station or EV charger', 'any-gas', 'auto', 'gas', { pseudo: true }],
    ['Any restaurant', 'any-dining', 'food', 'dining', { pseudo: true }],
    ['Any grocery store', 'any-grocery', 'grocery', 'grocery', { pseudo: true }],
    ['Streaming services', 'any-streaming', 'entertainment', 'streaming', { pseudo: true }],
    ['Concerts, movies and events', 'any-entertainment', 'entertainment', 'entertainment', { pseudo: true }],
    ['Flights and hotels booked directly', 'any-travel', 'travel', 'travel', { pseudo: true }],
    ['Hotels and rental cars on Capital One Travel', 'c1-travel-hotels', 'travel', 'c1hotel', { pseudo: true, url: 'https://travel.capitalone.com' }],
    ['Flights on Capital One Travel', 'c1-travel-flights', 'travel', 'c1flight', { pseudo: true, url: 'https://travel.capitalone.com' }],
    ['Anywhere else', 'any-other', 'general', 'online', { pseudo: true }]
  ];

  var ALIASES = {
    'amazon.com': ['amazon', 'amazon.com', 'whole foods amazon', 'woot'],
    'walmart.com': ['walmart', 'walmart.com', 'wal-mart'],
    'bestbuy.com': ['best buy', 'bestbuy', 'bestbuy.com'],
    'costco.com': ['costco', 'costco wholesale', 'costco.com'],
    'homedepot.com': ['home depot', 'the home depot', 'homedepot'],
    'lowes.com': ['lowes', "lowe's"],
    'macys.com': ['macys', "macy's"],
    'kohls.com': ['kohls', "kohl's"],
    'dickssportinggoods.com': ['dicks', "dick's", "dick's sporting goods", 'dicks sporting goods'],
    'ulta.com': ['ulta', 'ulta beauty'],
    'tjmaxx.tjx.com': ['tj maxx', 'tjmaxx', 't.j. maxx'],
    'ae.com': ['american eagle', 'american eagle outfitters', 'ae', 'aerie'],
    'dunkindonuts.com': ['dunkin', "dunkin'", 'dunkin donuts'],
    'bk.com': ['burger king'],
    'hbomax.com': ['hbo max', 'max', 'hbo'],
    'disneyplus.com': ['disney+', 'disney plus'],
    'paramountplus.com': ['paramount+', 'paramount plus'],
    'peacocktv.com': ['peacock'],
    'steampowered.com': ['steam', 'steam store'],
    'stanley1913.com': ['stanley'],
    'onepeloton.com': ['peloton'],
    'bhphotovideo.com': ['b&h', 'b&h photo', 'b&h photo video', 'bh photo'],
    'ihg.com': ['ihg', 'ihg hotels', 'holiday inn'],
    'aa.com': ['american airlines'],
    'ubereats.com': ['uber eats', 'ubereats'],
    'doordash.com': ['doordash', 'door dash'],
    'samsclub.com': ["sam's club", 'sams club'],
    'bjs.com': ["bj's", 'bjs', "bj's wholesale"],
    'chewy.com': ['chewy'],
    'newegg.com': ['newegg'],
    'ebay.com': ['ebay'],
    'target.com': ['target'],
    'apple.com': ['apple', 'apple store'],
    'microsoft.com': ['microsoft', 'microsoft store'],
    'nike.com': ['nike'],
    'adidas.com': ['adidas'],
    'sephora.com': ['sephora'],
    'wayfair.com': ['wayfair'],
    'gap.com': ['gap'],
    'oldnavy.gap.com': ['old navy'],
    'staples.com': ['staples'],
    'officedepot.com': ['office depot', 'officemax', 'office depot officemax'],
    'walgreens.com': ['walgreens'],
    'cvs.com': ['cvs', 'cvs pharmacy'],
    'lego.com': ['lego'],
    'rei.com': ['rei', 'rei co-op'],
    'gamestop.com': ['gamestop'],
    'starbucks.com': ['starbucks'],
    'expedia.com': ['expedia'],
    'hotels.com': ['hotels.com'],
    'booking.com': ['booking.com', 'booking'],
    'priceline.com': ['priceline'],
    'tirerack.com': ['tire rack'],
    'autozone.com': ['autozone'],
    'zappos.com': ['zappos'],
    'levi.com': ["levi's", 'levis'],
    'hm.com': ['h&m', 'h and m'],
    'jcrew.com': ['j.crew', 'j crew', 'jcrew'],
    'llbean.com': ['l.l.bean', 'll bean', 'llbean'],
    'landsend.com': ["lands' end", 'lands end'],
    'elfcosmetics.com': ['elf', 'e.l.f.', 'elf cosmetics'],
    'maccosmetics.com': ['mac', 'mac cosmetics'],
    'williams-sonoma.com': ['williams sonoma', 'williams-sonoma'],
    'crateandbarrel.com': ['crate & barrel', 'crate and barrel'],
    'bathandbodyworks.com': ['bath & body works', 'bath and body works'],
    'containerstore.com': ['the container store', 'container store'],
    'childrensplace.com': ["the children's place", 'childrens place', "children's place"],
    'buybuybaby.com': ['buybuy baby', 'buy buy baby'],
    'harborfreight.com': ['harbor freight', 'harbor freight tools'],
    'acehardware.com': ['ace hardware', 'ace'],
    'wholefoodsmarket.com': ['whole foods', 'whole foods market'],
    'stopandshop.com': ['stop & shop', 'stop and shop'],
    'traderjoes.com': ["trader joe's", 'trader joes'],
    'heb.com': ['h-e-b', 'heb'],
    'dominos.com': ["domino's", 'dominos'],
    'papajohns.com': ["papa john's", 'papa johns'],
    'mcdonalds.com': ["mcdonald's", 'mcdonalds'],
    'chick-fil-a.com': ['chick-fil-a', 'chick fil a', 'chickfila'],
    'panerabread.com': ['panera', 'panera bread'],
    'applebees.com': ["applebee's", 'applebees'],
    'buffalowildwings.com': ['buffalo wild wings', 'bww'],
    'amctheatres.com': ['amc', 'amc theatres'],
    'regmovies.com': ['regal', 'regal cinemas'],
    'barnesandnoble.com': ['barnes & noble', 'barnes and noble'],
    'esteelauder.com': ['estee lauder', 'estée lauder'],
    'abercrombie.com': ['abercrombie', 'abercrombie & fitch', 'a&f'],
    'hollisterco.com': ['hollister'],
    'thenorthface.com': ['the north face', 'north face'],
    'underarmour.com': ['under armour'],
    'newbalance.com': ['new balance'],
    'footlocker.com': ['foot locker'],
    'famousfootwear.com': ['famous footwear'],
    'nordstromrack.com': ['nordstrom rack'],
    'saksfifthavenue.com': ['saks', 'saks fifth avenue'],
    'bloomingdales.com': ["bloomingdale's", 'bloomingdales'],
    'dillards.com': ["dillard's", 'dillards'],
    'jcpenney.com': ['jcpenney', 'jcp', 'jc penney'],
    'bedbathandbeyond.com': ['bed bath & beyond', 'bed bath and beyond'],
    'potterybarn.com': ['pottery barn'],
    'westelm.com': ['west elm'],
    'surlatable.com': ['sur la table'],
    'sharkclean.com': ['shark', 'sharkninja'],
    'ninjakitchen.com': ['ninja', 'ninja kitchen'],
    'kitchenaid.com': ['kitchenaid'],
    'ashleyfurniture.com': ['ashley', 'ashley furniture'],
    'yankeecandle.com': ['yankee candle'],
    'advanceautoparts.com': ['advance auto parts', 'advance auto'],
    'oreillyauto.com': ["o'reilly", "o'reilly auto parts", 'oreilly'],
    'napaonline.com': ['napa', 'napa auto parts'],
    'discounttire.com': ['discount tire'],
    'pepboys.com': ['pep boys'],
    'jiffylube.com': ['jiffy lube'],
    'youtube.com': ['youtube', 'youtube premium', 'youtube tv'],
    'siriusxm.com': ['siriusxm', 'sirius xm'],
    'ticketmaster.com': ['ticketmaster'],
    'stubhub.com': ['stubhub'],
    'seatgeek.com': ['seatgeek'],
    'playstation.com': ['playstation', 'playstation store', 'sony playstation'],
    'xbox.com': ['xbox'],
    'nintendo.com': ['nintendo', 'nintendo eshop'],
    'vistaprint.com': ['vistaprint'],
    'shutterfly.com': ['shutterfly'],
    'dyson.com': ['dyson'],
    'dell.com': ['dell'],
    'hp.com': ['hp'],
    'lenovo.com': ['lenovo'],
    'samsung.com': ['samsung'],
    'bose.com': ['bose'],
    'sony.com': ['sony'],
    'logitech.com': ['logitech'],
    'anker.com': ['anker'],
    'garmin.com': ['garmin'],
    'adobe.com': ['adobe'],
    'adorama.com': ['adorama'],
    'temu.com': ['temu'],
    'etsy.com': ['etsy'],
    'shein.com': ['shein'],
    'qvc.com': ['qvc'],
    'hsn.com': ['hsn'],
    'marshalls.com': ['marshalls'],
    'overstock.com': ['overstock'],
    'ikea.com': ['ikea'],
    'kroger.com': ['kroger'],
    'safeway.com': ['safeway'],
    'albertsons.com': ['albertsons'],
    'publix.com': ['publix'],
    'aldi.us': ['aldi'],
    'shoprite.com': ['shoprite'],
    'wegmans.com': ['wegmans'],
    'giantfood.com': ['giant', 'giant food'],
    'instacart.com': ['instacart'],
    'thrivemarket.com': ['thrive market'],
    'gopuff.com': ['gopuff'],
    'dermstore.com': ['dermstore'],
    'glossier.com': ['glossier'],
    'fentybeauty.com': ['fenty', 'fenty beauty'],
    'clinique.com': ['clinique'],
    'harrys.com': ["harry's", 'harrys'],
    'dollarshaveclub.com': ['dollar shave club'],
    'vitacost.com': ['vitacost'],
    'gnc.com': ['gnc'],
    'iherb.com': ['iherb'],
    'grubhub.com': ['grubhub'],
    'pizzahut.com': ['pizza hut'],
    'chipotle.com': ['chipotle'],
    'tacobell.com': ['taco bell'],
    'wendys.com': ["wendy's", 'wendys'],
    'subway.com': ['subway'],
    'olivegarden.com': ['olive garden'],
    'shakeshack.com': ['shake shack'],
    'sweetgreen.com': ['sweetgreen'],
    'hellofresh.com': ['hellofresh', 'hello fresh'],
    'factor75.com': ['factor', 'factor meals'],
    'kayak.com': ['kayak'],
    'airbnb.com': ['airbnb'],
    'vrbo.com': ['vrbo'],
    'marriott.com': ['marriott', 'marriott bonvoy'],
    'hilton.com': ['hilton'],
    'hyatt.com': ['hyatt'],
    'southwest.com': ['southwest', 'southwest airlines'],
    'delta.com': ['delta', 'delta air lines'],
    'united.com': ['united', 'united airlines'],
    'jetblue.com': ['jetblue'],
    'hertz.com': ['hertz'],
    'enterprise.com': ['enterprise', 'enterprise rent-a-car'],
    'avis.com': ['avis'],
    'budget.com': ['budget', 'budget car rental'],
    'viator.com': ['viator'],
    'tripadvisor.com': ['tripadvisor'],
    'carnival.com': ['carnival', 'carnival cruise'],
    'royalcaribbean.com': ['royal caribbean'],
    'amtrak.com': ['amtrak'],
    'academy.com': ['academy', 'academy sports', 'academy sports + outdoors'],
    'basspro.com': ['bass pro', 'bass pro shops'],
    'cabelas.com': ["cabela's", 'cabelas'],
    'yeti.com': ['yeti'],
    'hydroflask.com': ['hydro flask'],
    'golfgalaxy.com': ['golf galaxy'],
    'backcountry.com': ['backcountry'],
    'fanatics.com': ['fanatics'],
    'carters.com': ["carter's", 'carters'],
    'mattel.com': ['mattel'],
    'melissaanddoug.com': ['melissa & doug', 'melissa and doug'],
    'potterybarnkids.com': ['pottery barn kids'],
    'petco.com': ['petco'],
    'petsmart.com': ['petsmart'],
    'barkbox.com': ['barkbox', 'bark box'],
    'shell.us': ['shell'],
    'exxon.com': ['exxon', 'exxonmobil', 'mobil'],
    'bp.com': ['bp'],
    'netflix.com': ['netflix'],
    'hulu.com': ['hulu'],
    'spotify.com': ['spotify'],
    'audible.com': ['audible'],
    'fandango.com': ['fandango']
  };

  var BRANDS = BRAND_ROWS.map(function (r) {
    var extra = r[4] || {};
    return {
      name: r[0], domain: r[1], cat: r[2], mcc: r[3],
      pseudo: !!extra.pseudo,
      url: extra.url || (extra.pseudo ? null : 'https://www.' + r[1].replace(/^www\./, '')),
      aliases: ALIASES[r[1]] || [r[0].toLowerCase()]
    };
  });
  // A few sites live on subdomains, so give them their real address.
  BRANDS.forEach(function (b) {
    if (/\.gap\.com$|\.tjx\.com$/.test(b.domain)) b.url = 'https://' + b.domain;
  });

  var BY_DOMAIN = {};
  var BY_NAME = {};
  BRANDS.forEach(function (b) {
    BY_DOMAIN[b.domain] = b;
    var names = [b.name].concat(b.aliases);
    names.forEach(function (n) { BY_NAME[normName(n)] = b; });
  });

  function normName(s) {
    return String(s || '').toLowerCase()
      .replace(/&amp;/g, '&').replace(/\band\b/g, '&')
      .replace(/\.(com|net|org|us)\b/g, '')
      .replace(/[^a-z0-9&+]/g, '');
  }

  /* ------------------------------------------------------------------ */
  /* Domains                                                             */
  /* ------------------------------------------------------------------ */

  var TWO_PART_TLDS = /^(co|com|org|net|gov|ac|edu)\.[a-z]{2}$/;

  function registrableDomain(host) {
    host = String(host || '').toLowerCase().replace(/^\.+|\.+$/g, '').replace(/:\d+$/, '');
    var parts = host.split('.');
    if (parts.length <= 2) return host;
    var lastTwo = parts.slice(-2).join('.');
    if (TWO_PART_TLDS.test(lastTwo)) return parts.slice(-3).join('.');
    return lastTwo;
  }

  // The key a store is filed under: a known store's own address when it lives
  // on a subdomain (Old Navy on oldnavy.gap.com), otherwise the main domain.
  function storeKey(hostOrUrl) {
    var host = String(hostOrUrl || '').toLowerCase();
    if (/^https?:\/\//.test(host)) {
      try { host = new URL(host).hostname; } catch (e) { host = host.replace(/^https?:\/\//, '').split('/')[0]; }
    }
    host = host.replace(/^www\d?\./, '').split('/')[0];
    var parts = host.split('.');
    for (var i = 0; i < parts.length - 1; i++) {
      var cand = parts.slice(i).join('.');
      if (BY_DOMAIN[cand]) return cand;
    }
    return registrableDomain(host);
  }

  function brandByDomain(domain) { return BY_DOMAIN[storeKey(domain)] || null; }
  function byDomainLookup(key) { return BY_DOMAIN[key] || null; }

  function brandByName(name) {
    var n = normName(name);
    if (!n) return null;
    if (BY_NAME[n]) return BY_NAME[n];
    // "Nike.com", "Target Online", "Costco Wholesale"
    var stripped = n.replace(/(online|store|stores|shop|usa|us|inc|outlet|wholesale|official)$/, '');
    if (stripped && BY_NAME[stripped]) return BY_NAME[stripped];
    return null;
  }

  function guessDomainFromName(name) {
    var b = brandByName(name);
    if (b) return { domain: b.domain, brand: b, guessed: false };
    var slug = String(name || '').toLowerCase().replace(/&/g, 'and').replace(/[^a-z0-9]+/g, '');
    if (!slug) return null;
    return { domain: slug + '.com', brand: null, guessed: true };
  }

  /* ------------------------------------------------------------------ */
  /* Small helpers                                                       */
  /* ------------------------------------------------------------------ */

  function hashStr(s) {
    var h = 5381;
    s = String(s || '');
    for (var i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) >>> 0;
    return h.toString(36);
  }

  function clean(s) {
    return String(s || '').replace(/\s+/g, ' ').trim();
  }

  function isoDay(d) {
    var dt = d instanceof Date ? d : new Date(d);
    if (isNaN(dt)) return null;
    return dt.toISOString().slice(0, 10);
  }

  function addDays(d, n) { return new Date((d instanceof Date ? d : new Date(d)).getTime() + n * DAY); }

  var MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  function fmtDay(iso) {
    if (!iso) return '';
    var p = String(iso).slice(0, 10).split('-');
    if (p.length < 3) return '';
    return MONTH_NAMES[+p[1] - 1] + ' ' + (+p[2]);
  }

  function money(n) {
    if (n == null || isNaN(n)) return '';
    var v = Math.round(n * 100) / 100;
    return '$' + (v % 1 === 0 ? v.toFixed(0) : v.toFixed(2));
  }

  function pctStr(n) {
    if (n == null || isNaN(n)) return '';
    var v = Math.round(n * 10) / 10;
    return (v % 1 === 0 ? v.toFixed(0) : v.toFixed(1)) + '%';
  }

  /* ------------------------------------------------------------------ */
  /* Dates in fine print                                                 */
  /* ------------------------------------------------------------------ */

  var MONTHS = { jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5, jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11 };
  var WEEKDAYS = { sun: 0, mon: 1, tue: 2, wed: 3, thu: 4, fri: 5, sat: 6 };
  var DATE_TOKEN = '((?:jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|june?|july?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\\.?\\s+\\d{1,2}(?:st|nd|rd|th)?(?:,?\\s*\\d{4})?|\\d{1,2}\\/\\d{1,2}(?:\\/\\d{2,4})?)';

  function utcDate(y, m, d) { return new Date(Date.UTC(y, m, d)); }

  function parseDateToken(tok, ref) {
    tok = clean(tok).toLowerCase();
    var y, m, d, explicitYear = false;
    var a = /^(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?$/.exec(tok);
    if (a) {
      m = +a[1] - 1; d = +a[2];
      if (a[3]) { y = +a[3]; if (y < 100) y += 2000; explicitYear = true; }
    } else {
      var b = /^([a-z]{3,9})\.?\s+(\d{1,2})(?:st|nd|rd|th)?(?:,?\s*(\d{4}))?$/.exec(tok);
      if (!b) return null;
      var mk = b[1].slice(0, 3);
      if (!(mk in MONTHS)) return null;
      m = MONTHS[mk]; d = +b[2];
      if (b[3]) { y = +b[3]; explicitYear = true; }
    }
    if (m < 0 || m > 11 || d < 1 || d > 31) return null;
    var refY = ref.getUTCFullYear();
    if (!explicitYear) {
      y = refY;
      var cand = utcDate(y, m, d);
      if (cand.getTime() < ref.getTime() - 45 * DAY) y += 1;
    }
    var out = utcDate(y, m, d);
    if (out.getUTCMonth() !== m) return null;
    return out;
  }

  function startOfDay(ref) { return utcDate(ref.getUTCFullYear(), ref.getUTCMonth(), ref.getUTCDate()); }

  function parseExpiry(text, refDate) {
    var ref = refDate ? new Date(refDate) : new Date();
    if (isNaN(ref)) ref = new Date();
    var t = String(text || '');
    var today = startOfDay(ref);
    var m;

    if (/\b(?:ends?|expires?|valid|good)\s+(?:today|tonight)\b|\btoday only\b|\bends at midnight\b|\blast day\b|\bone day only\b|\btonight only\b/i.test(t)) return isoDay(today);
    if (/\b(?:ends?|expires?)\s+tomorrow\b/i.test(t)) return isoDay(addDays(today, 1));

    m = /\b(?:ends?|expires?|through|thru|until|til)\s+(?:this\s+)?(sun|mon|tue|wed|thu|fri|sat)[a-z]*\b/i.exec(t);
    var weekdayGuess = null;
    if (m) {
      var target = WEEKDAYS[m[1].toLowerCase()];
      var diff = (target - today.getUTCDay() + 7) % 7;
      weekdayGuess = isoDay(addDays(today, diff));
    }

    // 10/1 - 10/31, 10/1/26 – 10/26/26
    m = /(\d{1,2}\/\d{1,2}(?:\/\d{2,4})?)\s*(?:-|–|—|to|through|thru)\s*(\d{1,2}\/\d{1,2}(?:\/\d{2,4})?)/i.exec(t);
    if (m) {
      var r2 = parseDateToken(m[2], ref);
      if (r2) return isoDay(r2);
    }
    // Oct 1 – Oct 31, 2026 / Oct 1–31
    var monthRange = new RegExp(DATE_TOKEN + '\\s*(?:-|–|—|to|through|thru)\\s*(' + DATE_TOKEN.slice(1, -1) + '|\\d{1,2}(?:,?\\s*\\d{4})?)', 'i');
    m = monthRange.exec(t);
    if (m) {
      var first = parseDateToken(m[1], ref);
      var second = m[2];
      var sd = null;
      if (/^\d{1,2}(?:,?\s*\d{4})?$/.test(clean(second)) && first) {
        var parts = /^(\d{1,2})(?:,?\s*(\d{4}))?$/.exec(clean(second));
        sd = utcDate(parts[2] ? +parts[2] : first.getUTCFullYear(), first.getUTCMonth(), +parts[1]);
      } else {
        sd = parseDateToken(second, ref);
      }
      if (sd && !isNaN(sd)) return isoDay(sd);
    }
    var kw = new RegExp('(?:\\bends?|\\bexpires?|\\bexpiring|\\bexp\\.?|valid\\s+(?:through|thru|until|till|to)|good\\s+(?:through|thru|until)|\\bthrough|\\bthru|\\buntil|\\btill|\\boffer ends|\\bsale ends|\\buse by|\\bredeem by|\\bvalid until)\\s*:?\\s*(?:on\\s+)?(?:(?:sun|mon|tue|tues|wed|thu|thur|thurs|fri|sat)[a-z]*\\.?,?\\s+)?' + DATE_TOKEN, 'i');
    m = kw.exec(t);
    if (m) {
      var dt = parseDateToken(m[1], ref);
      if (dt) return isoDay(dt);
    }
    return weekdayGuess;
  }

  /* ------------------------------------------------------------------ */
  /* Coupon codes                                                        */
  /* ------------------------------------------------------------------ */

  var CODE_STOP = {
    CODE: 1, CODES: 1, OFFER: 1, OFFERS: 1, SHIPPING: 1, CHECKOUT: 1, BELOW: 1, ABOVE: 1, HERE: 1, NEEDED: 1,
    REQUIRED: 1, APPLIED: 1, ONLINE: 1, STORE: 1, VALID: 1, PROMO: 1, COUPON: 1, DISCOUNT: 1, SAVE: 1, SALE: 1,
    FREE: 1, SHOP: 1, NOW: 1, TODAY: 1, ONLY: 1, AT: 1, WITH: 1, THE: 1, AND: 1, FOR: 1, YOUR: 1, ORDER: 1,
    ORDERS: 1, EXTRA: 1, DETAILS: 1, TERMS: 1, APPLY: 1, ENTER: 1, NONE: 1, NEEDS: 1, AUTOMATIC: 1, CART: 1,
    CLICK: 1, BUTTON: 1, CLIP: 1, REDEEM: 1, EMAIL: 1, SIGNUP: 1, MEMBERS: 1, MEMBER: 1, FIRST: 1, LIMIT: 1,
    THIS: 1, THAT: 1, WILL: 1, YOU: 1, GET: 1, INSTORE: 1, CODELESS: 1, EXCLUSIONS: 1, APPLIES: 1, HTTPS: 1,
    HTTP: 1, WWW: 1, NOTE: 1, ALSO: 1, PRICE: 1, OFF: 1, DEAL: 1, DEALS: 1
  };

  function validCode(tok, raw) {
    if (!tok) return false;
    var up = tok.toUpperCase();
    if (up.length < 4 || up.length > 20) return false;
    if (!/[A-Z]/.test(up)) return false;
    if (CODE_STOP[up]) return false;
    if (/^\d+(OFF|PCT)?$/.test(up) && up.length < 5) return false;
    if (/^(HTTP|WWW)/.test(up)) return false;
    // Lowercase words with no digits are ordinary words, not codes ("code below").
    if (raw && /[a-z]/.test(raw) && !/\d/.test(raw)) return false;
    return true;
  }

  function extractCodes(text) {
    var t = String(text || '');
    var out = [];
    var seen = {};
    function add(tok, raw) {
      tok = String(tok || '').replace(/^[-–]+|[-–.,;:!?)]+$/g, '');
      if (!validCode(tok, raw)) return;
      var up = tok.toUpperCase();
      if (seen[up]) return;
      seen[up] = 1;
      out.push(up);
    }
    var res = [
      /(?:use|enter|apply|with|w\/|redeem|using)\s+(?:the\s+)?(?:promo(?:tional)?\s+|coupon\s+|discount\s+|offer\s+|checkout\s+)?code\s*[:\-–]?\s*["“'‘]?([A-Za-z0-9][A-Za-z0-9-]{2,19})/gi,
      /(?:promo(?:tional)?|coupon|discount|offer|voucher)\s+code\s*[:\-–]?\s*(?:is\s+)?["“'‘]?([A-Za-z0-9][A-Za-z0-9-]{2,19})/gi,
      /\bcode\s*[:\-–]\s*["“'‘]?([A-Za-z0-9][A-Za-z0-9-]{2,19})/gi,
      /\bcode\s+["“'‘]([A-Za-z0-9][A-Za-z0-9-]{2,19})["”'’]/gi,
      /\bcode\s+([A-Z0-9][A-Z0-9-]{3,19})\b/g
    ];
    res.forEach(function (re) {
      var m;
      re.lastIndex = 0;
      while ((m = re.exec(t)) !== null) add(m[1], m[1]);
    });
    return out;
  }

  /* ------------------------------------------------------------------ */
  /* Reading the terms                                                   */
  /* ------------------------------------------------------------------ */

  function num(s) { return s == null ? null : parseFloat(String(s).replace(/,/g, '')); }

  function readValues(t) {
    var p = {};
    var m;
      // Free shipping (kept apart so its threshold isn't read as the coupon's minimum)
      var fs = /free\s+(?:standard\s+|ground\s+|2-day\s+)?shipping(?:\s+(?:on|for|with)\s+(?:all\s+)?(?:orders?|purchases?)?\s*(?:of\s+|over\s+|above\s+|\$)?\s*\$?\s?(\d{1,4})\s?\+?)?|ships?\s+free/i.exec(t);
      if (fs) { p.freeShip = true; if (fs[1]) p.freeShipMin = num(fs[1]); }
      var noShip = t.replace(/free\s+(?:standard\s+|ground\s+|2-day\s+)?shipping(?:\s+(?:on|for|with)\s+(?:all\s+)?(?:orders?|purchases?)?\s*(?:of\s+|over\s+|above\s+)?\s*\$?\s?\d{0,4}\s?\+?)?/gi, ' ');

      // Cash back (card offers, portals)
      m = /(?:up to\s+)?(\d{1,2}(?:\.\d+)?)\s?%\s*(?:cash\s*back|back\b|in rewards|in cash back|rewards\b)/i.exec(noShip);
      if (m) { p.cashPct = num(m[1]); if (/up to/i.test(m[0])) p.upTo = true; }
      m = /\$\s?(\d{1,4}(?:\.\d{2})?)\s*(?:cash\s*back|back\b|statement credit|in rewards)/i.exec(noShip);
      if (m) p.cashAmt = num(m[1]);

      // Percent off
      m = /(up to\s+|extra\s+|additional\s+|an extra\s+|an additional\s+)?(\d{1,2}(?:\.\d+)?)\s?%\s*(?:off|discount)/i.exec(noShip) ||
          /save\s+(up to\s+|an?\s+extra\s+|an?\s+additional\s+|extra\s+)?(\d{1,2}(?:\.\d+)?)\s?%/i.exec(noShip) ||
          /(extra\s+|additional\s+)(\d{1,2})\s?%/i.exec(noShip);
      if (m) {
        p.pct = num(m[2]);
        if (m[1] && /up to/i.test(m[1])) p.upTo = true;
        if (m[1] && /extra|additional/i.test(m[1])) p.extra = true;
        if (!p.upTo && /up to\s*$/i.test(noShip.slice(Math.max(0, m.index - 8), m.index))) p.upTo = true;
      }

      if (p.pct == null && /\bhalf[- ]off\b|\bhalf[- ]price\b/i.test(noShip)) p.pct = 50;
      // "30%-50% off": a range; the low end is what you can count on.
      var rg = /(\d{1,2})\s?%?\s*(?:-|–|to)\s*(\d{1,2})\s?%\s*off/i.exec(noShip);
      if (rg && num(rg[2]) > num(rg[1])) { p.pct = num(rg[1]); p.pctHigh = num(rg[2]); p.upTo = false; }
      // "Extra 10% off + 30% off sitewide": the two discounts stack.
      var st = /(\d{1,2})\s?%\s*off\s*(?:\+|\bplus\b|\band\b)\s*(?:an?\s+)?(?:extra\s+|additional\s+)?(\d{1,2})\s?%\s*off/i.exec(noShip);
      if (st && !/\bor\b/i.test(st[0])) {
        var a1 = num(st[1]), a2 = num(st[2]);
        p.pct = Math.round((1 - (1 - a1 / 100) * (1 - a2 / 100)) * 100);
        p.stackText = Math.max(a1, a2) + '% + extra ' + Math.min(a1, a2) + '% off';
        p.upTo = false;
      }
      var tiers = tiersIn(noShip);
      if (tiers.length >= 2) { p.tiers = tiers; p.amt = tiers[tiers.length - 1].amt; p.minSpend = tiers[0].min; }
      // Caps: "50% off, up to $15", "Max $30 back", "maximum of $10"
      m = /%[^.$]{0,40}?\bup to\s+\$\s?(\d{1,4})/i.exec(noShip) || /\bmax(?:imum)?\.?\s*(?:of\s*)?\$\s?(\d{1,4})(?:\.\d{2})?\s*(?:back|cash back|off|savings|discount|in rewards)?/i.exec(noShip) || /\bup to\s+\$\s?(\d{1,4})\s*(?:back|cash back|in rewards)/i.exec(noShip);
      if (m) p.cap = num(m[1]);
      // "off a drink", "off one item": a single item, not the whole order
      p.singleItem = /\boff\s+(?:a|an|one|any one|1|your next|a single)\s+(?!order\b|purchase\b|online order\b|qualifying order\b)[a-z]/i.test(noShip) || /\b(?:free|complimentary)\s+(?:drink|item|entree|appetizer|dessert|side|coffee|gift)\b/i.test(noShip);

      // Dollars off, and "$X off $Y"
      m = /\$\s?(\d{1,4}(?:\.\d{2})?)\s*off(?:\s+(?:your\s+|an?\s+|any\s+)?(?:(?:orders?|purchases?)\s+(?:of\s+|over\s+)?)?\$\s?(\d{1,4})\s?\+?)?/i.exec(noShip) ||
          /save\s+(?:up\s+to\s+|an\s+extra\s+|an\s+additional\s+|extra\s+)?\$\s?(\d{1,4}(?:\.\d{2})?)(?:\s+(?:on|when you spend|with)\s+(?:orders?\s+(?:of\s+)?)?\$\s?(\d{1,4}))?/i.exec(noShip) ||
          /\$\s?(\d{1,4})\s*(?:discount|savings|instant savings)/i.exec(noShip);
      if (m) {
        p.amt = num(m[1]);
        if (m[2]) p.minSpend = num(m[2]);
      }

      // Minimum spend
      if (p.minSpend == null) {
        m = /(?:orders?|purchases?)\s+(?:of\s+)?\$\s?(\d{1,4})\s?\+/i.exec(noShip) ||
            /(?:orders?|purchases?|subtotal)\s+(?:of\s+|over\s+|above\s+|totaling\s+|totalling\s+|exceeding\s+)\$\s?(\d{1,4})/i.exec(noShip) ||
            /(?:when|if)\s+you\s+spend\s+(?:at least\s+)?\$\s?(\d{1,4})/i.exec(noShip) ||
            /\bspend\s+(?:at least\s+)?\$\s?(\d{1,4})/i.exec(noShip) ||
            /(?:minimum|min\.?)\s+(?:purchase|order|spend|subtotal)?\s*(?:of\s+)?\$\s?(\d{1,4})/i.exec(noShip) ||
            /\bon\s+\$\s?(\d{1,4})\s?\+/i.exec(noShip) ||
            /\$\s?(\d{1,4})\s?\+\s*(?:orders?|purchases?|spend)/i.exec(noShip) ||
            /\$\s?(\d{1,4})\s+(?:or more|minimum)/i.exec(noShip) ||
            /(?:%|\boff)\s+\$\s?(\d{1,4})\s?\+/i.exec(noShip);
        if (m) p.minSpend = num(m[1]);
      }

    p.noShip = noShip;
    p.bogoV = /\bbogo\b|buy\s+(?:one|1|2|two),?\s+get\s+(?:one|1|2|two)/i.test(t);
    return p;
  }

  function parseTerms(title, terms, opts) {
    opts = opts || {};
    var full = clean((title || '') + ' . ' + (terms || ''));
    var t = full;
    var p = {};
    var m;

    // What the deal is worth comes from its own headline; the fine print is only used
    // when the headline doesn't say (fine print often mentions other offers too).
    var fromTitle = readValues(clean(title || ''));
    var hasV = fromTitle.pct || fromTitle.amt || fromTitle.cashPct || fromTitle.cashAmt || fromTitle.tiers || fromTitle.bogoV || fromTitle.freeShip;
    // For a code, only fine print that names the code can say what the code is worth.
    var tv = t;
    if (!hasV && opts.code && terms) {
      var hit = String(terms).split(/(?<=[.!?])\s+|\s+see (?:promo |offer )?details\b\s*/i).filter(function (x) { return x.toUpperCase().indexOf(opts.code) >= 0; });
      tv = clean((title || '') + ' . ' + hit.join(' '));
    }
    var vals = hasV ? fromTitle : readValues(tv);
    Object.keys(vals).forEach(function (k) { if (k !== 'noShip' && k !== 'bogoV') p[k] = vals[k]; });
    if (hasV && fromTitle.minSpend == null) {
      var more = readValues(t);
      if (more.minSpend != null && !fromTitle.tiers) p.minSpend = more.minSpend;
      if (!p.cap && more.cap) p.cap = more.cap;
      if (!p.freeShip && more.freeShip) { p.freeShip = true; p.freeShipMin = more.freeShipMin; }
    }
    var noShip = readValues(t).noShip;
    p.singleItem = !!(fromTitle.singleItem || (!hasV && vals.singleItem));

    p.bogo = /\bbogo\b|buy\s+(?:one|1),?\s+get\s+(?:one|1)/i.test(t);
    p.newCust = /\bnew\s+(?:customers?|members?|accounts?|subscribers?|users?|sign-?ups?)\b|first[- ](?:order|purchase|time|app order)|first\s+\w+\s+order/i.test(t);
    p.appOnly = /\b(?:in|via|on|through|using)\s+(?:the|our)\s+(?:\w+\s+)?app\b|\bapp[- ]only\b|\bapp[- ]exclusive\b|\bmobile app only\b|\bdownload (?:our|the) app\b|\bapp orders? only\b/i.test(t);
    p.inStore = /\bin[- ]stores?\s+only\b|\bvalid\s+(?:only\s+)?in[- ]stores?\b|\bin[- ]warehouse(?:s)?\s+only\b|\bwarehouse[- ]only\b|\bnot valid online\b/i.test(t);
    p.online = /\bonline\s+only\b|\bonline\s+exclusive\b|\bvalid\s+(?:only\s+)?online\b|\bonline\s+orders?\s+only\b|\bnot valid in[- ]stores?\b|\.com only\b/i.test(t);
    p.exclSale = /(?:excludes?|excluding|not\s+valid\s+on|not\s+applicable\s+to|exclusions?:?)[^.;]{0,50}\b(?:sale|clearance|markdowns?|discounted|reduced)\b|\bfull[- ]price\s+(?:items|merchandise)\s+only\b|\bregular[- ]price\b/i.test(t);
    p.members = /\b(?:rewards|loyalty|insider|club)\s+members?\b|\bmembers?\s+only\b|\bfor\s+members\b|\bmust\s+(?:be\s+)?(?:signed|logged)\s+in\b|\bsign\s+in\s+(?:to|required)\b|\bwith\s+(?:a|your)\s+(?:free\s+)?(?:account|membership)\b/i.test(t);
    p.onePer = /\bone\s+(?:use\s+)?per\s+(?:customer|household|account|person|member)\b|\bsingle[- ]use\b|\bone[- ]time\s+use\b|\blimit\s+(?:one|1)\s+per\b|\bvalid\s+for\s+one\s+(?:use|order|purchase)\b/i.test(t);
    p.select = /\b(?:on\s+)?select(?:ed)?\s+(?:items|styles|products|merchandise|brands|models|colors)\b|\bselect\s+\w+\s+(?:items|styles|products)\b/i.test(t);
    p.exclusions = /\bexclusions?\s+apply\b|\brestrictions?\s+apply\b|\bsome\s+exclusions\b|\bsee\s+(?:site|store)?\s*for\s+details\b/i.test(t);
    p.noStack = /\bcannot\s+be\s+combined\b|\bcan['’]?t\s+be\s+combined\b|\bnot\s+(?:valid|combinable)\s+with\s+(?:any\s+)?other\b|\bmay\s+not\s+be\s+combined\b|\bnot\s+stackable\b/i.test(t);
    p.verify = /\b(?:students?|military|veterans?|teachers?|nurses?|first responders?|healthcare workers?|medical professionals?|school staff|educators?|heroes|seniors?)\b/i.test(t) || /\bverif(?:y|ied|ication)\s+(?:with|through|via)\s+(?:id\.me|sheerid|unidays|student beans)/i.test(t);
    p.storeCard = /\bcard ?members?\b|\bcard ?holders?\b|\bopen (?:and use )?(?:a |your )?new (?:\w+ )?card\b|\bprequalif|\bstore card\b|\bwith your [\w.'’ ]{1,20}(?:credit )?card\b|\b(?:rewards|credit) card\b/i.test(t);
    p.scoped = !!p.pct && (/\bover\s+\d{1,2}\s?%|\d\s?%\s*off\s+or more|\bdeals? (?:up to|over)\b|\d{1,2}\s?%\s*-\s*\d{1,2}\s?%/i.test(noShip) ||
      /%\s*off\s+(?!(?:your\s+|the\s+|an?\s+)?(?:everything|sitewide|site-wide|orders?\b|purchases?\b|entire|almost everything|full[- ]price|regular[- ]price|all\s+(?:orders?|purchases?|items|products|merchandise|full[- ]price|regular[- ]price))|(?:with|w\/|when|for|on\s+(?:orders?|purchases?|your)|at checkout|\*|$|[.,!+(]))[a-z]/i.test(noShip) ||
      /\b(?:men['’]?s|women['’]?s|kids['’]?|boys['’]?|girls['’]?|youth|outlet|clearance|markdowns?)\b[^.]{0,30}\d{1,2}\s?%/i.test(noShip));
    var ev = /%\s*off\s+(?:almost\s+)?everything\s+([a-z]+)/i.exec(noShip);
    if (p.pct && ev && !/^(sitewide|online|includes|including|in|today|for|with|plus|and|on|at|but|except|\+)$/i.test(ev[1])) p.scoped = true;
    if (/\btrade-?in\b|\bmsrp\b|\bon sale for\s+\$|out of 5 stars/i.test(t)) p.singleItem = true;
    if (p.amt && !p.minSpend && p.amt >= 100 && !/\b(?:sitewide|everything|orders?|purchases?|cart)\b/i.test(t)) p.singleItem = true;
    p.signup = /\bsign\s+up\s+for\s+(?:our\s+)?(?:emails?|texts?|sms|newsletter)\b|\bwhen\s+you\s+(?:subscribe|sign\s+up|join)\b|\bjoin\s+(?:our\s+)?(?:email|text)\b/i.test(t);
    p.autoApply = /\bno\s+code\s+(?:needed|required|necessary)\b|\bapplied\s+(?:automatically|at\s+checkout)\b|\bdiscount\s+(?:shown|reflected)\s+(?:in\s+cart|at\s+checkout)\b|\bprices?\s+as\s+marked\b/i.test(t);

    var exp = opts.expires || parseExpiry(full, opts.refDate);
    if (exp) p.expires = exp;

    p.headline = valueLabel(p, title);
    if (!p.headline && opts.price) p.headline = money(opts.price) + ' deal';
    else if (opts.price && !p.pct && !p.amt && !p.cashPct && !p.cashAmt && !p.bogo) p.headline = money(opts.price) + ' deal';
    p.gist = buildGist(p, opts);
    p.bullets = buildBullets(p, opts);
    return p;
  }

  function valueLabel(p, title) {
    if (p.pctHigh) return (p.extra ? 'Extra ' : '') + p.pct + '–' + p.pctHigh + '% off';
    if (p.stackText) return p.stackText + ' (' + p.pct + '% total)';
    if (p.tiers && p.tiers.length >= 2) return money(p.tiers[0].amt) + '–' + money(p.tiers[p.tiers.length - 1].amt) + ' off';
    if (p.cashPct && (!p.pct || /back|reward/i.test(title || ''))) return (p.upTo ? 'Up to ' : '') + pctStr(p.cashPct) + ' back';
    if (p.cashAmt && !p.pct && !p.amt) return money(p.cashAmt) + ' back';
    if (p.pct) return (p.upTo ? 'Up to ' : p.extra ? 'Extra ' : '') + pctStr(p.pct) + ' off';
    if (p.amt) return money(p.amt) + ' off' + (p.minSpend ? ' ' + money(p.minSpend) + '+' : '');
    if (p.bogo) return 'Buy one, get one';
    if (p.freeShip) return 'Free shipping';
    if (/\bcode\b/i.test(title || '')) return 'Amount not stated';
    return '';
  }

  function buildGist(p, opts) {
    var parts = [];
    if (p.headline) parts.push(p.headline);
    if (p.tiers && p.tiers.length >= 2) parts.push(p.tiers.map(function (t) { return money(t.amt) + ' off ' + money(t.min); }).join(', '));
    else if (p.minSpend && !(p.amt && /\+$/.test(p.headline))) parts.push(money(p.minSpend) + ' min');
    if (p.newCust) parts.push('new customers');
    if (p.members) parts.push('members');
    if (p.appOnly) parts.push('app only');
    if (p.inStore) parts.push('in-store only');
    else if (p.online) parts.push('online only');
    if (p.exclSale) parts.push('excl. sale items');
    if (p.verify) parts.push('ID check');
    if (p.storeCard) parts.push("store's card");
    if (p.expires) parts.push('ends ' + fmtDay(p.expires));
    return parts.join(' · ');
  }

  function buildBullets(p, opts) {
    var b = [];
    var kind = opts.kind;
    var code = opts.code;
    if (kind === 'cardoffer') {
      var prog = PROGRAMS[opts.card] || null;
      b.push(prog ? prog.activate : 'Activate the offer in your card app first.');
      b.push(prog ? 'Pay with ' + prog.payWith + '.' : 'Pay with the card the offer is on.');
    } else if (kind === 'portal') {
      b.push('Start from Capital One Shopping so the purchase is tracked, and finish in that same tab.');
    } else if (code) {
      b.push('Enter code ' + code + ' at checkout.');
    } else if (p.autoApply || kind === 'sale') {
      b.push(opts.store === 'costco.com' ? 'No code needed. The discount comes off at the register or at checkout.' : 'No code needed. The discount shows in your cart or at checkout.');
    }
    if (p.tiers && p.tiers.length >= 2) b.push('The more you spend, the more you save: ' + p.tiers.map(function (t) { return money(t.amt) + ' off when you spend ' + money(t.min); }).join('; ') + '.');
    else if (p.minSpend) b.push('Spend at least ' + money(p.minSpend) + ' (usually before tax and shipping).');
    if (p.newCust) b.push('Only for new customers or your first order.');
    if (p.signup) b.push('You have to sign up for the store\'s emails or texts.');
    if (p.members) b.push('Sign in or be a rewards member.');
    if (p.verify) b.push('Needs a student, military or similar ID check.');
    if (p.storeCard) b.push("Needs the store's own credit card or loyalty card.");
    if (p.appOnly) b.push('Use the store\'s app.');
    if (p.inStore) b.push('Only works in the store.');
    else if (p.online) b.push('Only works online.');
    if (p.exclSale) b.push('Sale and clearance items don\'t count.');
    if (p.select) b.push('Only on certain items. Check which ones before you buy.');
    else if (p.exclusions) b.push('Some brands or items are excluded.');
    if (p.noStack) b.push('Can\'t be combined with other codes.');
    if (p.onePer) b.push('One use per customer.');
    if (p.bogo && kind !== 'cardoffer') b.push('Buy two qualifying items to get the deal.');
    if (p.freeShip && p.freeShipMin && !p.pct && !p.amt) b.push('Free shipping starts at ' + money(p.freeShipMin) + '.');
    if (p.expires) b.push('Use it by ' + fmtDay(p.expires) + '.');
    if (b.length === 0) b.push('No conditions were listed. Check the full terms before you buy.');
    return b.slice(0, 7);
  }

  /* ------------------------------------------------------------------ */
  /* Finding offers inside page text and emails                          */
  /* ------------------------------------------------------------------ */

  var ENTITY = { amp: '&', nbsp: ' ', quot: '"', apos: "'", lt: '<', gt: '>', rsquo: '’', lsquo: '‘', rdquo: '”', ldquo: '“', ndash: '–', mdash: '—', reg: '®', trade: '™', copy: '©', hellip: '…', bull: '•', middot: '·', eacute: 'é' };

  function decodeEntities(s) {
    return String(s || '').replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, function (all, e) {
      if (e[0] === '#') {
        var code = e[1] === 'x' || e[1] === 'X' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
        return isNaN(code) ? all : String.fromCharCode(code);
      }
      var v = ENTITY[e.toLowerCase()];
      return v == null ? all : v;
    });
  }

  function htmlToText(html) {
    var h = String(html || '');
    var extra = [];
    var mm;
    var metaRe = /<meta[^>]+(?:name|property)=["'](?:description|og:description)["'][^>]*content=["']([^"']{8,400})["']/gi;
    while ((mm = metaRe.exec(h)) !== null) extra.push(mm[1]);
    var altRe = /\s(?:alt|aria-label|title)=["']([^"']{6,200})["']/gi;
    while ((mm = altRe.exec(h)) !== null) {
      if (/%|\$\d|code|free shipping|bogo|sale|off/i.test(mm[1])) extra.push(mm[1]);
    }
    h = h.replace(/<(script|style|noscript|svg|template|iframe|head)\b[\s\S]*?<\/\1>/gi, ' ');
    h = h.replace(/<!--[\s\S]*?-->/g, ' ');
    h = h.replace(/<br\s*\/?>/gi, '\n');
    h = h.replace(/<\/(p|div|li|h[1-6]|section|article|header|footer|tr|td|th|a|button|span|strong|b|em|small|label|dd|dt|figcaption|aside|nav|main|ul|ol|table)\s*>/gi, '\n');
    h = h.replace(/<(p|div|li|h[1-6]|section|article|header|footer|tr|button|aside|nav|main|ul|ol|table)\b[^>]*>/gi, '\n');
    h = h.replace(/<[^>]+>/g, ' ');
    h = decodeEntities(h);
    var lines = (decodeEntities(extra.join('\n')) + '\n' + h).split(/\n/).map(clean).filter(Boolean);
    // Join lines a site split mid-sentence ("40%" / "off")
    var merged = [];
    for (var i = 0; i < lines.length; i++) {
      var ln = lines[i];
      if (merged.length && ln.length < 25 && /^(off|back|sitewide|everything|today|code|\+|orders?|with code)/i.test(ln)) {
        merged[merged.length - 1] += ' ' + ln;
      } else merged.push(ln);
    }
    return merged.join('\n');
  }

  var OFFER_RE = /(\d{1,2}(?:\.\d)?\s?%\s*off|\$\s?\d{1,4}(?:\.\d{2})?\s*off|\bpromo(?:tional)? code\b|\bcoupon code\b|\buse code\b|\bwith code\b|\bcode\s*:|\bbogo\b|buy (?:one|1),? get (?:one|1)|\bextra \d{1,2}\s?%|\bsave (?:up to )?\$?\d{1,4}%?|\d{1,2}\s?%\s*(?:back|cash back)|\bfree shipping\b)/i;
  var TILE_RE = /\bmsrp\b|\bon sale for\s+\$|out of 5 stars|\breviews?\b.*\bstars?\b|^\$\s?\d[\d,.]*\s+\$\s?\d|^\+\s/i;
  var BARE_RE = /^(?:up to\s+)?\d{1,2}\s?%\s*off[!.*]*$|^\$\s?\d{1,4}\s*off[!.*]*$/i;
  var JUNK_RE = /prequalif|\bmore to (?:earn|get|qualify)\b|away from free shipping|cookie|privacy|javascript|sign in to see|©|copyright|all rights reserved|terms of use|accessibility|we use|your browser|captcha|enable js|skip to|promo codes? and coupons|coupon codes? for|best deals on|save now with|apply for (?:a|the|our) .{0,20}card|credit card|financing|\bapr\b|paypal credit|klarna|afterpay|affirm/i;

  function extractOffersFromText(text, ctx) {
    ctx = ctx || {};
    var lines = String(text || '').split(/\n+/).map(clean).filter(function (l) { return l.length >= 6 && l.length <= 280; });
    var found = [];
    var seen = {};
    for (var i = 0; i < lines.length; i++) {
      var line = lines[i].replace(/^(?:showing\s+(?:slide|banner)\s+\d+\s+of\s+\d+\s*)/i, '').replace(/^(?:shop now|deals|new|sale)\s+(?=\d)/i, '');
      if (!OFFER_RE.test(line)) continue;
      if (TILE_RE.test(line) || BARE_RE.test(line)) continue;
      if (/\{\{|\}\}|":\s*"|","|\\[rn]|<\/?[a-z][^>]*>|replaceVariables/i.test(line)) continue;
      if (/\?\s*$/.test(line) && !/\b\d{1,2}\s?%\s*off\?\s*$/i.test(line)) continue;
      if (/^(?:or|and|plus|with|\+|,)\s/i.test(line)) continue;
      if (!/\d|free shipping|bogo|buy (?:one|1)/i.test(line)) continue;
      if (JUNK_RE.test(line)) continue;
      var parts = [line];
      for (var j = 1; j <= 2 && i + j < lines.length; j++) {
        var nx = lines[i + j];
        if (nx.length < 320 && /(\*|exclusions?|valid|offer|ends?\b|expires?|details|terms|code|apply|applies|online|in-store|minimum|orders?|through|thru|until)/i.test(nx) && !JUNK_RE.test(nx)) parts.push(nx);
        else break;
      }
      // FAQ answers ("Yes, enjoy 10% off") need the question above them.
      if (/^(yes|no)\b[,.!]?/i.test(line) && i > 0 && /\?\s*$/.test(lines[i - 1])) {
        line = lines[i - 1] + ' ' + line;
        parts[0] = line;
      }
      line = line.replace(/\s*(click here|shop now|learn more|see details|details|shop the sale|get the code)\.?\s*$/i, '');
      parts[0] = line;
      var termsText = parts.join(' ');
      var title = line.length > 150 ? line.slice(0, 147) + '…' : line;
      var key = normName(title).slice(0, 80);
      if (seen[key]) continue;
      seen[key] = 1;
      var code = extractCodes(termsText)[0] || null;
      var p = parseTerms(title, termsText, { refDate: ctx.refDate });
      var hasValue = p.pct || p.amt || p.bogo || p.cashPct || p.cashAmt || code;
      if (!hasValue && (!p.freeShip || line.length > 90)) continue;
      var strength = (code ? 40 : 0) + (p.pct || 0) * (p.scoped || p.upTo ? 0.5 : 1) + (p.amt ? Math.min(40, p.amt / 2) : 0) + (p.bogo ? 15 : 0) + (p.freeShip && !p.pct && !p.amt ? -20 : 0) + (p.cashPct || 0) - (p.storeCard ? 25 : 0) - (p.verify ? 10 : 0);
      found.push({ title: title, code: code, terms: termsText, strength: strength, item: !!p.singleItem });
    }
    // The same offer often appears in a banner and again in a menu; keep one.
    var byValue = {};
    found = found.filter(function (f) {
      var p2 = parseTerms(f.title, f.terms, { refDate: ctx.refDate });
      var k = (f.code || '') + '|' + (p2.headline || f.title) + '|' + (p2.scoped ? 's' : '') + (p2.minSpend || '');
      if (byValue[k]) return false;
      byValue[k] = 1;
      return true;
    });
    // A page full of codes is usually product tiles, each code for one product.
    var codeCount = found.filter(function (f) { return f.code; }).length;
    if (codeCount > 3) found.forEach(function (f) { if (f.code) f.item = true; });
    found.sort(function (a, b) { return b.strength - a.strength; });
    var hasReal = found.some(function (f) { return f.strength > 0; });
    if (hasReal) found = found.filter(function (f) { return f.strength > 0; });
    return found.slice(0, ctx.max || 6);
  }

  // Lists of card offers or cash-back rates, from a captured page or a screenshot.
  var VAL_RE = /(up to\s+)?(\d{1,2}(?:\.\d+)?)\s?%\s*(cash\s*back|back|in rewards|rewards|off)?|\$\s?(\d{1,4}(?:\.\d{2})?)\s*(cash\s*back|back|off|statement credit|bonus|in rewards)/i;
  var NOT_MERCHANT = /^(shop now|add to card|added|activate|activated|offer|offers|online|in-store|in store|new|ends?\b|expires?|details|see details|view details|terms|more|less|earn|get|up to|cash back|back|rewards|featured|popular|all offers|view all|show more|load more|sign in|limited time|exclusive|new offer|online & in-store|online only|in-store only|save|saved|use by|valid|redeem|enroll|enrolled|added to card|tap to activate|\d+ days? left|max\b|maximum)/i;

  function cleanMerchant(s) {
    s = clean(s).replace(/^(earn|get|enjoy|save)\s+/i, '').replace(/\s*[-–|:•·]+\s*$/, '').replace(/^\W+|\W+$/g, '');
    s = s.replace(/\b(cash ?back|offer|online|in-store|shop now|activate|new)\b/gi, '').replace(/\s+/g, ' ').trim();
    return s;
  }

  function parseOfferText(text) {
    var lines = String(text || '').split(/\n+/).map(clean).filter(Boolean);
    var out = [];
    var byKey = {};
    for (var i = 0; i < lines.length; i++) {
      var line = lines[i];
      var m = VAL_RE.exec(line);
      if (!m) continue;
      if (!/back|reward|off|credit|bonus|%/i.test(line)) continue;
      if (line.length > 140) continue;
      var pct = m[2] ? num(m[2]) : null;
      var amt = m[4] ? num(m[4]) : null;
      if (pct != null && (pct <= 0 || pct > 60)) continue;
      // Merchant: text before the value on the same line, else the nearest line above.
      var before = cleanMerchant(line.slice(0, m.index));
      var merchant = '';
      if (before && /[a-z]{2}/i.test(before) && before.length <= 40 && !NOT_MERCHANT.test(before)) merchant = before;
      if (!merchant) {
        var after = cleanMerchant(line.slice(m.index + m[0].length).replace(/^\s*(at|with|on|from)\s+/i, ''));
        if (after && /^(at|with|from)\s/i.test(line.slice(m.index + m[0].length).trim()) && after.length <= 40) merchant = after;
      }
      for (var k = 1; !merchant && k <= 3 && i - k >= 0; k++) {
        var prev = cleanMerchant(lines[i - k]);
        if (!prev || prev.length > 40 || VAL_RE.test(lines[i - k]) || NOT_MERCHANT.test(prev) || !/[a-z]{2}/i.test(prev)) continue;
        merchant = prev;
      }
      if (!merchant) continue;
      var raw = [line];
      for (var j = 1; j <= 2 && i + j < lines.length; j++) {
        if (/expires?|ends?|online|in-store|max|minimum|spend|new customers|days? left|valid|through|thru|until|first purchase|one time/i.test(lines[i + j]) && !VAL_RE.test(lines[i + j])) raw.push(lines[i + j]);
        else break;
      }
      var key = normName(merchant);
      if (!key) continue;
      var item = { merchant: merchant, pct: pct, amt: amt, upTo: !!m[1], kind: /off/i.test(m[3] || m[5] || '') ? 'off' : 'back', raw: raw.join(' · ') };
      var value = (pct || 0) + (amt ? amt / 5 : 0);
      if (byKey[key] == null) { byKey[key] = out.length; out.push(item); }
      else {
        var ex = out[byKey[key]];
        if (value > (ex.pct || 0) + (ex.amt ? ex.amt / 5 : 0)) out[byKey[key]] = item;
      }
    }
    return out;
  }

  // Costco member savings pages: "$4 OFF" lines with the product above.
  function parseCostcoText(text, refDate) {
    var lines = String(text || '').split(/\n+/).map(clean).filter(Boolean);
    var whole = lines.join(' ');
    var pageExp = parseExpiry(whole, refDate);
    var out = [];
    for (var i = 0; i < lines.length; i++) {
      var m = /\$\s?(\d{1,4}(?:\.\d{2})?)\s*off/i.exec(lines[i]);
      if (!m || lines[i].length > 120) continue;
      var item = '';
      var sameLine = clean(lines[i].replace(m[0], '').replace(/after|instant savings|savings|limit \d+/gi, ''));
      if (sameLine.length >= 8 && /[a-z]{3}/i.test(sameLine)) item = sameLine;
      for (var k = 1; !item && k <= 3 && i - k >= 0; k++) {
        var prev = lines[i - k];
        if (prev.length >= 6 && prev.length <= 140 && /[a-z]{3}/i.test(prev) && !/\$\s?\d/.test(prev) && !/limit|valid|while supplies|member|warehouse|online/i.test(prev)) item = prev;
      }
      if (!item) continue;
      var extra = [];
      for (var j = 1; j <= 2 && i + j < lines.length; j++) {
        if (/limit|valid|warehouse|online|while supplies|after|members?/i.test(lines[i + j]) && !/\$\s?\d+\s*off/i.test(lines[i + j])) extra.push(lines[i + j]);
      }
      out.push({ item: item, amt: num(m[1]), raw: [lines[i]].concat(extra).join(' · '), expires: pageExp });
    }
    return out;
  }

  // Every category a phrase touches ("running shoes" is clothing and sports).
  function categoriesIn(text) {
    var t = ' ' + String(text || '').toLowerCase() + ' ';
    return CATEGORIES.filter(function (c) {
      return c.kw.some(function (k) {
        return new RegExp('(^|[^a-z0-9])' + k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '($|[^a-z0-9])', 'i').test(t);
      });
    }).map(function (c) { return c.id; });
  }

  function classify(text, fallback) {
    var t = ' ' + String(text || '').toLowerCase() + ' ';
    var best = null;
    var bestScore = 0;
    CATEGORIES.forEach(function (c) {
      var s = 0;
      c.kw.forEach(function (k) {
        var re = new RegExp('(^|[^a-z0-9])' + k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '($|[^a-z0-9])', 'i');
        if (re.test(t)) s += k.length > 6 ? 2 : 1;
      });
      if (s > bestScore) { bestScore = s; best = c.id; }
    });
    if (bestScore >= 2 || (bestScore >= 1 && !fallback)) return best;
    return fallback || best || 'general';
  }

  /* ------------------------------------------------------------------ */
  /* Reading a whole web page: each deal together with what's around it */
  /* ------------------------------------------------------------------ */

  // A small, forgiving HTML reader. Nodes: { t: tag, a: attrs, c: children, p: parent }
  // and text nodes { t: '#', v: text, p: parent }. The Safari add-on builds the same
  // shape from the live page, so both read deals the same way.
  var VOID_TAGS = { area: 1, base: 1, br: 1, col: 1, embed: 1, hr: 1, img: 1, input: 1, link: 1, meta: 1, param: 1, source: 1, track: 1, wbr: 1 };
  var SKIP_TAGS = { script: 1, style: 1, noscript: 1, template: 1, svg: 1, iframe: 1, object: 1, canvas: 1, math: 1, select: 1 };
  var AUTO_CLOSE = { li: { li: 1 }, p: { p: 1 }, option: { option: 1 }, tr: { tr: 1, td: 1, th: 1 }, td: { td: 1, th: 1 }, th: { td: 1, th: 1 }, dt: { dt: 1, dd: 1 }, dd: { dt: 1, dd: 1 } };
  var BLOCK_TAGS = { address: 1, article: 1, aside: 1, blockquote: 1, dd: 1, details: 1, dialog: 1, div: 1, dl: 1, dt: 1, fieldset: 1, figcaption: 1, figure: 1, footer: 1, form: 1, h1: 1, h2: 1, h3: 1, h4: 1, h5: 1, h6: 1, header: 1, hgroup: 1, hr: 1, li: 1, main: 1, nav: 1, ol: 1, p: 1, pre: 1, section: 1, table: 1, tbody: 1, thead: 1, tfoot: 1, tr: 1, td: 1, th: 1, ul: 1, summary: 1, br: 1, button: 1, title: 1, body: 1, html: 1, '#root': 1 };
  var endTagRe = {};

  function parseAttrs(s) {
    var a = {};
    if (!s) return a;
    var re = /([^\s"'>\/=]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/g;
    var m;
    while ((m = re.exec(s)) !== null) {
      var k = m[1].toLowerCase();
      if (k in a) continue;
      var v = m[2] != null ? m[2] : m[3] != null ? m[3] : m[4] != null ? m[4] : '';
      a[k] = v.indexOf('&') >= 0 ? decodeEntities(v) : v;
    }
    return a;
  }

  function parseHTML(html) {
    html = String(html || '');
    var root = { t: '#root', a: {}, c: [], p: null };
    var stack = [root];
    var top = root;
    var ld = [];
    var re = /<!--[\s\S]*?-->|<!\[CDATA\[[\s\S]*?\]\]>|<![^>]*>|<\?[^>]*>|<(\/?)([a-zA-Z][\w:-]*)((?:[^>"']|"[^"]*"|'[^']*')*)>/g;
    var last = 0;
    var m;
    function addText(s) {
      if (!/\S/.test(s)) return;
      var v = clean(s.indexOf('&') >= 0 ? decodeEntities(s) : s);
      if (v) top.c.push({ t: '#', v: v, p: top });
    }
    while ((m = re.exec(html)) !== null) {
      if (m.index > last) addText(html.slice(last, m.index));
      last = re.lastIndex;
      if (!m[2]) continue;
      var tag = m[2].toLowerCase();
      if (m[1] === '/') {
        for (var i = stack.length - 1; i > 0 && i >= stack.length - 80; i--) {
          if (stack[i].t === tag) { stack.length = i; top = stack[i - 1]; break; }
        }
        continue;
      }
      var attrStr = m[3] || '';
      var selfClose = /\/\s*$/.test(attrStr);
      if (SKIP_TAGS[tag] && !selfClose) {
        var er = endTagRe[tag] || (endTagRe[tag] = new RegExp('</' + tag + '\\s*>', 'ig'));
        er.lastIndex = last;
        var em = er.exec(html);
        var end = em ? em.index : html.length;
        if (tag === 'script' && /ld\+json/i.test(attrStr)) ld.push(html.slice(last, end));
        last = em ? er.lastIndex : html.length;
        re.lastIndex = last;
        continue;
      }
      var ac = AUTO_CLOSE[tag];
      if (ac && ac[top.t] && stack.length > 1) { stack.pop(); top = stack[stack.length - 1]; }
      var node = { t: tag, a: parseAttrs(attrStr), c: [], p: top };
      top.c.push(node);
      if (!VOID_TAGS[tag] && !selfClose) { stack.push(node); top = node; }
    }
    if (last < html.length) addText(html.slice(last));
    root.ld = ld;
    return root;
  }

  function walk(n, fn) {
    var st = [n];
    while (st.length) {
      var x = st.pop();
      if (fn(x) === false) continue;
      if (x.c) for (var i = x.c.length - 1; i >= 0; i--) st.push(x.c[i]);
    }
  }

  function textLen(n) {
    if (n._len != null) return n._len;
    if (n.t === '#') return (n._len = n.v.length + 1);
    var s = 0;
    for (var i = 0; i < n.c.length; i++) s += textLen(n.c[i]);
    return (n._len = s);
  }

  // Text with a line break between blocks.
  function nodeText(n, max) {
    var out = [];
    var size = 0;
    max = max || 20000;
    (function rec(x) {
      if (size > max) return;
      if (x.t === '#') { out.push(x.v); size += x.v.length; return; }
      if (x.t === 'img') return;
      var block = BLOCK_TAGS[x.t];
      if (block) out.push('\n');
      for (var i = 0; i < x.c.length; i++) rec(x.c[i]);
      if (block) out.push('\n');
    })(n);
    return out.join(' ').replace(/[ \t]*\n[ \t\n]*/g, '\n').replace(/ {2,}/g, ' ').trim();
  }
  function lineText(n, max) { return clean(nodeText(n, max).replace(/\n+/g, ' · ')).replace(/(?: · )+/g, ' · '); }

  function cls(n) { return n.a ? ((n.a['class'] || '') + ' ' + (n.a.id || '') + ' ' + (n.a['data-testid'] || '') + ' ' + (n.a.itemprop || '') + ' ' + (n.a['data-qa'] || '')).toLowerCase() : ''; }

  function absUrl(href, base) {
    if (!href) return null;
    href = String(href).trim();
    if (/^(javascript:|mailto:|tel:|data:|#$)/i.test(href)) return null;
    try { return new URL(href, base).toString(); } catch (e) { return null; }
  }

  function sameStore(url, domain) {
    try { return storeKey(new URL(url).hostname) === domain || registrableDomain(new URL(url).hostname) === registrableDomain(domain); } catch (e) { return false; }
  }

  function imgSrc(n, base) {
    var a = n.a || {};
    var src = a['data-src'] || a['data-original'] || a['data-lazy-src'] || a.src || '';
    if ((!src || /^data:/.test(src)) && (a.srcset || a['data-srcset'])) src = String(a.srcset || a['data-srcset']).split(',')[0].trim().split(/\s+/)[0];
    if (!src || /^data:/.test(src) || /\.svg(\?|$)/i.test(src) || /spacer|blank|pixel|placeholder|1x1/i.test(src)) return null;
    return absUrl(src, base);
  }

  var USD_RE = /\$\s?(\d{1,3}(?:,\d{3})+|\d{1,6})(\.\d{2})?/g;
  function amounts(text) {
    var out = [];
    var m;
    text = String(text || '').replace(/\$\s+(\d)/g, '$$$1').replace(/(\$\d[\d,]*)\s+\.(\d{2})\b/g, '$1.$2');
    USD_RE.lastIndex = 0;
    while ((m = USD_RE.exec(text)) !== null) {
      var before = text.slice(Math.max(0, m.index - 14), m.index).toLowerCase();
      var after = text.slice(USD_RE.lastIndex, USD_RE.lastIndex + 14).toLowerCase();
      out.push({ v: parseFloat((m[1] + (m[2] || '')).replace(/,/g, '')), off: /^\s*(off|back|in savings|savings|credit|reward)/.test(after) || /(save|savings|you save|saved|save up to|combo offer|offer|bonus|rebate|credit|reward|rewards|coupon|promo|discount|instant savings|gift card|get|extra|plus|\+|-)\s*$/.test(before), idx: m.index });
    }
    return out;
  }

  var STRIKE_CLS = /(line-?through|strike|\bwas\b|was-?price|original|compare|regular|list-?price|old-?price|msrp|price-?(?:old|before|reg|was|list)|crossed|retail|\breg\b|full-?price|price--?standard|price-?standard|strikethrough)/;
  var NAME_CLS = /(?:^|[\s_-])(?:product|item|tile|card|goods|game|app|prod)?[-_]?(?:name|title)(?:$|[\s_-])|\bheading\b|pdp-link/;

  function isStrike(n) {
    if (n.t === 's' || n.t === 'del' || n.t === 'strike') return true;
    var c = cls(n);
    if (c && STRIKE_CLS.test(c) && !/(save|savings|off|percent|badge|discount-?pct|discount_pct)/.test(c)) return true;
    var st = n.a && n.a.style;
    return !!(st && /line-through/i.test(st));
  }

  var STOCK_OUT = /\b(out of stock|sold out|unavailable|notify me|no longer available|coming soon)\b/i;
  var STOCK_LOW = /\b(only \d+ left|low stock|almost gone|selling fast|limited stock|last chance)\b/i;
  var PRODUCT_HREF = /\/(p|product|products|dp|ip|item|items|app|pd|prod|buy|shop\/p|sku|gp\/product)\/|\.html?(\?|$)|[?&](sku|pid|productid|product_id)=|\/\d{5,}(\/|$|\?)/i;

  function cleanName(s) {
    s = clean(s)
      .replace(/\$\s?\d[\d,]*(\.\d{2})?(\s*(off|-|–|to)\s*\$\s?\d[\d,]*(\.\d{2})?)?/g, ' ')
      .replace(/-?\d{1,2}\s?%\s*(off)?/gi, ' ')
      .replace(/\b(sale|new|on sale|clearance|was|now|reg\.?|regular price|sale price|original price|price|save|limited time|best seller|bestseller|online only|exclusive|add to (cart|bag)|quick (view|add)|compare|choose options|select options|\d(\.\d)? out of 5 stars?|\(\d[\d,]*\)|rated [\d.]+ out of 5)\b/gi, ' ')
      .replace(/\s*[|·•]\s*/g, ' ').replace(/\s+,/g, ',').replace(/\s{2,}/g, ' ').replace(/^[\s,.:;\-–]+|[\s,.:;\-–]+$/g, '');
    // Star ratings and "Starting at" tails ("Photo Book 4.54 ( 19493 ) Starting at")
    s = s.replace(/\s+\d(?:\.\d{1,2})?\s*\(\s*[\d,]+\s*\).*$/, '').replace(/\s+\(\s*[\d,]+\s*\)\s*$/, '').replace(/\s+(?:starting at|starts at|from|as low as)\s*$/i, '').trim();
    return s;
  }

  function nameIn(card, base) {
    var best = null;
    var bestRank = 9;
    var alt = null;
    walk(card, function (n) { if (!alt && n.t === 'img') { var a = cleanName(n.a.alt || n.a.title || ''); if (a.length >= 12 && a.length <= 160) alt = a; } });
    walk(card, function (n) {
      if (n.t === '#') return;
      var rank = 9;
      var txt = null;
      if (/^h[1-6]$/.test(n.t)) rank = 2;
      else if (NAME_CLS.test(cls(n)) && !/(price|badge|rating|review|swatch|label-?sale|promo|section-?title|section-?header|module-?title|carousel-?title|shelf-?title|row-?title|tab-?title)/.test(cls(n))) rank = 1;
      else if (n.t === 'a') rank = 3;
      else if (n.t === 'img') { rank = 4; txt = n.a.alt || n.a.title || ''; }
      if (rank < 9 && rank < bestRank) {
        if (txt == null) txt = lineText(n, 400);
        txt = cleanName(txt);
        var junk = /^(?:full|half|empty|filled) stars?$|^\d(?:\.\d)?\s*(?:out of 5\s*)?stars?\b|^rated\b|^(?:\d+ )?reviews?$/i.test(txt) || /[.!?]\*?\s+[A-Z]/.test(txt) || /^(?:our|get|spend|unlock|enjoy|discover|introducing|meet|new!|join|sign|free shipping)\b/i.test(txt) || /\bwith (?:any|every|your) (?:order|purchase)\b|\bfree (?:standard )?shipping\b/i.test(txt) || /^\(|^(?:lowest|newegg select|sponsored|shell shocker|best seller|bestseller|top rated|see all|featured|hot|deal|special offer|limited time|sold by|ships from|free shipping|in stock|out of stock|(?:all |special |exclusive |current )?offers?$|(?:all )?promotions?$|(?:all )?deals?$|gifts? with purchase$)\b/i.test(txt) || (txt.length < 14 && rank < 4 && !/\s/.test(txt) && /^[A-Z]/.test(txt) === false);
        if (!junk && txt.length >= 4 && txt.length <= (rank >= 3 ? 110 : 160) && /[a-z]{2}/i.test(txt) && !/^(shop|view|see|buy|add|details|more|quick|compare)\b/i.test(txt)) { best = txt; bestRank = rank; }
      }
      if (n.t === 'a' && n.a['aria-label'] && rank > 3 && bestRank > 3) {
        var al = cleanName(n.a['aria-label']);
        if (al.length >= 4 && al.length <= 160 && !/^(shop|view|see|add)/i.test(al)) { best = al; bestRank = 3.5; }
      }
    });
    if (alt && (!best || (best.length < 14 && alt.toLowerCase().indexOf(best.toLowerCase()) < 0 && bestRank >= 1))) return alt;
    return best;
  }

  function linkIn(card, base, domain, name) {
    var links = [];
    if (card.t === 'a' && card.a.href) links.push(card);
    var up = card.p;
    for (var k = 0; k < 2 && up; k++, up = up.p) if (up.t === 'a' && up.a.href) links.push(up);
    walk(card, function (n) { if (n.t === 'a' && n.a.href) links.push(n); });
    var best = null;
    var bestScore = -1;
    links.forEach(function (l) {
      var u = absUrl(l.a.href, base);
      if (!u) return;
      var s = 0;
      if (PRODUCT_HREF.test(u)) s += 3;
      if (domain && sameStore(u, domain)) s += 2;
      var t = lineText(l, 300);
      if (name && t && t.indexOf(name.slice(0, 20)) >= 0) s += 2;
      if (/review|#|login|account|wishlist|compare/i.test(u)) s -= 3;
      if (s > bestScore) { bestScore = s; best = u; }
    });
    return best;
  }

  // Product tiles: a struck-through "regular" price next to a lower price, a name and a link.
  function findProducts(root, base, domain) {
    var out = [];
    var seen = {};
    var strikes = [];
    walk(root, function (n) {
      if (n.t === '#') return;
      if (n.t === 'head') return false;
      if (n._card) return false;
      if (isStrike(n)) {
        var tx = lineText(n, 200);
        if (/\$\s?\d/.test(tx)) strikes.push(n);
        return false;
      }
    });
    strikes.forEach(function (s) {
      var card = s;
      var found = null;
      for (var k = 0; k < 12 && card.p; k++) {
        card = card.p;
        var len = textLen(card);
        if (len > 900) break;
        var txt = lineText(card, 1200);
        var prices = amounts(txt).filter(function (x) { return !x.off; });
        var distinct = {};
        prices.forEach(function (x) { distinct[x.v] = 1; });
        var nd = Object.keys(distinct).length;
        if (nd > 8) break;
        if (nd >= 2) {
          var hasLink = card.t === 'a' || (card.p && card.p.t === 'a');
          if (!hasLink) walk(card, function (x) { if (x.t === 'a' && x.a.href) { hasLink = true; return false; } });
          if (hasLink && (textLen(card) > 25)) { found = card; if (nameIn(card, base)) break; }
        }
      }
      if (!found || found._card) return;
      if (/\bbogo\b|buy (?:1|one|2|two),? get (?:1|one)|\b\d for \$\d/i.test(lineText(found, 600))) { found._card = true; return; }
      var nameFirst = nameIn(found, base);
      // Widen to the whole tile (image, badges) while no other product's prices come in.
      var own = {};
      amounts(lineText(found, 1500)).forEach(function (x) { own[x.v] = 1; });
      var tile = found;
      for (var w = 0; w < 6 && tile.p && tile.p.t !== 'body' && tile.p.t !== '#root'; w++) {
        var upn = tile.p;
        if (textLen(upn) > 1100 || upn._card) break;
        var extra = amounts(lineText(upn, 1600)).filter(function (x) { return !x.off && !own[x.v]; });
        if (extra.length) break;
        var otherCard = false;
        walk(upn, function (y) { if (y !== tile && y._card) { otherCard = true; return false; } });
        if (otherCard) break;
        tile = upn;
      }
      if (tile._card) return;
      found = tile;
      var text = lineText(found, 1500);
      var name = nameFirst || nameIn(found, base);
      if (!name) return;
      var lines = nodeText(found, 1500).split('\n').map(clean).filter(Boolean);
      var ni = lines.findIndex(function (l) { return cleanName(l) === name || l === name; });
      var sub = ni >= 0 && lines[ni + 1] && lines[ni + 1].length <= 70 && !/[$%]|\d\s?off|^(special offer|gift with purchase|add to|buy now|sale|new|limited|sold out|out of stock|notify me|\d)/i.test(lines[ni + 1]) && cleanName(lines[ni + 1]).length > 3 ? cleanName(lines[ni + 1]) : null;
      if (sub && sub.toLowerCase() !== name.toLowerCase() && name.length < 60) name = name + ' (' + sub + ')';
      var badge = null;
      walk(found, function (y) {
        if (badge || y.t === '#') return;
        var lab = (y.a && (y.a['aria-label'] || '')) + ' ' + (y.t !== '#' && textLen(y) < 40 ? lineText(y, 60) : '');
        var m = /(gift with purchase|free gift|special offer|bundle (?:&|and) save|bonus|bogo|buy more,? save more|limited[- ]time deal|deal of the day|clearance|lowest price)/i.exec(lab);
        if (m) {
          var detail = y.a && y.a.title ? clean(nodeText(parseHTML(decodeEntities(y.a.title)), 400)) : '';
          badge = capFirst(m[1].toLowerCase()) + (detail ? ': ' + detail.replace(/^[\s*]+/, '').slice(0, 220) : '');
          return false;
        }
      });
      var regs = amounts(lineText(s, 200)).filter(function (x) { return !x.off; }).map(function (x) { return x.v; });
      var strikeVals = {};
      walk(found, function (x) { if (x !== s && x.t !== '#' && isStrike(x)) { amounts(lineText(x, 200)).forEach(function (y) { if (!y.off) strikeVals[y.v] = 1; }); return false; } });
      regs.forEach(function (v) { strikeVals[v] = 1; });
      var all = amounts(text.split(name).join(' ')).filter(function (x) { return !x.off; });
      var sale = all.map(function (x) { return x.v; }).filter(function (v) { return !strikeVals[v] && v > 0; });
      var was = Object.keys(strikeVals).map(Number);
      if (!sale.length || !was.length) return;
      var price = Math.min.apply(null, sale);
      var regular = Math.max.apply(null, was);
      if (!(regular > price) || price <= 0 || price / regular < 0.15) return;
      var url = linkIn(found, base, domain, name);
      if (!url) return;
      var key = url.split('#')[0] + '|' + name;
      found._card = true;
      if (seen[key]) return;
      seen[key] = 1;
      walk(found, function (y) { if (y !== found && y.t !== '#') y._in = true; });
      var img = null;
      walk(found, function (x) { if (!img && x.t === 'img') { img = imgSrc(x, base); if (img) return false; } });
      var stock = STOCK_OUT.test(text) ? 'out' : STOCK_LOW.test(text) ? 'low' : null;
      var ends = parseExpiry(text);
      out.push({ name: name.slice(0, 160), url: url, price: price, was: regular, pct: Math.round((1 - price / regular) * 100), img: img, stock: stock, badge: badge, from: sale.length > 1 && /\bfrom\b|\bstarting\b|–|-\s*\$/.test(text), text: text.slice(0, 400), expires: ends });
    });
    return out;
  }

  // Products described in a page's structured data (schema.org).
  function productsFromLd(root, base) {
    var out = [];
    (root.ld || []).forEach(function (raw) {
      var data;
      try { data = JSON.parse(raw.trim()); } catch (e) { return; }
      var stack = [data];
      var guard = 0;
      while (stack.length && guard++ < 3000) {
        var x = stack.pop();
        if (!x || typeof x !== 'object') continue;
        if (Array.isArray(x)) { x.forEach(function (y) { stack.push(y); }); continue; }
        var type = [].concat(x['@type'] || []).join(' ');
        if (/Product/.test(type) && x.name) {
          var offers = [].concat(x.offers || []);
          offers.forEach(function (o) {
            if (!o || typeof o !== 'object') return;
            var price = parseFloat(o.price || o.lowPrice);
            var was = null;
            [].concat(o.priceSpecification || []).forEach(function (ps) {
              if (ps && /ListPrice|StrikethroughPrice|MSRP/i.test(String(ps.priceType || ''))) was = parseFloat(ps.price);
            });
            if (o.highPrice && !was && /AggregateOffer/.test([].concat(o['@type'] || []).join(''))) was = null;
            if (!(price > 0 && was > price)) return;
            if (o.priceCurrency && o.priceCurrency !== 'USD') return;
            var img = [].concat(x.image || [])[0];
            if (img && typeof img === 'object') img = img.url;
            out.push({
              name: clean(String(x.name)).slice(0, 160), url: absUrl(o.url || x.url || base, base), price: price, was: was,
              pct: Math.round((1 - price / was) * 100), img: img ? absUrl(String(img), base) : null,
              stock: /OutOfStock|SoldOut|Discontinued/i.test(String(o.availability || '')) ? 'out' : null,
              expires: o.priceValidUntil ? isoDay(o.priceValidUntil) : null, text: ''
            });
          });
        }
        for (var k in x) if (x[k] && typeof x[k] === 'object') stack.push(x[k]);
      }
    });
    return out;
  }

  /* Promotions: the value line, plus the banner or box it sits in. */

  var SEED_RE = /\d{1,2}(?:\.\d)?\s?%\s*(?:off|back)\b|\$\s?\d[\d,]*(?:\.\d{2})?\s*off\b|\b(?:promo|coupon|discount|offer)\s+code\b|\buse code\b|\bwith code\b|\bw\/\s*code\b|\bcode\s*:\s*[A-Z0-9]|\bbogo\b|\bbuy (?:one|1|2|two),? get\b|\bextra \d{1,2}\s?%|\bsave (?:up to |an extra |extra |an additional )?(?:\$\s?\d|\d{1,2}\s?%)|\bspend \$\s?\d[\d,]*[^.]{0,12}\b(?:get|save)\b|\bfree (?:standard |ground )?shipping (?:on|with|for) (?:orders?|purchases?|all|any|\$)|\bhalf[- ]off\b|\btake (?:an extra |an additional )?\d{1,2}\s?%/i;
  var JUNK_LINE = /\brebate\b|^(?:limit|offer valid|valid on|valid through|terms|excludes|exclusions|not valid|while supplies)\b.{40,}|cookie|privacy policy|javascript|©|copyright|all rights reserved|terms of use|accessibility|your browser|captcha|skip to|prequalif|credit card|apply now|apr\b|financing|paypal credit|klarna|afterpay|affirm|\bloan\b|refer a friend|give \$?\d+%?,? get|commission|gift card balance|away from free shipping|more to (?:earn|get|qualify)/i;
  var CTA_RE = /^(?:shop|buy|see|view|browse|explore|get|discover|find|claim|unlock|start|book|order|grab|save)\b|^learn more$|^details$/i;
  var TERMS_LINK = /terms|details|exclusions?|restrictions?|conditions|fine print|disclaimer|see (?:offer|promo)|offer details/i;

  function isNavLike(n) {
    for (var k = 0, x = n; x && k < 30; k++, x = x.p) {
      if (x.t === 'nav' || x.t === 'footer') return x.t;
      var c = cls(x);
      if (/(^|\s|-)(nav|menu|megamenu|footer|breadcrumb)(\s|-|$|__)/.test(c) && !/promo|banner|offer|announcement/.test(c)) return 'nav';
    }
    return null;
  }

  function inCard(n) { for (var x = n; x; x = x.p) if (x._card) return x; return null; }

  // A product tile around a deal line: picture, price and a product link close together.
  function tileOf(n, base) {
    var c = inCard(n);
    if (c) return c;
    var x = n;
    for (var k = 0; k < 6 && x.p; k++) {
      x = x.p;
      var len = textLen(x);
      if (len > 600) return null;
      var hasImg = false, hasProd = false, hasLink = false, priceCls = false;
      walk(x, function (y) {
        if (y.t === 'img' && imgSrc(y, base)) hasImg = true;
        if (y.t === 'a' && y.a.href) { hasLink = true; if (PRODUCT_HREF.test(y.a.href)) hasProd = true; }
        if (y.t !== '#' && /(?:^|[\s_-])price/.test(cls(y))) priceCls = true;
      });
      hasProd = hasProd || (hasLink && priceCls && len < 450);
      if (hasImg && hasProd && amounts(lineText(x, 700)).some(function (a) { return !a.off; })) return x;
    }
    return null;
  }

  function lineOf(n) {
    // The smallest block around a seed that reads as one sentence or headline:
    // climb past bare values ("40% OFF") to reach the words that go with them.
    var x = n.t === '#' ? n.p : n;
    var best = x;
    for (var k = 0; k < 7 && x; k++) {
      if (textLen(x) > 240) break;
      best = x;
      var t = lineText(x, 300);
      var words = t.replace(/\d{1,2}(?:\.\d)?\s?%|\$\s?\d[\d,]*(?:\.\d{2})?|\b(?:up to|off|extra|save|take|get|an|additional|now|only|plus|code|back|bogo|buy|free|\d)\b|[^a-z]/gi, '');
      if (words.length >= 8 && textLen(x) >= 18 && (BLOCK_TAGS[x.t] || x.t === 'a') && !(x.p && !BLOCK_TAGS[x.t] && textLen(x.p) <= 240 && /^(?:span|strong|b|em|i|small|sup|a|font|u|mark)$/.test(x.t) && x.p.c.length > 1)) break;
      x = x.p;
    }
    return best;
  }

  function containerOf(n) {
    var x = n;
    var best = n;
    for (var k = 0; k < 14 && x.p; k++) {
      var up = x.p;
      if (up.t === 'body' || up.t === '#root' || up.t === 'html' || up.t === 'main') break;
      if (textLen(up) > 750) break;
      var hasCard = false;
      walk(up, function (y) { if (y._card) { hasCard = true; return false; } });
      if (hasCard) break;
      best = up;
      x = up;
    }
    return best;
  }

  // The heading closest above the deal's line inside its box (or the first one after it).
  function headingIn(c, line, lineNode) {
    var before = null;
    var after = null;
    var pos = lineNode ? lineNode._o : -1;
    walk(c, function (n) {
      if (n.t === '#') return;
      if (/^h[1-6]$/.test(n.t) || /(heading|headline|eyebrow|\btitle\b|-title|title-)/.test(cls(n))) {
        var t = lineText(n, 300);
        if (t && t.length >= 3 && t.length <= 160 && t !== line && !(lineNode && (n === lineNode || isInside(lineNode, n) || isInside(n, lineNode))) && (!lineNode || closeTogether(n, lineNode, 380))) {
          if (n._o < pos) before = t;
          else if (!after) after = t;
        }
        return false;
      }
    });
    return before || after;
  }
  function isInside(a, b) { for (var x = a; x; x = x.p) if (x === b) return true; return false; }
  function closeTogether(a, b, maxLen) {
    var anc = [];
    for (var x = a; x; x = x.p) anc.push(x);
    for (var y = b; y; y = y.p) if (anc.indexOf(y) >= 0) return textLen(y) <= maxLen;
    return false;
  }

  function linksIn(c, base) {
    var out = [];
    var x = c;
    for (var k = 0; k < 3 && x; k++, x = x.p) if (x.t === 'a' && x.a.href) { out.push(x); break; }
    walk(c, function (n) { if (n.t === 'a' && n.a.href) out.push(n); });
    return out.map(function (a) {
      return { url: absUrl(a.a.href, base), label: clean(lineText(a, 200) || a.a['aria-label'] || a.a.title || ''), aria: a.a['aria-label'] || '', o: a._o || 0 };
    }).filter(function (l) { return l.url; });
  }

  var FOOT_START = /^\s*(\*{1,4}|†{1,3}|‡{1,2}|[¹²³⁴⁵⁶⁷⁸⁹]|\(\d\)|\d\s?\)|offer valid|offer ends|valid (?:through|thru|until|on|for)|exclusions?\b|excludes?\b|not valid|limited time offer|promotion (?:valid|ends)|terms)/i;

  // Fine print blocks on the page ("*Offer valid 10/1–10/21. Excludes…").
  function footnotesIn(root) {
    var out = [];
    var seen = {};
    walk(root, function (n) {
      if (n.t === '#' || n.t === 'head') return n.t === 'head' ? false : undefined;
      var len = textLen(n);
      if (len < 30 || len > 4000) return;
      var c = cls(n);
      var byClass = /(disclaimer|fine-?print|legal|terms|footnote|offer-?details|exclusion|asterisk|promo-?details|details-?copy)/.test(c);
      if (!byClass && !(BLOCK_TAGS[n.t] && textLen(n) < 1500)) return;
      var t = nodeText(n, 4000);
      if (!byClass && !FOOT_START.test(t)) return;
      if (!/valid|exclu|offer|promotion|purchase|order|code|expires|ends|discount|terms|while supplies|applies|eligible/i.test(t)) return;
      if ((t.match(/\$\s?\d/g) || []).length >= 3 && !/exclu|valid|terms|restrictions/i.test(t)) return;
      var key = t.slice(0, 120);
      if (seen[key]) return false;
      seen[key] = 1;
      out.push({ node: n, text: t.slice(0, 3000), marks: (/^\s*(\*{1,4}|†{1,3}|‡{1,2})/.exec(t) || [])[1] || null });
      return false;
    });
    return out;
  }

  // What a promotion covers, read from its own words.
  var ORDER_WORDS = /\b(sitewide|site-?wide|storewide|everything|entire (?:order|purchase|site|store)|(?:your|any|all|the|one|an?)\s+(?:entire\s+)?(?:order|purchase|cart)s?|(?:orders?|purchases?|subtotal)\s+(?:of|over|above|\$)|when you spend|spend \$|almost everything|all (?:items|products|styles|merchandise)|your first (?:order|purchase)|first (?:online )?order)\b/i;
  var GENERIC_LABEL = /^(?:deals?|sale|sales|shop(?: now| sale| all| the sale| deals| all deals)?|see all|view all|learn more|save|savings|get|take|enjoy|offer|offers|limited time|today only|now|new|hot|special|exclusive|online|in stores?|online (?:&|and) in stores?|all|more|it|this|that|them|now through|ends|code|with code|plus|today|members?|for members|everyone|you|yourself|treat yourself|the sale|special offer|limited-time offer|online only|instantly|instant savings|up to|price|prices|price drop|clearance|markdowns?|black friday|cyber monday)$/i;

  function tidyLabel(s) {
    s = clean(String(s || '')).replace(/[*†‡¹²³]+/g, '').replace(/^[\s\-–:,.!]+|[\s\-–:,.!]+$/g, '');
    s = s.replace(/^(?:on|for|at|in)\s+/i, '').replace(/\s+\d{1,2}$/, '').replace(/\s+(?:now|today|online|in stores?|instantly|& more|and more)$/i, '').replace(/\s+\d{1,2}$/, '');
    s = s.replace(/[\s,;:\-–]+$/, '');
    if (s.length > 70) s = s.slice(0, 70).replace(/\s+\S*$/, '') + '…';
    return s;
  }

  var NOT_A_LABEL = /^(?:it'?s\b|it\b|this\b|that\b|there\b|time\b|here\b|\$?\d|orders?\b|purchases?\b|when\b|if\b|sign|email|text|subscrib|members?\b|cardmembers?\b|everyone|you\b|yourself|limited|today|tonight|this week|for a limited|off\b|back\b|more\b|less\b|now\b|instantly|plus\b|and\b|or\b|with\b|in[- ]stores?\b|online\b|at checkout|checkout|free\b|shipping\b|returns?\b|regular prices?|the regular price|list price|retail|msrp|its|their|per\b|each\b|a\b)/i;
  var ORDER_PHRASE = /^(?:your|the|any|an?|one|every)?\s*(?:entire\s+)?(?:order|purchase|cart|everything|sitewide|site-?wide|storewide|all|almost everything|it all|all (?:products|items|merchandise|purchases)|orders?\s+.*|purchases?\s+.*|first (?:order|purchase)|next (?:order|purchase)|first online order|full[- ]price (?:items|purchases?)|regular[- ]price (?:items|purchases?))$/i;

  // Labels that are page furniture or sentences, not a set of products.
  var JUNK_LABEL = /^(?:always|everyday|every day|(?:find )?(?:your|my|a|the) (?:local )?store|store locator|(?:locations?|stores?) near(?:by| you)|bogo|b1g1|buy one,? get one(?: free)?|(?:all |special |exclusive |current |more )?offers?|(?:all )?promotions?|weekly ads?|all sale|(?:all )?products?|(?:the )?marked price|ccvalueprop|buy more,? save more|spend more,? save more)$|^results for\b|search results|\(\s*\d+\s*\)|^(?:create|get|sign|join|learn|discover|enjoy|find|see|explore|click|log|start|book|make|give|try|apply|unlock|claim|redeem|use|download|subscribe|register|stream|watch|read)\b|\b(?:buy|save|spend) more\b|marked price|\s(?:and|or|by|for|of|with|from|to|the|a|an|your|our|on|in|at|&|\+)$|^\w+\.\w{2,4}$/i;

  function labelOk(ph) {
    return ph && ph.length >= 3 && !GENERIC_LABEL.test(ph) && !NOT_A_LABEL.test(ph) && !ORDER_PHRASE.test(ph) && !JUNK_LABEL.test(ph);
  }

  function scopeOf(line, ctx) {
    ctx = ctx || {};
    var t = ' ' + joinSplit(clean(String(line || '').replace(/[*†‡¹²³]+/g, ' '))) + ' ';
    var p = ctx.terms || parseTerms(line, '', {});
    if (ctx.product) return { type: 'product', label: ctx.product };
    var m;
    // "20% off your order + up to 40% off cards": the first value decides.
    var firstVal = /(?:\d{1,2}\s?%|\$\s?\d[\d,]*(?:\.\d{2})?)\s*off\b/i.exec(t);
    var orderVal = /(?:\d{1,2}\s?%|\$\s?\d[\d,]*(?:\.\d{2})?)\s*off\s+(?:of\s+)?(?:your\s+|the\s+|an?\s+|any\s+)?(?:entire\s+|whole\s+|next\s+|first\s+|online\s+)?(?:order|purchase|everything|sitewide|site-wide|storewide|almost everything)\b/i.exec(t);
    if (firstVal && orderVal && orderVal.index === firstVal.index) return { type: 'order', label: null, min: p.minSpend || null };
    if ((m = /\b(?:off|on)\s+((?:a|an|one|any one|1|a single|your next|one regular[- ]priced)\s+(?!order\b|purchase\b|online order\b)[a-z][a-z0-9 '’&+™®-]{2,50}?)(?=\s*[.,!:;(·]|\s+(?:with|when|through|at|in|online|today)\b|\s*$)/i.exec(t))) return { type: 'category', label: capFirst(tidyLabel(m[1])), one: true };
    // "PurpleFlex® Mattress: $150 off Twin XL, …" — the name before the colon is what's on sale.
    if ((m = /^\s*([A-Za-z][A-Za-z0-9&'’.™®\- ]{2,50}?):\s*(?:up to\s+|save\s+|extra\s+|take\s+|get\s+)?(?:\$\s?\d|\d{1,2}\s?%)/.exec(t)) && labelOk(tidyLabel(m[1])) && !/(sale|deals?|event|offer|week|today|now|only|alert|special|savings|bonus)$/i.test(m[1].trim())) return { type: 'category', label: capFirst(tidyLabel(m[1])), min: p.minSpend || null };
    var STOP = '(?=\\s*(?:[.,!:;|·(]|—|–|\\s-\\s|\\bwith\\b|\\bwhen\\b|\\bthrough\\b|\\bthru\\b|\\buntil\\b|\\bends?\\b|\\bat\\b|\\bonline\\b|\\bin[- ]stores?\\b|\\bnow\\b|\\btoday\\b|\\bcode\\b|\\bplus\\s+(?=free|\\d|\\$|an?\\s+extra|extra)|\\+\\s*(?=free|\\d|\\$|extra)|\\busing\\b|\\bfor\\b|\\band free\\b|\\bfrom\\b|\\bshop\\b|\\bexclusions\\b|\\bexcludes\\b|\\bonly\\b|\\band\\s+(?:more|up)\\b|$))';
    var PHRASE = '((?:select(?:ed)?\\s+|all\\s+|our\\s+|the\\s+|your\\s+|every\\s+|any\\s+|full[- ]price\\s+|regular[- ]price\\s+|sale\\s+|new\\s+|two\\s+|2\\s+)*(?!off\\b|back\\b)[A-Za-z][A-Za-z0-9&\'’.\\-™®©/+ ]{1,70}?)';
    var cands = [];
    // "40% off boots", "25% off select men's styles"
    t = ' ' + uniq(t.split(/\s+·\s+/).map(clean)).join(' · ') + ' ';
    var reAfter = new RegExp('(?:(?:\\d\\s?%|\\$\\s?\\d[\\d,]*(?:\\.\\d{2})?)\\s*(?:off|back)|half[- ]off|bogo(?:\\s+(?:free|\\$\\s?\\d+(?:\\.\\d{2})?|\\d{1,2}\\s?%\\s*off))?|buy (?:one|1|2|two),? get (?:one|1|2|two)(?:\\s+(?:free|for \\$\\s?\\d+(?:\\.\\d{2})?|\\d{1,2}\\s?%\\s*off))?)\\s*(?:·\\s*(?:(?:free|\\d{1,2}\\s?%\\s*off|for \\$\\s?\\d+)\\s*·\\s*)?)?\\s+(?:on\\s+|of\\s+|for\\s+|at\\s+)?' + PHRASE + STOP, 'ig');
    while ((m = reAfter.exec(t)) !== null) cands.push(tidyLabel(m[1]));
    // "… on select Nivea, Aquaphor & Eucerin"
    var reSel = /\bon\s+(select(?:ed)?\s+[A-Za-z0-9][^.·!;]{2,70}?)(?=\s*(?:[.·!;]|\bwith\b|\bthrough\b|\buntil\b|\bwhen\b|$))/ig;
    while ((m = reSel.exec(t)) !== null) cands.push(tidyLabel(m[1]));
    // "buy more, save more on workspace upgrades", "save on bedding"
    var reOn = new RegExp('\\b(?:save|savings|deals?|discounts?|more)\\s+(?:up to\\s+[^ ]+\\s+)?on\\s+' + PHRASE + STOP, 'ig');
    while ((m = reOn.exec(t)) !== null) cands.push(tidyLabel(m[1]));
    // "when you buy the MX Keypad with select workspace products"
    cands = cands.map(function (c) {
      if (/^(?:sale|sale styles|sale items|sale prices?|already reduced items)$/i.test(c)) return 'Items already on sale';
      if (/^(?:clearance|clearance items|clearance styles)$/i.test(c)) return 'Clearance items';
      if (/^select(?:ed)? (?:styles|items|products|merchandise)( only)?$/i.test(c) && ctx.section && labelOk(tidyLabel(ctx.section)) && !/[$%]/.test(ctx.section)) return 'Select ' + tidyLabel(ctx.section) + ' ' + /(styles|items|products|merchandise)/i.exec(c)[1].toLowerCase();
      return c;
    });
    // "select pillows, bedding, and more" keeps its whole list.
    var sm = /(?:\d\s?%|\$\s?\d[\d,]*)\s*off\s+(select(?:ed)?\s+[a-z][^.!;·]{2,90}?)(?=\s*(?:[.!;·]|\s\d{1,2}\s*$|\bwith\b|\bthrough\b|\buntil\b|$))/i.exec(t);
    if (sm && cands.length && /^select/i.test(cands[0])) cands[0] = tidyLabel(sm[1].replace(/,?\s+and more$/i, ', and more'));
    cands = cands.map(function (c) { var w = /^select(?:ed)?\s+(\S+)$/i.exec(c); return w && brandByName(w[1]) ? c + ' items' : c; });
    // "10% off for Cardmembers" names who gets it, not what it covers.
    cands = cands.filter(function (c) { return !/(?:^|\s)(?:card ?members?|cardholders?|members?|rewards members?|loyalty members?|students?|teachers?|educators?|military|veterans?|nurses|heroes|first responders|healthcare workers|medical professionals|new customers?|customers?|subscribers?|app users?|seniors|you|everyone)$/i.test(c); });
    var phrase = cands.filter(labelOk)[0] || '';
    if (!phrase && (m = /\bwhen you (buy|bundle|purchase|order|pair)\s+((?:the\s+|a\s+|an\s+|any\s+|2\s+|two\s+|3\s+|three\s+)?[A-Za-z0-9][^.!;·]{2,70}?)(?=[.!;·]|\s*$|\s+-\s|\s*\bcode\b|\s+(?:through|until|ends|online|and (?:get|save|receive|use))\b)/i.exec(t)) && labelOk(tidyLabel(m[2]))) {
      return { type: 'category', label: 'When you ' + m[1].toLowerCase() + ' ' + tidyLabel(m[2]), min: p.minSpend || null };
    }
    var before = '';
    var bm = /^\s*([A-Z][A-Za-z0-9&'’.\- ]{2,40}?)\s*(?:[:\-–—]\s*|\s+(?:are|is)\s+(?:now\s+)?|\s)(?:up to\s+|save\s+(?:up to\s+)?|take\s+|extra\s+|get\s+)?(?:\d{1,2}\s?%|\$\s?\d)/i.exec(t);
    if (bm) {
      before = tidyLabel(bm[1]);
      if (!labelOk(before) || /^(?:get|take|save|enjoy|extra|plus|now|up|shop|buy|spend|earn|score|unlock|treat|all|our|it'?s|friends (?:&|and) family|f&f|flash sale|weekend sale|fall sale|holiday sale|labor day|memorial day|presidents'? day|cyber|black friday|deal of the day|students?|military|heroes|teachers|nurses|members?|new customers?|cardmembers?)\b/i.test(before) || /(sale|deals?|event|days?|savings)$/i.test(before) || /\b(get|save|take|enjoy)$/i.test(before)) before = '';
    }
    if (phrase) return { type: 'category', label: capFirst(phrase.replace(/^your\s+/i, '')), min: p.minSpend || null };
    // "Buy one ticket to Klara and the Sun, get one free"
    if ((m = /\bbuy\s+(?:one|1|2|two|3|three|any)\s+(?!get\b)([a-z][a-z0-9 '’&+:-]{2,60}?)(?=\s*(?:,|\(|\band (?:get|use|save|receive)\b|\bget\b|$))/i.exec(t)) && labelOk(tidyLabel(m[1]))) return { type: 'category', label: capFirst(tidyLabel(m[1])), min: p.minSpend || null };
    if (ctx.headline && !ctx._h) {
      var hs = scopeOf(ctx.headline, { terms: p, _h: true });
      if (hs.type === 'category') return hs;
    }
    // Who-can-use-it words only count from the offer's own words, not a whole fine-print page.
    var pl = ctx.terms ? parseTerms(line, '', {}) : p;
    if (ORDER_WORDS.test(t) || p.minSpend || (p.tiers && p.tiers.length) || pl.verify || pl.signup || pl.newCust || pl.storeCard) return { type: 'order', label: null, min: p.minSpend || null };
    if (before) return { type: 'category', label: before };
    if (ctx.code && (p.pct || p.amt)) return { type: 'order', label: null, assumed: true };
    if (ctx.section && labelOk(tidyLabel(ctx.section)) && !/[$%]/.test(ctx.section)) return { type: 'category', label: capFirst(tidyLabel(ctx.section)) };
    return { type: 'unknown', label: null };
  }

  function capFirst(s) { s = String(s || ''); return s.charAt(0).toUpperCase() + s.slice(1); }

  // Banners often split a phrase over two lines ("15% OFF YOUR · NEXT PURCHASE").
  function joinSplit(s) { return String(s || '').replace(/\b(by|from|for|of|your|the|an?|on|with|and|&)\s+·\s+/gi, '$1 '); }

  // The section name a call-to-action points at ("Shop Men's Golf" → "Men's Golf").
  function sectionFromCta(links, domain) {
    var labels = uniq(links.filter(function (l) { return CTA_RE.test(l.label || l.aria || ''); }).map(function (l) { return (l.label || l.aria).toLowerCase(); }));
    if (labels.length > 1) return null;
    for (var i = 0; i < links.length; i++) {
      var l = links[i];
      if (TERMS_LINK.test(l.label) && !CTA_RE.test(l.label)) continue;
      var m = /^(?:shop|buy|see|view|browse|explore|discover|find)\s+(?:the\s+|all\s+|our\s+|now\s*[:\-]?\s*)?(.{3,50})$/i.exec(l.label || l.aria || '');
      if (m && !/^(now|all|more|it|the sale|sale|deals?|here|this|them|collection|styles?|offers?)$/i.test(m[1].trim())) return tidyLabel(m[1]);
    }
    return null;
  }

  function pathLabel(url) {
    try {
      var segs = new URL(url).pathname.split('/').filter(Boolean).filter(function (s) { return !/^(en|us|en-us|en_us|c|s|b|l|shop|browse|category|categories|collections?|cat|pages|feature|landing|campaign)$/i.test(s) && !/^\d+$/.test(s) && !/\.[a-z]{2,4}$/i.test(s) || /^[a-z-]+\.(html?|jsp)$/i.test(s); });
      var last = segs[segs.length - 1];
      if (!last) return null;
      var multi = /[-_]/.test(last.replace(/\.[a-z]{2,4}$/i, ''));
      last = last.replace(/\.[a-z]{2,4}$/i, '').replace(/[-_]+/g, ' ').replace(/\b(cat|id)\d+\b/gi, '').replace(/\d{4,}/g, '').replace(/^(?:up to )?\d{1,3} (?:percent |pct )?off /i, '').trim();
      if (!last || last.length < 3 || /^(sale|deals?|offers?|promotions?|default|index|home|division|category|product|item)$/i.test(last)) return null;
      // A single path word only counts when it is a common section name.
      if (!multi && !/^(men|mens|women|womens|kids|boys|girls|baby|shoes|sneakers|boots|sandals|clothing|apparel|accessories|bags|handbags|jewelry|watches|beauty|makeup|skincare|fragrance|hair|home|furniture|bedding|bath|kitchen|dining|outdoor|patio|garden|electronics|computers|laptops|tablets|tvs|audio|headphones|cameras|gaming|toys|pets|sports|fitness|golf|outlet|clearance|gifts|holiday|halloween|christmas|mattresses|pillows|sheets|towels|rugs|lighting|decor|tools|appliances|grocery|health|vitamins|outerwear|jackets|sweaters|jeans|denim|dresses|tops|activewear|swim|lingerie|underwear|socks|hats|sunglasses|luggage|travel|books|music|movies|games|office|school|crafts|party|wedding|bridal)$/i.test(last)) return null;
      if (JUNK_LABEL.test(last)) return null;
      return capFirst(last);
    } catch (e) { return null; }
  }

  // Everything promotional on one page, each with its box, links and fine print.
  function findOffers(root, base, domain, ctx) {
    ctx = ctx || {};
    var seeds = [];
    walk(root, function (n) {
      if (n.t === 'head') return false;
      if (n.t === '#' && SEED_RE.test(n.v) && (!n.p || !inCard(n) || /\bcode\b/i.test(n.v))) seeds.push(n);
    });
    // Seeds split across tags ("40%" <span>"off"</span>): check small elements too.
    walk(root, function (n) {
      if (n.t === 'head' || n._card) return false;
      if (n.t === '#' || textLen(n) > 120 || textLen(n) < 4) return;
      var t = lineText(n, 200);
      if (SEED_RE.test(t)) {
        var dup = false;
        walk(n, function (x) { if (x.t === '#' && seeds.indexOf(x) >= 0) { dup = true; return false; } });
        if (!dup) seeds.push(n);
        return false;
      }
    });
    var foots = ctx.footnotes || footnotesIn(root);
    var groups = [];
    var byLine = new Map();
    seeds.forEach(function (s) {
      var ln = lineOf(s);
      if (byLine.has(ln)) return;
      var lt = lineText(ln, 400);
      if (lt.length < 5 || JUNK_LINE.test(lt)) return;
      if (/\?\s*$/.test(lt) && !extractCodes(lt).length) return;
      if (FOOT_START.test(lt) && lt.length > 80) return;
      var nav = isNavLike(ln);
      var cont = containerOf(ln);
      var tile = tileOf(ln, base);
      if (tile && !extractCodes(lt).length) return;
      var g = { line: ln, text: lt, cont: tile || cont, nav: nav, tile: tile };
      byLine.set(ln, g);
      groups.push(g);
    });
    var out = [];
    var seen = {};
    groups.forEach(function (g) {
      var ctext = nodeText(g.cont, 2400);
      var ctl = lineText(g.cont, 2400);
      // A short follow-on line belongs to the deal ("with code: LEAF10", "WITH YOUR L.L.BEAN MASTERCARD").
      var clines = ctext.split('\n').map(clean).filter(Boolean);
      var li = clines.indexOf(g.text);
      var pv0 = readValues(g.text);
      if (li > 0 && extractCodes(g.text).length && !(pv0.pct || pv0.amt || pv0.tiers || pv0.bogoV || pv0.cashPct)) {
        for (var pb = li - 1; pb >= 0 && pb >= li - 2; pb--) {
          var pl = clines[pb];
          var pvv = readValues(pl);
          if (pl.length <= 140 && (pvv.pct || pvv.amt || pvv.tiers || pvv.bogoV) && !extractCodes(pl).length) { g.text = pl + ' ' + g.text; break; }
        }
      }
      if (li >= 0) {
        for (var nx = li + 1; nx < clines.length && nx <= li + 2; nx++) {
          var nl = clines[nx];
          if (nl.length > 90) break;
          if (/^(?:with|when|for|on|using|in stores|online|plus|valid|through|thru)\b/i.test(nl) && !(SEED_RE.test(nl) && !/\bcode\b/i.test(nl) && !/^(?:with|when)\b/i.test(nl))) g.text = g.text + ' ' + nl;
          else break;
        }
      }
      var lineIsHeading = /^h[1-6]$/.test(g.line.t) || /(heading|headline|\btitle\b|-title|title-)/.test(cls(g.line));
      var head = lineIsHeading ? null : headingIn(g.cont, g.text, g.line);
      var links = linksIn(g.cont, base);
      var lp = g.line._o;
      links.sort(function (a, b) { return Math.abs(a.o - lp) + (a.o < lp ? 1e6 : 0) - (Math.abs(b.o - lp) + (b.o < lp ? 1e6 : 0)); });
      var cta = links.filter(function (l) { return (!domain || sameStore(l.url, domain)) && !TERMS_LINK.test(l.label + ' ' + l.url.replace(/^https?:\/\/[^/]+/, '')) ; });
      var termLinks = links.filter(function (l) { return (!domain || sameStore(l.url, domain)) && (TERMS_LINK.test(l.label) || /#(?:terms|details|legal|disclaimer|exclusions|offer)|\/(?:terms|offer-?details|promo-?details|exclusions|legal\/promo|promotions?\/details|coupon-?terms)/i.test(l.url)); });
      var code = extractCodes(g.text)[0] || null;
      if (!code && /\b(?:code|coupon)\b/i.test(g.text)) {
        var codes = extractCodes(ctl);
        if (codes.length === 1) code = codes[0];
      }
      // Tiered offers in one line or in neighboring lines ("$25 off $150 · $50 off $250").
      var tierText = g.text;
      var tiers = tiersIn(tierText);
      if (tiers.length < 2) { var ct = tiersIn(ctl); if (ct.length >= 2) { tiers = ct; tierText = ct.map(function (x) { return '$' + x.amt + ' off $' + x.min; }).join(', '); } }
      var line = g.text;
      var scopeText = g.text;
      if (tiers.length >= 2) {
        if (line.length < 40 && !/,|·/.test(line)) line = tierText;
        scopeText = ctext.split('\n').filter(function (l) { return tiersIn(l).length || /\b(?:buy|spend) more\b|\bsave more\b|\bon\s+[a-z]/i.test(l); }).join(' · ') || g.text;
      }
      var section = sectionFromCta(cta, domain) || (head && head !== line ? head : null);
      var marks = (/(\*{1,4}|†{1,3}|‡{1,2})/.exec(line) || [])[1] || null;
      // Fine print: in the box, a matching footnote, or a terms link.
      var fine = [];
      ctext.split('\n').forEach(function (l) {
        l = clean(l);
        if (l && l !== line && l !== head && l.length > 12 && (FOOT_START.test(l) || /\b(exclu|valid|expires|ends|not valid|limit|applies|eligible|while supplies|minimum|max|only)\b/i.test(l)) && !CTA_RE.test(l)) fine.push(l);
      });
      var p0 = parseTerms(line, '', {});
      foots.forEach(function (f) {
        if (f.node === g.cont) return;
        var hit = false;
        if (marks && f.marks === marks) hit = true;
        if (code && f.text.toUpperCase().indexOf(code) >= 0) hit = true;
        if (!hit && p0.pct && new RegExp('\\b' + p0.pct + '\\s?%').test(f.text) && f.text.length < 2500) hit = true;
        if (!hit && p0.amt && new RegExp('\\$\\s?' + p0.amt + '(?:\\.00)?\\b').test(f.text) && f.text.length < 2500) hit = true;
        if (hit) fine.push(pickRelevant(f.text, [code, p0.pct ? p0.pct + '%' : null, p0.amt ? '$' + p0.amt : null], 1400));
      });
      var lineCodes = extractCodes(g.text);
      if (lineCodes.length >= 2) {
        g.text.split(/,?\s+or\s+(?=(?:get\s+|take\s+|save\s+)?(?:an?\s+)?(?:extra\s+)?(?:\d{1,2}\s?%|\$\s?\d))|;\s*|\s+·\s+/i).forEach(function (part) {
          var c2 = extractCodes(part)[0];
          if (!c2 || seen['C|' + c2]) return;
          seen['C|' + c2] = 1;
          out.push({ line: part.trim(), scopeText: part.trim(), headline: head, section: section, code: c2, tiers: [], fine: uniq(fine).join(' ').slice(0, 2200), termsUrls: termLinks.map(function (l) { return l.url; }).slice(0, 2), landing: cta.length ? cta[0].url : null, landingLabel: cta.length ? cta[0].label : null, context: ctl.slice(0, 900), nav: g.nav });
        });
        return;
      }
      if (code && seen['C|' + code]) return;
      if (code) seen['C|' + code] = 1;
      var key = tiers.length >= 2 ? 'T:' + tiers.map(function (x) { return x.amt + '/' + x.min; }).join(',') : (code || '') + '|' + normName(line).slice(0, 60);
      if (seen[key]) return;
      seen[key] = 1;
      if (g.tile && code) {
        var pname = nameIn(g.tile, base);
        var plink = linkIn(g.tile, base, domain, pname);
        if (pname && plink) {
          var pp = amounts(lineText(g.tile, 700).split(pname).join(' ')).filter(function (a) { return !a.off; }).map(function (a) { return a.v; });
          out.push({ ownLink: plink, line: tidyTitle(g.text, code), scopeText: g.text, headline: null, section: null, code: code, tiers: [], fine: '', termsUrls: [], landing: plink, context: lineText(g.tile, 600), nav: null, product: { name: pname, price: pp.length ? Math.min.apply(null, pp) : null } });
        }
        return;
      }
      var own = null;
      for (var up = g.line, k2 = 0; up && k2 < 4; up = up.p, k2++) if (up.t === 'a' && up.a.href) { own = absUrl(up.a.href, base); break; }
      if (!own) { var inner = []; walk(g.line, function (y) { if (y.t === 'a' && y.a.href) inner.push(y); }); if (inner.length === 1) own = absUrl(inner[0].a.href, base); }
      if (own && domain && !sameStore(own, domain)) own = null;
      if (own && TERMS_LINK.test(own.replace(/^https?:\/\/[^/]+/, '')) && /terms|details|exclusions|legal/i.test(own)) own = null;
      var landing = own || (cta.length ? cta[0].url : null);
      if (g.nav && !own && !code) return;
      out.push({
        ownLink: own, line: line, scopeText: scopeText, headline: head, section: section, code: code, tiers: tiers,
        fine: uniq(fine).join(' ').slice(0, 2200), termsUrls: termLinks.map(function (l) { return l.url; }).slice(0, 2),
        landing: landing, landingLabel: cta.length ? cta[0].label : null, context: ctl.slice(0, 900), nav: g.nav
      });
    });
    var byLanding = {};
    var keep = [];
    out.forEach(function (o) {
      var pv = parseTerms(o.line, '', {});
      var sig = o.landing && !o.code ? o.landing.split('#')[0] + '|' + (pv.headline || '') : null;
      if (sig && byLanding[sig]) {
        var other = byLanding[sig];
        if (o.line.length > other.line.length) { keep[keep.indexOf(other)] = o; byLanding[sig] = o; }
        return;
      }
      if (sig) byLanding[sig] = o;
      keep.push(o);
    });
    return keep;
  }

  function uniq(a) { var s = {}; return a.filter(function (x) { if (!x || s[x]) return false; s[x] = 1; return true; }); }

  var NAV_SEG = /^(?:shop(?: now| all| the sale| women| men| kids| girls| boys| baby| home| deals| more)?|learn more|details|see details|offer details|sale|clearance|deals?|new|buy now|get started|sign in|join|sign in or join|terms apply|exclusions apply|\*+|view all|see all|explore|discover|apply|activate|founded in \d{4})[.!*]*$/i;
  // The part of a line that is the deal ("40% Off Everything, 50% Off Cardmembers!"),
  // without menu words and neighbouring promotions.
  function tidyTitle(line, code) {
    line = joinSplit(line);
    var segs = String(line || '').split(/\s+·\s+/).map(function (x) { return clean(x).replace(/\s+(?:shop now|learn more|shop the sale|details|see details)[.!]*$/i, ''); }).filter(Boolean);
    if (segs.length <= 1) return clean(String(line || '').replace(/\s+(?:shop now|learn more|details)[.!]*$/i, ''));
    var idx = [];
    // Start at the piece that states the value. A code's own name can also appear in a
    // banner title ("THE LONG WEEKEND EVENT!" for code WEEKEND), so the code only decides
    // when no piece states a value.
    segs.forEach(function (sg, i) { if (SEED_RE.test(sg)) idx.push(i); });
    if (!idx.length && code) segs.forEach(function (sg, i) { if (sg.toUpperCase().indexOf(code) >= 0) idx.push(i); });
    if (!idx.length) return segs.filter(function (sg) { return !NAV_SEG.test(sg); }).join(' · ');
    var first = idx[0];
    var keep = [];
    // Short pieces right before the value ("Buy 1 Get 1", "Treat of the Week") and the
    // words right after it ("Everything Photo") belong to the same deal.
    var prev = first > 0 ? segs[first - 1] : '';
    if (prev && prev.length <= 40 && !NAV_SEG.test(prev) && !SEED_RE.test(prev) && (/[:!]$/.test(prev) || /^(?:buy|bogo|today|tonight|this week|treat|extra|plus|deal|flash|limited|weekend|friends|members?|rewards?)\b/i.test(prev))) keep.push(prev);
    keep.push(segs[first]);
    for (var i = first + 1; i < segs.length && keep.join(' ').length < 160; i++) {
      var sg = segs[i];
      if (NAV_SEG.test(sg)) continue;
      var joined = /(?:\+|\bplus|\band)\s*$/i.test(keep[keep.length - 1]);
      if (SEED_RE.test(sg) && !joined && !(code && sg.toUpperCase().indexOf(code) >= 0) && !/^\+|^plus\b/i.test(sg) && !/^(?:free|\d{1,2}\s?%\s*off)$/i.test(sg)) break;
      if (joined) { keep.push(sg); continue; }
      if (keep.join(' ').toLowerCase().indexOf(sg.toLowerCase()) >= 0) continue;
      var cond = /^(?:with|w\/|for|on|select|code|use code|valid|online|in[- ]stores?|excl|ends?|through|thru|until|today|mix|plus|\+|limit|only|members?|when|min)/i.test(sg);
      if (!cond && (sg.length > 48 || /[.!?]\s*$/.test(sg) && sg.split(/\s+/).length > 3)) break;
      if (/^(?:with code|use code|code)\b/i.test(sg) || sg.length <= 60 || /^(?:\+|plus\b|on\b|for\b|select\b)/i.test(sg)) keep.push(sg); else break;
    }
    return keep.join(' · ').replace(/\s*·\s*(?=[,.!])/g, '').replace(/\s*(\+|\bplus)\s*·\s*/gi, ' $1 ').replace(/^shop\s+(?=\d|\$)/i, '').replace(/^\+\s*/, '').replace(/,?\s*limited offer\.?$/i, '').replace(/\s+\d{1,2}$/, '');
  }

  // The sentences of a long terms text that mention this offer.
  function pickRelevant(text, keys, max) {
    text = clean(text);
    max = max || 1400;
    if (text.length <= max) return text;
    var sents = text.split(/(?<=[.!?])\s+(?=[A-Z*†‡(])/);
    var keep = [];
    sents.forEach(function (s, i) {
      if (keys.some(function (k) { return k && s.toUpperCase().indexOf(String(k).toUpperCase()) >= 0; })) {
        keep.push(i);
        if (i + 1 < sents.length) keep.push(i + 1);
        if (i + 2 < sents.length) keep.push(i + 2);
      }
    });
    var picked = uniq(keep.map(String)).map(Number).sort(function (a, b) { return a - b; }).map(function (i) { return sents[i]; });
    var out = (picked.length ? picked : sents).join(' ');
    return out.length > max ? out.slice(0, max - 1).replace(/\s+\S*$/, '') + '…' : out;
  }

  function tiersIn(text) {
    var out = [];
    var seen = {};
    var re = /\$\s?(\d[\d,]*)(?:\.\d{2})?\s*off\s*(?:(?:your\s+)?(?:orders?|purchases?)\s+(?:of\s+)?)?\$\s?(\d[\d,]*)(?:\.\d{2})?\+?|spend\s*\$\s?(\d[\d,]*)\+?\s*(?:,|and|&|\s)?\s*(?:get|save|take)\s*\$\s?(\d[\d,]*)(?:\s*off)?/gi;
    var m;
    while ((m = re.exec(text)) !== null) {
      var amt = num(m[1] || m[4]);
      var min = num(m[2] || m[3]);
      if (!(amt > 0 && min > amt)) continue;
      if (seen[amt + '/' + min]) continue;
      seen[amt + '/' + min] = 1;
      out.push({ amt: amt, min: min });
    }
    out.sort(function (a, b) { return a.min - b.min; });
    return out;
  }

  // Terms on a separate page: the section a link points at, or the terms heading.
  function termsFromPage(root, url, keys) {
    var frag = null;
    try { frag = decodeURIComponent(new URL(url).hash.slice(1)); } catch (e) { }
    var target = null;
    if (frag) walk(root, function (n) { if (!target && n.a && (n.a.id === frag || n.a.name === frag)) { target = n; return false; } });
    var chunks = [];
    function grabFrom(n) {
      var t = nodeText(n, 6000);
      if (textLen(n) < 60 && n.p) {
        // An anchor or heading: take what follows it.
        var sib = n.p.c;
        var i = sib.indexOf(n);
        var buf = [t];
        for (var k = i + 1; k < sib.length && buf.join(' ').length < 5000; k++) {
          if (sib[k].t && /^h[1-3]$/.test(sib[k].t) && buf.length > 1) break;
          buf.push(nodeText(sib[k], 3000));
        }
        t = buf.join('\n');
        if (t.length < 80 && n.p.p) t = nodeText(n.p, 6000);
      }
      return t;
    }
    if (target) chunks.push(grabFrom(target));
    if (!chunks.length || chunks[0].length < 60) {
      walk(root, function (n) {
        if (chunks.length >= 3) return false;
        var ht = /^h[1-6]$/.test(n.t) ? lineText(n, 200) : '';
        if (ht && /terms|details|exclusions|disclaimer|fine print|offer|promotion/i.test(ht) && !/trademark|copyright|privacy|cookie|accessibility|careers/i.test(ht)) chunks.push(grabFrom(n));
        else if (n.a && /(terms|disclaimer|offer-?details|exclusion|fine-?print|promo-?details)/.test(cls(n)) && !/(trademark|copyright|privacy|cookie)/.test(cls(n)) && textLen(n) > 80) { chunks.push(nodeText(n, 6000)); return false; }
      });
    }
    var text = clean(chunks.join(' ').replace(/\n+/g, ' '));
    if (text.length < 40) return null;
    if (!/valid|offer|exclu|discount|purchase|order|promotion|expires|code|eligible|savings|minimum/i.test(text)) return null;
    return pickRelevant(text, keys, 1800);
  }

  function pageTitle(root) {
    var t = null;
    var h1 = null;
    walk(root, function (n) {
      if (!t && n.t === 'title') t = lineText(n, 200);
      if (!h1 && n.t === 'h1') h1 = lineText(n, 200);
      if (t && h1) return false;
    });
    return { title: t, h1: h1 };
  }

  // Deal pages linked from a store's menu ("Sale", "Deals", "Coupons").
  function dealLinks(root, base, domain) {
    var found = [];
    walk(root, function (n) {
      if (n.t !== 'a' || !n.a.href) return;
      var u = absUrl(n.a.href, base);
      if (!u || !sameStore(u, domain)) return;
      var label = clean(lineText(n, 120) || n.a['aria-label'] || '');
      var path = u.replace(/^https?:\/\/[^/]+/, '').split('#')[0];
      var s = 0;
      if (/^(sale|deals?|today'?s deals|top deals|hot deals|offers|special offers|current offers|weekly (?:ad|deals)|clearance|promotions?|coupons?(?: & deals)?|coupons and deals|deals (?:&|and) (?:offers|coupons)|shop (?:the )?sale|shop (?:all )?deals|all deals|outlet|markdowns|savings|discounts?|specials|sale & clearance|deals of the (?:day|week))$/i.test(label)) s += 5;
      if (/\/(sale|deals?|offers?|clearance|promotions?|coupons?|outlet|specials|savings|discounts?|markdowns?)(\/|$|\?|\.|-|_)/i.test(path)) s += 3;
      if (/(gift|card|credit|account|help|store-?locator|careers|blog|login|registry|financing|students?|military|terms|legal|policy|policies|faq|privacy|disclaimer)/i.test(path + ' ' + label)) s -= 6;
      if (s >= 3) found.push({ url: u.split('#')[0], label: label, s: s });
    });
    var seen = {};
    return found.sort(function (a, b) { return b.s - a.s; }).filter(function (f) { if (seen[f.url]) return false; seen[f.url] = 1; return true; });
  }

  // Read one page: promotions and products, each with full context.
  function readPage(html, opts) {
    opts = opts || {};
    var root = typeof html === 'string' ? parseHTML(html) : html;
    var order = 0;
    walk(root, function (n) { n._o = order++; });
    var base = opts.url || 'https://' + (opts.domain || 'example.com') + '/';
    var products = productsFromLd(root, base);
    var seenP = {};
    products.forEach(function (p) { seenP[p.url + '|' + p.name] = 1; });
    findProducts(root, base, opts.domain).forEach(function (p) { if (!seenP[p.url + '|' + p.name]) products.push(p); });
    var foots = footnotesIn(root);
    var offers = findOffers(root, base, opts.domain, { footnotes: foots });
    var t = pageTitle(root);
    return { root: root, offers: offers, products: products, footnotes: foots, title: t.title, h1: t.h1, deals: opts.domain ? dealLinks(root, base, opts.domain) : [] };
  }

  // Turn what a page showed into stored deal records. Only deals that say what they
  // are worth, what they apply to and where to use them are kept.
  function recordsFromPage(page, info, now) {
    now = now || new Date();
    var recs = [];
    var dropped = [];
    var sectionOfPage = info.pageLabel || null;
    (page.offers || []).forEach(function (o) {
      if (o.code && /\bno (?:promo |coupon |discount )?code (?:needed|required|necessary)\b/i.test(o.line) && o.line.toUpperCase().indexOf(o.code) < 0) o.code = null;
      // One banner line can hold two offers ("Up to 50% off almost everything, no code needed …
      // Free shipping on $99+ with code SHIP99"). A code keeps only the words of its own offer.
      if (o.code && !o.product) {
        var own = codePart(o.line, o.code);
        if (own) { if (!o.headline && own.rest.length < 60) o.headline = own.rest; o.line = own.part; o.scopeText = own.part; }
      }
      if (o.nav && !o.ownLink && !o.code) { dropped.push({ why: 'menu link without its own page', line: o.line }); return; }
      var title = tidyTitle(o.line, o.code);
      if (o.code && title.toUpperCase().indexOf(o.code) < 0) title = /\bcode\s*:?\s*$/i.test(title) ? title + ' ' + o.code : title + ' (code ' + o.code + ')';
      if (o.tiers.length >= 2) title = (o.headline && o.headline.length < 60 ? o.headline.replace(/[*†‡]+/g, '') + ': ' : 'Spend more, save more: ') + o.tiers.map(function (x) { return money(x.amt) + ' off ' + money(x.min); }).join(', ');
      var terms = [o.fine, o.termsText].filter(Boolean).join(' ');
      var p = parseTerms(title + (o.headline ? ' · ' + o.headline : ''), terms, { refDate: now, code: o.code });
      var hasValue = p.pct || p.amt || p.bogo || p.cashPct || p.cashAmt || (p.tiers && p.tiers.length) || (p.freeShip && p.freeShipMin);
      if (!hasValue && !o.code) { dropped.push({ why: 'no value', line: o.line }); return; }
      var sctx = { code: o.code, section: o.section || o.landingTitle || sectionOfPage, terms: p, headline: o.headline };
      var base = o.tiers.length >= 2 ? (o.scopeText || o.line) : title;
      var scope = o.product ? { type: 'product', label: o.product.name + (o.product.price ? ' (' + money(o.product.price) + ' before the code)' : '') } : scopeOf(base, sctx);
      // The tidy title can drop the words that say what's covered ("BOGO 50% Off · Fireside socks…").
      var fromSection = scope.type === 'category' && sctx.section && scope.label === capFirst(tidyLabel(sctx.section));
      if (!o.product && (scope.type === 'unknown' || scope.assumed || fromSection) && o.scopeText && o.scopeText !== base) {
        var s2 = scopeOf(o.scopeText, { code: o.code, terms: p });
        if (s2.type !== 'unknown' && !s2.assumed) scope = s2;
      }
      if (scope.type === 'category' && /\b(?:order[- ]level|qualifying orders?|applies to (?:your |the )?(?:entire |whole )?(?:order|purchase)|entire (?:order|purchase)|sitewide|site-wide)\b/i.test(o.termsText || '') && !/\bselect(?:ed)?\b|\bonly (?:on|applies to) /i.test(o.termsText || '')) scope = { type: 'order', label: null, min: p.minSpend || null, note: scope.label };
      var lt2 = o.landingTitle ? tidyLabel(o.landingTitle.replace(/^shop\s+(?:the\s+|all\s+)?/i, '')) : null;
      if (scope.type === 'unknown' && lt2 && labelOk(lt2)) scope = { type: 'category', label: capFirst(lt2) };
      if (scope.type === 'unknown' && o.landing) { var pl = pathLabel(o.landing); if (pl) scope = { type: 'category', label: pl }; }
      if (scope.type === 'unknown' || (!hasValue && scope.assumed)) { dropped.push({ why: "can't tell what it applies to", line: o.line }); return; }
      if (o.items && o.items.length && scope.type === 'category') scope.items = o.items.slice(0, 8).map(shortItem);
      if (!hasValue && o.code && scope.type === 'category' && scope.label && title.toLowerCase().indexOf(scope.label.toLowerCase()) < 0) title = title.replace(/[.\s]+$/, '') + ' (for ' + scope.label.charAt(0).toLowerCase() + scope.label.slice(1) + ')';
      if (scope.type === 'order' && p.minSpend) scope.min = p.minSpend;
      var url = o.landing || info.url;
      if (!url) { dropped.push({ why: 'no link', line: o.line }); return; }
      recs.push(makeRecord({
        domain: info.domain, brand: info.brand, kind: o.code ? 'code' : 'sale', title: title, code: o.code,
        headline: o.headline && o.headline !== title ? o.headline : null, section: o.section || null,
        terms: terms, termsUrl: o.termsSource || (o.fine ? info.url : null), termsFound: !!terms,
        scope: scope, url: url, pageUrl: info.url, cat: info.cat, sourceType: info.sourceType || 'official',
        sourceName: info.sourceName || (info.brand + ' website')
      }, now));
    });
    // The same promotion often shows twice on a page (banner and menu). Keep the fuller copy.
    var bySig = {};
    var kept = [];
    recs.forEach(function (r) {
      var d = r.data;
      var pv = parseTerms(d.title, d.terms, {});
      var sig = d.code ? 'C|' + d.code : (pv.headline || d.title) + '|' + (d.scope ? d.scope.type + ':' + (d.scope.label || '') : '');
      var prev = bySig[sig];
      if (prev) {
        var better = (d.terms.length + d.title.length) > (prev.data.terms.length + prev.data.title.length * 0.5);
        if (better) { kept[kept.indexOf(prev)] = r; bySig[sig] = r; }
        dropped.push({ why: 'duplicate', line: d.title });
        return;
      }
      bySig[sig] = r;
      kept.push(r);
    });
    recs = kept;
    (page.products || []).forEach(function (pr) {
      if (!pr.url || !pr.name || !(pr.was > pr.price)) return;
      recs.push(productRecord(pr, info, now));
    });
    return { records: recs, dropped: dropped };
  }

  function codePart(line, code) {
    var parts = String(line || '').split(/\s+(?:see (?:promo |offer )?details|learn more|shop now)\b[.!]*\s*|\s+·\s+|(?<=[.!])\s+(?=[A-Z+])/i).map(clean).filter(Boolean);
    if (parts.length < 2) return null;
    var i = -1;
    var esc = code.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    var withWord = new RegExp('\\bcode\\s*:?\\s*["“]?' + esc + '\\b', 'i');
    var bare = new RegExp('\\b' + esc + '\\b');
    parts.forEach(function (pt, k) { if (i < 0 && withWord.test(pt)) i = k; });
    parts.forEach(function (pt, k) { if (i < 0 && bare.test(pt)) i = k; });
    if (i < 0) return null;
    var part = parts[i];
    if (!SEED_RE.test(part.replace(/\b(?:use |with |promo |coupon )?code\s*:?\s*\S+/ig, '')) && i > 0) part = parts[i - 1] + ' · ' + part;
    var rest = parts.filter(function (pt) { return part.indexOf(pt) < 0; }).join(' · ');
    // Only split when the rest is a different offer with its own value.
    if (!rest || !SEED_RE.test(rest)) return null;
    return { part: part, rest: rest };
  }

  function shortItem(pr) {
    return { n: pr.name, u: pr.url, p: pr.price, w: pr.was, i: pr.img || null, s: pr.stock || null };
  }

  function productRecord(pr, info, now) {
    var pct = Math.round((1 - pr.price / pr.was) * 100);
    return makeRecord({
      domain: info.domain, brand: info.brand, kind: 'product', title: pr.name, url: pr.url,
      product: { name: pr.name, price: pr.price, was: pr.was, img: pr.img || null, stock: pr.stock || null, from: !!pr.from, pct: pct },
      section: pr.section || info.pageLabel || null, terms: pr.text && pr.text.length > pr.name.length + 10 ? pr.text : '',
      expires: pr.expires || null, cat: pr.cat || info.cat, sourceType: info.sourceType || 'official',
      sourceName: info.sourceName || (info.brand + ' website'), pageUrl: info.url, price: pr.price
    }, now);
  }

  // Builds the same node shape from a live page in Safari.
  function fromDom(el) {
    var root = { t: '#root', a: {}, c: [], p: null, ld: [] };
    var lds = el.ownerDocument ? el.ownerDocument.querySelectorAll('script[type="application/ld+json"]') : [];
    for (var i = 0; i < lds.length; i++) root.ld.push(lds[i].textContent || '');
    var count = 0;
    (function rec(d, parent) {
      if (count++ > 60000) return;
      for (var c = d.firstChild; c; c = c.nextSibling) {
        if (c.nodeType === 3) {
          var v = clean(c.nodeValue);
          if (v) parent.c.push({ t: '#', v: v, p: parent });
        } else if (c.nodeType === 1) {
          var tag = c.tagName.toLowerCase();
          if (SKIP_TAGS[tag] || c.hasAttribute('data-deal-stack')) continue;
          var a = {};
          for (var k = 0; k < c.attributes.length; k++) a[c.attributes[k].name.toLowerCase()] = c.attributes[k].value;
          if (tag === 'img' && c.currentSrc) a.src = c.currentSrc;
          if (tag === 'a' && c.href) a.href = c.href;
          var node = { t: tag, a: a, c: [], p: parent };
          parent.c.push(node);
          if (c.shadowRoot) rec(c.shadowRoot, node);
          rec(c, node);
        }
      }
    })(el, root);
    return root;
  }

  /* What a deal applies to, in plain words */
  function appliesTo(d, p) {
    var s = d.scope || {};
    if (d.kind === 'product') return (d.product && d.product.name) || d.title;
    if (d.kind === 'cardoffer') return 'Purchases at ' + d.brand + ' paid with ' + ((PROGRAMS[d.card] || {}).payWith || 'that card');
    if (d.kind === 'portal') return 'Purchases at ' + d.brand + ' started from Capital One Shopping';
    if (s.type === 'order') {
      var t = 'Your whole order';
      var min = s.min || (p && p.minSpend) || (p && p.freeShip && !p.pct && !p.amt && p.freeShipMin);
      if (p && p.tiers && p.tiers.length) t += ', more off as you spend more (from ' + money(p.tiers[0].min) + ')';
      else if (min) t += ' of ' + money(min) + ' or more';
      if (p && p.exclSale) t += ', not counting sale items';
      else if (p && (p.exclusions || p.select)) t += ' (some exclusions)';
      if (s.assumed && !(p && (p.exclSale || p.exclusions || p.select))) t += ' (no limits were listed with the code)';
      return t;
    }
    if (s.type === 'category') return s.label + (s.items && s.items.length ? ' (' + s.items.length + (s.items.length === 1 ? ' example item' : ' example items') + ' in the details)' : '');
    if (s.type === 'items') return (s.items || []).length + ' specific items';
    if (s.type === 'product') return s.label;
    return 'Not stated';
  }

  function isWholeOrder(d) { return !!(d && d.scope && d.scope.type === 'order' && (d.kind === 'code' || d.kind === 'sale')); }

  /* ------------------------------------------------------------------ */
  /* Records                                                             */
  /* ------------------------------------------------------------------ */

  var SOURCE_RANK = { card: 5, costco: 4, feed: 4, email: 4, official: 3, you: 3, community: 1, sample: 0 };
  var DEFAULT_LIFE = { community: 10, email: 21, card: 10, costco: 30, feed: 30, you: 30, sample: 30 };

  // Turn a found offer into a stored record. Everything the app shows is
  // re-read from the stored text, so better reading rules apply to old finds.
  function makeRecord(raw, now) {
    now = now ? new Date(now) : new Date();
    var domain = raw.domain || 'unknown';
    var kind = raw.kind || (raw.code ? 'code' : 'sale');
    var code = raw.code ? String(raw.code).toUpperCase() : null;
    var title = clean(raw.title).slice(0, 220);
    var terms = clean(raw.terms || '').slice(0, 2400);
    var p = parseTerms(title, terms, { refDate: raw.posted || now, kind: kind, code: code, card: raw.card });
    var expires = raw.expires || p.expires || null;
    if (!expires && DEFAULT_LIFE[raw.sourceType]) {
      expires = isoDay(addDays(raw.posted ? new Date(raw.posted) : now, DEFAULT_LIFE[raw.sourceType]));
    }
    var id;
    if (kind === 'cardoffer') id = domain + '|card:' + (raw.card || 'other');
    else if (kind === 'portal') id = domain + '|portal:' + (raw.portal || 'c1shopping');
    else if (kind === 'product') id = domain + '|P:' + hashStr(String(raw.url || title).split('#')[0].replace(/[?&](utm_[^&]*|ref[^&]*|cid=[^&]*)/g, '') + '|' + (raw.sourceType === 'community' ? 'c' : ''));
    else if (code) id = domain + '|C:' + code;
    else if (raw.sourceType === 'community' && raw.url) id = domain + '|L:' + hashStr(raw.url);
    else id = domain + '|S:' + hashStr(normName(title).slice(0, 60) + '|' + ((raw.scope && raw.scope.label) || ''));
    var brand = BY_DOMAIN[domain];
    var scope = raw.scope ? {
      type: raw.scope.type, label: raw.scope.label ? String(raw.scope.label).slice(0, 90) : null,
      min: raw.scope.min || null, assumed: !!raw.scope.assumed,
      items: (raw.scope.items || []).slice(0, 8).map(function (it) { return { n: String(it.n || '').slice(0, 120), u: it.u || null, p: it.p || null, w: it.w || null, i: it.i || null, s: it.s || null }; })
    } : null;
    if (scope && !scope.items.length) delete scope.items;
    var data = {
      v: 2,
      domain: domain,
      brand: raw.brand || (brand && brand.name) || domain,
      kind: kind,
      title: title,
      code: code,
      url: raw.url || (brand && brand.url) || null,
      terms: terms,
      termsUrl: raw.termsUrl || null,
      termsFound: raw.termsFound == null ? !!terms : !!raw.termsFound,
      headline: raw.headline ? clean(raw.headline).slice(0, 160) : null,
      section: raw.section ? clean(raw.section).slice(0, 90) : null,
      scope: scope,
      product: raw.product ? { name: clean(raw.product.name).slice(0, 160), price: raw.product.price, was: raw.product.was || null, pct: raw.product.pct || (raw.product.was ? Math.round((1 - raw.product.price / raw.product.was) * 100) : null), img: raw.product.img || null, stock: raw.product.stock || null, from: !!raw.product.from } : null,
      cat: raw.cat || classify(title + ' ' + terms, brand ? brand.cat : null),
      sourceType: raw.sourceType || 'official',
      sourceName: raw.sourceName || '',
      sourceUrl: raw.sourceUrl || null,
      pageUrl: raw.pageUrl || null,
      card: raw.card || null,
      portal: raw.portal || null,
      price: raw.price || (raw.product && raw.product.price) || null,
      votes: raw.votes == null ? null : raw.votes,
      posted: raw.posted ? isoDay(raw.posted) : null,
      expires: expires,
      expSet: !!(raw.expires || p.expires),
      item: !!(kind === 'product' || raw.item || raw.sourceType === 'costco' || (scope && scope.type === 'product') || p.singleItem),
      guessed: !!raw.guessed,
      personal: !!raw.personal
    };
    if (!data.product) delete data.product;
    if (!data.scope) delete data.scope;
    return { id: id, domain: domain, kind: kind, rank: SOURCE_RANK[data.sourceType] || 1, expires: expires, data: data };
  }

  // A deal is only kept when it says what it is worth, what it applies to and where to use it.
  function isComplete(rec) {
    var d = rec.data || rec.d || rec;
    if (!d.url) return false;
    if (d.kind === 'product') return !!(d.product && d.product.price > 0 && d.product.name);
    if (d.kind === 'cardoffer' || d.kind === 'portal') return true;
    var p = parseTerms(d.title, d.terms, {});
    var hasValue = p.pct || p.amt || p.bogo || p.cashPct || p.cashAmt || (p.tiers && p.tiers.length) || (p.freeShip && p.freeShipMin) || d.price || d.code;
    return !!(hasValue && d.scope && d.scope.type && d.scope.type !== 'unknown');
  }

  /* ------------------------------------------------------------------ */
  /* How sure we are a coupon works                                      */
  /* ------------------------------------------------------------------ */

  var SOURCE_BASE = { card: 84, costco: 82, feed: 80, email: 74, official: 70, you: 70, community: 48, sample: 62 };
  var OFFICIAL_TYPES = { card: 1, costco: 1, feed: 1, email: 1, official: 1 };

  function hoursSince(iso, now) {
    if (!iso) return null;
    var t = new Date(iso).getTime();
    if (isNaN(t)) return null;
    return (now.getTime() - t) / 3600000;
  }

  function sourceSentence(d) {
    var b = d.brand || 'the store';
    switch (d.sourceType) {
      case 'official': return 'Found on ' + b + "'s own website";
      case 'email': return 'Sent to you by ' + b + ' by email';
      case 'card': {
        var prog = PROGRAMS[d.card] || PROGRAMS[d.portal] || null;
        return 'Saved from your ' + (prog ? prog.pageName : 'card offers page');
      }
      case 'costco': return "From Costco's member savings";
      case 'feed': return 'From ' + b + "'s official coupon feed";
      case 'community': return 'Posted by shoppers on ' + (d.sourceName || 'a deal forum');
      case 'you': return 'Added by you';
      case 'sample': return 'Sample deal for the preview';
      default: return 'Source: ' + (d.sourceName || 'unknown');
    }
  }

  function agoText(hours) {
    if (hours == null) return '';
    if (hours < 1) return 'just now';
    if (hours < 24) return Math.round(hours) + ' hr ago';
    var d = Math.round(hours / 24);
    return d + (d === 1 ? ' day ago' : ' days ago');
  }

  // rec: { id, d (stored data), fs, ls }, ctx: { now, sight: {id: n}, tests: [{deal_id, ok, saved, at}] }
  function assess(rec, ctx) {
    ctx = ctx || {};
    var now = ctx.now ? new Date(ctx.now) : new Date();
    var d = rec.d;
    var reasons = [];
    var score = SOURCE_BASE[d.sourceType] != null ? SOURCE_BASE[d.sourceType] : 50;
    reasons.push({ t: sourceSentence(d), good: !!OFFICIAL_TYPES[d.sourceType] });

    var p = parseTerms(d.title, d.terms, { refDate: d.posted || rec.fs || now, kind: d.kind, code: d.code, card: d.card || d.portal, store: d.domain, expires: d.expSet ? d.expires : null, price: d.price });
    p.item = isItemDeal(d, p);
    var expires = p.expires || d.expires || null;
    var daysLeft = null;
    var expired = false;
    if (expires) {
      daysLeft = Math.round((new Date(expires + 'T23:59:59Z').getTime() - now.getTime()) / DAY);
      if (daysLeft < 0) expired = true;
      else if (p.expires) { score += 6; reasons.push({ t: daysLeft === 0 ? 'Ends today' : 'Ends ' + fmtDay(expires) + ' (' + daysLeft + (daysLeft === 1 ? ' day left)' : ' days left)'), good: true }); }
    } else if (d.sourceType === 'community') {
      reasons.push({ t: 'No end date was posted', good: false });
    }

    var lsH = hoursSince(rec.ls, now);
    if (d.sourceType === 'official' || d.sourceType === 'feed') {
      if (lsH != null && lsH < 30) { score += 6; reasons.push({ t: 'Still on the site as of ' + agoText(lsH), good: true }); }
      else if (lsH != null && lsH > 72) { score -= 15; reasons.push({ t: 'Not seen on the site for ' + Math.round(lsH / 24) + ' days', good: false }); }
    }
    if (d.sourceType === 'card' && lsH != null) {
      reasons.push({ t: 'Saved ' + agoText(lsH), good: lsH < 24 * 7 });
      if (lsH > 24 * 7) score -= 10;
    }
    if (d.sourceType === 'community') {
      var postedH = hoursSince(d.posted || rec.fs, now);
      if (postedH != null) {
        var days = postedH / 24;
        if (days > 2) score -= Math.min(25, Math.round((days - 2) * 3));
        reasons.push({ t: 'Posted ' + agoText(postedH), good: days <= 2 });
      }
    }

    if (d.sourceType === 'community' && d.votes != null) {
      if (d.votes >= 10) { score += 12; reasons.push({ t: d.votes + ' thumbs up from shoppers', good: true }); }
      else if (d.votes >= 3) { score += 6; reasons.push({ t: d.votes + ' thumbs up from shoppers', good: true }); }
      else if (d.votes <= -2) { score -= 15; reasons.push({ t: 'Shoppers voted it down', good: false }); }
    }

    var n = ctx.sight && ctx.sight[rec.id];
    if (n && n > 1) { score += Math.min(16, 8 * (n - 1)); reasons.push({ t: 'Seen in ' + n + ' places', good: true }); }

    var verdict = null;
    if (d.kind === 'product' && d.product) {
      verdict = priceVerdict(ctx.pstats && ctx.pstats[rec.id], d.product, now);
      if (verdict) {
        reasons.push({ t: verdict.text, good: verdict.good === true, bad: verdict.good === false });
        if (verdict.code === 'always') score -= 12;
        if (verdict.code === 'higher') score -= 8;
        if (verdict.code === 'low') score += 6;
      }
      if (d.product.stock === 'out') { reasons.push({ t: 'Out of stock when last checked', good: false }); score -= 20; }
    }
    if ((d.kind === 'code' || d.kind === 'sale') && d.v >= 2 && !d.termsFound) reasons.push({ t: 'Terms not posted on the page it came from', good: false });

    var tests = (ctx.tests || []).filter(function (t) { return t.deal_id === rec.id; });
    tests.sort(function (a, b) { return a.at < b.at ? -1 : 1; });
    var status;
    var last = tests.length ? tests[tests.length - 1] : null;
    var okCount = tests.filter(function (t) { return t.ok; }).length;
    if (last && last.ok) {
      score = Math.min(99, Math.max(score, 90) + Math.min(8, okCount * 2));
      status = 'tested';
      reasons.unshift({ t: 'Worked at checkout ' + fmtDay(last.at) + (last.saved ? ' and saved ' + money(last.saved) : '') + (last.via === 'you' ? ' (you marked it)' : ''), good: true });
    } else if (last && !last.ok) {
      score = Math.min(score, 20);
      status = 'failed';
      reasons.unshift({ t: "Didn't work at checkout " + fmtDay(last.at) + (last.via === 'you' ? ' (you marked it)' : ''), good: false });
    } else if (OFFICIAL_TYPES[d.sourceType]) status = 'official';
    else if (score >= 55) status = 'likely';
    else status = 'unconfirmed';
    if (expired) status = 'expired';

    score = Math.max(1, Math.min(99, Math.round(score)));
    return { score: score, status: status, reasons: reasons, expires: expires, daysLeft: daysLeft, terms: p, tests: tests, verdict: verdict, applies: appliesTo(d, p), whole: isWholeOrder(d) };
  }

  // "Is it really a deal?": compares today's price with what the app has seen before.
  // st: { first_seen, price, price_since, low, low_at, high_reg, days }
  function priceVerdict(st, prod, now) {
    now = now ? new Date(now) : new Date();
    if (!st || !st.first_seen) return { code: 'new', text: 'Price tracking starts today. Check back to see if this price is unusual.', good: null };
    var since = st.price_since ? Math.max(0, Math.floor((now.getTime() - Date.parse(st.price_since + 'T00:00:00Z')) / DAY)) : 0;
    var tracked = Math.max(0, Math.floor((now.getTime() - Date.parse(String(st.first_seen).slice(0, 10) + 'T00:00:00Z')) / DAY));
    if (st.low != null && prod.price > st.low + 0.009) return { code: 'higher', text: 'It was ' + money(st.low) + ' on ' + fmtDay(st.low_at) + ', lower than now', good: false };
    if (tracked < 3) return { code: 'new', text: 'Price tracked since ' + fmtDay(st.first_seen) + '. Too soon to tell if it is unusual.', good: null };
    if (since >= 21) return { code: 'always', text: 'Same "sale" price for ' + since + ' days, so it may just be the normal price', good: false };
    if (since <= 3 && tracked >= 7) return { code: 'low', text: 'Lowest price since tracking began ' + fmtDay(st.first_seen), good: true };
    return { code: 'steady', text: 'At this price for ' + since + (since === 1 ? ' day' : ' days') + '; the lowest seen since ' + fmtDay(st.first_seen), good: null };
  }

  var STATUS = {
    tested: { label: 'Tested', note: 'Worked at a real checkout' },
    official: { label: 'Official', note: 'From the store, your email or your card' },
    likely: { label: 'Likely', note: 'Recent and backed up' },
    unconfirmed: { label: 'Unconfirmed', note: 'One source, not checked yet' },
    failed: { label: "Didn't work", note: 'Failed at checkout' },
    expired: { label: 'Expired', note: 'Past its end date' }
  };

  /* ------------------------------------------------------------------ */
  /* What a deal is worth                                                */
  /* ------------------------------------------------------------------ */

  // Dollars saved on a cart of `amount`, plus how far short of a minimum you are.
  function dealValue(p, amount) {
    amount = amount || 100;
    if (p.tiers && p.tiers.length >= 2) {
      var got = null;
      var next = null;
      p.tiers.forEach(function (t) { if (amount >= t.min) got = t; else if (!next) next = t; });
      if (!got) return { amt: 0, short: p.tiers[0].min - amount, next: { need: p.tiers[0].min - amount, amt: p.tiers[0].amt } };
      return { amt: got.amt, short: 0, next: next ? { need: next.min - amount, amt: next.amt } : null };
    }
    if (p.minSpend && amount < p.minSpend) return { amt: 0, short: p.minSpend - amount };
    var v = 0;
    if (p.pct) v = amount * p.pct / 100 * (p.upTo ? 0.4 : p.scoped ? 0.5 : 1);
    else if (p.amt) v = Math.min(p.amt, amount);
    else if (p.bogo) v = amount * 0.25;
    else if (p.cashPct) v = amount * p.cashPct / 100 * (p.upTo ? 0.6 : 1);
    else if (p.cashAmt) v = Math.min(p.cashAmt, amount);
    if (p.cap && v > p.cap) v = p.cap;
    return { amt: v, short: 0 };
  }

  // Deals on one product (a Costco item, a forum post about a TV) rather than the whole order.
  function isItemDeal(d, p) {
    if (!d) return !!(p && p.singleItem);
    if (d.kind === 'cardoffer' || d.kind === 'portal') return false;
    if (d.kind === 'product') return true;
    if (d.v >= 2) return !!(d.item || (d.scope && d.scope.type === 'product'));
    return !!(d.item || d.sourceType === 'costco' || (d.sourceType === 'community' && d.price) || (p && p.singleItem));
  }

  // A rough "percent off a typical order" used to rank deals against each other.
  function typicalPct(p, d) {
    if (d && d.kind === 'product' && d.product) return Math.min(60, d.product.pct || 0);
    if (isItemDeal(d, p)) {
      if (p.pct) return Math.min(p.pct * (p.upTo ? 0.4 : 1), 40);
      if (p.amt && d && d.price) return Math.min(40, p.amt / (d.price + p.amt) * 100);
      if (p.amt) return 15;
      if (p.bogo) return 25;
      return 12;
    }
    var basket = Math.max(100, p.minSpend || 0);
    var v = dealValue(p, basket).amt;
    var pct = v / basket * 100;
    if (!pct && p.freeShip) pct = 2;
    return pct;
  }

  /* ------------------------------------------------------------------ */
  /* Cards                                                               */
  /* ------------------------------------------------------------------ */

  var PROGRAMS = {
    capitalone: { name: 'Capital One Offers', pageName: 'Capital One Offers page', payWith: 'the Capital One card the offer is on', activate: 'Open Capital One Offers, tap this store\'s offer, and shop in the tab it opens.', url: 'https://www.capitalone.com/' },
    citi: { name: 'Citi offers', pageName: 'Citi offers page', payWith: 'your Costco Visa', activate: 'Add the offer to your card on Citi\'s site or app first.', url: 'https://online.citi.com/' },
    venmo: { name: 'Venmo offers', pageName: 'Venmo offers screen', payWith: 'your Venmo Debit Card', activate: 'Activate the offer in the Venmo app (Cards tab) before you pay.', url: 'https://venmo.com/' },
    c1shopping: { name: 'Capital One Shopping', pageName: 'Capital One Shopping page', payWith: 'any card', activate: 'Activate rewards for this store on Capital One Shopping, then shop in that tab.', url: 'https://capitaloneshopping.com/' }
  };

  var CARDS = [
    { id: 'quicksilver', name: 'Capital One Quicksilver', short: 'Quicksilver', program: 'capitalone', unit: 'cash', base: 1.5, rates: { c1hotel: 5 } },
    { id: 'savor', name: 'Capital One Savor', short: 'Savor', program: 'capitalone', unit: 'cash', base: 1, rates: { dining: 3, grocery: 3, entertainment: 3, streaming: 3, c1hotel: 5 } },
    { id: 'ventureone', name: 'Capital One VentureOne', short: 'VentureOne', program: 'capitalone', unit: 'miles', base: 1.25, rates: { c1hotel: 5 } },
    { id: 'venturex', name: 'Capital One Venture X', short: 'Venture X', program: 'capitalone', unit: 'miles', base: 2, rates: { c1hotel: 10, c1flight: 5 } },
    { id: 'costco', name: 'Costco Anywhere Visa by Citi', short: 'Costco Visa', program: 'citi', unit: 'cash', base: 1, rates: { costco_gas: 5, gas: 4, dining: 3, travel: 3, costco: 2 } },
    { id: 'venmo', name: 'Venmo Debit Card', short: 'Venmo Debit', program: 'venmo', unit: 'cash', base: 0, rates: {} }
  ];
  var CARD_BY_ID = {};
  CARDS.forEach(function (c) { CARD_BY_ID[c.id] = c; });

  var CARD_NOTES = {
    quicksilver: ['1.5% cash back on everything', '5% on hotels and rental cars booked through Capital One Travel'],
    savor: ['3% at grocery stores (not Walmart or Target), on dining, entertainment and popular streaming', '8% on Capital One Entertainment tickets', '5% on hotels and rental cars through Capital One Travel', '1% on everything else'],
    ventureone: ['1.25 miles per $1 on everything', '5 miles per $1 on hotels and rental cars through Capital One Travel', 'Miles counted at 1 cent each here'],
    venturex: ['2 miles per $1 on everything', '10 miles per $1 on hotels and rental cars, 5 on flights, through Capital One Travel', 'Miles counted at 1 cent each here'],
    costco: ['5% on gas at Costco, 4% on other gas and EV charging (first $7,000 a year combined, then 1%)', '3% on restaurants and travel, including Costco Travel', '2% on everything else at Costco and Costco.com', '1% everywhere else', 'Paid once a year as a Costco reward certificate'],
    venmo: ['Venmo Stash: 1%, 2% with auto reload, or 5% with $500+ monthly direct deposits, at the brands in your chosen bundle', 'Stash is capped at $100 a month', 'Limited-time offers must be activated in the Venmo app']
  };

  var DEFAULT_SETTINGS = {
    cards: ['quicksilver', 'savor', 'venturex', 'costco', 'venmo'],
    categories: [],
    stash: { tier: 1, brands: [] },
    plan: [],
    autoTest: true
  };

  // Reward rate (percent-equivalent) a card earns at a store.
  function rewardRate(cardId, store, settings) {
    var c = CARD_BY_ID[cardId];
    if (!c) return { pct: 0, note: '' };
    var mcc = store && store.mcc || 'online';
    var pct = c.base;
    var note = c.unit === 'miles' ? c.base + 'x miles' : pctStr(c.base) + ' back';
    if (c.rates[mcc] != null) { pct = c.rates[mcc]; note = c.unit === 'miles' ? pct + 'x miles' : pctStr(pct) + ' back'; }
    if (cardId === 'costco' && store && store.domain === 'costco.com') { pct = 2; note = '2% back at Costco'; }
    if (cardId === 'venmo') {
      var st = (settings && settings.stash) || {};
      var inBundle = (st.brands || []).indexOf(store && store.domain) >= 0;
      if (inBundle) { pct = st.tier || 1; note = 'Venmo Stash ' + pctStr(pct) + ' back'; }
      else { pct = 0; note = 'No Stash reward here'; }
    }
    if (c.unit === 'miles') note += ' (≈' + pctStr(pct) + ')';
    return { pct: pct, note: note };
  }

  function storeFor(domain, deals) {
    var b = BY_DOMAIN[domain];
    if (b) return b;
    var d = deals && deals[0] && deals[0].d;
    return { name: d ? d.brand : domain, domain: domain, cat: d ? d.cat : 'general', mcc: 'online', url: d ? d.url : null };
  }

  /* ------------------------------------------------------------------ */
  /* The most efficient way to use the deals at one store                */
  /* ------------------------------------------------------------------ */

  // items: assessed deals for this store: [{ rec, a }] where a = assess(rec)
  function planForStore(store, items, settings, amount) {
    settings = settings || DEFAULT_SETTINGS;
    amount = amount > 0 ? amount : 100;
    var usable = (items || []).filter(function (x) { return x.a.status !== 'failed' && x.a.status !== 'expired'; });

    // Best store discount (a code or an automatic sale), weighed by how sure we are it works.
    // Only deals that take money off the whole order count here. Deals on certain
    // items are listed separately, since they depend on what is in the cart.
    var discounts = usable.filter(function (x) { var t = x.a.terms; var d = x.rec.d; return (d.kind === 'code' || d.kind === 'sale') && (d.v >= 2 ? isWholeOrder(d) : !isItemDeal(d, t)) && !t.storeCard && !t.verify && !t.newCust; }).map(function (x) {
      var v = dealValue(x.a.terms, amount);
      return { x: x, value: v.amt, short: v.short, next: v.next || null, weighted: v.amt * (0.35 + 0.65 * x.a.score / 100) };
    });
    var partial = usable.filter(function (x) { var d = x.rec.d; return (d.kind === 'code' || d.kind === 'sale') && d.v >= 2 && !isWholeOrder(d) && d.scope && d.scope.type === 'category'; })
      .sort(function (a, b) { return typicalPct(b.a.terms, b.rec.d) - typicalPct(a.a.terms, a.rec.d); }).slice(0, 3);
    discounts.sort(function (a, b) { return b.weighted - a.weighted; });
    var disc = discounts.length && discounts[0].value > 0 ? discounts[0] : null;
    var nearMiss = discounts.filter(function (d) { return d.short > 0; }).sort(function (a, b) { return a.short - b.short; })[0] || null;

    var portal = best(usable.filter(function (x) { return x.rec.d.kind === 'portal'; }));
    var offers = {};
    ['capitalone', 'citi', 'venmo'].forEach(function (prog) {
      offers[prog] = best(usable.filter(function (x) { return x.rec.d.kind === 'cardoffer' && x.rec.d.card === prog; }));
    });

    function best(list) {
      var top = null, topV = 0;
      list.forEach(function (x) {
        var v = dealValue(x.a.terms, amount).amt;
        if (v > topV) { top = { x: x, value: v }; topV = v; }
      });
      return top;
    }

    var discAmt = disc ? disc.value : 0;
    var paid = Math.max(0, amount - discAmt);
    var options = [];
    var cards = (settings.cards && settings.cards.length ? settings.cards : DEFAULT_SETTINGS.cards).filter(function (id) { return CARD_BY_ID[id]; });

    cards.forEach(function (cardId) {
      var card = CARD_BY_ID[cardId];
      var parts = [];
      var steps = [];
      var notes = [];
      var rr = rewardRate(cardId, store, settings);
      var cardOffer = offers[card.program] || null;
      var offerVal = cardOffer ? dealValue(cardOffer.x.a.terms, paid).amt : 0;
      var portalVal = portal ? dealValue(portal.x.a.terms, paid).amt : 0;
      var usePortal = false, useOffer = false;

      if (card.program === 'capitalone') {
        // Capital One Offers and Capital One Shopping both track you by the link you
        // click, so only one of them counts on an order. Use the bigger one.
        if (offerVal > 0 && offerVal >= portalVal) { useOffer = true; if (portalVal > 0) notes.push('Skip Capital One Shopping here. Both track the order by the link you click, so only one would count.'); }
        else if (portalVal > 0) { usePortal = true; if (offerVal > 0) notes.push('Capital One Shopping pays more here than your Capital One Offer, and only one can track the order.'); }
      } else {
        if (offerVal > 0) useOffer = true;
        if (portalVal > 0) usePortal = true;
      }

      // Steps, in the order you do them
      if (useOffer && card.program === 'venmo') steps.push('Open the Venmo app, go to your Venmo Debit Card, and activate the ' + store.name + ' offer.');
      if (useOffer && card.program === 'citi') steps.push('Add the ' + store.name + ' offer to your Costco Visa on Citi\'s site or app.');
      if (useOffer && card.program === 'capitalone') steps.push('Open Capital One Offers, tap the ' + store.name + ' offer, and shop in the tab it opens. Don\'t switch tabs.');
      if (usePortal) steps.push('Open Capital One Shopping, activate rewards for ' + store.name + ', and shop in the tab it opens.');
      if (!store.pseudo) {
        var cartStep = 'Add your items to the cart';
        if (disc && disc.x.a.terms.minSpend) cartStep += ' (at least ' + money(disc.x.a.terms.minSpend) + ')';
        steps.push(cartStep + '.');
      }
      if (disc) {
        var dd = disc.x.rec.d;
        if (dd.code) steps.push('Enter code ' + dd.code + ' at checkout. The Safari add-on can test it for you.');
        else steps.push(store.domain === 'costco.com' ? 'The ' + (dd.title.length < 60 ? dd.title : 'member savings') + ' discount comes off automatically.' : 'The sale price applies automatically. No code needed.');
      }
      steps.push('Pay with your ' + card.short + '.');

      if (disc) parts.push({ label: disc.x.rec.d.code ? 'Code ' + disc.x.rec.d.code : 'Store discount', amt: discAmt, kind: 'discount' });
      if (useOffer) parts.push({ label: PROGRAMS[card.program].name, amt: offerVal, kind: 'offer' });
      if (usePortal) parts.push({ label: 'Capital One Shopping', amt: portalVal, kind: 'portal' });
      var rewardAmt = paid * rr.pct / 100;
      var stashCapped = false;
      if (cardId === 'venmo' && rr.pct > 0 && rewardAmt > 100) { rewardAmt = 100; stashCapped = true; }
      if (rewardAmt > 0) parts.push({ label: card.short + ' rewards (' + rr.note + ')', amt: rewardAmt, kind: 'reward' });

      if (usePortal && disc && disc.x.rec.d.code) notes.push('Some stores cancel shopping-portal rewards when you use a code the portal doesn\'t list. The code is still usually worth it.');
      if (cardId === 'venmo' && rr.pct > 0) notes.push('Venmo Stash pays up to $100 a month in total' + (stashCapped ? '; this order hits that cap.' : '.'));
      if (store.domain === 'costco.com' || store.mcc === 'costco_gas') notes.push('Costco warehouses only take Visa credit cards. Your Costco card is a Visa.');
      if (cardId === 'costco' && (store.mcc === 'gas' || store.mcc === 'costco_gas')) notes.push('The gas rate applies to the first $7,000 of gas and EV charging each year, then drops to 1%.');
      if (card.unit === 'miles') notes.push('Miles are counted at 1 cent each.');

      var total = parts.reduce(function (s, x) { return s + x.amt; }, 0);
      options.push({
        card: card, cardId: cardId, parts: parts, steps: steps, notes: notes.filter(Boolean), bonus: rr.pct > card.base ? 1 : 0,
        total: total, totalPct: amount ? total / amount * 100 : 0, paidAfter: paid - (total - discAmt)
      });
    });

    options.sort(function (a, b) { return (b.total - a.total) || (b.bonus - a.bonus) || (b.card.base - a.card.base); });
    var warnings = [];
    if (disc && disc.next && disc.next.amt > discAmt) warnings.push('Spend ' + money(disc.next.need) + ' more to get ' + money(disc.next.amt) + ' off instead of ' + money(discAmt) + '.');
    else if (nearMiss && (!disc || nearMiss.x.rec.id !== disc.x.rec.id)) {
      var nv = dealValue(nearMiss.x.a.terms, (nearMiss.x.a.terms.tiers ? nearMiss.x.a.terms.tiers[0].min : nearMiss.x.a.terms.minSpend));
      if (nv.amt > discAmt) warnings.push('Spend ' + money(nearMiss.short) + ' more to unlock ' + (nearMiss.x.a.terms.headline || 'a bigger discount') + '.');
    }
    var also = partial.map(function (x) { return { x: x, text: (x.a.terms.headline || x.rec.d.title) + ' on ' + (x.rec.d.scope.label || 'certain items') + (x.rec.d.code ? ' (code ' + x.rec.d.code + ')' : '') }; });
    return { store: store, amount: amount, discount: disc, options: options, best: options[0] || null, warnings: warnings, also: also };
  }

  /* ------------------------------------------------------------------ */
  /* Recommendations                                                     */
  /* ------------------------------------------------------------------ */

  // Which list entries a deal covers. A deal that only shares the entry's
  // category (a sitewide shoe sale for "running shoes") counts as a looser match.
  function planMatches(plan, rec, opts) {
    var d = rec.d;
    var hits = [];
    var allowLoose = !opts || opts.loose !== false;
    (plan || []).forEach(function (item) {
      var q = String(item.text || item || '').toLowerCase().trim();
      if (!q) return;
      if (item.type === 'category' || CAT_BY_ID[q]) { if (d.cat === (item.cat || q)) hits.push(item); return; }
      var b = brandByName(q);
      if (b) { if (b.domain === d.domain) hits.push(item); return; }
      var hay = (d.brand + ' ' + d.title + ' ' + d.terms).toLowerCase();
      var words = q.split(/\s+/).filter(function (w) { return w.length > 2; });
      var stems = words.map(function (w) { return w.replace(/(es|s)$/, ''); });
      if (stems.length && stems.every(function (w) { return hay.indexOf(w) >= 0; })) { hits.push(item); return; }
      if (!allowLoose) return;
      var qcs = categoriesIn(q);
      if (qcs.indexOf(d.cat) >= 0 && (d.kind === 'code' || d.kind === 'sale') && !isItemDeal(d)) hits.push({ text: item.text, type: item.type, loose: true });
    });
    return hits;
  }

  // list: [{ rec, a }]; returns the same objects with .rank and .why, best first.
  function recommend(list, settings, extrasByDomain) {
    settings = settings || DEFAULT_SETTINGS;
    var cats = settings.categories || [];
    var hidden = settings.hidden || [];
    var favs = settings.favorites || [];
    var out = [];
    list.forEach(function (x) {
      var d = x.rec.d;
      if (x.a.status === 'failed' || x.a.status === 'expired') return;
      if (d.kind === 'portal') return;
      if (hidden.indexOf(d.domain) >= 0) return;
      if (d.kind === 'product' && d.product && d.product.stock === 'out') return;
      var why = [];
      var value = typicalPct(x.a.terms, d);
      if (d.kind === 'cardoffer') value = value * 0.9;
      if (!value) return;
      var rank = Math.min(value, 60) * (0.3 + 0.7 * x.a.score / 100);
      if (cats.length) {
        if (cats.indexOf(d.cat) >= 0) { rank *= 1.35; why.push('In your categories'); }
        else rank *= 0.55;
      }
      var hits = planMatches(settings.plan, x.rec);
      var strong = hits.filter(function (hh) { return !hh.loose; });
      if (strong.length) { rank *= 1.7; why.push('On your list: ' + (strong[0].text || strong[0])); }
      else if (hits.length) { rank *= 1.2; why.push('Could cover ' + hits[0].text + ' on your list'); }
      if (x.a.daysLeft != null && x.a.daysLeft <= 3) { rank *= 1.12; why.push(x.a.daysLeft === 0 ? 'Ends today' : 'Ends in ' + x.a.daysLeft + (x.a.daysLeft === 1 ? ' day' : ' days')); }
      if (x.a.status === 'tested') { rank *= 1.15; why.push('Worked at checkout'); }
      var extra = extrasByDomain && extrasByDomain[d.domain];
      if (extra && extra > 3 && d.kind !== 'cardoffer' && d.kind !== 'product' && !isItemDeal(d, x.a.terms)) { rank *= 1 + Math.min(0.5, extra / 20); why.push('Stacks with ' + pctStr(extra) + ' more from your cards and offers'); }
      if (favs.indexOf(d.domain) >= 0) { rank *= 1.3; why.push('One of your stores'); }
      if (x.a.verdict) {
        if (x.a.verdict.code === 'always') rank *= 0.35;
        else if (x.a.verdict.code === 'higher') rank *= 0.5;
        else if (x.a.verdict.code === 'low') { rank *= 1.25; why.push('Lowest price we have seen'); }
        else rank *= 0.8;
      }
      if (d.kind === 'code' && isWholeOrder(d)) rank *= 1.15;
      if (x.a.terms.newCust) rank *= 0.75;
      if (x.a.terms.verify) rank *= 0.7;
      if (x.a.terms.storeCard) rank *= 0.35;
      if (x.a.terms.signup) rank *= 0.85;
      x.rank = rank;
      x.value = value;
      x.why = why;
      out.push(x);
    });
    out.sort(function (a, b) { return b.rank - a.rank; });
    return out;
  }

  // One line per store for the Stores list.
  function storeSummary(domain, items) {
    var s = { domain: domain, codes: 0, offers: 0, products: 0, cardOffers: 0, wholePct: 0, bestProductPct: 0, tested: 0, total: 0 };
    (items || []).forEach(function (x) {
      if (x.a.status === 'failed' || x.a.status === 'expired') return;
      var d = x.rec.d;
      s.total++;
      if (d.kind === 'code') s.codes++;
      else if (d.kind === 'sale') s.offers++;
      else if (d.kind === 'product') { s.products++; if (!(d.product && d.product.stock === 'out')) s.bestProductPct = Math.max(s.bestProductPct, (d.product && d.product.pct) || 0); }
      else s.cardOffers++;
      if (x.a.status === 'tested') s.tested++;
      if ((d.kind === 'code' || d.kind === 'sale') && isWholeOrder(d) && !x.a.terms.storeCard && !x.a.terms.newCust) s.wholePct = Math.max(s.wholePct, typicalPct(x.a.terms, d));
    });
    return s;
  }

  /* ------------------------------------------------------------------ */
  /* Ready-made tips                                                     */
  /* ------------------------------------------------------------------ */

  var RULES = [
    { t: 'Activate before you buy', b: 'Capital One Offers, Venmo offers, Citi offers and Capital One Shopping only pay out if they are switched on before you check out.' },
    { t: 'Stay in the tab that opens', b: 'Capital One Offers and Capital One Shopping track the order through the link you tap. Opening the store in a new tab can lose the reward.' },
    { t: 'Only one link-tracked reward per order', b: 'Capital One Offers and Capital One Shopping both track by link, so pick the bigger one. A card offer from Venmo or Citi is tied to the card, so it can stack with Capital One Shopping.' },
    { t: 'Codes can cancel portal rewards', b: 'Some stores drop shopping-portal cash back when you use a code the portal does not list. A big code is usually still worth it.' },
    { t: 'Pay with the card that earns most there', b: 'Savor for groceries, dining, streaming and entertainment. Costco Visa for gas, Costco and travel. Venture X or Quicksilver for everything else.' },
    { t: 'Watch the minimum', b: 'A "$20 off $100" code is 20% at $100 but nothing at $99. The Best Way tab tells you when a little more spend unlocks a bigger discount.' },
    { t: 'Costco needs no clipping', b: "Costco's monthly member savings come off automatically at the register or online. Pay in the warehouse with a Visa credit card." },
    { t: 'Codes beat "was" prices', b: 'A code takes money off whatever the store charges today. A crossed-out "was" price can be inflated, so the app tracks product prices over time and tells you when a "sale" price never changes.' }
  ];

  return {
    VERSION: VERSION,
    CATEGORIES: CATEGORIES,
    CAT_BY_ID: CAT_BY_ID,
    BRANDS: BRANDS,
    CARDS: CARDS,
    CARD_BY_ID: CARD_BY_ID,
    CARD_NOTES: CARD_NOTES,
    PROGRAMS: PROGRAMS,
    STATUS: STATUS,
    RULES: RULES,
    DEFAULT_SETTINGS: DEFAULT_SETTINGS,
    registrableDomain: registrableDomain,
    storeKey: storeKey,
    brandByDomain: brandByDomain,
    BY_DOMAIN_LOOKUP: byDomainLookup,
    brandByName: brandByName,
    guessDomainFromName: guessDomainFromName,
    normName: normName,
    hashStr: hashStr,
    clean: clean,
    isoDay: isoDay,
    parseHTML: parseHTML,
    nodeText: nodeText,
    lineText: lineText,
    walk: walk,
    readPage: readPage,
    recordsFromPage: recordsFromPage,
    productRecord: productRecord,
    shortItem: shortItem,
    termsFromPage: termsFromPage,
    pageTitle: pageTitle,
    dealLinks: dealLinks,
    findProducts: findProducts,
    findOffers: findOffers,
    scopeOf: scopeOf,
    tiersIn: tiersIn,
    pathLabel: pathLabel,
    pickRelevant: pickRelevant,
    fromDom: fromDom,
    absUrl: absUrl,
    sameStore: sameStore,
    appliesTo: appliesTo,
    isWholeOrder: isWholeOrder,
    isComplete: isComplete,
    priceVerdict: priceVerdict,
    storeSummary: storeSummary,
    isItemDeal: isItemDeal,
    fmtDay: fmtDay,
    money: money,
    pctStr: pctStr,
    agoText: agoText,
    hoursSince: hoursSince,
    parseExpiry: parseExpiry,
    extractCodes: extractCodes,
    parseTerms: parseTerms,
    htmlToText: htmlToText,
    decodeEntities: decodeEntities,
    extractOffersFromText: extractOffersFromText,
    parseOfferText: parseOfferText,
    parseCostcoText: parseCostcoText,
    classify: classify,
    categoriesIn: categoriesIn,
    makeRecord: makeRecord,
    assess: assess,
    dealValue: dealValue,
    typicalPct: typicalPct,
    rewardRate: rewardRate,
    storeFor: storeFor,
    planForStore: planForStore,
    planMatches: planMatches,
    recommend: recommend
  };
});


/*
 * Deal Stack hub (a Cloudflare Worker with static assets).
 * Serves the app and a small private API backed by a D1 database.
 *
 * Needs, in Cloudflare:
 *   - a D1 database binding named DB
 *   - a secret named APP_KEY (the same key you put in the app, GitHub and the add-ons)
 *
 * The deal engine is placed above this file when the project is built, so the hub
 * reads deals the same way as the app (see build.js).
 */

const E = globalThis.DealEngine;
const VERSION = '2.0.0';
const MAX_BODY = 2000000;
const DATA_VERSION = '2';

const SCHEMA = [
  `CREATE TABLE IF NOT EXISTS deals (id TEXT PRIMARY KEY, domain TEXT, source TEXT, kind TEXT, rank INTEGER DEFAULT 0, data TEXT, first_seen TEXT, last_seen TEXT, expires TEXT, gone INTEGER DEFAULT 0)`,
  `CREATE INDEX IF NOT EXISTS deals_domain ON deals(domain)`,
  `CREATE TABLE IF NOT EXISTS sightings (deal_id TEXT, source TEXT, last_seen TEXT, PRIMARY KEY (deal_id, source))`,
  `CREATE INDEX IF NOT EXISTS sightings_source ON sightings(source, last_seen)`,
  `CREATE TABLE IF NOT EXISTS tests (id INTEGER PRIMARY KEY AUTOINCREMENT, deal_id TEXT, domain TEXT, code TEXT, ok INTEGER, saved REAL, at TEXT, via TEXT)`,
  `CREATE INDEX IF NOT EXISTS tests_deal ON tests(deal_id)`,
  `CREATE TABLE IF NOT EXISTS kv (k TEXT PRIMARY KEY, v TEXT)`,
  // Price history for products, kept as a running summary (one row per product).
  `CREATE TABLE IF NOT EXISTS pstats (id TEXT PRIMARY KEY, first_seen TEXT, price REAL, price_since TEXT, low REAL, low_at TEXT, high_reg REAL, days INTEGER DEFAULT 1, last_day TEXT)`,
  // Phones that asked for alerts.
  `CREATE TABLE IF NOT EXISTS push_subs (endpoint TEXT PRIMARY KEY, sub TEXT, created TEXT, last_ok TEXT, fails INTEGER DEFAULT 0)`
];

let schemaReady = false;

const CORS = {
  'access-control-allow-origin': '*',
  'access-control-allow-methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'access-control-allow-headers': 'content-type, x-hub-key',
  'access-control-max-age': '86400'
};

function json(obj, status = 200, raw = false) {
  return new Response(raw ? obj : JSON.stringify(obj), {
    status,
    headers: Object.assign({ 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' }, CORS)
  });
}

function fail(message, status = 400) { return json({ ok: false, error: message }, status); }

function sameKey(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string' || !a || !b) return false;
  let diff = a.length ^ b.length;
  for (let i = 0; i < Math.max(a.length, b.length); i++) diff |= (a.charCodeAt(i % a.length) || 0) ^ (b.charCodeAt(i % b.length) || 0);
  return diff === 0;
}

async function ensureSchema(db) {
  if (schemaReady) return;
  await db.batch(SCHEMA.map(s => db.prepare(s)));
  // Deals saved before version 2 didn't record what they apply to. Clear them once;
  // the next collector run brings them back with full detail. Card offers are kept.
  const mig = await db.prepare("SELECT v FROM kv WHERE k = 'data_version'").first();
  if (!mig || mig.v !== DATA_VERSION) {
    await db.batch([
      db.prepare("DELETE FROM sightings WHERE deal_id IN (SELECT id FROM deals WHERE kind IN ('code','sale') AND (json_extract(data, '$.v') IS NULL OR json_extract(data, '$.v') < 2))"),
      db.prepare("DELETE FROM deals WHERE kind IN ('code','sale') AND (json_extract(data, '$.v') IS NULL OR json_extract(data, '$.v') < 2)"),
      db.prepare("INSERT INTO kv (k, v) VALUES ('data_version', ?1) ON CONFLICT(k) DO UPDATE SET v = excluded.v").bind(DATA_VERSION)
    ]);
  }
  schemaReady = true;
}

async function readBody(request) {
  const text = await request.text();
  if (text.length > MAX_BODY) throw new Error('That upload is too large.');
  try { return JSON.parse(text || '{}'); } catch (e) { throw new Error('The request was not valid JSON.'); }
}

function today() { return new Date().toISOString().slice(0, 10); }
function daysAgo(n) { return new Date(Date.now() - n * 86400000).toISOString(); }
function cleanDomain(d) { return String(d || '').toLowerCase().replace(/[^a-z0-9.:\-]/g, '').slice(0, 120); }

async function getKv(env, k, d) {
  const r = await env.DB.prepare('SELECT v FROM kv WHERE k = ?1').bind(k).first();
  if (!r || r.v == null) return d;
  try { return JSON.parse(r.v); } catch (e) { return d; }
}

async function putKv(env, key, value) {
  const v = JSON.stringify(value);
  if (v.length > 1500000) throw new Error('That is too much to save at once.');
  await env.DB.prepare('INSERT INTO kv (k, v) VALUES (?1, ?2) ON CONFLICT(k) DO UPDATE SET v = excluded.v').bind(key, v).run();
}

/* ---------------- Deals ---------------- */

async function getDeals(env, url) {
  const db = env.DB;
  const domain = cleanDomain(url.searchParams.get('domain'));
  const now = today();
  const since = daysAgo(60);
  const dealSql = 'SELECT id, data, first_seen, last_seen FROM deals WHERE gone = 0 AND (expires IS NULL OR expires >= ?1)' + (domain ? ' AND domain = ?2' : '') + ' LIMIT 9000';
  const dealStmt = domain ? db.prepare(dealSql).bind(now, domain) : db.prepare(dealSql).bind(now);
  const sightSql = domain
    ? 'SELECT s.deal_id, COUNT(*) AS n FROM sightings s JOIN deals d ON d.id = s.deal_id WHERE d.domain = ?1 AND s.last_seen >= ?2 GROUP BY s.deal_id HAVING n > 1'
    : 'SELECT deal_id, COUNT(*) AS n FROM sightings WHERE last_seen >= ?2 GROUP BY deal_id HAVING n > 1';
  const sightStmt = db.prepare(sightSql).bind(domain || '', daysAgo(14));
  const testSql = 'SELECT deal_id, ok, saved, at, via FROM tests WHERE at >= ?1' + (domain ? ' AND domain = ?2' : '') + ' ORDER BY at LIMIT 4000';
  const testStmt = domain ? db.prepare(testSql).bind(since, domain) : db.prepare(testSql).bind(since);
  const kvStmt = db.prepare("SELECT k, v FROM kv WHERE k = 'settings' OR k LIKE 'status:%'");
  const psSql = 'SELECT p.id, p.first_seen, p.price, p.price_since, p.low, p.low_at, p.high_reg, p.days FROM pstats p JOIN deals d ON d.id = p.id WHERE d.gone = 0' + (domain ? ' AND d.domain = ?1' : '');
  const psStmt = domain ? db.prepare(psSql).bind(domain) : db.prepare(psSql);
  const [deals, sight, tests, kv, ps] = await db.batch([dealStmt, sightStmt, testStmt, kvStmt, psStmt]);

  const sightMap = {};
  for (const r of sight.results || []) sightMap[r.deal_id] = r.n;
  const psMap = {};
  for (const r of ps.results || []) { const id = r.id; delete r.id; psMap[id] = r; }
  let settings = 'null';
  const status = {};
  for (const r of kv.results || []) {
    if (r.k === 'settings') settings = r.v || 'null';
    else status[r.k.slice(7)] = r.v;
  }
  // Built as text so large lists don't cost much processing time.
  const dealParts = (deals.results || []).map(r => '{"id":' + JSON.stringify(r.id) + ',"fs":' + JSON.stringify(r.first_seen) + ',"ls":' + JSON.stringify(r.last_seen) + ',"d":' + r.data + '}');
  const statusParts = Object.keys(status).map(k => JSON.stringify(k) + ':' + (status[k] || 'null'));
  const body = '{"ok":true,"version":' + JSON.stringify(VERSION) + ',"now":' + JSON.stringify(new Date().toISOString()) +
    ',"deals":[' + dealParts.join(',') + ']' +
    ',"sight":' + JSON.stringify(sightMap) +
    ',"tests":' + JSON.stringify(tests.results || []) +
    ',"pstats":' + JSON.stringify(psMap) +
    ',"settings":' + settings +
    ',"status":{' + statusParts.join(',') + '}}';
  return json(body, 200, true);
}

async function getDomains(env) {
  const res = await env.DB.prepare('SELECT DISTINCT domain FROM deals WHERE gone = 0 AND (expires IS NULL OR expires >= ?1)').bind(today()).all();
  return json({ ok: true, domains: (res.results || []).map(r => r.domain) });
}

async function ingest(env, body) {
  const db = env.DB;
  const source = String(body.source || 'unknown').slice(0, 120);
  const deals = Array.isArray(body.deals) ? body.deals.slice(0, 200) : [];
  const now = new Date().toISOString();
  const day = now.slice(0, 10);
  const stmts = [];
  const upsert = db.prepare(`INSERT INTO deals (id, domain, source, kind, rank, data, first_seen, last_seen, expires, gone)
    VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?7, ?8, 0)
    ON CONFLICT(id) DO UPDATE SET
      data = CASE WHEN excluded.rank >= deals.rank THEN excluded.data ELSE deals.data END,
      source = CASE WHEN excluded.rank >= deals.rank THEN excluded.source ELSE deals.source END,
      kind = CASE WHEN excluded.rank >= deals.rank THEN excluded.kind ELSE deals.kind END,
      rank = MAX(deals.rank, excluded.rank),
      last_seen = excluded.last_seen,
      expires = CASE WHEN excluded.rank >= deals.rank THEN excluded.expires ELSE COALESCE(deals.expires, excluded.expires) END,
      gone = CASE WHEN deals.gone = 2 THEN 2 ELSE 0 END`);
  const sight = db.prepare(`INSERT INTO sightings (deal_id, source, last_seen) VALUES (?1, ?2, ?3)
    ON CONFLICT(deal_id, source) DO UPDATE SET last_seen = excluded.last_seen`);
  // Product prices: keep when this price started, the lowest seen and on how many days.
  const price = db.prepare(`INSERT INTO pstats (id, first_seen, price, price_since, low, low_at, high_reg, days, last_day)
    VALUES (?1, ?2, ?3, ?2, ?3, ?2, ?4, 1, ?2)
    ON CONFLICT(id) DO UPDATE SET
      price_since = CASE WHEN abs(pstats.price - excluded.price) > 0.009 THEN excluded.price_since ELSE pstats.price_since END,
      low_at = CASE WHEN excluded.price < pstats.low - 0.009 THEN excluded.low_at ELSE pstats.low_at END,
      low = MIN(pstats.low, excluded.price),
      high_reg = MAX(COALESCE(pstats.high_reg, 0), COALESCE(excluded.high_reg, 0)),
      days = pstats.days + CASE WHEN pstats.last_day <> excluded.last_day THEN 1 ELSE 0 END,
      last_day = excluded.last_day,
      price = excluded.price`);
  let accepted = 0;
  for (const r of deals) {
    if (!r || typeof r.id !== 'string' || !r.data) continue;
    const obj = typeof r.data === 'string' ? safeParse(r.data) : r.data;
    const data = typeof r.data === 'string' ? r.data : JSON.stringify(r.data);
    if (data.length > 16000) continue;
    const expires = r.expires && /^\d{4}-\d{2}-\d{2}$/.test(r.expires) ? r.expires : null;
    const id = r.id.slice(0, 300);
    stmts.push(upsert.bind(id, cleanDomain(r.domain), source, String(r.kind || 'code').slice(0, 20), Number(r.rank) || 0, data, now, expires));
    stmts.push(sight.bind(id, source, now));
    const pr = obj && obj.product;
    if (pr && Number(pr.price) > 0) stmts.push(price.bind(id, day, Number(pr.price), pr.was ? Number(pr.was) : null));
    accepted++;
  }
  let retired = 0;
  if (body.complete && body.runStart) {
    // Deals this source showed before but not on this run have ended, unless
    // another source saw them in the last three days.
    stmts.push(db.prepare(`UPDATE deals SET gone = 1 WHERE gone = 0 AND id IN (
        SELECT deal_id FROM sightings WHERE source = ?1 AND last_seen < ?2)
      AND id NOT IN (SELECT deal_id FROM sightings WHERE source <> ?1 AND last_seen >= ?3)`).bind(source, String(body.runStart), daysAgo(3)));
  }
  if (stmts.length) {
    // D1 limits how much goes into one batch, so large uploads are split.
    const results = [];
    for (let i = 0; i < stmts.length; i += 300) results.push(...await db.batch(stmts.slice(i, i + 300)));
    if (body.complete && body.runStart) retired = (results[results.length - 1].meta && results[results.length - 1].meta.changes) || 0;
  }
  return json({ ok: true, accepted, retired });
}

function safeParse(t) { try { return JSON.parse(t); } catch (e) { return null; } }

async function addTests(env, body) {
  const db = env.DB;
  const list = Array.isArray(body.results) ? body.results.slice(0, 50) : [];
  const now = new Date().toISOString();
  const stmt = db.prepare('INSERT INTO tests (deal_id, domain, code, ok, saved, at, via) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)');
  const stmts = [];
  for (const t of list) {
    if (!t || !t.dealId) continue;
    stmts.push(stmt.bind(String(t.dealId).slice(0, 300), cleanDomain(t.domain), String(t.code || '').slice(0, 40), t.ok ? 1 : 0, Number(t.saved) || 0, now, String(t.via || 'addon').slice(0, 20)));
  }
  if (stmts.length) await db.batch(stmts);
  return json({ ok: true, saved: stmts.length });
}

/* ---------------- Alerts (Web Push) ---------------- */

const enc = new TextEncoder();
function b64u(buf) {
  const b = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  let s = '';
  for (let i = 0; i < b.length; i++) s += String.fromCharCode(b[i]);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
function unb64u(s) {
  s = String(s).replace(/-/g, '+').replace(/_/g, '/');
  while (s.length % 4) s += '=';
  const bin = atob(s);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}
function concat(...parts) {
  const len = parts.reduce((n, p) => n + p.length, 0);
  const out = new Uint8Array(len);
  let o = 0;
  for (const p of parts) { out.set(p, o); o += p.length; }
  return out;
}

// The hub's own signing key for alerts, made once and kept in the database.
async function vapidKeys(env) {
  let saved = await getKv(env, 'vapid', null);
  if (!saved) {
    const kp = await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify']);
    const jwk = await crypto.subtle.exportKey('jwk', kp.privateKey);
    const raw = new Uint8Array(await crypto.subtle.exportKey('raw', kp.publicKey));
    saved = { jwk, pub: b64u(raw) };
    await putKv(env, 'vapid', saved);
  }
  const key = await crypto.subtle.importKey('jwk', saved.jwk, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign']);
  return { key, pub: saved.pub };
}

async function vapidHeader(endpoint, keys, subject) {
  const aud = new URL(endpoint).origin;
  const header = b64u(enc.encode(JSON.stringify({ typ: 'JWT', alg: 'ES256' })));
  const claims = b64u(enc.encode(JSON.stringify({ aud, exp: Math.floor(Date.now() / 1000) + 12 * 3600, sub: subject })));
  const sig = await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, keys.key, enc.encode(header + '.' + claims));
  return 'vapid t=' + header + '.' + claims + '.' + b64u(sig) + ', k=' + keys.pub;
}

async function hkdf(salt, ikm, info, len) {
  const key = await crypto.subtle.importKey('raw', ikm, 'HKDF', false, ['deriveBits']);
  return new Uint8Array(await crypto.subtle.deriveBits({ name: 'HKDF', hash: 'SHA-256', salt, info }, key, len * 8));
}

// Message encryption for Web Push (RFC 8291, aes128gcm).
async function encryptPush(sub, payload) {
  const uaPublic = unb64u(sub.keys.p256dh);
  const auth = unb64u(sub.keys.auth);
  const local = await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits']);
  const asPublic = new Uint8Array(await crypto.subtle.exportKey('raw', local.publicKey));
  const uaKey = await crypto.subtle.importKey('raw', uaPublic, { name: 'ECDH', namedCurve: 'P-256' }, false, []);
  const shared = new Uint8Array(await crypto.subtle.deriveBits({ name: 'ECDH', public: uaKey }, local.privateKey, 256));
  const ikm = await hkdf(auth, shared, concat(enc.encode('WebPush: info\0'), uaPublic, asPublic), 32);
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const cek = await hkdf(salt, ikm, enc.encode('Content-Encoding: aes128gcm\0'), 16);
  const nonce = await hkdf(salt, ikm, enc.encode('Content-Encoding: nonce\0'), 12);
  const aes = await crypto.subtle.importKey('raw', cek, 'AES-GCM', false, ['encrypt']);
  const plain = concat(enc.encode(payload), new Uint8Array([2]));
  const cipher = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv: nonce }, aes, plain));
  const rs = new Uint8Array([0, 0, 16, 0]);
  return concat(salt, rs, new Uint8Array([asPublic.length]), asPublic, cipher);
}

async function sendPush(env, origin, sub, message) {
  const keys = await vapidKeys(env);
  const body = await encryptPush(sub, JSON.stringify(message));
  const res = await fetch(sub.endpoint, {
    method: 'POST',
    headers: {
      'Authorization': await vapidHeader(sub.endpoint, keys, origin),
      'Content-Encoding': 'aes128gcm',
      'Content-Type': 'application/octet-stream',
      'TTL': '86400',
      'Urgency': 'normal'
    },
    body
  });
  return res.status;
}

async function sendToAll(env, origin, message) {
  const subs = (await env.DB.prepare('SELECT endpoint, sub FROM push_subs').all()).results || [];
  let sent = 0;
  const now = new Date().toISOString();
  for (const row of subs) {
    const sub = safeParse(row.sub);
    if (!sub || !sub.endpoint) continue;
    let status = 0;
    try { status = await sendPush(env, origin, sub, message); } catch (e) { status = 0; }
    if (status >= 200 && status < 300) { sent++; await env.DB.prepare('UPDATE push_subs SET last_ok = ?2, fails = 0 WHERE endpoint = ?1').bind(row.endpoint, now).run(); }
    else if (status === 404 || status === 410) await env.DB.prepare('DELETE FROM push_subs WHERE endpoint = ?1').bind(row.endpoint).run();
    else await env.DB.prepare('UPDATE push_subs SET fails = fails + 1 WHERE endpoint = ?1').bind(row.endpoint).run();
  }
  return { sent, total: subs.length };
}

// After each collector or Gmail run: new deals on your list, new codes at your
// favorite stores, and card offers about to expire.
async function notify(env, origin) {
  const db = env.DB;
  const subs = await db.prepare('SELECT COUNT(*) AS n FROM push_subs').first();
  if (!subs || !subs.n) return { ok: true, sent: 0, note: 'No phone has turned on alerts yet.' };
  const settings = Object.assign({}, E.DEFAULT_SETTINGS, await getKv(env, 'settings', {}));
  const prefs = Object.assign({ list: true, favorites: true, expiring: true }, settings.alerts || {});
  const last = await getKv(env, 'notify:last', null) || daysAgo(1);
  const notified = await getKv(env, 'notified', {});
  const now = new Date();
  const hidden = new Set(settings.hidden || []);
  const favs = new Set(settings.favorites || []);
  const items = [];
  const fresh = (await db.prepare('SELECT id, data, first_seen, last_seen FROM deals WHERE gone = 0 AND first_seen > ?1 AND (expires IS NULL OR expires >= ?2) LIMIT 3000').bind(last, today()).all()).results || [];
  for (const row of fresh) {
    if (notified[row.id]) continue;
    const d = safeParse(row.data);
    if (!d || hidden.has(d.domain)) continue;
    const rec = { id: row.id, d, fs: row.first_seen, ls: row.last_seen };
    if (prefs.list && (settings.plan || []).length) {
      const hits = E.planMatches(settings.plan, rec, { loose: false });
      if (hits.length) { items.push({ id: row.id, d, why: 'On your list: ' + (hits[0].text || hits[0]) }); continue; }
    }
    if (prefs.favorites && favs.has(d.domain) && d.kind === 'code') items.push({ id: row.id, d, why: 'New code at ' + d.brand });
  }
  if (prefs.expiring) {
    const soon = new Date(now.getTime() + 3 * 86400000).toISOString().slice(0, 10);
    const exp = (await db.prepare("SELECT id, data FROM deals WHERE gone = 0 AND kind IN ('cardoffer','portal') AND expires >= ?1 AND expires <= ?2 LIMIT 200").bind(today(), soon).all()).results || [];
    for (const row of exp) {
      if (notified['exp:' + row.id]) continue;
      const d = safeParse(row.data);
      if (!d || hidden.has(d.domain)) continue;
      items.push({ id: 'exp:' + row.id, d, why: 'Card offer ends ' + E.fmtDay(d.expires) });
    }
  }
  await putKv(env, 'notify:last', now.toISOString());
  if (!items.length) return { ok: true, sent: 0, note: 'Nothing new to tell you about.' };
  const order = x => /^On your list/.test(x.why) ? 0 : /^Card offer/.test(x.why) ? 1 : 2;
  items.sort((a, b) => order(a) - order(b));
  const first = items[0];
  const value = d => {
    if (d.kind === 'product' && d.product) return E.money(d.product.price) + (d.product.was ? ' (was ' + E.money(d.product.was) + ')' : '');
    const p = E.parseTerms(d.title, d.terms, {});
    return p.headline || d.title;
  };
  const message = items.length === 1
    ? { title: first.d.brand + ': ' + value(first.d), body: first.why + '. ' + (first.d.kind === 'product' ? first.d.title : E.appliesTo(first.d, E.parseTerms(first.d.title, first.d.terms, {}))), url: '/#store=' + encodeURIComponent(first.d.domain), tag: 'deal-stack' }
    : { title: items.length + ' new deals for you', body: items.slice(0, 3).map(x => x.d.brand + ': ' + value(x.d)).join(' · ') + (items.length > 3 ? ' · and more' : ''), url: '/#tab=foryou', tag: 'deal-stack' };
  const r = await sendToAll(env, origin, message);
  if (r.sent) {
    const stamp = now.toISOString().slice(0, 10);
    items.forEach(x => { notified[x.id] = stamp; });
    const cutoff = new Date(now.getTime() - 40 * 86400000).toISOString().slice(0, 10);
    Object.keys(notified).forEach(k => { if (notified[k] < cutoff) delete notified[k]; });
    await putKv(env, 'notified', notified);
  }
  return { ok: true, sent: r.sent, items: items.length };
}

/* ---------------- API ---------------- */

async function handleApi(request, env, url) {
  const path = url.pathname.replace(/\/+$/, '');
  if (path === '/api/ping') {
    return json({ ok: true, app: 'deal-stack', version: VERSION, db: !!env.DB, key: !!env.APP_KEY, engine: !!E });
  }
  if (!env.APP_KEY) return fail('The hub has no APP_KEY yet. Add it in Cloudflare (Settings, Variables and Secrets) and redeploy.', 503);
  if (!env.DB) return fail('The database is not connected. In Cloudflare add a D1 binding named DB and redeploy.', 503);
  const key = request.headers.get('x-hub-key') || '';
  if (!sameKey(key, env.APP_KEY)) return fail('Wrong or missing key.', 401);

  await ensureSchema(env.DB);
  const method = request.method;
  if (path === '/api/deals' && method === 'GET') return getDeals(env, url);
  if (path === '/api/domains' && method === 'GET') return getDomains(env);
  if (path === '/api/ingest' && method === 'POST') return ingest(env, await readBody(request));
  if (path === '/api/tests' && method === 'POST') return addTests(env, await readBody(request));
  if (path === '/api/settings' && method === 'GET') {
    const r = await env.DB.prepare("SELECT v FROM kv WHERE k = 'settings'").first();
    return json('{"ok":true,"settings":' + ((r && r.v) || 'null') + '}', 200, true);
  }
  if (path === '/api/settings' && method === 'PUT') {
    const body = await readBody(request);
    await putKv(env, 'settings', body.settings || {});
    return json({ ok: true });
  }
  if (path === '/api/status' && method === 'POST') {
    const body = await readBody(request);
    const name = String(body.name || 'other').replace(/[^a-z0-9_-]/gi, '').slice(0, 30);
    await putKv(env, 'status:' + name, body.report || {});
    return json({ ok: true });
  }
  if (path === '/api/hide' && method === 'POST') {
    const body = await readBody(request);
    const r = await env.DB.prepare('UPDATE deals SET gone = 2 WHERE id = ?1').bind(String(body.id || '')).run();
    return json({ ok: true, hidden: (r.meta && r.meta.changes) || 0 });
  }
  if (path === '/api/push/key' && method === 'GET') {
    const k = await vapidKeys(env);
    const n = await env.DB.prepare('SELECT COUNT(*) AS n FROM push_subs').first();
    return json({ ok: true, key: k.pub, phones: (n && n.n) || 0 });
  }
  if (path === '/api/push/subscribe' && method === 'POST') {
    const body = await readBody(request);
    const sub = body.subscription;
    if (!sub || typeof sub.endpoint !== 'string' || !/^https:\/\//.test(sub.endpoint) || !sub.keys || !sub.keys.p256dh || !sub.keys.auth) return fail('That alert subscription is not valid.');
    await env.DB.prepare('INSERT INTO push_subs (endpoint, sub, created) VALUES (?1, ?2, ?3) ON CONFLICT(endpoint) DO UPDATE SET sub = excluded.sub, fails = 0').bind(sub.endpoint, JSON.stringify(sub), new Date().toISOString()).run();
    return json({ ok: true });
  }
  if (path === '/api/push/unsubscribe' && method === 'POST') {
    const body = await readBody(request);
    await env.DB.prepare('DELETE FROM push_subs WHERE endpoint = ?1').bind(String(body.endpoint || '')).run();
    return json({ ok: true });
  }
  if (path === '/api/push/test' && method === 'POST') {
    const r = await sendToAll(env, url.origin, { title: 'Deal Stack alerts are on', body: "You'll hear about new deals on your list and card offers about to expire.", url: '/#tab=foryou', tag: 'deal-stack-test' });
    return json({ ok: true, sent: r.sent, phones: r.total });
  }
  if (path === '/api/notify' && method === 'POST') return json(await notify(env, url.origin));
  return fail('Not found.', 404);
}

/* ---------------- Installable add-ons ---------------- */

async function asset(env, request, path) {
  const res = await env.ASSETS.fetch(new Request(new URL(path, request.url).toString()));
  if (!res.ok) throw new Error('Missing file ' + path);
  return res.text();
}

async function handleInstall(request, env, url) {
  const origin = url.origin;
  const engine = await asset(env, request, '/engine.js');
  if (url.pathname === '/install/deal-stack.user.js') {
    const tpl = await asset(env, request, '/addon.js');
    const body = tpl.replace('__HUB_URL__', origin).replace('/*__ENGINE__*/', () => engine);
    return new Response(body, { headers: { 'content-type': 'text/javascript; charset=utf-8', 'cache-control': 'no-store' } });
  }
  if (url.pathname === '/install/gmail-scanner.gs') {
    const tpl = await asset(env, request, '/gmail.js');
    const body = tpl.replace('__HUB_URL__', origin).replace('/*__ENGINE__*/', () => engine);
    return new Response(body, { headers: { 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'no-store' } });
  }
  return new Response('Not found', { status: 404 });
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS });
    try {
      if (url.pathname.startsWith('/api/')) return await handleApi(request, env, url);
      if (url.pathname.startsWith('/install/')) return await handleInstall(request, env, url);
      if (/^\/(_worker\.js|collector\.js|workflow\.txt|wrangler\.jsonc)$/.test(url.pathname)) return new Response('Not found', { status: 404 });
      const res = await env.ASSETS.fetch(request);
      if (url.pathname === '/sw.js') {
        const h = new Headers(res.headers);
        h.set('cache-control', 'no-cache');
        h.set('service-worker-allowed', '/');
        return new Response(res.body, { status: res.status, headers: h });
      }
      return res;
    } catch (err) {
      return fail(err && err.message ? err.message : 'Something went wrong.', 500);
    }
  }
};
