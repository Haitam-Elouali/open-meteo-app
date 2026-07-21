// Shared location picker. Wires the header geo button on every page to open
// a modal with a Country <select> and a City <select>. The city dropdown is
// enabled only after a country is chosen and is populated with that country's
// cities. On confirm it resolves the chosen city to lat/lon, overwrites the
// saved location, and dispatches a `location:changed` event so pages reload.
(function () {
  const COUNTRIES = [
    "Afghanistan", "Albania", "Algeria", "Andorra", "Angola", "Argentina", "Armenia", "Australia",
    "Austria", "Azerbaijan", "Bahamas", "Bangladesh", "Barbados", "Belarus", "Belgium", "Belize",
    "Benin", "Bhutan", "Bolivia", "Bosnia and Herzegovina", "Botswana", "Brazil", "Brunei", "Bulgaria",
    "Burkina Faso", "Burundi", "Cabo Verde", "Cambodia", "Cameroon", "Canada", "Chad", "Chile",
    "China", "Colombia", "Comoros", "Congo", "Costa Rica", "Croatia", "Cuba", "Cyprus", "Czechia",
    "Denmark", "Djibouti", "Dominica", "Ecuador", "Egypt", "El Salvador", "Eritrea", "Estonia",
    "Eswatini", "Ethiopia", "Fiji", "Finland", "France", "Gabon", "Gambia", "Georgia", "Germany",
    "Ghana", "Greece", "Grenada", "Guatemala", "Guinea", "Guyana", "Haiti", "Honduras", "Hungary",
    "Iceland", "India", "Indonesia", "Iran", "Iraq", "Ireland", "Italy", "Jamaica", "Japan",
    "Jordan", "Kazakhstan", "Kenya", "Kiribati", "Kuwait", "Kyrgyzstan", "Laos", "Latvia", "Lebanon",
    "Lesotho", "Liberia", "Libya", "Liechtenstein", "Lithuania", "Luxembourg", "Madagascar", "Malawi",
    "Malaysia", "Mali", "Malta", "Mauritania", "Mauritius", "Mexico", "Moldova", "Monaco", "Mongolia",
    "Montenegro", "Morocco", "Mozambique", "Myanmar", "Namibia", "Nauru", "Nepal", "Netherlands",
    "New Zealand", "Nicaragua", "Niger", "Nigeria", "North Korea", "North Macedonia", "Norway", "Oman",
    "Pakistan", "Palestine", "Panama", "Papua New Guinea", "Paraguay", "Peru", "Philippines", "Poland",
    "Portugal", "Qatar", "Romania", "Russia", "Rwanda", "Saint Kitts and Nevis", "Saint Lucia",
    "Saint Vincent and the Grenadines", "Samoa", "San Marino", "Sao Tome and Principe", "Saudi Arabia",
    "Senegal", "Serbia", "Seychelles", "Sierra Leone", "Singapore", "Slovakia", "Slovenia", "Solomon Islands",
    "Somalia", "South Africa", "South Korea", "South Sudan", "Spain", "Sri Lanka", "Sudan", "Suriname",
    "Sweden", "Switzerland", "Syria", "Taiwan", "Tajikistan", "Tanzania", "Thailand", "Togo", "Tonga",
    "Trinidad and Tobago", "Tunisia", "Turkey", "Turkmenistan", "Tuvalu", "Uganda", "Ukraine",
    "United Arab Emirates", "United Kingdom", "United States", "Uruguay", "Uzbekistan", "Vanuatu",
    "Vatican City", "Venezuela", "Vietnam", "Yemen", "Zambia", "Zimbabwe"
  ];

  // Major cities per country (capital + a few extras). Only names are stored;
  // coordinates are resolved on confirm via the geocoding API.
    const CITIES_BY_COUNTRY = {
    "Afghanistan": [
    "Kabul",
    "Kandahar",
    "Herat",
    "Mazar-i-Sharif",
    "Kunduz",
    "Jalalabad",
    "Ghazni",
    "Bamyan"
    ],
    "Albania": [
    "Tirana",
    "Durrës",
    "Vlorë",
    "Elbasan",
    "Shkodër",
    "Fier",
    "Korçë",
    "Berat"
    ],
    "Algeria": [
    "Algiers",
    "Oran",
    "Constantine",
    "Annaba",
    "Blida",
    "Batna",
    "Sétif",
    "Tlemcen",
    "Béjaïa",
    "Skikda"
    ],
    "Andorra": [
    "Andorra la Vella",
    "Escaldes-Engordany",
    "Sant Julià de Lòria",
    "Encamp",
    "La Massana"
    ],
    "Angola": [
    "Luanda",
    "Huambo",
    "Lobito",
    "Benguela",
    "Namibe",
    "Cabinda",
    "Malanje",
    "Saurimo"
    ],
    "Argentina": [
    "Buenos Aires",
    "Cordoba",
    "Rosario",
    "Mendoza",
    "Tucuman",
    "La Plata",
    "Mar del Plata",
    "Salta",
    "Santa Fe",
    "San Juan",
    "Bahia Blanca",
    "San Miguel de Tucuman"
    ],
    "Armenia": [
    "Yerevan",
    "Gyumri",
    "Vanadzor",
    "Vagharshapat",
    "Abovyan",
    "Kapan"
    ],
    "Australia": [
    "Canberra",
    "Sydney",
    "Melbourne",
    "Brisbane",
    "Perth",
    "Adelaide",
    "Gold Coast",
    "Newcastle",
    "Hobart",
    "Darwin",
    "Wollongong",
    "Geelong",
    "Townsville"
    ],
    "Austria": [
    "Vienna",
    "Graz",
    "Linz",
    "Salzburg",
    "Innsbruck",
    "Klagenfurt",
    "Villach",
    "Wels",
    "Sankt Pölten",
    "Dornbirn"
    ],
    "Azerbaijan": [
    "Baku",
    "Ganja",
    "Sumqayit",
    "Mingachevir",
    "Shirvan",
    "Nakhchivan"
    ],
    "Bahamas": [
    "Nassau",
    "Freeport",
    "West End",
    "Cooper's Town",
    "Marsh Harbour"
    ],
    "Bangladesh": [
    "Dhaka",
    "Chittagong",
    "Khulna",
    "Rajshahi",
    "Sylhet",
    "Barisal",
    "Rangpur",
    "Comilla"
    ],
    "Barbados": [
    "Bridgetown",
    "Speightstown",
    "Oistins",
    "Bathsheba",
    "Holetown"
    ],
    "Belarus": [
    "Minsk",
    "Gomel",
    "Mogilev",
    "Vitebsk",
    "Grodno",
    "Brest",
    "Bobruisk"
    ],
    "Belgium": [
    "Brussels",
    "Antwerp",
    "Ghent",
    "Charleroi",
    "Liège",
    "Bruges",
    "Namur",
    "Leuven",
    "Mons",
    "Aalst"
    ],
    "Belize": [
    "Belize City",
    "San Ignacio",
    "Orange Walk",
    "Belmopan",
    "Dangriga"
    ],
    "Benin": [
    "Porto-Novo",
    "Cotonou",
    "Djougou",
    "Bohicon",
    "Parakou",
    "Abomey-Calavi"
    ],
    "Bhutan": [
    "Thimphu",
    "Phuntsholing",
    "Punakha",
    "Paro",
    "Gelephu"
    ],
    "Bolivia": [
    "La Paz",
    "Santa Cruz de la Sierra",
    "Cochabamba",
    "Sucre",
    "Oruro",
    "Tarija",
    "Potosi"
    ],
    "Bosnia and Herzegovina": [
    "Sarajevo",
    "Banja Luka",
    "Tuzla",
    "Zenica",
    "Mostar",
    "Bijeljina"
    ],
    "Botswana": [
    "Gaborone",
    "Francistown",
    "Molepolole",
    "Maun",
    "Serowe",
    "Selibe Phikwe"
    ],
    "Brazil": [
    "Brasília",
    "Sao Paulo",
    "Rio de Janeiro",
    "Salvador",
    "Fortaleza",
    "Belo Horizonte",
    "Manaus",
    "Curitiba",
    "Recife",
    "Porto Alegre",
    "Goiânia",
    "Belém",
    "Natal",
    "Maceió"
    ],
    "Brunei": [
    "Bandar Seri Begawan",
    "Kuala Belait",
    "Seria",
    "Tutong",
    "Bangar"
    ],
    "Bulgaria": [
    "Sofia",
    "Plovdiv",
    "Varna",
    "Burgas",
    "Ruse",
    "Stara Zagora",
    "Pleven",
    "Sliven"
    ],
    "Burkina Faso": [
    "Ouagadougou",
    "Bobo-Dioulasso",
    "Koudougou",
    "Banfora",
    "Ouahigouya"
    ],
    "Burundi": [
    "Bujumbura",
    "Gitega",
    "Muyinga",
    "Ngozi",
    "Ruyigi"
    ],
    "Cabo Verde": [
    "Praia",
    "Mindelo",
    "Santa Maria",
    "Assomada",
    "São Filipe"
    ],
    "Cambodia": [
    "Phnom Penh",
    "Siem Reap",
    "Battambang",
    "Sihanoukville",
    "Kampong Cham"
    ],
    "Cameroon": [
    "Yaoundé",
    "Douala",
    "Garoua",
    "Bamenda",
    "Bafoussam",
    "Maroua",
    "Ngaoundéré",
    "Buea"
    ],
    "Canada": [
    "Ottawa",
    "Toronto",
    "Montreal",
    "Vancouver",
    "Calgary",
    "Edmonton",
    "Quebec",
    "Winnipeg",
    "Hamilton",
    "Kitchener",
    "London",
    "Victoria",
    "Halifax"
    ],
    "Chad": [
    "N'Djamena",
    "Moundou",
    "Sarh",
    "Abéché",
    "Doba"
    ],
    "Chile": [
    "Santiago",
    "Valparaiso",
    "Concepcion",
    "La Serena",
    "Antofagasta",
    "Temuco",
    "Rancagua",
    "Talca",
    "Arica",
    "Puerto Montt"
    ],
    "China": [
    "Beijing",
    "Shanghai",
    "Guangzhou",
    "Shenzhen",
    "Chengdu",
    "Tianjin",
    "Wuhan",
    "Xian",
    "Hangzhou",
    "Nanjing",
    "Chongqing",
    "Shenyang",
    "Harbin",
    "Kunming",
    "Qingdao"
    ],
    "Colombia": [
    "Bogotá",
    "Medellin",
    "Cali",
    "Barranquilla",
    "Cartagena",
    "Cúcuta",
    "Bucaramanga",
    "Pereira",
    "Santa Marta",
    "Ibagué",
    "Manizales"
    ],
    "Comoros": [
    "Moroni",
    "Moutsamoudou",
    "Fomboni",
    "Domoni",
    "Tsémbéhou"
    ],
    "Congo": [
    "Brazzaville",
    "Pointe-Noire",
    "Dolisie",
    "Nkayi",
    "Kindou"
    ],
    "Costa Rica": [
    "San José",
    "Alajuela",
    "Cartago",
    "Heredia",
    "Puntarenas",
    "Liberia"
    ],
    "Croatia": [
    "Zagreb",
    "Split",
    "Rijeka",
    "Osijek",
    "Zadar",
    "Pula",
    "Slavonski Brod"
    ],
    "Cuba": [
    "Havana",
    "Santiago de Cuba",
    "Camagüey",
    "Holguín",
    "Santa Clara",
    "Guantánamo",
    "Cienfuegos"
    ],
    "Cyprus": [
    "Nicosia",
    "Limassol",
    "Larnaca",
    "Paphos",
    "Famagusta",
    "Kyrenia"
    ],
    "Czechia": [
    "Prague",
    "Brno",
    "Ostrava",
    "Plzen",
    "Liberec",
    "Olomouc",
    "Ceske Budejovice",
    "Hradec Kralove",
    "Usti nad Labem",
    "Pardubice"
    ],
    "Denmark": [
    "Copenhagen",
    "Aarhus",
    "Odense",
    "Aalborg",
    "Frederiksberg",
    "Esbjerg",
    "Randers",
    "Kolding",
    "Horsens",
    "Vejle"
    ],
    "Djibouti": [
    "Djibouti",
    "Ali Sabieh",
    "Tadjourah",
    "Obock",
    "Dikhil"
    ],
    "Dominica": [
    "Roseau",
    "Portsmouth",
    "Mahaut",
    "Berekua",
    "Saint Joseph"
    ],
    "Ecuador": [
    "Quito",
    "Guayaquil",
    "Cuenca",
    "Santo Domingo",
    "Machala",
    "Manta",
    "Ambato",
    "Portoviejo",
    "Loja"
    ],
    "Egypt": [
    "Cairo",
    "Alexandria",
    "Giza",
    "Shubra El Kheima",
    "Port Said",
    "Suez",
    "Luxor",
    "Aswan",
    "Mansoura",
    "El Mahalla El Kubra",
    "Tanta",
    "Assiut"
    ],
    "El Salvador": [
    "San Salvador",
    "Santa Ana",
    "Soyapango",
    "San Miguel",
    "Nueva San Salvador",
    "La Unión"
    ],
    "Eritrea": [
    "Asmara",
    "Keren",
    "Massawa",
    "Assab",
    "Mendefera"
    ],
    "Estonia": [
    "Tallinn",
    "Tartu",
    "Narva",
    "Pärnu",
    "Kohtla-Järve",
    "Viljandi"
    ],
    "Eswatini": [
    "Mbabane",
    "Manzini",
    "Big Bend",
    "Malkerns",
    "Nhlangano"
    ],
    "Ethiopia": [
    "Addis Ababa",
    "Dire Dawa",
    "Mekelle",
    "Gondar",
    "Bahir Dar",
    "Hawassa",
    "Jimma",
    "Dessie"
    ],
    "Fiji": [
    "Suva",
    "Nadi",
    "Lautoka",
    "Labasa",
    "Ba",
    "Levuka"
    ],
    "Finland": [
    "Helsinki",
    "Espoo",
    "Tampere",
    "Vantaa",
    "Oulu",
    "Turku",
    "Jyväskylä",
    "Lahti",
    "Kuopio",
    "Pori"
    ],
    "France": [
    "Paris",
    "Lyon",
    "Marseille",
    "Toulouse",
    "Nice",
    "Nantes",
    "Montpellier",
    "Strasbourg",
    "Bordeaux",
    "Lille",
    "Rennes",
    "Reims",
    "Saint-Étienne",
    "Le Havre",
    "Toulon"
    ],
    "Gabon": [
    "Libreville",
    "Port-Gentil",
    "Franceville",
    "Oyem",
    "Moanda"
    ],
    "Gambia": [
    "Banjul",
    "Serekunda",
    "Brikama",
    "Bakau",
    "Farafenni"
    ],
    "Georgia": [
    "Tbilisi",
    "Kutaisi",
    "Batumi",
    "Rustavi",
    "Zugdidi",
    "Gori"
    ],
    "Germany": [
    "Berlin",
    "Munich",
    "Hamburg",
    "Cologne",
    "Frankfurt",
    "Stuttgart",
    "Düsseldorf",
    "Dortmund",
    "Leipzig",
    "Bremen",
    "Dresden",
    "Hannover",
    "Nuremberg",
    "Duisburg"
    ],
    "Ghana": [
    "Accra",
    "Kumasi",
    "Tamale",
    "Sekondi-Takoradi",
    "Ashaiman",
    "Sunyani",
    "Cape Coast"
    ],
    "Greece": [
    "Athens",
    "Thessaloniki",
    "Patras",
    "Heraklion",
    "Larissa",
    "Volos",
    "Ioannina",
    "Chania",
    "Chalcis",
    "Serres",
    "Kavala"
    ],
    "Grenada": [
    "St. George's",
    "Gouyave",
    "Grenville",
    "Victoria",
    "Sauteurs"
    ],
    "Guatemala": [
    "Guatemala City",
    "Mixco",
    "Villa Nueva",
    "Quetzaltenango",
    "Petapa",
    "San Juan Sacatepéquez"
    ],
    "Guinea": [
    "Conakry",
    "Nzérékoré",
    "Kankan",
    "Kindia",
    "Labé",
    "Mamou"
    ],
    "Guyana": [
    "Georgetown",
    "Linden",
    "New Amsterdam",
    "Anna Regina",
    "Bartica"
    ],
    "Haiti": [
    "Port-au-Prince",
    "Carrefour",
    "Delmas",
    "Cap-Haïtien",
    "Pétion-Ville",
    "Les Cayes"
    ],
    "Honduras": [
    "Tegucigalpa",
    "San Pedro Sula",
    "La Ceiba",
    "Choloma",
    "El Progreso",
    "Comayagua"
    ],
    "Hungary": [
    "Budapest",
    "Debrecen",
    "Szeged",
    "Miskolc",
    "Pécs",
    "Győr",
    "Nyíregyháza",
    "Kecskemét",
    "Székesfehérvár",
    "Szombathely"
    ],
    "Iceland": [
    "Reykjavik",
    "Kópavogur",
    "Hafnarfjörður",
    "Akureyri",
    "Reykjanesbær",
    "Garðabær"
    ],
    "India": [
    "New Delhi",
    "Mumbai",
    "Bangalore",
    "Hyderabad",
    "Chennai",
    "Kolkata",
    "Pune",
    "Ahmedabad",
    "Jaipur",
    "Lucknow",
    "Kanpur",
    "Nagpur",
    "Indore",
    "Thane",
    "Bhopal",
    "Visakhapatnam"
    ],
    "Indonesia": [
    "Jakarta",
    "Surabaya",
    "Bandung",
    "Bekasi",
    "Medan",
    "Tangerang",
    "Depok",
    "Semarang",
    "Palembang",
    "Makassar",
    "Yogyakarta",
    "Surakarta",
    "Denpasar"
    ],
    "Iran": [
    "Tehran",
    "Mashhad",
    "Isfahan",
    "Karaj",
    "Tabriz",
    "Shiraz",
    "Ahvaz",
    "Qom",
    "Kermanshah",
    "Urmia"
    ],
    "Iraq": [
    "Baghdad",
    "Basra",
    "Mosul",
    "Erbil",
    "Kirkuk",
    "Karbala",
    "Najaf",
    "Sulaymaniyah"
    ],
    "Ireland": [
    "Dublin",
    "Cork",
    "Limerick",
    "Galway",
    "Waterford",
    "Drogheda",
    "Dundalk",
    "Swords",
    "Bray",
    "Navan"
    ],
    "Italy": [
    "Rome",
    "Milan",
    "Naples",
    "Turin",
    "Palermo",
    "Genoa",
    "Bologna",
    "Florence",
    "Venice",
    "Bari",
    "Catania",
    "Verona",
    "Messina",
    "Padua"
    ],
    "Jamaica": [
    "Kingston",
    "Spanish Town",
    "Portmore",
    "Montego Bay",
    "Mandeville",
    "May Pen"
    ],
    "Japan": [
    "Tokyo",
    "Osaka",
    "Nagoya",
    "Sapporo",
    "Fukuoka",
    "Kobe",
    "Kyoto",
    "Kawasaki",
    "Saitama",
    "Hiroshima",
    "Sendai",
    "Yokohama",
    "Chiba"
    ],
    "Jordan": [
    "Amman",
    "Zarqa",
    "Irbid",
    "Russeifa",
    "Aqaba",
    "Mafraq",
    "Madaba"
    ],
    "Kazakhstan": [
    "Almaty",
    "Astana",
    "Shymkent",
    "Karagandy",
    "Aktobe",
    "Taraz",
    "Pavlodar",
    "Ust-Kamenogorsk"
    ],
    "Kenya": [
    "Nairobi",
    "Mombasa",
    "Kisumu",
    "Nakuru",
    "Eldoret",
    "Thika",
    "Malindi",
    "Kitale",
    "Garissa",
    "Kakamega"
    ],
    "Kiribati": [
    "South Tarawa",
    "Betio",
    "Bairiki",
    "Bikenibeu",
    "Tabwakea"
    ],
    "Kuwait": [
    "Kuwait City",
    "Hawalli",
    "Al Farwaniyah",
    "Al Ahmadi",
    "Salmiya",
    "Jahra"
    ],
    "Kyrgyzstan": [
    "Bishkek",
    "Osh",
    "Jalal-Abad",
    "Karakol",
    "Tokmok",
    "Talas"
    ],
    "Laos": [
    "Vientiane",
    "Savannakhet",
    "Pakse",
    "Luang Prabang",
    "Phonsavan",
    "Thakhek"
    ],
    "Latvia": [
    "Riga",
    "Daugavpils",
    "Liepāja",
    "Jelgava",
    "Jūrmala",
    "Ventspils"
    ],
    "Lebanon": [
    "Beirut",
    "Tripoli",
    "Sidon",
    "Tyre",
    "Nabatieh",
    "Baalbek"
    ],
    "Lesotho": [
    "Maseru",
    "Teyateyaneng",
    "Mafeteng",
    "Hlotse",
    "Mohale's Hoek"
    ],
    "Liberia": [
    "Monrovia",
    "Gbarnga",
    "Kakata",
    "Bensonville",
    "Harper",
    "Voinjama"
    ],
    "Libya": [
    "Tripoli",
    "Benghazi",
    "Misrata",
    "Tarhuna",
    "Al Khums",
    "Ajdabiya",
    "Sabha"
    ],
    "Liechtenstein": [
    "Vaduz",
    "Schaan",
    "Triesen",
    "Balzers",
    "Triesenberg"
    ],
    "Lithuania": [
    "Vilnius",
    "Kaunas",
    "Klaipėda",
    "Šiauliai",
    "Panevėžys",
    "Alytus"
    ],
    "Luxembourg": [
    "Luxembourg",
    "Esch-sur-Alzette",
    "Differdange",
    "Dudelange",
    "Ettelbruck"
    ],
    "Madagascar": [
    "Antananarivo",
    "Toamasina",
    "Mahajanga",
    "Fianarantsoa",
    "Toliara",
    "Antsiranana"
    ],
    "Malawi": [
    "Lilongwe",
    "Blantyre",
    "Mzimba",
    "Zomba",
    "Kasungu",
    "Mangochi"
    ],
    "Malaysia": [
    "Kuala Lumpur",
    "George Town",
    "Ipoh",
    "Shah Alam",
    "Petaling Jaya",
    "Johor Bahru",
    "Kota Kinabalu",
    "Kuching",
    "Malacca City"
    ],
    "Mali": [
    "Bamako",
    "Sikasso",
    "Mopti",
    "Koutiala",
    "Ségou",
    "Kayes",
    "Gao"
    ],
    "Malta": [
    "Valletta",
    "Birkirkara",
    "Qormi",
    "Mosta",
    "Żabbar",
    "St. Paul's Bay"
    ],
    "Mauritania": [
    "Nouakchott",
    "Nouadhibou",
    "Néma",
    "Kaédi",
    "Rosso",
    "Zouérat"
    ],
    "Mauritius": [
    "Port Louis",
    "Beau Bassin-Rose Hill",
    "Vacoas-Phoenix",
    "Curepipe",
    "Quatre Bornes",
    "Mahébourg"
    ],
    "Mexico": [
    "Mexico City",
    "Guadalajara",
    "Monterrey",
    "Puebla",
    "Tijuana",
    "León",
    "Juárez",
    "Cancún",
    "Mexicali",
    "Acapulco",
    "Veracruz",
    "Mérida",
    "Chihuahua",
    "Culiacán"
    ],
    "Moldova": [
    "Chisinau",
    "Tiraspol",
    "Bălți",
    "Bender",
    "Râbnița",
    "Cahul"
    ],
    "Monaco": [
    "Monaco",
    "Monte Carlo",
    "La Condamine",
    "Fontvieille",
    "Moneghetti"
    ],
    "Mongolia": [
    "Ulaanbaatar",
    "Erdenet",
    "Darkhan",
    "Choibalsan",
    "Ölgii",
    "Ulaangom"
    ],
    "Montenegro": [
    "Podgorica",
    "Nikšić",
    "Herceg Novi",
    "Pljevlja",
    "Budva",
    "Bijela"
    ],
    "Morocco": [
    "Rabat",
    "Casablanca",
    "Fes",
    "Marrakesh",
    "Agadir",
    "Tangier",
    "Meknes",
    "Oujda",
    "Kenitra",
    "Tetouan",
    "Safi",
    "Mohammedia",
    "El Jadida",
    "Beni Mellal",
    "Nador",
    "Taza",
    "Settat",
    "Berrechid",
    "Laayoune",
    "Dakhla",
    "Essaouira",
    "Chefchaouen",
    "Ouarzazate",
    "Errachidia",
    "Al Hoceima",
    "Larache",
    "Ksar El Kebir",
    "Berkane",
    "Oued Zem",
    "Khouribga",
    "Sidi Ifni",
    "Sidi Slimane",
    "Sidi Yahya",
    "Sidi Kacem"
    ],
    "Mozambique": [
    "Maputo",
    "Matola",
    "Beira",
    "Nampula",
    "Chimoio",
    "Nacala",
    "Quelimane",
    "Tete"
    ],
    "Myanmar": [
    "Yangon",
    "Mandalay",
    "Naypyidaw",
    "Mawlamyine",
    "Bago",
    "Pathein",
    "Taunggyi"
    ],
    "Namibia": [
    "Windhoek",
    "Rundu",
    "Walvis Bay",
    "Swakopmund",
    "Katima Mulilo",
    "Oshakati",
    "Gobabis"
    ],
    "Nauru": [
    "Yaren",
    "Aiwo",
    "Boe",
    "Meneng",
    "Anibare"
    ],
    "Nepal": [
    "Kathmandu",
    "Pokhara",
    "Lalitpur",
    "Birgunj",
    "Biratnagar",
    "Janakpur",
    "Dharan",
    "Butwal"
    ],
    "Netherlands": [
    "Amsterdam",
    "Rotterdam",
    "The Hague",
    "Utrecht",
    "Eindhoven",
    "Tilburg",
    "Groningen",
    "Almere",
    "Breda",
    "Nijmegen",
    "Enschede",
    "Haarlem"
    ],
    "New Zealand": [
    "Wellington",
    "Auckland",
    "Christchurch",
    "Hamilton",
    "Tauranga",
    "Napier",
    "Dunedin",
    "Palmerston North",
    "Nelson",
    "Rotorua",
    "Whangarei"
    ],
    "Nicaragua": [
    "Managua",
    "León",
    "Chinandega",
    "Masaya",
    "Matagalpa",
    "Estelí",
    "Granada"
    ],
    "Niger": [
    "Niamey",
    "Zinder",
    "Maradi",
    "Agadez",
    "Tahoua",
    "Dosso",
    "Diffa"
    ],
    "Nigeria": [
    "Abuja",
    "Lagos",
    "Kano",
    "Ibadan",
    "Benin City",
    "Port Harcourt",
    "Kaduna",
    "Enugu",
    "Aba",
    "Ilorin",
    "Jos",
    "Oyo",
    "Warri"
    ],
    "North Korea": [
    "Pyongyang",
    "Hamhung",
    "Chongjin",
    "Nampo",
    "Wonsan",
    "Sinuiju",
    "Kaesong"
    ],
    "North Macedonia": [
    "Skopje",
    "Bitola",
    "Kumanovo",
    "Prilep",
    "Tetovo",
    "Ohrid",
    "Veles"
    ],
    "Norway": [
    "Oslo",
    "Bergen",
    "Trondheim",
    "Stavanger",
    "Drammen",
    "Fredrikstad",
    "Kristiansand",
    "Tromsø",
    "Sandnes",
    "Ålesund",
    "Bodø"
    ],
    "Oman": [
    "Muscat",
    "Salalah",
    "Sohar",
    "Nizwa",
    "Sur",
    "Rustaq",
    "Ibri",
    "Bawshar"
    ],
    "Pakistan": [
    "Islamabad",
    "Karachi",
    "Lahore",
    "Faisalabad",
    "Rawalpindi",
    "Multan",
    "Peshawar",
    "Quetta",
    "Hyderabad",
    "Gujranwala",
    "Sialkot"
    ],
    "Palestine": [
    "Gaza",
    "Ramallah",
    "Hebron",
    "Nablus",
    "Bethlehem",
    "Jenin",
    "Khan Yunis",
    "Jericho"
    ],
    "Panama": [
    "Panama City",
    "San Miguelito",
    "Tocumen",
    "David",
    "Colon",
    "Santiago de Veraguas",
    "La Chorrera"
    ],
    "Papua New Guinea": [
    "Port Moresby",
    "Lae",
    "Mount Hagen",
    "Madang",
    "Wewak",
    "Goroka",
    "Kokopo"
    ],
    "Paraguay": [
    "Asunción",
    "Ciudad del Este",
    "San Lorenzo",
    "Luque",
    "Capiatá",
    "Encarnación",
    "Lambaré"
    ],
    "Peru": [
    "Lima",
    "Arequipa",
    "Trujillo",
    "Chiclayo",
    "Piura",
    "Cusco",
    "Chimbote",
    "Iquitos",
    "Huancayo",
    "Tacna"
    ],
    "Philippines": [
    "Manila",
    "Quezon City",
    "Davao",
    "Cebu",
    "Zamboanga",
    "Cagayan de Oro",
    "Parañaque",
    "Dasmariñas",
    "Valenzuela",
    "Bacolod",
    "Iloilo City",
    "Cagayan de Oro"
    ],
    "Poland": [
    "Warsaw",
    "Krakow",
    "Lodz",
    "Wroclaw",
    "Poznan",
    "Gdansk",
    "Szczecin",
    "Bydgoszcz",
    "Lublin",
    "Katowice",
    "Bialystok",
    "Gdynia",
    "Czestochowa"
    ],
    "Portugal": [
    "Lisbon",
    "Porto",
    "Braga",
    "Coimbra",
    "Funchal",
    "Setúbal",
    "Amadora",
    "Aveiro",
    "Faro",
    "Madeira",
    "Leiria",
    "Vila Nova de Gaia"
    ],
    "Qatar": [
    "Doha",
    "Al Rayyan",
    "Al Wakrah",
    "Umm Salal",
    "Al Khor",
    "Al Daayen",
    "Al Shamal"
    ],
    "Romania": [
    "Bucharest",
    "Cluj-Napoca",
    "Timișoara",
    "Iași",
    "Constanța",
    "Craiova",
    "Brașov",
    "Galați",
    "Ploiești",
    "Oradea",
    "Arad"
    ],
    "Russia": [
    "Moscow",
    "Saint Petersburg",
    "Novosibirsk",
    "Yekaterinburg",
    "Kazan",
    "Nizhny Novgorod",
    "Chelyabinsk",
    "Samara",
    "Omsk",
    "Rostov-on-Don",
    "Ufa",
    "Krasnoyarsk",
    "Voronezh",
    "Perm"
    ],
    "Rwanda": [
    "Kigali",
    "Butare",
    "Gitarama",
    "Ruhengeri",
    "Gisenyi",
    "Kibuye"
    ],
    "Saint Kitts and Nevis": [
    "Basseterre",
    "Charlestown",
    "Dieppe Bay Town",
    "Sandy Point",
    "Cayon"
    ],
    "Saint Lucia": [
    "Castries",
    "Soufrière",
    "Vieux Fort",
    "Micoud",
    "Gros Islet",
    "Dennery"
    ],
    "Saint Vincent and the Grenadines": [
    "Kingstown",
    "Georgetown",
    "Barrouallie",
    "Port Elizabeth",
    "Chateaubelair"
    ],
    "Samoa": [
    "Apia",
    "Vaitele",
    "Faleula",
    "Malie",
    "Siusega"
    ],
    "San Marino": [
    "San Marino",
    "Borgo Maggiore",
    "Serravalle",
    "Domagnano",
    "Fiorentino"
    ],
    "Sao Tome and Principe": [
    "São Tomé",
    "Santo Amaro",
    "Neves",
    "Santana",
    "Trindade"
    ],
    "Saudi Arabia": [
    "Riyadh",
    "Jeddah",
    "Mecca",
    "Medina",
    "Dammam",
    "Khobar",
    "Tabuk",
    "Buraidah",
    "Khamis Mushait",
    "Abha",
    "Hail",
    "Jubail",
    "Yanbu",
    "Taif"
    ],
    "Senegal": [
    "Dakar",
    "Touba",
    "Thiès",
    "Rufisque",
    "Saint-Louis",
    "Kaolack",
    "Mbacké",
    "Ziguinchor"
    ],
    "Serbia": [
    "Belgrade",
    "Novi Sad",
    "Niš",
    "Kragujevac",
    "Subotica",
    "Prizren",
    "Kraljevo",
    "Zrenjanin"
    ],
    "Seychelles": [
    "Victoria",
    "Anse Boileau",
    "Beau Vallon",
    "Takamaka",
    "Cascade"
    ],
    "Sierra Leone": [
    "Freetown",
    "Bo",
    "Kenema",
    "Makeni",
    "Koidu",
    "Port Loko"
    ],
    "Singapore": [
    "Singapore",
    "Bedok",
    "Ang Mo Kio",
    "Tampines",
    "Woodlands",
    "Hougang",
    "Jurong"
    ],
    "Slovakia": [
    "Bratislava",
    "Košice",
    "Prešov",
    "Žilina",
    "Banská Bystrica",
    "Nitra",
    "Trnava",
    "Martin"
    ],
    "Slovenia": [
    "Ljubljana",
    "Maribor",
    "Celje",
    "Kranj",
    "Koper",
    "Velenje",
    "Novo Mesto"
    ],
    "Solomon Islands": [
    "Honiara",
    "Auki",
    "Gizo",
    "Kirakira",
    "Lata",
    "Buala"
    ],
    "Somalia": [
    "Mogadishu",
    "Hargeisa",
    "Burao",
    "Kismayo",
    "Merca",
    "Baidoa",
    "Bosaso"
    ],
    "South Africa": [
    "Pretoria",
    "Johannesburg",
    "Cape Town",
    "Durban",
    "Port Elizabeth",
    "Bloemfontein",
    "East London",
    "Nelspruit",
    "Polokwane",
    "Kimberley",
    "Pietermaritzburg",
    "Upington"
    ],
    "South Korea": [
    "Seoul",
    "Busan",
    "Incheon",
    "Daegu",
    "Daejeon",
    "Gwangju",
    "Suwon",
    "Ulsan",
    "Jeonju",
    "Cheongju",
    "Changwon",
    "Ansan"
    ],
    "South Sudan": [
    "Juba",
    "Wau",
    "Malakal",
    "Yambio",
    "Bor",
    "Bentiu"
    ],
    "Spain": [
    "Madrid",
    "Barcelona",
    "Valencia",
    "Seville",
    "Zaragoza",
    "Malaga",
    "Murcia",
    "Palma",
    "Bilbao",
    "Alicante",
    "Cordoba",
    "Valladolid",
    "Vigo",
    "Granada",
    "A Coruña"
    ],
    "Sri Lanka": [
    "Colombo",
    "Dehiwala-Mount Lavinia",
    "Moratuwa",
    "Sri Jayawardenepura Kotte",
    "Kandy",
    "Galle",
    "Jaffna",
    "Negombo"
    ],
    "Sudan": [
    "Khartoum",
    "Omdurman",
    "Khartoum North",
    "Nyala",
    "Port Sudan",
    "Kassala",
    "El Obeid",
    "Wad Madani"
    ],
    "Suriname": [
    "Paramaribo",
    "Lelydorp",
    "Nieuw Nickerie",
    "Moengo",
    "Wanica",
    "Albina"
    ],
    "Sweden": [
    "Stockholm",
    "Gothenburg",
    "Malmö",
    "Uppsala",
    "Västerås",
    "Örebro",
    "Linköping",
    "Helsingborg",
    "Jönköping",
    "Norrköping",
    "Lund",
    "Umeå"
    ],
    "Switzerland": [
    "Bern",
    "Zurich",
    "Geneva",
    "Basel",
    "Lausanne",
    "Winterthur",
    "Lucerne",
    "St. Gallen",
    "Lugano",
    "Fribourg",
    "Thun",
    "Chur"
    ],
    "Syria": [
    "Damascus",
    "Aleppo",
    "Homs",
    "Hama",
    "Latakia",
    "Raqqa",
    "Deir ez-Zor",
    "Idlib"
    ],
    "Taiwan": [
    "Taipei",
    "Kaohsiung",
    "Taichung",
    "Tainan",
    "Taoyuan",
    "Hsinchu",
    "Keelung",
    "Chiayi"
    ],
    "Tajikistan": [
    "Dushanbe",
    "Khujand",
    "Bokhtar",
    "Kulob",
    "Istaravshan",
    "Panjakent",
    "Vahdat"
    ],
    "Tanzania": [
    "Dodoma",
    "Dar es Salaam",
    "Mwanza",
    "Arusha",
    "Mbeya",
    "Morogoro",
    "Tanga",
    "Zanzibar City",
    "Kigoma"
    ],
    "Thailand": [
    "Bangkok",
    "Chiang Mai",
    "Pattaya",
    "Phuket",
    "Hat Yai",
    "Nakhon Ratchasima",
    "Chonburi",
    "Udon Thani",
    "Ubon Ratchathani",
    "Nakhon Si Thammarat",
    "Khon Kaen",
    "Surat Thani"
    ],
    "Togo": [
    "Lomé",
    "Sokodé",
    "Kara",
    "Kpalimé",
    "Atakpamé",
    "Dapaong",
    "Tsévié"
    ],
    "Tonga": [
    "Nuku'alofa",
    "Neiafu",
    "Pangai",
    "Hihifo",
    "Haveluloto"
    ],
    "Trinidad and Tobago": [
    "Chaguanas",
    "Mon Repos",
    "San Fernando",
    "Port of Spain",
    "Arima",
    "Point Fortin",
    "Tunapuna"
    ],
    "Tunisia": [
    "Tunis",
    "Sfax",
    "Sousse",
    "Kairouan",
    "Bizerte",
    "Gabès",
    "Ariana",
    "Monastir",
    "La Marsa"
    ],
    "Turkey": [
    "Ankara",
    "Istanbul",
    "Izmir",
    "Bursa",
    "Adana",
    "Gaziantep",
    "Konya",
    "Antalya",
    "Kayseri",
    "Mersin",
    "Eskisehir",
    "Kocaeli",
    "Samsun"
    ],
    "Turkmenistan": [
    "Ashgabat",
    "Türkmenabat",
    "Daşoguz",
    "Mary",
    "Bayramaly",
    "Abadan"
    ],
    "Tuvalu": [
    "Funafuti",
    "Vaiaku",
    "Asau",
    "Motufoua",
    "Gardner"
    ],
    "Uganda": [
    "Kampala",
    "Gulu",
    "Lira",
    "Mbarara",
    "Jinja",
    "Mbale",
    "Masaka",
    "Entebbe"
    ],
    "Ukraine": [
    "Kyiv",
    "Kharkiv",
    "Odessa",
    "Dnipro",
    "Donetsk",
    "Zaporizhzhia",
    "Lviv",
    "Kryvyi Rih",
    "Mykolaiv",
    "Luhansk",
    "Vinnytsia",
    "Kherson"
    ],
    "United Arab Emirates": [
    "Abu Dhabi",
    "Dubai",
    "Sharjah",
    "Al Ain",
    "Ajman",
    "Ras Al Khaimah",
    "Fujairah",
    "Umm Al Quwain",
    "Dibba",
    "Ghayathi"
    ],
    "United Kingdom": [
    "London",
    "Manchester",
    "Birmingham",
    "Leeds",
    "Glasgow",
    "Liverpool",
    "Bristol",
    "Edinburgh",
    "Cardiff",
    "Belfast",
    "Nottingham",
    "Sheffield",
    "Leicester",
    "Coventry",
    "Bradford",
    "Newcastle upon Tyne"
    ],
    "United States": [
    "Washington",
    "New York",
    "Los Angeles",
    "Chicago",
    "Houston",
    "Phoenix",
    "Philadelphia",
    "San Antonio",
    "San Diego",
    "Dallas",
    "San Jose",
    "Austin",
    "Miami",
    "Jacksonville",
    "Columbus",
    "Charlotte",
    "Indianapolis",
    "Seattle",
    "Denver",
    "Boston",
    "Nashville",
    "Detroit",
    "Atlanta",
    "Portland"
    ],
    "Uruguay": [
    "Montevideo",
    "Salto",
    "Paysandú",
    "Las Piedras",
    "Rivera",
    "Melo",
    "Tacuarembó"
    ],
    "Uzbekistan": [
    "Tashkent",
    "Namangan",
    "Samarkand",
    "Andijan",
    "Bukhara",
    "Nukus",
    "Qarshi",
    "Fergana"
    ],
    "Vanuatu": [
    "Port Vila",
    "Luganville",
    "Isangel",
    "Sola",
    "Lakatoro"
    ],
    "Vatican City": [
    "Vatican City"
    ],
    "Venezuela": [
    "Caracas",
    "Maracay",
    "Valencia",
    "Barquisimeto",
    "Maracaibo",
    "Ciudad Guayana",
    "San Cristóbal",
    "Maturín",
    "Barcelona"
    ],
    "Vietnam": [
    "Hanoi",
    "Ho Chi Minh City",
    "Da Nang",
    "Haiphong",
    "Huế",
    "Nha Trang",
    "Can Tho",
    "Bien Hoa",
    "Hue",
    "Vung Tau",
    "Hai Duong",
    "Quy Nhon"
    ],
    "Yemen": [
    "Sana'a",
    "Aden",
    "Taiz",
    "Al Hudaydah",
    "Ibb",
    "Mukalla",
    "Saada",
    "Dhamar"
    ],
    "Zambia": [
    "Lusaka",
    "Ndola",
    "Kitwe",
    "Kabwe",
    "Chingola",
    "Mufulira",
    "Livingstone",
    "Kasama"
    ],
    "Zimbabwe": [
    "Harare",
    "Bulawayo",
    "Chitungwiza",
    "Mutare",
    "Gweru",
    "Kwekwe",
    "Kadoma",
    "Masvingo"
    ],
  };

  function $(sel) { return document.querySelector(sel); }

  function citiesFor(country) {
    if (CITIES_BY_COUNTRY[country]) return CITIES_BY_COUNTRY[country];
    // Fall back to the country's capital (same name as the country entry's
    // capital list is not stored, so just return the country itself as a
    // single resolvable option).
    return null;
  }

  async function fetchCitiesFromEndpoint(country) {
    try {
      const qs = new URLSearchParams({ country });
      const res = await fetch(`/api/cities?${qs.toString()}`);
      if (!res.ok) return null;
      const data = await res.json();
      const cities = (data?.cities || []).filter(Boolean);
      return cities.length ? cities : null;
    } catch (e) {
      return null;
    }
  }

  function t(key, fallback) {
    try {
      const dict = (window.I18n && window.I18n.DICT) || {};
      const lang = window.I18n && window.I18n.getLang ? window.I18n.getLang() : 'en';
      return (dict[lang] && dict[lang][key] != null) ? dict[lang][key] : (fallback || key);
    } catch (e) { return fallback || key; }
  }

  function populateCities(cities) {
    const citySelect = $('.location-city');
    if (!citySelect) return;
    citySelect.disabled = false;
    citySelect.innerHTML = `<option value="">${t('location.selectCity', 'Select a city')}</option>` +
      cities.map((c) => `<option value="${escapeAttr(c)}">${escapeHtml(c)}</option>`).join('');
  }

  function uniqueCityNames(results) {
    const seen = new Set();
    const out = [];
    (results || []).forEach((r) => {
      const name = r?.name || r?.city;
      if (name && !seen.has(name)) {
        seen.add(name);
        out.push(name);
      }
    });
    return out;
  }

  function removeCountry(select, country) {
    if (!select) return;
    const opt = Array.from(select.options).find((o) => o.value === country);
    if (opt) opt.remove();
    select.value = '';
  }

  function escapeHtml(str) {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }

  function escapeAttr(str) {
    return escapeHtml(str).replace(/"/g, '&quot;');
  }

  function openModal() {
    const backdrop = $('.location-modal-backdrop');
    if (!backdrop) return;
    const countrySelect = $('.location-country');
    if (countrySelect && countrySelect.options.length <= 1) {
      countrySelect.innerHTML = `<option value="">${t('location.selectCountry', 'Select a country')}</option>` +
        COUNTRIES.map((c) => `<option value="${c}">${c}</option>`).join('');
    }
    const citySelect = $('.location-city');
    if (citySelect) {
      const savedCountry = countrySelect?.value;
      if (savedCountry) {
        const cities = citiesFor(savedCountry);
        if (cities && cities.length) {
          populateCities(cities);
        } else {
          citySelect.innerHTML = `<option value="">${t('location.selectCountryFirst', 'Select a country first')}</option>`;
          citySelect.disabled = true;
        }
      } else {
        citySelect.innerHTML = `<option value="">${t('location.selectCountryFirst', 'Select a country first')}</option>`;
        citySelect.disabled = true;
      }
    }
    if (window.I18n && window.I18n.apply) window.I18n.apply();
    backdrop.hidden = false;
  }

  function closeModal() {
    const backdrop = $('.location-modal-backdrop');
    if (backdrop) backdrop.hidden = true;
  }

  async function resolveCity(country, cityName) {
    const qs = new URLSearchParams({ country, city: cityName, count: 5 });
    const res = await fetch(`/api/location?${qs.toString()}`);
    if (!res.ok) throw new Error('Location search failed');
    const data = await res.json();
    const results = (data?.results || []).filter(
      (r) => (r.country || '').trim().toLowerCase() === country.trim().toLowerCase()
    );
    return results[0] || data?.results?.[0];
  }

  async function fetchCitiesForCountry(country, query) {
    const qs = new URLSearchParams({ country, city: query, count: 50 });
    const res = await fetch(`/api/location?${qs.toString()}`);
    if (!res.ok) return [];
    const data = await res.json();
    return data?.results || [];
  }

  function wire() {
    const backdrop = $('.location-modal-backdrop');
    if (!backdrop) return;

    const geoBtn = $('.header__geo-button');
    if (geoBtn) geoBtn.addEventListener('click', openModal);

    backdrop.querySelector('.location-cancel')?.addEventListener('click', closeModal);
    backdrop.addEventListener('click', (e) => { if (e.target === backdrop) closeModal(); });

    const countrySelect = $('.location-country');
    const citySelect = $('.location-city');

    countrySelect?.addEventListener('change', async () => {
      const country = countrySelect.value;
      if (!citySelect) return;
      if (!country) {
        citySelect.innerHTML = `<option value="">${t('location.selectCountryFirst', 'Select a country first')}</option>`;
        citySelect.disabled = true;
        return;
      }

      // Prefer the comprehensive curated city list served by the backend
      // (covers every major city, e.g. Morocco). Fall back to the local
      // curated list, then to the live geocoding API.
      const endpointCities = await fetchCitiesFromEndpoint(country);
      if (endpointCities && endpointCities.length) {
        populateCities(endpointCities);
        return;
      }

      const localCities = citiesFor(country);
      if (localCities && localCities.length) {
        populateCities(localCities);
        return;
      }

      // No curated list: ask the geocoding API. If it returns nothing, the
      // country has no resolvable cities, so drop it from the dropdown.
      fetchCitiesForCountry(country, '')
        .then((results) => {
          const names = uniqueCityNames(results);
          if (names.length) {
            populateCities(names);
          } else {
            removeCountry(countrySelect, country);
            citySelect.innerHTML = `<option value="">${t('location.noCities', 'No cities available')}</option>`;
            citySelect.disabled = true;
          }
        })
        .catch(() => {
          citySelect.innerHTML = `<option value="">${t('location.noCities', 'No cities available')}</option>`;
          citySelect.disabled = true;
        });
    });

    const confirmBtn = backdrop.querySelector('.location-confirm');
    if (confirmBtn) {
      confirmBtn.addEventListener('click', async () => {
        const country = countrySelect?.value;
        const cityName = citySelect?.value?.trim();
        if (!country || !cityName) return;
        try {
          const r = await resolveCity(country, cityName);
          if (!r) return;
          window.__lastLatLon = { lat: Number(r.lat), lon: Number(r.lon) };
          try { localStorage.setItem('open-meteo-latlon', JSON.stringify(window.__lastLatLon)); } catch (e) {}
          try { localStorage.setItem('open-meteo-city', cityName); } catch (e) {}
          try { localStorage.setItem('open-meteo-country', country); } catch (e) {}
          closeModal();
          window.dispatchEvent(new CustomEvent('location:changed', { detail: window.__lastLatLon }));
        } catch (e) { console.error(e); }
      });
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', wire);
  } else {
    wire();
  }
})();
