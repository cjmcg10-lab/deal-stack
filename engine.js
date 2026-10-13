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

  var VERSION = '1.0.0';
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

  function parseTerms(title, terms, opts) {
    opts = opts || {};
    var full = clean((title || '') + ' . ' + (terms || ''));
    var t = full;
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
    // Caps: "50% off, up to $15", "Max $30 back", "maximum of $10"
    m = /%[^.$]{0,40}?\bup to\s+\$\s?(\d{1,4})/i.exec(noShip) || /\bmax(?:imum)?\.?\s*(?:of\s*)?\$\s?(\d{1,4})(?:\.\d{2})?\s*(?:back|cash back|off|savings|discount|in rewards)?/i.exec(noShip) || /\bup to\s+\$\s?(\d{1,4})\s*(?:back|cash back|in rewards)/i.exec(noShip);
    if (m) p.cap = num(m[1]);
    // "off a drink", "off one item": a single item, not the whole order
    p.singleItem = /\boff\s+(?:a|an|one|any one|1|your next|a single)\s+(?!order\b|purchase\b|online order\b|qualifying order\b)[a-z]/i.test(noShip) || /\b(?:free|complimentary)\s+(?:drink|item|entree|appetizer|dessert|side|coffee|gift)\b/i.test(noShip);

    // Dollars off, and "$X off $Y"
    m = /\$\s?(\d{1,4}(?:\.\d{2})?)\s*off(?:\s+(?:your\s+|an?\s+|any\s+)?(?:(?:orders?|purchases?)\s+(?:of\s+|over\s+)?)?\$\s?(\d{1,4})\s?\+?)?/i.exec(noShip) ||
        /save\s+\$\s?(\d{1,4}(?:\.\d{2})?)(?:\s+(?:on|when you spend|with)\s+(?:orders?\s+(?:of\s+)?)?\$\s?(\d{1,4}))?/i.exec(noShip) ||
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
          /\$\s?(\d{1,4})\s+(?:or more|minimum)/i.exec(noShip);
      if (m) p.minSpend = num(m[1]);
    }

    p.bogo = /\bbogo\b|buy\s+(?:one|1),?\s+get\s+(?:one|1)/i.test(t);
    p.newCust = /\bnew\s+(?:customers?|members?|accounts?|subscribers?|users?|sign-?ups?)\b|first[- ](?:order|purchase|time|app order)|first\s+\w+\s+order/i.test(t);
    p.appOnly = /\b(?:in|via|on|through|using)\s+(?:the|our)\s+(?:\w+\s+)?app\b|\bapp[- ]only\b|\bapp[- ]exclusive\b|\bmobile app only\b/i.test(t);
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
    if (p.cashPct && (!p.pct || /back|reward/i.test(title || ''))) return (p.upTo ? 'Up to ' : '') + pctStr(p.cashPct) + ' back';
    if (p.cashAmt && !p.pct && !p.amt) return money(p.cashAmt) + ' back';
    if (p.pct) return (p.upTo ? 'Up to ' : p.extra ? 'Extra ' : '') + pctStr(p.pct) + ' off';
    if (p.amt) return money(p.amt) + ' off' + (p.minSpend ? ' ' + money(p.minSpend) + '+' : '');
    if (p.bogo) return 'Buy one, get one';
    if (p.freeShip) return 'Free shipping';
    return '';
  }

  function buildGist(p, opts) {
    var parts = [];
    if (p.headline) parts.push(p.headline);
    if (p.minSpend && !(p.amt && /\+$/.test(p.headline))) parts.push(money(p.minSpend) + ' min');
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
    if (p.minSpend) b.push('Spend at least ' + money(p.minSpend) + ' (usually before tax and shipping).');
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
    var terms = clean(raw.terms || '').slice(0, 1800);
    var p = parseTerms(title, terms, { refDate: raw.posted || now, kind: kind, code: code, card: raw.card });
    var expires = raw.expires || p.expires || null;
    if (!expires && DEFAULT_LIFE[raw.sourceType]) {
      expires = isoDay(addDays(raw.posted ? new Date(raw.posted) : now, DEFAULT_LIFE[raw.sourceType]));
    }
    var id;
    if (kind === 'cardoffer') id = domain + '|card:' + (raw.card || 'other');
    else if (kind === 'portal') id = domain + '|portal:' + (raw.portal || 'c1shopping');
    else if (code) id = domain + '|C:' + code;
    else if (raw.sourceType === 'community' && raw.url) id = domain + '|L:' + hashStr(raw.url);
    else id = domain + '|S:' + hashStr(normName(title).slice(0, 60));
    var brand = BY_DOMAIN[domain];
    var data = {
      v: 1,
      domain: domain,
      brand: raw.brand || (brand && brand.name) || domain,
      kind: kind,
      title: title,
      code: code,
      url: raw.url || (brand && brand.url) || null,
      terms: terms,
      cat: raw.cat || classify(title + ' ' + terms, brand ? brand.cat : null),
      sourceType: raw.sourceType || 'official',
      sourceName: raw.sourceName || '',
      sourceUrl: raw.sourceUrl || null,
      card: raw.card || null,
      portal: raw.portal || null,
      price: raw.price || null,
      votes: raw.votes == null ? null : raw.votes,
      posted: raw.posted ? isoDay(raw.posted) : null,
      expires: expires,
      expSet: !!(raw.expires || p.expires),
      item: !!(raw.item || raw.sourceType === 'costco' || (raw.sourceType === 'community' && raw.price) || p.singleItem),
      guessed: !!raw.guessed,
      personal: !!raw.personal
    };
    return { id: id, domain: domain, kind: kind, rank: SOURCE_RANK[data.sourceType] || 1, expires: expires, data: data };
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
    return { score: score, status: status, reasons: reasons, expires: expires, daysLeft: daysLeft, terms: p, tests: tests };
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
    return !!(d.item || d.sourceType === 'costco' || (d.sourceType === 'community' && d.price) || (p && p.singleItem));
  }

  // A rough "percent off a typical order" used to rank deals against each other.
  function typicalPct(p, d) {
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
    var discounts = usable.filter(function (x) { var t = x.a.terms; return (x.rec.d.kind === 'code' || x.rec.d.kind === 'sale') && !isItemDeal(x.rec.d, t) && !t.storeCard && !t.verify; }).map(function (x) {
      var v = dealValue(x.a.terms, amount);
      return { x: x, value: v.amt, short: v.short, weighted: v.amt * (0.35 + 0.65 * x.a.score / 100) };
    });
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
    if (nearMiss && (!disc || nearMiss.x.rec.id !== disc.x.rec.id)) {
      var nv = dealValue(nearMiss.x.a.terms, nearMiss.x.a.terms.minSpend);
      if (nv.amt > discAmt) warnings.push('Spend ' + money(nearMiss.short) + ' more to unlock ' + (nearMiss.x.a.terms.headline || 'a bigger discount') + '.');
    }
    return { store: store, amount: amount, discount: disc, options: options, best: options[0] || null, warnings: warnings };
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
    var out = [];
    list.forEach(function (x) {
      var d = x.rec.d;
      if (x.a.status === 'failed' || x.a.status === 'expired') return;
      if (d.kind === 'portal') return;
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
      if (extra && extra > 3 && d.kind !== 'cardoffer' && !isItemDeal(d, x.a.terms)) { rank *= 1 + Math.min(0.5, extra / 20); why.push('Stacks with ' + pctStr(extra) + ' more from your cards and offers'); }
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
    { t: 'Costco needs no clipping', b: "Costco's monthly member savings come off automatically at the register or online. Pay in the warehouse with a Visa credit card." }
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
